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
import type { ParCycle, ParRating, Par360Reviewer } from "../api/types";
import { homeSteps, landingStep, stepHeader, type HomeInput, type HomeStepKey } from "./parHome";

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
const asked = (n: number, submitted = 0) =>
  Array.from({ length: n }, (_, i) => reviewer(i < submitted ? "SHARED" : "PENDING", i));

const input = (over: Partial<HomeInput> = {}): HomeInput => ({ cycle, rating: rating(), reviewers: [], ...over });
const state = (i: HomeInput, key: HomeStepKey) => homeSteps(i).find((s) => s.key === key)!.state;

describe("homeSteps", () => {
  it("names the four steps in order", () => {
    expect(homeSteps(input()).map((s) => s.label)).toEqual(["Self-review", "360° feedback", "Lead review", "Face-to-face"]);
  });

  it("self-review: Not started, In progress as a draft, Completed once shared, Incomplete if the deadline passes first", () => {
    expect(state(input(), "self-review")).toBe("not-started");
    expect(state(input({ rating: rating({ parEmployeeStatus: "DRAFT" }) }), "self-review")).toBe("in-progress");
    expect(state(input({ rating: rating({ parEmployeeStatus: "SHARED" }) }), "self-review")).toBe("done");
    expect(state(input({ rating: rating({ parEmployeeStatus: "SHARED_BLOCKED" }) }), "self-review")).toBe("done");
    const missed = { cycle: { ...cycle, parEmployeeDeadline: PAST } };
    expect(state(input({ ...missed, rating: rating({ parEmployeeStatus: "DRAFT" }) }), "self-review")).toBe("incomplete");
    expect(state(input(missed), "self-review")).toBe("incomplete");
    // Shared in time, it stays Completed after the deadline.
    expect(state(input({ ...missed, rating: rating({ parEmployeeStatus: "SHARED" }) }), "self-review")).toBe("done");
  });

  it("360°: Not started until someone is asked, In progress until 3 have submitted, then Completed", () => {
    expect(state(input(), "360")).toBe("not-started");
    expect(state(input({ reviewers: asked(2) }), "360")).toBe("in-progress");
    expect(state(input({ reviewers: asked(4, 2) }), "360")).toBe("in-progress");
    expect(state(input({ reviewers: asked(4, 3) }), "360")).toBe("done");
    // Declined requests aren't asked any more.
    expect(state(input({ reviewers: [reviewer("REJECTED", 1)] }), "360")).toBe("not-started");
  });

  it("360°: counts feedback offered unasked, which the list of people asked leaves out", () => {
    expect(state(input({ reviewers: asked(2, 1), received: 3 }), "360")).toBe("done");
    expect(state(input({ reviewers: [], received: 1 }), "360")).toBe("in-progress");
    // Until the count is in, the list's own submissions count.
    expect(state(input({ reviewers: asked(3, 3) }), "360")).toBe("done");
  });

  it("360°: Incomplete when the deadline passes, or the lead shares, with fewer than 3", () => {
    const passed = { cycle: { ...cycle, parThreeSixtyRatingDeadline: PAST } };
    expect(state(input({ ...passed, reviewers: asked(3, 2) }), "360")).toBe("incomplete");
    expect(state(input({ ...passed, reviewers: asked(3, 3) }), "360")).toBe("done");
    expect(state(input({ rating: rating({ parLeadStatus: "SHARED" }), reviewers: asked(3, 2) }), "360")).toBe("incomplete");
  });

  it("360° for the leadership team counts their Leadership 360° responses until the 360° deadline", () => {
    const leader = (n: number, over: Partial<HomeInput> = {}) => input({ leadership: { responseCount: n }, ...over });
    expect(state(leader(0), "360")).toBe("not-started");
    expect(state(leader(2), "360")).toBe("in-progress");
    expect(state(leader(3), "360")).toBe("done");
    expect(state(leader(2, { cycle: { ...cycle, parThreeSixtyRatingDeadline: PAST } }), "360")).toBe("incomplete");
    // Their lead sharing early doesn't stop Leadership 360°.
    expect(state(leader(2, { rating: rating({ parLeadStatus: "SHARED" }) }), "360")).toBe("in-progress");
  });

  it("lead review: Not available yet until the lead shares, then Completed; never Incomplete", () => {
    expect(state(input({ rating: rating({ parEmployeeStatus: "SHARED" }) }), "lead-review")).toBe("not-available");
    expect(state(input({ cycle: { ...cycle, parLeadDeadline: PAST } }), "lead-review")).toBe("not-available");
    expect(state(input({ rating: rating({ parLeadStatus: "SHARED" }) }), "lead-review")).toBe("done");
  });

  it("face-to-face: Not available yet until the lead shares, then Not started, Completed, or Incomplete past its deadline", () => {
    expect(state(input(), "f2f")).toBe("not-available");
    expect(state(input({ rating: rating({ parLeadStatus: "SHARED" }) }), "f2f")).toBe("not-started");
    expect(state(input({ rating: rating({ parLeadStatus: "SHARED", parF2fStatus: "SCHEDULED" }) }), "f2f")).toBe("not-started");
    expect(state(input({ rating: rating({ parLeadStatus: "SHARED", parF2fStatus: "COMPLETED" }) }), "f2f")).toBe("done");
    const passed = { cycle: { ...cycle, parF2FDeadline: PAST } };
    expect(state(input({ ...passed, rating: rating({ parLeadStatus: "SHARED" }) }), "f2f")).toBe("incomplete");
  });
});

