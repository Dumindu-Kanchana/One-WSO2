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
import { answersToSave, isSectionAnswered, shareBlockers } from "./selfReviewForm";

const definition: FormDefinition = {
  kind: "SELF_REVIEW",
  version: 1,
  title: "Self-review",
  scales: {},
  sections: [
    { id: "impact", title: "Impact this cycle", questions: [{ id: "impact", type: "TEXT", text: "Impact", required: true }] },
    {
      id: "goals",
      title: "Goals from last cycle",
      questions: [
        {
          id: "goals",
          type: "GOALS",
          text: "Goals",
          options: [
            { value: "ACHIEVED", label: "Achieved" },
            { value: "NOT_ACHIEVED", label: "Not achieved" },
          ],
        },
      ],
    },
    { id: "support", title: "Support you need", questions: [{ id: "support", type: "TEXT", text: "Support" }] },
  ],
};

describe("selfReviewForm", () => {
  it("names what stops sharing: empty required sections and goals without a status", () => {
    expect(shareBlockers(definition, {})).toEqual(["Impact this cycle is empty"]);
    expect(shareBlockers(definition, { impact: "Did things", goals: [{ title: "Ship it", status: null }] })).toEqual([
      "Goals from last cycle: pick a status for each goal",
    ]);
    expect(shareBlockers(definition, { impact: "Did things", goals: [{ title: "Ship it", status: "ACHIEVED" }] })).toEqual(
      [],
    );
  });

  it("leaves out blank answers and untitled goal rows when saving", () => {
    expect(
      answersToSave(definition, {
        impact: "Did things",
        support: "   ",
        goals: [
          { title: "Ship it", status: "ACHIEVED" },
          { title: "", status: null },
        ],
      }),
    ).toEqual({ impact: "Did things", goals: [{ title: "Ship it", status: "ACHIEVED" }] });
  });

  it("counts a section as answered once it has any answer", () => {
    expect(isSectionAnswered(definition.sections[1], { goals: [{ title: "", status: null }] })).toBe(false);
    expect(isSectionAnswered(definition.sections[1], { goals: [{ title: "Ship it", status: null }] })).toBe(true);
  });
});
