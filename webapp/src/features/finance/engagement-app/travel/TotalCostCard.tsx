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

import { useEffect, type JSX } from "react";
import { Box, Card, Skeleton, Typography } from "@wso2/oxygen-ui";
import type { JobCostSummary } from "../api/dashboardTypes";
import { useEngagementAccess } from "../api/useEngagementUserInfo";
import { InfoHint } from "../dashboard/dashboardParts";
import { COST_SOURCE_LABEL, notConvertedText, USD_RATE_HINT } from "../dashboard/travelCostText";
import { usd2, utcStamp } from "../dashboard/travelCosts/costFormat";
import { totalCostState, type TotalCostState } from "./totalCostState";

/** The sources that cost something, as "Travel Invoices USD 1,200.00" parts. Empty for a travel agent, who gets no split. */
function splitParts(data: JobCostSummary): readonly string[] {
  return (data.bySource ?? []).filter((s) => s.lines > 0).map((s) => `${COST_SOURCE_LABEL[s.source]} ${usd2(s.usd)}`);
}

const VALUE_SX = { fontSize: 22, fontWeight: 650, fontVariantNumeric: "tabular-nums", lineHeight: 1.3 } as const;

/** The "Total Cost So Far" card, from the state alone so it can be shown and tested without the network. `split` is whether the viewer gets the split line, which the loading card then holds a place for. */
export function TotalCostCardView({ state, split: withSplit = true }: { readonly state: TotalCostState; readonly split?: boolean }): JSX.Element | null {
  if (state.kind === "hidden") return null;
  const title = (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <Typography sx={{ fontSize: 12, color: "text.secondary", fontWeight: 500 }}>Total Cost So Far</Typography>
      <InfoHint label="How USD is calculated">{USD_RATE_HINT}</InfoHint>
    </Box>
  );
  if (state.kind === "loading") {
    return (
      <Card variant="outlined" sx={{ px: 2, py: 1.5, mb: 2 }} component="section" aria-label="Total Cost So Far" aria-busy="true" data-testid="total-cost-loading">
        {title}
        <Typography sx={VALUE_SX}>
          <Skeleton variant="text" width={180} />
        </Typography>
        {withSplit ? (
          <Typography sx={{ fontSize: 12.5 }}>
            <Skeleton variant="text" width="60%" />
          </Typography>
        ) : null}
        <Typography sx={{ fontSize: 11.5, mt: 0.5 }}>
          <Skeleton variant="text" width={170} />
        </Typography>
      </Card>
    );
  }
  if (state.kind === "error") {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }} role="status">
        The total cost so far isn&apos;t available right now.
      </Typography>
    );
  }
  const { data } = state;
  const split = withSplit ? splitParts(data) : [];
  const notConverted = notConvertedText(data.notConverted);
  return (
    <Card variant="outlined" sx={{ px: 2, py: 1.5, mb: 2 }} component="section" aria-label="Total Cost So Far">
      {title}
      <Typography sx={VALUE_SX}>{usd2(data.totalUsd)}</Typography>
      {split.length ? <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>{split.join(", ")}</Typography> : null}
      {notConverted ? <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.5 }}>{notConverted}</Typography> : null}
      {data.hasUnconvertedHidden ? (
        <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.5 }}>Some amounts could not be converted and are left out of the total.</Typography>
      ) : null}
      {data.incomplete ? (
        <Typography sx={{ fontSize: 12, color: "warning.main", mt: 0.5 }}>
          {data.failedSources.length
            ? `${data.failedSources.map((s) => COST_SOURCE_LABEL[s]).join(" and ")} could not be read, so this total may be too low.`
            : "Some lines are missing, so this total may be too low."}
        </Typography>
      ) : null}
      <Typography sx={{ fontSize: 11.5, color: "text.secondary", mt: 0.5 }}>As of {utcStamp(data.dataAsOf)}</Typography>
    </Card>
  );
}

/** Whether the last cost summary asked for was refused. The next card then stays out while it loads, instead of showing and going away. */
let lastRefused = false;

/** The total cost so far of one travel request, from the page's `useJobCostSummary` query. */
export default function TotalCostCard({ cost }: { readonly cost: Parameters<typeof totalCostState>[0] }): JSX.Element | null {
  const { isAgent } = useEngagementAccess();
  const state = totalCostState(cost);
  useEffect(() => {
    if (state.kind === "hidden") lastRefused = true;
    else if (state.kind === "ready") lastRefused = false;
  }, [state.kind]);
  if (state.kind === "loading" && lastRefused) return null;
  return <TotalCostCardView state={state} split={!isAgent} />;
}
