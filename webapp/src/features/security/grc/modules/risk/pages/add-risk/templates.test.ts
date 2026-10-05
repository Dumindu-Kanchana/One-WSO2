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
import type { LookupOption, RiskTeam } from "../../api/riskApi";
import { buildRiskCode } from "./constants";
import {
  assignmentTeamFits,
  assignmentTeamsFor,
  hasComplianceReferences,
  missingTemplateFields,
  optionsForEdit,
  resetForRegisterChange,
  riskCodePreview,
  sameValues,
  templateInView,
  templateOf,
} from "./templates";

const empty = { platforms: [], customer: "" as const, deploymentType: "" as const, products: [], environments: [] };
const msComplete = {
  platforms: [],
  customer: 1,
  deploymentType: 2,
  products: [3],
  environments: ["PRODUCTION" as const],
};

describe("templateOf", () => {
  it("reads the register's template, defaulting to Standard until one is chosen", () => {
    expect(templateOf({ register_template: "MANAGED_SERVICES" })).toBe("MANAGED_SERVICES");
    expect(templateOf({ register_template: "AGGREGATED" })).toBe("AGGREGATED");
    expect(templateOf(undefined)).toBe("STANDARD");
    expect(templateOf(null)).toBe("STANDARD");
  });
});

describe("hasComplianceReferences", () => {
  it("is false only for Managed Services", () => {
    expect(hasComplianceReferences("STANDARD")).toBe(true);
    expect(hasComplianceReferences("AGGREGATED")).toBe(true);
    expect(hasComplianceReferences("MANAGED_SERVICES")).toBe(false);
  });
});

describe("missingTemplateFields", () => {
  it("requires nothing on a Standard register", () => {
    expect(missingTemplateFields("STANDARD", empty)).toEqual({});
  });

  it("requires at least one platform on an Aggregated register", () => {
    expect(Object.keys(missingTemplateFields("AGGREGATED", empty))).toEqual(["platforms"]);
    expect(missingTemplateFields("AGGREGATED", { ...empty, platforms: [1, 2] })).toEqual({});
  });

  it("requires all four Managed Services fields", () => {
    expect(Object.keys(missingTemplateFields("MANAGED_SERVICES", empty)).sort()).toEqual([
      "customer",
      "deploymentType",
      "environments",
      "products",
    ]);
    expect(missingTemplateFields("MANAGED_SERVICES", msComplete)).toEqual({});
  });

  it("reports only what is missing", () => {
    expect(Object.keys(missingTemplateFields("MANAGED_SERVICES", { ...msComplete, products: [] }))).toEqual([
      "products",
    ]);
  });

  it("does not demand another template's fields", () => {
    expect(missingTemplateFields("AGGREGATED", { ...empty, platforms: [1] })).toEqual({});
  });
});

describe("resetForRegisterChange", () => {
  it("always clears the template fields", () => {
    for (const t of ["STANDARD", "AGGREGATED", "MANAGED_SERVICES"] as const) {
      expect(resetForRegisterChange(t)).toMatchObject({
        platforms: [],
        customer: "",
        deploymentType: "",
        products: [],
        environments: [],
      });
    }
  });

  it("clears compliance references only when the new template drops them", () => {
    expect(resetForRegisterChange("MANAGED_SERVICES")).toHaveProperty("complianceReferences", []);
    expect(resetForRegisterChange("STANDARD")).not.toHaveProperty("complianceReferences");
    expect(resetForRegisterChange("AGGREGATED")).not.toHaveProperty("complianceReferences");
  });
});

describe("riskCodePreview", () => {
  const base = { year: 2026, quarter: "Q2", teamCode: "MS", customerCode: null, sequenceId: null };

  it("previews the original format for Standard and Aggregated registers", () => {
    expect(riskCodePreview({ ...base, teamCode: "ASG", template: "STANDARD", sequenceId: 3 })).toBe("2026-ASG-Q2-0003");
    expect(riskCodePreview({ ...base, teamCode: "WSO2CLOUD", template: "AGGREGATED", sequenceId: 1 })).toBe(
      "2026-WSO2CLOUD-Q2-0001",
    );
    expect(riskCodePreview({ ...base, teamCode: "ASG", template: "STANDARD" })).toBe("2026-ASG-Q2-####");
  });

  it("puts the customer's code in the middle for Managed Services", () => {
    expect(riskCodePreview({ ...base, template: "MANAGED_SERVICES", customerCode: "BANKONESUB", sequenceId: 3 })).toBe(
      "2026-MS-BANKONESUB-Q2-0003",
    );
  });

  it("holds a place for the customer until one is chosen", () => {
    expect(riskCodePreview({ ...base, template: "MANAGED_SERVICES" })).toBe("2026-MS-CUSTOMER-Q2-####");
  });

  it("shows the shape of the code before a register is chosen", () => {
    expect(riskCodePreview({ ...base, teamCode: null, template: "STANDARD" })).toBe("YEAR-REGISTER-QUARTER-####");
    expect(riskCodePreview({ ...base, teamCode: null, template: "MANAGED_SERVICES" })).toBe(
      "YEAR-REGISTER-CUSTOMER-QUARTER-####",
    );
  });
});

