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

// The call-context route behind one interface, as the MEDDPICC client is: the backend
// over HTTP here, and a stand-in the tests swap in, so they run the real hook and cache.

import { HttpError, authedPost } from "@api/http";
import { echoServiceUrls } from "@config/apiConfig";
import type { CallContextRequest, CallContextResponse } from "../types";

export interface CallContextClient {
  context(request: CallContextRequest): Promise<CallContextResponse>;
}

/** The contract's cap on each id list in one request. */
export const CONTEXT_BATCH_LIMIT = 200;

export function httpCallContextClient(getAccessToken: () => Promise<string>): CallContextClient {
  return {
    context: async (request) => {
      const url = echoServiceUrls.salesforceContext;
      const body = await authedPost<Partial<CallContextResponse>>(url, await getAccessToken(), request);
      // The route always answers with a body; an empty one is a broken response.
      if (body === null) throw new HttpError(url, 502, "");
      // Either map may be left out when nothing in it was found.
      return {
        opportunities: body.opportunities ?? {},
        accounts: body.accounts ?? {},
        asOf: body.asOf ?? "",
      };
    },
  };
}
