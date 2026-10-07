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

// The wizard's form model and its conversions. Pure functions only, so every
// mapping is unit-tested without rendering anything.
//
//   saved version ──fromVersion──▶ form values ──toDraftInput──▶ save request
//                                        └──────toPreviewBody──▶ live pricing request

import type {
  Address,
  AddressInput,
  BillingFrequency,
  CategorySource,
  ContactInput,
  DealKind,
  DealType,
  DraftInput,
  DraftResponse,
  LineCategory,
  Partner,
  PricingPreview,
  TermMode,
} from "@features/sales/cado2/quotes/api/quoteTypes";
import { sumMoney } from "@features/sales/cado2/utils/money";

/** Contact: none yet, a Salesforce contact of the account, or typed in. */
export interface ContactValue {
  mode: "none" | "salesforce" | "manual";
  sfContactId: string;
  name: string;
  title: string;
  email: string;
}

/** Address as the rep sees and edits it. */
export interface AddressValue {
  sfAccountId: string;
  companyName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  taxId: string;
}

/** One line; product fields are for display and come from the price book. */
export interface LineValue {
  /** Id of the saved line this came from; keeps its stored price. */
  lineId: number | null;
  pricebookEntryId: string;
  productName: string;
  productCode: string;
  /** The product's Salesforce description; "" when it has none. */
  productDescription: string;
  /** The line's price book; "" for lines saved before it was sent. */
  pricebookId: string;
  pricebookName: string;
  unitPrice: string;
  category: LineCategory;
  /** MAPPED: set by the Admin's product mapping and locked; REP: the rep chose. */
  categorySource: CategorySource;
  unitOfMeasure: string;
  quantity: string;
  discount: string;
}

/** Multi-year lengths the AM can choose. */
export const MULTI_YEAR_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export interface DraftFormValues {
  // Step 1 — the quote's identity is fixed after the first save (UI choice 3).
  accountId: string;
  accountName: string;
  accountAddress: Address | null;
  /** From Salesforce: required to quote (approvals will route on it). "" = none. */
  accountSalesRegion: string;
  /** From Salesforce; optional. "" = none. */
  accountSubRegion: string;
  opportunityId: string;
  opportunityName: string;
  dealType: DealType | null;
  partner: Pick<Partner, "id" | "name" | "role" | "billingAddress"> | null;
  /**
   * What Salesforce's record type says the deal is, shown read-only;
   * "" before an opportunity is chosen. isRenewal follows it.
   */
  dealKind: DealKind | "";
  recordTypeName: string;
  isRenewal: boolean;
  previousOpportunityIds: string[];
  legalEntityId: string;
  currencyIsoCode: string;
  /** The quote's price book; "" until the rep chooses. New lines are priced from it by default. */
  defaultPricebookId: string;
  defaultPricebookName: string;
  /** Every quote has a start date. */
  startDate: string;
  // Step 2 — the Subscription term card; only used when a line
  // is a Subscription or Support. "" = a saved draft whose dates fit no mode.
  termMode: TermMode | "";
  /** Multi-year only. */
  termYears: string;
  /** Co-termed and Shorter term only: the end date the AM types. */
  termEndDate: string;
  /** Multi-year only; every other term is billed annually. */
  billingFrequency: BillingFrequency | "";
  /** Partner-led quotes only: the partner's commission %, "" until entered. */
  partnerCommissionPercent: string;
  lines: LineValue[];
  // Step 3
  netTermsDays: "" | "30" | "45" | "60";
  poNumber: string;
  specialTermsEnabled: boolean;
  specialTerms: string;
  governingTermsEnabled: boolean;
  governingTerms: string;
  billTo: AddressValue;
  shipTo: AddressValue;
  shipToSameAsBillTo: boolean;
  billingContact: ContactValue;
  securityContact: ContactValue;
  justification: string;
}

export const emptyContact: ContactValue = {
  mode: "none",
  sfContactId: "",
  name: "",
  title: "",
  email: "",
};

