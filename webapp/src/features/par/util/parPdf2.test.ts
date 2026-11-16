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
import { encodeParComment } from "./parComment";

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
    { id: "growth", title: "Growth & learning", questions: [{ id: "growth", type: "TEXT", text: "Growth & learning" }] },
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
        { id: "feedback", type: "TEXT", text: "Written feedback" },
      ],
    },
  ],
};

describe("downloadPar2Pdf", () => {
  it("writes the self-review and the anonymised PAR 360° averages, without comments or counts", () => {
    downloadPar2Pdf({
      rating: { parEmployeeEmail: "e@x.com", parRating: "Successful" } as ParRating,
      leadComment: "<p>Great cycle.</p>",
      selfReview: {
        definition: selfReviewDefinition,
        answers: { impact: "Shipped it.", growth: "Learned to plan." },
      },
      review360: {
        template: { formTemplateId: 3, formKind: "PEER_360", formVersion: 1, definition: peer360 },
        available: true,
        index: 4.13,
        questionAverages: [{ questionId: "ownership", average: 4.13 }],
      },
    });
    const text = JSON.stringify(tables.at(-1));
    expect(text).toContain("Shipped it.");
    expect(text).toContain("Learned to plan.");
    expect(text).toContain('"PAR 360° results"');
    expect(text).toContain('"4.1"');
    expect(text).not.toContain("responses");
    expect(text).not.toContain("ratings");
    expect(text).not.toContain("Written feedback");
  });

  it("adds the lead's 360° summary to the lead's feedback", () => {
    downloadPar2Pdf({
      rating: {
        parEmployeeEmail: "e@x.com",
        parLead360Summary: encodeParComment("<p>Colleagues see real ownership.</p>"),
      } as ParRating,
      leadComment: "<p>Great cycle.</p>",
      selfReview: { definition: selfReviewDefinition, answers: { impact: "Shipped it." } },
    });
    const text = JSON.stringify(tables.at(-1));
    expect(text).toContain('"360° summary"');
    expect(text).toContain("Colleagues see real ownership.");
  });

  it("has a Top 5%/20% line only for a Top 5% or Top 20%", () => {
    const head = (parSpecialRating?: string) => {
      downloadPar2Pdf({
        rating: { parEmployeeEmail: "e@x.com", parRating: "Successful", parSpecialRating } as ParRating,
        leadComment: "<p>Great cycle.</p>",
        selfReview: { definition: selfReviewDefinition, answers: {} },
      });
      return JSON.stringify((tables.at(-1) as { head: unknown }).head);
    };
    expect(head("NOT_ASSIGNED")).not.toContain("Top 5%/20%");
    expect(head(undefined)).not.toContain("Top 5%/20%");
    expect(head("TOP5P")).toContain("Top 5%/20% Rating: TOP5P");
    expect(head("NOT_ASSIGNED")).toContain("PAR Rating: Successful");
  });

  it("leaves the PAR 360° results out until the employee may see them", () => {
    downloadPar2Pdf({
      rating: { parEmployeeEmail: "e@x.com" } as ParRating,
      leadComment: "",
      selfReview: { definition: selfReviewDefinition, answers: { impact: "Shipped it." } },
      review360: {
        template: { formTemplateId: 3, formKind: "PEER_360", formVersion: 1, definition: peer360 },
        available: false,
        questionAverages: [],
      },
    });
    expect(JSON.stringify(tables.at(-1))).not.toContain("360°");
  });

  it("adds a leader's Leadership 360° results, as of a date while the survey is open", () => {
    const leadership: FormDefinition = {
      kind: "LEADERSHIP_360",
      version: 1,
      title: "Leadership 360°",
      scales: { agreement: { min: 1, max: 5 } },
      sections: [
        { id: "t", title: "Traits", questions: [{ id: "integrity", type: "RATING", text: "Shows integrity", scale: "agreement" }] },
      ],
    };
    const summary = {
      leaderEmail: "e@x.com",
      responseCount: 3,
      available: true,
      overallAverage: 4.33,
      questionAverages: [{ questionId: "integrity", average: 4.33, ratingCount: 3 }],
      comments: ["Clear direction."],
      namedComments: [{ respondentEmail: "m@x.com", respondentName: "Maya", comment: "Specific feedback." }],
    };
    const base = {
      rating: { parEmployeeEmail: "e@x.com" } as ParRating,
      leadComment: "",
      selfReview: { definition: selfReviewDefinition, answers: { impact: "Shipped it." } },
    };

    downloadPar2Pdf({ ...base, leadership360: { definition: leadership, summary, asOf: "2026-11-02" } });
    let text = JSON.stringify(tables.at(-1));
    expect(text).toContain("Leadership 360° results (3 responses, as of 2 Nov '26)");
    expect(text).toContain("4.33 (3 ratings)");
    expect(text).toContain("• Specific feedback. (Maya)");
    expect(text).toContain("• Clear direction. (Anonymous)");

    downloadPar2Pdf({ ...base, leadership360: { definition: leadership, summary } });
    text = JSON.stringify(tables.at(-1));
    expect(text).toContain("Leadership 360° results (3 responses)");

    downloadPar2Pdf({ ...base, leadership360: { definition: leadership, summary: { ...summary, available: false } } });
    expect(JSON.stringify(tables.at(-1))).not.toContain("Leadership 360°");
  });
});
