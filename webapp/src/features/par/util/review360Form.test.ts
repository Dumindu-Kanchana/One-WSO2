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
import { behaviourAverages, formatIndex, indexComparison, ratingLabels } from "./review360Form";

const definition: FormDefinition = {
  kind: "PEER_360",
  version: 1,
  title: "360° feedback",
  scales: { frequency: { min: 1, max: 5, labels: ["Rarely", "Sometimes", "Consistently", "Often exceeds", "Role model"] } },
  sections: [
    {
      id: "behaviours",
      title: "Behaviours",
      questions: [
        { id: "ownership", type: "RATING", text: "Ownership", scale: "frequency" },
        { id: "quality", type: "RATING", text: "Quality of work", scale: "frequency" },
      ],
    },
    { id: "comments", title: "Keep, start, stop", questions: [{ id: "keep", type: "TEXT", text: "Keep doing" }] },
  ],
};

describe("review360Form", () => {
  it("labels every rating from the template, falling back to the end labels", () => {
    expect(ratingLabels(definition.scales.frequency).map((l) => l.label)).toEqual([
      "Rarely",
      "Sometimes",
      "Consistently",
      "Often exceeds",
      "Role model",
    ]);
    expect(ratingLabels({ min: 1, max: 3, minLabel: "Low", maxLabel: "High" }).map((l) => l.label)).toEqual(["Low", "", "High"]);
  });

  it("keeps behaviours nobody rated, without an average", () => {
    const rows = behaviourAverages(definition, [{ questionId: "quality", average: 3.5, ratingCount: 2 }]);
    expect(rows.map((r) => [r.question.id, r.average, r.ratingCount])).toEqual([
      ["ownership", undefined, 0],
      ["quality", 3.5, 2],
    ]);
  });

  it("compares with the team as the numbers are shown", () => {
    expect(formatIndex(3.75)).toBe("3.8");
    expect(indexComparison(3.71, 3.75)).toBe("0.1 below the team average");
    expect(indexComparison(4.04, 3.96)).toBe("in line with the team");
    expect(indexComparison(4.2, 3.8)).toBe("0.4 above the team average");
    expect(indexComparison(undefined, 3.8)).toBeUndefined();
  });
});
