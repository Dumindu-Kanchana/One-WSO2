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

// The Echo calls routes behind one interface, as the MEDDPICC client is: the backend over
// HTTP here, and an in-memory stand-in in ../testing that the tests swap in.

import { authedGet } from "@api/http";
import { buildEchoCallsUrl, echoServiceUrls } from "@config/apiConfig";
import type { CallFilterOptions, EchoCallList } from "../types";

export interface EchoCallsQuery {
  page: number;
  pageSize: number;
  q: string | null;
  owners: string[];
  regions: string[];
  types: string[];
  accounts: string[];
  opportunities: string[];
  from: string | null;
  to: string | null;
}

export interface EchoCallsClient {
  calls(query: EchoCallsQuery): Promise<EchoCallList>;
  /** `q` narrows the accounts and opportunities offered; the other lists are complete. */
  filters(q: string): Promise<CallFilterOptions>;
}

export function httpEchoCallsClient(getAccessToken: () => Promise<string>): EchoCallsClient {
  return {
    calls: async (query) => {
      const list = await authedGet<Partial<EchoCallList>>(buildEchoCallsUrl(query), await getAccessToken());
      return { count: list.count ?? 0, calls: list.calls ?? [] };
    },
    filters: async (q) => {
      const options = await authedGet<Partial<CallFilterOptions>>(
        echoServiceUrls.callFilters(q),
        await getAccessToken(),
      );
      return {
        owners: options.owners ?? [],
        regions: options.regions ?? [],
        callTypes: options.callTypes ?? [],
        accounts: options.accounts ?? [],
        opportunities: options.opportunities ?? [],
      };
    },
  };
}
