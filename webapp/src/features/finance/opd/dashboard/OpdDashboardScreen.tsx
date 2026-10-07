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
import { Alert, Box, Skeleton, Stack } from "@wso2/oxygen-ui";
import { isOpdBackendConfigured } from "@config/apiConfig";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { FINANCE_EYEBROW } from "@constants/financeApps";
import FinanceShell from "../../components/FinanceShell";
import { money } from "../../util/financeFormat";
import { useOpdUserInfo } from "../useOpd";
import { OPD_ROLE, opdHasRole } from "../opdTypes";
import { useOpdDashboardSummary } from "./useOpdDashboard";
import { OpdStatCard, OpdSubmittersTable } from "./OpdDashboardParts";
import { DashboardPanel } from "../../components/DashboardPanel";
import { OpdUtilizationTable } from "./OpdUtilizationTable";
import { claimLimitOf } from "./opdDashboardTypes";

export default function OpdDashboardScreen({ headerActions }: { headerActions?: ReactNode } = {}) {
  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.opd}
      title="OPD analytics"
      subtitle="How much of the OPD allowance the company has used this year, and who has claimed."
      configured={isOpdBackendConfigured()}
      configKey="ONE_WSO2_OPD_BACKEND_URL"
      actions={headerActions}
    >
      <DashboardBody />
    </FinanceShell>
  );
}

function DashboardBody() {
  const userInfo = useOpdUserInfo();
  const summary = useOpdDashboardSummary();

  if (userInfo.isLoading || summary.isLoading) {
    return (
      <Stack spacing={2}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={80} />
        ))}
      </Stack>
    );
  }

  // `routes.tsx:20-24` puts this screen behind View.FINANCE — it is every
  // employee's spend, not your own, so the approver role is what opens it.
  //
  // `!isLoading`, not `isSuccess`: `isSuccess` excludes a query that is
  // `enabled: false` and will never fetch (no OPD backend configured in this
  // environment) — that query sits at `isPending: true` forever with
  // `isSuccess` permanently false, so gating on it fell through this refusal
  // entirely and landed on `if (!data) return null` below: a blank page,
  // forever, with nothing saying why. `!isLoading` reads true for that case,
  // same as a real "no role" answer — the refusal fires, matching what this
  // screen showed before `isSuccess` was tried here.
  //
  // It does not reopen the window that made `isSuccess` look necessary.
  // `foldIdentityError` (useAsgardeoSub.ts) synthesizes `isLoading: true` for
  // the ENTIRE identity-resolving window on every fresh mount — switching the
  // Overview dropdown to OPD Claims mounts this whole body new — and once
  // identity is ready, this installed React Query (5.90.20, checked directly:
  // a query's `isFetching` is already true on the SAME render its `enabled`
  // flips true, no render in between where it reads false) means there is no
  // gap where `isLoading` reads false while an answer might still arrive.
  //
  // `isError` was already excluded by `isSuccess` for free (React Query's
  // states are mutually exclusive); `!isLoading` does not carry that for
  // free, since an errored query is also `isLoading: false`. Without this
  // line, a failed lookup would read as "no role" and refuse a finance
  // approver for a request that merely failed, which the ErrorNotice branch
  // below exists specifically to avoid.
  if (!userInfo.isLoading && !userInfo.isError && !opdHasRole(userInfo.data, OPD_ROLE.FINANCE_APPROVER)) {
    return (
      <Alert severity="info">
        OPD analytics is limited to the finance team who review these claims.
      </Alert>
    );
  }

  if (userInfo.isError || summary.isError) {
    return (
      <ErrorNotice
        error={userInfo.error ?? summary.error}
        onRetry={() => {
          if (userInfo.isError) void userInfo.refetch();
          if (summary.isError) void summary.refetch();
        }}
        retrying={userInfo.isFetching || summary.isFetching}
      >
        Couldn&apos;t load the OPD analytics.
      </ErrorNotice>
    );
  }

  const data = summary.data;
  if (!data) return null;

  const limit = claimLimitOf(data.utilization);

  return (
    <Box>
      {/* Four across on a wide screen, two on a tablet, stacked on a phone —
          `Dashboard.tsx:52`. */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
          gap: 2,
        }}
      >
        <OpdStatCard title="Claims processed" value={data.claimsProcessed.toLocaleString("en-US")} />
        <OpdStatCard title="Claims pending" value={data.claimsPending.toLocaleString("en-US")} />
        <OpdStatCard title="Value processed" value={money(data.valueProcessed)} />
        <OpdStatCard title="Value pending" value={money(data.valuePending)} />
      </Box>

      <DashboardPanel title="Employees who submitted OPD claims">
        <OpdSubmittersTable
          submittedThisYear={data.employeesSubmittedThisYear}
          submittedLastYear={data.employeesSubmittedLastYear}
          fullyUtilisedThisYear={data.employeesFullyUtilizedThisYear}
          fullyUtilisedLastYear={data.employeesFullyUtilizedLastYear}
        />
      </DashboardPanel>

      <DashboardPanel
        title="Claim limit utilization"
        // Read off the first row, as the source does: the limit is the same for
        // everyone, and with no rows there is no limit to quote.
        aside={limit === null ? undefined : `(Limit: ${money(limit)} per employee)`}
      >
        <OpdUtilizationTable rows={data.utilization} />
      </DashboardPanel>
    </Box>
  );
}