describe("buildRiskCode", () => {
  it("matches the preview, with and without a customer", () => {
    expect(buildRiskCode(2026, "ASG", "Q2", 1)).toBe("2026-ASG-Q2-0001");
    expect(buildRiskCode(2026, "MS", "Q2", 3, "BANKONESUB")).toBe("2026-MS-BANKONESUB-Q2-0003");
    expect(buildRiskCode(2026, "MS", "Q2", 3, null)).toBe("2026-MS-Q2-0003");
  });
});

describe("assignmentTeamFits / assignmentTeamsFor", () => {
  const team = (id: number, register_template: RiskTeam["register_template"]): RiskTeam => ({
    id,
    name: `Team ${id}`,
    code: null,
    description: null,
    team_type: "ASSIGNMENT",
    register_template,
    status: "ACTIVE",
  });
  const teams = [team(1, "STANDARD"), team(2, "AGGREGATED"), team(3, "MANAGED_SERVICES")];

  it("pairs Managed Services registers with Managed Services teams only", () => {
    expect(assignmentTeamFits("MANAGED_SERVICES", "MANAGED_SERVICES")).toBe(true);
    expect(assignmentTeamFits("MANAGED_SERVICES", "STANDARD")).toBe(false);
    expect(assignmentTeamFits("MANAGED_SERVICES", "AGGREGATED")).toBe(false);
    expect(assignmentTeamFits("STANDARD", "MANAGED_SERVICES")).toBe(false);
    expect(assignmentTeamFits("AGGREGATED", "MANAGED_SERVICES")).toBe(false);
    expect(assignmentTeamFits("STANDARD", "AGGREGATED")).toBe(true);
    expect(assignmentTeamFits("AGGREGATED", "STANDARD")).toBe(true);
  });

  it("filters the list per register", () => {
    expect(assignmentTeamsFor("MANAGED_SERVICES", teams).map((t) => t.id)).toEqual([3]);
    expect(assignmentTeamsFor("STANDARD", teams).map((t) => t.id)).toEqual([1, 2]);
    expect(assignmentTeamsFor("AGGREGATED", teams).map((t) => t.id)).toEqual([1, 2]);
  });

  it("always keeps the risk's current team, so the picker is never blank", () => {
    expect(assignmentTeamsFor("MANAGED_SERVICES", teams, 1).map((t) => t.id)).toEqual([1, 3]);
  });
});

describe("optionsForEdit", () => {
  const all: LookupOption[] = [
    { id: 1, name: "API Manager", status: "ACTIVE" },
    { id: 2, name: "Identity Server", status: "INACTIVE" },
    { id: 3, name: "Old Product", status: "INACTIVE" },
  ];

  it("offers active values and keeps an inactive one the risk already has, marked", () => {
    expect(optionsForEdit(all, [2])).toEqual([
      { value: 1, label: "API Manager" },
      { value: 2, label: "Identity Server (inactive)" },
    ]);
  });

  it("does not offer an inactive value the risk does not have", () => {
    expect(optionsForEdit(all, []).map((o) => o.value)).toEqual([1]);
  });
});

describe("sameValues", () => {
  it("compares as sets of values, ignoring order", () => {
    expect(sameValues([1, 2], [2, 1])).toBe(true);
    expect(sameValues(["DR", "PRODUCTION"], ["PRODUCTION", "DR"])).toBe(true);
    expect(sameValues([1], [1, 2])).toBe(false);
    expect(sameValues([1, 2], [1, 3])).toBe(false);
    expect(sameValues([], [])).toBe(true);
  });
});

describe("templateInView", () => {
  const registers = [
    { id: 1, register_template: "STANDARD" as const },
    { id: 2, register_template: "MANAGED_SERVICES" as const },
    { id: 3, register_template: "AGGREGATED" as const },
    { id: 4, register_template: "MANAGED_SERVICES" as const },
  ];

  it("shows a template's columns when the filter narrows to registers on it", () => {
    expect(templateInView([2], registers)).toBe("MANAGED_SERVICES");
    expect(templateInView([2, 4], registers)).toBe("MANAGED_SERVICES");
    expect(templateInView([3], registers)).toBe("AGGREGATED");
  });

  it("shows nothing for Standard, for no filter, or for a mix", () => {
    expect(templateInView([1], registers)).toBeNull();
    expect(templateInView([], registers)).toBeNull();
    expect(templateInView([2, 3], registers)).toBeNull();
    expect(templateInView([1, 2], registers)).toBeNull();
  });

  it("treats an unknown register as Standard", () => {
    expect(templateInView([99], registers)).toBeNull();
  });
});
