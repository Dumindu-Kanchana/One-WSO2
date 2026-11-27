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

import type { JSX } from "react";
import { Box, Skeleton, Typography } from "@wso2/oxygen-ui";
import { DelayedSkeleton } from "../../components/EaSkeletons";
import { Kpi, KpiRow } from "../dashboardParts";
import { Block } from "./parts";

/** What a widget's body looks like, so its skeleton can have the same shape. */
type SkeletonShape = "tiles" | "queues" | "bars" | "chart" | "rows" | "travel" | "consultants";

/** A tile's label, or the label and `true` for a tile with a note under its figure. */
export type TileShape = string | readonly [label: string, note: true];

/** The tiles of each tile widget, as it draws them. */
const TILES: Readonly<Record<string, readonly TileShape[]>> = {
  "tc-kpis": ["Total Travel Cost", "Travels", "Average per Trip", "Travellers", "Spend Without a Job Number"],
  "tt-glance": [
    ["Away This Week", true],
    ["Ended, Not Completed", true],
    ["Invoices Awaiting PO Approval", true],
  ],
};
const TRAVEL_TILES: readonly TileShape[] = [["Travels In Progress", true], "Starting in 30 Days", "Completed This Month", "Travels in 12 Months"];
const CONSULTANT_TILES: readonly TileShape[] = [
  ["Available", true],
  ["Allocated", true],
];
const CHARTS = new Set(["tc-month", "am-by-month", "ev-by-month", "allocations-over-time"]);
const BARS = new Set([
  "tc-source",
  "tc-cost-type",
  "tc-country",
  "tc-paid",
  "tc-customers",
  "tc-agents",
  "tt-po-age",
  "tt-frequent",
  "tt-agent-workload",
  "em-most-allocated",
  "em-top-customers",
  "am-by-status",
  "ev-by-region",
  "ev-funding-bu",
]);

/** The shape of a widget's content, by its id. Lists and tables are the default. */
function skeletonShape(id: string): SkeletonShape {
  if (id in TILES) return "tiles";
  if (id === "waiting-on-you") return "queues";
  if (id === "travel") return "travel";
  if (id === "available-consultants") return "consultants";
  if (CHARTS.has(id)) return "chart";
  if (BARS.has(id)) return "bars";
  return "rows";
}

/** The height each shape reserves (and the loaded widget is usually about as tall), so the card does not jump. */
const RESERVED: Readonly<Record<SkeletonShape, number>> = { tiles: 66, queues: 64, bars: 196, chart: 200, rows: 190, travel: 420, consultants: 300 };

/** Figure tiles while their figures load: the real labels, with a bar where each figure will be. */
export const Tiles = ({ tiles }: { readonly tiles: readonly TileShape[] }): JSX.Element => (
  <>
    {tiles.map((t) => (typeof t === "string" ? <Kpi key={t} label={t} value="" loading /> : <Kpi key={t[0]} label={t[0]} value="" note=" " loading />))}
  </>
);

/** A label, a bar and a value per line, like HBars. */
export const Bars = ({ rows = 5 }: { readonly rows?: number }): JSX.Element => (
  <Box sx={{ display: "grid", gap: 1.25 }}>
    {Array.from({ length: rows }, (_, i) => (
      <Box key={i} sx={{ display: "grid", gridTemplateColumns: "minmax(80px, 30%) 1fr 48px", gap: 1.5, alignItems: "center" }}>
        <Skeleton variant="text" sx={{ fontSize: 13 }} />
        <Skeleton variant="rounded" height={14} width={`${90 - i * 14}%`} />
        <Skeleton variant="text" sx={{ fontSize: 13 }} />
      </Box>
    ))}
  </Box>
);

/** A chart area: columns of rising and falling height on a baseline. */
export const ChartBox = ({ height = 170 }: { readonly height?: number }): JSX.Element => (
  <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1, height, borderBottom: 1, borderColor: "divider" }}>
    {[45, 70, 55, 85, 60, 90, 50, 75, 65, 80, 58, 70].map((h, i) => (
      <Skeleton key={i} variant="rounded" sx={{ flex: 1, height: `${h}%`, transform: "none" }} />
    ))}
  </Box>
);

/** Rows of a date or name, a title with a line under it, and a status. */
export const Rows = ({ rows = 4 }: { readonly rows?: number }): JSX.Element => (
  <Box sx={{ display: "grid", gap: 1.5 }}>
    {Array.from({ length: rows }, (_, i) => (
      <Box key={i} sx={{ display: "grid", gridTemplateColumns: "44px 1fr 90px", gap: 1.5, alignItems: "center" }}>
        <Skeleton variant="rounded" height={36} />
        <Box>
          <Skeleton variant="text" width={`${55 + ((i * 13) % 30)}%`} sx={{ fontSize: 14 }} />
          <Skeleton variant="text" width="40%" sx={{ fontSize: 12 }} />
        </Box>
        <Skeleton variant="rounded" height={22} />
      </Box>
    ))}
  </Box>
);

function Shape({ id }: { readonly id: string }): JSX.Element {
  switch (skeletonShape(id)) {
    case "tiles":
      return (
        <KpiRow>
          <Tiles tiles={TILES[id] ?? []} />
        </KpiRow>
      );
    case "queues":
      return (
        <KpiRow>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} variant="rounded" height={64} />
          ))}
        </KpiRow>
      );
    case "bars":
      return <Bars />;
    case "chart":
      return <ChartBox />;
    case "travel":
      return (
        <>
          <KpiRow>
            <Tiles tiles={TRAVEL_TILES} />
          </KpiRow>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 3, mt: 2.5 }}>
            <Block title="Top Destinations">
              <Bars rows={4} />
            </Block>
            <Block title="Travels by Travel Agent">
              <Bars rows={4} />
            </Block>
          </Box>
          <Box sx={{ mt: 2.5 }}>
            <Block title="Travels by Month">
              <ChartBox height={110} />
            </Block>
          </Box>
        </>
      );
    case "consultants":
      return (
        <>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, mb: 2 }}>
            <Tiles tiles={CONSULTANT_TILES} />
          </Box>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: "text.secondary", mb: 1 }}>Available by Business Unit</Typography>
          <Bars rows={4} />
        </>
      );
    default:
      return <Rows />;
  }
}

/** A widget's skeleton: the shape of its content, shown only when the answer is not quick, in space reserved from the start. */
export default function WidgetSkeleton({ id, delay }: { readonly id: string; readonly delay?: number }): JSX.Element {
  return (
    <DelayedSkeleton minHeight={RESERVED[skeletonShape(id)]} delay={delay}>
      <Shape id={id} />
    </DelayedSkeleton>
  );
}
