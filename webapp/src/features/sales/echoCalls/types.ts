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

// Wire types for the Echo calls list on the Echo backend (ONE_WSO2_ECHO_BACKEND_URL):
// `GET /calls` and `GET /calls/filters`. The backend keeps a copy of each call's
// Salesforce context, refreshed daily, so the list can be filtered by it across every
// call; the call page still reads the live values.

import type { Meeting } from "../api/salesTypes";

/**
 * The opportunity as last read for the list. Present whenever the call is linked to one, but
 * its fields are null until Salesforce has first been read for it.
 */
export interface StoredOpportunity {
  id: string;
  name: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  salesRegion: string | null;
  stage: string | null;
  accountId: string | null;
  accountName: string | null;
}

/** The account as last read for the list; null on a call with no account link of its own. */
export interface StoredAccount {
  id: string;
  name: string;
  /** The Sales Region, e.g. "APAC": the same vocabulary as the opportunity's and the Region filter. */
  region: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  technicalOwnerName: string | null;
  technicalOwnerEmail: string | null;
}

export interface StoredCallContext {
  opportunity: StoredOpportunity | null;
  account: StoredAccount | null;
  /** The opportunity owner's email, else the host's: what the owner filter matches. */
  ownerEmail: string | null;
  /** True when `ownerEmail` is the host's, standing in for an owner the call has none of. */
  ownerIsHost: boolean;
  /** The opportunity's region, else the account's: what the region filter matches. */
  region: string | null;
  /** When Salesforce was last read for this call. */
  readAt: string | null;
}

export interface EchoCall {
  meeting: Meeting;
  context: StoredCallContext;
}

/** `GET /calls` — `count` is the unpaged total, for server-side paging. */
export interface EchoCallList {
  count: number;
  calls: EchoCall[];
}

/** `GET /calls/filters` — every option comes with how many calls it would match. */
export interface CallFilterOptions {
  owners: { email: string; name: string | null; calls: number }[];
  regions: { region: string; calls: number }[];
  callTypes: { type: string; calls: number }[];
  /** The top matches for `q` by name, not every account. */
  accounts: { id: string; name: string; calls: number }[];
  opportunities: { id: string; name: string; calls: number }[];
}
