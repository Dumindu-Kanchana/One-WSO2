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

// The Echo scope of the calls list, from the Echo backend (ONE_WSO2_ECHO_BACKEND_URL).
// Nothing is fetched while that key is unset; the page then lists from the Sales backend.
//
// Keys are scoped to the signed-in subject, as the other Sales hooks are.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { isEchoBackendConfigured } from "@config/apiConfig";
import { salesRetry } from "../../util/salesError";
import type { CallFilterOptions, EchoCallList } from "../types";
import { httpEchoCallsClient, type EchoCallsClient, type EchoCallsQuery } from "./echoCallsClient";

function useEchoCallsBasis() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const client: EchoCallsClient = useMemo(() => httpEchoCallsClient(getAccessToken), [getAccessToken]);
  const ready = isEchoBackendConfigured() && isSignedIn && Boolean(userSub);
  return { client, userSub, ready, subState, retryIdentity };
}

/**
 * One page of Echo calls, filtered on the server.
 *
 * Every filter and the page are in the key, so paging back is a cache hit and a filter
 * change is a new query. The previous page stays on screen while the next loads, as the
 * Sales backend's list does, so the table doesn't collapse to skeletons on every click.
 * `refetchOnMount` is opted back in for the reason useMeetings gives.
 *
 * A failure to tell who is signed in is reported as this query's error (with a refetch
 * that retries it), as the Sales hooks report it, rather than as a list that never loads.
 */
export function useEchoCalls(query: EchoCallsQuery, enabled: boolean) {
  const { client, userSub, ready, subState, retryIdentity } = useEchoCallsBasis();
  const { page, pageSize, q, owners, regions, types, accounts, opportunities, from, to } = query;
  const result = useQuery<EchoCallList>({
    queryKey: ["echo-calls", userSub, page, pageSize, q, owners, regions, types, accounts, opportunities, from, to],
    enabled: ready && enabled,
    queryFn: () => client.calls({ page, pageSize, q, owners, regions, types, accounts, opportunities, from, to }),
    staleTime: 60 * 1000,
    refetchOnMount: true,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === userSub ? previous : undefined,
    retry: salesRetry,
  });
  return foldIdentityError(result, subState, retryIdentity);
}

/**
 * What the Echo calls can be filtered by. With `q`, the accounts and opportunities are the
 * top matches for it; the owner, region and call type lists are the same either way, so
 * the multi-selects read the unnarrowed answer. The options change with a day's calls, not
 * a visit's clicks, hence five minutes.
 */
export function useCallFilterOptions(q: string, enabled: boolean) {
  const { client, userSub, ready, subState, retryIdentity } = useEchoCallsBasis();
  const term = q.trim();
  const result = useQuery<CallFilterOptions>({
    queryKey: ["echo-call-filters", userSub, term],
    enabled: ready && enabled,
    queryFn: () => client.filters(term),
    staleTime: 5 * 60 * 1000,
    // The last answer stays while the next term's loads, so the picker doesn't empty per key.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === userSub ? previous : undefined,
    retry: salesRetry,
  });
  return foldIdentityError(result, subState, retryIdentity);
}
