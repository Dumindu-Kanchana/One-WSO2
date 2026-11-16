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

import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedDelete, authedGet, authedPatch, authedPost, authedPut, defaultQueryRetry } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { peopleBackendUrl, peopleServiceUrls } from "@config/apiConfig";
import { isPreviewEnabled } from "@config/previewFeatures";
import type {
  KeyResultStatus,
  Okr,
  OkrComment,
  OkrCreate,
  OkrPerson,
  OkrScope,
  OkrStatus,
  OkrUpdate,
} from "./okrTypes";

const OKRS_KEY = "okrs";
const COMMENTS_KEY = "okr-comments";

/** Whether OKRs are on here: the `okrs` preview flag and a people backend. */
export function okrsEnabled(): boolean {
  return isPreviewEnabled("okrs") && Boolean(peopleBackendUrl);
}

// Who may read which OKRs depends on the caller, so every key carries them.
function useOkrBasis(enabled: boolean) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state } = useAsgardeoSub();
  const userSub = state.status === "ready" ? state.sub : undefined;
  return { getAccessToken, userSub, on: enabled && okrsEnabled() && isSignedIn && Boolean(userSub) };
}

/** One person's OKRs: the objectives they own and those with a key result of
 * theirs. Yours, or someone's below you in your reporting chain. */
export function useOkrs(ownerEmail: string | undefined, enabled = true) {
  const { getAccessToken, userSub, on } = useOkrBasis(enabled && Boolean(ownerEmail));
  return useQuery<Okr[]>({
    queryKey: [OKRS_KEY, userSub, "owner", ownerEmail],
    enabled: on,
    queryFn: async () =>
      authedGet<Okr[]>(peopleServiceUrls.okrs({ ownerEmail: ownerEmail as string }), await getAccessToken()),
    retry: defaultQueryRetry,
  });
}

/** Several people's OKRs at once (a lead's team), keyed by email. Shares the
 * cache with useOkrs, so opening someone's review doesn't fetch them again.
 * Someone whose OKRs can't be read maps to undefined, like one still loading. */
export function useOkrsOf(ownerEmails: string[], enabled = true) {
  const { getAccessToken, userSub, on } = useOkrBasis(enabled);
  return useQueries({
    queries: ownerEmails.map((email) => ({
      queryKey: [OKRS_KEY, userSub, "owner", email],
      enabled: on,
      queryFn: async () => authedGet<Okr[]>(peopleServiceUrls.okrs({ ownerEmail: email }), await getAccessToken()),
      retry: defaultQueryRetry,
    })),
    combine: (results) => new Map(ownerEmails.map((email, i) => [email, results[i]?.data])),
  });
}

/** A list of OKRs: your team's (`team`), each owner marked as in it or not,
 * or everyone's (`all`, People Ops admins). */
export function useOkrList(scope: OkrScope, enabled = true) {
  const { getAccessToken, userSub, on } = useOkrBasis(enabled);
  return useQuery<Okr[]>({
    queryKey: [OKRS_KEY, userSub, "scope", scope],
    enabled: on,
    queryFn: async () => authedGet<Okr[]>(peopleServiceUrls.okrs({ scope }), await getAccessToken()),
    retry: defaultQueryRetry,
  });
}

/** Who a key result of someone's objective can be given to: them and their
 * team, matching what's typed. */
export function useOkrTeam(ownerEmail: string | undefined, search: string, enabled = true) {
  const { getAccessToken, userSub, on } = useOkrBasis(enabled && Boolean(ownerEmail));
  const text = search.trim();
  return useQuery<OkrPerson[]>({
    queryKey: ["okr-team", userSub, ownerEmail, text],
    enabled: on,
    queryFn: async () =>
      authedGet<OkrPerson[]>(peopleServiceUrls.okrTeam(ownerEmail as string, text), await getAccessToken()),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
    retry: defaultQueryRetry,
  });
}

/** The comments on an action, oldest first. */
export function useOkrComments(actionId: number, enabled = true) {
  const { getAccessToken, userSub, on } = useOkrBasis(enabled);
  return useQuery<OkrComment[]>({
    queryKey: [COMMENTS_KEY, userSub, actionId],
    enabled: on,
    queryFn: async () => authedGet<OkrComment[]>(peopleServiceUrls.okrActionComments(actionId), await getAccessToken()),
    retry: defaultQueryRetry,
  });
}

/** A change to OKRs: every list holding them reads them again afterwards. */
function useOkrMutation<Input>(request: (input: Input, token: string) => Promise<unknown>) {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<unknown, Error, Input>({
    mutationFn: async (input) => request(input, await getAccessToken()),
    onSettled: () => qc.invalidateQueries({ queryKey: [OKRS_KEY] }),
  });
}

export const useCreateOkr = () =>
  useOkrMutation<OkrCreate>((input, token) => authedPost<Okr>(peopleServiceUrls.newOkr, token, input));

export const useUpdateOkr = () =>
  useOkrMutation<{ okrId: number; update: OkrUpdate }>(({ okrId, update }, token) =>
    authedPatch<Okr>(peopleServiceUrls.okr(okrId), token, update),
  );

/** Complete, close (with a reason) or reopen an objective. */
export const useSetOkrStatus = () =>
  useOkrMutation<{ okrId: number; status: OkrStatus; reason?: string }>(({ okrId, status, reason }, token) =>
    authedPut<Okr>(peopleServiceUrls.okrStatus(okrId), token, { status, ...(reason ? { reason } : {}) }),
  );

export const useDeleteOkr = () =>
  useOkrMutation<number>((okrId, token) => authedDelete(peopleServiceUrls.okr(okrId), token));

export const useSetKeyResultStatus = () =>
  useOkrMutation<{ keyResultId: number; status: KeyResultStatus }>(({ keyResultId, status }, token) =>
    authedPut<Okr>(peopleServiceUrls.okrKeyResultStatus(keyResultId), token, { status }),
  );

/** A key result's baseline and target; a blank one clears it. */
export const useUpdateKeyResultMeasure = () =>
  useOkrMutation<{ keyResultId: number; version: number; baseline: string; target: string }>(
    ({ keyResultId, ...change }, token) => authedPatch<Okr>(peopleServiceUrls.okrKeyResult(keyResultId), token, change),
  );

export const useAddOkrAction = () =>
  useOkrMutation<{ keyResultId: number; title: string }>(({ keyResultId, title }, token) =>
    authedPost<Okr>(peopleServiceUrls.okrKeyResultActions(keyResultId), token, { title }),
  );

export const useUpdateOkrAction = () =>
  useOkrMutation<{ actionId: number; title?: string; done?: boolean }>(({ actionId, ...change }, token) =>
    authedPatch<Okr>(peopleServiceUrls.okrAction(actionId), token, change),
  );

export const useRemoveOkrAction = () =>
  useOkrMutation<number>((actionId, token) => authedDelete(peopleServiceUrls.okrAction(actionId), token));

/** Comment on an action. Its thread, and the counts on the lists, read again. */
export function useAddOkrComment(actionId: number) {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<OkrComment[] | null, Error, string>({
    mutationFn: async (comment) =>
      authedPost<OkrComment[]>(peopleServiceUrls.okrActionComments(actionId), await getAccessToken(), { comment }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [COMMENTS_KEY] });
      void qc.invalidateQueries({ queryKey: [OKRS_KEY] });
    },
  });
}
