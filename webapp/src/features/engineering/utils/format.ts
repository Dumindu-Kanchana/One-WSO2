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

// The Download Stats formatters, ported from the standalone dashboard's
// utils/format.ts so both sites write the same figure the same way (ADR 0002).
// Locales are the standalone's too: "en" for figures, "en-GB" for dates, so a
// September date reads "Sept" on both sites, as ICU writes it for en-GB.

const compactFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const fullFormatter = new Intl.NumberFormat("en");

// Compact number, e.g. 1500 -> "1.5K", 2_300_000 -> "2.3M".
export function formatCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return compactFormatter.format(value);
}

// Full number with thousands separators, e.g. 1500 -> "1,500".
export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return fullFormatter.format(value);
}

// Human-readable byte size, e.g. 481689600 -> "459.4 MB".
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  const text = i === 0 ? String(value) : value.toFixed(1).replace(/\.0$/, "");
  return `${text} ${units[i]}`;
}

// Formats a YYYY-MM-DD or RFC3339 date as a short readable date (e.g. "25 Jun 2026").
// Date-only strings parse as UTC midnight, so rendering must stay in UTC too —
// otherwise viewers behind UTC would see the previous calendar day.
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Formats a month label (YYYY-MM) or a calendar date as short month and year
// (e.g. "Mar 2025"), for the Monthly tiles. In "en-US", as the standalone's
// Downloads writes it — so September is "Sep" here and "Sept" in formatDate.
export function formatMonthYear(value: string | null | undefined): string {
  if (!value) return "—";
  const iso = value.length === 7 ? `${value}-01` : value;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

// Formats an RFC3339 timestamp as a readable date-time, intentionally in the
// viewer's local time zone (these are real instants, e.g. sync job run times).
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// A Product as a reader sees it: its product name, or its repository name when
// it has none (CONTEXT.md, "Product"). Whitespace alone counts as none.
export function productLabel(productName: string | null | undefined, repoName: string): string {
  return productName && productName.trim() !== "" ? productName : repoName;
}
