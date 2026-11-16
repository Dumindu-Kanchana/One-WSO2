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

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Matches `YYYY-MM-DD` at the start of the string — the only shape the
 * backend's own par-cycle date fields carry, per DATE_ONLY_RE in
 * parDeadline.ts. */
const DATE_PREFIX_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/** Ports constant.ts's shortDateFormat ("D MMM 'YY", e.g. "17 Sep '26") —
 * used throughout the Lead Portal (CycleDatesStepper.tsx, LeadReviewPanel.tsx,
 * MultiTeamSummary.tsx's header) for every PAR cycle date, unlike the plainer
 * YYYY-MM-DD `formatDate` (@features/my/api/derive) the Employee Portal uses.
 *
 * Parsed as plain strings, not through a Date object: a bare `YYYY-MM-DD`
 * run through `new Date(...)` is midnight UTC, and reading its day back out
 * via local getters can shift it a day either way depending on the caller's
 * own timezone offset from UTC — the exact class of bug isDeadlinePassed
 * guards against elsewhere in this file's sibling. String slicing sidesteps
 * that entirely.
 */
/** A moment in the browser's own timezone, as "11 Nov '26, 5:29 pm". */
export function formatShortDateTime(value: Date): string {
  const day = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  return `${formatShortDate(day)}, ${value.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

export function formatShortDate(value: string | undefined): string {
  if (!value) return "—";
  const match = DATE_PREFIX_RE.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  const monthName = SHORT_MONTHS[Number(month) - 1];
  if (!monthName) return value;
  return `${Number(day)} ${monthName} '${year.slice(-2)}`;
}
