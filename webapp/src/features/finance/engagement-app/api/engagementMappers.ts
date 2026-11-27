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

// Wire (openapi.yaml) → view model.

import * as DM from "./dashboardMappers";
import type * as V from "./engagementTypes";
import type * as W from "./engagementWire";
import { SEARCH_KINDS } from "./engagementTypes";
import { ALLOCATION_STATUSES, ENGAGEMENT_STATUSES, REQUEST_STATUSES, TRAVEL_STATUSES } from "../model/statuses";

const norm = (x: string) => x.replace(/[\s_-]+/g, "").toLowerCase();
/** The legacy spelling of a status the backend may send in another case ("ACTIVE", "in progress"). */
function canon<T extends string>(value: string | null | undefined, known: readonly T[]): T {
  const v = value ?? "";
  return known.find((k) => norm(k) === norm(v)) ?? (v as T);
}
/** Legacy addresses carry "BR()" for line breaks. */
const addr = (x: string | null | undefined): string | undefined => {
  const v = (x ?? "").replace(/BR\(\)/g, "\n").replace(/\n\s*\n+/g, "\n").replace(/^[\s,]+|[\s,]+$/g, "");
  return v || undefined;
};
const RECORD_STATUSES = ["Active", "Inactive", "Expired"] as const;
const INVOICE_STATUSES = ["Pending", "Accepted by travel", "Accepted by finance", "Complete", "Rejected by travel", "Rejected by finance"] as const;
const PAYMENT_STATUSES = ["Pending", "Complete"] as const;

const s = (x: string | null | undefined): string => x ?? "";
const opt = (x: string | null | undefined): string | undefined => (x === null || x === undefined || x === "" ? undefined : x);

export const person = (p: W.WPerson | undefined | null): V.Person => ({ email: p?.email ?? "", name: p?.name || p?.email || "" });
const maybePerson = (p: W.WPerson | undefined | null): V.Person | undefined => (p ? person(p) : undefined);

const campaign = (c: W.WCampaignRef | undefined): V.Campaign | undefined => (c ? { id: c.id, name: c.name ?? c.id } : undefined);

export function page<W1, V1>(p: W.WPage<W1>, map: (x: W1) => V1): V.Page<V1> {
  return { items: p.items.map(map), total: p.total, counts: p.segmentCounts ?? p.tabCounts };
}

const funding = (f: W.WFundingSource): V.FundingSource => ({
  region: f.region,
  subRegion: s(f.subRegion),
  businessUnit: f.businessUnit,
  productUnit: s(f.productUnit),
  percentage: f.percentage ?? 0,
});

const hourly = (h: W.WHourly | null | undefined): V.HourlyWindow | undefined =>
  h ? { from: h.startTime, to: h.endTime, timeZone: h.timeZone } : undefined;

// ---------------------------------------------------------------- access and reference

export const userInfo = (u: W.WUserInfo): V.UserInfo => ({
  ...u,
  accessRequestEmail: u.accessRequestEmail?.trim() || undefined,
});

export function referenceData(r: W.WReferenceData): V.ReferenceData {
  const allocationTypes = (r.allocationTypes ?? []).filter((a) => norm(a.status ?? "") === "active").map(allocationType);
  const subRegions = r.subRegions ?? [];
  return {
    engagementTypes: (r.engagementTypes ?? []).map((t) => ({
      id: t.id as V.EngagementTypeId,
      name: t.name,
      kind: t.type,
      active: t.isActive,
      allocationTypes: allocationTypes.filter((a) => a.engagementTypeId === t.id),
    })),
    businessUnits: (r.businessUnits ?? []).filter((b) => b.active !== false).map((b) => b.name),
    businessUnitIds: Object.fromEntries((r.businessUnits ?? []).map((b) => [b.name, b.id])),
    productUnits: (r.productUnits ?? [])
      .filter((p) => p.active !== false)
      .map((p) => ({ name: p.name, businessUnit: p.businessUnit, customer: Boolean(p.customer), internal: Boolean(p.internal), marketing: Boolean(p.marketing) })),
    regions: (r.regions ?? [])
      .filter((x) => x.active !== false)
      .map((x) => ({ name: x.name, subRegions: subRegions.filter((sr) => sr.region === x.name && sr.active !== false).map((sr) => sr.name) })),
    subRegions: subRegions.filter((x) => x.active !== false).map((x) => x.name),
    countries: r.countries ?? [],
    travelAgents: (r.travelAgencies ?? []).filter((a) => a.active !== false).map((a) => a.name),
    costTypes: r.costTypes ?? [],
    perDiemRates: r.perDiemRates ?? [],
    currencies: r.currencies ?? [],
    timeZones: r.timeZones ?? [],
  };
}

