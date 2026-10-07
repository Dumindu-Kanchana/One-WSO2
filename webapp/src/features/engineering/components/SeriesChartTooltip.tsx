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

import type { ChartTooltip } from "@wso2/oxygen-ui-charts-react";
import type { ComponentProps, JSX, ReactElement, ReactNode } from "react";
import { colorForName } from "../utils/chartColors";
import { formatCompact } from "../utils/format";

// Derive the props type that recharts passes into a custom tooltip content
// function — sourced entirely from the Oxygen re-export so we never import
// from recharts directly (the wrapper carries its own copy of recharts).
export type TooltipContentProps =
  ComponentProps<typeof ChartTooltip>["content"] extends ReactElement | infer F | null | undefined
    ? F extends (props: infer P) => ReactNode
      ? P
      : never
    : never;

// The series chart's tooltip: every series at the hovered date, largest value
// first, each with its colour dot and compact figure. Styled with One's theme
// variables so it follows the light and dark themes.
export default function SeriesChartTooltip({
  active,
  payload,
  label,
}: TooltipContentProps): JSX.Element | null {
  if (!active || !payload || payload.length === 0) return null;

  const entries = payload as Array<{
    value?: number | null;
    name?: string;
    dataKey?: string | number;
    color?: string;
  }>;

  // Highest downloads first.
  const sorted = [...entries].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  return (
    <div
      style={{
        background: "var(--oxygen-palette-background-paper, #1e2432)",
        border: "1px solid var(--oxygen-palette-divider, rgba(255,255,255,0.12))",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 13,
        lineHeight: "1.6",
        maxWidth: 280,
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      }}
    >
      <p
        style={{
          margin: "0 0 6px",
          fontWeight: 600,
          color: "var(--oxygen-palette-text-secondary, rgba(255,255,255,0.6))",
          fontSize: 12,
        }}
      >
        {String(label ?? "")}
      </p>
      {sorted.map((entry) => (
        <div
          key={String(entry.dataKey ?? entry.name)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 2,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              flexShrink: 0,
              background: entry.color ?? colorForName(entry.name ?? ""),
            }}
          />
          <span
            style={{
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: "var(--oxygen-palette-text-primary, #fff)",
            }}
          >
            {entry.name}
          </span>
          <span
            style={{
              fontWeight: 600,
              color: "var(--oxygen-palette-text-primary, #fff)",
              marginLeft: 8,
            }}
          >
            {formatCompact(entry.value ?? 0)}
          </span>
        </div>
      ))}
    </div>
  );
}
