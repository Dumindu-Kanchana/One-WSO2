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

import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, defaultQueryRetry } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { peopleBackendUrl, peopleServiceUrls } from "@config/apiConfig";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { demoUserInfo, isParOnlyDemo } from "@config/parOnlyDemo";

// Minimal shape returned by the people-app /user-info endpoint. Matches
// the fields we consume in the shell — the full type lives in
// features/my/api/types.ts (kept there so feature-scoped code doesn't
// have to reach into src/api for the whole DTO).
export interface UserInfoLite {
  id: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  employeeThumbnail: string | null;
  designation: string | null;
  // The employee's work location (e.g. "Sri Lanka", "India") — same field
  // people-app's onboarding form calls Work Location, now also returned on
  // /user-info so the rail can gate location-specific features (Subscriptions:
  // PickMe Commute / LaaS are Colombo-office-only) without a second fetch.
  // Absent, not just possibly empty, for anyone /user-info predates knowing
  // this about — same shape as `designation` above.
  workLocation: string | null;
  privileges?: number[];
}

// Fire /user-info by itself — cheaper than the full useMeProfile chain
// (which also pulls /employees/{id} + /employees/{id}/personal-info) and
// safe to mount in the shell (TopBar) where we only need the display
// name. useMeProfile explicitly reads /user-info through this same query
// key via queryClient.fetchQuery, so the two hooks share cache — the
// endpoint hits the network only once per (sub, staleTime) window.
export function useUserInfo() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  // Shared sub resolver — the same one useMeProfile consumes. Guarantees
  // both hooks are byte-identical on the ["user-info", sub] cache key, so
  // the cache-share promise made in the comment above actually holds.
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;

  const query = useQuery<UserInfoLite>({
    queryKey: ["user-info", userSub],
    // DEMO ONLY: the PAR-only demo has no people backend; the persona stands in.
    enabled: isSignedIn && (Boolean(peopleBackendUrl) || isParOnlyDemo()) && Boolean(userSub),
    queryFn: async () => {
      if (isParOnlyDemo()) return demoUserInfo();
      const accessToken = await getAccessToken();
      return authedGet<UserInfoLite>(peopleServiceUrls.userInfo, accessToken);
    },
    staleTime: 5 * 60 * 1000,
    retry: defaultQueryRetry,
  });

  return foldIdentityError(query, subState, retryIdentity);
}
