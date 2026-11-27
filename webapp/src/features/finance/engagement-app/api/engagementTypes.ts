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

// The view models the Engagement App screens draw.

import type { AccountManagerStats, EngagementManagerStats, MarketingEventStats, TravelTeamStats, TripVisa, WidgetRef } from "./dashboardTypes";

// ---------------------------------------------------------------- vocabularies

/** Legacy engagement type ids: 1 Internal, 2 Paid (retired), 3 Non-Paid Pre Sale, 4 Non-Paid Post Sale, 5 Marketing Event, 6 Paid Post Sale, 7 Paid Pre Sale. */
export type EngagementTypeId = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type EngagementKind = "customer" | "internal" | "marketing";
export type RequestStatus = "Pending Approval" | "New" | "Updated" | "Approved" | "In Progress" | "Completed" | "Cancelled";
export type EngagementStatus = "Confirmed" | "Pending" | "In Progress" | "Completed" | "Cancelled";
export type ClearanceStatus =
  | "Tentative"
  | "Ready for Clearance"
  | "Clearance In Progress"
  | "Accepted by Consultant"
  | "Rejected by Consultant"
  | "Rejected - Visa Issues"
  | "Rejected - Other"
  | "Confirmed"
  | "Confirmed - Visa Pending"
  | "Allocation Cancelled";
/** The allocation (clearance) status. */
export type AllocationStatus = ClearanceStatus;
export type TravelStatus = "New" | "In Progress" | "On Hold" | "Extended" | "Completed" | "Cancelled";
export type InvoiceStatus = "Pending" | "Accepted by travel" | "Accepted by finance" | "Complete" | "Rejected by travel" | "Rejected by finance";
export type ApprovalState = "Pending" | "Approved" | "Rejected";
export type PaymentStatus = "Pending" | "Complete";
export type DocumentKind = "visa" | "document";

/** The Invoices & Payments tabs `/user-info` says to show. */
export interface WorkQueues {
  readonly invoices: readonly ("approve-po" | "approve" | "push" | "all")[];
  readonly perDiemPayments: readonly ("push" | "all")[];
  readonly netsuiteSyncFailures: boolean;
}

export interface AppAccess {
  readonly privileges: readonly number[];
  /** Without the super admin groups' grants: work queues use these. */
  readonly ownPrivileges?: readonly number[];
  readonly roles?: readonly string[];
}

/** GET /user-info. Allocations and Travel privilege numbers mean different things. */
export interface UserInfo {
  readonly email: string;
  readonly allocations: AppAccess;
  readonly travel: AppAccess & { readonly agency?: { readonly id: number; readonly name: string } | null };
  readonly workQueues?: WorkQueues;
  /** Where to ask for access; absent when the backend has none configured. */
  readonly accessRequestEmail?: string;
}

/** A list page, the total it was cut from, and the per-tab counts. */
export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly counts?: Readonly<Record<string, number>>;
}

export interface Person {
  readonly email: string;
  /** The name, or the email when the backend has none. */
  readonly name: string;
}

// ---------------------------------------------------------------- engagements

export interface FundingSource {
  readonly region: string;
  readonly subRegion: string;
  readonly businessUnit: string;
  readonly productUnit: string;
  readonly percentage: number;
}

export interface Campaign {
  /** The 18-character Salesforce Campaign ID. */
  readonly id: string;
  readonly name: string;
  readonly type?: string;
  readonly status?: string;
}

/** What the caller may do on an engagement now, decided by the backend. */
export interface EngagementActions {
  readonly allocate?: boolean;
  readonly edit?: boolean;
  readonly editPending?: boolean;
  readonly approve?: boolean;
  readonly complete?: boolean;
  readonly changeEngagementStatus?: boolean;
  readonly changeAllocationStatus?: boolean;
}

