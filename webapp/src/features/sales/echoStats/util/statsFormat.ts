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

// Display helpers for Echo stats. Presentation only: every count and rate is the backend's.
//
// Numbers use fixed en-US grouping rather than the browser's locale, so a column of
// figures lines up the same for every reader, as formatAmount does on the deal rows.

import type { MergeStatus } from "../../meddpicc/types";
import { rejectReasonLabel } from "../../meddpicc/util/meddpiccFormat";
import { parseUtc } from "../../util/salesTime";
import { UNASSIGNED_REGION, type StageDirection, type StatsRange, type UsageStats } from "../types";

const COUNT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** 1234567 → "1,234,567". */
export function formatCount(value: number): string {
  return COUNT.format(value);
}

/** A person's or a deal's region; none is "Unassigned", as the by-region lists name it. */
export function regionLabel(region: string | null | undefined): string {
  return region ?? UNASSIGNED_REGION;
}

/** 0.727 → "72.7%"; null (nothing to divide by) → "—". */
export function formatRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return "—";
  const percent = Math.round(rate * 1000) / 10;
  return `${percent}%`;
}

/** `part` of `whole` as a rate, or "—" when there is no whole. */
export function formatShare(part: number, whole: number): string {
  return formatRate(whole === 0 ? null : part / whole);
}

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const FULL_DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * A calendar date the backend sends as yyyy-MM-dd ("2026-11-23" → "23 Nov").
 *
 * Read and written in UTC: it is a date, not an instant, and reading it in the viewer's
 * zone would move it a day back for everyone west of Greenwich.
 */
export function formatDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? date : DAY.format(parsed);
}

/** The Monday (UTC) of the ISO week holding a yyyy-MM-dd date, as yyyy-MM-dd. */
export function weekStartOf(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setUTCDate(parsed.getUTCDate() - ((parsed.getUTCDay() + 6) % 7));
  return parsed.toISOString().slice(0, 10);
}

/** An instant as its date in the viewer's zone ("2026-11-26T09:00:00Z" → "26 Nov 2026"). */
export function formatInstantDay(value: string | null | undefined): string {
  const parsed = parseUtc(value);
  if (!parsed) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(parsed);
}

/** "27 Oct – 26 Nov 2026", the range a response covers, read off its UTC dates. */
export function formatRange(range: StatsRange): string {
  const from = parseUtc(range.from);
  const to = parseUtc(range.to);
  if (!from || !to) return "";
  return `${DAY.format(from)} – ${FULL_DAY.format(to)}`;
}

/**
 * The sentence that says usage only counts from when logging began, or null when the whole
 * range is covered.
 *
 * Usage comes from an append-only table that started filling with this release, so a range
 * that reaches back before its first row shows less than happened. Saying so stops a quiet
 * first month being read as nobody using Echo.
 */
export function usageTrackingNote(usage: UsageStats, range: StatsRange): string | null {
  if (usage.trackedSince === null) {
    return "Usage is counted only since tracking started, and nothing has been recorded yet.";
  }
  const since = parseUtc(usage.trackedSince);
  const from = parseUtc(range.from);
  if (!since || !from || since.getTime() <= from.getTime()) return null;
  return `Usage is counted only since tracking started on ${formatInstantDay(usage.trackedSince)}, so this range shows nothing before then.`;
}

/**
 * A reject reason's label. The stats can also carry UNSPECIFIED, for a rejection stored
 * without one, which the dialog never offers.
 */
export function statsRejectReasonLabel(reason: string): string {
  return reason === "UNSPECIFIED" ? "No reason given" : rejectReasonLabel(reason);
}

/** How a suggestion's value was reached, in a few words. */
const MERGE_STATUS_LABELS: Record<MergeStatus, string> = {
  SINGLE: "From one call",
  MERGED: "Combined across calls",
  FALLBACK: "Latest call only (combining failed)",
};

export function mergeStatusLabel(status: string): string {
  return MERGE_STATUS_LABELS[status as MergeStatus] ?? status;
}

/** Which way a stage change went, in a word. */
const DIRECTION_LABELS: Record<StageDirection, string> = {
  FORWARD: "Forward",
  BACK: "Back",
  WON: "Won",
  LOST: "Lost",
};

export function directionLabel(direction: string): string {
  return DIRECTION_LABELS[direction as StageDirection] ?? direction;
}
