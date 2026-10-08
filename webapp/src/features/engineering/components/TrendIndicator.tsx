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

import { Box, Typography } from "@wso2/oxygen-ui";
import { TrendingDown, TrendingUp } from "@wso2/oxygen-ui-icons-react";
import { type JSX } from "react";

// Small up/down percentage chip (green up, red down) for a KPI tile. Renders
// nothing when the percentage is unknown (no baseline to compare against).
// Colours are theme tokens, so it takes One's theme (spec: colours are One's).
export default function TrendIndicator({
  pct,
}: {
  pct: number | null | undefined;
}): JSX.Element | null {
  if (pct == null || Number.isNaN(pct)) return null;
  const up = pct >= 0;
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.25,
        color: up ? "success.main" : "error.main",
      }}
    >
      {up ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
      <Typography variant="body1" sx={{ fontWeight: 700, lineHeight: 1 }}>
        {Math.abs(pct).toFixed(1)}%
      </Typography>
    </Box>
  );
}
