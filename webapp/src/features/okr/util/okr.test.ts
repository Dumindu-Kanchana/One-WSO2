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
import { due, testKeyResult as kr, testOkr as okr } from "../testing/fixtures";
import {
  KEY_RESULT_STATUS_COLOR,
  NO_OKR_FILTERS,
  OKR_STATE_COLOR,
  filterOkrBoards,
  filterOkrs,
  isFilteringOkrs,
  isKeyResultOverdue,
  keyResultProgress,
  okrBoards,
  okrNameOf,
  okrState,
  okrsOfPerson,
  sortOkrs,
  statusByWeek,
  statusChanges,
  todayIso,
  type OkrFilters,
} from "./okr";

describe("okrState", () => {
  it("is open, completed or closed: being overdue is for its key results", () => {
    expect(okrState(okr({ status: "COMPLETED" }))).toBe("completed");
    expect(okrState(okr({ status: "CLOSED" }))).toBe("closed");
    expect(okrState(okr({ keyResults: due("2000-01-01") }))).toBe("open");
  });
});

describe("sortOkrs", () => {
  it("puts open ones first by their soonest unfinished key result, then finished ones by their last, latest first", () => {
    const sorted = sortOkrs([
      okr({ okrId: 1, status: "COMPLETED", keyResults: due("2026-03-31") }),
      okr({ okrId: 2, keyResults: [kr({ dueDate: "2026-12-31" }), kr({ dueDate: "2026-10-31", status: "COMPLETED" })] }),
      okr({ okrId: 5, status: "CLOSED", keyResults: due("2026-01-31") }),
      okr({ okrId: 3, status: "COMPLETED", keyResults: due("2026-06-30") }),
      okr({ okrId: 6, keyResults: [] }),
      okr({ okrId: 4, keyResults: due("2026-11-30") }),
    ]);
    expect(sorted.map((o) => o.okrId)).toEqual([4, 2, 6, 3, 1, 5]);
  });
});

describe("what one person is accountable for", () => {
  const mine = okr({ okrId: 1, keyResults: [kr({ keyResultId: 1, ownerEmail: "b@example.com" })] });
  const leads = okr({
    okrId: 2,
    ownerEmail: "lead@example.com",
    keyResults: [kr({ keyResultId: 2, ownerEmail: "lead@example.com" }), kr({ keyResultId: 3 })],
  });
  const none = okr({ okrId: 3, ownerEmail: "lead@example.com", keyResults: [kr({ ownerEmail: "b@example.com" })] });

  it("is every key result of their own objectives, and only theirs on others'", () => {
    const shown = okrsOfPerson([mine, leads, none], "A@example.com");
    expect(shown.map((o) => [o.okrId, o.keyResults.map((k) => k.keyResultId)])).toEqual([
      [1, [1]],
      [2, [3]],
    ]);
  });
  it("counts key results completed and overdue, not closed objectives'", () => {
    const today = "2026-11-15";
    const progress = keyResultProgress(
      [
        okr({
          keyResults: [
            kr({ status: "COMPLETED", dueDate: "2026-10-01" }),
            kr({ status: "AT_RISK", dueDate: "2026-11-01" }),
            kr({ status: "ON_TRACK", dueDate: "2026-12-01" }),
          ],
        }),
        okr({ status: "CLOSED", keyResults: [kr({ dueDate: "2026-01-01" })] }),
      ],
      today,
    );
    expect(progress).toEqual({ completed: 1, total: 3, overdue: 1 });
  });
  it("calls a key result overdue only while its objective is open", () => {
    const late = kr({ dueDate: "2026-01-01" });
    expect(isKeyResultOverdue(late, { status: "OPEN" }, "2026-11-15")).toBe(true);
    expect(isKeyResultOverdue(late, { status: "COMPLETED" }, "2026-11-15")).toBe(false);
    expect(isKeyResultOverdue({ ...late, status: "COMPLETED" }, { status: "OPEN" }, "2026-11-15")).toBe(false);
  });
});

