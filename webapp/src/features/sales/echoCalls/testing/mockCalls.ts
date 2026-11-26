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

// TEST DATA ONLY. Invented calls, people, accounts and opportunities — none of them real —
// and in-memory stand-ins for the Echo calls and call-context clients that answer from
// them the way the backend is specified to: filtered, paged, newest first. Nothing outside
// the tests reads this.

import type { Meeting } from "../../api/salesTypes";
import type { CallContextClient } from "../../callContext/api/callContextClient";
import type { CallContextResponse, ContextAccount, ContextOpportunity } from "../../callContext/types";
import type { EchoCallsClient, EchoCallsQuery } from "../api/echoCallsClient";
import type { CallFilterOptions, EchoCall, StoredCallContext } from "../types";

const account = (
  id: string,
  name: string,
  salesRegion: string,
  region: string,
  owner: [string, string],
  technicalOwner: [string, string] | null,
): ContextAccount => ({
  id,
  name,
  region,
  salesRegion,
  ownerName: owner[0],
  ownerEmail: owner[1],
  technicalOwnerName: technicalOwner?.[0] ?? null,
  technicalOwnerEmail: technicalOwner?.[1] ?? null,
});

export const ACCOUNTS: Record<string, ContextAccount> = Object.fromEntries(
  [
    account("001Hb00000Harbr001", "Harbourline", "APAC", "Asia Pacific", ["Nadia Perera", "nadia@wso2.com"], ["Tharindu Silva", "tharindu@wso2.com"]),
    account("001Hb00000Nordl001", "Nordlys Energi AS", "EU", "Europe", ["Lars Holm", "lars@wso2.com"], ["Ingrid Dahl", "ingrid@wso2.com"]),
    account("001Hb00000Brwtr001", "Brightwater Health", "NA", "North America", ["Maya Chen", "maya@wso2.com"], null),
    account("001Hb00000Andes001", "Andes Logística", "LATAM", "Latin America", ["Diego Ramos", "diego@wso2.com"], ["Lucía Vega", "lucia@wso2.com"]),
    account("001Hb00000Merid001", "Meridian Bank", "EU", "Europe", ["Lars Holm", "lars@wso2.com"], null),
  ].map((a) => [a.id, a]),
);

const opportunity = (
  id: string,
  name: string,
  accountId: string,
  owner: [string, string] | null,
  stage: string,
  amount: number,
  closeDate: string,
  salesRegion: string | null,
): ContextOpportunity => ({
  id,
  name,
  ownerName: owner?.[0] ?? null,
  ownerEmail: owner?.[1] ?? null,
  salesRegion,
  stage,
  recordType: "First Sale",
  amount,
  currency: "USD",
  closeDate,
  isClosed: false,
  accountId,
  accountName: ACCOUNTS[accountId]?.name ?? null,
});

export const OPPORTUNITIES: Record<string, ContextOpportunity> = Object.fromEntries(
  [
    opportunity("006Hb00000Harbr001", "Harbourline – API platform", "001Hb00000Harbr001", ["Nadia Perera", "nadia@wso2.com"], "Qualify", 120000, "2026-12-15", "APAC"),
    opportunity("006Hb00000Harbr002", "Harbourline – Identity add-on", "001Hb00000Harbr001", ["Nadia Perera", "nadia@wso2.com"], "Discovery", 45000, "2027-02-28", "APAC"),
    opportunity("006Hb00000Nordl001", "Nordlys – IAM renewal", "001Hb00000Nordl001", ["Lars Holm", "lars@wso2.com"], "Negotiate", 310000, "2026-12-31", "EU"),
    opportunity("006Hb00000Brwtr001", "Brightwater – integration expansion", "001Hb00000Brwtr001", ["Maya Chen", "maya@wso2.com"], "Validate", 85000, "2027-01-20", "NA"),
    opportunity("006Hb00000Andes001", "Andes – integration first sale", "001Hb00000Andes001", ["Diego Ramos", "diego@wso2.com"], "Propose", 150000, "2027-03-10", null),
    opportunity("006Hb00000Merid001", "Meridian – identity migration", "001Hb00000Merid001", null, "Discovery", 200000, "2027-04-30", "EU"),
  ].map((o) => [o.id, o]),
);

