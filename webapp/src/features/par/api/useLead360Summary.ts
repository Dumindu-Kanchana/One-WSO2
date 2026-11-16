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
import { authedGet, authedPut } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { parServiceUrls } from "@config/apiConfig";
import { digiopsHeaders } from "@features/my/util/digiopsHeaders";
import type { ParRating } from "./types";

// GET .../lead-360-summary/suggestion — the response.
export interface Lead360SummarySuggestion {
  // Plain text, one paragraph per line.
  summary: string;
  // How many submitted 360° responses it was written from.
  responseCount: number;
  // How many more can be written for this employee in this cycle.
  suggestionsLeft: number;
}

// The AI-suggested 360° summary of an employee, for their lead to start from.
// The backend writes it the first time it's asked for and keeps it, writing a
// new one only once more responses have come in, so the key carries the
// response count. Never retried: each one written counts toward a cap, even
// when the model fails. The cached rating takes what it was written from, so
// the panel can tell when more responses have come in since.
export function useLead360SummarySuggestion(
  parCycleId: number,
  employeeEmail: string,
  responseCount: number,
  enabled: boolean,
) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useQuery<Lead360SummarySuggestion, Error>({
    queryKey: ["par-lead-360-suggestion", parCycleId, employeeEmail, responseCount],
    enabled: enabled && isSignedIn,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      const suggestion = await authedGet<Lead360SummarySuggestion>(
        parServiceUrls.parLead360SummarySuggestion(parCycleId, employeeEmail),
        accessToken,
        digiopsHeaders(),
      );
      if (!suggestion) throw new Error("The suggestion came back empty.");
      qc.setQueryData<ParRating | null>(["par-rating", parCycleId, employeeEmail], (old) =>
        old
          ? {
              ...old,
              parLead360SuggestionResponses: suggestion.responseCount,
              parLead360SuggestionsLeft: suggestion.suggestionsLeft,
            }
          : old,
      );
      return suggestion;
    },
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

// Saves (or, with "", clears) the lead's 360° summary: base64 HTML, like the
// lead's comment. The cached rating takes the saved value, so the panel's
// "unsaved" check settles without a refetch.
export function useSaveLead360Summary(parCycleId: number, employeeEmail: string) {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (summary) => {
      const accessToken = await getAccessToken();
      await authedPut<void>(
        parServiceUrls.parLead360Summary(parCycleId, employeeEmail),
        accessToken,
        { summary },
        digiopsHeaders(),
      );
    },
    onSuccess: (_data, summary) => {
      qc.setQueryData<ParRating | null>(["par-rating", parCycleId, employeeEmail], (old) =>
        old ? { ...old, parLead360Summary: summary || undefined } : old,
      );
    },
  });
}
