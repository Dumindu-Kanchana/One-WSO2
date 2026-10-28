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
import { digiopsHeaders } from "@features/my/util/digiopsHeaders";
import type { SelfReview, SelfReviewAnswers } from "./selfReviewTypes";

// A cycle's guided self-review, or null for a cycle that still uses the
// single employee comment (the backend's 404).
export function useSelfReview(parCycleId: number | undefined, workEmail: string | undefined, enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  return useQuery<SelfReview | null>({
    queryKey: ["par-self-review", parCycleId, workEmail],
    enabled: enabled && isSignedIn && Boolean(parBackendUrl) && Boolean(parCycleId) && Boolean(workEmail),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      try {
        return await authedGet<SelfReview>(
          parServiceUrls.parSelfReview(parCycleId!, workEmail!),
          accessToken,
          digiopsHeaders(),
        );
      } catch (err) {
        if (err instanceof HttpError && err.status === 404) return null;
        throw err;
      }
    },
    retry: defaultQueryRetry,
  });
}

// Saves the employee's draft. Only the PAR record is refreshed afterwards
// (the first save moves it from PENDING to DRAFT); refetching the answers
// would race whatever the employee has typed since.
export function useSaveSelfReview(parCycleId: number | undefined, workEmail: string | undefined) {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<void, Error, SelfReviewAnswers>({
    mutationFn: async (answers) => {
      if (!parCycleId || !workEmail) throw new Error("Missing PAR cycle");
      const accessToken = await getAccessToken();
      await authedPut<void>(parServiceUrls.parSelfReview(parCycleId, workEmail), accessToken, { answers }, digiopsHeaders());
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["par-rating", parCycleId, workEmail] });
    },
  });
}

export function useShareSelfReview(parCycleId: number | undefined, workEmail: string | undefined) {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      if (!parCycleId || !workEmail) throw new Error("Missing PAR cycle");
      const accessToken = await getAccessToken();
      await authedPost<void>(parServiceUrls.parSelfReviewShare(parCycleId, workEmail), accessToken, {}, digiopsHeaders());
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["par-rating", parCycleId, workEmail] }),
        qc.invalidateQueries({ queryKey: ["par-self-review", parCycleId, workEmail] }),
      ]);
    },
  });
}
