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
import { SIGNING_OUT_EVENT } from "@constants/appEvents";

const userInfo: {
  data?: { roles: number[] };
  isPending: boolean;
  isError: boolean;
  error?: unknown;
  refetch: ReturnType<typeof vi.fn>;
} = {
  isPending: false,
  isError: false,
  refetch: vi.fn(),
};

const asgardeo: { isSignedIn: boolean } = { isSignedIn: true };
const backend: { configured: boolean } = { configured: true };

vi.mock("./useUmtUserInfo", () => ({
  useUmtUserInfo: () => userInfo,
}));

vi.mock("@asgardeo/react", () => ({
  useAsgardeo: () => asgardeo,
}));

vi.mock("@config/apiConfig", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@config/apiConfig")>()),
  isUmtBackendConfigured: () => backend.configured,
}));

const { __resetUmtGateCacheForTests, useUmtGate } = await import("./useUmtGate");
const gate = () => renderHook(() => useUmtGate()).result.current;

beforeEach(() => {
  userInfo.data = undefined;
  userInfo.isPending = false;
  userInfo.isError = false;
  userInfo.error = undefined;
  userInfo.refetch.mockReset();
  asgardeo.isSignedIn = true;
  backend.configured = true;
  __resetUmtGateCacheForTests();
});

describe("UMT role mapping", () => {
  it.each([
    [444, "UMT_USER", "isUser"],
    [555, "UMT_ADMIN", "isAdmin"],
    [666, "PRODUCT_LEAD", "isProductLead"],
  ] as const)("maps role id %i to %s", (id, role, flag) => {
    userInfo.data = { roles: [id] };
    const result = gate();
    expect(result.isAuthorized).toBe(true);
    expect(result.hasRole(role)).toBe(true);
    expect(result[flag]).toBe(true);
  });

  it("keeps independent roles when the backend returns more than one", () => {
    userInfo.data = { roles: [444, 555, 666] };
    const result = gate();
    expect(result.isUser).toBe(true);
    expect(result.isAdmin).toBe(true);
    expect(result.isProductLead).toBe(true);
  });

  it("denies access when no recognized UMT role is present", () => {
    userInfo.data = { roles: [123, 999] };
    expect(gate().isAuthorized).toBe(false);
  });
});

describe("gate states", () => {
  it("waits for the identity and user-info decision on a genuine first load", () => {
    userInfo.isPending = true;
    expect(gate().isResolving).toBe(true);
  });

  // With no backend URL the query never runs, so it stays pending for ever.
  // A gate that reported that as resolving would hold the Engineering rail.
  it("is not resolving while the UMT backend is unset", () => {
    backend.configured = false;
    userInfo.isPending = true;
    expect(gate().isResolving).toBe(false);
  });

  it("reports a failed lookup separately from a denial", () => {
    userInfo.isError = true;
    userInfo.error = new Error("gateway unavailable");
    const result = gate();
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toBe("gateway unavailable");
    expect(result.isAuthorized).toBe(false);
  });

  it("retries the underlying user-info query", () => {
    gate().retry();
    expect(userInfo.refetch).toHaveBeenCalledOnce();
  });

  it("keeps the last successful roles through a background refetch failure instead of denying access", () => {
    // TanStack keeps `data` from the last successful fetch even while a
    // later background refetch is failing (isError and data are not
    // mutually exclusive) — a transient blip must not blank an
    // already-authorized page.
    userInfo.data = { roles: [555] };
    userInfo.isError = true;
    userInfo.error = new Error("gateway unavailable");
    const result = gate();
    expect(result.isError).toBe(false);
    expect(result.isAdmin).toBe(true);
    expect(result.isAuthorized).toBe(true);
  });
});

describe("remount smoothing (the dashboard <-> Updates navigation flash)", () => {
  it("serves the last resolved decision instead of re-resolving on a remount", () => {
    userInfo.data = { roles: [555] };
    expect(gate().isResolving).toBe(false);

    // Simulate the remount: useUmtUserInfo goes pending again for an instant
    // while useAsgardeoSub re-resolves the subject on the fresh UmtShell.
    userInfo.isPending = true;
    userInfo.data = undefined;
    const result = gate();
    expect(result.isResolving).toBe(false);
    expect(result.isAdmin).toBe(true);
    expect(result.isAuthorized).toBe(true);
  });

  it("updates to a genuine role change once the new fetch resolves", () => {
    userInfo.data = { roles: [555] };
    expect(gate().isAdmin).toBe(true);

    userInfo.data = { roles: [444] };
    const result = gate();
    expect(result.isAdmin).toBe(false);
    expect(result.isUser).toBe(true);
  });

  // AuthGuard swaps <Outlet/> for a spinner in the same commit that isSignedIn
  // flips false, so the hook is unmounted before it could observe the
  // transition. The module-level SIGNING_OUT_EVENT listener is what clears the
  // cache, independently of the React tree.
  it("clears the cached decision on SIGNING_OUT_EVENT, so a new sign-in resolves fresh", () => {
    userInfo.data = { roles: [555] };
    expect(gate().isAdmin).toBe(true);

    window.dispatchEvent(new Event(SIGNING_OUT_EVENT));

    userInfo.isPending = true;
    userInfo.data = undefined;
    const result = gate();
    expect(result.isResolving).toBe(true);
    expect(result.isAdmin).toBe(false);
  });
});
