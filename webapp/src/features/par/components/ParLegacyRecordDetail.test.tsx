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

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ParLegacyHistory } from "../api/types";

vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showError: vi.fn(), showSuccess: vi.fn() }),
}));

const { default: ParLegacyRecordDetail } = await import("./ParLegacyRecordDetail");

function record(cycleName: string, questionAnswers: unknown[]): ParLegacyHistory {
  return {
    legacyHeaderId: 1,
    employeeEmail: "jane@wso2.com",
    location: null,
    businessUnit: null,
    department: null,
    team: null,
    subTeam: null,
    reviewerName: "Lead One",
    reviewerEmail: null,
    cycleName,
    reviewCompletedDate: null,
    overallRating: null,
    overallSpecialRating: null,
    overallCommentEmployee: "employee comment",
    overallCommentManager: "lead comment",
    employeeScoreCode: null,
    managerScoreCode: null,
    employeeHasQuestionAnswer: true,
    questionAnswers: JSON.stringify(questionAnswers),
    feedback360: null,
  };
}

// Text of one side's panel: the widest ancestor of its heading that doesn't
// also contain the other side's heading.
function panel(heading: string, other: string): string {
  let el: HTMLElement = screen.getByText(heading);
  while (el.parentElement && !el.parentElement.textContent!.includes(other)) el = el.parentElement;
  return el.textContent!;
}

describe("ParLegacyRecordDetail promotion questions", () => {
  it.each([
    ["2017 Quarterly Review - Q1", "Revised Designation ( if recommended for promotion )"],
    ["2017 Quarterly Review - Q4", "Revised Designation ( if recommended for promotion )"],
    ["2018 Performance Evaluation - Q2", "Revised Designation ( if recommended for promotion )."],
  ])("%s: shown only on the Lead's side, admin and self view", (cycle, designation) => {
    const answers = [
      { title: "Any specific areas you want to discuss?", employeeAnswer: "Employee words", managerFeedback: "Lead words" },
      { title: "Feedback for the quarter", employeeAnswer: "Employee words", managerFeedback: "Lead words" },
      { title: "Your commitment to yourself.", employeeAnswer: "Employee words", managerFeedback: "Lead words" },
      { title: "Promotion confirmed?", employeeAnswer: "Employee typed yes", managerFeedback: "No" },
      { title: designation, employeeAnswer: "Employee typed title", managerFeedback: "Lead typed title" },
    ];
    for (const hideThreeSixtyFeedback of [false, true]) {
      const { unmount } = render(<ParLegacyRecordDetail record={record(cycle, answers)} hideThreeSixtyFeedback={hideThreeSixtyFeedback} />);
      const employee = panel("Employee's Feedback", "Lead's Feedback");
      const lead = panel("Lead's Feedback", "Employee's Feedback");
      expect(employee).toContain("Employee words");
      expect(employee).not.toMatch(/Promotion confirmed|Revised Designation|Employee typed/);
      expect(lead).toContain("Promotion confirmed?");
      expect(lead).toContain("Lead typed title");
      unmount();
    }
  });

  it("2017 Q1: the feedback question shows without its full stop and keeps its answers", () => {
    render(
      <ParLegacyRecordDetail
        record={record("2017 Quarterly Review - Q1", [
          { title: "Your feedback and observations on the quarter in review.", employeeAnswer: "Employee words", managerFeedback: "Lead words" },
        ])}
      />,
    );
    const employee = panel("Employee's Feedback", "Lead's Feedback");
    const lead = panel("Lead's Feedback", "Employee's Feedback");
    for (const [text, answer] of [
      [employee, "Employee words"],
      [lead, "Lead words"],
    ]) {
      expect(text).toContain("Your feedback and observations on the quarter in review");
      expect(text).not.toContain("quarter in review.");
      expect(text).toContain(answer);
    }
  });
});
