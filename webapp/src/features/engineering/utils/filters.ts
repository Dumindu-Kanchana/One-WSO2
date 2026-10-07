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

// The series, period-summary, date-matrix and address-filter utilities every
// Download Stats screen reads, ported from the standalone dashboard's
// features/stats/utils/filters.ts (ADR 0002). Pure: no React, no fetching.

import type {
  DailySeries,
  ReleaseDownloadGrain,
  TrackedRepository,
} from "../api/productDownloadStats";
import type { ChartSeries } from "./chartTypes";
import { productLabel } from "./format";

// Default look-back window (days) applied when the address names no range.
export const DEFAULT_RANGE_DAYS = 30;

// The filters every screen keeps in the address. Repository Stats reads its
// Stat beside these, as the standalone does; Versions and Packages read their
// Product the same way.
export interface StatsFilters {
  from: string;
  to: string;
  /** Tracked repository ids; empty means every Product. */
  repos: number[];
  interval: ReleaseDownloadGrain;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Default inclusive range: last DEFAULT_RANGE_DAYS days ending today, in UTC —
// the API labels its points by UTC day, so the window is cut the same way.
export function defaultRange(now = new Date()): { from: string; to: string } {
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - DEFAULT_RANGE_DAYS);
  return { from: isoDate(from), to: isoDate(now) };
}

// Parses the screen filters from the address, applying defaults.
export function parseFilters(params: URLSearchParams, now = new Date()): StatsFilters {
  const def = defaultRange(now);
  const reposRaw = params.get("repos") ?? "";
  const repos = reposRaw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);

  const intervalRaw = params.get("interval");
  const interval: ReleaseDownloadGrain =
    intervalRaw === "month" ? "month" : intervalRaw === "cumulative" ? "cumulative" : "day";

  return {
    from: params.get("from") || def.from,
    to: params.get("to") || def.to,
    repos,
    interval,
  };
}

type ParamValue = string | number | number[] | null | undefined;

// Returns a new URLSearchParams with the given keys merged in. Empty arrays /
// empty strings / null / undefined remove the key.
export function mergeParams(
  current: URLSearchParams,
  updates: Record<string, ParamValue>,
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || (Array.isArray(value) && value.length === 0) || value === "") {
      next.delete(key);
    } else if (Array.isArray(value)) {
      next.set(key, value.join(","));
    } else {
      next.set(key, String(value));
    }
  }
  return next;
}

export function productNameById(
  repos: ReadonlyArray<Pick<TrackedRepository, "id" | "repoName" | "productName">>,
): Map<number, string> {
  return new Map(repos.map((r) => [r.id, productLabel(r.productName, r.repoName)]));
}

// Maps the API's per-repository series to the generic chart series shape.
// Keyed by repository id, not by display name: two Products can share a name.
export function toChartSeries(
  series: readonly DailySeries[],
  names?: ReadonlyMap<number, string>,
): ChartSeries[] {
  return series.map((s) => ({
    key: `repo-${s.repoId}`,
    name: names?.get(s.repoId) ?? s.repoName,
    points: s.points.map((p) => ({ date: p.date, value: p.value })),
  }));
}

export interface PeriodSummary {
  total: number;
  avgPerPoint: number;
  peakDate: string | null;
  peakValue: number;
  minDate: string | null;
  minValue: number;
  pointCount: number;
}

// Aggregates the per-date totals (summed across series) into headline figures.
// Highest and lowest are read from those sums, not from any one series, as on
// the standalone; the first date keeps the title on a tie.
export function periodSummary(series: readonly ChartSeries[]): PeriodSummary {
  const byDate = new Map<string, number>();
  for (const s of series) {
    for (const p of s.points) {
      byDate.set(p.date, (byDate.get(p.date) ?? 0) + p.value);
    }
  }
  const entries = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (entries.length === 0) {
    return {
      total: 0,
      avgPerPoint: 0,
      peakDate: null,
      peakValue: 0,
      minDate: null,
      minValue: 0,
      pointCount: 0,
    };
  }
  let total = 0;
  let peak = { d: entries[0][0], v: entries[0][1] };
  let min = { d: entries[0][0], v: entries[0][1] };
  for (const [d, v] of entries) {
    total += v;
    if (v > peak.v) peak = { d, v };
    if (v < min.v) min = { d, v };
  }
  return {
    total,
    avgPerPoint: Math.round(total / entries.length),
    peakDate: peak.d,
    peakValue: peak.v,
    minDate: min.d,
    minValue: min.v,
    pointCount: entries.length,
  };
}

export interface DateMatrix {
  /** Every date any series has a point on, newest first. */
  dates: string[];
  columns: { key: string; name: string }[];
  /** Undefined where the series has no point on that date. */
  cell: (date: string, key: string) => number | undefined;
  totalForDate: (date: string) => number;
}

// Builds a date × series matrix (dates descending) for the data tables.
export function buildDateMatrix(series: readonly ChartSeries[]): DateMatrix {
  const dateSet = new Set<string>();
  const map = new Map<string, Map<string, number>>();
  for (const s of series) {
    for (const p of s.points) {
      dateSet.add(p.date);
      let row = map.get(p.date);
      if (!row) {
        row = new Map();
        map.set(p.date, row);
      }
      row.set(s.key, p.value);
    }
  }
  const dates = [...dateSet].sort((a, b) => b.localeCompare(a));
  const columns = series.map((s) => ({ key: s.key, name: s.name }));
  return {
    dates,
    columns,
    cell: (date, key) => map.get(date)?.get(key),
    totalForDate: (date) => {
      let t = 0;
      const row = map.get(date);
      if (row) for (const v of row.values()) t += v;
      return t;
    },
  };
}