export const emptyAddress: AddressValue = {
  sfAccountId: "",
  companyName: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  stateProvince: "",
  postalCode: "",
  country: "",
  taxId: "",
};

export function emptyDraftForm(): DraftFormValues {
  return {
    accountId: "",
    accountName: "",
    accountAddress: null,
    accountSalesRegion: "",
    accountSubRegion: "",
    opportunityId: "",
    opportunityName: "",
    dealType: null,
    partner: null,
    dealKind: "",
    recordTypeName: "",
    isRenewal: false,
    previousOpportunityIds: [],
    legalEntityId: "",
    currencyIsoCode: "",
    defaultPricebookId: "",
    defaultPricebookName: "",
    startDate: "",
    termMode: "ONE_YEAR", // T1
    termYears: "2",
    termEndDate: "",
    billingFrequency: "",
    partnerCommissionPercent: "",
    lines: [],
    netTermsDays: "",
    poNumber: "",
    specialTermsEnabled: false,
    specialTerms: "",
    governingTermsEnabled: false,
    governingTerms: "",
    billTo: { ...emptyAddress },
    shipTo: { ...emptyAddress },
    shipToSameAsBillTo: false,
    billingContact: { ...emptyContact },
    securityContact: { ...emptyContact },
    justification: "",
  };
}

// ---------------------------------------------------------------------------
// Dates (local calendar dates as "YYYY-MM-DD"; never through toISOString,
// which is UTC and shifts the day near midnight)
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");

/** Formats a local Date as "YYYY-MM-DD". */
export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses "YYYY-MM-DD" as a local Date, or null. */
export function parseDateString(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return toDateString(d) === s ? d : null;
}

/**
 * End date of a term of `years` starting on `start`: the day before the
 * anniversary (1 Jan 2027 + 3 years → 31 Dec 2029). A 29 Feb start rolls to
 * 28 Feb, matching the backend's month-end clamping.
 */
export function endDateFor(start: string, years: number): string {
  const d = parseDateString(start);
  if (!d) return "";
  const anniversary = new Date(d.getFullYear() + years, d.getMonth(), 1);
  const lastDay = new Date(anniversary.getFullYear(), anniversary.getMonth() + 1, 0).getDate();
  anniversary.setDate(Math.min(d.getDate(), lastDay));
  anniversary.setDate(anniversary.getDate() - 1);
  return toDateString(anniversary);
}

// ---------------------------------------------------------------------------
// Subscription term
// ---------------------------------------------------------------------------

/** Lines with a discount above 0%; any makes the justification required. */
export const discountedLines = (lines: readonly { discount: string }[]) => lines.filter((l) => Number(l.discount) > 0).length;

/** Subscription and Support lines repeat yearly; a Professional Service doesn't. */
export const isRecurring = (category: LineCategory) => category !== "PROFESSIONAL_SERVICE";

/** Whether the quote needs a subscription term: any recurring line. */
export const hasRecurring = (lines: readonly { category: LineCategory }[]) => lines.some((l) => isRecurring(l.category));

/** Whether the AM types the end date (Co-termed, Shorter term). */
export const isShortMode = (mode: TermMode | "" | null) => mode === "CO_TERMED" || mode === "SHORTER";

/** The latest end date a Co-termed or Shorter term may have: within a year. */
export const shortTermLatestEnd = (start: string) => endDateFor(start, 1);

