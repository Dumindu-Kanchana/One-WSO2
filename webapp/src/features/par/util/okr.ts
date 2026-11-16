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

import type { Okr, OkrKeyResult } from "@features/okr/api/okrTypes";
import { KEY_RESULT_STATUS_LABEL, OKR_STATE_LABEL, okrState, sortOkrs, todayIso } from "@features/okr/util/okr";
import { formatShortDate } from "./parDate";

/** The OKRs a PAR cycle looks at for one person: only what's theirs. Their own
 * key results, wherever they sit: those still to finish on an open objective,
 * those completed in the year up to the cycle's end (however far off their due
 * date), and any other due in that year. Their own objectives, while open or
 * when completed in that year. Someone else's objective is only the heading
 * for the person's key results on it, and others' key results never show.
 * Closed objectives were dropped, so theirs don't count. */
export function okrsForCycle(okrs: Okr[], personEmail: string, cycleEndDate: string): Okr[] {
  const me = personEmail.toLowerCase();
  const [y, m, d] = cycleEndDate.slice(0, 10).split("-").map(Number);
  const yearBefore = todayIso(new Date(y - 1, m - 1, d));
  const inYear = (day: string) => day > yearBefore && day <= cycleEndDate.slice(0, 10);
  return sortOkrs(
    okrs
      .filter((o) => o.status !== "CLOSED")
      .map((o) => ({
        ...o,
        keyResults: o.keyResults.filter(
          (k) =>
            k.ownerEmail.toLowerCase() === me &&
            (k.status === "COMPLETED" ? inYear(completedOn(k) || k.dueDate) : o.status === "OPEN" || inYear(k.dueDate)),
        ),
      }))
      .filter(
        (o) =>
          o.keyResults.length > 0 ||
          (o.ownerEmail.toLowerCase() === me &&
            (o.status === "OPEN" || inYear(o.statusChangedOn?.slice(0, 10) ?? ""))),
      ),
  );
}

/** The day a key result was last marked completed (YYYY-MM-DD, UTC), from its
 * status history; "" when the history doesn't say. */
function completedOn(keyResult: OkrKeyResult): string {
  return keyResult.statusHistory.filter((h) => h.status === "COMPLETED").at(-1)?.changedOn.slice(0, 10) ?? "";
}

/** A line for the self-review that cites a key result, or the person's own
 * objective, and where it stands. */
export function okrCitation(okr: Okr, keyResult?: OkrKeyResult): string {
  if (!keyResult) return `OKR: ${okr.objective} (${OKR_STATE_LABEL[okrState(okr)].toLowerCase()})`;
  const where =
    keyResult.status === "COMPLETED"
      ? "completed"
      : `${KEY_RESULT_STATUS_LABEL[keyResult.status].toLowerCase()}, due ${formatShortDate(keyResult.dueDate)}`;
  return `OKR: ${okr.objective}: ${keyResult.title} (${where})`;
}

/** Appends a line to an answer, on a new line when there is text already. */
export function appendLine(text: string, line: string): string {
  const trimmed = text.replace(/\s+$/, "");
  return trimmed ? `${trimmed}\n${line}` : line;
}
