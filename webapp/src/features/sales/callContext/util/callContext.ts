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

// What the calls list shows for a call's opportunity, owner and region: live Salesforce
// details when the Echo backend has answered, and the meeting's own data when it has not.
// Kept apart from the table so each fallback is decided, and tested, in one place.

import type { Meeting } from "../../api/salesTypes";
import { meetingCustomer, parseOpportunityDetails } from "../../api/salesTypes";
import type { CallContextRequest, ContextAccount, ContextOpportunity } from "../types";
import type { EchoCall, StoredCallContext } from "../../echoCalls/types";
import { CONTEXT_BATCH_LIMIT } from "../api/callContextClient";

/**
 * Where the live details are: being fetched, answered, or not coming (the Echo backend is
 * not configured, or the request failed). "unavailable" is not an error to show: the
 * screens fall back to what the meeting itself carries.
 */
export type ContextStatus = "loading" | "ready" | "unavailable";

export interface CallContextView {
  status: ContextStatus;
  /** Live details by id, from `POST /salesforce/context`. */
  opportunities: Record<string, ContextOpportunity>;
  accounts: Record<string, ContextAccount>;
  /**
   * Per call, by meetingId: the context the Echo calls list came with. Where a call has
   * one, it decides that row (the list was filtered by it, so the row must agree with the
   * filter) and the live maps are not consulted.
   */
  rows?: Record<number, StoredCallContext>;
}

/** No live details: every screen falls back to the meeting's own data. */
export const NO_CONTEXT: CallContextView = { status: "unavailable", opportunities: {}, accounts: {} };

/** The Echo calls list's own context for each of its calls: no further lookup. */
export function storedContextView(calls: EchoCall[]): CallContextView {
  return {
    status: "ready",
    opportunities: {},
    accounts: {},
    rows: Object.fromEntries(calls.map((call) => [call.meeting.meetingId, call.context])),
  };
}

/** A 15- or 18-character Salesforce id. The server ignores anything else, so it is never sent. */
const SALESFORCE_ID = /^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/;

function salesforceId(value: string | null | undefined): string | null {
  const id = value?.trim();
  return id && SALESFORCE_ID.test(id) ? id : null;
}

/** The ids as one request wants them: valid, each once, sorted (so the cache key is stable), capped. */
export function normaliseIds(ids: ReadonlyArray<string | null | undefined>): string[] {
  const valid = ids.map(salesforceId).filter((id): id is string => id !== null);
  return [...new Set(valid)].sort().slice(0, CONTEXT_BATCH_LIMIT);
}

/** The call's opportunity, if it targets one. */
export function meetingOpportunityId(meeting: Meeting): string | null {
  return meeting.opportunityId?.trim() || null;
}

/**
 * The call's account: its own link for an account-targeted call, else the account the
 * deal snapshot was taken from (its `customerId`) for an opportunity-targeted one.
 */
export function meetingAccountId(meeting: Meeting): string | null {
  return (
    meeting.accountId?.trim() ||
    parseOpportunityDetails(meeting.opportunityDetails)?.customerId?.trim() ||
    null
  );
}

/** Every opportunity and account a page of calls is linked to, for one request. */
export function contextRequestFor(meetings: Meeting[]): CallContextRequest {
  return {
    opportunityIds: normaliseIds(meetings.map(meetingOpportunityId)),
    accountIds: normaliseIds(meetings.map(meetingAccountId)),
  };
}

/** True when the call has something to look up: an opportunity or an account. */
function isLinked(meeting: Meeting): boolean {
  return meetingOpportunityId(meeting) !== null || meetingAccountId(meeting) !== null;
}

export type OpportunityCell =
  /** Nothing linked (an unlinked or lead-only call): blank, as nothing is missing. */
  | { kind: "blank" }
  /** Linked to an account but no opportunity: a dash. */
  | { kind: "none" }
  | { kind: "loading" }
  | { kind: "live"; id: string; name: string; stage: string | null }
  /** Live details unavailable: the meeting's own customer name, still linking to the deal. */
  | { kind: "linked"; id: string; label: string };

