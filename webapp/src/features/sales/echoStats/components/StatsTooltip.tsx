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

// The card over a hovered point in an Echo stats chart: the x value, then one row per series.
// Theme tokens, so it follows the colour scheme like the cards around it.

import { Box } from "@wso2/oxygen-ui";
import { formatCount } from "../util/statsFormat";

interface TooltipEntry {
  name?: string | number;
  value?: number | string | readonly (number | string)[];
  color?: string;
}

export default function StatsTooltip({
  active,
  label,
  payload = [],
  formatLabel,
}: {
  active?: boolean;
  label?: string | number;
  payload?: readonly TooltipEntry[];
  formatLabel: (value: string) => string;
}) {
  if (!active || payload.length === 0) return null;
  return (
    <Box
      role="tooltip"
      sx={{
        bgcolor: "background.paper",
        color: "text.primary",
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        boxShadow: 2,
        px: 1.25,
        py: 0.75,
        fontSize: 12,
      }}
    >
      <Box sx={{ fontWeight: 700, mb: 0.25 }}>{formatLabel(String(label ?? ""))}</Box>
      {payload.map((entry) => (
        <Box key={String(entry.name)} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Box aria-hidden component="span" sx={{ width: 8, height: 8, borderRadius: "2px", bgcolor: entry.color }} />
          <span>{entry.name}</span>
          <Box component="span" sx={{ ml: "auto", pl: 1.5, fontVariantNumeric: "tabular-nums" }}>
            {formatCount(Number(entry.value ?? 0))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
