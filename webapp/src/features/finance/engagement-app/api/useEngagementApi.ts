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

// Every Engagement App read, one hook per screen's data.

import { useQueries, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { authedGet } from "@api/http";
import { httpRetry } from "@api/errors";
import { engagementServiceUrls as urls, type EngagementQueryParams } from "@config/apiConfig";
import { foldIdentityError } from "@hooks/useAsgardeoSub";
import { useEngagementBasis } from "./engagementBasis";
import * as DM from "./dashboardMappers";
import * as M from "./engagementMappers";
import { SEARCH_MIN_CHARS } from "../model/searchLinks";
import { readSessionCache, writeSessionCache } from "./sessionCache";
import type * as V from "./engagementTypes";
import type * as W from "./engagementWire";

const MINUTE = 60 * 1000;
/** How long an answer nobody is looking at is kept, so a page opened again within it shows at once. */
const CACHE_TIME = 30 * MINUTE;
/** How long an answer counts as fresh unless a hook says otherwise: a page opened again within it does not ask again. */
const FRESH_TIME = MINUTE / 2;

/** One GET against the Engagement App Backend, keyed by `parts`, mapped by `select`. */
function useEngagementGet<TWire, TView>(
  parts: readonly unknown[],
  url: string,
  select: (wire: TWire) => TView,
  {
    enabled = true,
    staleTime = FRESH_TIME,
    keepPrevious = false,
    persist,
    expectForbidden = false,
  }: {
    enabled?: boolean;
    staleTime?: number;
    keepPrevious?: boolean;
    /** Keep a copy of the answer in sessionStorage and start from it on a reload (stale, so it is asked again at once). `keep` trims what is kept, or returns undefined to keep nothing. */
    persist?: { readonly name: string; readonly keep: (wire: TWire) => TWire | undefined };
    /** A 403 is a normal answer here (the card is hidden), so it must not make the app re-ask /user-info. */
    expectForbidden?: boolean;
  } = {},
): UseQueryResult<TView, Error> {
  const { getToken, ready, key, sub, subState, retryIdentity } = useEngagementBasis();
  const query = useQuery<TWire, Error, TView>({
    queryKey: key(...parts),
    queryFn: async () => {
      const wire = await authedGet<TWire>(url, await getToken());
      if (persist) {
        const kept = persist.keep(wire);
        if (kept !== undefined) writeSessionCache(persist.name, sub, kept);
      }
      return wire;
    },
    select,
    meta: expectForbidden ? { expectForbidden: true } : undefined,
    enabled: ready && enabled,
    staleTime,
    initialData: persist ? () => readSessionCache<TWire>(persist.name, sub) : undefined,
    initialDataUpdatedAt: 0,
    // The app's client does not refetch on mount, so a page opened again would show what it last held. Here it shows that at once and
    // asks again quietly once the answer is older than `staleTime` (a copy from a reload is updated at 0, so always). A change made in
    // the app still asks again at once: mutations invalidate what they affect.
    refetchOnMount: true,
    gcTime: CACHE_TIME,
    retry: httpRetry,
    // Keep the previous result (its total, for the pager) while the next page loads, the table showing a skeleton meanwhile; never another subject's rows (key[1] is the subject).
    placeholderData: keepPrevious ? (previous, previousQuery) => (previousQuery?.queryKey[1] === sub ? previous : undefined) : undefined,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

const items =
  <TW, TV>(map: (x: TW) => TV) =>
  (w: W.WItems<TW>): readonly TV[] =>
    w.items.map(map);
const pageOf =
  <TW, TV>(map: (x: TW) => TV) =>
  (w: W.WPage<TW>): V.Page<TV> =>
    M.page(w, map);

// ---------------------------------------------------------------- search

/** Global search: `limit` hits per kind. Asked only for a query of two characters or more, once `enabled`. */
export const useEngagementSearch = (q: string, limit: number, enabled = true) => {
  // The backend takes 2 to 200 characters.
  const text = q.trim().slice(0, 200);
  return useEngagementGet(["search", text, limit], urls.search(text, limit), M.searchResults, {
    enabled: enabled && text.length >= SEARCH_MIN_CHARS,
    staleTime: MINUTE,
    keepPrevious: true,
  });
};

// ---------------------------------------------------------------- reference

export const useReferenceData = () =>
  useEngagementGet(["reference-data"], urls.referenceData, M.referenceData, { staleTime: 30 * MINUTE });

/** Engagement types with their active allocation types: part of the reference data. */
export function useEngagementTypes(): UseQueryResult<readonly V.EngagementTypeDef[], Error> {
  return useEngagementGet(["reference-data"], urls.referenceData, (w: W.WReferenceData) => M.referenceData(w).engagementTypes, {
    staleTime: 30 * MINUTE,
  });
}

export const useOrgStructure = (enabled = true) =>
  useEngagementGet(["org-structure"], urls.orgStructure, M.orgStructure, { enabled, staleTime: 30 * MINUTE });

export const useCampaigns = (search: string, enabled = true) =>
  useEngagementGet(["campaigns", search], urls.campaigns(search), items(M.campaignOf), {
    enabled,
    staleTime: 5 * MINUTE,
    keepPrevious: true,
  });

/** The Salesforce account search-as-you-type: asks from two letters. */
export const useAccounts = (search: string) =>
  useEngagementGet(["accounts", search], urls.accounts(search), items(M.account), {
    enabled: search.trim().length >= 2,
    staleTime: 5 * MINUTE,
    keepPrevious: true,
  });

export const useOpportunities = (accountId: string | undefined, engagementTypeId?: number) =>
  useEngagementGet(["opportunities", accountId, engagementTypeId], urls.accountOpportunities(accountId ?? "", engagementTypeId), items(M.opportunity), {
    enabled: Boolean(accountId),
    staleTime: 5 * MINUTE,
  });

/** Employees by name or email, from two letters. */
export const useEmployees = (search: string, enabled = true, limit = 20) =>
  useEngagementGet(["employees", search, limit], urls.employees(search, limit), items(M.employee), {
    enabled: enabled && search.trim().length >= 2,
    staleTime: 5 * MINUTE,
    keepPrevious: true,
  });

// ---------------------------------------------------------------- dashboard

/**
 * The widget catalogue: the business date and the widgets the caller may see, with no section computed (`sections=` empty), so it answers
 * quickly. The widgets are kept for a reload, the date is not (a copy would be a day old after midnight). A travel agent's answer carries
 * the agent dashboard instead of widgets, and is not kept.
 */
export const useDashboardCatalogue = (enabled = true) =>
  useEngagementGet(["dashboard", "catalogue"], urls.dashboardCatalogue, M.dashboard, {
    enabled,
    persist: {
      name: "dashboard-catalogue",
      keep: (w: W.WDashboard) => (w.agent || !w.widgets?.length ? undefined : { widgets: w.widgets, failedSections: [] }),
    },
  });

/** One request per group of sections, all at once. A group is the sections that share one entity call, so none is asked for twice. */
export function useDashboardSectionGroups(groups: readonly (readonly string[])[], enabled: readonly boolean[]): UseQueryResult<V.Dashboard, Error>[] {
  const { getToken, ready, key } = useEngagementBasis();
  return useQueries({
    queries: groups.map((sections, i) => ({
      queryKey: key("dashboard", "sections", [...sections].sort()),
      queryFn: async () => authedGet<W.WDashboard>(urls.dashboardSections(sections), await getToken()),
      select: M.dashboard,
      enabled: ready && Boolean(enabled[i]) && sections.length > 0,
      staleTime: FRESH_TIME,
      refetchOnMount: true,
      gcTime: CACHE_TIME,
      retry: httpRetry,
    })),
  }) as UseQueryResult<V.Dashboard, Error>[];
}

/** Travel Costs: one summary query for every cost widget. Keeps the last answer on screen while a new range or filter loads. */
export const useTravelCosts = (params: EngagementQueryParams, enabled = true) =>
  useEngagementGet(["dashboard", "travel-costs", params], urls.travelCosts(params), DM.travelCosts, { enabled, staleTime: MINUTE, keepPrevious: true });

export const useTravelCostTransactions = (params: EngagementQueryParams, enabled = true) =>
  useEngagementGet(["dashboard", "travel-cost-transactions", params], urls.travelCostTransactions(params), DM.costTransactions, {
    enabled,
    staleTime: MINUTE,
    keepPrevious: true,
  });

export const useAllocationsToday = (params: EngagementQueryParams, enabled = true) =>
  useEngagementGet(["dashboard", "allocations-today", params], urls.allocationsToday(params), M.allocationsToday, { enabled, keepPrevious: true });

// ---------------------------------------------------------------- engagements

export const useApprovals = (segment: "internal" | "events", params: EngagementQueryParams = {}, enabled = true) =>
  useEngagementGet(["approvals", segment, params], urls.approvals({ segment, ...params }), pageOf(M.engagementSummary), { enabled, keepPrevious: true });

export const useEngagements = (params: EngagementQueryParams, enabled = true) =>
  useEngagementGet(["engagements", "list", params], urls.engagements(params), pageOf(M.engagementSummary), {
    enabled,
    keepPrevious: true,
  });

export const useEngagementFacets = (segment: string, enabled = true) =>
  useEngagementGet(
    ["engagements", "facets", segment],
    urls.engagementFacets(segment),
    (w: { accounts: string[]; allocationTypes: string[]; countries: string[] }) => w,
    { enabled, staleTime: 5 * MINUTE },
  );

export const useEngagement = (id: string | undefined) =>
  useEngagementGet(["engagements", "one", id], urls.engagement(id ?? ""), M.engagementDetail, { enabled: Boolean(id) });

// ---------------------------------------------------------------- allocations

export const useAllocations = (params: EngagementQueryParams, enabled = true) =>
  useEngagementGet(["allocations", params], urls.allocations(params), pageOf((a: W.WAllocationWithEngagement) => M.allocation(a)), {
    enabled,
    keepPrevious: true,
  });

/** The Allocate page's timeline: people by email, or by business unit / department / team. */
export const useAllocationTimeline = (params: EngagementQueryParams, enabled = true) =>
  useEngagementGet(["allocations", "timeline", params], urls.allocationTimeline(params), (w: { people: W.WTimelineRow[] }) => w.people.map(M.timelinePerson), {
    enabled,
    keepPrevious: true,
  });

/** Team Allocations: a team's people and their default (and engagement) allocations. */
export const useTeamAllocations = (params: EngagementQueryParams, enabled = true) =>
  useEngagementGet(["team-allocations", params], urls.teamAllocations(params), (w: { people: W.WTimelineRow[] }) => w.people.map(M.timelinePerson), {
    enabled,
    keepPrevious: true,
  });

// ---------------------------------------------------------------- travel

export const useTravelRequests = (params: EngagementQueryParams, enabled = true) =>
  useEngagementGet(["travel-requests", "list", params], urls.travelRequests(params), pageOf(M.travelSummary), {
    enabled,
    keepPrevious: true,
  });

export const useTravelRequest = (jobNumber: string | undefined) =>
  useEngagementGet(["travel-requests", "one", jobNumber], urls.travelRequest(jobNumber ?? ""), M.travelDetail, { enabled: Boolean(jobNumber) });

export const useVisaOptions = (jobNumber: string, enabled = true) =>
  useEngagementGet(
    ["travel-requests", "visa-options", jobNumber],
    urls.visaOptions(jobNumber),
    (w: W.WItems<{ value: string; label: string }>): readonly V.VisaOption[] => w.items.map((o) => ({ id: o.value, label: o.label })),
    { enabled },
  );

export const useTripPerDiems = (jobNumber: string, enabled = true) =>
  useEngagementGet(["travel-requests", "per-diems", jobNumber], urls.perDiems(jobNumber), items(M.perDiem), { enabled });

export const useTripInvoices = (jobNumber: string, enabled = true) =>
  useEngagementGet(["travel-requests", "invoices", jobNumber], urls.tripInvoices(jobNumber), (w: W.WPage<W.WInvoice>) => w.items.map(M.invoice), {
    enabled,
  });

export const useTripCards = (jobNumber: string, enabled = true) =>
  useEngagementGet(["travel-requests", "travel-cards", jobNumber], urls.travelCards(jobNumber), items(M.travelCard), { enabled });

export const useTripExpenses = (jobNumber: string, enabled = true) =>
  useEngagementGet(["travel-requests", "expenses", jobNumber], urls.tripExpenses(jobNumber), M.tripExpenses, { enabled });

/** The cost so far of a travel request. A 403 or 404 is not retried: the card is then hidden. */
export const useJobCostSummary = (jobNumber: string, enabled = true) =>
  useEngagementGet(["travel-requests", "cost-summary", jobNumber], urls.jobCostSummary(jobNumber), DM.jobCostSummary, { enabled, expectForbidden: true });

export const useTripPayments = (jobNumber: string, enabled = true) =>
  useEngagementGet(["travel-requests", "payments", jobNumber], urls.tripPayments(jobNumber), M.tripPayments, { enabled });

// ---------------------------------------------------------------- invoices and payments

export const useInvoices = (params: EngagementQueryParams, enabled = true) =>
  useEngagementGet(["invoices", params], urls.invoices(params), pageOf(M.invoice), { enabled, keepPrevious: true });

export const usePerDiemPayments = (params: EngagementQueryParams, enabled = true) =>
  useEngagementGet(["per-diem-payments", params], urls.perDiemPayments(params), pageOf(M.payment), {
    enabled,
    keepPrevious: true,
  });

export const useSyncFailures = (params: EngagementQueryParams = {}, enabled = true) =>
  useEngagementGet(["ns-sync-failures", params], urls.netSuiteSyncFailures(params), pageOf(M.syncFailure), { enabled, keepPrevious: true });

// ---------------------------------------------------------------- reports

export const useConsultantReport = (params: EngagementQueryParams, enabled: boolean) =>
  useEngagementGet(["reports", "consultant-allocations", params], urls.report("consultant-allocations", params), items(M.consultantRow), {
    enabled,
    keepPrevious: true,
  });

export const useInvoiceReport = (params: EngagementQueryParams, enabled: boolean) =>
  useEngagementGet(["reports", "invoices", params], urls.report("invoices", params), (w: W.WPage<W.WInvoice>) => w.items.map(M.invoice), { enabled, keepPrevious: true });

export const usePaymentReport = (params: EngagementQueryParams, enabled: boolean) =>
  useEngagementGet(["reports", "per-diem-payments", params], urls.report("per-diem-payments", params), (w: W.WPage<W.WPerDiemPayment>) => w.items.map(M.payment), {
    enabled,
    keepPrevious: true,
  });

// ---------------------------------------------------------------- visas and documents

export const useVisas = (params: EngagementQueryParams, enabled = true) =>
  useEngagementGet(["visas", params], urls.visas(params), pageOf(M.visa), { enabled, keepPrevious: true });

export const useTravelDocuments = (params: EngagementQueryParams, enabled = true) =>
  useEngagementGet(["travel-documents", params], urls.travelDocuments(params), pageOf(M.travelDocument), { enabled, keepPrevious: true });

/** One travel document with its full number, to prefill Edit Travel Document. */
export const useTravelDocument = (id: string | undefined, enabled = true) =>
  useEngagementGet(["travel-documents", "one", id], urls.travelDocument(id ?? ""), M.travelDocument, { enabled: enabled && Boolean(id) });

/** A traveller's passports for the visa form; the person's own with `email` undefined. */
export const usePassports = (email: string | undefined, own: boolean, enabled = true) =>
  useEngagementGet(
    ["passports", own ? "me" : email],
    own ? urls.myPassports : urls.travellerPassports(email ?? ""),
    (w: W.WPage<W.WTravelDocument>) => w.items.map(M.travelDocument),
    { enabled: enabled && (own || Boolean(email)) },
  );

// ---------------------------------------------------------------- settings

export const useAllocationTypes = (enabled = true) =>
  useEngagementGet(["settings", "allocation-types"], urls.allocationTypes(), items(M.allocationType), { enabled });

export const useRoleSettings = (app: "allocations" | "travel", enabled = true) =>
  useEngagementGet(["settings", "roles", app], urls.roleSettings(app), M.roleSettings, { enabled });


// ---------------------------------------------------------------- me

export const useMyTravelRequests = (enabled = true) =>
  useEngagementGet(["me", "travel-requests"], urls.myTravelRequests({ limit: 500 }), (w: W.WPage<W.WTravelRequestSummary>) => w.items.map(M.travelSummary), {
    enabled,
  });

export const useMyVisas = (enabled = true) =>
  useEngagementGet(["me", "visas"], urls.myVisas(), (w: W.WPage<W.WVisa>) => w.items.map(M.visa), { enabled });

export const useMyTravelDocuments = (enabled = true) =>
  useEngagementGet(["me", "travel-documents"], urls.myTravelDocuments, (w: W.WPage<W.WTravelDocument>) => w.items.map(M.travelDocument), {
    enabled,
  });

export const useMyAllocations = (params: EngagementQueryParams, enabled = true) =>
  useEngagementGet(["me", "allocations", params], urls.myAllocations(params), pageOf((a: W.WAllocationWithEngagement) => M.allocation(a)), {
    enabled,
    keepPrevious: true,
  });

export const useMyOverview = (enabled = true) =>
  useEngagementGet(["me", "overview"], urls.myOverview, M.myOverview, { enabled, staleTime: 5 * MINUTE });