describe("stepHeader", () => {
  it("self-review: its due date while it's yours, nothing once shared, the deadline line when Incomplete", () => {
    expect(stepHeader(input(), "self-review")).toEqual({
      title: "Self-review",
      due: { label: "Due", date: FUTURE, countdown: true },
    });
    expect(stepHeader(input({ rating: rating({ parEmployeeStatus: "DRAFT" }) }), "self-review").title).toBe(
      "Write your self-review",
    );
    expect(stepHeader(input({ rating: rating({ parEmployeeStatus: "SHARED" }) }), "self-review")).toEqual({
      title: "Self-review shared",
    });
    expect(stepHeader(input({ cycle: { ...cycle, parEmployeeDeadline: PAST } }), "self-review")).toEqual({
      title: "Self-review not shared",
      line: "The self-review deadline passed on 1 Jan '00.",
    });
  });

  it("self-review: their department's own deadline, when it has one", () => {
    const ownDeadlineCycle = {
      ...cycle,
      parEmployeeDeadline: PAST,
      parCycleConfigurations: { departmentEmployeeDeadlines: [{ department: "FIELD OPS", deadline: "2999-06-30" }] },
    } as ParCycle;
    const fieldOps = input({ cycle: ownDeadlineCycle, rating: rating({ parDepartment: "FIELD OPS" }) });
    expect(state(fieldOps, "self-review")).toBe("not-started");
    expect(stepHeader(fieldOps, "self-review").due).toEqual({ label: "Due", date: "2999-06-30", countdown: true });
    expect(state(input({ cycle: ownDeadlineCycle, rating: rating({ parDepartment: "MARKETING" }) }), "self-review")).toBe(
      "incomplete",
    );
  });

  it("360°: Due while there's asking to do, Open until once 3 are asked, and why it's Incomplete", () => {
    expect(stepHeader(input(), "360")).toEqual({
      title: "Request 360° feedback",
      due: { label: "Due", date: FUTURE, countdown: true },
    });
    expect(stepHeader(input({ reviewers: asked(3) }), "360").due?.label).toBe("Open until");
    expect(stepHeader(input({ reviewers: asked(3, 3) }), "360")).toEqual({
      title: "360° feedback",
      due: { label: "Open until", date: FUTURE, countdown: false },
    });
    expect(
      stepHeader(input({ cycle: { ...cycle, parThreeSixtyRatingDeadline: PAST }, reviewers: asked(3, 1) }), "360"),
    ).toEqual({ title: "360° feedback incomplete", line: "The 360° deadline passed on 1 Jan '00." });
    expect(stepHeader(input({ rating: rating({ parLeadStatus: "SHARED" }), reviewers: asked(3, 1) }), "360")).toEqual({
      title: "360° feedback incomplete",
      line: "Your lead shared your PAR before the 360° deadline.",
    });
    // Only the missed-deadline job shares before the 360° deadline now: a self-review not shared by its deadline.
    expect(
      stepHeader(
        input({ rating: rating({ parLeadStatus: "SHARED", parRatingSharedBy: "SYSTEM" }), reviewers: asked(3, 1) }),
        "360",
      ),
    ).toEqual({
      title: "360° feedback incomplete",
      line: "Your PAR was rated and shared when your self-review deadline passed.",
    });
  });

  it("360° for the leadership team is Leadership 360° feedback", () => {
    expect(stepHeader(input({ leadership: { responseCount: 0 } }), "360").title).toBe("Request Leadership 360° feedback");
    expect(stepHeader(input({ leadership: { responseCount: 1 } }), "360").due?.label).toBe("Open until");
  });

  it("360° for the leadership team asks for nothing once the lead has shared, and stays open until the deadline", () => {
    expect(
      stepHeader(input({ leadership: { responseCount: 0 }, rating: rating({ parLeadStatus: "SHARED" }) }), "360"),
    ).toEqual({ title: "Leadership 360° feedback", due: { label: "Open until", date: FUTURE, countdown: false } });
  });

  it("lead review and face-to-face: the lead's date as Expected by, the face-to-face's with days left once it's yours", () => {
    expect(stepHeader(input(), "lead-review")).toEqual({
      title: "Lead review",
      due: { label: "Expected by", date: FUTURE, countdown: false },
    });
    expect(stepHeader(input({ rating: rating({ parLeadStatus: "SHARED" }) }), "lead-review")).toEqual({
      title: "Your lead review",
    });
    expect(stepHeader(input(), "f2f").due).toEqual({ label: "Due", date: FUTURE, countdown: false });
    expect(stepHeader(input({ rating: rating({ parLeadStatus: "SHARED" }) }), "f2f").due?.countdown).toBe(true);
    expect(
      stepHeader(input({ cycle: { ...cycle, parF2FDeadline: PAST }, rating: rating({ parLeadStatus: "SHARED" }) }), "f2f"),
    ).toEqual({ title: "Face-to-face not marked done", line: "The face-to-face deadline passed on 1 Jan '00." });
  });
});