export function allocationType(a: W.WAllocationType): V.AllocationTypeDef {
  const notify = a.emailToAllocations === "Yes" || a.emailToAllocations === "No" ? a.emailToAllocations : undefined;
  return {
    id: String(a.id),
    engagementTypeId: a.engagementTypeId as V.EngagementTypeId,
    name: a.allocationTypeName,
    department: opt(a.department),
    code: opt(a.defaultEngagementCode),
    suffix: opt(a.engagementCodeSuffix),
    color: opt(a.color),
    notifyToAllocations: notify,
  };
}

export function orgStructure(o: W.WOrgStructure): V.OrgStructure {
  const departments: { name: string; businessUnit: string }[] = [];
  const teams: { name: string; businessUnit: string; department: string }[] = [];
  for (const bu of o.businessUnits) {
    for (const d of bu.departments ?? []) {
      departments.push({ name: d.name, businessUnit: bu.name });
      for (const t of d.teams ?? []) teams.push({ name: t, businessUnit: bu.name, department: d.name });
    }
  }
  return { businessUnits: o.businessUnits.map((b) => b.name), departments, teams };
}

export const account = (a: W.WAccount): V.SalesforceAccount => ({
  id: a.id,
  name: a.name,
  country: opt(a.country),
  subRegion: opt(a.subRegion),
  address: addr(a.address),
});

export const opportunity = (o: W.WOpportunity): V.Opportunity => ({
  id: o.id,
  name: o.name,
  owner: opt(o.owner),
  technicalOwner: opt(o.technicalOwner),
  won: o.isWon ?? undefined,
  preSalesCode: opt(o.preSalesCode),
  postSalesCode: opt(o.postSalesCode),
  address: addr(o.address),
  lineItems: o.lineItems.map((l) => ({
    id: l.id,
    product: l.product,
    code: opt(l.engagementCode),
    description: opt(l.description),
    start: l.startDate ? l.startDate.slice(0, 10) : undefined,
    end: l.endDate ? l.endDate.slice(0, 10) : undefined,
    businessUnit: opt(l.businessUnit),
    productUnit: opt(l.productUnit),
    tentativeDates: Boolean(l.isTentativeDates),
  })),
});

export const campaignOf = (c: W.WCampaign): V.Campaign => ({ id: c.id, name: c.name, type: opt(c.type), status: opt(c.status) });

export const employee = (e: W.WEmployee): V.EmployeeOption => ({
  ...person(e),
  title: opt(e.jobRole),
  team: opt(e.team),
  jobBand: opt(e.jobBand),
});

// ---------------------------------------------------------------- engagements and allocations