let nextId = 101;
const call = (
  title: string,
  host: string,
  start: string,
  minutes: number,
  meetingType: string,
  link: { opportunityId?: string; accountId?: string; leadId?: string; leadCompany?: string } = {},
): Meeting => {
  const startDate = new Date(`${start.replace(" ", "T")}Z`);
  const end = new Date(startDate.getTime() + minutes * 60 * 1000).toISOString().slice(0, 19).replace("T", " ");
  const opp = link.opportunityId ? OPPORTUNITIES[link.opportunityId] : undefined;
  return {
    meetingId: nextId++,
    title,
    googleEventId: `evt-${nextId}`,
    host,
    startTime: start,
    endTime: end,
    internalParticipants: host,
    externalParticipants: null,
    meetingStatus: "ACTIVE",
    timeStatus: "PAST",
    isRecurring: false,
    meetingType,
    opportunityId: link.opportunityId ?? null,
    // The snapshot the add-on takes on linking: the account and the deal as they were then.
    opportunityDetails: opp
      ? JSON.stringify({
          customerId: opp.accountId,
          customerName: opp.accountName,
          stage: "Discovery",
          amount: Math.round((opp.amount ?? 0) * 0.8),
          currency: "USD",
          closeDate: "2026-11-30",
          isClosed: false,
        })
      : null,
    accountId: link.accountId ?? null,
    accountName: link.accountId ? ACCOUNTS[link.accountId].name : null,
    leadId: link.leadId ?? null,
    leadCompany: link.leadCompany ?? null,
  };
};

/** Fourteen past calls: opportunity-linked, account-only, a lead's, and unlinked. */
export const MEETINGS: Meeting[] = [
  call("Harbourline – technical deep dive", "nadia@wso2.com", "2026-11-25 04:30:00", 60, "first_sale", { opportunityId: "006Hb00000Harbr001" }),
  call("Nordlys – commercial terms", "lars@wso2.com", "2026-11-24 09:00:00", 45, "renewal", { opportunityId: "006Hb00000Nordl001" }),
  call("Brightwater – architecture review", "sameera@wso2.com", "2026-11-21 15:00:00", 50, "expansion", { opportunityId: "006Hb00000Brwtr001" }),
  call("Kestrel Labs – intro", "amal@wso2.com", "2026-11-20 11:00:00", 30, "inbound", { leadId: "00QHb00000Kestr001", leadCompany: "Kestrel Labs" }),
  call("Meridian Bank – monthly sync", "lars@wso2.com", "2026-11-19 08:30:00", 30, "monthly_weekly", { accountId: "001Hb00000Merid001" }),
  call("Andes – solution proposal", "diego@wso2.com", "2026-11-18 14:00:00", 75, "first_sale", { opportunityId: "006Hb00000Andes001" }),
  call("Deal desk prep – Q4 commits", "amal@wso2.com", "2026-11-17 06:00:00", 30, "internal"),
  call("Harbourline – quarterly business review", "nadia@wso2.com", "2026-11-14 03:00:00", 60, "monthly_weekly", { accountId: "001Hb00000Harbr001" }),
  call("Meridian – identity discovery", "priya@wso2.com", "2026-11-13 10:00:00", 45, "outbound", { opportunityId: "006Hb00000Merid001" }),
  call("Nordlys – security questionnaire", "lars@wso2.com", "2026-11-11 12:00:00", 40, "renewal", { opportunityId: "006Hb00000Nordl001" }),
  call("Brightwater – usage check-in", "maya@wso2.com", "2026-11-07 16:00:00", 30, "monthly_weekly", { accountId: "001Hb00000Brwtr001" }),
  call("Harbourline – identity add-on scoping", "nadia@wso2.com", "2026-11-05 05:00:00", 45, "expansion", { opportunityId: "006Hb00000Harbr002" }),
  call("Andes – kickoff", "diego@wso2.com", "2026-10-29 13:00:00", 30, "outbound", { accountId: "001Hb00000Andes001" }),
  call("Nordlys – renewal kickoff", "lars@wso2.com", "2026-10-22 09:30:00", 45, "renewal", { opportunityId: "006Hb00000Nordl001" }),
];

/** The context the Echo backend stores for a call, built the way it is specified to. */
export function storedContextOf(meeting: Meeting): StoredCallContext {
  const opp = meeting.opportunityId ? OPPORTUNITIES[meeting.opportunityId] : undefined;
  // Only a call's own account link: an opportunity's account rides on the opportunity.
  const acc = meeting.accountId ? ACCOUNTS[meeting.accountId] : undefined;
  const ownerEmail = opp?.ownerEmail ?? null;
  return {
    opportunity: opp
      ? {
          id: opp.id,
          name: opp.name,
          ownerName: opp.ownerName,
          ownerEmail: opp.ownerEmail,
          salesRegion: opp.salesRegion,
          stage: opp.stage,
          accountId: opp.accountId,
          accountName: opp.accountName,
        }
      : null,
    account: acc
      ? {
          id: acc.id,
          name: acc.name,
          region: acc.salesRegion,
          ownerName: acc.ownerName,
          ownerEmail: acc.ownerEmail,
          technicalOwnerName: acc.technicalOwnerName,
          technicalOwnerEmail: acc.technicalOwnerEmail,
        }
      : null,
    ownerEmail: ownerEmail ?? meeting.host,
    ownerIsHost: ownerEmail === null,
    region: opp?.salesRegion ?? acc?.salesRegion ?? null,
    readAt: "2026-11-26T02:00:00Z",
  };
}

