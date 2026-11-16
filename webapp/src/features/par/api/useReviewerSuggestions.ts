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
import { authedGet } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { parBackendUrl, parServiceUrls } from "@config/apiConfig";
import { digiopsHeaders } from "@features/my/util/digiopsHeaders";
import type { ReviewerSuggestions } from "./review360Types";

// People for an employee to ask for 360° feedback, from their calendar. Not
// retried: when the calendar can't be read, the picker simply goes without.
export function useReviewerSuggestions(parCycleId: number | undefined, employeeEmail: string | undefined, enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  return useQuery<ReviewerSuggestions>({
    queryKey: ["par-reviewer-suggestions", parCycleId, employeeEmail],
    enabled: enabled && isSignedIn && Boolean(parBackendUrl) && parCycleId !== undefined && Boolean(employeeEmail),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ReviewerSuggestions>(
        parServiceUrls.parReviewerSuggestions(parCycleId!, employeeEmail!),
        accessToken,
        digiopsHeaders(),
      );
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}