describe("okrNameOf", () => {
  it("names the owner and the key results' owners, and leaves anyone else an email", () => {
    const name = okrNameOf(
      okr({ ownerName: "Amal", keyResults: [kr({ ownerEmail: "b@example.com", ownerName: "Bina" })] }),
    );
    expect([name("A@example.com"), name("b@example.com"), name("c@example.com")]).toEqual([
      "Amal",
      "Bina",
      "c@example.com",
    ]);
  });
});

describe("okrBoards", () => {
  const LEAD = "lead@example.com";
  // The lead's own objective, with a key result for Zed in their team; Zed's
  // own two; and the lead's lead's, with key results for Amal (in the team)
  // and the lead's lead (not).
  const team = [
    okr({
      okrId: 1,
      ownerEmail: LEAD,
      ownerName: "Lee",
      ownerInTeam: false,
      keyResults: [
        kr({ keyResultId: 1, ownerEmail: LEAD, ownerInTeam: false }),
        kr({ keyResultId: 2, ownerEmail: "z@example.com", ownerName: "Zed", ownerInTeam: true }),
      ],
    }),
    okr({ okrId: 2, ownerEmail: "z@example.com", ownerName: "Zed", ownerLeadEmail: LEAD, ownerInTeam: true }),
    okr({
      okrId: 3,
      ownerEmail: "z@example.com",
      ownerName: "Zed",
      ownerInTeam: true,
      keyResults: due("2026-11-01", { keyResultId: 6, ownerEmail: "z@example.com", ownerInTeam: true }),
    }),
    okr({
      okrId: 4,
      ownerEmail: "boss@example.com",
      ownerName: "Bo",
      ownerInTeam: false,
      keyResults: [
        kr({ keyResultId: 4, ownerEmail: "a@example.com", ownerName: "Amal", ownerInTeam: true }),
        kr({ keyResultId: 5, ownerEmail: "boss@example.com", ownerInTeam: false }),
      ],
    }),
  ];

  it("has a board for each person in the team, not you, by name", () => {
    const boards = okrBoards(team, "Lead@example.com", "team");
    expect(boards.map((b) => [b.name, b.leadEmail])).toEqual([
      ["Amal", undefined],
      ["Zed", LEAD],
    ]);
  });
  it("puts on each what they're accountable for, others' objectives with only their key results", () => {
    const [amal, zed] = okrBoards(team, LEAD, "team");
    expect(amal.okrs.map((o) => [o.okrId, o.keyResults.map((k) => k.keyResultId)])).toEqual([[4, [4]]]);
    expect(zed.okrs.map((o) => [o.okrId, o.keyResults.map((k) => k.keyResultId)])).toEqual([
      [3, [6]],
      [1, [2]],
      [2, []],
    ]);
  });
  it("has a board for everyone but you in everyone's list", () => {
    expect(okrBoards(team, LEAD, "all").map((b) => b.name)).toEqual(["Amal", "Bo", "Zed"]);
  });
  it("finds a board by its person, keeping all their objectives, and others by what's on them", () => {
    const boards = okrBoards(team, LEAD, "team");
    const ids = (search: string) =>
      filterOkrBoards(boards, { ...NO_OKR_FILTERS, search }).map((b) => [b.name, b.okrs.length]);
    expect(ids("zed")).toEqual([["Zed", 3]]);
    expect(ids("retention")).toEqual([
      ["Amal", 1],
      ["Zed", 3],
    ]);
    expect(ids("nothing")).toEqual([]);
  });
});

