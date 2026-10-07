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
import type { DealField, FieldProposal, RoleProposalValue } from "../types";
import {
  EMPTY_DRAFT,
  buildApproveRequest,
  hasSomethingToApprove,
  initialRoleMatches,
  unmatchedRoles,
} from "./approval";

function field(overrides: Partial<DealField> & Pick<DealField, "key" | "kind">): DealField {
  return {
    gate: "Qualify",
    label: overrides.key,
    letters: [],
    conversational: true,
    notInSalesforce: false,
    optional: false,
    applicable: true,
    options: [],
    salesforceValue: null,
    proposal: null,
    state: "EMPTY",
    ...overrides,
  };
}

function roleProposal(suggestedContactId: string | null): RoleProposalValue {
  return {
    name: "Grace Lim",
    title: "CFO",
    suggestedContactId,
    candidates: [
      { contactId: "003A", name: "Grace Lim-Tan", email: null, title: "CFO", score: 0.74 },
      { contactId: "003B", name: "Daniel Ong", email: null, title: null, score: 0.1 },
    ],
  };
}

const pending = (value: FieldProposal["value"]): FieldProposal => ({
  value,
  rationale: null,
  confidence: 0.8,
  evidence: [],
  pending: true,
});

const economicBuyer = field({ key: "economicBuyer", kind: "role", proposal: pending(roleProposal(null)) });
const champion = field({ key: "champion", kind: "role", proposal: pending(roleProposal("003A")) });
const decisionProcess = field({ key: "decisionProcess", kind: "multiPicklist", proposal: pending(["RFP"]) });
const paperProcess = field({ key: "paperProcess", kind: "multiPicklist", salesforceValue: ["PO Required"] });
const mapDoc = field({ key: "mapDocLink", kind: "url", conversational: false });

describe("Approve all's role rule", () => {
  it("counts a pending role with no suggested Contact as unmatched", () => {
    const fields = [economicBuyer, decisionProcess];
    const draft = { ...EMPTY_DRAFT, roleMatches: initialRoleMatches(fields) };
    expect(unmatchedRoles(fields, draft).map((f) => f.key)).toEqual(["economicBuyer"]);
  });

  it("pre-selects the suggested Contact, so a confident match needs nothing from the AM", () => {
    const fields = [champion];
    expect(initialRoleMatches(fields)).toEqual({ champion: "003A" });
    expect(unmatchedRoles(fields, { edits: {}, roleMatches: initialRoleMatches(fields) })).toEqual([]);
  });

  it("is satisfied by picking a Contact", () => {
    expect(unmatchedRoles([economicBuyer], { edits: {}, roleMatches: { economicBuyer: "003A" } })).toEqual([]);
  });

  it("is satisfied by clearing the role as not known", () => {
    expect(unmatchedRoles([economicBuyer], { edits: { economicBuyer: null }, roleMatches: {} })).toEqual([]);
  });

  it("ignores roles with no pending Proposal", () => {
    const settled = field({ key: "primaryContact", kind: "role", salesforceValue: { contactId: "003C", name: "Ann" } });
    expect(unmatchedRoles([settled], EMPTY_DRAFT)).toEqual([]);
  });
});

describe("buildApproveRequest", () => {
  const fields = [economicBuyer, champion, decisionProcess, paperProcess, mapDoc];

  it("sends nothing but the role matches when the AM changed nothing", () => {
    const request = buildApproveRequest(fields, { edits: {}, roleMatches: initialRoleMatches(fields) });
    expect(request).toEqual({ edits: {}, roleMatches: { champion: "003A" } });
  });

  it("collects edits by fieldKey, a clear as null, and a matched role as its contactId", () => {
    const request = buildApproveRequest(fields, {
      edits: { decisionProcess: ["RFP", "POC"], paperProcess: null },
      roleMatches: { champion: "003A", economicBuyer: "003B" },
    });
    expect(request).toEqual({
      edits: { decisionProcess: ["RFP", "POC"], paperProcess: null },
      roleMatches: { champion: "003A", economicBuyer: "003B" },
    });
    // null is sent, not dropped: it is how "clear this field" reaches Salesforce.
    expect(Object.prototype.hasOwnProperty.call(request.edits, "paperProcess")).toBe(true);
  });

  it("sends a cleared role as a null edit and no match alongside it", () => {
    const request = buildApproveRequest(fields, {
      edits: { economicBuyer: null },
      roleMatches: { champion: "003A", economicBuyer: "003B" },
    });
    expect(request.edits).toEqual({ economicBuyer: null });
    expect(request.roleMatches).toEqual({ champion: "003A" });
  });

  it("never sends Salesforce-only fields or keys the deal doesn't have", () => {
    const request = buildApproveRequest(fields, {
      edits: { mapDocLink: "https://x", notAField: "y" },
      roleMatches: {},
    });
    expect(request.edits).toEqual({});
  });

  it("knows when there is nothing to approve", () => {
    expect(hasSomethingToApprove([paperProcess], EMPTY_DRAFT)).toBe(false);
    expect(hasSomethingToApprove([paperProcess], { edits: { paperProcess: null }, roleMatches: {} })).toBe(true);
    expect(hasSomethingToApprove([decisionProcess], EMPTY_DRAFT)).toBe(true);
  });
});
