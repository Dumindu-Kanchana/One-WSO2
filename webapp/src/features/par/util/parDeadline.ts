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

/** Matches `YYYY-MM-DD` — the only shape the backend's own
 * @constraint:String pattern allows for a par-cycle deadline field. */
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Interpreted end-of-day in the browser's own timezone, matching par-app's
 * own deadline checks (dayjs(deadline).endOf("day")) across ParStatusView.tsx,
 * RequestFeedbackTab.tsx and ReviewProvideModal.tsx — one function so every
 * PAR screen's deadline math agrees.
 *
 * Fails CLOSED: a value that isn't a bare `YYYY-MM-DD` (or that produces an
 * invalid Date) is treated as already passed, not as never-passed. The
 * naive `new Date(non-date-only-string)` comparison used to return `false`
 * (Invalid Date compares false either way) for anything malformed — silently
 * leaving every deadline-gated control enabled. */
export function isDeadlinePassed(deadline: string): boolean {
  if (!DATE_ONLY_RE.test(deadline)) return true;
  const parsed = new Date(`${deadline}T23:59:59.999`);
  if (Number.isNaN(parsed.getTime())) return true;
  return new Date() > parsed;
}

/** When a `YYYY-MM-DD` deadline has ended in every timezone: the end of that day at UTC-12, the
 * last place to reach it. From then nobody can still meet it, which is when the backend lets a lead
 * share a PAR whose self-review was never shared. */
export function deadlineEndsEverywhereAt(deadline: string): Date {
  return new Date(`${deadline}T23:59:59-12:00`);
}

/** Whole days from today to a `YYYY-MM-DD` deadline, in the browser's timezone: 0 on the day
 * itself, negative once it has passed. */
export function daysLeft(deadline: string, today = new Date()): number {
  const [y, m, d] = deadline.split("-").map(Number);
  const due = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((due - now) / 86_400_000);
}

/** How a deadline still ahead reads next to a task: "6 days left", "1 day left", "Due today". Once
 * it has passed there's nothing left to do (the task locks), so there's no label for that. */
export function daysLeftLabel(days: number): string {
  if (days === 0) return "Due today";
  return days === 1 ? "1 day left" : `${days} days left`;
}
