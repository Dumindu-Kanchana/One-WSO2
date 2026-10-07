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

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useAccessToken } from "@hooks/useAccessToken";
import {
  getRepositories,
  productDownloadStatsBackendUrl,
  type RepositoriesResponse,
  type TrackedRepository,
} from "./productDownloadStats";

// The Tracked repositories, as the product picker and the screens read them.
// Keyed exactly as the screens already key this request, so a picker and the
// screen beside it share one cache entry and one fetch.
export function useTrackedRepositories(): UseQueryResult<RepositoriesResponse> {
  const getToken = useAccessToken();
  const base = productDownloadStatsBackendUrl();
  return useQuery({
    queryKey: ["product-download-stats", "repositories", base],
    queryFn: async () => getRepositories(await getToken()),
  });
}

// Only an Admin sees inactive Tracked repositories (CONTEXT.md); every other
// list is of the active ones. A repository that says nothing is active.
export function activeRepositories(
  response: RepositoriesResponse | undefined,
): TrackedRepository[] {
  return (response?.repositories ?? []).filter((repository) => repository.isActive !== false);
}