describe("todayIso", () => {
  it("formats the local date", () => {
    expect(todayIso(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("filterOkrs", () => {
  const okrs = [
    okr({ okrId: 1, objective: "Grow retention", ownerName: "Ravi Kumar", keyResults: due("2026-12-31") }),
    okr({
      okrId: 2,
      objective: "Ship onboarding",
      keyResults: [kr({ title: "Docs published", ownerName: "Nadia Rahman", dueDate: "2026-06-30" })],
      status: "COMPLETED",
    }),
    okr({ okrId: 3, objective: "Publish runbooks", ownerEmail: "maya@example.com", keyResults: due("2026-11-01") }),
    okr({ okrId: 4, objective: "Old dashboard", status: "CLOSED", keyResults: due("2026-12-31") }),
  ];
  const ids = (filters: Partial<OkrFilters>) => filterOkrs(okrs, { ...NO_OKR_FILTERS, ...filters }).map((o) => o.okrId);

  it("keeps everything but closed ones with no filters", () => {
    expect(ids({})).toEqual([1, 2, 3]);
    expect(isFilteringOkrs(NO_OKR_FILTERS)).toBe(false);
  });
  it("shows closed ones on their own", () => {
    expect(ids({ status: "closed" })).toEqual([4]);
  });
  it("searches objectives, key results and their owners, not the objective's owner", () => {
    expect(ids({ search: " DOCS " })).toEqual([2]);
    expect(ids({ search: "nadia" })).toEqual([2]);
    expect(ids({ search: "ravi" })).toEqual([]);
  });
  it("filters by where each stands", () => {
    expect(ids({ status: "open" })).toEqual([1, 3]);
    expect(ids({ status: "completed" })).toEqual([2]);
  });
  it("keeps objectives with a key result due inside the range, ends included", () => {
    expect(ids({ dueFrom: "2026-11-01" })).toEqual([1, 3]);
    expect(ids({ dueTo: "2026-11-01" })).toEqual([2, 3]);
    expect(ids({ dueFrom: "2026-07-01", dueTo: "2026-11-30" })).toEqual([3]);
  });
});

describe("statusByWeek", () => {
  const now = new Date(2026, 10, 15, 12); // Sunday 15 November 2026
  const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 10).toISOString();

  it("gives each week from the one it was added the status it ended on, this week's as it is now", () => {
    const weeks = statusByWeek(
      [
        { status: "NOT_STARTED", changedBy: "a", changedOn: at(2026, 10, 21) }, // a Wednesday
        { status: "IN_PROGRESS", changedBy: "a", changedOn: at(2026, 10, 28) },
        { status: "AT_RISK", changedBy: "a", changedOn: at(2026, 10, 29) },
        { status: "ON_TRACK", changedBy: "a", changedOn: at(2026, 11, 12) },
      ],
      now,
    );
    expect(weeks).toEqual([
      { week: "2026-10-19", status: "NOT_STARTED" },
      { week: "2026-10-26", status: "AT_RISK" },
      { week: "2026-11-02", status: "AT_RISK" },
      { week: "2026-11-09", status: "ON_TRACK" },
    ]);
    expect(statusChanges(weeks)).toBe(2);
  });
  it("keeps only the latest weeks", () => {
    const weeks = statusByWeek([{ status: "NOT_STARTED", changedBy: "a", changedOn: at(2026, 1, 5) }], now, 8);
    expect(weeks).toHaveLength(8);
    expect(weeks.at(-1)?.week).toBe("2026-11-09");
    expect(statusChanges(weeks)).toBe(0);
  });
  it("has nothing to show without a history", () => {
    expect(statusByWeek([], now)).toEqual([]);
  });
});

describe("colours", () => {
  it("gives every objective state its own colour, open included", () => {
    const colours = Object.values(OKR_STATE_COLOR);
    expect(OKR_STATE_COLOR.open).toBe("info");
    expect(new Set(colours).size).toBe(colours.length);
  });
  it("gives every key result status its own colour", () => {
    const colours = Object.values(KEY_RESULT_STATUS_COLOR);
    expect(new Set(colours).size).toBe(colours.length);
  });
});
