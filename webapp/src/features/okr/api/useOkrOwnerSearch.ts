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

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedPost, defaultQueryRetry } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { peopleServiceUrls } from "@config/apiConfig";
import type { FilteredEmployeesResponse } from "@features/my/api/types";
import { okrsEnabled } from "./useOkrs";

/** Someone an OKR can be set for. */
export interface OkrOwnerOption {
  workEmail: string;
  name: string;
  jobRole: string | null;
  thumbnail: string | null;
}

const PAGE = 25;

/**
 * People to set an OKR for, matching what's typed: everyone in your reporting
 * chain, or, for People Ops admins, everyone. Current employees only, the same
 * people the backend accepts. Typing narrows it on the server, since a chain
 * can be far longer than one page.
 */
export function useOkrOwnerSearch(searchText: string, everyone: boolean, enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state } = useAsgardeoSub();
  const userSub = state.status === "ready" ? state.sub : undefined;
  const search = searchText.trim();
  return useQuery<OkrOwnerOption[]>({
    queryKey: ["okr-owners", userSub, everyone, search],
    enabled: enabled && okrsEnabled() && isSignedIn && Boolean(userSub),
    queryFn: async () => {
      const res = await authedPost<FilteredEmployeesResponse>(peopleServiceUrls.employeesSearch, await getAccessToken(), {
        // directReports must be false, not left out, for the whole chain.
        filters: { employeeStatuses: ["Active", "Marked leaver"], directReports: false },
        pagination: { limit: PAGE, offset: 0 },
        sort: { sortField: "fullName", sortOrder: "ASC" },
        // The server scopes a lead's search to their own chain from the token.
        leadOnly: !everyone,
        ...(search ? { searchString: search } : {}),
      });
      return (res?.employees ?? []).map((e) => ({
        workEmail: e.workEmail,
        name: `${e.firstName} ${e.lastName}`.trim(),
        jobRole: e.jobRole,
        thumbnail: e.employeeThumbnail,
      }));
    },
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
    retry: defaultQueryRetry,
  });
}
