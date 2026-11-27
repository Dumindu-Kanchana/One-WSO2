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

// The Engagement App Backend's wire shapes, as finance-tools apps/engagement-app/backend/openapi.yaml (0.2.0) defines them.

import type { WAccountManager, WEngagementManager, WMarketingEvents, WTravelTeam, WTripVisa, WWidgetRef } from "./dashboardWire";
import type {
  ClearanceStatus,
  EngagementKind,
  EngagementStatus,
  InvoiceStatus,
  RequestStatus,
  TravelStatus,
} from "./engagementTypes";

export interface WPerson {
  email: string;
  name?: string | null;
}

export interface WAppAccess {
  privileges: number[];
  ownPrivileges: number[];
  roles: string[];
}

export interface WUserInfo {
  email: string;
  allocations: WAppAccess;
  travel: WAppAccess & { agency: { id: number; name: string } | null };
  workQueues: {
    invoices: ("approve-po" | "approve" | "push" | "all")[];
    perDiemPayments: ("push" | "all")[];
    netsuiteSyncFailures: boolean;
  };
  /** Where to ask for access (ACCESS_REQUEST_EMAIL); absent when not set. */
  accessRequestEmail?: string;
}

export interface WPage<T> {
  items: T[];
  total: number;
  segmentCounts?: Record<string, number>;
  tabCounts?: Record<string, number>;
}

export interface WItems<T> {
  items: T[];
}

// ---------------------------------------------------------------- reference data

export interface WNamedItem {
  id: number;
  name: string;
  active?: boolean;
}

export interface WAllocationType {
  id: number;
  allocationTypeName: string;
  status: string;
  color?: string | null;
  department?: string | null;
  emailToAllocations?: string | null;
  defaultEngagementCode?: string | null;
  engagementCodeSuffix?: string | null;
  engagementTypeId: number;
  engagementTypeName: string;
}

export interface WReferenceData {
  engagementTypes?: { id: number; name: string; type: "Internal" | "Customer"; isActive: boolean }[];
  allocationTypes?: WAllocationType[];
  businessUnits?: WNamedItem[];
  productUnits?: (WNamedItem & { businessUnit?: string; customer?: boolean; internal?: boolean; marketing?: boolean })[];
  regions?: WNamedItem[];
  subRegions?: (WNamedItem & { region?: string })[];
  countries?: string[];
  engagementNatures?: string[];
  eventNatures?: string[];
  clearanceTransitions?: Record<string, ClearanceStatus[]>;
  travelStatusTransitions?: Record<string, TravelStatus[]>;
  travelAgencies?: { id?: number; name: string; netsuiteVendorId?: string | null; active?: boolean }[];
  costTypes?: string[];
  perDiemRates?: { country: string; currency: string; amount: number }[];
  currencies?: string[];
  invoiceCurrencies?: string[];
  travelCardCurrencies?: string[];
  visaTypes?: string[];
  entryTypes?: string[];
  travelDocumentTypes?: string[];
  timeZones?: string[];
}

export interface WAccount {
  id: string;
  name: string;
  country?: string | null;
  salesRegion?: string | null;
  subRegion?: string | null;
  address?: string | null;
}

export interface WOpportunity {
  id: string;
  name: string;
  owner?: string | null;
  technicalOwner?: string | null;
  isWon?: boolean | null;
  address?: string | null;
  preSalesCode?: string | null;
  postSalesCode?: string | null;
  lineItems: {
    id: string;
    product: string;
    engagementCode?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    description?: string | null;
    businessUnit?: string | null;
    productUnit?: string | null;
    isTentativeDates?: boolean | null;
  }[];
}

export interface WCampaign {
  id: string;
  name: string;
  type?: string | null;
  status?: string | null;
}

export type WCampaignRef = { id: string; name?: string | null } | null;

export interface WEmployee {
  email: string;
  name?: string;
  jobRole?: string | null;
  jobBand?: string | null;
  businessUnit?: string | null;
  department?: string | null;
  team?: string | null;
  location?: string | null;
}

export interface WOrgStructure {
  businessUnits: { name: string; departments?: { name: string; teams?: string[] }[] }[];
}

// ---------------------------------------------------------------- dashboard

export interface WBucket {
  label: string;
  value: number;
  percent?: number;
}

export interface WSeriesPoint {
  month: string;
  values: Record<string, number>;
}

