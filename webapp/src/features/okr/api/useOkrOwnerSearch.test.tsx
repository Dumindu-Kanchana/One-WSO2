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

import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const authedPost = vi.fn<(url: string, token: string, body: unknown) => Promise<unknown>>(async () => ({
  employees: [
    {
      workEmail: "maya@example.com",
      firstName: "Maya",
      lastName: "Fernando",
      jobRole: "Engineer",
      employeeThumbnail: null,
    },
  ],
  totalCount: 1,
}));

vi.mock("@api/http", () => ({
  authedPost: (url: string, token: string, body: unknown) => authedPost(url, token, body),
  defaultQueryRetry: false,
}));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@hooks/useAsgardeoSub", () => ({ useAsgardeoSub: () => ({ state: { status: "ready", sub: "sub-1" } }) }));
vi.mock("./useOkrs", () => ({ okrsEnabled: () => true }));
vi.mock("@config/apiConfig", () => ({ peopleServiceUrls: { employeesSearch: "http://people/employees/search" } }));

const { useOkrOwnerSearch } = await import("./useOkrOwnerSearch");

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

beforeEach(() => authedPost.mockClear());

describe("useOkrOwnerSearch", () => {
  it("searches a lead's whole reporting chain, not only their direct reports", async () => {
    const { result } = renderHook(() => useOkrOwnerSearch(" ma ", false), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    // The people backend walks the chain only when directReports is false;
    // left out, it returns direct reports alone.
    expect(authedPost).toHaveBeenCalledWith(
      "http://people/employees/search",
      "token",
      expect.objectContaining({
        leadOnly: true,
        searchString: "ma",
        filters: expect.objectContaining({ directReports: false, employeeStatuses: ["Active", "Marked leaver"] }),
      }),
    );
    expect(result.current.data?.[0]).toEqual({
      workEmail: "maya@example.com",
      name: "Maya Fernando",
      jobRole: "Engineer",
      thumbnail: null,
    });
  });

  it("searches everyone for a People Ops admin", async () => {
    renderHook(() => useOkrOwnerSearch("", true), { wrapper });
    await waitFor(() => expect(authedPost).toHaveBeenCalled());
    const body = authedPost.mock.calls[0][2] as Record<string, unknown>;
    expect(body.leadOnly).toBe(false);
    expect(body).not.toHaveProperty("searchString");
  });
});
