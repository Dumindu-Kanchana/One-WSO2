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

import { daysLeft, daysLeftLabel, deadlineEndsEverywhereAt } from "./parDeadline";
import { describe, expect, it } from "vitest";
import type { ParCycle, ParRating, Par360Reviewer, Par360ReviewRequest } from "../api/types";
import { homeSteps, nextUp, type HomeInput } from "./parHome";

const FUTURE = "2999-12-31";
const PAST = "2000-01-01";

const cycle = {
  parCycleId: 2,
  parEmployeeDeadline: FUTURE,
  parThreeSixtyRatingDeadline: FUTURE,
  parLeadDeadline: FUTURE,
  parF2FDeadline: FUTURE,
} as ParCycle;

const rating = (over: Partial<ParRating> = {}): ParRating =>
  ({
    parRatingId: 1,
    parEmployeeStatus: "PENDING",
    parLeadStatus: "PENDING",
    parF2fStatus: "PENDING",
    ...over,
  }) as ParRating;

const reviewer = (reviewStatus: Par360Reviewer["reviewStatus"], n: number): Par360Reviewer => ({
  reviewerEmail: `r${n}@x.com`,
  reviewStatus,
  isEmployeeRequested: true,
  isLeadRequested: false,
});

const input = (over: Partial<HomeInput> = {}): HomeInput => ({
  cycle,
  rating: rating(),
  reviewers: [],
  requests: [],
  ...over,
});

describe("nextUp", () => {
  it("starts with the self-review, then the draft", () => {
    expect(nextUp(input()).title).toBe("Start your self-review");
    const draft = nextUp(input({ rating: rating({ parEmployeeStatus: "DRAFT" }), selfReviewProgress: { answered: 2, total: 4 } }));
    expect(draft.title).toBe("Finish and share your self-review");
    expect(draft.body).toContain("2 of 4");
  });

  it("asks for 360° feedback until three people are asked", () => {
    const shared = rating({ parEmployeeStatus: "SHARED" });
    expect(nextUp(input({ rating: shared, reviewers: [reviewer("PENDING", 1), reviewer("REJECTED", 2)] })).title).toBe(
      "Request 360° feedback",
    );
    const asked = [1, 2, 3].map((n) => reviewer("PENDING", n));
    expect(nextUp(input({ rating: shared, reviewers: asked })).title).toBe("Your lead is reviewing");
    expect(nextUp(input({ rating: shared, reviewers: asked, leadName: "Hannah" }))).toMatchObject({
      title: "Hannah is reviewing",
      body: "Nothing for you to do right now. You'll get an email when Hannah shares your PAR.",
    });
  });

  it("puts feedback others are waiting on before waiting for the lead", () => {
    const requests: Par360ReviewRequest[] = [
      { employeeEmail: "a@x.com", employeeName: "Ann", reviewStatus: "PENDING", isEmployeeRequested: true, isLeadRequested: false },
      { employeeEmail: "b@x.com", reviewStatus: "SHARED", isEmployeeRequested: true, isLeadRequested: false },
    ];
    const reviewers = [1, 2, 3].map((n) => reviewer("SHARED", n));
    expect(nextUp(input({ rating: rating({ parEmployeeStatus: "SHARED" }), reviewers, requests })).title).toBe(
      "Ann asked for your feedback",
    );
  });

  it("counts the people waiting on you rather than naming one of several", () => {
    const requests: Par360ReviewRequest[] = ["a", "b", "c"].map((n) => ({
      employeeEmail: `${n}@x.com`,
      employeeName: n.toUpperCase(),
      reviewStatus: "PENDING",
      isEmployeeRequested: true,
      isLeadRequested: false,
    }));
    const reviewers = [1, 2, 3].map((n) => reviewer("SHARED", n));
    expect(nextUp(input({ rating: rating({ parEmployeeStatus: "SHARED" }), reviewers, requests })).title).toBe(
      "3 people asked for your feedback",
    );
  });

  it("puts your own F2F before others' requests once the lead has shared", () => {
    const requests: Par360ReviewRequest[] = [
      { employeeEmail: "a@x.com", employeeName: "Ann", reviewStatus: "DRAFT", isEmployeeRequested: true, isLeadRequested: false },
    ];
    const leadShared = rating({ parEmployeeStatus: "SHARED_BLOCKED", parLeadStatus: "SHARED" });
    expect(nextUp(input({ rating: leadShared, requests })).title).toBe("Book your face-to-face");
    expect(nextUp(input({ rating: { ...leadShared, parF2fStatus: "COMPLETED" }, requests })).title).toBe("Ann asked for your feedback");
  });

  it("moves to the F2F once the lead shares, then to the finished PAR", () => {
    const leadShared = rating({ parEmployeeStatus: "SHARED_BLOCKED", parLeadStatus: "SHARED" });
    expect(nextUp(input({ rating: leadShared })).title).toBe("Book your face-to-face");
    expect(nextUp(input({ rating: { ...leadShared, parF2fStatus: "SCHEDULED" } })).title).toBe("Your face-to-face is booked");
    expect(nextUp(input({ rating: { ...leadShared, parF2fStatus: "COMPLETED" } })).title).toBe("Your PAR is complete");
  });

  it("doesn't ask for a self-review after its deadline", () => {
    expect(nextUp(input({ cycle: { ...cycle, parEmployeeDeadline: PAST } })).title).not.toContain("self-review");
  });

  it("doesn't ask to book the F2F after its deadline", () => {
    const leadShared = rating({ parEmployeeStatus: "SHARED_BLOCKED", parLeadStatus: "SHARED" });
    const next = nextUp(input({ cycle: { ...cycle, parF2FDeadline: PAST }, rating: leadShared }));
    expect(next.title).toBe("Your PAR is complete");
  });
});

