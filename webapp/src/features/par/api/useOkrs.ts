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

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedDelete, authedGet, authedPost, authedPut, defaultQueryRetry } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { parBackendUrl, parServiceUrls } from "@config/apiConfig";
import { isPreviewEnabled } from "@config/previewFeatures";
import { digiopsHeaders } from "@features/my/util/digiopsHeaders";
import type { Leadership360Leader } from "./leadership360Types";
import type { Okr, OkrAccess, OkrCreate, OkrUpdate } from "./okrTypes";

const OKRS_KEY = "par-okrs";

function useOkrQuery(ownerEmail: string | undefined, enabled: boolean) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  return useQuery<Okr[]>({
    queryKey: [OKRS_KEY, ownerEmail ?? "*"],
    enabled: enabled && isSignedIn && Boolean(parBackendUrl),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<Okr[]>(parServiceUrls.okrs(ownerEmail), accessToken, digiopsHeaders());
    },
    retry: defaultQueryRetry,
  });
}

/** One person's OKRs: your own, or someone who reports to you. Off unless `par2` is on. */
export function useOkrs(ownerEmail: string | undefined, enabled = true) {
  return useOkrQuery(ownerEmail, enabled && isPreviewEnabled("par2") && Boolean(ownerEmail));
}

/** Several people's OKRs at once (a lead's team), keyed by email. Shares the
 * cache with useOkrs, so opening someone's review doesn't fetch them again. */
export function useOkrsOf(ownerEmails: string[], enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const on = enabled && isPreviewEnabled("par2") && isSignedIn && Boolean(parBackendUrl);
  return useQueries({
    queries: ownerEmails.map((email) => ({
      queryKey: [OKRS_KEY, email],
      enabled: on,
      queryFn: async () => {
        const accessToken = await getAccessToken();
        return authedGet<Okr[]>(parServiceUrls.okrs(email), accessToken, digiopsHeaders());
      },
      retry: defaultQueryRetry,
    })),
    combine: (results) => new Map(ownerEmails.map((email, i) => [email, results[i]?.data])),
  });
}

/** Everyone's OKRs, for OKR managers. */
export function useAllOkrs(enabled = true) {
  return useOkrQuery(undefined, enabled);
}

/** The people OKRs can be set for: the leadership team. For OKR managers. */
export function useOkrEligibleOwners(enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  return useQuery<Leadership360Leader[]>({
    queryKey: ["par-okr-eligible-owners"],
    enabled: enabled && isSignedIn && Boolean(parBackendUrl),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<Leadership360Leader[]>(parServiceUrls.okrEligibleOwners(), accessToken, digiopsHeaders());
    },
    staleTime: 10 * 60 * 1000,
    retry: defaultQueryRetry,
  });
}

/** Whether the signed-in user may set OKRs (the backend's OKR manager group).
 * Its own call, not the employee lookup: an OKR manager needn't be in the
 * open PAR cycle. */
export function useParIsOkrManager() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const enabled = isPreviewEnabled("par2");
  const access = useQuery<OkrAccess>({
    queryKey: ["par-okr-access"],
    enabled: enabled && isSignedIn && Boolean(parBackendUrl),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<OkrAccess>(parServiceUrls.okrAccess(), accessToken, digiopsHeaders());
    },
    staleTime: 5 * 60 * 1000,
    retry: defaultQueryRetry,
  });
  return {
    isOkrManager: enabled && (access.data?.canManage ?? false),
    isLoading: enabled && access.isLoading,
    isError: access.isError,
    error: access.error,
    retry: access.refetch,
  };
}

function useInvalidateOkrs() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [OKRS_KEY] });
}

export function useCreateOkr() {
  const getAccessToken = useAccessToken();
  const invalidate = useInvalidateOkrs();
  return useMutation<Okr | null, Error, OkrCreate>({
    mutationFn: async (input) => {
      const accessToken = await getAccessToken();
      return authedPost<Okr>(parServiceUrls.okrs(), accessToken, input, digiopsHeaders());
    },
    onSuccess: invalidate,
  });
}

export function useUpdateOkr() {
  const getAccessToken = useAccessToken();
  const invalidate = useInvalidateOkrs();
  return useMutation<Okr | null, Error, { okrId: number; update: OkrUpdate }>({
    mutationFn: async ({ okrId, update }) => {
      const accessToken = await getAccessToken();
      return authedPut<Okr>(parServiceUrls.okr(okrId), accessToken, update, digiopsHeaders());
    },
    onSuccess: invalidate,
  });
}

export function useDeleteOkr() {
  const getAccessToken = useAccessToken();
  const invalidate = useInvalidateOkrs();
  return useMutation<void, Error, number>({
    mutationFn: async (okrId) => {
      const accessToken = await getAccessToken();
      await authedDelete(parServiceUrls.okr(okrId), accessToken, digiopsHeaders());
    },
    onSuccess: invalidate,
  });
}
