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
import type { CommonOpenCategory, RepeatedCategory, RiskTeam } from "../../api/riskApi";
import {
  SPREAD_HIGH_COLOR,
  SPREAD_LOW_COLOR,
  SPREAD_MEDIUM_COLOR,
  commonOpenStats,
  groupRepeatedByRegister,
  mostRepeatedSentence,
  scopeRegisters,
  spreadColor,
} from "./categoryViews";

function team(id: number, name: string, code: string | null): RiskTeam {
  return { id, name, code, description: null, team_type: "BOTH", register_template: "STANDARD", status: "ACTIVE" };
}

function repeated(registerId: number, registerName: string, categoryId: number): RepeatedCategory {
  return {
    register_id: registerId,
    register_name: registerName,
    category_id: categoryId,
    category_name: `Category ${categoryId}`,
    open: 1,
    accept: 0,
    remediate: 0,
    closed: 1,
  };
}

function common(categoryName: string, registerIds: number[], open: number): CommonOpenCategory {
  return { category_id: 0, category_name: categoryName, register_ids: registerIds, open, accept: 0, remediate: 0, closed: 0 };
}

const teams = [team(2, "Choreo", "CHO"), team(1, "Asgardeo", "ASG"), team(3, "Legacy", null)];

describe("scopeRegisters", () => {
  it("sorts by name and labels by code, falling back to the name", () => {
    expect(scopeRegisters(teams, [])).toEqual([
      { id: 1, name: "Asgardeo", label: "ASG" },
      { id: 2, name: "Choreo", label: "CHO" },
      { id: 3, name: "Legacy", label: "Legacy" },
    ]);
  });

  it("keeps a register the payload names but the team list lacks", () => {
    expect(scopeRegisters(teams, [{ id: 9, name: "Retired" }]).map((r) => r.id)).toEqual([1, 2, 3, 9]);
  });

  it("narrows to one register under the register filter", () => {
    expect(scopeRegisters(teams, [], 2).map((r) => r.id)).toEqual([2]);
  });
});

describe("groupRepeatedByRegister", () => {
  it("gives every register a group, empty when it has no repeats", () => {
    const registers = scopeRegisters(teams, []);
    const groups = groupRepeatedByRegister(registers, [repeated(2, "Choreo", 10), repeated(2, "Choreo", 11)]);
    expect(groups.map((g) => [g.register.id, g.rows.length])).toEqual([
      [1, 0],
      [2, 2],
      [3, 0],
    ]);
  });
});

describe("mostRepeatedSentence", () => {
  const registers = scopeRegisters(teams, []);

  it("names the register with the most repeated categories", () => {
    const groups = groupRepeatedByRegister(registers, [repeated(2, "Choreo", 10), repeated(2, "Choreo", 11), repeated(1, "Asgardeo", 10)]);
    expect(mostRepeatedSentence(groups)).toBe("Choreo has the most repeated categories (2).");
  });

  it("lists every register tied at the top", () => {
    const groups = groupRepeatedByRegister(registers, [repeated(2, "Choreo", 10), repeated(1, "Asgardeo", 10)]);
    expect(mostRepeatedSentence(groups)).toBe("Asgardeo and Choreo have the most repeated categories (1 each).");
  });

  it("is omitted when nothing repeats", () => {
    expect(mostRepeatedSentence(groupRepeatedByRegister(registers, []))).toBeNull();
  });
});

describe("commonOpenStats", () => {
  const registers = scopeRegisters(teams, []);

  it("sums open, takes the first row as most pervasive, and counts registers with no overlap", () => {
    const rows = [common("WAF", [1, 2], 4), common("EOL", [1, 2], 3)];
    expect(commonOpenStats(rows, registers)).toEqual({
      totalOpen: 7,
      mostPervasive: "WAF",
      registersWithNoOverlap: 1,
    });
  });

  it("reports every register as non-overlapping when nothing is common", () => {
    expect(commonOpenStats([], registers)).toEqual({ totalOpen: 0, mostPervasive: null, registersWithNoOverlap: 3 });
  });
});

describe("spreadColor", () => {
  it("is red from 75%, orange above 25%, blue otherwise", () => {
    expect(spreadColor(6, 8)).toBe(SPREAD_HIGH_COLOR);
    expect(spreadColor(4, 8)).toBe(SPREAD_MEDIUM_COLOR);
    expect(spreadColor(3, 8)).toBe(SPREAD_MEDIUM_COLOR);
    expect(spreadColor(2, 8)).toBe(SPREAD_LOW_COLOR);
    expect(spreadColor(0, 0)).toBe(SPREAD_LOW_COLOR);
  });
});
