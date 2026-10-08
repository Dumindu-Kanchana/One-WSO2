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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { HouseIcon } from "@wso2/oxygen-ui-icons-react";

// When the rail asks UMT for the caller's roles. UMT's rows live inside
// Engineering behind the `umt` flag, so its /update/user-info is asked only
// while Engineering is open and the `umt` flag is on — never with UMT
// switched off, and never from another perspective. Same contract as Finance MIS
// (misPreviewFlagOff.test.tsx).

const asked = { enabled: [] as boolean[] };
vi.mock("@features/umt/api/useUmtGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/umt/api/useUmtGate")>()),
  useUmtGate: (enabled = true) => {
    asked.enabled.push(enabled);
    return {
      isAuthorized: false,
      isUser: false,
      isAdmin: false,
      isProductLead: false,
      hasRole: () => false,
      isResolving: false,
      isError: false,
      retry: () => {},
    };
  },
}));

const active = { key: "engineering" };
vi.mock("@context/perspective/PerspectiveContext", () => ({
  useActivePerspective: () => ({
    key: active.key,
    label: active.key,
    icon: HouseIcon,
    path: `/${active.key}`,
    access: true,
    sections: [],
  }),
}));

// Every other gate answers settled and closed, so nothing else is in play.
const other = { canSee: () => false, isResolving: false };
const noFailure = { isError: false, retry: () => {} };
vi.mock("@api/useUserInfo", () => ({
  useUserInfo: () => ({ data: { privileges: [] }, isLoading: false, isError: false }),
}));
vi.mock("@features/finance/api/useFinanceGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/finance/api/useFinanceGate")>()),
  useFinanceGate: () => other,
}));
vi.mock("@features/leave/api/useLeaveGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/leave/api/useLeaveGate")>()),
  useLeaveGate: () => other,
}));
vi.mock("@features/marketing-ops/api/useMarketingOpsGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/marketing-ops/api/useMarketingOpsGate")>()),
  useMarketingOpsGate: () => ({ ...other, ...noFailure, isAuthorized: false, isAdmin: false }),
}));
vi.mock("@features/due-diligence/api/useDueDiligenceGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/due-diligence/api/useDueDiligenceGate")>()),
  useDueDiligenceGate: () => ({ ...other, ...noFailure }),
}));
vi.mock("@features/security/api/useSecurityGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/security/api/useSecurityGate")>()),
  useSecurityGate: () => other,
}));
vi.mock("@features/sales/api/useSalesGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/sales/api/useSalesGate")>()),
  useSalesRailGate: () => ({ ...other, ...noFailure, errorMessage: undefined }),
}));
vi.mock("@features/my/api/useMeProfile", () => ({
  useMeProfile: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("@features/subscriptions/api/useSubscriptionGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/subscriptions/api/useSubscriptionGate")>()),
  useSubscriptionGate: () => ({ ...other, ...noFailure, isAdmin: false }),
}));
vi.mock("@features/par/api/useParData", () => ({
  useParCanSeeLeadPortal: () => ({ canSee: false, isLoading: false }),
  useParEmployeeItemVisible: () => ({ canSee: false, isLoading: false }),
}));
vi.mock("@features/par/api/useParIsAdmin", () => ({
  useParIsAdmin: () => ({ isAdmin: false, isLoading: false }),
}));
vi.mock("@features/promotion/api/usePromotionRoles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/promotion/api/usePromotionRoles")>()),
  usePromotionPrivileges: () => ({
    isLead: false,
    isFunctionalLead: false,
    isHrAdmin: false,
    isPromotionBoardMember: false,
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@features/infra/api/useInfraGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/infra/api/useInfraGate")>()),
  useInfraGate: () => ({ ...other, ...noFailure, isAuthorized: false, isAdmin: false }),
}));

// Every gate not stood in for above runs for real, signed out, inside a real
// QueryClient: its query is disabled, so it asks nothing.
vi.mock("@asgardeo/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@asgardeo/react")>()),
  useAsgardeo: () => ({ isSignedIn: false }),
}));

function withQueries() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const { usePerspectiveVisibility } = await import("@components/side-rail/usePerspectiveVisibility");

const originalConfig = window.config;
function withFlags(flags: { umt?: boolean }) {
  window.config = { ...(originalConfig ?? {}), ONE_WSO2_PREVIEW_FEATURES: flags } as Window["config"];
}

/** Whether rendering the rail asked UMT for the caller's roles. */
function asksUmt(): boolean {
  asked.enabled = [];
  renderHook(() => usePerspectiveVisibility(), { wrapper: withQueries() });
  return asked.enabled.some(Boolean);
}

beforeEach(() => {
  active.key = "engineering";
});
afterEach(() => {
  window.config = originalConfig;
});

describe("the rail asking UMT for roles", () => {
  it("asks on Engineering when the umt flag is on", () => {
    withFlags({ umt: true });
    expect(asksUmt()).toBe(true);
  });

  it("asks nothing with the umt flag off", () => {
    withFlags({ umt: false });
    expect(asksUmt()).toBe(false);
  });

  it("asks nothing from another perspective", () => {
    withFlags({ umt: true });
    active.key = "finance";
    expect(asksUmt()).toBe(false);
  });
});
