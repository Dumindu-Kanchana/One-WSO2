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

// Bars for Echo stats: one series (open deals by stage) or two side by side (calls against
// analysed, by week). Drawn with recharts and the shared chart palette, so the hues
// are the app's validated pair in both colour schemes, and the chrome is alpha over the
// surface rather than fixed greys.

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Box, Typography } from "@wso2/oxygen-ui";
import {
  CHART_FILL_GAP,
  CHART_SERIES_1,
  CHART_SERIES_2,
  chartChrome,
  seriesColor,
} from "@components/charts/chartPalette";
import { useLiveScheme } from "@components/charts/useLiveScheme";
import { formatCount } from "../util/statsFormat";
import StatsTooltip from "./StatsTooltip";

const CHART_HEIGHT = 220;
/** First series blue, second orange: the palette's pair, assigned by series, never by value. */
const SLOTS = [CHART_SERIES_1, CHART_SERIES_2] as const;

export interface ChartSeries<T> {
  key: keyof T & string;
  name: string;
}

/**
 * @param label - Names the chart for assistive tech; the figures are in the tables and tiles around it
 * @param empty - Said instead of drawing flat bars when every value is zero
 * @param everyTick - Label every bar, for a few named categories rather than a run of dates
 */
export default function StatsBarChart<T extends object>({
  data,
  xKey,
  series,
  formatX,
  label,
  empty,
  everyTick = false,
}: {
  data: readonly T[];
  xKey: keyof T & string;
  series: readonly ChartSeries<T>[];
  formatX: (value: string) => string;
  label: string;
  empty: string;
  everyTick?: boolean;
}) {
  const mode = useLiveScheme();
  const chrome = chartChrome(mode);
  const hasValues = data.some((row) => series.some((s) => Number(row[s.key]) > 0));

  if (!hasValues) {
    return (
      <Typography variant="body2" color="text.secondary">
        {empty}
      </Typography>
    );
  }

  return (
    <Box role="figure" aria-label={label} sx={{ height: CHART_HEIGHT }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barCategoryGap="20%" barGap={CHART_FILL_GAP}>
          <CartesianGrid vertical={false} stroke={chrome.line} />
          <XAxis
            // recharts cannot resolve its typed dataKey against a generic row; the key is checked against T above.
            dataKey={xKey as string}
            tickFormatter={(value: string) => formatX(String(value))}
            tick={{ fill: chrome.tick, fontSize: 11 }}
            stroke={chrome.line}
            tickLine={false}
            minTickGap={16}
            interval={everyTick ? 0 : "preserveEnd"}
          />
          <YAxis
            allowDecimals={false}
            tickFormatter={(value: number) => formatCount(value)}
            tick={{ fill: chrome.tick, fontSize: 11 }}
            stroke={chrome.line}
            tickLine={false}
            width={40}
          />
          <Tooltip cursor={{ fill: chrome.line }} content={<StatsTooltip formatLabel={formatX} />} />
          {series.length > 1 && (
            <Legend
              verticalAlign="top"
              align="right"
              iconType="square"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, color: chrome.tick, paddingBottom: 4 }}
            />
          )}
          {series.map((s, index) => (
            <Bar
              key={s.key}
              dataKey={s.key as string}
              name={s.name}
              fill={seriesColor(SLOTS[index % SLOTS.length], mode)}
              radius={[2, 2, 0, 0]}
              maxBarSize={28}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