export interface WDashboardTrip {
  jobNumber: string;
  status?: TravelStatus | null;
  traveller: WPerson;
  city?: string | null;
  country?: string | null;
  startDate: string;
  endDate: string;
  agency?: string | null;
}

export interface WAllocationSummary {
  id: string;
  engagementId: string;
  engagementTitle: string;
  startDate: string;
  endDate: string;
  clearanceStatus?: ClearanceStatus | null;
  current?: boolean;
  canOpen?: boolean;
}

export interface WCountCard {
  key: string;
  label: string;
  count: number;
  highlighted: boolean;
  list: { path: string };
}

export interface WDashboard {
  /** The business date (UTC) the dashboard is for. */
  date?: string;
  failedSections?: string[];
  /** Every widget the caller may see, in catalogue order. */
  widgets?: WWidgetRef[];
  travelTeam?: WTravelTeam;
  engagementManager?: WEngagementManager;
  accountManager?: WAccountManager;
  marketingEvents?: WMarketingEvents;
  waitingOnYou?: WCountCard[];
  travel?: {
    inProgress: number;
    startingIn30Days: number;
    completedThisMonth: number;
    last12Months: number;
    upcoming: WDashboardTrip[];
    upcomingTotal?: number;
    topDestinations: WBucket[];
    byMonth: WSeriesPoint[];
    byAgency: WBucket[];
  };
  engagements?: {
    startingIn30Days: {
      id: string;
      kind: EngagementKind;
      engagementTypeId: number;
      engagementTypeName?: string | null;
      account?: string | null;
      title: string;
      city?: string | null;
      country?: string | null;
      startDate: string;
      endDate: string;
      consultants: number;
    }[];
    startingIn30DaysTotal?: number;
  };
  availableConsultants?: { consultants: number; available: number; allocated: number; byBusinessUnit: WBucket[] };
  allocationsOverTime?: { byMonth: WSeriesPoint[]; busiestMonth?: WSeriesPoint | null; byBusinessUnit: WBucket[] };
  agent?: {
    agency: string;
    inProgress: number;
    startingIn7Days: number;
    completedWithoutInvoice: number;
    invoicesRejected: number;
    upcoming: WDashboardTrip[];
    upcomingTotal?: number;
    invoicesByStatus: WBucket[];
    tripsByMonth: WSeriesPoint[];
  };
}

export interface WAllocationsToday {
  date: string;
  businessUnitId?: number | null;
  allocations: number;
  consultants: number;
  paid: number;
  nonPaid: number;
  byEngagementType: WBucket[];
  paidByAllocationType: WBucket[];
  nonPaidByAllocationType: WBucket[];
}

export interface WMyOverview {
  upcomingAllocations: WAllocationSummary[];
  upcomingTrips: WDashboardTrip[];
  /** Present for callers with own trips access: at most 20 trips. */
  tripVisas?: WTripVisa[];
}

// ---------------------------------------------------------------- engagements

export interface WFundingSource {
  region: string;
  subRegion?: string | null;
  businessUnit: string;
  productUnit?: string | null;
  percentage?: number | null;
}

export interface WEngagementActions {
  allocate?: boolean;
  edit?: boolean;
  editPending?: boolean;
  approve?: boolean;
  complete?: boolean;
  changeEngagementStatus?: boolean;
  changeAllocationStatus?: boolean;
}

export interface WEngagementSummary {
  id: string;
  kind: EngagementKind;
  engagementTypeId: number;
  engagementTypeName?: string;
  account?: string | null;
  title: string;
  campaign?: WCampaignRef;
  allocationType?: string;
  engagementCode?: string;
  nature?: string;
  city?: string | null;
  country?: string;
  businessUnit?: string | null;
  fundingSources?: WFundingSource[];
  startDate?: string;
  endDate?: string;
  requestStatus: RequestStatus;
  engagementStatus: EngagementStatus;
  createdBy?: WPerson;
  createdOn?: string;
  consultants?: WPerson[] | null;
  actions?: WEngagementActions;
}

export interface WHourly {
  timeZone: string;
  startTime: string;
  endTime: string;
}

export interface WAllocation {
  id?: string;
  engagementId?: string;
  consultant: WPerson;
  startDate: string;
  endDate: string;
  hourly?: WHourly | null;
  travelRequired?: boolean;
  clearanceStatus?: ClearanceStatus;
  comment?: string | null;
  travelRequest?: { jobNumber: string; canOpen?: boolean } | null;
  actions?: { changeStatus?: boolean };
}

