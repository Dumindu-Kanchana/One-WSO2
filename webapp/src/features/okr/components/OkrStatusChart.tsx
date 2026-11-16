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

import { useMemo } from "react";
import { Box, Typography, useTheme } from "@wso2/oxygen-ui";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { KEY_RESULT_STATUSES, type KeyResultStatus, type OkrStatusChange } from "../api/okrTypes";
import { KEY_RESULT_STATUS_LABEL, statusByWeek, statusChanges } from "../util/okr";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "21 Sep" for a YYYY-MM-DD day. */
function weekLabel(day: string): string {
  const [, month, date] = day.split("-").map(Number);
  return `${date} ${SHORT_MONTHS[month - 1]}`;
}

const levelLabel = (level: unknown) =>
  KEY_RESULT_STATUS_LABEL[KEY_RESULT_STATUSES[Number(level)] as KeyResultStatus] ?? "";

// A key result's status week by week, from the week it was added: each point
// is where it stood at the end of that week, drawn from every change made to
// it, so the chart can't disagree with the status shown beside it.
export default function OkrStatusChart({ history }: { history: OkrStatusChange[] }) {
  const theme = useTheme();
  // theme.palette holds the light scheme only; theme.vars follows the light/dark
  // switch, but as CSS variables, which SVG attributes don't read. So the text
  // and grid take their colours from CSS on the wrapper instead.
  const palette = (theme.vars ?? theme).palette;
  const weeks = useMemo(() => statusByWeek(history), [history]);
  const data = weeks.map((w) => ({ label: weekLabel(w.week), level: KEY_RESULT_STATUSES.indexOf(w.status) }));
  const changes = statusChanges(weeks);
  const tick = { fontSize: 12 };

  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, p: 2 }}>
      <Typography variant="overline" color="text.secondary" component="div" sx={{ lineHeight: 1.5 }}>
        Status over time
      </Typography>
      <Box
        sx={{
          height: 210,
          mt: 1,
          "& .recharts-cartesian-axis-tick-value": { fill: palette.text.secondary },
          "& .recharts-cartesian-grid line": { stroke: palette.divider },
        }}
        aria-hidden
      >
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis
              type="number"
              domain={[0, KEY_RESULT_STATUSES.length - 1]}
              ticks={KEY_RESULT_STATUSES.map((_, i) => i)}
              tickFormatter={levelLabel}
              tick={tick}
              tickLine={false}
              axisLine={false}
              width={92}
            />
            <Tooltip
              formatter={(value) => [levelLabel(value), "Status"]}
              contentStyle={{
                background: palette.background.paper,
                border: `1px solid ${palette.divider}`,
                color: palette.text.primary,
              }}
              labelStyle={{ color: palette.text.secondary }}
            />
            <Line
              type="stepAfter"
              dataKey="level"
              stroke={theme.palette.primary.main}
              strokeWidth={2}
              dot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
        {weeks.length} {weeks.length === 1 ? "week" : "weeks"} ·{" "}
        {changes === 0 ? "no change over the period" : `changed ${changes} ${changes === 1 ? "time" : "times"}`}
      </Typography>
      {/* The same history for screen readers, which can't read the chart. */}
      <Box component="ul" sx={visuallyHidden}>
        {history.map((h, i) => (
          <li key={i}>
            {KEY_RESULT_STATUS_LABEL[h.status]} from {h.changedOn.slice(0, 10)}
          </li>
        ))}
      </Box>
    </Box>
  );
}

// In px: in sx, a width or height of 1 means 100%.
const visuallyHidden = {
  position: "absolute",
  width: "1px",
  height: "1px",
  margin: "-1px",
  padding: 0,
  border: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
} as const;
