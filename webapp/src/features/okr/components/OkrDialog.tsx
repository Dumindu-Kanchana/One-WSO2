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

import { useDeferredValue, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { PlusIcon, Trash2Icon } from "@wso2/oxygen-ui-icons-react";
import { HttpError } from "@api/http";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import LeaveDateField from "@features/leave/components/LeaveDateField";
import {
  OKR_KEY_RESULT_MAX_LENGTH,
  OKR_MEASURE_MAX_LENGTH,
  OKR_OBJECTIVE_MAX_LENGTH,
  type KeyResultEntry,
  type Okr,
  type OkrPerson,
} from "../api/okrTypes";
import { useCreateOkr, useOkrTeam, useUpdateOkr } from "../api/useOkrs";
import { useOkrOwnerSearch, type OkrOwnerOption } from "../api/useOkrOwnerSearch";

/** A key result being entered. No owner means the objective owner's. */
interface KeyResultDraft {
  key: number;
  keyResultId?: number;
  title: string;
  owner: OkrPerson | null;
  baseline: string;
  target: string;
  dueDate: string;
}

// Keys for the key result rows, so removing one doesn't shift another's fields.
let lastDraftKey = 0;
const draftKey = () => ++lastDraftKey;

const isBlank = (k: KeyResultDraft) =>
  k.keyResultId === undefined && !k.title.trim() && !k.owner && !k.baseline.trim() && !k.target.trim() && !k.dueDate;

// Set an objective, or change one: the objective and its key results, as many
// as it needs, each given to the owner or someone in their team, with an
// optional baseline and target and its own due date. The objective has no due
// date of its own. On Manage OKRs a lead
// picks whose it is from their team, a People Ops admin from everyone; on My
// OKRs it's yours. Whose it is can't be changed once it's set.
export default function OkrDialog({
  open,
  onClose,
  okr,
  owner: presetOwner,
  canPickAnyone = false,
}: {
  open: boolean;
  onClose: () => void;
  /** The objective to change; leave out to set a new one. */
  okr?: Okr;
  /** Pre-picks whose a new one is. */
  owner?: { workEmail: string; name?: string };
  /** People Ops admins can set one for anyone, not only their team. */
  canPickAnyone?: boolean;
}) {
  const editing = Boolean(okr);
  const [searchText, setSearchText] = useState("");
  const pickOwner = !editing && !presetOwner;
  const people = useOkrOwnerSearch(useDeferredValue(searchText), canPickAnyone, open && pickOwner);
  const create = useCreateOkr();
  const update = useUpdateOkr();
  const { showSuccess, showError } = useNotifications();

  const [owner, setOwner] = useState<OkrOwnerOption | null>(
    presetOwner
      ? { workEmail: presetOwner.workEmail, name: presetOwner.name ?? presetOwner.workEmail, jobRole: null, thumbnail: null }
      : null,
  );
  const [objective, setObjective] = useState(okr?.objective ?? "");
  const [keyResults, setKeyResults] = useState<KeyResultDraft[]>(() =>
    okr?.keyResults.length
      ? okr.keyResults.map((k) => ({
          key: draftKey(),
          keyResultId: k.keyResultId,
          title: k.title,
          owner: { workEmail: k.ownerEmail, name: k.ownerName ?? k.ownerEmail },
          baseline: k.baseline ?? "",
          target: k.target ?? "",
          dueDate: k.dueDate,
        }))
      : [{ key: draftKey(), title: "", owner: null, baseline: "", target: "", dueDate: "" }],
  );
  const [tried, setTried] = useState(false);

  const ownerEmail = okr?.ownerEmail ?? owner?.workEmail;
  const ownerName = okr?.ownerName ?? owner?.name;
  // Keep the picked person in the list while another search's results show.
  const options = useMemo(() => {
    const found = people.data ?? [];
    return owner && !found.some((p) => p.workEmail === owner.workEmail) ? [owner, ...found] : found;
  }, [people.data, owner]);

  const entered = keyResults.filter((k) => !isBlank(k));
  const krTitleMissing = (k: KeyResultDraft) => !isBlank(k) && !k.title.trim();
  const krDueMissing = (k: KeyResultDraft) => !isBlank(k) && !/^\d{4}-\d{2}-\d{2}$/.test(k.dueDate);
  const valid =
    Boolean(ownerEmail) &&
    objective.trim().length > 0 &&
    !entered.some((k) => krTitleMissing(k) || krDueMissing(k));
  const saving = create.isPending || update.isPending;
  const error = create.error ?? update.error;

  const setKeyResult = (key: number, change: Partial<KeyResultDraft>) =>
    setKeyResults((prev) => prev.map((k) => (k.key === key ? { ...k, ...change } : k)));

  const submit = async () => {
    setTried(true);
    if (!valid || !ownerEmail) return;
    const entries: KeyResultEntry[] = entered.map((k) => ({
      ...(k.keyResultId !== undefined ? { keyResultId: k.keyResultId } : {}),
      title: k.title.trim(),
      ...(k.owner ? { ownerEmail: k.owner.workEmail } : {}),
      baseline: k.baseline.trim(),
      target: k.target.trim(),
      dueDate: k.dueDate,
    }));
    try {
      if (okr) {
        await update.mutateAsync({
          okrId: okr.okrId,
          update: { version: okr.version, objective: objective.trim(), keyResults: entries },
        });
        showSuccess("OKR updated.");
      } else {
        await create.mutateAsync({
          ownerEmail: ownerEmail.trim().toLowerCase(),
          objective: objective.trim(),
          keyResults: entries,
        });
        showSuccess("OKR set.");
      }
      onClose();
    } catch (err) {
      // Someone changed it meanwhile: the page now shows their change, so
      // close rather than offer to save over it.
      if (err instanceof HttpError && err.status === 409) {
        showError(describeError(err));
        onClose();
      }
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>{editing ? "Edit OKR" : "Set an OKR"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.25} sx={{ pt: 1 }}>
          {pickOwner ? (
            <Autocomplete<OkrOwnerOption, false, false, false>
              size="small"
              options={options}
              value={owner}
              onChange={(_e, v) => setOwner(v)}
              inputValue={searchText}
              onInputChange={(_e, v) => setSearchText(v)}
              isOptionEqualToValue={(a, b) => a.workEmail === b.workEmail}
              loading={people.isFetching}
              loadingText="Searching…"
              noOptionsText={
                people.isError ? "Couldn't search for people" : canPickAnyone ? "No one matches" : "No one in your team matches"
              }
              // The server already matched what was typed, on name and email.
              filterOptions={(opts) => opts}
              getOptionLabel={(o) => o.name}
              renderOption={(props, option) => {
                const { key, ...liProps } = props as typeof props & { key: string };
                return (
                  <li key={key} {...liProps}>
                    <Box sx={{ display: "flex", alignItems: "center", height: 30, minWidth: 0 }}>
                      <Avatar
                        src={option.thumbnail || undefined}
                        slotProps={{ img: { referrerPolicy: "no-referrer" } }}
                        sx={{ width: 24, height: 24, mr: 1 }}
                      />
                      {option.name}
                      <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }} noWrap>
                        {option.jobRole ? `${option.jobRole} · ` : ""}
                        {option.workEmail}
                      </Typography>
                    </Box>
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Whose objective"
                  placeholder={canPickAnyone ? "Search people" : "Search your team"}
                  error={tried && !ownerEmail}
                  helperText={
                    tried && !ownerEmail
                      ? "Pick whose objective it is."
                      : canPickAnyone
                        ? "Anyone in the company."
                        : "Anyone in your team, directly or further down."
                  }
                />
              )}
            />
          ) : (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Whose objective
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {ownerName ?? ownerEmail}
              </Typography>
            </Box>
          )}

          <TextField
            label="Objective"
            placeholder="What should be achieved?"
            fullWidth
            multiline
            minRows={2}
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            error={tried && !objective.trim()}
            helperText={tried && !objective.trim() ? "Write the objective." : undefined}
            slotProps={{ htmlInput: { maxLength: OKR_OBJECTIVE_MAX_LENGTH } }}
          />

          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.25 }}>
              Key results
            </Typography>
            <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1 }}>
              The results that will show the objective is achieved.
            </Typography>
            <Stack spacing={1.5}>
              {keyResults.map((k, i) => (
                <Box key={k.key} sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, p: 1.5 }}>
                  <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder={i === 0 ? "e.g. Maintain an NPS of 60+" : "Key result"}
                      value={k.title}
                      onChange={(e) => setKeyResult(k.key, { title: e.target.value })}
                      error={tried && krTitleMissing(k)}
                      helperText={tried && krTitleMissing(k) ? "Write the key result, or remove it." : undefined}
                      slotProps={{
                        htmlInput: { maxLength: OKR_KEY_RESULT_MAX_LENGTH, "aria-label": `Key result ${i + 1}` },
                      }}
                    />
                    <IconButton
                      size="small"
                      aria-label={`Remove key result ${i + 1}`}
                      disabled={keyResults.length === 1 && isBlank(k)}
                      onClick={() =>
                        setKeyResults((prev) =>
                          prev.length === 1
                            ? [{ key: draftKey(), title: "", owner: null, baseline: "", target: "", dueDate: "" }]
                            : prev.filter((x) => x.key !== k.key),
                        )
                      }
                      sx={{ mt: 0.5 }}
                    >
                      <Trash2Icon size={16} />
                    </IconButton>
                  </Box>
                  <Box sx={{ display: "flex", gap: 1, mt: 1.25, flexWrap: "wrap", alignItems: "flex-end", pr: 5 }}>
                    <Box sx={{ flex: "1 1 220px" }}>
                      <KeyResultOwnerField
                        objectiveOwnerEmail={ownerEmail}
                        objectiveOwnerName={ownerName}
                        value={k.owner}
                        onChange={(person) => setKeyResult(k.key, { owner: person })}
                        label={`Owner of key result ${i + 1}`}
                      />
                    </Box>
                    <TextField
                      size="small"
                      label="Baseline"
                      placeholder="e.g. 59"
                      value={k.baseline}
                      onChange={(e) => setKeyResult(k.key, { baseline: e.target.value })}
                      slotProps={{ htmlInput: { maxLength: OKR_MEASURE_MAX_LENGTH } }}
                      sx={{ width: 120 }}
                    />
                    <TextField
                      size="small"
                      label="Target"
                      placeholder="e.g. 60"
                      value={k.target}
                      onChange={(e) => setKeyResult(k.key, { target: e.target.value })}
                      slotProps={{ htmlInput: { maxLength: OKR_MEASURE_MAX_LENGTH } }}
                      sx={{ width: 120 }}
                    />
                    <Box sx={{ width: 180 }}>
                      <LeaveDateField
                        label="Due date"
                        value={k.dueDate}
                        onChange={(v) => setKeyResult(k.key, { dueDate: v })}
                        error={tried && krDueMissing(k)}
                        helperText={tried && krDueMissing(k) ? "Pick a due date." : undefined}
                      />
                    </Box>
                  </Box>
                </Box>
              ))}
            </Stack>
            <Button
              size="small"
              startIcon={<PlusIcon size={16} />}
              sx={{ mt: 1 }}
              onClick={() =>
                setKeyResults((prev) => [
                  ...prev,
                  { key: draftKey(), title: "", owner: null, baseline: "", target: "", dueDate: "" },
                ])
              }
            >
              Add a key result
            </Button>
          </Box>

          {error && !(error instanceof HttpError && error.status === 409) && (
            <Alert severity="error">{describeError(error)}</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void submit()} disabled={saving}>
          {saving ? "Saving…" : editing ? "Save" : "Set OKR"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Who a key result is for: the objective owner (left empty), or someone in
// their team, searched as you type.
function KeyResultOwnerField({
  objectiveOwnerEmail,
  objectiveOwnerName,
  value,
  onChange,
  label,
}: {
  objectiveOwnerEmail: string | undefined;
  objectiveOwnerName: string | undefined;
  value: OkrPerson | null;
  onChange: (person: OkrPerson | null) => void;
  label: string;
}) {
  const [search, setSearch] = useState("");
  const team = useOkrTeam(objectiveOwnerEmail, useDeferredValue(search));
  const options = useMemo(() => {
    const found = team.data ?? [];
    return value && !found.some((p) => p.workEmail === value.workEmail) ? [value, ...found] : found;
  }, [team.data, value]);

  return (
    <Autocomplete<OkrPerson, false, false, false>
      size="small"
      options={options}
      value={value}
      onChange={(_e, v) => onChange(v)}
      inputValue={search}
      onInputChange={(_e, v) => setSearch(v)}
      isOptionEqualToValue={(a, b) => a.workEmail === b.workEmail}
      disabled={!objectiveOwnerEmail}
      loading={team.isFetching}
      loadingText="Searching…"
      noOptionsText={team.isError ? "Couldn't search the team" : "No one in the team matches"}
      filterOptions={(opts) => opts}
      getOptionLabel={(o) => o.name}
      renderOption={(props, option) => {
        const { key, ...liProps } = props as typeof props & { key: string };
        return (
          <li key={key} {...liProps}>
            {option.name}
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }} noWrap>
              {option.jobRole ?? option.workEmail}
            </Typography>
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Owner"
          placeholder={objectiveOwnerName ? `${objectiveOwnerName} (objective owner)` : "Pick whose objective first"}
          inputProps={{ ...params.inputProps, "aria-label": label }}
          InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
        />
      )}
    />
  );
}