export interface WAllocationWithEngagement extends WAllocation {
  engagement?: {
    id: string;
    kind: EngagementKind;
    engagementTypeId: number;
    title: string;
    account?: string | null;
    allocationType?: string;
    engagementCode?: string;
    country?: string | null;
    address?: string | null;
    canOpen?: boolean;
  };
}

export interface WEngagementDetail extends WEngagementSummary {
  scope: "full" | "roster" | "consultants";
  accountId?: string | null;
  opportunityId?: string | null;
  opportunityLineItemId?: string | null;
  product?: string | null;
  productUnit?: string | null;
  salesSubRegion?: string | null;
  address?: string | null;
  description?: string | null;
  customerContact?: string | null;
  businessDomain?: string | null;
  opportunityOwner?: string | null;
  technicalOwner?: string | null;
  contractsSigned?: boolean | null;
  engagementScope?: string | null;
  comments?: string | null;
  allocations?: WAllocation[];
  cascadePreview?: { activeAllocations?: number; openTravelRequests?: number };
  tentativeDates?: boolean;
}

export interface WTimelineItem {
  id?: string;
  kind?: "engagement" | "default";
  engagementId?: string | null;
  label?: string;
  allocationType?: string;
  engagementCode?: string;
  color?: string | null;
  startDate: string;
  endDate: string;
  hourly?: WHourly | null;
  clearanceStatus?: string;
  comment?: string | null;
  editable?: boolean;
}

export interface WTimelineRow {
  person: WEmployee;
  items: WTimelineItem[];
}

export interface WBulkValidation {
  errors: string[];
  valid: { line?: number; email?: string; team?: string; startDate?: string; endDate?: string; allocationType?: string }[];
  saved?: number;
}

// ---------------------------------------------------------------- travel

export interface WTravelRequestActions {
  assign?: boolean;
  update?: boolean;
  editStatus?: boolean;
  editAgency?: boolean;
  editVisa?: boolean;
  addPerDiem?: boolean;
  deletePerDiem?: boolean;
  addInvoice?: boolean;
  addTravelCard?: boolean;
  addPayment?: boolean;
  editPayment?: boolean;
  pushPayments?: boolean;
  approveInvoicesPo?: boolean;
  approveInvoices?: boolean;
  pushInvoices?: boolean;
}

export interface WTravelRequestSummary {
  jobNumber: string;
  status: TravelStatus;
  traveller: WPerson;
  baseLocation?: string | null;
  city?: string | null;
  country?: string | null;
  startDate: string;
  endDate: string;
  agency?: string | null;
  visa?: string | null;
  visaValidity?: string | null;
  engagement?: { id: string; title: string; account?: string | null; engagementTypeId?: number | null; engagementTypeName?: string | null } | null;
  campaign?: WCampaignRef;
  actions?: WTravelRequestActions;
}

export interface WTravelRequestDetail extends WTravelRequestSummary {
  scope: "full" | "agency" | "own";
  allocationId?: string | null;
  visaId?: number | null;
  engagementCode?: string | null;
  engagementType?: string | null;
  address?: string | null;
  fundingSources?: WFundingSource[] | null;
  tabs: { perDiems?: boolean; invoices?: boolean; travelCards?: boolean; payments?: boolean; expenses?: boolean };
  counts?: { perDiems?: number; invoices?: number; payments?: number; cardExpenses?: number; expenseClaims?: number } | null;
}

export interface WPerDiem {
  id: number;
  jobNumber?: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  days: number;
  currency: string;
  rate: number;
  total: number;
  canDelete?: boolean;
}

export interface WNetSuiteState {
  status: "Pending" | "Pushing" | "Pushed" | "Failed";
  reference?: string | null;
  error?: string | null;
}

export interface WInvoice {
  id: number;
  invoiceNumber: string;
  jobNumber: string;
  traveller?: WPerson;
  agency?: string | null;
  month: string;
  costType: string;
  amount: number;
  currency: string;
  paidAmount?: number;
  paidCurrency?: string;
  status: InvoiceStatus;
  poApproval?: "Pending" | "Approved" | "Rejected";
  financeApproval?: "Pending" | "Approved" | "Rejected";
  poApprovedBy?: string | null;
  financeApprovedBy?: string | null;
  rejectReason?: string | null;
  netsuite?: WNetSuiteState;
  campaign?: WCampaignRef;
  addedOn?: string;
  addedBy?: string | null;
  actions?: { approvePo?: boolean; approve?: boolean; reject?: boolean; push?: boolean; resync?: boolean };
}

