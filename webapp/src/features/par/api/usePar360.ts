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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, authedPatch, authedPost, HttpError, defaultQueryRetry } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { parBackendUrl, parServiceUrls } from "@config/apiConfig";
import { digiopsHeaders } from "@features/my/util/digiopsHeaders";
import type {
  Par360Review,
  Par360ReviewRequest,
  Par360ReviewRequestCreate,
  Par360ReviewUpdate,
  Par360Reviewer,
  ParParticipant,
} from "./types";

// GET the reviewers you (or your lead, on your behalf) have asked to review
// you in this cycle.
export function useReviewers(parCycleId: number | undefined, workEmail: string | undefined) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const backendConfigured = Boolean(parBackendUrl);
  return useQuery<Par360Reviewer[]>({
    queryKey: ["par-360-reviewers", parCycleId, workEmail],
    enabled: isSignedIn && backendConfigured && parCycleId !== undefined && Boolean(workEmail),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<Par360Reviewer[]>(
        parServiceUrls.par360Reviewers(parCycleId!, workEmail!),
        accessToken,
        digiopsHeaders(),
      );
    },
    staleTime: 60 * 1000,
    retry: defaultQueryRetry,
  });
}

// POST more reviewers onto an employee's 360° request list (yours, or a report's as their lead), with how each
// works with them in a PAR 2.0 cycle.
export function useRequestReviewers(parCycleId: number | undefined, workEmail: string | undefined) {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<void, Error, Par360ReviewRequestCreate>({
    mutationFn: async (request) => {
      if (parCycleId === undefined || !workEmail) throw new Error("Missing cycle or employee email");
      const accessToken = await getAccessToken();
      await authedPost<void>(
        parServiceUrls.par360Reviewers(parCycleId, workEmail),
        accessToken,
        request,
        digiopsHeaders(),
      );
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["par-360-reviewers", parCycleId, workEmail] });
    },
  });
}

// GET the 360° requests waiting on the caller AS A REVIEWER — one entry per
// employee who asked (or whose lead asked on their behalf).
export function useReviewRequests(parCycleId: number | undefined, workEmail: string | undefined) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const backendConfigured = Boolean(parBackendUrl);
  return useQuery<Par360ReviewRequest[]>({
    queryKey: ["par-360-review-requests", parCycleId, workEmail],
    enabled: isSignedIn && backendConfigured && parCycleId !== undefined && Boolean(workEmail),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<Par360ReviewRequest[]>(
        parServiceUrls.par360ReviewRequests(workEmail!, parCycleId!),
        accessToken,
        digiopsHeaders(),
      );
    },
    staleTime: 60 * 1000,
    retry: defaultQueryRetry,
  });
}

// GET the caller's own (in-progress or completed) review of one employee —
// used to re-open a DRAFT for editing. A 404 means "not started yet".
export function useMyReview(parCycleId: number | undefined, employeeWorkEmail: string | undefined, enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const backendConfigured = Boolean(parBackendUrl);
  return useQuery<Par360Review | null>({
    queryKey: ["par-360-review", parCycleId, employeeWorkEmail],
    enabled: enabled && isSignedIn && backendConfigured && parCycleId !== undefined && Boolean(employeeWorkEmail),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      try {
        return await authedGet<Par360Review>(
          parServiceUrls.par360Review(parCycleId!, employeeWorkEmail!),
          accessToken,
          digiopsHeaders(),
        );
      } catch (e) {
        if (e instanceof HttpError && e.status === 404) return null;
        throw e;
      }
    },
    staleTime: 30 * 1000,
    retry: defaultQueryRetry,
  });
}

// PATCH the caller's own review of one employee — draft, submit (SHARED), or
// decline (REJECTED) all go through this one endpoint.
export function useSubmitReview(parCycleId: number | undefined) {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<void, Error, { employeeWorkEmail: string; payload: Par360ReviewUpdate }>({
    mutationFn: async ({ employeeWorkEmail, payload }) => {
      if (parCycleId === undefined) throw new Error("Missing cycle");
      const accessToken = await getAccessToken();
      await authedPatch<void>(
        parServiceUrls.par360Review(parCycleId, employeeWorkEmail),
        accessToken,
        payload,
        digiopsHeaders(),
      );
    },
    onSuccess: async (_data, { employeeWorkEmail }) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["par-360-review", parCycleId, employeeWorkEmail] }),
        // Wholesale, not the specific [parCycleId, reviewerWorkEmail] tuple
        // useOfferToReview below invalidates: the reviewer's own email isn't
        // one of this mutation's variables (only the employee being
        // reviewed is), so there's no narrower key available to target here
        // without threading it through as an extra hook argument.
        qc.invalidateQueries({ queryKey: ["par-360-review-requests"] }),
        // Declining a leader's request also deletes your Leadership 360° draft on them.
        qc.invalidateQueries({ queryKey: ["leadership360-my-feedback"] }),
      ]);
    },
  });
}

// GET the people in this cycle — backs "Voluntary Feedback"'s participant
// picker, which has no existing request row to search against.
// OfferFeedbackView.tsx: `fetchParticipants({ parCycleId, leadEmail: null })`
// — every participant of the cycle, not one lead's team.
export function useParticipants(parCycleId: number | undefined, enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const backendConfigured = Boolean(parBackendUrl);
  return useQuery<ParParticipant[]>({
    queryKey: ["par-360-participants", parCycleId],
    enabled: enabled && isSignedIn && backendConfigured && parCycleId !== undefined,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ParParticipant[]>(
        parServiceUrls.par360Participants(parCycleId!),
        accessToken,
        digiopsHeaders(),
      );
    },
    staleTime: 10 * 60 * 1000,
    retry: defaultQueryRetry,
  });
}

// POST yourself as a reviewer onto SOMEONE ELSE's list — same endpoint
// useRequestReviewers uses, aimed at another employee's record instead of
// your own, so it invalidates the request list that now appears for you.
// In a PAR 2.0 cycle you also say how you work with them (`relationship`).
export function useOfferToReview(parCycleId: number | undefined, reviewerEmail: string | undefined) {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<void, Error, { employeeEmail: string; relationship?: string }>({
    mutationFn: async ({ employeeEmail, relationship }) => {
      if (parCycleId === undefined || !reviewerEmail) throw new Error("Missing cycle or reviewer email");
      const accessToken = await getAccessToken();
      await authedPost<void>(
        parServiceUrls.par360Reviewers(parCycleId, employeeEmail),
        accessToken,
        {
          reviewerEmails: [reviewerEmail],
          ...(relationship ? { relationships: { [reviewerEmail]: relationship } } : {}),
        } satisfies Par360ReviewRequestCreate,
        digiopsHeaders(),
      );
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["par-360-review-requests", parCycleId, reviewerEmail] });
    },
  });
}