export function engagementSummary(e: W.WEngagementSummary): V.EngagementSummary {
  return {
    id: e.id,
    typeId: e.engagementTypeId as V.EngagementTypeId,
    typeName: s(e.engagementTypeName),
    kind: e.kind,
    account: s(e.account),
    title: e.title,
    allocationType: s(e.allocationType),
    code: s(e.engagementCode),
    nature: s(e.nature),
    country: s(e.country),
    city: opt(e.city),
    start: s(e.startDate),
    end: s(e.endDate),
    requestStatus: canon(e.requestStatus, REQUEST_STATUSES),
    engagementStatus: canon(e.engagementStatus, ENGAGEMENT_STATUSES),
    businessUnit: opt(e.businessUnit),
    funding: e.fundingSources?.map(funding),
    campaign: campaign(e.campaign),
    consultants: e.consultants ? e.consultants.map(person) : undefined,
    createdBy: maybePerson(e.createdBy),
    createdOn: e.createdOn ? e.createdOn.slice(0, 10) : undefined,
    actions: e.actions,
  };
}

export function allocation(a: W.WAllocationWithEngagement, parent?: V.EngagementSummary): V.Allocation {
  const eng = a.engagement;
  return {
    id: s(a.id),
    engagement: eng
      ? {
          id: eng.id,
          typeId: eng.engagementTypeId as V.EngagementTypeId,
          kind: eng.kind,
          account: s(eng.account),
          title: eng.title,
          allocationType: s(eng.allocationType),
          code: s(eng.engagementCode),
          country: opt(eng.country),
          address: addr(eng.address),
          canOpen: eng.canOpen,
        }
      : {
          id: parent?.id ?? s(a.engagementId),
          typeId: parent?.typeId ?? 1,
          kind: parent?.kind ?? "internal",
          account: parent?.account ?? "",
          title: parent?.title ?? "",
          allocationType: parent?.allocationType ?? "",
          code: parent?.code ?? "",
        },
    consultant: person(a.consultant),
    start: a.startDate,
    end: a.endDate,
    hourly: hourly(a.hourly),
    travelRequired: a.travelRequired ? "Yes" : "No",
    travelRequest: a.travelRequest?.canOpen ? a.travelRequest.jobNumber : undefined,
    travelRaised: Boolean(a.travelRequest && !a.travelRequest.canOpen),
    status: canon(a.clearanceStatus ?? "Tentative", ALLOCATION_STATUSES),
    comment: opt(a.comment),
    canChangeStatus: a.actions?.changeStatus,
  };
}

export function engagementDetail(e: W.WEngagementDetail): V.Engagement {
  const summary = engagementSummary(e);
  return {
    ...summary,
    access: e.scope,
    tentativeDates: e.tentativeDates,
    accountId: opt(e.accountId),
    opportunityId: opt(e.opportunityId),
    lineItemId: opt(e.opportunityLineItemId),
    product: opt(e.product),
    description: opt(e.description),
    address: addr(e.address),
    productUnit: opt(e.productUnit),
    subRegion: opt(e.salesSubRegion),
    contact: opt(e.customerContact),
    domain: opt(e.businessDomain),
    opportunityOwner: opt(e.opportunityOwner),
    technicalOwner: opt(e.technicalOwner),
    contractsSigned: e.contractsSigned ?? undefined,
    scope: opt(e.engagementScope),
    comment: opt(e.comments),
    allocations: (e.allocations ?? []).map((a) => allocation(a, summary)),
    cascadePreview: e.cascadePreview
      ? { activeAllocations: e.cascadePreview.activeAllocations ?? 0, openTravelRequests: e.cascadePreview.openTravelRequests ?? 0 }
      : undefined,
  };
}

export const upcomingAllocation = (a: W.WAllocationSummary): V.UpcomingAllocation => ({
  id: a.id,
  engagementId: a.engagementId,
  title: a.engagementTitle,
  start: a.startDate,
  end: a.endDate,
  status: a.clearanceStatus ? canon(a.clearanceStatus, ALLOCATION_STATUSES) : undefined,
  current: a.current,
  // Left undefined when the backend sends none, so the list's own answer can stand in for it.
  canOpen: a.canOpen,
});

export const timelineItem = (t: W.WTimelineItem): V.TimelineItem => ({
  id: s(t.id),
  kind: t.kind ?? "engagement",
  label: s(t.label),
  allocationType: s(t.allocationType),
  code: s(t.engagementCode),
  color: opt(t.color),
  start: t.startDate,
  end: t.endDate,
  hourly: hourly(t.hourly),
  status: opt(t.clearanceStatus),
  comment: opt(t.comment),
  editable: t.editable,
});

