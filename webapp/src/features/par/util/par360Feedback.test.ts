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
import { canStart, leadershipFeedbackState, parFeedbackState, pickerPeople } from "./par360Feedback";

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

describe("leadershipFeedbackState", () => {
  it("is always something you can start or continue", () => {
    expect(leadershipFeedbackState(false)).toBe("open");
    expect(leadershipFeedbackState(true)).toBe("draft");
    expect(canStart("open")).toBe(true);
    expect(canStart("draft")).toBe(true);
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