export interface EngagementSummary {
  readonly id: string;
  readonly typeId: EngagementTypeId;
  readonly typeName: string;
  readonly kind: EngagementKind;
  readonly account: string;
  /** Opportunity Name, Name / Purpose, or Event Name. */
  readonly title: string;
  readonly allocationType: string;
  readonly code: string;
  readonly nature: string;
  readonly country: string;
  readonly city?: string;
  readonly start: string;
  readonly end: string;
  readonly requestStatus: RequestStatus;
  readonly engagementStatus: EngagementStatus;
  readonly businessUnit?: string;
  readonly funding?: readonly FundingSource[];
  readonly campaign?: Campaign;
  /** The legacy Consultants column: present only with privilege 8 / 18. */
  readonly consultants?: readonly Person[];
  readonly createdBy?: Person;
  readonly createdOn?: string;
  readonly actions?: EngagementActions;
}

/** How much of an engagement the caller may see. */
export type EngagementScope = "full" | "roster" | "consultants";

export interface Engagement extends EngagementSummary {
  readonly access: EngagementScope;
  readonly accountId?: string;
  readonly opportunityId?: string;
  readonly lineItemId?: string;
  readonly product?: string;
  readonly description?: string;
  readonly address?: string;
  readonly productUnit?: string;
  readonly subRegion?: string;
  readonly contact?: string;
  readonly domain?: string;
  readonly opportunityOwner?: string;
  readonly technicalOwner?: string;
  readonly contractsSigned?: boolean;
  /** The Engagement Scope text field. */
  readonly scope?: string;
  readonly comment?: string;
  readonly tentativeDates?: boolean;
  readonly allocations: readonly Allocation[];
  /** What cancelling would change. */
  readonly cascadePreview?: { readonly activeAllocations: number; readonly openTravelRequests: number };
}

// ---------------------------------------------------------------- allocations

export interface HourlyWindow {
  readonly from: string;
  readonly to: string;
  readonly timeZone: string;
}

export interface Allocation {
  readonly id: string;
  readonly engagement: {
    readonly id: string;
    readonly typeId: EngagementTypeId;
    readonly kind: EngagementKind;
    readonly account: string;
    readonly title: string;
    readonly allocationType: string;
    readonly code: string;
    readonly country?: string;
    readonly address?: string;
    readonly canOpen?: boolean;
  };
  readonly consultant: Person;
  readonly start: string;
  readonly end: string;
  readonly hourly?: HourlyWindow;
  readonly travelRequired: "Yes" | "No";
  /** The job number of the travel request it created, when the caller may open it. */
  readonly travelRequest?: string;
  /** True when a travel request exists that the caller may not open. */
  readonly travelRaised?: boolean;
  readonly status: AllocationStatus;
  readonly comment?: string;
  readonly canChangeStatus?: boolean;
}

/** One own allocation on the Me card, and My Allocations. */
export interface UpcomingAllocation {
  readonly id: string;
  readonly engagementId: string;
  readonly title: string;
  readonly start: string;
  readonly end: string;
  readonly status?: AllocationStatus;
  readonly current?: boolean;
  /** The person may open the engagement (false until the backend says so). */
  readonly canOpen?: boolean;
}

/** A bar on the allocation timeline: an engagement allocation or a team (default) allocation. */
export interface TimelineItem {
  readonly id: string;
  readonly kind: "engagement" | "default";
  readonly label: string;
  readonly allocationType: string;
  readonly code: string;
  readonly color?: string;
  readonly start: string;
  readonly end: string;
  readonly hourly?: HourlyWindow;
  readonly status?: string;
  readonly comment?: string;
  /** Default allocations that started at most 30 days ago. */
  readonly editable?: boolean;
}

export interface TimelinePerson {
  readonly person: EmployeeOption;
  readonly items: readonly TimelineItem[];
}

export interface BulkValidation {
  readonly errors: readonly string[];
  readonly valid: readonly { readonly line?: number; readonly email?: string; readonly allocationType?: string; readonly start?: string; readonly end?: string }[];
  readonly saved?: number;
}

// ---------------------------------------------------------------- travel

