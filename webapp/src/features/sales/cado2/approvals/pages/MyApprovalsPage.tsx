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

import type { JSX } from "react";
import { Link as RouterLink } from "react-router";
import { Avatar, Box, Chip, CircularProgress, Paper, Stack, Typography } from "@wso2/oxygen-ui";
import { ShieldCheckIcon } from "@wso2/oxygen-ui-icons-react";
import PageHeader from "@features/sales/cado2/components/page-header/PageHeader";
import EmptyState from "@features/sales/cado2/components/empty-state/EmptyState";
import SlaChip from "@features/sales/cado2/approvals/components/SlaChip";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useApprovalInbox } from "@features/sales/cado2/approvals/api/useApprovalApi";
import type { ApprovalInboxItem } from "@features/sales/cado2/approvals/api/approvalTypes";
import { changedAgo } from "@features/sales/cado2/quotes/list/quoteListModel";
import { useCado2Me } from "@features/sales/cado2/api/useCado2Me";
import { cado2Paths } from "@features/sales/cado2/cado2Paths";
import { useDocumentTitle } from "@hooks/useDocumentTitle";
import { initialsOfName } from "@features/sales/cado2/utils/initials";
import { formatMoney } from "@features/sales/cado2/utils/money";
import { roleLabel } from "@features/sales/cado2/approvals/model/approvalText";

/**
 * My Approvals: the steps whose turn it is, for every approval role the
 * caller holds. Any member of the role's group may act; quotes the caller
 * submitted are left out, because they can't approve their own.
 */
export default function MyApprovalsPage(): JSX.Element {
  const inbox = useApprovalInbox();
  const { data: user } = useCado2Me();
  useDocumentTitle("My Approvals");
  const now = new Date();
  const roles = (user?.approverRoles ?? []).map(roleLabel);

  return (
    <Stack spacing={3} sx={{ maxWidth: 1400 }}>
      <PageHeader
        title="My Approvals"
        chips={roles.map((r) => (
          <Chip key={r} size="small" variant="outlined" label={r} />
        ))}
      />
      {inbox.isPending ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress aria-label="Loading your approvals" />
        </Box>
      ) : inbox.error ? (
        <ErrorNotice error={inbox.error} onRetry={() => void inbox.refetch()} retrying={inbox.isFetching}>
          Couldn&apos;t load your approvals.
        </ErrorNotice>
      ) : inbox.data.length === 0 ? (
        <EmptyState
          icon={<ShieldCheckIcon size={26} />}
          title="Nothing is waiting for you"
          body="Quotes appear here when it is your role's turn to approve them."
        />
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
          <Box component="ul" aria-label="Waiting for your approval" sx={{ m: 0, p: 0, listStyle: "none" }}>
            {inbox.data.map((item) => (
              <Box component="li" key={item.stepId}>
                <InboxRow item={item} now={now} />
              </Box>
            ))}
          </Box>
        </Paper>
      )}
    </Stack>
  );
}

/** "Waiting 5 min", "Waiting just now", or "Since 3 Oct 2026". */
function waitingFor(iso: string, now: Date): string {
  const ago = changedAgo(iso, now);
  if (ago === "just now") return "Waiting since just now";
  return ago.endsWith(" ago") ? `Waiting ${ago.slice(0, -4)}` : `Since ${ago}`;
}

function InboxRow({ item, now }: { item: ApprovalInboxItem; now: Date }): JSX.Element {
  return (
    <Box
      component={RouterLink}
      to={cado2Paths.quote(item.quoteId, "quote", true)}
      // The quote page's back link returns here.
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "44px minmax(0,1fr)", md: "44px minmax(0,2fr) minmax(0,1.4fr) 160px 150px" },
        gap: { xs: 1.5, md: 2 },
        alignItems: "center",
        px: { xs: 2, sm: 2.5 },
        py: 1.75,
        color: "inherit",
        textDecoration: "none",
        borderTop: 1,
        borderColor: "divider",
        "&:first-of-type": { borderTop: 0 },
        "&:hover": { bgcolor: "action.hover" },
        "&:focus-visible": { outline: 2, outlineStyle: "solid", outlineColor: "primary.main", outlineOffset: -2 },
      }}
    >
      <Avatar sx={{ width: 40, height: 40, bgcolor: "primary.main", color: "primary.contrastText", fontSize: 15, fontWeight: 600 }}>
        {initialsOfName(item.accountName ?? "?")}
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
          {item.accountName ?? "No account"}
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          {item.opportunityName ?? "No opportunity"}
          {item.submittedByEmail ? ` · from ${item.submittedByEmail}` : ""}
        </Typography>
      </Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ gridColumn: { xs: "2", md: "auto" }, flexWrap: "wrap", rowGap: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: "monospace" }}>
          {item.quoteNumber}
        </Typography>
        <Chip size="small" color="primary" label={`As ${item.roleLabel}`} />
        <Typography variant="caption" color="text.secondary">
          v{item.versionNumber}
        </Typography>
      </Stack>
      <Typography
        variant="subtitle2"
        sx={{ gridColumn: { xs: "2", md: "auto" }, textAlign: { md: "right" }, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
      >
        {item.currencyIsoCode ? `${item.currencyIsoCode} ${formatMoney(item.tcv)}` : formatMoney(item.tcv)}
      </Typography>
      <Stack spacing={0.5} alignItems={{ xs: "flex-start", md: "flex-end" }} sx={{ gridColumn: { xs: "2", md: "auto" } }}>
        {/* The deadline, most urgent rows first. */}
        {item.slaState && item.dueAt ? <SlaChip state={item.slaState} dueAt={item.dueAt} now={now} /> : null}
        <Typography variant="caption" color="text.secondary">
          {item.requestedAt ? waitingFor(item.requestedAt, now) : ""}
        </Typography>
      </Stack>
    </Box>
  );
}