/** Why a typed short-term end date is not allowed, or "" when it is. */
export function shortTermProblem(start: string, end: string): string {
  if (!start || !end) return "";
  if (end < start) return "The end date must not be before the start date";
  if (end > shortTermLatestEnd(start)) return "Ends within a year of the start. For longer, choose 1 year or Multi-year";
  return "";
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

/** Splits a Salesforce street: line 1 = first line, line 2 = the rest (UI choice 2). */
export function splitStreet(street: string | null | undefined): [string, string] {
  const lines = (street ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return [lines[0] ?? "", lines.slice(1).join(", ")];
}

/** Pre-fills an address from a Salesforce account (the rep can edit it). */
export function addressFrom(sfAccountId: string, companyName: string, a: Address | null): AddressValue {
  const [line1, line2] = splitStreet(a?.street);
  return {
    ...emptyAddress,
    sfAccountId,
    companyName,
    addressLine1: line1,
    addressLine2: line2,
    city: a?.city ?? "",
    stateProvince: a?.stateProvince ?? "",
    postalCode: a?.postalCode ?? "",
    country: a?.country ?? "",
  };
}

// ---------------------------------------------------------------------------
// Saved version → form
// ---------------------------------------------------------------------------

function contactFrom(res: DraftResponse, role: "BILLING" | "SECURITY"): ContactValue {
  const c = res.version.contacts.find((x) => x.role === role);
  if (!c) return { ...emptyContact };
  return {
    mode: c.source === "SALESFORCE" ? "salesforce" : "manual",
    sfContactId: c.sfContactId ?? "",
    name: c.name,
    title: c.title ?? "",
    email: c.email ?? "",
  };
}

function addressFromView(res: DraftResponse, type: "BILL_TO" | "SHIP_TO"): AddressValue {
  const a = res.version.addresses.find((x) => x.type === type);
  if (!a) return { ...emptyAddress };
  return {
    sfAccountId: a.sfAccountId ?? "",
    companyName: a.companyName,
    addressLine1: a.addressLine1 ?? "",
    addressLine2: a.addressLine2 ?? "",
    city: a.city ?? "",
    stateProvince: a.stateProvince ?? "",
    postalCode: a.postalCode ?? "",
    country: a.country ?? "",
    taxId: a.taxId ?? "",
  };
}

/** Form values for a saved draft. */
export function fromVersion(res: DraftResponse): DraftFormValues {
  const v = res.version;
  const start = v.subscriptionStartDate ?? "";
  const end = v.subscriptionEndDate ?? "";
  const shipTo = res.version.addresses.find((a) => a.type === "SHIP_TO");
  return {
    ...emptyDraftForm(),
    accountId: res.quote.sfAccountId,
    accountName: v.accountName ?? "",
    accountSalesRegion: v.accountSalesRegion ?? "",
    accountSubRegion: v.accountSubRegion ?? "",
    opportunityId: res.quote.sfOpportunityId,
    opportunityName: v.opportunityName ?? "",
    dealType: v.dealType,
    partner: v.partner
      ? {
          id: v.partner.sfAccountId,
          name: v.partner.name,
          role: v.partner.role,
          billingAddress: null,
        }
      : null,
    dealKind: v.dealKind,
    recordTypeName: v.opportunityRecordType ?? "",
    isRenewal: v.isRenewal,
    previousOpportunityIds: v.previousOpportunities.map((p) => p.sfOpportunityId),
    legalEntityId: v.legalEntityId ? String(v.legalEntityId) : "",
    currencyIsoCode: v.currencyIsoCode ?? "",
    defaultPricebookId: v.defaultPricebook?.id ?? "",
    defaultPricebookName: v.defaultPricebook?.name ?? "",
    startDate: start,
    // A services-only draft has no mode; it gets the default if a
    // subscription is added. A draft whose dates fit no mode shows none.
    termMode: v.termMode ?? (hasRecurring(v.lines) ? "" : "ONE_YEAR"),
    termYears: String(v.termYears ?? 2),
    termEndDate: isShortMode(v.termMode) ? end : "",
    billingFrequency: v.termMode === "MULTI_YEAR" ? (v.billingFrequency ?? "") : "",
    partnerCommissionPercent: v.partnerCommissionPercent ? String(Number(v.partnerCommissionPercent)) : "",
    lines: v.lines.map((l) => ({
      lineId: l.id,
      pricebookEntryId: l.pricebookEntryId,
      productName: l.productName,
      productCode: l.productCode ?? "",
      productDescription: l.productDescription ?? "",
      pricebookId: l.pricebookId ?? "",
      pricebookName: l.pricebookName,
      unitPrice: l.unitPrice,
      category: l.category,
      categorySource: l.categorySource ?? "REP",
      unitOfMeasure: l.unitOfMeasure ?? "",
      quantity: String(l.quantity),
      discount: String(Number(l.discretionaryDiscountPercent)),
    })),
    netTermsDays: (["30", "45", "60"] as const).find((n) => String(v.netTermsDays) === n) ?? "",
    poNumber: v.poNumber ?? "",
    specialTermsEnabled: v.specialTerms.enabled,
    specialTerms: v.specialTerms.text ?? "",
    governingTermsEnabled: v.governingTerms.enabled,
    governingTerms: v.governingTerms.text ?? "",
    billTo: addressFromView(res, "BILL_TO"),
    shipTo: addressFromView(res, "SHIP_TO"),
    shipToSameAsBillTo: shipTo?.source === "SAME_AS_BILL_TO",
    billingContact: contactFrom(res, "BILLING"),
    securityContact: contactFrom(res, "SECURITY"),
    justification: v.justification ?? "",
  };
}

// ---------------------------------------------------------------------------
// Form → requests
// ---------------------------------------------------------------------------

const opt = (s: string) => (s.trim() ? s.trim() : undefined);

function contactInput(c: ContactValue): ContactInput | undefined {
  if (c.mode === "salesforce" && c.sfContactId) return { sfContactId: c.sfContactId };
  if (c.mode === "manual" && (c.name.trim() || c.email.trim())) {
    return { name: opt(c.name), email: opt(c.email), title: opt(c.title) };
  }
  return undefined;
}

function addressInput(a: AddressValue): AddressInput | undefined {
  const out: AddressInput = {
    sfAccountId: opt(a.sfAccountId),
    companyName: opt(a.companyName),
    addressLine1: opt(a.addressLine1),
    addressLine2: opt(a.addressLine2),
    city: opt(a.city),
    stateProvince: opt(a.stateProvince),
    postalCode: opt(a.postalCode),
    country: opt(a.country),
    taxId: opt(a.taxId),
  };
  return Object.values(out).some((v) => v !== undefined && v !== out.sfAccountId) ? out : undefined;
}

/**
 * The term's end date: derived for 1 year and Multi-year, typed for the
 * short modes. "" when there is no term yet, or none is needed.
 */
export function termEnd(v: Pick<DraftFormValues, "startDate" | "termMode" | "termYears" | "termEndDate">): string {
  if (!v.startDate) return "";
  switch (v.termMode) {
    case "ONE_YEAR":
      return endDateFor(v.startDate, 1);
    case "MULTI_YEAR":
      return endDateFor(v.startDate, Number(v.termYears));
    case "CO_TERMED":
    case "SHORTER":
      return v.termEndDate;
    default:
      return "";
  }
}

/** The billing frequency pricing uses: chosen for Multi-year, annual otherwise. */
export function effectiveBilling(v: Pick<DraftFormValues, "termMode" | "billingFrequency">): BillingFrequency | "" {
  return v.termMode === "MULTI_YEAR" ? v.billingFrequency : "ANNUAL";
}

// ---------------------------------------------------------------------------
// Partner commission
// ---------------------------------------------------------------------------

/** Whether the quote is partner-led, so a commission applies. */
export const isPartnerLed = (v: Pick<DraftFormValues, "dealType">) => v.dealType === "PARTNER";

/** Why a commission % is not allowed, or "" when it is: 0–100, at most 2 decimals. */
export function commissionProblem(value: string): string {
  const s = value.trim();
  if (!s) return "Enter the partner's commission (0 if none)";
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s) || Number(s) > 100) return "Use 0 to 100, with at most 2 decimals";
  return "";
}