export const ECHO_CALLS: EchoCall[] = MEETINGS.map((meeting) => ({ meeting, context: storedContextOf(meeting) }));

const contains = (value: string | null | undefined, term: string) =>
  Boolean(value && value.toLowerCase().includes(term.toLowerCase()));

function matches(call: EchoCall, query: Omit<EchoCallsQuery, "page" | "pageSize">): boolean {
  const { meeting, context } = call;
  const day = meeting.startTime.slice(0, 10);
  if (query.owners.length > 0 && !query.owners.includes(context.ownerEmail ?? "")) return false;
  if (query.regions.length > 0 && !query.regions.includes(context.region ?? "")) return false;
  if (query.types.length > 0 && !query.types.includes(meeting.meetingType ?? "")) return false;
  const accountIds = [context.account?.id, context.opportunity?.accountId];
  if (query.accounts.length > 0 && !query.accounts.some((id) => accountIds.includes(id))) return false;
  if (query.opportunities.length > 0 && !query.opportunities.includes(meeting.opportunityId ?? "")) return false;
  if (query.from && day < query.from) return false;
  if (query.to && day > query.to) return false;
  if (query.q) {
    const q = query.q;
    if (!contains(meeting.title, q) && !contains(context.account?.name, q) && !contains(context.opportunity?.name, q)) {
      return false;
    }
  }
  return true;
}

function counted<K extends string>(values: (K | null | undefined)[]): { value: K; calls: number }[] {
  const counts = new Map<K, number>();
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].map(([value, calls]) => ({ value, calls })).sort((a, b) => b.calls - a.calls);
}

/** The Echo calls routes, answered from ECHO_CALLS. */
export function mockEchoCallsClient(calls: EchoCall[] = ECHO_CALLS): EchoCallsClient {
  return {
    calls: async ({ page, pageSize, ...query }) => {
      const hits = calls
        .filter((c) => matches(c, query))
        .sort((a, b) => b.meeting.startTime.localeCompare(a.meeting.startTime));
      return { count: hits.length, calls: hits.slice(page * pageSize, (page + 1) * pageSize) };
    },
    filters: async (q): Promise<CallFilterOptions> => {
      // An owner is named by any of their deals; a host with none is listed by email.
      const ownerNames = new Map<string, string>();
      for (const c of calls) {
        const name = c.context.ownerIsHost ? null : c.context.opportunity?.ownerName;
        if (c.context.ownerEmail && name) ownerNames.set(c.context.ownerEmail, name);
      }
      const names = new Map<string, string>();
      for (const c of calls) {
        if (c.context.account) names.set(c.context.account.id, c.context.account.name);
        const o = c.context.opportunity;
        if (o?.name) names.set(o.id, o.name);
        if (o?.accountId && o.accountName) names.set(o.accountId, o.accountName);
      }
      const named = (ids: (string | null | undefined)[]) =>
        counted(ids)
          .map(({ value, calls: n }) => ({ id: value, name: names.get(value) ?? value, calls: n }))
          .filter((item) => !q || contains(item.name, q) || item.id === q)
          .slice(0, 20);
      return {
        owners: counted(calls.map((c) => c.context.ownerEmail)).map(({ value, calls: n }) => ({
          email: value,
          name: ownerNames.get(value) ?? null,
          calls: n,
        })),
        regions: counted(calls.map((c) => c.context.region)).map(({ value, calls: n }) => ({ region: value, calls: n })),
        callTypes: counted(calls.map((c) => c.meeting.meetingType)).map(({ value, calls: n }) => ({ type: value, calls: n })),
        accounts: named(calls.map((c) => c.context.account?.id ?? c.context.opportunity?.accountId)),
        opportunities: named(calls.map((c) => c.context.opportunity?.id)),
      };
    },
  };
}

/** `POST /salesforce/context`, answered from OPPORTUNITIES and ACCOUNTS. */
export function mockCallContextClient(): CallContextClient {
  return {
    context: async ({ opportunityIds, accountIds }): Promise<CallContextResponse> => ({
      opportunities: Object.fromEntries(opportunityIds.filter((id) => OPPORTUNITIES[id]).map((id) => [id, OPPORTUNITIES[id]])),
      accounts: Object.fromEntries(accountIds.filter((id) => ACCOUNTS[id]).map((id) => [id, ACCOUNTS[id]])),
      asOf: "2026-11-26T10:00:00Z",
    }),
  };
}
