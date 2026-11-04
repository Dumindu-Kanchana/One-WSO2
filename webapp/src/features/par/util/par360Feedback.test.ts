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
import type { Par360ReviewRequest, Par360ReviewStatus } from "../api/types";
import type { Leadership360MyFeedback } from "../api/leadership360Types";
import {
  canStart,
  feedbackSource,
  giveFeedbackItems,
  parFeedbackState,
  pickableForNewFeedback,
  pickerPeople,
  waitingCount,
} from "./par360Feedback";

const request = (reviewStatus: Par360ReviewStatus): Par360ReviewRequest => ({
  employeeEmail: "ravi@example.com",
  reviewStatus,
  isEmployeeRequested: true,
  isLeadRequested: false,
});

describe("parFeedbackState", () => {
  it("offers PAR feedback to someone who didn't ask", () => {
    expect(parFeedbackState(undefined, false)).toBe("offer");
  });

  it("follows the request's status when they asked you", () => {
    expect(parFeedbackState(request("PENDING"), false)).toBe("asked");
    expect(parFeedbackState(request("DRAFT"), false)).toBe("draft");
    expect(parFeedbackState(request("SHARED"), false)).toBe("given");
    expect(parFeedbackState(request("REJECTED"), false)).toBe("declined");
  });

  it("closes after the deadline, but still shows what was given", () => {
    expect(parFeedbackState(undefined, true)).toBe("closed");
    expect(parFeedbackState(request("DRAFT"), true)).toBe("closed");
    expect(parFeedbackState(request("SHARED"), true)).toBe("given");
    expect(canStart(parFeedbackState(undefined, true))).toBe(false);
  });
});

describe("pickerPeople", () => {
  it("leaves you out and puts the people you work with first", () => {
    const people = pickerPeople({
      selfEmail: "Me@example.com",
      people: [
        { email: "me@example.com", name: "Me" },
        { email: "elena@example.com", name: "Elena", jobRole: "Director" },
        { email: "hannah@example.com", name: "Hannah" },
        { email: "alex@example.com", name: "Alex" },
      ],
      workedWith: ["HANNAH@example.com", null],
    });
    expect(people.map((p) => p.email)).toEqual(["hannah@example.com", "alex@example.com", "elena@example.com"]);
    expect(people[0].suggested).toBe(true);
    expect(people[2]).toMatchObject({ suggested: false, jobRole: "Director" });
  });
});

describe("giveFeedbackItems", () => {
  const leaders = new Set(["elena@example.com"]);
  const mine = (over: Partial<Leadership360MyFeedback> = {}): Leadership360MyFeedback => ({
    drafts: [],
    named: [],
    anonymous: [],
    currentMonth: "2026-11",
    ...over,
  });
  const items = (requests: Par360ReviewRequest[], feedback = mine(), localDraftLeaders: string[] = []) =>
    giveFeedbackItems({
      requests,
      leaderEmails: leaders,
      mine: feedback,
      localDraftLeaders,
      parDeadlinePassed: false,
      surveyOpen: true,
    });
  const elenaAsked = { ...request("PENDING"), employeeEmail: "elena@example.com" };

  it("makes a leader's request Leadership 360° feedback, anyone else's PAR", () => {
    expect(items([request("PENDING"), elenaAsked]).map((i) => [i.email, i.kind, i.state])).toEqual([
      ["ravi@example.com", "PAR", "todo"],
      ["elena@example.com", "LEADERSHIP", "todo"],
    ]);
  });

  it("answers a leader's request with feedback given in the survey, named or anonymous", () => {
    expect(items([elenaAsked], mine({ anonymous: [{ leaderEmail: "elena@example.com", month: "2026-10" }] }))[0])
      .toMatchObject({ state: "submitted", given: { anonymous: true, month: "2026-10" } });
    expect(items([{ ...elenaAsked, reviewStatus: "SHARED" }])[0].state).toBe("submitted");
  });

  it("puts waiting ones first and adds leaders you gave feedback on unasked", () => {
    const list = items(
      [{ ...request("SHARED"), employeeEmail: "sam@example.com" }, request("PENDING")],
      mine({ named: [{ leaderEmail: "hannah@example.com", submittedOn: "2026-11-02" }] }),
      ["elena@example.com"],
    );
    expect(list.map((i) => [i.email, i.state])).toEqual([
      ["ravi@example.com", "todo"],
      ["elena@example.com", "draft"],
      ["sam@example.com", "submitted"],
      ["hannah@example.com", "submitted"],
    ]);
    expect(list[1].anonymousDraft).toBe(true);
    expect(waitingCount(list)).toBe(2);
  });

  it("keeps an unanswered offer as your draft", () => {
    const [item] = items([{ ...request("PENDING"), isEmployeeRequested: false }]);
    expect(item).toMatchObject({ state: "draft", offered: true });
  });

  it("leaves people already in your list out of the picker, but not leaders you can give feedback again", () => {
    const list = items(
      [request("SHARED"), elenaAsked],
      mine({ named: [{ leaderEmail: "hannah@example.com", submittedOn: "2026-11-02" }] }),
    );
    expect(pickableForNewFeedback("ravi@example.com", list)).toBe(false);
    expect(pickableForNewFeedback("elena@example.com", list)).toBe(false);
    expect(pickableForNewFeedback("hannah@example.com", list)).toBe(true);
    expect(pickableForNewFeedback("sam@example.com", list)).toBe(true);
  });

  it("says who asked, or Voluntary when nobody did", () => {
    const asked = (employee: boolean, lead: boolean) =>
      feedbackSource({
        ...items([{ ...request("PENDING"), isEmployeeRequested: employee, isLeadRequested: lead }])[0],
        name: "Ravi Kumar (demo)",
      });
    expect(asked(true, false)).toBe("Requested by Ravi");
    expect(asked(false, true)).toBe("Requested by their lead");
    expect(asked(true, true)).toBe("Requested by Ravi and their lead");
    expect(asked(false, false)).toBe("Voluntary");
    const unasked = items([], mine({ named: [{ leaderEmail: "hannah@example.com", submittedOn: "2026-11-02" }] }))[0];
    expect(feedbackSource(unasked)).toBe("Voluntary");
  });

  it("closes a leader's open request with the survey", () => {
    const [item] = giveFeedbackItems({
      requests: [elenaAsked],
      leaderEmails: leaders,
      parDeadlinePassed: true,
      surveyOpen: false,
    });
    expect(item.state).toBe("closed");
  });
});
