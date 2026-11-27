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
import type { MeetingTypeStats, RecorderStats, RecordingByRegion, RecordingStats } from "../types";
import { formatCount, formatDay, regionLabel } from "../util/statsFormat";
import StatsBarChart from "./StatsBarChart";
import { StatTiles, StatsPair, StatsSection, StatsSubheading, StatsTable, type StatsColumn } from "./StatsParts";

const RECORDER_COLUMNS: readonly StatsColumn<RecorderStats>[] = [
  { key: "email", label: "Recorder", render: (r) => r.email },
  { key: "region", label: "Region", render: (r) => regionLabel(r.region) },
  { key: "calls", label: "Calls", numeric: true, render: (r) => formatCount(r.calls) },
  { key: "withTranscript", label: "With transcript", numeric: true, render: (r) => formatCount(r.withTranscript) },
  { key: "analysed", label: "Analysed", numeric: true, render: (r) => formatCount(r.analysed) },
  { key: "lastCallAt", label: "Last call", render: (r) => formatDateTime(r.lastCallAt) },
];

const REGION_COLUMNS: readonly StatsColumn<RecordingByRegion>[] = [
  { key: "region", label: "Region", render: (r) => r.region },
  { key: "calls", label: "Calls", numeric: true, render: (r) => formatCount(r.calls) },
  { key: "analysed", label: "Analysed", numeric: true, render: (r) => formatCount(r.analysed) },
  { key: "recorders", label: "Recorders", numeric: true, render: (r) => formatCount(r.recorders) },
];

const TYPE_COLUMNS: readonly StatsColumn<MeetingTypeStats>[] = [
  { key: "type", label: "Meeting type", render: (t) => t.type },
  { key: "calls", label: "Calls", numeric: true, render: (t) => formatCount(t.calls) },
];

/**
 * The sales calls Echo recorded in range, and who recorded them. How the analysis of those
 * calls went is the Quality tab's AnalysisSection.
 */
export default function RecordingSection({ recording, days }: { recording: RecordingStats; days: number }) {
  return (
    <StatsSection
      title="Calls recorded"
      subtitle="Sales calls held in this range that Echo can analyse: not internal, not cancelled. By the recorder's region."
    >
      <StatTiles
        tiles={[
          { label: "Calls", value: formatCount(recording.calls) },
          { label: "Recorders", value: formatCount(recording.recorders) },
          { label: "Analysed", value: formatCount(recording.analysed) },
        ]}
      />
      <Box>
        <StatsSubheading>Calls by week</StatsSubheading>
        <StatsBarChart
          data={recording.weekly}
          xKey="weekStart"
          series={[
            { key: "calls", name: "Calls" },
            { key: "analysed", name: "Analysed" },
          ]}
          formatX={(weekStart) => `w/c ${formatDay(weekStart)}`}
          label={`Calls and analysed calls by week, ${days} days`}
          empty="No calls recorded in this range."
        />
      </Box>
      <StatsTable
        title="By recorder"
        columns={RECORDER_COLUMNS}
        rows={recording.byRecorder}
        rowKey={(r) => r.email}
        empty="No calls recorded in this range."
      />
      <StatsPair>
        <StatsTable
          title="By region"
          columns={REGION_COLUMNS}
          rows={recording.byRegion}
          rowKey={(r) => r.region}
          empty="No calls recorded in this range."
        />
        <StatsTable
          title="By meeting type"
          columns={TYPE_COLUMNS}
          rows={recording.byMeetingType}
          rowKey={(t) => t.type}
          empty="No calls recorded in this range."
        />
      </StatsPair>
    </StatsSection>
  );
}
