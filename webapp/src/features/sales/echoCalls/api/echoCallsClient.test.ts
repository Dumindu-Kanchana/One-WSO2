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


import { beforeEach, describe, expect, it, vi } from "vitest";

const authedGet = vi.fn();
vi.mock("@api/http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@api/http")>()),
  authedGet: (url: string, token: string) => authedGet(url, token),
}));

import { httpEchoCallsClient } from "./echoCallsClient";

beforeEach(() => authedGet.mockReset());

describe("httpEchoCallsClient", () => {
  it("repeats every filter it is given, and leaves out the ones that aren't set", async () => {
    authedGet.mockResolvedValue({ count: 0, calls: [] });
    await httpEchoCallsClient(async () => "token").calls({
      page: 2,
      pageSize: 25,
      q: " nordlys ",
      owners: ["lars@wso2.com", "maya@wso2.com"],
      regions: ["EU"],
      types: [],
      accounts: ["001Hb00000Nordl001", "001Hb00000Merid001"],
      opportunities: ["006Hb00000Harbr001"],
      from: "2026-11-01",
      to: null,
    });
    const url = new URL(authedGet.mock.calls[0][0] as string, "http://host");
    expect(url.pathname.endsWith("/calls")).toBe(true);
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("pageSize")).toBe("25");
    expect(url.searchParams.getAll("owner")).toEqual(["lars@wso2.com", "maya@wso2.com"]);
    expect(url.searchParams.getAll("account")).toEqual(["001Hb00000Nordl001", "001Hb00000Merid001"]);
    expect(url.searchParams.getAll("opportunity")).toEqual(["006Hb00000Harbr001"]);
    expect(url.searchParams.get("q")).toBe("nordlys");
    expect(url.searchParams.has("type")).toBe(false);
    expect(url.searchParams.has("to")).toBe(false);
    expect(authedGet.mock.calls[0][1]).toBe("token");
  });

  it("reads a list or filter answer with parts left out as empty", async () => {
    authedGet.mockResolvedValueOnce({}).mockResolvedValueOnce({ owners: [{ email: "a@wso2.com", name: null, calls: 1 }] });
    const client = httpEchoCallsClient(async () => "token");
    expect(await client.calls({
      page: 0, pageSize: 10, q: null, owners: [], regions: [], types: [], accounts: [], opportunities: [], from: null, to: null,
    })).toEqual({ count: 0, calls: [] });
    const options = await client.filters("harb");
    expect(options.regions).toEqual([]);
    expect(options.owners).toHaveLength(1);
    expect(authedGet.mock.calls[1][0]).toMatch(/\/calls\/filters\?q=harb$/);
  });
});
