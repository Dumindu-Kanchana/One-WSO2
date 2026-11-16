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

import type { KeyResultStatus, Okr, OkrKeyResult, OkrStatusChange } from "../api/okrTypes";

/** Where an objective stands. Being overdue is for its key results, which
 * have the due dates; an objective is the topic they sit under. */
export type OkrState = "open" | "completed" | "closed";

/** Today as YYYY-MM-DD in the browser's timezone. */
export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function okrState(okr: Pick<Okr, "status">): OkrState {
  return okr.status === "COMPLETED" ? "completed" : okr.status === "CLOSED" ? "closed" : "open";
}

/** The soonest due date among an objective's unfinished key results, or its
 * last one's when they're all finished; "" without key results. */
export function nextDue(okr: Pick<Okr, "keyResults">): string {
  const unfinished = okr.keyResults.filter((k) => k.status !== "COMPLETED").map((k) => k.dueDate);
  return unfinished.length > 0 ? unfinished.sort()[0] : lastDue(okr);
}

/** The latest due date among an objective's key results; "" without any. */
export function lastDue(okr: Pick<Okr, "keyResults">): string {
  return okr.keyResults.map((k) => k.dueDate).sort().at(-1) ?? "";
}

export const OKR_STATE_LABEL: Record<OkrState, string> = {
  open: "Open",
  completed: "Completed",
  closed: "Closed",
};

// Every state has its own colour, open included: blue, apart from the brand's
// orange. Closed is grey: nothing more is expected of it.
export const OKR_STATE_COLOR: Record<OkrState, "success" | "info" | "default"> = {
  open: "info",
  completed: "success",
  closed: "default",
};

export const KEY_RESULT_STATUS_LABEL: Record<KeyResultStatus, string> = {
  NOT_STARTED: "Not started",
  AT_RISK: "At risk",
  IN_PROGRESS: "In progress",
  ON_TRACK: "On track",
  COMPLETED: "Completed",
};

export const KEY_RESULT_STATUS_COLOR: Record<KeyResultStatus, "success" | "error" | "warning" | "info" | "default"> = {
  NOT_STARTED: "default",
  AT_RISK: "error",
  IN_PROGRESS: "warning",
  ON_TRACK: "info",
  COMPLETED: "success",
};

/** A key result still to finish whose due date has passed, on an open objective. */
export function isKeyResultOverdue(
  keyResult: Pick<OkrKeyResult, "status" | "dueDate">,
  okr: Pick<Okr, "status">,
  today = todayIso(),
): boolean {
  return okr.status === "OPEN" && keyResult.status !== "COMPLETED" && keyResult.dueDate < today;
}

const STATUS_ORDER: Record<Okr["status"], number> = { OPEN: 0, COMPLETED: 1, CLOSED: 2 };

/** Open objectives first, by their soonest unfinished key result; then
 * completed ones and closed ones, by their last key result, latest first.
 * Objectives without key results go after the others with their status. */
export function sortOkrs(okrs: Okr[]): Okr[] {
  const byDate = (a: string, b: string, latestFirst: boolean) =>
    !a || !b ? Number(!a) - Number(!b) : latestFirst ? b.localeCompare(a) : a.localeCompare(b);
  return [...okrs].sort((a, b) => {
    if (a.status !== b.status) return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    const byDue = a.status === "OPEN" ? byDate(nextDue(a), nextDue(b), false) : byDate(lastDue(a), lastDue(b), true);
    return byDue || a.okrId - b.okrId;
  });
}

/** What one person is accountable for: the objectives they own with all their
 * key results, and, on objectives others own, only their own key results. */
export function okrsOfPerson(okrs: Okr[], email: string): Okr[] {
  const me = email.toLowerCase();
  return okrs
    .map((o) =>
      o.ownerEmail.toLowerCase() === me
        ? o
        : { ...o, keyResults: o.keyResults.filter((k) => k.ownerEmail.toLowerCase() === me) },
    )
    .filter((o) => o.ownerEmail.toLowerCase() === me || o.keyResults.length > 0);
}

/** How the key results of some objectives stand. Closed objectives don't count. */
export function keyResultProgress(okrs: Okr[], today = todayIso()): { completed: number; total: number; overdue: number } {
  const counted = okrs.filter((o) => o.status !== "CLOSED").flatMap((o) => o.keyResults.map((k) => ({ o, k })));
  return {
    completed: counted.filter(({ k }) => k.status === "COMPLETED").length,
    total: counted.length,
    overdue: counted.filter(({ o, k }) => isKeyResultOverdue(k, o, today)).length,
  };
}

/** A person's name from their email, as far as an objective knows them: its
 * owner and its key results' owners. Anyone else stays an email. */
export function okrNameOf(okr: Okr): (email: string) => string {
  const names = new Map<string, string>();
  if (okr.ownerName) names.set(okr.ownerEmail.toLowerCase(), okr.ownerName);
  for (const k of okr.keyResults) if (k.ownerName) names.set(k.ownerEmail.toLowerCase(), k.ownerName);
  return (email) => names.get(email.toLowerCase()) ?? email;
}

