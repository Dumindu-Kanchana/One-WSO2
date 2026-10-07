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
import { emptyDraftForm, fromVersion, type DraftFormValues } from "./draftForm";
import { nextHint, reachableStep, stepChecks } from "./stepRules";
import { fullPartnerQuote } from "@features/sales/cado2/quotes/testing/fixtures";

const complete = (): DraftFormValues => fromVersion({ ...fullPartnerQuote, version: { ...fullPartnerQuote.version, status: "DRAFT" } });

describe("stepChecks", () => {
  it("finds nothing missing on a complete quote, so Review is reachable", () => {
    const checks = stepChecks(complete());
    expect(checks).toEqual([[], [], []]);
    expect(reachableStep(checks)).toBe(3);
  });

  it("starts a new quote at Overview with everything to choose", () => {
    const [overview, products, commercial] = stepChecks(emptyDraftForm());
    expect(overview.map((c) => c.field)).toEqual([
      "sfAccountId", "sfOpportunityId", "legalEntityId", "subscriptionStartDate",
    ]);
    // The currency is chosen with the price book.
    expect(products.map((c) => c.field)).toEqual(["currencyIsoCode", "lines"]);
    expect(commercial.map((c) => c.field)).toEqual(["netTermsDays", "billTo", "shipTo", "contacts.billing"]);
    expect(reachableStep(stepChecks(emptyDraftForm()))).toBe(0);
  });

  it("blocks on Salesforce-only problems too (accepted risk)", () => {
    const v = { ...complete(), dealType: null };
    expect(stepChecks(v)[0].map((c) => c.field)).toEqual(["dealType"]);
    const noPartner = { ...complete(), partner: null };
    expect(stepChecks(noPartner)[0].map((c) => c.field)).toEqual(["partner"]);
  });

  it("stops at Overview when the account has no sales region; the sub-region is optional", () => {
    const noRegion = { ...complete(), accountSalesRegion: "" };
    expect(stepChecks(noRegion)[0].map((c) => c.field)).toEqual(["salesRegion"]);
    expect(reachableStep(stepChecks(noRegion))).toBe(0);
    expect(stepChecks({ ...complete(), accountSubRegion: "" })[0]).toEqual([]);
  });

  it("needs the ship-to address on partner deals, or when it differs from bill-to", () => {
    const direct = { ...complete(), dealType: "DIRECT" as const, shipToSameAsBillTo: true, shipTo: emptyDraftForm().shipTo };
    expect(stepChecks(direct)[2]).toEqual([]);
    expect(stepChecks({ ...direct, shipToSameAsBillTo: false })[2].map((c) => c.field)).toEqual(["shipTo"]);
    expect(stepChecks({ ...complete(), shipTo: emptyDraftForm().shipTo })[2].map((c) => c.field)).toEqual(["shipTo"]);
  });

  it("wants text for switched-on terms", () => {
    const v = { ...complete(), governingTermsEnabled: true, governingTerms: " " };
    expect(stepChecks(v)[2].map((c) => c.field)).toEqual(["governingTerms.text"]);
  });

  it("checks the subscription term on Products & Pricing", () => {
    const products = (v: Partial<DraftFormValues>) => stepChecks({ ...complete(), ...v })[1];
    expect(products({ termMode: "" }).map((c) => c.field)).toEqual(["termMode"]);
    expect(products({ termMode: "MULTI_YEAR", billingFrequency: "" }).map((c) => c.field)).toEqual(["billingFrequency"]);
    expect(products({ termMode: "ONE_YEAR", billingFrequency: "" })).toEqual([]);
    expect(products({ termMode: "SHORTER", termEndDate: "" })[0].message).toBe("Choose the end date");
    expect(products({ termMode: "CO_TERMED", termEndDate: "2027-09-30" })).toEqual([]);
    expect(products({ termMode: "CO_TERMED", termEndDate: "2027-10-01" })[0].message).toMatch(/within a year/);
  });

  it("needs the partner's commission on a partner-led quote", () => {
    const products = (v: Partial<DraftFormValues>) => stepChecks({ ...complete(), ...v })[1];
    expect(products({ partnerCommissionPercent: "" }).map((c) => c.field)).toEqual(["partnerCommissionPercent"]);
    expect(products({ partnerCommissionPercent: "120" })[0].message).toMatch(/0 to 100/);
    expect(products({ partnerCommissionPercent: "0" })).toEqual([]);
    expect(products({ dealType: "DIRECT", partnerCommissionPercent: "" })).toEqual([]);
  });

  it("needs no term for a services-only quote", () => {
    const v = complete();
    const services = { ...v, termMode: "" as const, lines: v.lines.map((l) => ({ ...l, category: "PROFESSIONAL_SERVICE" as const })) };
    expect(stepChecks(services)[1]).toEqual([]);
  });
});

describe("reachableStep and nextHint", () => {
  it("stops at the first incomplete step, counting extra problems", () => {
    expect(reachableStep([[], [], []], [0, 2, 0])).toBe(1);
    expect(reachableStep([[], [{ field: "lines", message: "x" }], []])).toBe(1);
  });

  it("says what is missing", () => {
    expect(nextHint([])).toBe("");
    expect(nextHint([{ field: "a", message: "Choose the currency" }])).toBe("Choose the currency");
    expect(nextHint([{ field: "a", message: "Choose the currency" }, { field: "b", message: "x" }, { field: "c", message: "y" }])).toBe(
      "Choose the currency (+2 more)",
    );
  });
});
