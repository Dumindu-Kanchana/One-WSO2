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
import type { FormDefinition } from "../api/leadership360Types";
import { sanitizeParHtml } from "./parComment";
import { htmlToPdfText } from "./parPdf";
import {
  answerHtml,
  answerOverLimit,
  answersToSave,
  answerViewHtml,
  isSectionAnswered,
  shareBlockers,
} from "./selfReviewForm";

const definition: FormDefinition = {
  kind: "SELF_REVIEW",
  version: 1,
  title: "Self-review",
  scales: {},
  sections: [
    { id: "impact", title: "Impact this cycle", questions: [{ id: "impact", type: "TEXT", text: "Impact", required: true }] },
    {
      id: "growth",
      title: "Growth & learning",
      questions: [{ id: "growth", type: "TEXT", text: "Growth & learning", required: true }],
    },
  ],
};

describe("selfReviewForm", () => {
  it("names the required sections left empty, which stop sharing", () => {
    expect(shareBlockers(definition, {})).toEqual(["Impact this cycle is empty", "Growth & learning is empty"]);
    expect(shareBlockers(definition, { impact: "Did things", growth: "  " })).toEqual(["Growth & learning is empty"]);
    expect(shareBlockers(definition, { impact: "Did things", growth: "Learned things" })).toEqual([]);
  });

  it("leaves out blank answers when saving", () => {
    expect(answersToSave(definition, { impact: "Did things", growth: "   " })).toEqual({ impact: "Did things" });
  });

  it("counts a section as answered once it has any answer", () => {
    expect(isSectionAnswered(definition.sections[1], { growth: " " })).toBe(false);
    expect(isSectionAnswered(definition.sections[1], { growth: "Learned things" })).toBe(true);
  });

  it("takes an answer the editor emptied as no answer", () => {
    expect(isSectionAnswered(definition.sections[1], { growth: "<p><br></p>" })).toBe(false);
    expect(shareBlockers(definition, { impact: "<p><strong>Did</strong> things</p>", growth: "<p><br></p>" })).toEqual([
      "Growth & learning is empty",
    ]);
    expect(answersToSave(definition, { impact: "<p>Did things</p>", growth: "<p> </p>" })).toEqual({
      impact: "<p>Did things</p>",
    });
  });

  it("gives an answer from before the editor as one paragraph per line, and the editor's own as it is", () => {
    expect(answerHtml("Shipped the port\n\nLed <the> review & demo")).toBe(
      "<p>Shipped the port</p><p>Led &lt;the&gt; review &amp; demo</p>",
    );
    expect(answerHtml("<ul><li>Shipped</li></ul>")).toBe("<ul><li>Shipped</li></ul>");
    expect(answerHtml(undefined)).toBe("");
  });

  it("shows an answer from before the editor as it was written, angle brackets and all, on screen and in the PDF", () => {
    const written = "Explained <strong>bold</strong> & more";
    const shown = document.createElement("div");
    shown.innerHTML = sanitizeParHtml(answerViewHtml(written));
    expect(shown.textContent).toBe(written);
    expect(shown.querySelector("strong")).toBeNull();
    expect(htmlToPdfText(answerViewHtml(written)).trim()).toBe(written);
    expect(answerViewHtml("<p><strong>Shipped</strong></p>")).toBe("<p><strong>Shipped</strong></p>");
  });

  it("counts how far an answer is over its limit, formatting included, and stops sharing it", () => {
    const limited: FormDefinition = {
      ...definition,
      sections: [
        { id: "impact", title: "Impact this cycle", questions: [{ id: "impact", type: "TEXT", text: "Impact", maxLength: 20 }] },
      ],
    };
    const question = limited.sections[0].questions[0];
    expect(answerOverLimit(question, { impact: "<p>Twelve chars</p>" })).toBe(0);
    expect(answerOverLimit(question, { impact: "<p><strong>Twelve chars</strong></p>" })).toBe(16);
    expect(shareBlockers(limited, { impact: "<p><strong>Twelve chars</strong></p>" })).toEqual([
      "Impact this cycle is too long",
    ]);
    // Without a limit of its own, the backend's 5,000.
    expect(answerOverLimit(definition.sections[0].questions[0], { impact: "x".repeat(5001) })).toBe(1);
  });
});
