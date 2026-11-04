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
