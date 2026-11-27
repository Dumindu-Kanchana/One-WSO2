// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { useState, type JSX, type ReactNode } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { Alert, Box, Button, Card, Checkbox, FormControlLabel, Skeleton, TextField, Typography } from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { Engagement, EngagementTypeId } from "../api/engagementTypes";
import { useCreateEngagement, useIdempotencyKey, useUpdateEngagement } from "../api/useEngagementMutations";
import { useEngagement, useEngagementTypes, useOpportunities, useReferenceData } from "../api/useEngagementApi";
import { useEngagementAccess } from "../api/useEngagementUserInfo";
import EaDialog from "../components/EaDialog";
import EaPage from "../components/EaPage";
import { Failed } from "../components/ListCard";
import { RequestStatusChip } from "../components/StatusChips";
import { engagementPaths } from "../engagementPaths";
import { canApprove, canEditEngagement, canEditPending, isPaidType } from "../model/engagementAccess";
import {
  changesOf,
  engagementCode,
  formOf,
  inputOf,
  isCustomerForm,
  needsFundingFields,
  newForm,
  subRegionLocked,
  validateForm,
  withAccount,
  type EngagementFormState,
  type FormErrors,
} from "../model/engagementForm";
import { EVENT_NATURES, NATURES } from "../model/statuses";
import { HttpError } from "@api/http";
import { CheckIcon } from "@wso2/oxygen-ui-icons-react";
import { eaError } from "../api/engagementHttp";
import { useUnsavedGuard } from "../components/useUnsavedGuard";
import { AccountSearchField, CampaignField, FundingSourcesField, LabelWithLock, SelectField } from "./formFields";

/** Create Customer Engagement, or Create Internal Engagement / Marketing Event. */
export function CreateEngagementPage(): JSX.Element {
  const { kind } = useParams();
  const [search] = useSearchParams();
  const access = useEngagementAccess();
  const allowed = kind === "customer" ? access.createCustomer : access.createInternal || access.createMarketing;
  if (!allowed || (kind !== "customer" && kind !== "internal")) return <Navigate to={engagementPaths.engagements()} replace />;
  const wanted = Number(search.get("type"));
  const initial: EngagementTypeId | 0 =
    kind === "internal"
      ? wanted === 5 && access.createMarketing
        ? 5
        : wanted === 1 && access.createInternal
          ? 1
          : access.createInternal && !access.createMarketing
            ? 1
            : !access.createInternal && access.createMarketing
              ? 5
              : 0
      : 0;
  return <EngagementForm key={`${kind}-${initial}`} kind={kind} initial={newForm(initial)} />;
}

/** Edit an engagement (5 / 15), or edit it while it waits for approval (27 / 30). */
export function EditEngagementPage({ pending: pendingMode = false }: { pending?: boolean }): JSX.Element {
  const { id = "" } = useParams();
  const engagement = useEngagement(id);
  const { p } = useEngagementAccess();
  const back = { to: engagementPaths.engagement(id), label: id };
  if (engagement.isPending) {
    return (
      <EaPage title={`Edit ${id}`} back={back}>
        <FormSkeleton />
      </EaPage>
    );
  }
  if (engagement.isError) {
    const gone = engagement.error instanceof HttpError && (engagement.error.status === 404 || engagement.error.status === 403);
    return (
      <EaPage title={`Edit ${id}`} back={back}>
        {gone ? (
          <Alert severity="info">This engagement isn&apos;t one you can open, or it doesn&apos;t exist.</Alert>
        ) : (
          <Failed what="the engagement" error={engagement.error} onRetry={() => void engagement.refetch()} retrying={engagement.isFetching} />
        )}
      </EaPage>
    );
  }
  const e = engagement.data;
  const allowed = pendingMode
    ? e.requestStatus === "Pending Approval" && canEditPending(p, e.typeId)
    : e.requestStatus !== "Pending Approval" && e.requestStatus !== "Cancelled" && canEditEngagement(p, e.typeId);
  if (!allowed) return <Navigate to={engagementPaths.engagement(id)} replace />;
  return <EngagementForm key={e.id} kind={isCustomerForm(e.typeId) ? "customer" : "internal"} initial={formOf(e)} edit={{ e, pending: pendingMode }} />;
}

