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

// Wire types for `POST /salesforce/context` on the Echo backend
// (ONE_WSO2_ECHO_BACKEND_URL): live Salesforce details of the opportunities and
// accounts a page of calls is linked to.

/** The ids to look up. The server de-duplicates and ignores anything that is not a Salesforce id. */
export interface CallContextRequest {
  opportunityIds: string[];
  accountIds: string[];
}

/** One opportunity, as Salesforce holds it now. Nullable fields are absent in Salesforce. */
export interface ContextOpportunity {
  id: string;
  name: string;
  /** The opportunity owner: in WSO2's process, the AM. */
  ownerName: string | null;
  ownerEmail: string | null;
  /** Sales Region, e.g. "APAC". */
  salesRegion: string | null;
  stage: string | null;
  recordType: string | null;
  amount: number | null;
  currency: string | null;
  /** `YYYY-MM-DD`. */
  closeDate: string | null;
  isClosed: boolean;
  accountId: string | null;
  accountName: string | null;
}

/** One account, as Salesforce holds it now. */
export interface ContextAccount {
  id: string;
  name: string;
  /** The long form, e.g. "Asia Pacific". */
  region: string | null;
  /** The Sales Region code, e.g. "APAC" — the same field an opportunity's region is. */
  salesRegion: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  technicalOwnerName: string | null;
  technicalOwnerEmail: string | null;
}

/**
 * The answer, keyed by the id asked for. An id Salesforce could not find, or could not be
 * read for, is simply absent: the screens fall back for that row alone.
 */
export interface CallContextResponse {
  opportunities: Record<string, ContextOpportunity>;
  accounts: Record<string, ContextAccount>;
  asOf: string;
}
