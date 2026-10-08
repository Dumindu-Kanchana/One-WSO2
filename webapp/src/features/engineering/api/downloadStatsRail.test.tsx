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
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { BarChart3 } from "@wso2/oxygen-ui-icons-react";
import { PERSPECTIVES } from "@constants/perspectives";
import { downloadStatsPaths } from "@constants/downloadStatsApps";

// What a person sees in the Engineering rail: the REAL rail over the REAL
// visibility hook and the REAL Admin gate, with only the HTTP answer
// underneath mocked — the way misRail.test.tsx proves the Finance rail.
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

// The other perspectives' gates are still asked — the rail asks for every
// gate on every render — so they need answers that reach no real useQuery.
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

const { default: SideRail } = await import("@components/side-rail/SideRail");

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

// Each case starts on a Download Stats screen, the same place the row opens.
function showRail(initial: string = downloadStatsPaths.overview) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Where />
      <SideRail collapsed={false} />
    </MemoryRouter>,
    { wrapper: withQueries() },
  );
}

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

/** Waits for the Admin check to be answered and the rail to have settled on it. */
async function settled(fetchMock: ReturnType<typeof vi.fn>) {
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** The row an on-screen label sits in. */
const rowOf = (label: string): HTMLElement => {
  const row = screen.getAllByRole("listitem").find((candidate) => candidate.textContent?.trim() === label);
  if (!row) throw new Error(`${label} is not a rail row`);
  return row;
};

const SCREEN_LABELS = ["Overview", "Downloads", "Versions", "Packages", "Repository Stats", "Admin"];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the Engineering rail", () => {
  // The screens live in the tab bar. The rail keeps the app, as one row.
  it("shows one Download Stats row and none of the screens", async () => {
    const fetchMock = userInfo(false);
    vi.stubGlobal("fetch", fetchMock);
    showRail();
    await settled(fetchMock);

    expect(screen.getByText("Download Stats")).toBeInTheDocument();
    expect(screen.queryByText("Product Download Stats")).not.toBeInTheDocument();
    for (const label of SCREEN_LABELS) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it("still shows one Download Stats row when the API says the reader is an Admin", async () => {
    vi.stubGlobal("fetch", userInfo(true));
    showRail();
    expect(await screen.findByText("Download Stats")).toBeInTheDocument();
    for (const label of SCREEN_LABELS) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it("gives the Download Stats row an icon", async () => {
    const fetchMock = userInfo(false);
    vi.stubGlobal("fetch", fetchMock);
    showRail();
    await settled(fetchMock);

    expect(rowOf("Download Stats").querySelector("svg")).not.toBeNull();
  });

  it("opens Overview when Download Stats is chosen", async () => {
    const fetchMock = userInfo(false);
    vi.stubGlobal("fetch", fetchMock);
    showRail(downloadStatsPaths.downloads);
    await settled(fetchMock);
    expect(screen.getByTestId("where")).toHaveTextContent(downloadStatsPaths.downloads);
    await userEvent.click(screen.getByText("Download Stats"));
    expect(screen.getByTestId("where")).toHaveTextContent(downloadStatsPaths.overview);
  });
});