export interface TravelActions {
  readonly assign?: boolean;
  readonly update?: boolean;
  readonly editStatus?: boolean;
  readonly editAgency?: boolean;
  readonly editVisa?: boolean;
  readonly addPerDiem?: boolean;
  readonly deletePerDiem?: boolean;
  readonly addInvoice?: boolean;
  readonly addTravelCard?: boolean;
  readonly addPayment?: boolean;
  readonly editPayment?: boolean;
  readonly pushPayments?: boolean;
  readonly approveInvoicesPo?: boolean;
  readonly approveInvoices?: boolean;
  readonly pushInvoices?: boolean;
}

export interface TravelRequestSummary {
  readonly jobNumber: string;
  readonly status: TravelStatus;
  readonly traveller: Person;
  /** The traveller's base location. */
  readonly location?: string;
  readonly country: string;
  readonly city?: string;
  readonly start: string;
  readonly end: string;
  readonly travelAgent?: string;
  readonly visa?: string;
  /** Absent for a travel agent and for the finance-only roles. */
  readonly engagement?: { readonly id: string; readonly kind: EngagementKind; readonly typeName?: string; readonly account: string; readonly title: string };
  readonly campaign?: Campaign;
  readonly actions?: TravelActions;
}

export interface TravelRequest extends TravelRequestSummary {
  readonly scope: "full" | "agency" | "own";
  readonly visaId?: string;
  readonly engagementCode?: string;
  readonly engagementType?: string;
  readonly travelLocation?: string;
  /** View Funding Sources (Travel privilege 35). */
  readonly funding?: readonly FundingSource[];
  /** Which tabs the caller may open. */
  readonly tabs: { readonly perDiems: boolean; readonly invoices: boolean; readonly travelCards: boolean; readonly payments: boolean; readonly expenses: boolean };
  /** How many rows each tab holds, for the tabs the caller may open. Absent from a backend that does not count them. */
  readonly counts?: { readonly perDiems?: number; readonly invoices?: number; readonly payments?: number; readonly cardExpenses?: number; readonly expenseClaims?: number };
}

export interface PerDiem {
  readonly id: string;
  /** yyyy-MM-ddTHH:mm. */
  readonly start: string;
  readonly end: string;
  readonly days: number;
  readonly currency: string;
  readonly rate: number;
  readonly total: number;
  readonly canDelete?: boolean;
}

export interface NetSuiteState {
  /** Pushed once NetSuite confirmed it; Pushing while the push runs; Pending otherwise (a failed push too, with its error). */
  readonly nsStatus: "Pushed" | "Pushing" | "Pending";
  readonly nsReference?: string;
  /** Set when a push reached NetSuite but its status did not come back. */
  readonly nsError?: string;
}

export interface Invoice extends NetSuiteState {
  readonly id: string;
  readonly number: string;
  readonly jobNumber: string;
  readonly traveller?: Person;
  readonly travelAgent: string;
  readonly costType: string;
  readonly month: string;
  readonly amount: number;
  readonly currency: string;
  readonly paidAmount?: number;
  readonly paidCurrency?: string;
  readonly status: InvoiceStatus;
  readonly poApproval?: ApprovalState;
  readonly financeApproval?: ApprovalState;
  readonly rejectReason?: string;
  readonly addedDate: string;
  readonly addedBy?: string;
  readonly campaign?: Campaign;
  readonly actions?: { readonly approvePo?: boolean; readonly approve?: boolean; readonly reject?: boolean; readonly push?: boolean; readonly resync?: boolean };
}

/** A credit card transaction tagged with the travel (Credit Card Expenses). */
export interface CardExpense {
  readonly id: string;
  readonly date?: string;
  readonly expenseType?: string;
  readonly reference?: string;
  readonly amount?: number;
  readonly currency?: string;
  readonly employee?: string;
  readonly status: string;
}

