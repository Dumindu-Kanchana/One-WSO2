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

// The calls list's filters, as they live in the URL: a filtered view is a link that can be
// shared, and survives a refresh. Only what is set is written, so the plain list is the
// plain path.

import type { MeetingScope } from "../../api/salesTypes";

export interface CallFilters {
  scope: MeetingScope;
  /** Search text: title, account or opportunity name in the Echo scope. */
  q: string | null;
  /**
   * Regions. In the Echo scope, any of these Sales Regions; in the All scope the list is
   * filtered by one region of its own, the first.
   */
  regions: string[];
  // The rest filter the Echo scope only.
  /** Opportunity owner (AM) emails; any of them. */
  owners: string[];
  /** Call types; any of them. */
  types: string[];
  /** Accounts; any of them, matching a call's own account or its opportunity's. */
  accounts: string[];
  /** Opportunities; any of them. */
  opportunities: string[];
  /** `YYYY-MM-DD`, inclusive. */
  from: string | null;
  to: string | null;
}

export const NO_FILTERS: CallFilters = {
  scope: "echo",
  q: null,
  regions: [],
  owners: [],
  types: [],
  accounts: [],
  opportunities: [],
  from: null,
  to: null,
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const text = (value: string | null): string | null => value?.trim() || null;
const list = (values: string[]): string[] => [...new Set(values.map((v) => v.trim()).filter(Boolean))];
const date = (value: string | null): string | null => (value && DATE.test(value) ? value : null);

export function filtersFromSearch(params: URLSearchParams): CallFilters {
  return {
    scope: params.get("scope") === "all" ? "all" : "echo",
    q: text(params.get("q")),
    regions: list(params.getAll("region")),
    owners: list(params.getAll("owner")),
    types: list(params.getAll("type")),
    accounts: list(params.getAll("account")),
    opportunities: list(params.getAll("opportunity")),
    from: date(params.get("from")),
    to: date(params.get("to")),
  };
}

export function filtersToSearch(filters: CallFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.scope === "all") params.set("scope", "all");
  if (filters.q) params.set("q", filters.q);
  filters.owners.forEach((owner) => params.append("owner", owner));
  filters.regions.forEach((region) => params.append("region", region));
  filters.types.forEach((type) => params.append("type", type));
  filters.accounts.forEach((account) => params.append("account", account));
  filters.opportunities.forEach((opportunity) => params.append("opportunity", opportunity));
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return params;
}

/** True when any of the Echo scope's own filters is set (search text aside). */
export function hasEchoFilters(filters: CallFilters): boolean {
  return (
    filters.owners.length > 0 ||
    filters.regions.length > 0 ||
    filters.types.length > 0 ||
    filters.accounts.length > 0 ||
    filters.opportunities.length > 0 ||
    filters.from !== null ||
    filters.to !== null
  );
}