export interface WCardExpense {
  id: number;
  date?: string | null;
  expenseType?: string | null;
  reference?: string | null;
  amount?: number | null;
  currency?: string | null;
  employeeEmail?: string | null;
  status?: string | null;
}

export interface WExpenseClaim {
  id: number;
  claimNumber?: string | null;
  date?: string | null;
  expenseType?: string | null;
  amount?: number | null;
  currency?: string | null;
  reimbursementAmount?: number | null;
  reimbursementCurrency?: string | null;
  employeeEmail?: string | null;
  status?: string | null;
}

export interface WTripExpenses {
  cardExpenses?: WCardExpense[] | null;
  expenseClaims?: WExpenseClaim[] | null;
}

export interface WTravelCard {
  id: number;
  jobNumber?: string;
  currency: string;
  amount: number;
  addedBy?: string;
  addedOn?: string;
}

export interface WPerDiemPayment {
  id: string;
  jobNumber: string;
  traveller?: WPerson;
  amount: number;
  currency: string;
  convertedAmount?: number | null;
  convertedCurrency?: string | null;
  status: "Pending" | "Complete";
  netsuite?: WNetSuiteState;
  campaign?: WCampaignRef;
  addedOn?: string;
  addedBy?: string | null;
  actions?: { edit?: boolean; push?: boolean; resync?: boolean };
}

export interface WTravelRequestPayments {
  items: WPerDiemPayment[];
  summary?: {
    currency: string;
    totalPerDiemAmount: number;
    initialCurrencyPaid: number;
    totalTravelCardAmount: number;
    totalPaymentAmount: number;
    remainingBalance: number;
    convertedCurrency?: string | null;
  } | null;
}

export interface WSyncFailure {
  record: "invoice" | "payment";
  id: string;
  number?: string;
  agency?: string | null;
  jobNumber: string;
  traveller?: WPerson;
  campaign?: WCampaignRef;
  amount?: number;
  currency?: string;
  netsuite?: WNetSuiteState;
}

export interface WBatchResult {
  results: { id: string; ok: boolean; message?: string | null; netsuiteReference?: string | null }[];
}

export interface WConsultantAllocationRow {
  engagementType: string;
  engagementLocation: string;
  country: string;
  allocationType: string;
  consultantEmail: string;
  department: string;
  employeeBusinessUnit: string;
  company: string;
  engagementCode: string;
  dailyOrHourly: "Daily" | "Hourly";
  calendarDays: number;
  workingDays: number;
  workingHours?: number | null;
  engagementBusinessUnit: string;
  engagementSalesPod: string;
  engagementGroup: string;
  accountName: string;
  glCode: string;
}

// ---------------------------------------------------------------- visas and documents

export interface WVisa {
  id: number;
  traveller?: WPerson;
  country: string;
  visaType: string;
  entryType: string;
  startDate: string;
  endDate: string;
  issuedDate?: string;
  passport?: { id: number; country: string; maskedNumber: string; issuedDate?: string; expiryDate?: string } | null;
  status: "Active" | "Inactive" | "Expired";
  hasImage?: boolean;
}

export interface WTravelDocument {
  id: number;
  traveller?: WPerson;
  documentType: string;
  maskedNumber: string;
  documentNumber?: string | null;
  country: string;
  issuedDate?: string;
  expiryDate?: string | null;
  status: "Active" | "Inactive" | "Expired";
  hasImage?: boolean;
}

// ---------------------------------------------------------------- settings

export interface WRoleSettings {
  roles: { id: number; name: string; privilegeIds: number[] }[];
  privileges: { id: number; name: string; description?: string | null }[];
}

// ---------------------------------------------------------------- search

export interface WSearchItem {
  id: string;
  title: string;
  subtitle?: string | null;
  status?: string | null;
  segment?: string | null;
  jobNumber?: string | null;
}

export interface WSearchGroup {
  kind: string;
  total: number;
  items: WSearchItem[];
}

export interface WSearchResults {
  query?: string;
  groups?: WSearchGroup[];
  /** Kinds whose lookup failed. */
  failed?: string[];
}