/** An expense claim line tagged with the travel (Expense Claims). */
export interface ExpenseClaim {
  readonly id: string;
  readonly claimNumber?: string;
  readonly date?: string;
  readonly expenseType?: string;
  readonly amount?: number;
  readonly currency?: string;
  readonly reimbursementAmount?: number;
  readonly reimbursementCurrency?: string;
  readonly employee?: string;
  readonly status: string;
}

export interface TripExpenses {
  readonly cardExpenses: readonly CardExpense[];
  readonly expenseClaims: readonly ExpenseClaim[];
}

export interface TravelCard {
  readonly id: string;
  readonly currency: string;
  readonly amount: number;
  readonly addedDate: string;
  readonly addedBy?: string;
}

export interface PerDiemPayment extends NetSuiteState {
  readonly id: string;
  readonly jobNumber: string;
  readonly traveller?: Person;
  readonly amount: number;
  readonly currency: string;
  readonly convertedAmount?: number;
  readonly convertedCurrency?: string;
  readonly status: PaymentStatus;
  readonly addedDate: string;
  readonly addedBy?: string;
  readonly campaign?: Campaign;
  readonly actions?: { readonly edit?: boolean; readonly push?: boolean; readonly resync?: boolean };
}

/** The legacy Payment Summary, in the per diem currency. Absent with no per diems. */
export interface PaymentSummary {
  readonly currency: string;
  readonly totalPerDiem: number;
  readonly initialCurrencyPaid: number;
  readonly travelCards: number;
  readonly paid: number;
  readonly remaining: number;
  readonly convertedCurrency?: string;
}

export interface TripPayments {
  readonly items: readonly PerDiemPayment[];
  readonly summary?: PaymentSummary;
}

export interface VisaOption {
  /** A visa id, or one of the two legacy sentinels. */
  readonly id: string;
  readonly label: string;
}

/** A row of NS Sync Failures. */
export interface SyncFailure extends NetSuiteState {
  readonly record: "invoice" | "payment";
  readonly id: string;
  readonly number: string;
  readonly travelAgent?: string;
  readonly jobNumber: string;
  readonly traveller?: Person;
  readonly amount: number;
  readonly currency: string;
}

/** The per-record outcome of a bulk action. */
export interface BatchOutcome {
  readonly done: readonly string[];
  readonly failed: readonly { readonly id: string; readonly message: string }[];
}

// ---------------------------------------------------------------- visas and documents

export interface Visa {
  readonly id: string;
  readonly kind: "visa";
  readonly owner?: Person;
  readonly country: string;
  readonly visaType: string;
  readonly entryType: string;
  readonly start: string;
  readonly end: string;
  readonly issued?: string;
  readonly passport?: string;
  readonly passportId?: string;
  readonly status: "Active" | "Inactive" | "Expired";
  readonly hasFile?: boolean;
}

export interface TravelDocument {
  readonly id: string;
  readonly kind: "document";
  readonly owner?: Person;
  readonly type: string;
  /** Masked by the backend: first character, five dots, last three. */
  readonly number: string;
  /** The full number: only from GET /travel-documents/{id}, to holders of Edit Travel Document. */
  readonly fullNumber?: string;
  readonly country: string;
  readonly issued?: string;
  readonly expires?: string;
  readonly status: "Active" | "Inactive" | "Expired";
  readonly hasFile?: boolean;
}

// ---------------------------------------------------------------- reference data and lookups

export interface AllocationTypeDef {
  readonly id: string;
  readonly engagementTypeId: EngagementTypeId;
  readonly name: string;
  readonly department?: string;
  readonly code?: string;
  readonly suffix?: string;
  readonly color?: string;
  readonly notifyToAllocations?: "Yes" | "No";
}

export interface EngagementTypeDef {
  readonly id: EngagementTypeId;
  readonly name: string;
  readonly kind: "Customer" | "Internal";
  readonly active: boolean;
  /** Active allocation types, in the legacy dropdown order. */
  readonly allocationTypes: readonly AllocationTypeDef[];
}