/** The commission to send: only on a partner-led quote, and only once valid. */
function commissionInput(v: DraftFormValues): string | undefined {
  return isPartnerLed(v) && !commissionProblem(v.partnerCommissionPercent) ? v.partnerCommissionPercent.trim() : undefined;
}

/** The term fields of a request, for the modes that use them. */
function termInput(v: DraftFormValues) {
  if (!hasRecurring(v.lines) || !v.termMode) return {};
  return {
    termMode: v.termMode,
    termYears: v.termMode === "MULTI_YEAR" ? Number(v.termYears) : undefined,
    subscriptionEndDate: isShortMode(v.termMode) ? opt(v.termEndDate) : undefined,
    billingFrequency: v.termMode === "MULTI_YEAR" ? v.billingFrequency || undefined : undefined,
  };
}

/** The save request body. */
export function toDraftInput(v: DraftFormValues, expectedUpdatedAt?: string): DraftInput {
  return {
    sfOpportunityId: v.opportunityId,
    sfAccountId: v.accountId,
    expectedUpdatedAt,
    previousOpportunityIds: v.isRenewal ? v.previousOpportunityIds : [],
    legalEntityId: v.legalEntityId ? Number(v.legalEntityId) : undefined,
    currencyIsoCode: opt(v.currencyIsoCode),
    defaultPricebookId: opt(v.defaultPricebookId),
    subscriptionStartDate: opt(v.startDate),
    ...termInput(v),
    partnerCommissionPercent: isPartnerLed(v) ? opt(v.partnerCommissionPercent) : undefined,
    netTermsDays: v.netTermsDays ? Number(v.netTermsDays) : undefined,
    specialTerms: {
      enabled: v.specialTermsEnabled,
      text: v.specialTermsEnabled ? opt(v.specialTerms) : undefined,
    },
    governingTerms: {
      enabled: v.governingTermsEnabled,
      text: v.governingTermsEnabled ? opt(v.governingTerms) : undefined,
    },
    poNumber: opt(v.poNumber),
    justification: opt(v.justification),
    contacts: {
      billing: contactInput(v.billingContact),
      security: contactInput(v.securityContact),
    },
    billTo: addressInput(v.billTo),
    shipTo: v.shipToSameAsBillTo ? undefined : addressInput(v.shipTo),
    shipToSameAsBillTo: v.shipToSameAsBillTo,
    lines: v.lines.map((l) => ({
      keepSnapshotFromLineId: l.lineId ?? undefined,
      pricebookEntryId: l.pricebookEntryId,
      quantity: Number(l.quantity),
      category: l.category,
      discretionaryDiscountPercent: l.discount.trim() || "0",
      unitOfMeasure: opt(l.unitOfMeasure),
    })),
  };
}

