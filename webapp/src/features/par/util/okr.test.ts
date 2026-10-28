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
import type { Okr } from "../api/okrTypes";
import { appendLine, groupOkrsByOwner, okrCitation, okrState, okrsForCycle, sortOkrs, todayIso } from "./okr";

const okr = (over: Partial<Okr>): Okr => ({
  okrId: 1,
  ownerEmail: "a@example.com",
  objective: "Grow enterprise retention",
  keyResults: [],
  dueDate: "2026-12-31",
  status: "OPEN",
  createdBy: "cos@example.com",
  updatedBy: "cos@example.com",
  ...over,
});

describe("okrState", () => {
  const today = "2026-10-27";
  it("is completed whatever the date", () => {
    expect(okrState(okr({ status: "COMPLETED", dueDate: "2026-01-01" }), today)).toBe("completed");
  });
  it("is overdue after the due date, due soon within two weeks, open otherwise", () => {
    expect(okrState(okr({ dueDate: "2026-10-26" }), today)).toBe("overdue");
    expect(okrState(okr({ dueDate: "2026-10-27" }), today)).toBe("dueSoon");
    expect(okrState(okr({ dueDate: "2026-11-10" }), today)).toBe("dueSoon");
    expect(okrState(okr({ dueDate: "2026-11-11" }), today)).toBe("open");
  });
});

describe("sortOkrs", () => {
  it("puts open OKRs first by due date, then completed ones latest first", () => {
    const sorted = sortOkrs([
      okr({ okrId: 1, status: "COMPLETED", dueDate: "2026-03-31" }),
      okr({ okrId: 2, dueDate: "2026-12-31" }),
      okr({ okrId: 3, status: "COMPLETED", dueDate: "2026-06-30" }),
      okr({ okrId: 4, dueDate: "2026-11-30" }),
    ]);
    expect(sorted.map((o) => o.okrId)).toEqual([4, 2, 3, 1]);
  });
});

describe("okrsForCycle", () => {
  it("keeps open OKRs and those due in the year up to the cycle's end", () => {
    const kept = okrsForCycle(
      [
        okr({ okrId: 1, status: "COMPLETED", dueDate: "2025-11-30" }),
        okr({ okrId: 2, status: "COMPLETED", dueDate: "2025-12-01" }),
        okr({ okrId: 3, status: "COMPLETED", dueDate: "2026-12-01" }),
        okr({ okrId: 4, dueDate: "2027-03-31" }),
      ],
      "2026-11-30",
    );
    expect(kept.map((o) => o.okrId)).toEqual([4, 2]);
  });
});

describe("groupOkrsByOwner", () => {
  it("groups by person, sorted by name", () => {
    const groups = groupOkrsByOwner([
      okr({ okrId: 1, ownerEmail: "z@example.com", ownerName: "Zed" }),
      okr({ okrId: 2, ownerEmail: "a@example.com", ownerName: "Amal" }),
      okr({
        okrId: 3,
        ownerEmail: "z@example.com",
        ownerName: "Zed",
        dueDate: "2026-11-01",
      }),
    ]);
    expect(groups.map((g) => g.ownerName)).toEqual(["Amal", "Zed"]);
    expect(groups[1].okrs.map((o) => o.okrId)).toEqual([3, 1]);
  });
});

describe("okrCitation and appendLine", () => {
  it("cites the objective and where it stands", () => {
    expect(okrCitation(okr({ status: "COMPLETED" }), "2026-10-27")).toBe("OKR: Grow enterprise retention (completed)");
    expect(okrCitation(okr({ dueDate: "2026-12-31" }), "2026-10-27")).toBe(
      "OKR: Grow enterprise retention (open, due 31 Dec '26)",
    );
  });
  it("adds the line on its own line", () => {
    expect(appendLine("", "x")).toBe("x");
    expect(appendLine("Shipped it.\n\n", "x")).toBe("Shipped it.\nx");
  });
});

describe("todayIso", () => {
  it("formats the local date", () => {
    expect(todayIso(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
