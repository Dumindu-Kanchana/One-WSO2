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

// Reads from the MEDDPICC backend (echo-backend). Nothing is fetched while
// ONE_WSO2_ECHO_BACKEND_URL is unset; the pages show a "not connected" state.
//
// Keys are scoped to the signed-in subject, as the meet-app hooks are.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { salesRetry } from "../../util/salesError";
import type { DealDetail, DealList, GatesResponse, MeetingCoverage, MeetingCoverageList } from "../types";
import { isEchoBackendConfigured } from "@config/apiConfig";
import {
  COVERAGE_BATCH_LIMIT,
  httpMeddpiccClient,
  type DealsQuery,
  type MeddpiccClient,
} from "./meddpiccClient";

export { isEchoBackendConfigured };

/** Everything every MEDDPICC query and mutation needs, gathered once. */
export function useMeddpiccBasis() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const client: MeddpiccClient = useMemo(() => httpMeddpiccClient(getAccessToken), [getAccessToken]);
  const ready = isEchoBackendConfigured() && isSignedIn && Boolean(userSub);
  return { client, userSub, ready, subState, retryIdentity };
}

/** GET /gates — the stage order and the Letters, for the stage filter. */
export function useMeddpiccGates() {
  const { client, userSub, ready } = useMeddpiccBasis();
  return useQuery<GatesResponse>({
    queryKey: ["meddpicc-gates", userSub],
    enabled: ready,
    queryFn: () => client.gates(),
    // The definitions change with a deploy, not during a visit.
    staleTime: 60 * 60 * 1000,
    retry: salesRetry,
  });
}

/**
 * POST /meetings/coverage for the meetings on screen, in ONE request.
 *
 * The ids are sorted into the key so the same page asked for in another order
 * is a cache hit, and capped at the contract's 200 — a page is at most 20, so
 * the cap only matters if a caller ever passes more.
 *
 * Returned as a map by meetingId, since the table looks rows up one at a time.
 */
export function useMeetingCoverage(meetingIds: number[]) {
  const { client, userSub, ready } = useMeddpiccBasis();
  const ids = useMemo(
    () => [...new Set(meetingIds)].sort((a, b) => a - b).slice(0, COVERAGE_BATCH_LIMIT),
    [meetingIds],
  );
  const query = useQuery<MeetingCoverageList>({
    queryKey: ["meddpicc-coverage", userSub, ids],
    enabled: ready && ids.length > 0,
    queryFn: () => client.meetingCoverage(ids),
    staleTime: 60 * 1000,
    // A re-analysis runs in the background; while any row on the page is still
    // being worked on, look again so the circles fill in without a reload.
    refetchInterval: (q) =>
      q.state.data?.items.some((item) => item.status === "PENDING" || item.status === "RUNNING")
        ? 5000
        : false,
    retry: salesRetry,
  });
  const byId = useMemo(() => {
    const map = new Map<number, MeetingCoverage>();
    for (const item of query.data?.items ?? []) map.set(item.meetingId, item);
    return map;
  }, [query.data]);
  return { ...query, byId };
}

/**
 * GET /deals. `refetchOnMount` opted back in for the reason useMeetings gives:
 * a deal approved in another tab should not stay pending here forever.
 */
export function useDeals(params: DealsQuery) {
  const { client, userSub, ready, subState, retryIdentity } = useMeddpiccBasis();
  const { search, owner, stage, hideClosed } = params;
  const query = useQuery<DealList>({
    queryKey: ["meddpicc-deals", userSub, search, owner, stage, hideClosed],
    enabled: ready,
    queryFn: () => client.deals({ search, owner, stage, hideClosed }),
    staleTime: 60 * 1000,
    refetchOnMount: true,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === userSub ? previous : undefined,
    retry: salesRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/** GET /deals/{id}, fetched once a panel is opened for it. */
export function useDeal(opportunityId: string | null) {
  const { client, userSub, ready } = useMeddpiccBasis();
  return useQuery<DealDetail>({
    queryKey: ["meddpicc-deal", userSub, opportunityId],
    enabled: ready && opportunityId !== null,
    queryFn: () => client.deal(opportunityId as string),
    staleTime: 30 * 1000,
    refetchOnMount: true,
    retry: salesRetry,
  });
}
