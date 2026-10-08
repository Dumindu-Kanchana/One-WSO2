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

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { BarChart3 } from "@wso2/oxygen-ui-icons-react";
import { PERSPECTIVES } from "@constants/perspectives";
import { downloadStatsPaths } from "@constants/downloadStatsApps";

// Where opening Engineering lands. The REAL landing over the REAL visibility
// hook and the REAL Admin gate, with only the HTTP answer underneath mocked —
// the same way misLanding.test.tsx proves where Finance opens.
//
vi.hoisted(() => {
  window.config = {
    ...(window.config ?? {}),
    ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL: "https://stats.example",
  } as Window["config"];
});

const engineering = PERSPECTIVES.find((p) => p.key === "engineering")!;
vi.mock("@context/perspective/PerspectiveContext", () => ({
  useActivePerspective: () => ({
    key: "engineering",
    label: "Engineering",
    icon: BarChart3,
    path: "/engineering",
    access: true,
    forwardsToFirstItem: true,
    sections: engineering.sections,
  }),
}));

// Every other gate answers settled and closed, and the people-app record is
// in: the only thing that can hold or move this landing is Download Stats.
const other = { canSee: () => false, isResolving: false };
const noFailure = { isError: false, retry: () => {} };
vi.mock("@api/useUserInfo", () => ({
  useUserInfo: () => ({ data: { privileges: [987] }, isLoading: false, isError: false }),
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
vi.mock("@features/umt/api/useUmtGate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/umt/api/useUmtGate")>()),
  useUmtGate: () => ({ ...other, ...noFailure, isAuthorized: false, isAdmin: false }),
}));

// Signed out for every gate this file does not stand in for, so their queries
// stay disabled — except that the Admin gate still needs a token to ask the
// Download Stats API, which is the one request this file answers.
vi.mock("@asgardeo/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@asgardeo/react")>()),
  useAsgardeo: () => ({ isSignedIn: false, getAccessToken: async () => "test-token" }),
}));

function withQueries() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const { default: EngineeringLanding } = await import("./EngineeringLanding");

function Address() {
  return <div data-testid="address">{useLocation().pathname}</div>;
}

/** The Engineering landing, reached the way switching to Engineering reaches it. */
function openEngineering() {
  return render(
    <MemoryRouter initialEntries={["/engineering"]}>
      <Address />
      <Routes>
        <Route path="/engineering" element={<EngineeringLanding />} />
        <Route path="*" element={<div>somewhere else</div>} />
      </Routes>
    </MemoryRouter>,
    { wrapper: withQueries() },
  );
}

const address = () => screen.getByTestId("address").textContent;

function userInfo(isAdmin: boolean) {
  return vi.fn(async (url: string) => {
    if (url.includes("/user-info")) {
      return new Response(JSON.stringify({ email: "a@wso2.com", isAdmin }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 404 });
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the Engineering landing", () => {
  it("opens Download Stats → Overview for a signed-in employee", async () => {
    vi.stubGlobal("fetch", userInfo(false));
    openEngineering();
    await waitFor(() => expect(address()).toBe(downloadStatsPaths.overview));
  });

  // The first visible row, not the last one unlocked: an Admin lands on the
  // summary before the narrower screens, the same as everyone else.
  it("opens Overview for an Admin too", async () => {
    vi.stubGlobal("fetch", userInfo(true));
    openEngineering();
    await waitFor(() => expect(address()).toBe(downloadStatsPaths.overview));
  });

  // A redirect decided on an unresolved gate bounces a deep link and is not
  // undone when the answer arrives, so the landing holds instead.
  it("holds, and forwards nowhere, while the Admin check is in flight", () => {
    vi.stubGlobal("fetch", () => new Promise<Response>(() => {}));
    openEngineering();
    expect(screen.getByText("Opening Engineering…")).toBeInTheDocument();
    expect(address()).toBe("/engineering");
  });
});
