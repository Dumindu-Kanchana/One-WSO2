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

import type { LetterKey } from "../meddpicc/types";

/** The meeting page's tabs. */
export type MeetingTab = "summary" | "meddpicc" | "transcript";
export const MEETING_TABS: readonly MeetingTab[] = ["summary", "meddpicc", "transcript"];

/**
 * Where a meeting lives. `tab` opens it on one of its tabs (Summary when left out);
 * `letter`, with the MEDDPICC tab, marks one Letter in it, as a clicked circle does; and
 * `at` opens the recording at that second, so a quote can point at the moment it was said.
 */
export function meetingPath(
  meetingId: number,
  options: { tab?: MeetingTab; letter?: LetterKey | null; at?: number } = {},
): string {
  const params = new URLSearchParams();
  if (options.tab && options.tab !== "summary") params.set("tab", options.tab);
  if (options.tab === "meddpicc" && options.letter) params.set("letter", options.letter);
  if (options.at !== undefined && Number.isFinite(options.at) && options.at >= 0) {
    params.set("t", String(Math.floor(options.at)));
  }
  const query = params.toString();
  return `/sales/meetings/${meetingId}${query ? `?${query}` : ""}`;
}

/** The second a meeting URL asks the recording to open at (?t=), or null when it names none. */
export function startSecondOf(params: URLSearchParams): number | null {
  const raw = params.get("t");
  return raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;
}

/** Echo stats, for Sales admins. `?days=` picks the range (7, 30 or 90). */
export const ECHO_STATS_PATH = "/sales/echo-stats";

/** The deal page's tabs. */
export type DealTab = "meddpicc" | "activity" | "ask";
export const DEAL_TABS: readonly DealTab[] = ["meddpicc", "activity", "ask"];

/**
 * Where a deal lives. `letter` opens it filtered to one Letter, as a clicked circle does;
 * `tab` opens it on one of its tabs (MEDDPICC when left out). A Letter only filters the
 * MEDDPICC tab, so it is dropped on the Activity tab.
 */
export function dealPath(opportunityId: string, letter?: LetterKey | null, tab: DealTab = "meddpicc"): string {
  const params = new URLSearchParams();
  if (tab !== "meddpicc") params.set("tab", tab);
  else if (letter) params.set("letter", letter);
  const query = params.toString();
  return `/sales/deals/${encodeURIComponent(opportunityId)}${query ? `?${query}` : ""}`;
}
