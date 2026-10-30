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
import { renderHook } from "@testing-library/react";

// Captures the queries useLegacyParHistoryByCycles builds, so tests can run
// their own queryFn and assert on the real fallback logic.
type Query = { queryKey: unknown[]; queryFn: () => Promise<unknown> };
let capturedQueries: Query[] = [];
let combine: ((results: unknown[]) => unknown) | undefined;
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isLoading: true, isError: false }),
  useQueries: (options: { queries: Query[]; combine: (results: unknown[]) => unknown }) => {
    capturedQueries = options.queries;
    combine = options.combine;
    return {};
  },
}));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@api/http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@api/http")>();
  return { ...actual, authedGet: vi.fn() };
});

const { authedGet, HttpError } = await import("@api/http");
const { useLegacyParHistoryByCycles } = await import("./useParAdmin");

const CYCLE = "2016 Quarterly Review - Q3/Q4";
const rows = [{ legacyHeaderId: 1 }];

function runQuery() {
  renderHook(() => useLegacyParHistoryByCycles([CYCLE]));
  return capturedQueries[0].queryFn();
}

const calledUrls = () => vi.mocked(authedGet).mock.calls.map(([url]) => new URL(url, "http://x"));

beforeEach(() => {
  vi.mocked(authedGet).mockReset();
});

describe("useLegacyParHistoryByCycles", () => {
  it("asks the query-parameter route, with the cycle name in the query string", async () => {
    vi.mocked(authedGet).mockResolvedValueOnce(rows);
    await expect(runQuery()).resolves.toEqual(rows);
    const [url] = calledUrls();
    expect(calledUrls()).toHaveLength(1);
    expect(url.pathname).toMatch(/\/legacy-par-history-cycles\/participants$/);
    expect(url.searchParams.get("cycleName")).toBe(CYCLE);
    expect(url.searchParams.get("summary")).toBe("true");
  });

  it.each([404, 405])("falls back to the path route when the backend doesn't have the new one yet (%i)", async (status) => {
    vi.mocked(authedGet).mockRejectedValueOnce(new HttpError("url", status, "")).mockResolvedValueOnce(rows);
    await expect(runQuery()).resolves.toEqual(rows);
    const [, fallback] = calledUrls();
    expect(calledUrls()).toHaveLength(2);
    expect(fallback.pathname).toContain("/legacy-par-history-cycles/");
    expect(fallback.pathname).toMatch(/\/participants$/);
    expect(fallback.searchParams.get("summary")).toBe("true");
  });

  it.each([400, 403, 500])("rethrows any other error without a second request (%i)", async (status) => {
    vi.mocked(authedGet).mockRejectedValueOnce(new HttpError("url", status, ""));
    await expect(runQuery()).rejects.toMatchObject({ status });
    expect(calledUrls()).toHaveLength(1);
  });

  it("surfaces the path route's own error when the fallback fails too", async () => {
    // e.g. enableLegacyParDataView off: both routes answer 404.
    vi.mocked(authedGet)
      .mockRejectedValueOnce(new HttpError("url", 404, ""))
      .mockRejectedValueOnce(new HttpError("url", 404, "path"));
    await expect(runQuery()).rejects.toMatchObject({ status: 404, responseBody: "path" });
  });

  it("asks for every stored spelling, one query each", () => {
    const names = ["(3) ANNUAL PERFORMANCE REVIEW - Engineering Employees", "2015 ANNUAL PERFORMANCE REVIEW for Engineering Employees"];
    renderHook(() => useLegacyParHistoryByCycles(names));
    expect(capturedQueries.map((q) => q.queryKey)).toEqual(names.map((n) => ["par-admin-legacy-cycle-participants", n]));
  });

  it("combines the spellings into one roster, only once every one has loaded", () => {
    const refetch = vi.fn();
    const result = (over: object) => ({ data: undefined, isLoading: false, isError: false, error: null, isFetching: false, refetch, ...over });
    renderHook(() => useLegacyParHistoryByCycles(["a", "b"]));

    expect(combine!([result({ data: [{ legacyHeaderId: 1 }] }), result({ data: [{ legacyHeaderId: 2 }] })])).toMatchObject({
      data: [{ legacyHeaderId: 1 }, { legacyHeaderId: 2 }],
      isLoading: false,
      isError: false,
    });
    expect(combine!([result({ data: [{ legacyHeaderId: 1 }] }), result({ isLoading: true })])).toMatchObject({ data: undefined, isLoading: true });
    const failure = new Error("Failed to fetch");
    const failed = combine!([result({ data: [] }), result({ isError: true, error: failure })]) as { isError: boolean; error: Error; refetch: () => void };
    expect(failed).toMatchObject({ isError: true, error: failure });
    failed.refetch();
    expect(refetch).toHaveBeenCalledTimes(2);
  });
});
