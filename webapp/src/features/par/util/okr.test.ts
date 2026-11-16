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

import { describe, expect, it } from "vitest";
import type { Okr, OkrKeyResult } from "@features/okr/api/okrTypes";
import { appendLine, okrCitation, okrsForCycle } from "./okr";

const ME = "a@example.com";

const kr = (over: Partial<OkrKeyResult>): OkrKeyResult => ({
  keyResultId: 1,
  ownerEmail: ME,
  title: "Gross retention at 92%",
  dueDate: "2026-12-31",
  status: "IN_PROGRESS",
  statusHistory: [],
  actions: [],
  canUpdate: true,
  ...over,
});

const okr = (over: Partial<Okr>): Okr => ({
  okrId: 1,
  ownerEmail: ME,
  objective: "Grow enterprise retention",
  keyResults: [],
  status: "OPEN",
  version: 1,
  canManage: true,
  createdBy: ME,
  createdOn: "2026-09-01T00:00:00Z",
  updatedBy: ME,
  updatedOn: "2026-09-01T00:00:00Z",
  ...over,
});

describe("okrsForCycle", () => {
  it("goes by key result: unfinished ones on an open objective, and any due in the year up to the cycle's end", () => {
    const due = (...dates: string[]) => dates.map((dueDate, i) => kr({ keyResultId: i + 1, dueDate }));
    const kept = okrsForCycle(
      [
        okr({ okrId: 1, status: "COMPLETED", keyResults: due("2025-11-30") }),
        okr({ okrId: 2, status: "COMPLETED", keyResults: due("2025-06-30", "2025-12-01") }),
        okr({ okrId: 3, status: "COMPLETED", keyResults: due("2026-12-01") }),
        okr({ okrId: 4, keyResults: due("2027-03-31") }),
        okr({ okrId: 5, status: "CLOSED", keyResults: due("2026-06-30") }),
        // The person's own objective shows in the year it was completed, key results or not.
        okr({ okrId: 6, status: "COMPLETED", statusChangedOn: "2026-03-02T10:00:00Z" }),
        okr({
          okrId: 7,
          keyResults: [
            kr({ keyResultId: 1, status: "COMPLETED", dueDate: "2024-01-01" }),
            kr({ keyResultId: 2, dueDate: "2026-12-15" }),
          ],
        }),
      ],
      ME,
      "2026-11-30",
    );
    expect(kept.map((o) => [o.okrId, o.keyResults.map((k) => k.keyResultId)])).toEqual([
      [7, [2]],
      [4, [1]],
      [2, [2]],
      [6, []],
    ]);
  });

  it("shows the person's own objectives with only their own key results under them", () => {
    const other = "team@example.com";
    const kept = okrsForCycle(
      [
        okr({ okrId: 1, keyResults: [kr({ keyResultId: 1, ownerEmail: other }), kr({ keyResultId: 2 })] }),
        // Every key result given to the team: the objective stays, with nothing under it.
        okr({ okrId: 2, keyResults: [kr({ keyResultId: 3, ownerEmail: other })] }),
        okr({ okrId: 3, status: "COMPLETED", statusChangedOn: "2025-01-10T10:00:00Z" }),
      ],
      ME,
      "2026-11-30",
    );
    expect(kept.map((o) => [o.okrId, o.keyResults.map((k) => k.keyResultId)])).toEqual([
      [1, [2]],
      [2, []],
    ]);
  });

  it("counts a completed key result in the cycle it was completed in, not the one it was due in", () => {
    const completed = (keyResultId: number, dueDate: string, on: string) =>
      kr({
        keyResultId,
        dueDate,
        status: "COMPLETED",
        statusHistory: [
          { status: "NOT_STARTED", changedBy: ME, changedOn: "2026-09-21T10:00:00Z" },
          { status: "COMPLETED", changedBy: ME, changedOn: `${on}T10:00:00Z` },
        ],
      });
    const kept = okrsForCycle(
      [
        okr({
          keyResults: [
            completed(1, "2026-12-31", "2026-11-15"), // early: due after the cycle ends
            completed(2, "2026-06-30", "2027-01-10"), // late: completed after it ends
          ],
        }),
      ],
      ME,
      "2026-12-22",
    );
    expect(kept.map((o) => o.keyResults.map((k) => k.keyResultId))).toEqual([[1]]);
  });

  it("keeps someone else's objective only for the key results that are the person's", () => {
    const theirs = okr({
      okrId: 7,
      ownerEmail: "lead@example.com",
      keyResults: [kr({ keyResultId: 1, ownerEmail: "lead@example.com" }), kr({ keyResultId: 2 })],
    });
    const notMine = okr({ okrId: 8, ownerEmail: "lead@example.com", keyResults: [kr({ ownerEmail: "x@example.com" })] });
    const kept = okrsForCycle([theirs, notMine], ME, "2026-11-30");
    expect(kept.map((o) => [o.okrId, o.keyResults.map((k) => k.keyResultId)])).toEqual([[7, [2]]]);
  });
});

describe("okrCitation and appendLine", () => {
  it("cites the person's objective and where it stands", () => {
    expect(okrCitation(okr({}))).toBe("OKR: Grow enterprise retention (open)");
    expect(okrCitation(okr({ status: "COMPLETED" }))).toBe("OKR: Grow enterprise retention (completed)");
  });
  it("cites the key result and where it stands", () => {
    expect(okrCitation(okr({}), kr({ status: "COMPLETED" }))).toBe(
      "OKR: Grow enterprise retention: Gross retention at 92% (completed)",
    );
    expect(okrCitation(okr({}), kr({ status: "AT_RISK", dueDate: "2026-12-31" }))).toBe(
      "OKR: Grow enterprise retention: Gross retention at 92% (at risk, due 31 Dec '26)",
    );
  });
  it("adds the line on its own line", () => {
    expect(appendLine("", "x")).toBe("x");
    expect(appendLine("Shipped it.\n\n", "x")).toBe("Shipped it.\nx");
  });
});