/** One person's board on Manage OKRs: what they're accountable for. */
export interface OkrBoard {
  email: string;
  name?: string;
  leadEmail?: string;
  okrs: Okr[];
}

/** A board for each person in a list but you: in your team's list, each one
 * marked as in your team; in everyone's, everyone. Each board holds what the
 * person is accountable for (okrsOfPerson), sorted, and the boards go by name. */
export function okrBoards(okrs: Okr[], you: string, scope: "team" | "all"): OkrBoard[] {
  const me = you.toLowerCase();
  const people = new Map<string, Omit<OkrBoard, "okrs">>();
  const add = (email: string, name: string | undefined, inTeam: boolean | undefined, leadEmail?: string) => {
    const key = email.toLowerCase();
    if (key === me || (scope === "team" && !inTeam)) return;
    const known = people.get(key);
    people.set(key, {
      email: known?.email ?? email,
      name: known?.name ?? name,
      leadEmail: known?.leadEmail ?? leadEmail,
    });
  };
  for (const o of okrs) {
    add(o.ownerEmail, o.ownerName, o.ownerInTeam, o.ownerLeadEmail);
    for (const k of o.keyResults) add(k.ownerEmail, k.ownerName, k.ownerInTeam);
  }
  return [...people.values()]
    .map((p) => ({ ...p, okrs: sortOkrs(okrsOfPerson(okrs, p.email)) }))
    .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email));
}

/** The boards that match: a board whose person matches the search keeps all
 * their objectives (still filtered by where they stand and when they're due);
 * the others keep the objectives that match. Boards left empty go. */
export function filterOkrBoards(boards: OkrBoard[], filters: OkrFilters): OkrBoard[] {
  const q = filters.search.trim().toLowerCase();
  return boards
    .map((b) => {
      const person = Boolean(q) && [b.name ?? "", b.email].some((t) => t.toLowerCase().includes(q));
      return { ...b, okrs: filterOkrs(b.okrs, person ? { ...filters, search: "" } : filters) };
    })
    .filter((b) => b.okrs.length > 0);
}

/** Where the objectives a list shows stand. "all" leaves out closed ones,
 * which show only on their own. */
export type OkrStatusFilter = "all" | "open" | "completed" | "closed";

export interface OkrFilters {
  search: string;
  status: OkrStatusFilter;
  /** A key result due on or after this day (YYYY-MM-DD); "" for no limit. */
  dueFrom: string;
  /** A key result due on or before this day (YYYY-MM-DD); "" for no limit. */
  dueTo: string;
}

export const NO_OKR_FILTERS: OkrFilters = { search: "", status: "all", dueFrom: "", dueTo: "" };

export function isFilteringOkrs(filters: OkrFilters): boolean {
  return Boolean(filters.search.trim() || filters.status !== "all" || filters.dueFrom || filters.dueTo);
}

/** The objectives that match: the text in the objective, a key result or its
 * owner's name, where they stand, and a key result due inside the range. */
export function filterOkrs(okrs: Okr[], filters: OkrFilters): Okr[] {
  const q = filters.search.trim().toLowerCase();
  return okrs.filter((o) => {
    const state = okrState(o);
    if (filters.status === "closed" ? state !== "closed" : state === "closed") return false;
    if (filters.status === "completed" && state !== "completed") return false;
    if (filters.status === "open" && state !== "open") return false;
    if (
      (filters.dueFrom || filters.dueTo) &&
      !o.keyResults.some(
        (k) => (!filters.dueFrom || k.dueDate >= filters.dueFrom) && (!filters.dueTo || k.dueDate <= filters.dueTo),
      )
    ) {
      return false;
    }
    if (!q) return true;
    const text = [o.objective, ...o.keyResults.flatMap((k) => [k.title, k.ownerName ?? ""])];
    return text.some((t) => t.toLowerCase().includes(q));
  });
}

function mondayOf(day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - ((day.getDay() + 6) % 7));
}

/** A key result's status at the end of each week (Monday to Sunday), from the
 * week it was added to this one, the latest `maxWeeks` of them. This week's is
 * its status now. */
export function statusByWeek(
  history: OkrStatusChange[],
  now = new Date(),
  maxWeeks = 26,
): { week: string; status: KeyResultStatus }[] {
  if (history.length === 0) return [];
  const changes = history.map((h) => ({ at: new Date(h.changedOn).getTime(), status: h.status }));
  const first = mondayOf(new Date(changes[0].at));
  const last = mondayOf(now);
  const weeks: { week: string; status: KeyResultStatus }[] = [];
  for (let w = first; w <= last; w = new Date(w.getFullYear(), w.getMonth(), w.getDate() + 7)) {
    const end = Math.min(new Date(w.getFullYear(), w.getMonth(), w.getDate() + 7).getTime(), now.getTime() + 1);
    const at = changes.filter((c) => c.at < end).at(-1) ?? changes[0];
    weeks.push({ week: todayIso(w), status: at.status });
  }
  return weeks.slice(-maxWeeks);
}

/** How many times the status changed across some weeks. */
export function statusChanges(weeks: { status: KeyResultStatus }[]): number {
  return weeks.filter((w, i) => i > 0 && w.status !== weeks[i - 1].status).length;
}
