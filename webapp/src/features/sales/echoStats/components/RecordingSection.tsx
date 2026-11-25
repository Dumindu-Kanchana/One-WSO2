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
import type { MeetingTypeStats, RecorderStats, RecordingStats } from "../types";
import { formatCount, formatDay } from "../util/statsFormat";
import StatsBarChart from "./StatsBarChart";
import { StatTiles, StatsPair, StatsSection, StatsSubheading, StatsTable, type StatsColumn } from "./StatsParts";

const RECORDER_COLUMNS: readonly StatsColumn<RecorderStats>[] = [
  { key: "email", label: "Recorder", render: (r) => r.email },
  { key: "calls", label: "Calls", numeric: true, render: (r) => formatCount(r.calls) },
  { key: "withTranscript", label: "With transcript", numeric: true, render: (r) => formatCount(r.withTranscript) },
  { key: "analysed", label: "Analysed", numeric: true, render: (r) => formatCount(r.analysed) },
  { key: "lastCallAt", label: "Last call", render: (r) => formatDateTime(r.lastCallAt) },
];

const TYPE_COLUMNS: readonly StatsColumn<MeetingTypeStats>[] = [
  { key: "type", label: "Meeting type", render: (t) => t.type },
  { key: "calls", label: "Calls", numeric: true, render: (t) => formatCount(t.calls) },
];

/** The sales calls Echo recorded in range, and how far each got through analysis. */
export default function RecordingSection({ recording, days }: { recording: RecordingStats; days: number }) {
  return (
    <StatsSection
      title="Calls recorded"
      subtitle="Sales calls held in this range that Echo can analyse: not internal, not cancelled."
    >
      <StatTiles
        tiles={[
          { label: "Calls", value: formatCount(recording.calls) },
          { label: "With transcript", value: formatCount(recording.withTranscript) },
          // Not parts of "With transcript": a call analysed once and then failed on a
          // re-analysis counts in both, so the hints say what each one is.
          { label: "Analysed", value: formatCount(recording.analysed), hint: "a finished analysis" },
          {
            label: "Analysis failed",
            value: formatCount(recording.failed),
            hint: "latest run failed; may also be analysed",
          },
          { label: "Empty transcript", value: formatCount(recording.emptyTranscript) },
          { label: "Recorders", value: formatCount(recording.recorders) },
        ]}
      />
      <Box>
        <StatsSubheading>Calls and analysed, by week</StatsSubheading>
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