/**
 * The live-pricing request, or null until there is enough to price: a start
 * date, a currency and at least one line — plus, when a line recurs, a valid
 * term and (for Multi-year) a billing frequency.
 */
export function toPreviewBody(v: DraftFormValues): object | null {
  if (!v.startDate || !v.currencyIsoCode || v.lines.length === 0) return null;
  const recurring = hasRecurring(v.lines);
  const end = termEnd(v);
  const billing = effectiveBilling(v);
  if (recurring && (!end || !billing || (isShortMode(v.termMode) && shortTermProblem(v.startDate, end)))) return null;
  return {
    currencyIsoCode: v.currencyIsoCode,
    subscriptionStartDate: v.startDate,
    subscriptionEndDate: recurring ? end : undefined,
    billingFrequency: recurring ? billing : "ANNUAL",
    partnerCommissionPercent: commissionInput(v),
    lines: v.lines.map((l) => ({
      pricebookEntryId: l.pricebookEntryId,
      quantity: Number(l.quantity),
      category: l.category,
      discretionaryDiscountPercent: l.discount.trim() || "0",
    })),
  };
}

// ---------------------------------------------------------------------------
// Stored pricing and submission dates
// ---------------------------------------------------------------------------

/**
 * The pricing as stored on a version, in the live preview's shape, so a
 * submitted version always shows its frozen numbers (never re-priced with
 * today's rules). Year boundaries follow the term; each year's amounts are
 * the exact sums of its line rows. Null if the version has no priced lines.
 */
