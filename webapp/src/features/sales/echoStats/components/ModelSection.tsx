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
import type { ModelPurposeStats, ModelStats } from "../types";
import { formatCount } from "../util/statsFormat";
import { StatTiles, StatsSection, StatsTable, type StatsColumn } from "./StatsParts";

const PURPOSE_COLUMNS: readonly StatsColumn<ModelPurposeStats>[] = [
  {
    key: "purpose",
    label: "Purpose",
    render: (p) => (
      <Typography component="span" variant="body2" sx={{ fontFamily: "monospace" }}>
        {p.purpose}
      </Typography>
    ),
  },
  { key: "calls", label: "Calls", numeric: true, render: (p) => formatCount(p.calls) },
  { key: "failed", label: "Failed", numeric: true, render: (p) => formatCount(p.failed) },
  { key: "inputTokens", label: "Input tokens", numeric: true, render: (p) => formatCount(p.inputTokens) },
  { key: "outputTokens", label: "Output tokens", numeric: true, render: (p) => formatCount(p.outputTokens) },
  { key: "cacheReadTokens", label: "Cache read tokens", numeric: true, render: (p) => formatCount(p.cacheReadTokens) },
];

/** Every call Echo made to Claude in range, and the tokens they took. */
export default function ModelSection({ model }: { model: ModelStats }) {
  return (
    <StatsSection title="Claude usage" subtitle="Every request Echo made to Claude in this range.">
      <StatTiles
        tiles={[
          { label: "Requests", value: formatCount(model.calls) },
          { label: "Failed", value: formatCount(model.failed) },
          { label: "Input tokens", value: formatCount(model.inputTokens) },
          { label: "Output tokens", value: formatCount(model.outputTokens) },
          { label: "Cache read tokens", value: formatCount(model.cacheReadTokens) },
          { label: "Cache write tokens", value: formatCount(model.cacheWriteTokens) },
        ]}
      />
      <StatsTable
        title="By purpose, most input tokens first"
        columns={PURPOSE_COLUMNS}
        rows={model.byPurpose}
        rowKey={(p) => p.purpose}
        empty="Echo made no requests to Claude in this range."
      />
    </StatsSection>
  );
}