describe("how the next step reads", () => {
  it("is something to do with its deadline, someone else's move, or all done", () => {
    expect(nextUp(input())).toMatchObject({ tone: "todo", due: cycle.parEmployeeDeadline });
    const reviewing = rating({ parEmployeeStatus: "SHARED" });
    const three = [reviewer("PENDING", 1), reviewer("PENDING", 2), reviewer("PENDING", 3)];
    expect(nextUp(input({ rating: reviewing, reviewers: three }))).toMatchObject({ tone: "waiting" });
    expect(nextUp(input({ rating: reviewing, reviewers: three })).due).toBeUndefined();
    const complete = rating({ parEmployeeStatus: "SHARED", parLeadStatus: "SHARED", parF2fStatus: "COMPLETED" });
    expect(nextUp(input({ rating: complete }))).toMatchObject({ tone: "done" });
  });

  it("ends a deadline everywhere at the end of its day at UTC-12, as the backend does", () => {
    expect(deadlineEndsEverywhereAt("2026-11-10").toISOString()).toBe("2026-11-11T11:59:59.000Z");
  });

  it("says how many days are left", () => {
    const today = new Date(2026, 10, 4);
    expect(daysLeftLabel(daysLeft("2026-11-10", today))).toBe("6 days left");
    expect(daysLeftLabel(daysLeft("2026-11-05", today))).toBe("1 day left");
    expect(daysLeftLabel(daysLeft("2026-11-04", today))).toBe("Due today");
  });
});

describe("homeSteps", () => {
  it("marks the first unfinished step current and counts responses", () => {
    const steps = homeSteps(
      input({ rating: rating({ parEmployeeStatus: "SHARED" }), reviewers: [reviewer("SHARED", 1), reviewer("PENDING", 2)] }),
    );
    expect(steps.map((s) => s.state)).toEqual(["done", "current", "upcoming", "upcoming"]);
    expect(steps[1].detail).toBe("1 of 2 submitted");
  });

  it("counts 360° as done with three responses, without waiting for everyone", () => {
    const reviewers = [reviewer("SHARED", 1), reviewer("SHARED", 2), reviewer("SHARED", 3), reviewer("PENDING", 4)];
    const steps = homeSteps(input({ reviewers }));
    expect(steps[0].state).toBe("current");
    expect(steps[1].state).toBe("done");
  });
});