export interface ProductUnitDef {
  readonly name: string;
  readonly businessUnit?: string;
  readonly customer: boolean;
  readonly internal: boolean;
  readonly marketing: boolean;
}

export interface ReferenceData {
  readonly engagementTypes: readonly EngagementTypeDef[];
  readonly businessUnits: readonly string[];
  /** Business units with their ids, for the Allocations Today filter. */
  readonly businessUnitIds: Readonly<Record<string, number>>;
  readonly productUnits: readonly ProductUnitDef[];
  readonly regions: readonly { readonly name: string; readonly subRegions: readonly string[] }[];
  readonly subRegions: readonly string[];
  readonly countries: readonly string[];
  readonly travelAgents: readonly string[];
  readonly costTypes: readonly string[];
  readonly perDiemRates: readonly { readonly country: string; readonly currency: string; readonly amount: number }[];
  readonly currencies: readonly string[];
  readonly timeZones: readonly string[];
}

export interface OrgStructure {
  readonly businessUnits: readonly string[];
  readonly departments: readonly { readonly name: string; readonly businessUnit: string }[];
  readonly teams: readonly { readonly name: string; readonly businessUnit: string; readonly department: string }[];
}

export interface SalesforceAccount {
  readonly id: string;
  readonly name: string;
  readonly country?: string;
  readonly subRegion?: string;
  readonly address?: string;
}

export interface OpportunityLineItem {
  readonly id: string;
  readonly product: string;
  readonly code?: string;
  readonly description?: string;
  readonly start?: string;
  readonly end?: string;
  readonly businessUnit?: string;
  readonly productUnit?: string;
  readonly tentativeDates?: boolean;
}

export interface Opportunity {
  readonly id: string;
  readonly name: string;
  readonly owner?: string;
  readonly technicalOwner?: string;
  readonly won?: boolean;
  readonly preSalesCode?: string;
  readonly postSalesCode?: string;
  readonly address?: string;
  readonly lineItems: readonly OpportunityLineItem[];
}

export interface EmployeeOption extends Person {
  readonly title?: string;
  readonly team?: string;
  readonly jobBand?: string;
}

export interface RoleSetting {
  readonly id: string;
  /** The Asgardeo group. */
  readonly role: string;
  readonly privileges: readonly number[];
}

export interface PrivilegeDef {
  readonly id: number;
  readonly name: string;
  readonly description?: string;
}

export interface RoleSettings {
  readonly roles: readonly RoleSetting[];
  readonly privileges: readonly PrivilegeDef[];
}

// ---------------------------------------------------------------- dashboard and reports

export interface CountRow {
  readonly label: string;
  readonly count: number;
}

export interface MonthValue {
  /** yyyy-MM. */
  readonly month: string;
  readonly value: number;
}

/** A Waiting on You tile: the server's label and count, and the list it opens. */
export interface QueueTile {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  readonly highlighted: boolean;
  /** The screen path the tile opens (with its filter), or none when it maps to no screen. */
  readonly to?: string;
}

export interface UpcomingTrip {
  readonly jobNumber: string;
  readonly traveller: Person;
  readonly country: string;
  readonly city?: string;
  readonly start: string;
  readonly end: string;
  readonly travelAgent?: string;
  readonly status?: TravelStatus;
}

/** A cost source, as the backend names it. */
export type CostSource = "invoice" | "perDiem" | "card" | "claim";

/** An amount left out of the USD totals because no rate was found for its currency. */
export interface NotConverted {
  readonly source: CostSource;
  /** Blank when the source did not record a currency. */
  readonly currency: string;
  readonly amount: number;
  readonly lines?: number;
}