export const timelinePerson = (r: W.WTimelineRow): V.TimelinePerson => ({ person: employee(r.person), items: r.items.map(timelineItem) });

export const bulkValidation = (b: W.WBulkValidation): V.BulkValidation => ({
  errors: b.errors,
  valid: b.valid.map((v) => ({ line: v.line, email: v.email, allocationType: v.allocationType, start: v.startDate, end: v.endDate })),
  saved: b.saved,
});

// ---------------------------------------------------------------- travel

export const upcomingTrip = (t: W.WDashboardTrip): V.UpcomingTrip => ({
  jobNumber: t.jobNumber,
  traveller: person(t.traveller),
  country: s(t.country),
  city: opt(t.city),
  start: t.startDate,
  end: t.endDate,
  travelAgent: opt(t.agency),
  status: t.status ? canon(t.status, TRAVEL_STATUSES) : undefined,
});

const kindOfType = (typeId: number | null | undefined, account?: string | null): V.EngagementKind =>
  typeId === 1 ? "internal" : typeId === 5 ? "marketing" : typeId ? "customer" : account ? "customer" : "internal";

export function travelSummary(t: W.WTravelRequestSummary): V.TravelRequestSummary {
  return {
    jobNumber: t.jobNumber,
    status: canon(t.status, TRAVEL_STATUSES),
    traveller: person(t.traveller),
    location: opt(t.baseLocation),
    country: s(t.country),
    city: opt(t.city),
    start: t.startDate,
    end: t.endDate,
    travelAgent: opt(t.agency),
    visa: t.visa ? (t.visaValidity ? `${t.visa}, valid ${t.visaValidity}` : t.visa) : undefined,
    engagement: t.engagement
      ? {
          id: t.engagement.id,
          kind: kindOfType(t.engagement.engagementTypeId, t.engagement.account),
          typeName: opt(t.engagement.engagementTypeName),
          account: s(t.engagement.account),
          title: t.engagement.title,
        }
      : undefined,
    campaign: campaign(t.campaign),
    actions: t.actions,
  };
}

export function travelDetail(t: W.WTravelRequestDetail): V.TravelRequest {
  return {
    ...travelSummary(t),
    scope: t.scope,
    visaId: t.visaId !== null && t.visaId !== undefined ? String(t.visaId) : undefined,
    engagementCode: opt(t.engagementCode),
    engagementType: opt(t.engagementType),
    travelLocation: addr(t.address),
    funding: t.fundingSources?.map(funding),
    tabs: {
      perDiems: Boolean(t.tabs.perDiems),
      invoices: Boolean(t.tabs.invoices),
      travelCards: Boolean(t.tabs.travelCards),
      payments: Boolean(t.tabs.payments),
      expenses: Boolean(t.tabs.expenses),
    },
    counts: t.counts ?? undefined,
  };
}

export const perDiem = (p: W.WPerDiem): V.PerDiem => ({
  id: String(p.id),
  start: `${p.startDate}T${p.startTime}`,
  end: `${p.endDate}T${p.endTime}`,
  days: p.days,
  currency: p.currency,
  rate: p.rate,
  total: p.total,
  canDelete: p.canDelete,
});

function netsuite(n: W.WNetSuiteState | undefined): V.NetSuiteState {
  if (!n) return { nsStatus: "Pending" };
  return {
    nsStatus: norm(n.status ?? "") === "pushed" ? "Pushed" : norm(n.status ?? "") === "pushing" ? "Pushing" : "Pending",
    nsReference: opt(n.reference),
    nsError: norm(n.status ?? "") === "failed" ? n.error || "NetSuite status not received" : opt(n.error),
  };
}

