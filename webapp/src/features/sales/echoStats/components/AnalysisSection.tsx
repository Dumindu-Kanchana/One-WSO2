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

import type { RecordingStats } from "../types";
import { formatCount } from "../util/statsFormat";
import { StatTiles, StatsSection } from "./StatsParts";

/**
 * How the analysis of the recorded calls went: the transcripts Echo got, and what became of
 * them. The same calls the Adoption tab counts.
 *
 * Analysed and failed are not parts of "with transcript": a call analysed once and then
 * failed on a re-analysis counts in both, so each tile says what it counts rather than being
 * laid out as a breakdown that should add up.
 */
export default function AnalysisSection({ recording }: { recording: RecordingStats }) {
  return (
    <StatsSection
      title="Analysis outcomes"
      subtitle={`What became of the ${formatCount(recording.calls)} sales calls recorded in this range.`}
    >
      <StatTiles
        tiles={[
          { label: "With transcript", value: formatCount(recording.withTranscript) },
          { label: "Analysed", value: formatCount(recording.analysed), hint: "a finished analysis" },
          {
            label: "Analysis failed",
            value: formatCount(recording.failed),
            hint: "latest run failed; may also be analysed",
          },
          { label: "Empty transcript", value: formatCount(recording.emptyTranscript), hint: "nothing to analyse" },
        ]}
      />
    </StatsSection>
  );
}
