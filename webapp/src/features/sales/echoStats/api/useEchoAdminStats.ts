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

// Echo stats, from the Echo backend. Nothing is fetched while ONE_WSO2_ECHO_BACKEND_URL is
// unset, nor for a caller the page already knows is not a Sales admin: the backend would
// only answer 403.
//
// Keyed by the signed-in subject, as the MEDDPICC hooks are.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { isEchoBackendConfigured } from "@config/apiConfig";
import { salesRetry } from "../../util/salesError";
import type { EchoAdminStats, StatsDays } from "../types";
import { httpEchoStatsClient, type EchoStatsClient } from "./echoStatsClient";

/**
 * GET /admin/stats?days=. Moving between 7, 30 and 90 days keeps the last answer on
 * screen until the new one lands (`isPlaceholderData`), rather than blanking the page.
 *
 * @param days - The range, in days
 * @param enabled - False to ask nothing, e.g. for a caller who is not an admin
 */
export function useEchoAdminStats(days: StatsDays, enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const client: EchoStatsClient = useMemo(() => httpEchoStatsClient(getAccessToken), [getAccessToken]);
  const ready = isEchoBackendConfigured() && isSignedIn && Boolean(userSub);

  const query = useQuery<EchoAdminStats>({
    queryKey: ["echo-admin-stats", userSub, days],
    enabled: ready && enabled,
    queryFn: () => client.adminStats(days),
    // Aggregates over days or weeks: a minute stale is nothing, and saves a request per visit.
    staleTime: 60 * 1000,
    refetchOnMount: true,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === userSub ? previous : undefined,
    retry: salesRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}