export const invoice = (i: W.WInvoice): V.Invoice => ({
  ...netsuite(i.netsuite),
  id: String(i.id),
  number: i.invoiceNumber,
  jobNumber: i.jobNumber,
  traveller: maybePerson(i.traveller),
  travelAgent: s(i.agency),
  costType: i.costType,
  month: i.month,
  amount: i.amount,
  currency: i.currency,
  paidAmount: i.paidAmount,
  paidCurrency: i.paidCurrency,
  status: canon(i.status, INVOICE_STATUSES),
  poApproval: i.poApproval,
  financeApproval: i.financeApproval,
  rejectReason: opt(i.rejectReason),
  addedDate: s(i.addedOn).slice(0, 10),
  addedBy: opt(i.addedBy),
  campaign: campaign(i.campaign),
  actions: i.actions,
});

/** Expense Claims status codes (expense_app). */
const CLAIM_STATUS: Record<string, string> = { "0": "Pending Approval", "1": "Rejected", "2": "Lead Approved", "3": "Approved" };
/** Credit card transaction statuses (expense_app), as words. */
const CARD_STATUS: Record<string, string> = { new: "New", pending_lead: "Pending Lead", pending_finance: "Pending Finance", submitted: "Submitted" };
const num = (n: number | null | undefined): number | undefined => (n === null || n === undefined ? undefined : n);

export const tripExpenses = (w: W.WTripExpenses): V.TripExpenses => ({
  cardExpenses: (w.cardExpenses ?? []).map((c) => ({
    id: String(c.id),
    date: opt(c.date),
    expenseType: opt(c.expenseType),
    reference: opt(c.reference),
    amount: num(c.amount),
    currency: opt(c.currency),
    employee: opt(c.employeeEmail),
    status: CARD_STATUS[s(c.status)] ?? (s(c.status) || "—"),
  })),
  expenseClaims: (w.expenseClaims ?? []).map((c) => ({
    id: String(c.id),
    claimNumber: opt(c.claimNumber),
    date: opt(c.date),
    expenseType: opt(c.expenseType),
    amount: num(c.amount),
    currency: opt(c.currency),
    reimbursementAmount: num(c.reimbursementAmount),
    reimbursementCurrency: opt(c.reimbursementCurrency),
    employee: opt(c.employeeEmail),
    status: CLAIM_STATUS[s(c.status)] ?? (s(c.status) || "—"),
  })),
});

export const travelCard = (c: W.WTravelCard): V.TravelCard => ({
  id: String(c.id),
  currency: c.currency,
  amount: c.amount,
  addedDate: s(c.addedOn).slice(0, 10),
  addedBy: opt(c.addedBy),
});

export const payment = (p: W.WPerDiemPayment): V.PerDiemPayment => ({
  ...netsuite(p.netsuite),
  id: p.id,
  jobNumber: p.jobNumber,
  traveller: maybePerson(p.traveller),
  amount: p.amount,
  currency: p.currency,
  convertedAmount: p.convertedAmount ?? undefined,
  convertedCurrency: opt(p.convertedCurrency),
  status: canon(p.status, PAYMENT_STATUSES),
  addedDate: s(p.addedOn).slice(0, 10),
  addedBy: opt(p.addedBy),
  campaign: campaign(p.campaign),
  actions: p.actions,
});

export const tripPayments = (t: W.WTravelRequestPayments): V.TripPayments => ({
  items: t.items.map(payment),
  summary: t.summary
    ? {
        currency: t.summary.currency,
        totalPerDiem: t.summary.totalPerDiemAmount,
        initialCurrencyPaid: t.summary.initialCurrencyPaid,
        travelCards: t.summary.totalTravelCardAmount,
        paid: t.summary.totalPaymentAmount,
        remaining: t.summary.remainingBalance,
        convertedCurrency: opt(t.summary.convertedCurrency),
      }
    : undefined,
});

