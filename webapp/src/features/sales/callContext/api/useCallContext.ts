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

// Live Salesforce details of the opportunities and accounts calls are linked to, from the
// Echo backend (ONE_WSO2_ECHO_BACKEND_URL). Nothing is fetched while that key is unset,
// and nothing here ever fails a screen: without an answer, the screens show the meeting's
// own data instead.
//
// Keys are scoped to the signed-in subject, as the other Sales hooks are.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { useAccessToken } from "@hooks/useAccessToken";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { isEchoBackendConfigured } from "@config/apiConfig";
import type { Meeting } from "../../api/salesTypes";
import { salesRetry } from "../../util/salesError";
import type { CallContextResponse, ContextAccount, ContextOpportunity } from "../types";
import { httpCallContextClient, type CallContextClient } from "./callContextClient";
import {
  NO_CONTEXT,
  contextRequestFor,
  recordFor,
  meetingAccountId,
  meetingOpportunityId,
  normaliseIds,
  type CallContextView,
  type ContextStatus,
} from "../util/callContext";

/**
 * POST /salesforce/context for these ids, in ONE request.
 *
 * The ids are validated, de-duplicated and sorted into the key, so the same page asked
 * for in another order, or re-rendered with new arrays, is the same query rather than a
 * refetch. Opportunity and account details change on Salesforce's clock, not a visit's,
 * so an answer is reused for five minutes.
 */
export function useCallContext(
  opportunityIds: ReadonlyArray<string | null | undefined>,
  accountIds: ReadonlyArray<string | null | undefined>,
): CallContextView {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const client: CallContextClient = useMemo(() => httpCallContextClient(getAccessToken), [getAccessToken]);

  const opportunities = normaliseIds(opportunityIds);
  const accounts = normaliseIds(accountIds);
  const enabled =
    isEchoBackendConfigured() &&
    isSignedIn &&
    Boolean(userSub) &&
    (opportunities.length > 0 || accounts.length > 0);

  const query = useQuery<CallContextResponse>({
    queryKey: ["echo-call-context", userSub, opportunities, accounts],
    enabled,
    queryFn: () => client.context({ opportunityIds: opportunities, accountIds: accounts }),
    staleTime: 5 * 60 * 1000,
    retry: salesRetry,
  });

  const { data, isPending } = query;
  return useMemo<CallContextView>(() => {
    if (data) return { status: "ready", opportunities: data.opportunities, accounts: data.accounts };
    if (enabled && isPending) return { ...NO_CONTEXT, status: "loading" };
    return NO_CONTEXT;
  }, [data, enabled, isPending]);
}

/**
 * The live details of a page of calls: one request for every opportunity and account the
 * calls name.
 *
 * A call whose own data names no account, linked to an opportunity Salesforce has no Sales
 * Region for, takes its region from the opportunity's account, which only the answer
 * names. Those accounts are asked for in one more request, and only when there are any,
 * so the usual page stays one request.
 */
export function usePageCallContext(meetings: Meeting[]): CallContextView {
  const request = contextRequestFor(meetings);
  const first = useCallContext(request.opportunityIds, request.accountIds);
  const learned = meetings.flatMap((meeting) => {
    if (meetingAccountId(meeting)) return [];
    const opportunity = recordFor(first.opportunities, meetingOpportunityId(meeting));
    return opportunity && !opportunity.salesRegion?.trim() && opportunity.accountId ? [opportunity.accountId] : [];
  });
  const second = useCallContext([], learned);
  return useMemo<CallContextView>(() => {
    if (second === NO_CONTEXT) return first;
    return {
      status: second.status === "loading" ? "loading" : first.status,
      opportunities: first.opportunities,
      accounts: { ...first.accounts, ...second.accounts },
    };
  }, [first, second]);
}

/** One linked record on the call page: its id, and its live details once (if) they arrive. */
export interface LinkedRecord<T> {
  id: string | null;
  status: ContextStatus;
  live: T | null;
}

export interface MeetingCallContext {
  opportunity: LinkedRecord<ContextOpportunity>;
  account: LinkedRecord<ContextAccount>;
}

/**
 * The live opportunity and account of one call, for its page.
 *
 * The account is the call's own link, or the one the deal snapshot was taken from. A call
 * whose snapshot does not name its account learns it from the live opportunity, and asks
 * for that account in a second request.
 */
export function useMeetingCallContext(meeting: Meeting | null | undefined): MeetingCallContext {
  const opportunityId = meeting ? meetingOpportunityId(meeting) : null;
  const knownAccountId = meeting ? meetingAccountId(meeting) : null;
  const first = useCallContext([opportunityId], [knownAccountId]);

  const liveOpportunity = recordFor(first.opportunities, opportunityId) ?? null;
  const learnedAccountId = knownAccountId ? null : (liveOpportunity?.accountId ?? null);
  const second = useCallContext([], [learnedAccountId]);

  const accountId = knownAccountId ?? learnedAccountId;
  const accountSource = knownAccountId ? first : second;
  return {
    opportunity: { id: opportunityId, status: first.status, live: liveOpportunity },
    account: {
      id: accountId,
      // Still finding out which account, while the opportunity loads.
      status: !knownAccountId && first.status === "loading" ? "loading" : accountSource.status,
      live: recordFor(accountSource.accounts, accountId) ?? null,
    },
  };
}

/** True when the call is linked to an opportunity or an account, so its page has cards to show. */
export function hasCallContext(meeting: Meeting, context: MeetingCallContext): boolean {
  return context.opportunity.id !== null || context.account.id !== null || Boolean(meeting.accountName?.trim());
}
