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

import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router";
import { Box, Chip, Link, Paper, Skeleton, Typography } from "@wso2/oxygen-ui";
import type { Meeting } from "../../api/salesTypes";
import { parseOpportunityDetails } from "../../api/salesTypes";
import { dealPath } from "../../util/salesPaths";
import { formatAmount, formatSalesforceDate } from "../../meddpicc/util/meddpiccFormat";
import type { MeetingCallContext } from "../api/useCallContext";

/**
 * The call's opportunity and account, live from Salesforce through the Echo backend.
 *
 * When the live details are unavailable (the Echo backend is not configured, the request
 * failed, or Salesforce no longer has the record) each card falls back to what the call
 * recorded when it was linked, and says so: "as linked" is a snapshot that is never
 * refreshed, and should not be mistaken for the deal as it stands.
 */
export default function CallContextCards({ meeting, context }: { meeting: Meeting; context: MeetingCallContext }) {
  const snapshot = parseOpportunityDetails(meeting.opportunityDetails);
  const { opportunity, account } = context;
  const accountName =
    meeting.accountName?.trim() || snapshot?.customerName?.trim() || opportunity.live?.accountName?.trim() || null;
  const showAccount = account.id !== null || accountName !== null;

  return (
    <Box
      sx={{
        display: "grid",
        // Side by side when the pane is wide enough for both, stacked when it is not.
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 1.5,
      }}
    >
      {opportunity.id !== null && (
        <ContextCard
          title="Opportunity"
          loading={opportunity.status === "loading"}
          asLinked={opportunity.live === null}
        >
          {opportunity.live ? (
            <>
              <Field label="Name" wide>
                <Link component={RouterLink} to={dealPath(opportunity.id)} underline="hover">
                  {opportunity.live.name}
                </Link>
              </Field>
              <Field label="Owner (AM)">
                <Person name={opportunity.live.ownerName} email={opportunity.live.ownerEmail} />
              </Field>
              <Field label="Region">{opportunity.live.salesRegion}</Field>
              <Field label="Stage">{opportunity.live.stage}</Field>
              <Field label="Amount">{formatAmount(opportunity.live.amount, opportunity.live.currency)}</Field>
              <Field label="Close date">{formatSalesforceDate(opportunity.live.closeDate)}</Field>
            </>
          ) : (
            // The snapshot has no name, owner or region: only what the add-on copied.
            <>
              <Field label="Name" wide>
                <Link component={RouterLink} to={dealPath(opportunity.id)} underline="hover">
                  Open deal
                </Link>
              </Field>
              <Field label="Stage">{snapshot?.stage}</Field>
              <Field label="Amount">{formatAmount(snapshot?.amount ?? null, snapshot?.currency ?? null)}</Field>
              <Field label="Close date">{formatSalesforceDate(snapshot?.closeDate ?? null)}</Field>
            </>
          )}
        </ContextCard>
      )}

      {showAccount && (
        <ContextCard title="Account" loading={account.status === "loading"} asLinked={account.live === null}>
          {account.live ? (
            <>
              <Field label="Name" wide>
                {account.live.name}
              </Field>
              <Field label="Region">{regionLabel(account.live.salesRegion, account.live.region)}</Field>
              <Field label="Account owner">
                <Person name={account.live.ownerName} email={account.live.ownerEmail} />
              </Field>
              <Field label="Technical owner">
                <Person name={account.live.technicalOwnerName} email={account.live.technicalOwnerEmail} />
              </Field>
            </>
          ) : (
            <Field label="Name" wide>
              {accountName}
            </Field>
          )}
        </ContextCard>
      )}
    </Box>
  );
}

/**
 * The account's Sales Region, the same vocabulary the list's Region column and filter use;
 * its broader Region where Salesforce has no Sales Region.
 */
function regionLabel(salesRegion: string | null, region: string | null): string | null {
  return salesRegion?.trim() || region?.trim() || null;
}

function ContextCard({
  title,
  loading,
  asLinked,
  children,
}: {
  title: string;
  loading: boolean;
  asLinked: boolean;
  children: ReactNode;
}) {
  return (
    <Paper variant="outlined" component="section" aria-label={title} sx={{ p: 1.5, minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.25 }}>
        <Typography variant="subtitle2">{title}</Typography>
        {!loading && asLinked && (
          <Chip
            label="as linked"
            size="small"
            variant="outlined"
            title="Live Salesforce details are unavailable: this is what the call recorded when it was linked."
            sx={{ height: 20, fontSize: "0.65rem" }}
          />
        )}
      </Box>
      {loading ? (
        <Box aria-busy="true">
          <Skeleton variant="text" width="70%" />
          <Skeleton variant="text" width="50%" />
          <Skeleton variant="text" width="60%" />
        </Box>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", columnGap: 2, rowGap: 1.25 }}>
          {children}
        </Box>
      )}
    </Paper>
  );
}

/** One labelled value; an em dash when there is none, so the grid stays aligned. */
function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  const empty = children === null || children === undefined || (typeof children === "string" && !children.trim());
  return (
    <Box sx={{ minWidth: 0, gridColumn: wide ? "1 / -1" : undefined }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2" component="div" sx={{ overflowWrap: "anywhere" }}>
        {empty ? "—" : children}
      </Typography>
    </Box>
  );
}

/** A person by name with their email beneath it; whichever of the two Salesforce has. */
function Person({ name, email }: { name: string | null; email: string | null }) {
  const shownName = name?.trim() || email?.trim();
  if (!shownName) return <>—</>;
  const shownEmail = email?.trim() && email.trim() !== shownName ? email.trim() : null;
  return (
    <>
      {shownName}
      {shownEmail && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ overflowWrap: "anywhere" }}>
          {shownEmail}
        </Typography>
      )}
    </>
  );
}