export const syncFailure = (f: W.WSyncFailure): V.SyncFailure => ({
  ...netsuite(f.netsuite),
  record: f.record,
  id: f.id,
  number: f.number ?? f.id,
  travelAgent: opt(f.agency),
  jobNumber: f.jobNumber,
  traveller: maybePerson(f.traveller),
  amount: f.amount ?? 0,
  currency: s(f.currency),
});

/** A bulk action's per-record results, as done and failed. */
export const batchOutcome = (b: W.WBatchResult | null): V.BatchOutcome => ({
  done: (b?.results ?? []).filter((r) => r.ok).map((r) => r.id),
  failed: (b?.results ?? []).filter((r) => !r.ok).map((r) => ({ id: r.id, message: r.message || "Not done" })),
});

export const consultantRow = (r: W.WConsultantAllocationRow): V.ConsultantAllocationRow => ({
  engagementTypeName: r.engagementType,
  engagementNature: r.engagementLocation,
  country: r.country,
  allocationTypeName: r.allocationType,
  email: r.consultantEmail,
  department: r.department,
  businessUnit: r.employeeBusinessUnit,
  company: r.company,
  engagementCode: r.engagementCode,
  dailyHourly: r.dailyOrHourly,
  calendarDays: r.calendarDays,
  workingDays: r.workingDays,
  workingHours: r.workingHours ?? undefined,
  engagementBusinessUnit: r.engagementBusinessUnit,
  engagementSalesPOD: r.engagementSalesPod,
  engagementGroup: r.engagementGroup,
  accountName: r.accountName,
  glCode: r.glCode,
});

// ---------------------------------------------------------------- visas and documents

export const visa = (v: W.WVisa): V.Visa => ({
  id: String(v.id),
  kind: "visa",
  owner: maybePerson(v.traveller),
  country: v.country,
  visaType: v.visaType,
  entryType: v.entryType,
  start: v.startDate,
  end: v.endDate,
  issued: opt(v.issuedDate),
  passport: v.passport ? `${v.passport.country} [${v.passport.maskedNumber}]` : undefined,
  passportId: v.passport ? String(v.passport.id) : undefined,
  status: canon(v.status, RECORD_STATUSES),
  hasFile: v.hasImage,
});

export const travelDocument = (d: W.WTravelDocument): V.TravelDocument => ({
  id: String(d.id),
  kind: "document",
  owner: maybePerson(d.traveller),
  type: d.documentType,
  number: d.maskedNumber,
  fullNumber: opt(d.documentNumber),
  country: d.country,
  issued: opt(d.issuedDate),
  expires: opt(d.expiryDate),
  status: canon(d.status, RECORD_STATUSES),
  hasFile: d.hasImage,
});

// ---------------------------------------------------------------- settings

export const roleSettings = (r: W.WRoleSettings): V.RoleSettings => ({
  roles: r.roles.map((x) => ({ id: String(x.id), role: x.name, privileges: x.privilegeIds })),
  privileges: r.privileges.map((p) => ({ id: p.id, name: p.name, description: opt(p.description) })),
});


// ---------------------------------------------------------------- dashboard

const bucket = (b: W.WBucket): V.CountRow => ({ label: b.label, count: b.value });
const series = (rows: W.WSeriesPoint[], key: string): V.MonthValue[] => rows.map((r) => ({ month: r.month, value: r.values[key] ?? 0 }));