export interface Dashboard {
  /** The business date (UTC) the backend computed for; absent from an older backend. */
  readonly date?: string;
  /** Every widget the caller may see, in catalogue order. Absent from an older backend. */
  readonly widgets?: readonly WidgetRef[];
  readonly travelTeam?: TravelTeamStats;
  readonly engagementManager?: EngagementManagerStats;
  readonly accountManager?: AccountManagerStats;
  readonly marketingEvents?: MarketingEventStats;
  /** Sections the backend could not build; each is omitted from the response. */
  readonly failed: readonly string[];
  readonly queue?: readonly QueueTile[];
  readonly allocationsOverTime?: {
    readonly byMonth: readonly MonthValue[];
    readonly byBusinessUnit: readonly CountRow[];
  };
  readonly engagements?: {
    readonly startingSoon: readonly {
      readonly id: string;
      readonly kind: EngagementKind;
      readonly typeName: string;
      readonly account: string;
      readonly title: string;
      readonly country: string;
      readonly city?: string;
      readonly start: string;
      readonly end: string;
      readonly consultantCount: number;
    }[];
    readonly total: number;
  };
  readonly available?: { readonly available: number; readonly allocated: number; readonly byBusinessUnit: readonly CountRow[] };
  readonly travel?: {
    readonly inProgress: number;
    readonly startingIn30Days: number;
    readonly completedThisMonth: number;
    readonly tripsIn12Months: number;
    readonly upcoming: readonly UpcomingTrip[];
    readonly upcomingTotal: number;
    readonly topDestinations: readonly CountRow[];
    readonly byMonth: readonly MonthValue[];
    readonly byTravelAgent: readonly CountRow[];
  };
  /** The travel agent's own dashboard; present instead of the sections above. */
  readonly agency?: {
    readonly name: string;
    readonly inProgress: number;
    readonly startingIn7Days: number;
    readonly completedWithoutInvoice: number;
    readonly invoicesRejected: number;
    readonly upcoming: readonly UpcomingTrip[];
    readonly upcomingTotal: number;
    readonly invoicesByStatus: readonly CountRow[];
    readonly tripsByMonth: readonly MonthValue[];
  };
}

/** GET /dashboard/allocations-today: the legacy Allocations dashboard. */
export interface AllocationsToday {
  readonly date: string;
  readonly total: number;
  readonly consultants: number;
  readonly paid: number;
  readonly nonPaid: number;
  readonly byEngagementType: readonly CountRow[];
  readonly paidByAllocationType: readonly CountRow[];
  readonly nonPaidByAllocationType: readonly CountRow[];
}

/** One row of the Consultant Allocations report (the legacy 18 columns). */
export interface ConsultantAllocationRow {
  readonly engagementTypeName: string;
  readonly engagementNature: string;
  readonly country: string;
  readonly allocationTypeName: string;
  readonly email: string;
  readonly department: string;
  readonly businessUnit: string;
  readonly company: string;
  readonly engagementCode: string;
  readonly dailyHourly: "Daily" | "Hourly";
  readonly calendarDays: number;
  readonly workingDays: number;
  readonly workingHours?: number;
  readonly engagementBusinessUnit: string;
  readonly engagementSalesPOD: string;
  readonly engagementGroup: string;
  readonly accountName: string;
  readonly glCode: string;
}

/** GET /me/overview: the Me overview card. Both lists empty means no card. */
export interface MyOverview {
  readonly tripVisas?: readonly TripVisa[];
  readonly allocations: readonly UpcomingAllocation[];
  readonly trips: readonly UpcomingTrip[];
}

// ---------------------------------------------------------------- search

/** The kinds of record global search finds, in the order the backend lists them. */
export const SEARCH_KINDS = ["travelRequests", "invoices", "perDiemPayments", "engagements", "allocations"] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

export interface SearchItem {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly status?: string;
  /** Engagements only. */
  readonly segment?: EngagementKind;
  /** Invoices and per diem payments: the travel request they belong to. */
  readonly jobNumber?: string;
}

export interface SearchGroup {
  readonly kind: SearchKind;
  /** Every match, of which `items` is the first few. */
  readonly total: number;
  readonly items: readonly SearchItem[];
}

export interface SearchResults {
  readonly query: string;
  readonly groups: readonly SearchGroup[];
  readonly failed: readonly SearchKind[];
}
