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

import { Box, Skeleton } from "@wso2/oxygen-ui";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "@wso2/oxygen-ui-charts-react";
import { type JSX, useMemo } from "react";
import { colorForName } from "../utils/chartColors";
import { type ChartSeries } from "../utils/chartTypes";
import { formatCompact } from "../utils/format";
import type { ChartVariant } from "./ChartCard";
import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";
import SeriesChartTooltip from "./SeriesChartTooltip";

export type { ChartSeries } from "../utils/chartTypes";

interface SeriesChartProps {
  series: ChartSeries[];
  variant?: ChartVariant;
  height?: number;
  isLoading?: boolean;
  isError?: boolean;
  /** The caught error; its server message becomes the error placeholder's detail line. */
  error?: unknown;
  emptyTitle?: string;
  onRetry?: () => void;
  /** "short" strips the year and shows e.g. "Jun 28" instead of the raw ISO date. */
  xTickFormat?: "short";
}

function shortDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// One row per date, one column per series key. A date a series has no point
// on is simply absent from its row; the line connects across it (connectNulls),
// as the standalone draws it.
function mergeSeries(series: ChartSeries[]): Array<Record<string, string | number>> {
  const byDate = new Map<string, Record<string, string | number>>();
  for (const s of series) {
    for (const p of s.points) {
      const row = byDate.get(p.date) ?? { date: p.date };
      row[s.key] = p.value;
      byDate.set(p.date, row);
    }
  }
  return Array.from(byDate.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

// The one chart every Download Stats screen draws, on the Oxygen charts
// wrapper One already depends on, in the standalone's shape (ADR 0002): line
// or bar, dashed horizontal gridlines, compact Y figures, optional short dates,
// legend, the sorted tooltip, and its own skeleton, empty and error states.
// Every series is coloured by name through colorForName, never by position.
export default function SeriesChart({
  series,
  variant = "line",
  height = 380,
  isLoading,
  isError,
  error,
  emptyTitle = "No data for the selected range",
  onRetry,
  xTickFormat,
}: SeriesChartProps): JSX.Element {
  const xFormatter = xTickFormat === "short" ? shortDate : undefined;
  const data = useMemo(() => mergeSeries(series), [series]);

  if (isLoading) {
    return <Skeleton variant="rounded" width="100%" height={height} />;
  }
  if (isError) {
    return <ErrorState error={error} onRetry={onRetry} minHeight={height} />;
  }
  if (series.length === 0 || data.length === 0) {
    return <EmptyState title={emptyTitle} minHeight={height} />;
  }

  // xAxis/yAxis={{ show: false }} suppresses the wrapper's own internal axes so
  // that our child <XAxis>/<YAxis> are the only ones recharts sees. Without this,
  // the wrapper renders a second, dataKey-less XAxis alongside ours, and recharts
  // falls back to showing numeric indices (0 1 2 …) intermittently.
  const sharedProps = {
    xAxisDataKey: "date",
    xAxis: { show: false },
    yAxis: { show: false },
    legend: { show: true },
    tooltip: {
      show: true,
      content: SeriesChartTooltip,
      // Render the tooltip above all page elements (sticky headers, modals, etc.)
      wrapperStyle: { zIndex: 9999 },
    },
    // Extra vertical margin keeps the plot clear of the tooltip, which can
    // grow tall when many products (series) are shown at once.
    margin: { top: 16, right: 16, bottom: 16, left: 8 },
  } as const;

  // The outer ResponsiveContainer is the wrapper's re-export and sizes the
  // chart to this Box; the wrapper then wraps the chart in its own. Keep the
  // outer one: it is the only size a test can fix (see SeriesChart.test.tsx).
  return (
    <Box sx={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        {variant === "bar" ? (
          <BarChart data={data} {...sharedProps}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" type="category" tickMargin={8} minTickGap={24} tickFormatter={xFormatter} />
            <YAxis tickFormatter={(v: number) => formatCompact(v)} width={48} allowDecimals={false} />
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.name} fill={colorForName(s.name)} />
            ))}
          </BarChart>
        ) : (
          <LineChart data={data} {...sharedProps}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" type="category" tickMargin={8} minTickGap={24} tickFormatter={xFormatter} />
            <YAxis tickFormatter={(v: number) => formatCompact(v)} width={48} allowDecimals={false} />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={colorForName(s.name)}
                dot={false}
                strokeWidth={2}
                connectNulls
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </Box>
  );
}
