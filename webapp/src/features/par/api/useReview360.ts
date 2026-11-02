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
import { authedGet, authedPost, authedPut, defaultQueryRetry, HttpError } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { parBackendUrl, parServiceUrls } from "@config/apiConfig";
import { isPreviewEnabled } from "@config/previewFeatures";
import { digiopsHeaders } from "@features/my/util/digiopsHeaders";
import type { FormAnswers } from "./leadership360Types";
import type {
  ParCycleFormKind,
  Review360Form,
  Review360Responses,
  Review360Summary,
  Review360TeamIndexes,
} from "./review360Types";

function useGet<T>(key: unknown[], url: string | undefined, enabled: boolean, notFoundAsNull = false) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  return useQuery<T | null>({
    queryKey: key,
    enabled: enabled && isSignedIn && Boolean(parBackendUrl) && Boolean(url),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      try {
        return await authedGet<T>(url!, accessToken, digiopsHeaders());
      } catch (err) {
        if (notFoundAsNull && err instanceof HttpError && err.status === 404) return null;
        throw err;
      }
    },
    retry: defaultQueryRetry,
  });
}

// The PAR 2.0 forms a cycle uses; empty for a cycle that keeps the single
// comment, rating and 360.
export function useParCycleForms(parCycleId: number | undefined) {
  const query = useGet<ParCycleFormKind[]>(
    ["par-cycle-forms", parCycleId],
    parCycleId ? parServiceUrls.parCycleForms(parCycleId) : undefined,
    Boolean(parCycleId),
  );
  return { ...query, hasStructured360: Boolean(query.data?.includes("PEER_360")) };
}

/** Whether the open cycle is a PAR 2.0 cycle, shown with the Active cycle / Give feedback / History tabs. */
export function useParShowsPar2(parCycleId: number | undefined): { showsPar2: boolean; isLoading: boolean } {
  const enabled = isPreviewEnabled("par2");
  const forms = useParCycleForms(enabled ? parCycleId : undefined);
  return { showsPar2: enabled && forms.hasStructured360, isLoading: enabled && Boolean(parCycleId) && forms.isLoading };
}

// The caller's own feedback on one employee: their draft or what they
// submitted. Null when they weren't asked.
export function useReviewForm(parCycleId: number | undefined, employeeEmail: string | undefined, enabled = true) {
  return useGet<Review360Form>(
    ["par-review-form", parCycleId, employeeEmail],
    parCycleId && employeeEmail ? parServiceUrls.parReviewForm(parCycleId, employeeEmail) : undefined,
    enabled,
    true,
  );
}

// Saves a draft. The request list is refreshed (the first save moves it from
// PENDING to DRAFT); the form itself isn't, so a refetch can't race typing.
export function useSaveReviewForm(parCycleId: number | undefined, employeeEmail: string | undefined) {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<void, Error, FormAnswers>({
    mutationFn: async (answers) => {
      if (!parCycleId || !employeeEmail) throw new Error("Missing PAR cycle");
      const accessToken = await getAccessToken();
      await authedPut<void>(parServiceUrls.parReviewForm(parCycleId, employeeEmail), accessToken, { answers }, digiopsHeaders());
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["par-360-review-requests", parCycleId] });
    },
  });
}

export function useSubmitReviewForm(parCycleId: number | undefined, employeeEmail: string | undefined) {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<void, Error, FormAnswers>({
    mutationFn: async (answers) => {
      if (!parCycleId || !employeeEmail) throw new Error("Missing PAR cycle");
      const accessToken = await getAccessToken();
      await authedPost<void>(
        parServiceUrls.parReviewFormSubmission(parCycleId, employeeEmail),
        accessToken,
        { answers },
        digiopsHeaders(),
      );
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["par-360-review-requests", parCycleId] }),
        qc.invalidateQueries({ queryKey: ["par-review-form", parCycleId, employeeEmail] }),
      ]);
    },
  });
}

// Every response about an employee with names, for their lead.
export function useReviewResponses(parCycleId: number | undefined, workEmail: string | undefined, enabled = true) {
  return useGet<Review360Responses>(
    ["par-review-responses", parCycleId, workEmail],
    parCycleId && workEmail ? parServiceUrls.parReviewResponses(parCycleId, workEmail) : undefined,
    enabled,
  );
}

// The employee's own anonymised summary.
export function useReviewSummary(parCycleId: number | undefined, workEmail: string | undefined, enabled = true) {
  return useGet<Review360Summary>(
    ["par-review-summary", parCycleId, workEmail],
    parCycleId && workEmail ? parServiceUrls.parReviewSummary(parCycleId, workEmail) : undefined,
    enabled,
  );
}

// A lead's members' 360° indexes and the team average.
export function useReviewIndexes(parCycleId: number | undefined, leadEmail: string | undefined, enabled = true) {
  return useGet<Review360TeamIndexes>(
    ["par-review-indexes", parCycleId, leadEmail],
    parCycleId && leadEmail ? parServiceUrls.parReviewIndexes(parCycleId, leadEmail) : undefined,
    enabled,
  );
}
