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


import { describe, expect, it } from "vitest";
import { NO_FILTERS, filtersFromSearch, filtersToSearch, hasEchoFilters } from "./callFilters";

describe("callFilters", () => {
  it("reads every filter from the URL and writes it back the same", () => {
    const search = "scope=all&q=nordlys&team=Sales+-+EU&owner=lars%40wso2.com&owner=maya%40wso2.com&region=EU&type=renewal"
      + "&account=001Hb00000Nordl001&from=2026-11-01&to=2026-11-30";
    const filters = filtersFromSearch(new URLSearchParams(search));
    expect(filters).toEqual({
      scope: "all",
      q: "nordlys",
      hostTeam: "Sales - EU",
      owners: ["lars@wso2.com", "maya@wso2.com"],
      regions: ["EU"],
      types: ["renewal"],
      accounts: ["001Hb00000Nordl001"],
      opportunities: [],
      from: "2026-11-01",
      to: "2026-11-30",
    });
    expect(filtersToSearch(filters).toString()).toBe(search);
  });

  it("writes nothing for the plain list, and drops what it cannot read", () => {
    expect(filtersToSearch(NO_FILTERS).toString()).toBe("");
    const filters = filtersFromSearch(new URLSearchParams("scope=nonsense&from=last-week&owner=&owner=a%40wso2.com&owner=a%40wso2.com"));
    expect(filters.scope).toBe("echo");
    expect(filters.from).toBeNull();
    expect(filters.owners).toEqual(["a@wso2.com"]);
  });

  it("keeps real days and drops impossible ones", () => {
    const dates = (from: string, to: string) => {
      const filters = filtersFromSearch(new URLSearchParams({ from, to }));
      return [filters.from, filters.to];
    };
    expect(dates("2026-11-01", "2028-02-29")).toEqual(["2026-11-01", "2028-02-29"]);
    expect(dates("2026-13-01", "2026-02-30")).toEqual([null, null]);
    expect(dates("2026-00-10", "2026-04-31")).toEqual([null, null]);
    expect(dates("2027-02-29", "2026-11-00")).toEqual([null, null]);
  });

  it("tells the Echo filters from the search text", () => {
    expect(hasEchoFilters({ ...NO_FILTERS, q: "x" })).toBe(false);
    expect(hasEchoFilters({ ...NO_FILTERS, hostTeam: "Sales - EU" })).toBe(false);
    expect(hasEchoFilters({ ...NO_FILTERS, to: "2026-11-30" })).toBe(true);
  });
});
