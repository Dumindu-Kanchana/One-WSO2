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

import { Box } from "@wso2/oxygen-ui";
import { formatDateTime } from "../../util/salesTime";
import type { ProgressByOwner, ProgressByRegion, ProgressStats, StageChange } from "../types";
import { directionLabel, formatCount, regionLabel } from "../util/statsFormat";
import StatsBarChart from "./StatsBarChart";
import {
  DealLink,
  StatTiles,
  StatsPair,
  StatsSection,
  StatsSubheading,
  StatsTable,
  type StatsColumn,
} from "./StatsParts";

const CHANGE_COLUMNS: readonly StatsColumn<StageChange>[] = [
  { key: "name", label: "Opportunity", render: (c) => <DealLink opportunityId={c.opportunityId} name={c.name} /> },
  { key: "owner", label: "Owner", render: (c) => c.ownerEmail ?? "—" },
  { key: "region", label: "Region", render: (c) => regionLabel(c.region) },
  { key: "change", label: "Stage change", render: (c) => `${c.from} → ${c.to}` },
  { key: "direction", label: "Direction", render: (c) => directionLabel(c.direction) },
  { key: "at", label: "When", render: (c) => formatDateTime(c.at) },
];

const REGION_COLUMNS: readonly StatsColumn<ProgressByRegion>[] = [
  { key: "region", label: "Region", render: (r) => r.region },
  { key: "openDeals", label: "Open", numeric: true, render: (r) => formatCount(r.openDeals) },
  { key: "stageChanges", label: "Stage changes", numeric: true, render: (r) => formatCount(r.stageChanges) },
  { key: "closedWon", label: "Won", numeric: true, render: (r) => formatCount(r.closedWon) },
  { key: "closedLost", label: "Lost", numeric: true, render: (r) => formatCount(r.closedLost) },
];

const OWNER_COLUMNS: readonly StatsColumn<ProgressByOwner>[] = [
  { key: "ownerEmail", label: "Owner", render: (o) => o.ownerEmail },
  { key: "region", label: "Region", render: (o) => regionLabel(o.region) },
  { key: "openDeals", label: "Open", numeric: true, render: (o) => formatCount(o.openDeals) },
  { key: "stageChanges", label: "Stage changes", numeric: true, render: (o) => formatCount(o.stageChanges) },
  { key: "closedWon", label: "Won", numeric: true, render: (o) => formatCount(o.closedWon) },
  { key: "closedLost", label: "Lost", numeric: true, render: (o) => formatCount(o.closedLost) },
];

/**
 * How deals move: the open opportunities on the list as they stand now, and the stage changes
 * and closes in range, from Salesforce stage history.
 */
export default function ProgressSection({ progress, days }: { progress: ProgressStats; days: number }) {
  return (
    <StatsSection
      title="Deal progress"
      subtitle={`Open opportunities as of ${formatDateTime(progress.asOf)}, and the stage changes and closes in this range. Forward and back count each opportunity once, by its latest change.`}
    >
      <StatTiles
        tiles={[
          { label: "Open opportunities", value: formatCount(progress.openDeals) },
          { label: "Stage changes", value: formatCount(progress.stageChanges), hint: "opportunities that moved" },
          { label: "Moved forward", value: formatCount(progress.movedForward) },
          { label: "Moved back", value: formatCount(progress.movedBack) },
          { label: "Won", value: formatCount(progress.closedWon) },
          { label: "Lost", value: formatCount(progress.closedLost) },
        ]}
      />
      <Box>
        <StatsSubheading>Open opportunities by stage</StatsSubheading>
        <StatsBarChart
          data={progress.byStage}
          xKey="stage"
          series={[{ key: "deals", name: "Open opportunities" }]}
          formatX={(stage) => stage}
          label="Open opportunities by stage"
          empty="No open opportunities on the list."
          everyTick
        />
      </Box>
      <StatsTable
        title="Recent stage changes"
        columns={CHANGE_COLUMNS}
        rows={progress.changes}
        rowKey={(c) => `${c.opportunityId}:${c.at}:${c.to}`}
        empty={`No opportunity changed stage in the last ${days} days.`}
      />
      <StatsPair>
        <StatsTable
          title="By region"
          columns={REGION_COLUMNS}
          rows={progress.byRegion}
          rowKey={(r) => r.region}
          empty="No open opportunities, and no stage changes in this range."
        />
        <StatsTable
          title="By owner"
          columns={OWNER_COLUMNS}
          rows={progress.byOwner}
          rowKey={(o) => o.ownerEmail}
          empty="No open opportunities, and no stage changes in this range."
        />
      </StatsPair>
    </StatsSection>
  );
}
