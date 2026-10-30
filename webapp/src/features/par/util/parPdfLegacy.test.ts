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

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParLegacyHistory, ParLegacyQuestionAnswer } from "../api/types";
import { downloadLegacyParPdf } from "./parPdf";

// Captures every generated document instead of downloading it. `save` is an
// instance property on jsPDF, so it's replaced in the constructor.
const docs = vi.hoisted(() => [] as { output: () => string }[]);
vi.mock("jspdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jspdf")>();
  class CapturedPdf extends actual.default {
    constructor(...args: ConstructorParameters<typeof actual.default>) {
      super(...args);
      this.save = vi.fn() as unknown as typeof this.save;
      docs.push(this);
    }
  }
  return { ...actual, default: CapturedPdf, jsPDF: CapturedPdf };
});

const baseRecord: ParLegacyHistory = {
  legacyHeaderId: 1,
  employeeEmail: "jane@example.com",
  location: null,
  businessUnit: null,
  department: "Engineering",
  team: "Platform",
  subTeam: null,
  reviewerName: "Current Lead",
  reviewerEmail: "lead@example.com",
  cycleName: "2019 Performance Evaluation - Q1",
  reviewCompletedDate: null,
  overallRating: null,
  overallSpecialRating: null,
  overallCommentEmployee: "<p>Employee overall words</p>",
  overallCommentManager: "<p>Lead overall words</p>",
  employeeScoreCode: null,
  managerScoreCode: null,
  employeeHasQuestionAnswer: true,
  questionAnswers: null,
  feedback360: JSON.stringify([
    {
      reviewerName: "Peer Reviewer",
      ratingQuestion: "What is the overall rating you would give based on your interactions?",
      reviewRating: "4",
      commentQuestion: "What are the strengths of this Individual? and what is your feedback for improvements?",
      reviewComment: "Helpful teammate",
    },
  ]),
};

const answers: ParLegacyQuestionAnswer[] = [
  {
    title: "Your Commitments & Your Feedback On The Quarter.",
    employeeAnswer: "Employee per-question words",
    managerFeedback: null,
    managerAnsweredBy: "Reviewing Lead",
  },
  { title: "Promotions", employeeAnswer: null, managerFeedback: "Lead per-question words" },
];

// The text of a rendered document. jsPDF writes text uncompressed by default,
// so each visible string appears literally in the output.
function render(record: ParLegacyHistory, questionAnswers: ParLegacyQuestionAnswer[], hide360 = false): string {
  downloadLegacyParPdf(record, questionAnswers, hide360);
  expect(docs).toHaveLength(1);
  return docs[0].output();
}

describe("downloadLegacyParPdf", () => {
  beforeEach(() => {
    docs.length = 0;
  });

  it("renders both sides' answers and Additional Comments without throwing", () => {
    const pdf = render(baseRecord, answers);
    for (const text of [
      "Employee's Feedback",
      "Lead's Feedback",
      "Employee per-question words",
      "Lead per-question words",
      "Employee Additional Comments",
      "Employee overall words",
      "Lead Additional Comments",
      "Lead overall words",
    ]) {
      expect(pdf).toContain(text);
    }
  });

  it("shows N/A for a blank overall comment instead of dropping the section", () => {
    const pdf = render({ ...baseRecord, overallCommentEmployee: null, overallCommentManager: "  " }, answers);
    expect(pdf).toContain("Employee Additional Comments");
    expect(pdf).toContain("Lead Additional Comments");
    expect(pdf).toContain("N/A");
  });

  it("takes PAR Shared By from the answer's Manager Answer By, not the current lead", () => {
    const pdf = render(baseRecord, answers);
    expect(pdf).toContain("Reviewing Lead");
    expect(pdf).not.toContain("Current Lead");
  });

  it("includes 360 feedback for an admin and leaves it out of the employee's own copy", () => {
    expect(render(baseRecord, answers)).toContain("Peer Reviewer");
    docs.length = 0;
    expect(render(baseRecord, answers, true)).not.toContain("Peer Reviewer");
  });

  it("2017 Q1: promotion questions only under Lead's Feedback; feedback title without its full stop", () => {
    const q1Answers: ParLegacyQuestionAnswer[] = [
      { title: "Your feedback and observations on the quarter in review.", employeeAnswer: "Employee words", managerFeedback: "Lead words" },
      { title: "Promotion confirmed?", employeeAnswer: "Employee typed yes", managerFeedback: "No" },
      { title: "Revised Designation ( if recommended for promotion )", employeeAnswer: "Employee typed title", managerFeedback: "N/A" },
    ];
    for (const hide360 of [false, true]) {
      docs.length = 0;
      const lines = [...render({ ...baseRecord, cycleName: "2017 Quarterly Review - Q1" }, q1Answers, hide360).matchAll(/\((.*?)\) Tj/g)].map(
        (m) => m[1],
      );
      const leadAt = lines.indexOf("Lead's Feedback");
      const employeePart = lines.slice(0, leadAt).join(" ");
      const leadPart = lines.slice(leadAt).join(" ");
      expect(leadAt).toBeGreaterThan(0);
      expect(employeePart).not.toMatch(/Promotion confirmed|Revised Designation|Employee typed/);
      expect(employeePart).toContain("Employee words");
      expect(leadPart).toContain("Promotion confirmed?");
      expect(leadPart).toContain("Revised Designation");
      expect(lines.join(" ")).toMatch(/quarter in\s+review(?!\.)/);
      expect(lines.join(" ")).not.toMatch(/quarter in\s+review\./);
    }
  });
});
