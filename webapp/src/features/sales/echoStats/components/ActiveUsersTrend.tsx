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

// Active users over the range: a line of daily active users, and weekly active users beside it.
//
// The two are counted over different spans, so the weekly line is drawn as a step that holds
// each ISO week's figure across that week's days, rather than as a second daily series. A
// day's point then reads "this many that day, this many that week", and the step makes plain
// that the weekly figure is one number for seven days. Weekly is always at least daily, so
// the gap between them is how many people came in on some other day of the week.

import { useMemo } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Box, Typography } from "@wso2/oxygen-ui";
import { CHART_SERIES_1, CHART_SERIES_2, chartChrome, seriesColor } from "@components/charts/chartPalette";
import { useLiveScheme } from "@components/charts/useLiveScheme";
import type { UsageDay, UsageWeek } from "../types";
import { formatCount, formatDay, weekStartOf } from "../util/statsFormat";
import StatsTooltip from "./StatsTooltip";

const CHART_HEIGHT = 240;

interface TrendPoint {
  date: string;
  daily: number;
  /** The week's figure; absent when the backend sent no row for that week. */
  weekly?: number;
}

export default function ActiveUsersTrend({
  daily,
  weekly,
  label,
}: {
  daily: readonly UsageDay[];
  weekly: readonly UsageWeek[];
  /** Names the chart for assistive tech. */
  label: string;
}) {
  const mode = useLiveScheme();
  const chrome = chartChrome(mode);
  const points = useMemo<TrendPoint[]>(() => {
    const byWeek = new Map(weekly.map((week) => [week.weekStart, week.users]));
    return daily.map((day) => ({ date: day.date, daily: day.users, weekly: byWeek.get(weekStartOf(day.date)) }));
  }, [daily, weekly]);

  if (!points.some((point) => point.daily > 0 || (point.weekly ?? 0) > 0)) {
    return (
      <Typography variant="body2" color="text.secondary">
        No one used Echo in this range.
      </Typography>
    );
  }

  return (
    <Box role="figure" aria-label={label} sx={{ height: CHART_HEIGHT }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={chrome.line} />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => formatDay(String(value))}
            tick={{ fill: chrome.tick, fontSize: 11 }}
            stroke={chrome.line}
            tickLine={false}
            minTickGap={16}
          />
          <YAxis
            allowDecimals={false}
            tickFormatter={(value: number) => formatCount(value)}
            tick={{ fill: chrome.tick, fontSize: 11 }}
            stroke={chrome.line}
            tickLine={false}
            width={40}
          />
          <Tooltip cursor={{ stroke: chrome.line }} content={<StatsTooltip formatLabel={formatDay} />} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="plainline"
            iconSize={12}
            wrapperStyle={{ fontSize: 12, color: chrome.tick, paddingBottom: 4 }}
          />
          <Line
            dataKey="daily"
            name="Active that day"
            stroke={seriesColor(CHART_SERIES_1, mode)}
            strokeWidth={2}
            dot={false}
            type="linear"
            isAnimationActive={false}
          />
          <Line
            dataKey="weekly"
            name="Active that week"
            stroke={seriesColor(CHART_SERIES_2, mode)}
            strokeWidth={2}
            dot={false}
            type="stepAfter"
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}