export function dashboard(d: W.WDashboard): V.Dashboard {
  return {
    date: d.date,
    failed: d.failedSections ?? [],
    widgets: DM.widgetRefs(d.widgets),
    travelTeam: d.travelTeam ? DM.travelTeam(d.travelTeam) : undefined,
    engagementManager: d.engagementManager ? DM.engagementManager(d.engagementManager) : undefined,
    accountManager: d.accountManager ? DM.accountManager(d.accountManager) : undefined,
    marketingEvents: d.marketingEvents ? DM.marketingEvents(d.marketingEvents) : undefined,
    queue: d.waitingOnYou?.map((c) => ({ key: c.key, label: c.label, count: c.count, highlighted: c.highlighted, to: c.list.path || undefined })),
    allocationsOverTime: d.allocationsOverTime
      ? { byMonth: series(d.allocationsOverTime.byMonth, "Allocations"), byBusinessUnit: d.allocationsOverTime.byBusinessUnit.map(bucket) }
      : undefined,
    engagements: d.engagements
      ? {
          startingSoon: d.engagements.startingIn30Days.map(DM.dashboardEngagement),
          total: d.engagements.startingIn30DaysTotal ?? d.engagements.startingIn30Days.length,
        }
      : undefined,
    available: d.availableConsultants
      ? { available: d.availableConsultants.available, allocated: d.availableConsultants.allocated, byBusinessUnit: d.availableConsultants.byBusinessUnit.map(bucket) }
      : undefined,
    travel: d.travel
      ? {
          inProgress: d.travel.inProgress,
          startingIn30Days: d.travel.startingIn30Days,
          completedThisMonth: d.travel.completedThisMonth,
          tripsIn12Months: d.travel.last12Months,
          upcoming: d.travel.upcoming.map(upcomingTrip),
          upcomingTotal: d.travel.upcomingTotal ?? d.travel.upcoming.length,
          topDestinations: d.travel.topDestinations.map(bucket),
          byMonth: series(d.travel.byMonth, "Travels"),
          byTravelAgent: d.travel.byAgency.map(bucket),
        }
      : undefined,
    agency: d.agent
      ? {
          name: d.agent.agency,
          inProgress: d.agent.inProgress,
          startingIn7Days: d.agent.startingIn7Days,
          completedWithoutInvoice: d.agent.completedWithoutInvoice,
          invoicesRejected: d.agent.invoicesRejected,
          upcoming: d.agent.upcoming.map(upcomingTrip),
          upcomingTotal: d.agent.upcomingTotal ?? d.agent.upcoming.length,
          invoicesByStatus: d.agent.invoicesByStatus.map(bucket),
          tripsByMonth: series(d.agent.tripsByMonth, "Travels"),
        }
      : undefined,
  };
}

export const allocationsToday = (a: W.WAllocationsToday): V.AllocationsToday => ({
  date: a.date,
  total: a.allocations,
  consultants: a.consultants,
  paid: a.paid,
  nonPaid: a.nonPaid,
  byEngagementType: a.byEngagementType.map(bucket),
  paidByAllocationType: a.paidByAllocationType.map(bucket),
  nonPaidByAllocationType: a.nonPaidByAllocationType.map(bucket),
});

export const myOverview = (m: W.WMyOverview): V.MyOverview => ({
  allocations: m.upcomingAllocations.map(upcomingAllocation),
  trips: m.upcomingTrips.map(upcomingTrip),
  tripVisas: m.tripVisas?.map(DM.tripVisa),
});

// ---------------------------------------------------------------- search

const searchKind = (k: string | null | undefined): V.SearchKind | undefined => SEARCH_KINDS.find((x) => x === k);
const SEGMENTS = ["customer", "internal", "marketing"] as const;

export const searchItem = (i: W.WSearchItem): V.SearchItem => ({
  id: i.id,
  title: i.title || i.id,
  subtitle: opt(i.subtitle),
  status: opt(i.status),
  segment: SEGMENTS.find((x) => x === i.segment),
  jobNumber: opt(i.jobNumber),
});

/** Groups of a kind this build does not know are dropped, so a newer backend cannot break the box. */
export function searchResults(r: W.WSearchResults): V.SearchResults {
  const groups: V.SearchGroup[] = [];
  for (const g of r.groups ?? []) {
    const kind = searchKind(g.kind);
    if (kind) groups.push({ kind, total: g.total ?? g.items?.length ?? 0, items: (g.items ?? []).map(searchItem) });
  }
  return {
    query: r.query ?? "",
    groups,
    failed: (r.failed ?? []).flatMap((k) => searchKind(k) ?? []),
  };
}
