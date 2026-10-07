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

import { Box, Card, ToggleButton, ToggleButtonGroup, Typography } from "@wso2/oxygen-ui";
import { BarChart2, ChartLine } from "@wso2/oxygen-ui-icons-react";
import { type JSX, type ReactNode, useState } from "react";

export type ChartVariant = "line" | "bar";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** When true, renders the line/bar icon toggle aligned with the card title. */
  showTypeToggle?: boolean;
  /**
   * The variant that the parent wants. When showTypeToggle is true the reader
   * can override this locally; if the parent changes it (e.g. interval switches
   * to monthly → "bar"), the local state resets to follow.
   */
  defaultVariant?: ChartVariant;
  /**
   * Called when the reader toggles. A screen that keeps the chart type in the
   * address (Downloads) writes it there and feeds it back as defaultVariant.
   */
  onVariantChange?: (variant: ChartVariant) => void;
  /**
   * Render prop called with the current (possibly user-toggled) chart variant
   * so the child SeriesChart can be stateless. Also accepts a plain ReactNode
   * for cards that have no toggle.
   */
  children: ((variant: ChartVariant) => ReactNode) | ReactNode;
}

// A titled card around a chart, with a line/bar icon toggle in its header.
export default function ChartCard({
  title,
  subtitle,
  action,
  showTypeToggle = false,
  defaultVariant = "line",
  onVariantChange,
  children,
}: ChartCardProps): JSX.Element {
  const [variant, setVariant] = useState<ChartVariant>(defaultVariant);
  // Follow the parent when it changes its default (e.g. the interval changed),
  // adjusted during render — React's pattern for a prop-driven reset — so the
  // old choice is never drawn for a frame first.
  const [followedDefault, setFollowedDefault] = useState(defaultVariant);
  if (followedDefault !== defaultVariant) {
    setFollowedDefault(defaultVariant);
    setVariant(defaultVariant);
  }

  const resolvedChildren = typeof children === "function" ? children(variant) : children;

  return (
    <Card sx={{ p: 2, height: "100%" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="h6" component="h3">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {showTypeToggle && (
            <ToggleButtonGroup
              size="small"
              exclusive
              color="primary"
              value={variant}
              onChange={(_, v: ChartVariant | null) => {
                if (!v) return;
                setVariant(v);
                onVariantChange?.(v);
              }}
            >
              <ToggleButton value="line" aria-label="Line chart" sx={{ p: 0.75 }}>
                <ChartLine size={16} />
              </ToggleButton>
              <ToggleButton value="bar" aria-label="Bar chart" sx={{ p: 0.75 }}>
                <BarChart2 size={16} />
              </ToggleButton>
            </ToggleButtonGroup>
          )}
          {action}
        </Box>
      </Box>

      {resolvedChildren}
    </Card>
  );
}
