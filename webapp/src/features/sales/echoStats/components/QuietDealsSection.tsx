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

import { Typography } from "@wso2/oxygen-ui";
import { formatDateTime } from "../../util/salesTime";
import type { QuietByOwner, QuietByRegion, QuietDeal, QuietDealsStats } from "../types";
import { formatCount, formatShare, regionLabel } from "../util/statsFormat";
import { DealLink, StatTiles, StatsPair, StatsSection, StatsTable, type StatsColumn } from "./StatsParts";

const DEAL_COLUMNS: readonly StatsColumn<QuietDeal>[] = [
  { key: "name", label: "Opportunity", render: (d) => <DealLink opportunityId={d.opportunityId} name={d.name} /> },
  { key: "owner", label: "Owner", render: (d) => d.ownerEmail ?? "—" },
  { key: "region", label: "Region", render: (d) => regionLabel(d.region) },
  { key: "stage", label: "Stage", render: (d) => d.stage },
  // Never, rather than a dash: no customer email was ever logged, which is the point of the list.
  { key: "lastEmailAt", label: "Last email", render: (d) => (d.lastEmailAt ? formatDateTime(d.lastEmailAt) : "Never") },
  { key: "lastActivityAt", label: "Last activity", render: (d) => formatDateTime(d.lastActivityAt) },
  { key: "lastCallAt", label: "Last call", render: (d) => formatDateTime(d.lastCallAt) },
];

const OWNER_COLUMNS: readonly StatsColumn<QuietByOwner>[] = [
  { key: "ownerEmail", label: "Owner", render: (o) => o.ownerEmail },
  { key: "region", label: "Region", render: (o) => regionLabel(o.region) },
  { key: "openDeals", label: "Open", numeric: true, render: (o) => formatCount(o.openDeals) },
  { key: "quiet", label: "Quiet", numeric: true, render: (o) => formatCount(o.quiet) },
];

const REGION_COLUMNS: readonly StatsColumn<QuietByRegion>[] = [
  { key: "region", label: "Region", render: (r) => r.region },
  { key: "openDeals", label: "Open", numeric: true, render: (r) => formatCount(r.openDeals) },
  { key: "quiet", label: "Quiet", numeric: true, render: (r) => formatCount(r.quiet) },
];

/** Open opportunities with no customer email logged in Salesforce in range: deals going quiet. */
export default function QuietDealsSection({ quietDeals, days }: { quietDeals: QuietDealsStats; days: number }) {
  // The list is capped; say so when it holds fewer than the count above it.
  const capped = quietDeals.deals.length < quietDeals.quiet;
  return (
    <StatsSection
      title="Quiet deals"
      subtitle={`Open opportunities with no customer email logged in Salesforce in the last ${days} days, as of ${formatDateTime(quietDeals.asOf)}. Never emailed first, then the longest since the last email.`}
    >
      <StatTiles
        tiles={[
          { label: "Open opportunities", value: formatCount(quietDeals.openDeals) },
          { label: "Quiet", value: formatCount(quietDeals.quiet), hint: `no email in ${days} days` },
          { label: "Share quiet", value: formatShare(quietDeals.quiet, quietDeals.openDeals) },
        ]}
      />
      <StatsTable
        title="Quiet opportunities"
        columns={DEAL_COLUMNS}
        rows={quietDeals.deals}
        rowKey={(d) => d.opportunityId}
        empty={`Every open opportunity has a customer email in the last ${days} days.`}
      />
      {capped && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: -1.5 }}>
          Showing the first {formatCount(quietDeals.deals.length)} of {formatCount(quietDeals.quiet)}.
        </Typography>
      )}
      <StatsPair>
        <StatsTable
          title="By owner"
          columns={OWNER_COLUMNS}
          rows={quietDeals.byOwner}
          rowKey={(o) => o.ownerEmail}
          empty="No open opportunities on the list."
        />
        <StatsTable
          title="By region"
          columns={REGION_COLUMNS}
          rows={quietDeals.byRegion}
          rowKey={(r) => r.region}
          empty="No open opportunities on the list."
        />
      </StatsPair>
    </StatsSection>
  );
}
