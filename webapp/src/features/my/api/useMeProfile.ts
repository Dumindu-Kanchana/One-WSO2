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

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, HttpError, defaultQueryRetry } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { peopleBackendUrl, peopleServiceUrls } from "@config/apiConfig";
import { devActAs } from "@config/devActAs";
import { demoEmployee, demoUserInfo, isParOnlyDemo } from "@config/parOnlyDemo";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import type { Employee, EmployeePersonalInfo, UserInfo } from "./types";

// Re-export HttpError for existing feature-scoped consumers that still
// import it from here. Prefer importing from @api/http directly.
export { HttpError };

export interface MeProfile {
  userInfo: UserInfo;
  employee: Employee;
}

// Two-step fetch that mirrors people-app's own me flow:
//   1. GET /user-info                 → employeeId (from the JWT identity)
//   2. GET /employees/{id}            → org / role / employment record
//
// Personal details are NOT part of this. They are their own query — see
// useMePersonalInfo below — so a page can choose not to ask for them.
//
// `employeeId` overrides step 1's identity lookup and loads SOMEONE ELSE's
// profile — the People Ops employee detail page, which is the same read-only
// reuse people-app makes (its EmployeeDetail is a one-liner rendering the Me
// view with an id and `readOnly`). /user-info is still fetched, because the
// caller's own identity is what the backend authorizes against; only the
// employee record being displayed changes.
//
// Access is the backend's call: GET /employees/{id} and /personal-info allow
// an ADMIN caller to read anyone, and 403 otherwise. Passing an id here is
// therefore a request, not a grant.
export function useMeProfile(employeeId?: string, enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const qc = useQueryClient();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const backendConfigured = Boolean(peopleBackendUrl);

  const query = useQuery<MeProfile>({
    // userSub is part of the key so cached data is scoped per-user — no
    // brief cross-user leak on account switch in the same tab. employeeId
    // joins it so viewing one colleague then another doesn't serve the
    // first one's record from cache; `null` keeps the own-profile key
    // exactly as it was before this parameter existed.
    queryKey: ["me-profile", userSub, employeeId ?? null],
    // `enabled` lets a caller hold the request until it knows it is allowed
    // to make it. The employee-detail page uses it to wait for the admin
    // check: without it the fetch fired on mount and PeopleOpsShell only hid
    // the result afterwards, which looks like a gate but is not one.
    // DEMO ONLY: the PAR-only demo has no people backend; the persona stands in.
    enabled: enabled && isSignedIn && (backendConfigured || (isParOnlyDemo() && !employeeId)) && Boolean(userSub),
    queryFn: async () => {
      if (isParOnlyDemo() && !employeeId) return { userInfo: demoUserInfo(), employee: demoEmployee() };
      const accessToken = await getAccessToken();

      // Share the ["user-info", sub] cache slot with useUserInfo (the
      // TopBar's avatar reader). Without this, both hooks would issue an
      // independent GET /user-info on the same page load — React Query
      // only dedupes within a query key, not across separate authedGet
      // calls. fetchQuery populates + returns the cached value.
      const userInfo = await qc.fetchQuery<UserInfo>({
        queryKey: ["user-info", userSub],
        queryFn: () => authedGet<UserInfo>(peopleServiceUrls.userInfo, accessToken),
        staleTime: 5 * 60 * 1000,
      });
      const targetId = employeeId ?? userInfo.employeeId;
      const employee = await authedGet<Employee>(
        peopleServiceUrls.employee(targetId),
        accessToken,
      );
      // LOCAL DEMO ONLY (devActAs): PAR screens look people up by this email.
      const persona = employeeId ? null : devActAs();
      return { userInfo: persona ? { ...userInfo, workEmail: persona.email } : userInfo, employee };
    },
    // Profile changes rarely — fetch once per session, don't retry on
    // 4xx (usually a token / role problem, not a transient failure).
    staleTime: 5 * 60 * 1000,
    retry: defaultQueryRetry,
  });

  // React Query's own refetch ignores `enabled: false` and would fire the
  // profile query with key ["me-profile", undefined], bypassing the
  // per-user cache scoping — foldIdentityError's synthetic refetch instead
  // re-runs identity resolution; if that then succeeds, `enabled` flips
  // true and the profile query starts naturally.
  return foldIdentityError(query, subState, retryIdentity);
}

/**
 * Someone's personal details — contact information and emergency contacts.
 *
 * Separate from the profile query, and off by default, because this is the most
 * sensitive payload the people backend serves: NIC or passport, date of birth,
 * home address, next of kin. Loading a profile page should not fetch them; the
 * request is made when a reader asks to see them and not before.
 *
 * It shares the `userSub` + `employeeId` key shape with the profile query, so
 * two sections of one page reading it issue a single request between them.
 */
export function useMePersonalInfo(employeeId?: string, enabled = false) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const qc = useQueryClient();
  const userSub = subState.status === "ready" ? subState.sub : undefined;

  const query = useQuery<EmployeePersonalInfo>({
    queryKey: ["me-personal", userSub, employeeId ?? null],
    enabled: enabled && isSignedIn && Boolean(peopleBackendUrl) && Boolean(userSub),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      // Reuses the same /user-info cache slot the profile query populates, so
      // asking for personal details does not re-resolve identity.
      const userInfo = await qc.fetchQuery<UserInfo>({
        queryKey: ["user-info", userSub],
        queryFn: () => authedGet<UserInfo>(peopleServiceUrls.userInfo, accessToken),
        staleTime: 5 * 60 * 1000,
      });
      return authedGet<EmployeePersonalInfo>(
        peopleServiceUrls.employeePersonalInfo(employeeId ?? userInfo.employeeId),
        accessToken,
      );
    },
    staleTime: 5 * 60 * 1000,
    retry: defaultQueryRetry,
  });

  return foldIdentityError(query, subState, retryIdentity);
}

export function isPeopleBackendConfigured(): boolean {
  return Boolean(peopleBackendUrl);
}
