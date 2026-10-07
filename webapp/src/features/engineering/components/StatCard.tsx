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

import { alpha, Box, Card, Skeleton, Tooltip, Typography, useTheme } from "@wso2/oxygen-ui";
import { Info } from "@wso2/oxygen-ui-icons-react";
import { type JSX, type ReactNode } from "react";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  /** Palette token for the icon disc and the hover glow, so the tile takes One's theme. */
  iconColor?: "primary" | "secondary" | "success" | "warning" | "error" | "info";
  tooltipText?: string;
  /** Typically a TrendIndicator; sits in the top row beside the icon. */
  trend?: ReactNode;
  /** Makes the whole tile a button: hover glow, click, Enter and Space. */
  onClick?: () => void;
  isLoading?: boolean;
  isError?: boolean;
}

// A single KPI tile with loading skeleton and error fallback, in the
// standalone's shape (ADR 0002). A whole-tile click rather than a text button,
// so the figure keeps its own case and the tile reads as the link it is.
export function StatCard({
  label,
  value,
  icon,
  iconColor = "primary",
  tooltipText,
  trend,
  onClick,
  isLoading,
  isError,
}: StatCardProps): JSX.Element {
  const theme = useTheme();
  const palette = theme.palette[iconColor];

  return (
    <Card
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        p: 2.5,
        height: "100%",
        ...(onClick && {
          cursor: "pointer",
          transition: "box-shadow 0.2s ease, background-color 0.2s ease",
          "&:hover": {
            bgcolor: alpha(palette.light ?? palette.main, 0.06),
            boxShadow: `0 0 0 1px ${alpha(palette.light ?? palette.main, 0.4)}, 0 4px 12px ${alpha(palette.main, 0.15)}`,
          },
        }),
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          minHeight: icon ? undefined : 0,
        }}
      >
        {icon && (
          <Box
            sx={{
              p: 1,
              borderRadius: "50%",
              bgcolor: alpha(palette.light ?? palette.main, 0.1),
              color: palette.light ?? palette.main,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {icon}
          </Box>
        )}
        {trend}
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        <Typography variant="h4">
          {isLoading ? <Skeleton variant="text" width="50%" height={36} /> : isError ? "—" : value}
        </Typography>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          {tooltipText && (
            <Tooltip title={tooltipText} placement="bottom">
              <Info size={14} />
            </Tooltip>
          )}
        </Box>
      </Box>
    </Card>
  );
}
