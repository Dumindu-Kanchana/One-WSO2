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

import type { Okr } from "../api/okrTypes";
import { formatShortDate } from "./parDate";

export type OkrState = "completed" | "overdue" | "dueSoon" | "open";

/** Days before the due date an open OKR counts as due soon. */
export const OKR_DUE_SOON_DAYS = 14;

/** Today as YYYY-MM-DD in the browser's timezone. */
export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return todayIso(new Date(y, m - 1, d + days));
}

export function okrState(okr: Pick<Okr, "status" | "dueDate">, today = todayIso()): OkrState {
  if (okr.status === "COMPLETED") return "completed";
  if (okr.dueDate < today) return "overdue";
  if (okr.dueDate <= addDays(today, OKR_DUE_SOON_DAYS)) return "dueSoon";
  return "open";
}

export const OKR_STATE_LABEL: Record<OkrState, string> = {
  completed: "Completed",
  overdue: "Overdue",
  dueSoon: "Due soon",
  open: "Open",
};

export const OKR_STATE_COLOR: Record<OkrState, "success" | "error" | "warning" | "default"> = {
  completed: "success",
  overdue: "error",
  dueSoon: "warning",
  open: "default",
};

/** Open OKRs first, soonest due first; completed ones after, latest first. */
export function sortOkrs(okrs: Okr[]): Okr[] {
  return [...okrs].sort((a, b) => {
    const aDone = a.status === "COMPLETED";
    const bDone = b.status === "COMPLETED";
    if (aDone !== bDone) return aDone ? 1 : -1;
    const byDue = aDone ? b.dueDate.localeCompare(a.dueDate) : a.dueDate.localeCompare(b.dueDate);
    return byDue || a.okrId - b.okrId;
  });
}

/** The OKRs a PAR cycle looks at: due in the year up to the cycle's end, and
 * any still open. */
export function okrsForCycle(okrs: Okr[], cycleEndDate: string): Okr[] {
  const [y, m, d] = cycleEndDate.slice(0, 10).split("-").map(Number);
  const yearBefore = todayIso(new Date(y - 1, m - 1, d));
  return sortOkrs(
    okrs.filter((o) => o.status === "OPEN" || (o.dueDate > yearBefore && o.dueDate <= cycleEndDate.slice(0, 10))),
  );
}

export function okrProgress(okrs: Okr[]): { completed: number; total: number } {
  return {
    completed: okrs.filter((o) => o.status === "COMPLETED").length,
    total: okrs.length,
  };
}

export interface OkrOwnerGroup {
  ownerEmail: string;
  ownerName?: string;
  ownerLeadEmail?: string;
  okrs: Okr[];
}

/** One group per person, by name, each person's OKRs sorted. */
export function groupOkrsByOwner(okrs: Okr[]): OkrOwnerGroup[] {
  const groups = new Map<string, OkrOwnerGroup>();
  for (const okr of okrs) {
    const group = groups.get(okr.ownerEmail) ?? {
      ownerEmail: okr.ownerEmail,
      ownerName: okr.ownerName,
      ownerLeadEmail: okr.ownerLeadEmail,
      okrs: [],
    };
    group.okrs.push(okr);
    groups.set(okr.ownerEmail, group);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, okrs: sortOkrs(g.okrs) }))
    .sort((a, b) => (a.ownerName ?? a.ownerEmail).localeCompare(b.ownerName ?? b.ownerEmail));
}

/** A line for the self-review that cites the OKR and where it stands. */
export function okrCitation(okr: Okr, today = todayIso()): string {
  const state = okrState(okr, today);
  const where =
    state === "completed"
      ? "completed"
      : `${OKR_STATE_LABEL[state].toLowerCase()}, due ${formatShortDate(okr.dueDate)}`;
  return `OKR: ${okr.objective} (${where})`;
}

/** Appends a line to an answer, on a new line when there is text already. */
export function appendLine(text: string, line: string): string {
  const trimmed = text.replace(/\s+$/, "");
  return trimmed ? `${trimmed}\n${line}` : line;
}