export function storedPricing(res: DraftResponse): PricingPreview | null {
  const v = res.version;
  const start = v.subscriptionStartDate;
  // A services-only quote has no end date: its one "year" is the start day.
  const end = v.subscriptionEndDate ?? (hasRecurring(v.lines) ? null : start);
  if (!start || !end || v.lines.length === 0 || v.lines.some((l) => l.schedule.length === 0)) return null;
  const yearCount = Math.max(...v.lines.flatMap((l) => l.schedule.map((r) => r.yearNumber)));
  const years = [];
  for (let n = 1; n <= yearCount; n++) {
    const rows = v.lines.flatMap((l) => l.schedule.filter((r) => r.yearNumber === n));
    const yearEnd = endDateFor(start, n);
    years.push({
      yearNumber: n,
      periodStart: n === 1 ? start : dayAfter(endDateFor(start, n - 1)),
      periodEnd: yearEnd < end ? yearEnd : end,
      net: sumMoney(rows.map((r) => r.net)),
      billing: sumMoney(rows.map((r) => r.billing)),
      commission: sumMoney(rows.map((r) => r.commission ?? "0.00")),
      netBilling: sumMoney(rows.map((r) => r.netBilling ?? r.billing)),
    });
  }
  return {
    rulesVersion: v.pricingRulesVersion,
    termMonths: "",
    totals: v.totals,
    years,
    lines: v.lines.map((l) => ({
      pricebookEntryId: l.pricebookEntryId,
      annualList: l.annualList,
      annualNet: l.annualNet,
      arr: l.arr,
      tcv: l.tcv,
      commission: l.commission,
      schedule: l.schedule,
    })),
  };
}

function dayAfter(date: string): string {
  const d = parseDateString(date);
  if (!d) return "";
  d.setDate(d.getDate() + 1);
  return toDateString(d);
}

/**
 * The expiry date a submission made at `now` would get: the UTC
 * calendar day, plus the validity period. Mirrors the backend rule so
 * the submit dialog can show it beforehand.
 */
export function expiryFor(now: Date, validityDays: number): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + validityDays));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Whether a quote with this expiry date has expired, judged by the UTC day. */
export function isExpired(expiryDate: string | null, now: Date): boolean {
  return expiryDate !== null && expiryFor(now, 0) > expiryDate;
}

/** "2026-10-31" → "31 Oct 2026", as in the approved layout. */
export function formatDate(date: string | null): string {
  const d = date ? parseDateString(date) : null;
  return d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

// ---------------------------------------------------------------------------
// Issues → wizard steps
// ---------------------------------------------------------------------------

/** Wizard steps, in order. */
export const STEPS = ["Overview", "Products & Pricing", "Commercial", "Review"] as const;

/** Fields on Products & Pricing besides the lines: currency and price book, the term card, commission. */
const TERM_FIELDS = [
  "currencyIsoCode",
  "defaultPricebookId",
  "termMode",
  "termYears",
  "subscriptionEndDate",
  "billingFrequency",
  "partnerCommissionPercent",
];

const STEP_3_FIELDS = [
  "netTermsDays",
  "poNumber",
  "specialTerms",
  "governingTerms",
  "billTo",
  "shipTo",
  "contacts.billing",
  "contacts.security",
  "justification",
];

/** The step (0-based) where an issue's field lives, so the summary panel can jump there. */
export function stepOfField(field: string): number {
  if (field === "lines" || field.startsWith("lines[") || TERM_FIELDS.includes(field)) return 1;
  if (STEP_3_FIELDS.some((f) => field === f || field.startsWith(f + ".") || field.startsWith(f + "["))) return 2;
  return 0;
}