export function opportunityCell(meeting: Meeting, context: CallContextView): OpportunityCell {
  // A stored opportunity not yet read from Salesforce has no name: the meeting's own data, below.
  const stored = context.rows?.[meeting.meetingId]?.opportunity;
  if (stored?.name?.trim()) return { kind: "live", id: stored.id, name: stored.name.trim(), stage: stored.stage };
  const id = meetingOpportunityId(meeting);
  if (id === null) return isLinked(meeting) ? { kind: "none" } : { kind: "blank" };
  const live = context.opportunities[id];
  if (live) return { kind: "live", id, name: live.name, stage: live.stage };
  if (context.status === "loading") return { kind: "loading" };
  return { kind: "linked", id, label: meetingCustomer(meeting) ?? "Open deal" };
}

export type OwnerCell =
  | { kind: "owner"; name: string; email: string | null }
  /** The meeting host. `marked` when it stands in for an owner the call has none of (or none known). */
  | { kind: "host"; email: string; marked: boolean };

/**
 * The opportunity owner (the AM); the host when there is no opportunity or no live owner.
 *
 * While an opportunity's details load, the host is shown unmarked: in WSO2's process the
 * host usually is the owner, so the cell rarely changes once the answer lands.
 */
export function ownerCell(meeting: Meeting, context: CallContextView): OwnerCell {
  const stored = context.rows?.[meeting.meetingId];
  if (stored) {
    const ownerName = stored.ownerIsHost
      ? null
      : stored.opportunity?.ownerName?.trim() || stored.ownerEmail?.trim() || null;
    if (ownerName) {
      const email = stored.ownerEmail?.trim() || stored.opportunity?.ownerEmail?.trim() || null;
      return { kind: "owner", name: ownerName, email };
    }
    return { kind: "host", email: meeting.host, marked: true };
  }
  const id = meetingOpportunityId(meeting);
  const live = id ? context.opportunities[id] : undefined;
  const name = live?.ownerName?.trim() || live?.ownerEmail?.trim();
  if (name) return { kind: "owner", name, email: live?.ownerEmail?.trim() || null };
  const loading = id !== null && !live && context.status === "loading";
  return { kind: "host", email: meeting.host, marked: !loading };
}

export type RegionCell =
  | { kind: "blank" }
  | { kind: "none" }
  | { kind: "loading" }
  /** `value` is the Sales Region code; `title` its long form where the account has one. */
  | { kind: "value"; value: string; title: string };

/** The account's region as the list shows it: the Sales Region code, the long name on hover. */
export function accountRegion(account: ContextAccount | undefined): { value: string; title: string } | null {
  const value = account?.salesRegion?.trim() || account?.region?.trim();
  if (!value) return null;
  return { value, title: account?.region?.trim() || value };
}

/** The opportunity's Sales Region; else its account's; else a dash. */
export function regionCell(meeting: Meeting, context: CallContextView): RegionCell {
  const stored = context.rows?.[meeting.meetingId];
  if (stored) {
    const region = stored.region?.trim();
    if (region) return { kind: "value", value: region, title: region };
    return isLinked(meeting) ? { kind: "none" } : { kind: "blank" };
  }
  if (!isLinked(meeting)) return { kind: "blank" };
  const opportunityId = meetingOpportunityId(meeting);
  const opportunity = opportunityId ? context.opportunities[opportunityId] : undefined;
  const fromOpportunity = opportunity?.salesRegion?.trim();
  if (fromOpportunity) return { kind: "value", value: fromOpportunity, title: fromOpportunity };
  const accountId = meetingAccountId(meeting) ?? opportunity?.accountId ?? null;
  const fromAccount = accountRegion(accountId ? context.accounts[accountId] : undefined);
  if (fromAccount) return { kind: "value", ...fromAccount };
  return context.status === "loading" ? { kind: "loading" } : { kind: "none" };
}
