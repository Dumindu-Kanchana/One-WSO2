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
import type { StatsRange, UsageByAction, UsageStats, UsageUser } from "../types";
import { actionLabel, formatCount, formatDay, usageTrackingNote } from "../util/statsFormat";
import StatsBarChart from "./StatsBarChart";
import { StatTiles, StatsPair, StatsSection, StatsSubheading, StatsTable, type StatsColumn } from "./StatsParts";

const USER_COLUMNS: readonly StatsColumn<UsageUser>[] = [
  { key: "email", label: "User", render: (u) => u.email },
  { key: "lastSeen", label: "Last seen", render: (u) => formatDateTime(u.lastSeen) },
  { key: "events", label: "Events", numeric: true, render: (u) => formatCount(u.events) },
  { key: "dealViews", label: "Opportunity views", numeric: true, render: (u) => formatCount(u.dealViews) },
  { key: "approvals", label: "Approvals", numeric: true, render: (u) => formatCount(u.approvals) },
  { key: "rejections", label: "Rejections", numeric: true, render: (u) => formatCount(u.rejections) },
  { key: "asks", label: "Asks", numeric: true, render: (u) => formatCount(u.asks) },
  { key: "reanalyses", label: "Re-analyses", numeric: true, render: (u) => formatCount(u.reanalyses) },
];

const ACTION_COLUMNS: readonly StatsColumn<UsageByAction>[] = [
  {
    key: "action",
    label: "Action",
    render: (a) => (
      <>
        {actionLabel(a.action)}
        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75, fontFamily: "monospace" }}>
          {a.action}
        </Typography>
      </>
    ),
  },
  { key: "events", label: "Events", numeric: true, render: (a) => formatCount(a.events) },
  { key: "users", label: "Users", numeric: true, render: (a) => formatCount(a.users) },
];

/** Who uses Echo: from echo-backend's usage log, so only since that log began. */
export default function UsageSection({ usage, range }: { usage: UsageStats; range: StatsRange }) {
  const note = usageTrackingNote(usage, range);
  const events = usage.daily.reduce((sum, day) => sum + day.events, 0);

  return (
    <StatsSection title="Usage" subtitle="Who opened Echo in this range, and what they did there.">
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
        <StatsSubheading>Daily active users</StatsSubheading>
        <StatsBarChart
          data={usage.daily}
          xKey="date"
          series={[{ key: "users", name: "Active users" }]}
          formatX={formatDay}
          label={`Daily active users, ${range.days} days`}
          empty="No one used Echo in this range."
        />
        <Typography variant="caption" color="text.secondary">
          Days in UTC. The last one is today, so far.
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
          title="Actions"
          columns={ACTION_COLUMNS}
          rows={usage.byAction}
          rowKey={(a) => a.action}
          empty="No actions in this range."
        />
      </StatsPair>
    </StatsSection>
  );
}
