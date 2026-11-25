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

// The pieces every Echo stats section is built from: the card, the row of headline
// figures, and a small table. Theme tokens only, so both colour schemes follow.

import type { ReactNode } from "react";
import {
  Box,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";

/** One section of the page: a card with its heading, and a line on what it counts. */
export function StatsSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  const headingId = `echo-stats-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <Card component="section" aria-labelledby={headingId} sx={{ p: { xs: 2, md: 2.5 } }}>
      <Typography id={headingId} variant="h6" component="h2">
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, maxWidth: "80ch" }}>
          {subtitle}
        </Typography>
      )}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mt: 2 }}>{children}</Box>
    </Card>
  );
}

export interface StatTile {
  label: string;
  value: string;
  /** A few words under the figure, e.g. what it is a share of. */
  hint?: string;
}

/** The section's headline figures. Each tile is a named group, so it reads as "label, value". */
export function StatTiles({ tiles }: { tiles: readonly StatTile[] }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
        gap: 1.5,
      }}
    >
      {tiles.map((tile) => (
        <Box
          key={tile.label}
          role="group"
          aria-label={tile.label}
          sx={{ border: 1, borderColor: "divider", borderRadius: 1, px: 1.75, py: 1.25 }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            {tile.label}
          </Typography>
          <Typography variant="h5" component="p" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {tile.value}
          </Typography>
          {tile.hint && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              {tile.hint}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  );
}

/** A heading inside a section, over a chart or a table. */
export function StatsSubheading({ children }: { children: ReactNode }) {
  return (
    <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
      {children}
    </Typography>
  );
}

export interface StatsColumn<T> {
  key: string;
  label: string;
  /** Right-aligned, in tabular figures. */
  numeric?: boolean;
  render: (row: T) => ReactNode;
}

/**
 * A titled table of one breakdown. Long lists scroll inside the card under a sticky
 * header rather than stretching the page; an empty one says so in a sentence.
 */
export function StatsTable<T>({
  title,
  columns,
  rows,
  rowKey,
  empty,
  maxHeight = 360,
}: {
  title: string;
  columns: readonly StatsColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  /** What an empty list means, e.g. "No calls recorded in this range." */
  empty: string;
  maxHeight?: number;
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <StatsSubheading>{title}</StatsSubheading>
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {empty}
        </Typography>
      ) : (
        <TableContainer sx={{ maxHeight, border: 1, borderColor: "divider", borderRadius: 1 }}>
          <Table size="small" stickyHeader aria-label={title}>
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    align={column.numeric ? "right" : "left"}
                    sx={{ whiteSpace: "nowrap", fontWeight: 600 }}
                  >
                    {column.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={rowKey(row)} hover>
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      align={column.numeric ? "right" : "left"}
                      sx={column.numeric ? { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" } : undefined}
                    >
                      {column.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

/** Two breakdowns side by side on a wide screen, stacked on a narrow one. */
export function StatsPair({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2.5, alignItems: "start" }}>
      {children}
    </Box>
  );
}