describe("whose move each step is", () => {
  it("is yours until you share, then waits on your lead, and the F2F opens once they share", () => {
    const steps = homeSteps(input());
    expect(steps.map((s) => s.status)).toEqual(["todo", "todo", "waiting", "locked"]);
    expect(steps[2].waitingOn).toBe("your lead");
    const leadShared = rating({ parEmployeeStatus: "SHARED", parLeadStatus: "SHARED" });
    // No 360° feedback was asked for, so that step closed without any.
    expect(homeSteps(input({ rating: leadShared })).map((s) => s.status)).toEqual(["done", "closed", "done", "todo"]);
    const f2fDone = rating({ parEmployeeStatus: "SHARED", parLeadStatus: "SHARED", parF2fStatus: "COMPLETED" });
    expect(homeSteps(input({ rating: f2fDone }))[3].status).toBe("done");
  });

  it("says enough while more 360° answers can still come in, done once everyone answered", () => {
    const three = [reviewer("SHARED", 1), reviewer("SHARED", 2), reviewer("SHARED", 3)];
    expect(homeSteps(input({ reviewers: [...three, reviewer("PENDING", 4)] }))[1].status).toBe("enough");
    expect(homeSteps(input({ reviewers: three }))[1].status).toBe("done");
    const closed = { ...cycle, parThreeSixtyRatingDeadline: PAST };
    expect(homeSteps(input({ cycle: closed, reviewers: [...three, reviewer("PENDING", 4)] }))[1].status).toBe("done");
  });

  it("says whose the lead review and face-to-face are as the cycle moves on", () => {
    const shared = homeSteps(input({ rating: rating({ parEmployeeStatus: "SHARED" }), leadName: "Hannah" }));
    expect(shared[2].detail).toBe("With Hannah");
    expect(shared[3].detail).toBe("Opens after Hannah shares");
    const leadShared = rating({ parEmployeeStatus: "SHARED", parLeadStatus: "SHARED" });
    const after = homeSteps(input({ rating: leadShared, leadName: "Hannah" }));
    expect(after[2].detail).toBe("Shared with you");
    expect(after[3].detail).toBe("You book it with Hannah");
    expect(homeSteps(input({ rating: leadShared }))[3].detail).toBe("You book it with your lead");
  });

  it("says closed when the 360° window closed without enough feedback", () => {
    const leadShared = rating({ parEmployeeStatus: "SHARED", parLeadStatus: "SHARED" });
    expect(homeSteps(input({ rating: leadShared }))[1]).toMatchObject({ status: "closed", detail: "None requested" });
    const three = [reviewer("SHARED", 1), reviewer("SHARED", 2), reviewer("SHARED", 3)];
    expect(homeSteps(input({ rating: leadShared, reviewers: three }))[1].status).toBe("done");
  });

  it("closes your own steps whose deadline passed before they were finished", () => {
    const passed = { ...cycle, parEmployeeDeadline: PAST, parF2FDeadline: PAST };
    const draft = homeSteps(input({ cycle: passed, rating: rating({ parEmployeeStatus: "DRAFT" }) }));
    expect(draft[0]).toMatchObject({ status: "closed", state: "done", detail: "Not shared by the deadline" });
    expect(draft[1].state).toBe("current");
    // The lead can review without it now.
    expect(draft[2].detail).toBe("With your lead");
    const booked = rating({ parEmployeeStatus: "SHARED", parLeadStatus: "SHARED", parF2fStatus: "SCHEDULED" });
    expect(homeSteps(input({ cycle: passed, rating: booked }))[3]).toMatchObject({
      status: "closed",
      detail: "Not marked done by the deadline",
    });
    const finished = rating({ parEmployeeStatus: "SHARED", parLeadStatus: "SHARED", parF2fStatus: "COMPLETED" });
    expect(homeSteps(input({ cycle: passed, rating: finished })).map((s) => s.status)).toEqual([
      "done",
      "closed",
      "done",
      "done",
    ]);
  });

  it("waits on reviewers once enough people are asked", () => {
    const asked = [reviewer("PENDING", 1), reviewer("PENDING", 2), reviewer("SHARED", 3)];
    const steps = homeSteps(input({ reviewers: asked }));
    expect(steps[1].status).toBe("waiting");
    expect(steps[1].waitingOn).toBe("reviewers");
    expect(homeSteps(input({ reviewers: asked.slice(0, 2) }))[1].status).toBe("todo");
  });
});

describe("a member of the leadership team", () => {
  it("counts Leadership 360° responses for the 360° step, not who they asked", () => {
    const shared = rating({ parEmployeeStatus: "SHARED" });
    const asked = [reviewer("PENDING", 1), reviewer("PENDING", 2), reviewer("PENDING", 3)];
    expect(homeSteps(input({ rating: shared, reviewers: asked, leadership: { responseCount: 2 } }))[1]).toMatchObject({
      state: "current",
      label: "360° feedback",
      detail: "Leadership 360°: 2 submitted",
    });
    expect(homeSteps(input({ rating: shared, leadership: { responseCount: 3 } }))[1].state).toBe("done");
  });

  it("is asked to ask for Leadership 360° feedback", () => {
    const next = nextUp(input({ rating: rating({ parEmployeeStatus: "SHARED" }), leadership: { responseCount: 0 } }));
    expect(next.title).toBe("Request Leadership 360° feedback");
  });
});
