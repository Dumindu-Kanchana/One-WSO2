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
import type { FormDefinition } from "../api/leadership360Types";
import type { ParRating } from "../api/types";

const tables: unknown[] = [];
vi.mock("jspdf-autotable", () => ({ default: (_doc: unknown, options: unknown) => tables.push(options) }));
vi.mock("jspdf", () => ({
  default: class {
    save() {}
  },
}));

const { downloadPar2Pdf } = await import("./parPdf");

const selfReviewDefinition: FormDefinition = {
  kind: "SELF_REVIEW",
  version: 1,
  title: "Self-review",
  scales: {},
  sections: [
    { id: "impact", title: "Impact this cycle", questions: [{ id: "impact", type: "TEXT", text: "Impact" }] },
    {
      id: "goals",
      title: "Goals from last cycle",
      questions: [{ id: "goals", type: "GOALS", text: "Goals", options: [{ value: "ACHIEVED", label: "Achieved" }] }],
    },
  ],
};

const peer360: FormDefinition = {
  kind: "PEER_360",
  version: 1,
  title: "360° feedback",
  scales: { frequency: { min: 1, max: 5 } },
  sections: [
    {
      id: "b",
      title: "Behaviours",
      questions: [
        { id: "ownership", type: "RATING", text: "Ownership", scale: "frequency" },
        { id: "keep", type: "TEXT", text: "Keep doing" },
      ],
    },
  ],
};

describe("downloadPar2Pdf", () => {
  it("writes the self-review and the anonymised 360° summary", () => {
    downloadPar2Pdf({
      rating: { parEmployeeEmail: "e@x.com", parRating: "Successful" } as ParRating,
      leadComment: "<p>Great cycle.</p>",
      selfReview: {
        definition: selfReviewDefinition,
        answers: { impact: "Shipped it.", goals: [{ title: "Halve onboarding time", status: "ACHIEVED" }] },
      },
      review360: {
        template: { formTemplateId: 3, formKind: "PEER_360", formVersion: 1, definition: peer360 },
        responseCount: 3,
        available: true,
        index: 4.13,
        questionAverages: [{ questionId: "ownership", average: 4.13, ratingCount: 3 }],
        comments: { keep: ["Clear write-ups."] },
      },
    });
    const text = JSON.stringify(tables.at(-1));
    expect(text).toContain("Shipped it.");
    expect(text).toContain("• Halve onboarding time (Achieved)");
    expect(text).toContain("360° summary (anonymised, 3 responses)");
    expect(text).toContain("4.1 (3 ratings)");
    expect(text).toContain("• Clear write-ups.");
  });

  it("leaves the 360° summary out until the employee may see it", () => {
    downloadPar2Pdf({
      rating: { parEmployeeEmail: "e@x.com" } as ParRating,
      leadComment: "",
      selfReview: { definition: selfReviewDefinition, answers: { impact: "Shipped it." } },
      review360: {
        template: { formTemplateId: 3, formKind: "PEER_360", formVersion: 1, definition: peer360 },
        responseCount: 2,
        available: false,
        questionAverages: [],
        comments: {},
      },
    });
    expect(JSON.stringify(tables.at(-1))).not.toContain("360°");
  });
});
