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

import { Alert, Box, Typography } from "@wso2/oxygen-ui";
import { formatDateTime } from "../../util/salesTime";
import type { StatsRange, UsageByRegion, UsageStats, UsageUser } from "../types";
import { formatCount, regionLabel, usageTrackingNote } from "../util/statsFormat";
import ActiveUsersTrend from "./ActiveUsersTrend";
import { StatTiles, StatsPair, StatsSection, StatsSubheading, StatsTable, type StatsColumn } from "./StatsParts";

const USER_COLUMNS: readonly StatsColumn<UsageUser>[] = [
  { key: "email", label: "User", render: (u) => u.email },
  { key: "region", label: "Region", render: (u) => regionLabel(u.region) },
  { key: "lastSeen", label: "Last seen", render: (u) => formatDateTime(u.lastSeen) },
  { key: "events", label: "Events", numeric: true, render: (u) => formatCount(u.events) },
  { key: "dealViews", label: "Opportunity views", numeric: true, render: (u) => formatCount(u.dealViews) },
  { key: "approvals", label: "Approvals", numeric: true, render: (u) => formatCount(u.approvals) },
  { key: "rejections", label: "Rejections", numeric: true, render: (u) => formatCount(u.rejections) },
  { key: "asks", label: "Asks", numeric: true, render: (u) => formatCount(u.asks) },
  { key: "reanalyses", label: "Re-analyses", numeric: true, render: (u) => formatCount(u.reanalyses) },
];

const REGION_COLUMNS: readonly StatsColumn<UsageByRegion>[] = [
  { key: "region", label: "Region", render: (r) => r.region },
  { key: "users", label: "Active users", numeric: true, render: (r) => formatCount(r.users) },
  { key: "events", label: "Events", numeric: true, render: (r) => formatCount(r.events) },
];

/** Who uses Echo: from Echo's usage log, so only since that log began. */
export default function UsageSection({ usage, range }: { usage: UsageStats; range: StatsRange }) {
  const note = usageTrackingNote(usage, range);
  const events = usage.daily.reduce((sum, day) => sum + day.events, 0);

  return (
    <StatsSection
      title="Usage"
      subtitle="Who opened Echo in this range, and how much. A person's region is the one most of their open opportunities are in."
    >
      {note && (
        <Alert severity="info" variant="outlined">
          {note}
        </Alert>
      )}
      <StatTiles
        tiles={[
          { label: "Active users", value: formatCount(usage.activeUsers) },
          { label: "Events", value: formatCount(events) },
        ]}
      />
      <Box>
        <StatsSubheading>Active users</StatsSubheading>
        <ActiveUsersTrend
          daily={usage.daily}
          weekly={usage.weekly}
          label={`Daily and weekly active users, ${range.days} days`}
        />
        <Typography variant="caption" color="text.secondary">
          Days and weeks in UTC, weeks from Monday. The last day and week are still running.
        </Typography>
      </Box>
      <StatsTable
        title="Users"
        columns={USER_COLUMNS}
        rows={usage.users}
        rowKey={(u) => u.email}
        empty="No one used Echo in this range."
      />
      <StatsPair>
        <StatsTable
          title="Active users by region"
          columns={REGION_COLUMNS}
          rows={usage.byRegion}
          rowKey={(r) => r.region}
          empty="No one used Echo in this range."
        />
      </StatsPair>
    </StatsSection>
  );
}