describe("landingStep", () => {
  it("opens the self-review while it's yours to share", () => {
    expect(landingStep(input())).toBe("self-review");
    expect(landingStep(input({ rating: rating({ parEmployeeStatus: "DRAFT" }) }))).toBe("self-review");
  });

  it("opens 360° feedback once the self-review is shared and fewer than 3 were asked", () => {
    expect(landingStep(input({ rating: rating({ parEmployeeStatus: "SHARED" }), reviewers: asked(2) }))).toBe("360");
  });

  it("opens the lead's review once they've shared it", () => {
    const shared = rating({ parEmployeeStatus: "SHARED", parLeadStatus: "SHARED" });
    expect(landingStep(input({ rating: shared }))).toBe("lead-review");
    // Even when the self-review missed its deadline and the lead shared without it.
    const missed = rating({ parEmployeeStatus: "DRAFT", parLeadStatus: "SHARED" });
    expect(landingStep(input({ cycle: { ...cycle, parEmployeeDeadline: PAST }, rating: missed }))).toBe("lead-review");
  });

  it("opens the self-review while the lead reviews and 360° feedback needs nothing from you, never the face-to-face", () => {
    expect(landingStep(input({ rating: rating({ parEmployeeStatus: "SHARED" }), reviewers: asked(3) }))).toBe("self-review");
    const f2fOpen = rating({ parEmployeeStatus: "SHARED", parLeadStatus: "SHARED", parF2fStatus: "PENDING" });
    expect(landingStep(input({ rating: f2fOpen }))).not.toBe("f2f");
  });
});