function EngagementForm({
  kind,
  initial,
  edit,
}: {
  kind: "customer" | "internal";
  initial: EngagementFormState;
  edit?: { e: Engagement; pending: boolean };
}): JSX.Element {
  const navigate = useNavigate();
  const notify = useNotifications();
  const access = useEngagementAccess();
  const types = useEngagementTypes();
  const ref = useReferenceData();
  // The form compares against what it opened with, so a refetch never shows up as an edit.
  const [base, setBase] = useState(initial);
  const [f, setF] = useState<EngagementFormState>(initial);
  // The picked account's own Sales Sub Region: it locks the field on customer create; an account without one
  // leaves the field open for the user to fill (see subRegionLocked).
  const [accountSubRegion, setAccountSubRegion] = useState("");
  // Fetch New Dates changes only the dates: take them into the form and its baseline, keeping every other unsaved edit.
  const [dates, setDates] = useState({ start: initial.start, end: initial.end });
  if (initial.start !== dates.start || initial.end !== dates.end) {
    setDates({ start: initial.start, end: initial.end });
    setBase((b) => ({ ...b, start: initial.start, end: initial.end }));
    setF((x) => ({ ...x, start: initial.start, end: initial.end }));
  }
  const [errors, setErrors] = useState<FormErrors>({});
  const [confirm, setConfirm] = useState<"update" | "approve" | null>(null);
  const [failure, setFailure] = useState<unknown>();
  const create = useCreateEngagement();
  const update = useUpdateEngagement();
  const idempotency = useIdempotencyKey();
  // An edited customer engagement keeps its Salesforce records; a new one picks them.
  const opportunities = useOpportunities(kind === "customer" ? (edit ? edit.e.accountId : f.accountId || undefined) : undefined, f.typeId || undefined);

  const isEdit = Boolean(edit);
  const pendingEdit = edit?.pending ?? false;
  const t = f.typeId;
  const cust = kind === "customer";
  const paid = t !== 0 && isPaidType(t);
  const fundingRequired = needsFundingFields(t, isEdit);
  // A paid customer create takes the account's sub region; an account without one needs the form's.
  const subRegionRequired = fundingRequired || (cust && paid && !isEdit && Boolean(f.accountId) && !accountSubRegion);
  const sublocked = subRegionLocked({ cust, edit: isEdit, pendingEdit, accountId: f.accountId, accountSubRegion });
  const mkt = t === 5;
  const typeDef = types.data?.find((x) => x.id === t);
  const allocTypeDef = typeDef?.allocationTypes.find((a) => a.name === f.allocationType);
  const opportunity = opportunities.data?.find((o) => o.id === (edit ? edit.e.opportunityId : f.opportunityId));
  const lineItem = opportunity?.lineItems.find((l) => l.id === (edit ? edit.e.lineItemId : f.lineItemId));
  const campaignRequired = mkt && !isEdit;
  // On edit the campaign changes while pending, or is added to an event that has none.
  const campaignLocked = isEdit && !pendingEdit && Boolean(base.campaignId);
  const code = isEdit && !(pendingEdit && f.allocationType !== base.allocationType) ? edit!.e.code : engagementCode(f, { opportunity, lineItem, allocationType: allocTypeDef });
  const lockAfterApproval = isEdit && !pendingEdit;
  const guard = useUnsavedGuard(JSON.stringify(f) !== JSON.stringify(base));
  const changes = isEdit ? changesOf(base, f, allocTypeDef ? Number(allocTypeDef.id) : undefined) : {};
  const changed = Object.keys(changes).length > 0;

  const set = <K extends keyof EngagementFormState>(key: K, value: EngagementFormState[K]) => {
    setF((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const typeOptions: [string, string][] = (types.data ?? [])
    .filter((x) => (cust ? x.kind === "Customer" && x.active && x.id !== 2 : (x.id === 1 && access.createInternal) || (x.id === 5 && access.createMarketing)))
    .map((x) => [String(x.id), x.name]);
  const productUnits = (flag: "customer" | "internal") =>
    (ref.data?.productUnits ?? []).filter((p) => p[flag] && (!p.businessUnit || p.businessUnit === f.businessUnit)).map((p) => p.name);

  // Picking an opportunity, then a line item, fills what the legacy form took from Salesforce (the account's country, sub region and address were set when the account was picked).
  const pickOpportunity = (id: string) => {
    const o = opportunities.data?.find((x) => x.id === id);
    setF((prev) => ({ ...prev, opportunityId: id, lineItemId: "", address: o?.address ?? prev.address }));
  };
  const pickLineItem = (id: string) => {
    const l = opportunity?.lineItems.find((x) => x.id === id);
    setF((prev) => ({
      ...prev,
      lineItemId: id,
      description: l?.description ?? "",
      businessUnit: l?.businessUnit ?? prev.businessUnit,
      productUnit: l?.productUnit ?? prev.productUnit,
      start: paid ? (l?.start ?? "") : prev.start,
      end: paid ? (l?.end ?? "") : prev.end,
      tentative: paid ? Boolean(l?.tentativeDates) : prev.tentative,
    }));
  };

  const submit = () => {
    const x = validateForm(f, { edit: isEdit, campaignRequired, accountHasSubRegion: !f.accountId || Boolean(accountSubRegion) });
    setErrors(x);
    if (Object.values(x).some(Boolean)) return;
    setFailure(undefined);
    create.mutate({ body: inputOf(f, allocTypeDef ? Number(allocTypeDef.id) : undefined), idempotencyKey: idempotency.key }, {
      onSuccess: (created) => {
        idempotency.renew();
        const id = created?.id;
        const noun = cust ? "Engagement" : mkt ? "Event" : "Engagement";
        notify.showSuccess(`${noun}${id ? ` ${id}` : ""} added successfully${cust ? "" : ". It is waiting for approval"}`);
        // Into the new record. Internal ones and events are waiting for approval, so they open on Details.
        const list = engagementPaths.engagements(cust ? "customer" : mkt ? "marketing" : "internal");
        navigate(id ? engagementPaths.engagement(id, cust ? "allocations" : "details") : access.approvals && !cust ? engagementPaths.approvals(mkt ? "marketing" : "internal") : list, { replace: true });
      },
      onError: (err) => {
        // NetSuite already has an event with this name: say so on the Event Name field.
        if (mkt && err instanceof HttpError && err.status === 409) {
          setErrors((prev) => ({ ...prev, title: `A marketing event named ${f.title.trim()} already exists in NetSuite. Use a different Event Name.` }));
          return;
        }
        setFailure(err);
      },
    });
  };

  const askUpdate = (approve: boolean) => {
    if (!approve && !changed) return;
    const x = validateForm(f, { edit: true, campaignRequired });
    setErrors(x);
    if (Object.values(x).some(Boolean)) return;
    setFailure(undefined);
    setConfirm(approve ? "approve" : "update");
  };

  // Fetch New Dates: the backend refreshes a paid engagement's dates from its
  // Salesforce line item; the form then reloads with them.
  const fetchNewDates = () => {
    if (!edit) return;
    setFailure(undefined);
    update.mutate(
      { id: edit.e.id, fields: { refreshDatesFromSalesforce: true } },
      { onSuccess: () => notify.showSuccess("Dates updated successfully"), onError: setFailure },
    );
  };

  const e = edit?.e;
  const title = isEdit
    ? `Edit ${e!.id}`
    : cust
      ? "Create Customer Engagement"
      : t === 5
        ? "Create Marketing Event"
        : t === 1
          ? "Create Internal Engagement"
          : "Create Internal Engagement or Event";
  const back = isEdit
    ? { to: pendingEdit ? engagementPaths.approvals(t === 5 ? "marketing" : "internal") : engagementPaths.engagement(e!.id), label: pendingEdit ? "Approvals" : e!.id }
    : { to: engagementPaths.engagements(cust ? "customer" : t === 5 ? "marketing" : "internal"), label: "Engagements" };

  const area = (key: keyof EngagementFormState, label: string, rows: number, opts: { required?: boolean; readOnly?: boolean; hint?: string; max?: number; lock?: boolean } = {}) => (
    <TextField
      fullWidth
      multiline
      minRows={rows}
      size="small"
      label={<LabelWithLock label={label} lock={opts.lock} />}
      required={opts.required}
      value={f[key] as string}
      onChange={(ev) => set(key, ev.target.value as never)}
      slotProps={{ input: { readOnly: opts.readOnly }, htmlInput: opts.max ? { maxLength: opts.max } : undefined }}
      error={Boolean(errors[key])}
      helperText={errors[key] ?? opts.hint}
    />
  );

  if (types.isError) {
    return (
      <EaPage title={title} back={back}>
        <Failed what="the engagement types" error={types.error} onRetry={() => void types.refetch()} retrying={types.isFetching} />
      </EaPage>
    );
  }

  return (
    <EaPage
      title={title}
      back={back}
      chips={e ? <RequestStatusChip status={e.requestStatus} /> : undefined}
      subtitle={e ? `${e.id}, ${e.typeName}` : cust ? "Fields with a lock are filled from Salesforce." : undefined}
    >
      <Card variant="outlined" sx={{ p: { xs: 2, sm: 3 }, maxWidth: 960 }}>
        {ref.isError ? (
          <Failed what="the dropdown lists" error={ref.error} onRetry={() => void ref.refetch()} retrying={ref.isFetching} />
        ) : null}
        <Grid>
          {isEdit ? (
            <TextField size="small" label={mkt ? "Event ID" : "Engagement ID"} value={e!.id} slotProps={{ input: { readOnly: true } }} />
          ) : (
            <SelectField
              label="Engagement Type"
              required
              placeholder="Select Type"
              value={t ? String(t) : ""}
              options={typeOptions}
              error={errors.typeId}
              onChange={(v) =>
                setF({
                  ...newForm(Number(v) as EngagementTypeId),
                  accountId: f.accountId,
                  accountName: f.accountName,
                  // The sub region goes with the retained account (customer create locks it to the account's).
                  ...(cust ? { subRegion: f.subRegion } : {}),
                })
              }
            />
          )}
          <span />
          {t ? (
            <>
              {cust ? (
                <>
                  {isEdit ? (
                    <TextField size="small" label={<LabelWithLock label="Account" lock />} value={f.accountName} slotProps={{ input: { readOnly: true } }} />
                  ) : (
                    <AccountSearchField
                      value={f.accountId ? { id: f.accountId, name: f.accountName } : null}
                      error={errors.accountId}
                      onPick={(a) => {
                        setAccountSubRegion(a?.subRegion ?? "");
                        // The account fills or clears the locked fields, so their old errors no longer apply.
                        setErrors((prev) => ({ ...prev, accountId: undefined, subRegion: undefined }));
                        setF((prev) => withAccount(prev, a));
                      }}
                    />
                  )}
                  {isEdit ? (
                    <TextField size="small" label={<LabelWithLock label="Opportunity Name" lock />} value={f.title} slotProps={{ input: { readOnly: true } }} />
                  ) : (
                    <SelectField
                      label="Opportunity Name"
                      required
                      value={f.opportunityId}
                      placeholder={f.accountId ? (opportunities.isFetching ? "Loading opportunities…" : "Select Opportunity") : "Select the account first"}
                      options={(opportunities.data ?? []).map((o) => [o.id, o.name] as const)}
                      disabled={!f.accountId}
                      error={errors.opportunityId ?? (opportunities.isError ? "Couldn't load the account's opportunities." : undefined)}
                      onChange={pickOpportunity}
                    />
                  )}
                  {t !== 3 ? (
                    isEdit ? (
                      <TextField size="small" label={<LabelWithLock label="Opportunity Line Item" lock />} value={e!.product ?? ""} slotProps={{ input: { readOnly: true } }} />
                    ) : (
                      <Box>
                        <SelectField
                          label="Opportunity Line Item"
                          required={paid}
                          value={f.lineItemId}
                          placeholder="Select Opportunity Line Item"
                          options={(opportunity?.lineItems ?? []).map((l) => [l.id, l.product] as const)}
                          disabled={!opportunity}
                          error={errors.lineItemId}
                          onChange={pickLineItem}
                        />
                        {t === 4 ? <Hint>Optional for Non-Paid Post Sale</Hint> : null}
                      </Box>
                    )
                  ) : null}
                  {t !== 3 ? <span /> : null}
                  {paid ? <Full>{area("description", "Description", 2, { readOnly: true, lock: true })}</Full> : null}
                </>
              ) : (
                <>
                  {mkt ? (
                    <>
                      <TextField
                        fullWidth
                        size="small"
                        required
                        label={<LabelWithLock label="Event Name" lock={isEdit} title="Cannot be changed after creation" />}
                        value={f.title}
                        onChange={(ev) => set("title", ev.target.value)}
                        slotProps={{ input: { readOnly: isEdit }, htmlInput: { maxLength: 100 } }}
                        error={Boolean(errors.title)}
                        helperText={errors.title}
                      />
                      <CampaignField
                        value={f.campaignId ? { id: f.campaignId, name: f.campaignName || f.campaignId } : null}
                        disabled={campaignLocked}
                        required={!isEdit}
                        error={errors.campaignId}
                        onPick={(c) => {
                          setF((prev) => ({ ...prev, campaignId: c?.id ?? "", campaignName: c?.name ?? "" }));
                          setErrors((prev) => ({ ...prev, campaignId: undefined }));
                        }}
                      />
                    </>
                  ) : (
                    <Full>
                      <TextField
                        fullWidth
                        size="small"
                        required
                        label={<LabelWithLock label="Name / Purpose" lock={lockAfterApproval} title="Cannot be changed after approval" />}
                        value={f.title}
                        onChange={(ev) => set("title", ev.target.value)}
                        slotProps={{ input: { readOnly: lockAfterApproval }, htmlInput: { maxLength: 100 } }}
                        error={Boolean(errors.title)}
                        helperText={errors.title}
                      />
                    </Full>
                  )}
                  <Full>{area("description", "Description", 2)}</Full>
                </>
              )}
              <SelectField
                label={mkt ? "Event Type" : "Allocation Type"}
                required
                value={f.allocationType}
                options={(typeDef?.allocationTypes ?? []).map((a) => a.name)}
                disabled={isEdit && !pendingEdit}
                lock={isEdit && !pendingEdit}
                lockTitle="Cannot be changed after creation"
                error={errors.allocationType}
                onChange={(v) => set("allocationType", v)}
              />
              <TextField size="small" label="Engagement Code" value={code} slotProps={{ input: { readOnly: true, sx: { fontFamily: "monospace" } } }} />
              <SelectField
                label={mkt ? "Event Nature" : cust ? "Engagement On-site/Off-site" : "On-site/Off-site"}
                required
                placeholder={mkt ? "Select Event Nature" : "Select On-site or Off-site"}
                value={f.nature}
                options={mkt ? EVENT_NATURES : NATURES}
                error={errors.nature}
                onChange={(v) => set("nature", v)}
              />
              <SelectField
                searchable
                label="Country"
                required
                value={f.country}
                options={ref.data?.countries ?? []}
                disabled={isEdit && !pendingEdit}
                lock={isEdit && !pendingEdit}
                lockTitle="Cannot be changed after creation"
                error={errors.country}
                onChange={(v) => set("country", v)}
              />
              <Full>{area("address", "Location Address", 3, { required: true, max: 300 })}</Full>
              {!mkt ? (
                <>
                  <SelectField
                    label="Business Unit"
                    required={t === 1 || fundingRequired}
                    value={f.businessUnit}
                    options={ref.data?.businessUnits ?? []}
                    disabled={cust && paid && !isEdit}
                    lock={cust && paid && !isEdit}
                    error={errors.businessUnit}
                    onChange={(v) => setF((prev) => ({ ...prev, businessUnit: v, productUnit: "" }))}
                  />
                  <SelectField
                    label="Product Unit"
                    required={fundingRequired}
                    value={f.productUnit}
                    error={errors.productUnit}
                    options={productUnits(cust ? "customer" : "internal")}
                    disabled={cust && paid && !isEdit}
                    lock={cust && paid && !isEdit}
                    onChange={(v) => set("productUnit", v)}
                  />
                  <SelectField
                    searchable
                    label="Sales Sub Region"
                    required={subRegionRequired}
                    value={f.subRegion}
                    error={errors.subRegion}
                    options={ref.data?.subRegions ?? []}
                    disabled={sublocked}
                    lock={sublocked}
                    onChange={(v) => set("subRegion", v)}
                  />
                  <span />
                </>
              ) : (
                <Full>
                  <FundingSourcesField rows={f.funding} onChange={(rows) => set("funding", rows)} reference={ref.data} error={errors.funding} />
                </Full>
              )}
              <TextField
                size="small"
                type="date"
                required
                label={<LabelWithLock label="Start Date" lock={paid} />}
                value={f.start}
                onChange={(ev) => set("start", ev.target.value)}
                slotProps={{ inputLabel: { shrink: true }, input: { readOnly: paid } }}
                error={Boolean(errors.start)}
                helperText={errors.start}
              />
              <TextField
                size="small"
                type="date"
                required
                label={<LabelWithLock label="End Date" lock={paid} />}
                value={f.end}
                onChange={(ev) => set("end", ev.target.value)}
                slotProps={{ inputLabel: { shrink: true }, input: { readOnly: paid } }}
                error={Boolean(errors.end)}
                helperText={errors.end}
              />
              {cust && !isEdit ? (
                <Full>
                  <FormControlLabel
                    control={<Checkbox size="small" checked={paid ? Boolean(lineItem?.tentativeDates) : f.tentative} disabled={paid} onChange={(ev) => set("tentative", ev.target.checked)} />}
                    label="Tentative Dates"
                  />
                </Full>
              ) : null}
              {isEdit && paid ? (
                <Full>
                  <Button variant="outlined" size="small" onClick={fetchNewDates} disabled={update.isPending}>
                    {update.isPending && update.variables?.fields?.refreshDatesFromSalesforce ? "Fetching New Dates…" : "Fetch New Dates"}
                  </Button>
                  <Hint>Refreshes the dates from the Salesforce line item.</Hint>
                </Full>
              ) : null}
              {cust ? (
                <>
                  <Full>{area("contact", "Customer Contact – Name / Contact Number", 2, { required: true })}</Full>
                  {!paid ? (
                    <>
                      <TextField
                        size="small"
                        label={<LabelWithLock label="Business Domain" lock={isEdit} />}
                        value={f.domain}
                        onChange={(ev) => set("domain", ev.target.value)}
                        slotProps={{ input: { readOnly: isEdit } }}
                      />
                      <span />
                    </>
                  ) : null}
                  <TextField
                    size="small"
                    label={<LabelWithLock label="Opportunity Owner" lock />}
                    value={opportunity?.owner ?? e?.opportunityOwner ?? ""}
                    slotProps={{ input: { readOnly: true } }}
                  />
                  <TextField
                    size="small"
                    label={<LabelWithLock label="Technical Owner" lock />}
                    value={opportunity?.technicalOwner ?? e?.technicalOwner ?? ""}
                    slotProps={{ input: { readOnly: true } }}
                  />
                  <Full>
                    <FormControlLabel
                      control={<Checkbox size="small" disabled checked={Boolean(opportunity?.won ?? e?.contractsSigned)} />}
                      label={
                        <>
                          Contracts Signed{" "}
                          <Typography component="span" variant="caption" color="text.secondary">
                            (from Salesforce)
                          </Typography>
                        </>
                      }
                    />
                  </Full>
                </>
              ) : null}
              <Full>{area("scope", "Engagement Scope", 6, { hint: "Type the scope here. If there are references please include G-Drive links." })}</Full>
              <Full>{area("comment", "Comments", 2, { hint: "Any additional information" })}</Full>
            </>
          ) : null}
        </Grid>
        {failure ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {typeof failure === "string" ? failure : describeError(eaError(failure))}
          </Alert>
        ) : null}
        {Object.values(errors).some(Boolean) ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Some fields need attention.
          </Alert>
        ) : null}
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, borderTop: 1, borderColor: "divider", pt: 2, mt: 3 }}>
          <Button onClick={() => guard.leave(back.to)} disabled={create.isPending || update.isPending}>
            {isEdit ? "Discard Changes" : "Cancel"}
          </Button>
          {isEdit && pendingEdit && e && canApprove(access.p, e.typeId) ? (
            <Button variant="outlined" startIcon={<CheckIcon size={15} />} onClick={() => askUpdate(true)}>
              Confirm and Approve
            </Button>
          ) : null}
          {isEdit ? (
            <Button variant="contained" disabled={!changed || update.isPending} onClick={() => askUpdate(false)}>
              Save
            </Button>
          ) : (
            <Button variant="contained" disabled={!t || create.isPending} onClick={submit}>
              {create.isPending ? "Saving…" : "Save"}
            </Button>
          )}
        </Box>
      </Card>
      {guard.prompt}
      {confirm && e ? (
        <EaDialog
          title={confirm === "approve" ? (mkt ? "Approve Event" : "Approve Engagement") : mkt ? "Update Event" : "Update Engagement"}
          confirmLabel={confirm === "approve" ? "Approve" : mkt ? "Update Event" : "Update Engagement"}
          busyLabel={confirm === "approve" ? "Approving…" : "Updating…"}
          busy={update.isPending}
          error={failure}
          onClose={() => setConfirm(null)}
          onConfirm={() =>
            update.mutate(
              { id: e.id, fields: changes, approve: confirm === "approve" || undefined },
              {
                onSuccess: () => {
                  notify.showSuccess(`${mkt ? "Event" : "Engagement"} ${confirm === "approve" ? "approved" : "updated"} successfully`);
                  navigate(pendingEdit ? engagementPaths.approvals(mkt ? "marketing" : "internal") : engagementPaths.engagement(e.id), { replace: true });
                },
                onError: setFailure,
              },
            )
          }
        >
          {confirm === "approve"
            ? "Are you sure you want to confirm and approve? Once approved, this action cannot be undone."
            : mkt
              ? "Are you sure you want to update this event?"
              : "Are you sure you want to update this engagement?"}
        </EaDialog>
      ) : null}
    </EaPage>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2.25, alignItems: "start" }}>{children}</Box>;
}

/** The form while its engagement loads: the fields every kind has, each a real label over a bar the size of its input. */
function FormSkeleton(): JSX.Element {
  const field = (label: string, height = 40) => (
    <Box key={label}>
      <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 0.5 }}>{label}</Typography>
      <Skeleton variant="rounded" height={height} />
    </Box>
  );
  return (
    <Card variant="outlined" sx={{ p: { xs: 2, sm: 3 }, maxWidth: 960 }} aria-busy="true">
      <Grid>
        {["Engagement ID", "Allocation Type", "Engagement Code", "Country", "Start Date", "End Date"].map((label) => field(label))}
        <Full>{field("Location Address", 88)}</Full>
        <Full>{field("Engagement Scope", 157)}</Full>
        <Full>{field("Comments", 65)}</Full>
      </Grid>
    </Card>
  );
}

function Full({ children }: { children: ReactNode }) {
  return <Box sx={{ gridColumn: "1 / -1" }}>{children}</Box>;
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5, ml: 1.75 }}>
      {children}
    </Typography>
  );
}
