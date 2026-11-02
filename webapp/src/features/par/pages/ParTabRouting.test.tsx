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
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import type { ReactNode } from "react";

// Mocked at the query layer rather than at useParHasLead, so the real gate
// formula is what runs here.
const employeeInfo: { isSuccess: boolean; data?: { leadEmail: string | null } } = {
  isSuccess: false,
};

// ParRequiresActiveCycleRoute/useParHasActiveCycle's own query — GET
// /par-cycles?email=&status=OPEN via useActiveParCycle, keyed "par-cycles-open".
// Unresolved (isSuccess false) fails OPEN, same shape as employeeInfo above.
const openCycles: { isSuccess: boolean; data?: unknown[] } = {
  isSuccess: false,
};

// GET /par-cycles/{id}/forms: a PAR 2.0 cycle lists PEER_360 (useParShowsPar2).
const cycleForms: { isSuccess: boolean; data?: string[] } = { isSuccess: false };

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    if (queryKey[0] === "par-employee-info") return employeeInfo;
    if (queryKey[0] === "par-cycles-open") return openCycles;
    if (queryKey[0] === "par-cycle-forms") return cycleForms;
    return { data: undefined };
  },
}));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));

const profile = {
  data: { userInfo: { workEmail: "someone@wso2.com" }, employee: { employmentType: "Permanent" } },
  isLoading: false,
  // Distinct from isLoading on purpose — see useParEmployeeItemVisible.
  isPending: false,
};
vi.mock("@features/my/api/useMeProfile", () => ({ useMeProfile: () => profile }));

vi.mock("../components/ParShell", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const {
  default: ParGroupPage,
  ParGroupIndex,
  ParRequiresLeadRoute,
  ParRequiresActiveCycleRoute,
  ParRequiresSomethingToShowRoute,
} = await import("./ParGroupPage");

/** Always mounted, so a redirect is visible even when the route renders nothing. */
function UrlProbe() {
  const { pathname } = useLocation();
  return <div data-testid="url">{pathname}</div>;
}

function Tab({ name }: { name: string }) {
  return <div data-testid="tab-body">{name}</div>;
}

beforeEach(() => {
  employeeInfo.isSuccess = false;
  employeeInfo.data = undefined;
  openCycles.isSuccess = false;
  openCycles.data = undefined;
  cycleForms.isSuccess = false;
  cycleForms.data = undefined;
  profile.isLoading = false;
  profile.isPending = false;
  profile.data.employee.employmentType = "Permanent";
});

function hasLead(leadEmail: string | null) {
  employeeInfo.isSuccess = true;
  employeeInfo.data = { leadEmail };
}

function hasNoActiveCycle() {
  openCycles.isSuccess = true;
  openCycles.data = [];
}

function hasActiveCycle() {
  openCycles.isSuccess = true;
  openCycles.data = [{ parCycleId: 1 }];
}

function isIntern() {
  profile.data.employee.employmentType = "Internship";
}

/** The group, wired the way App.tsx wires it. */
function show(initial = "/me/performance") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <UrlProbe />
      <Routes>
        <Route
          path="/me/performance"
          element={
            <ParRequiresSomethingToShowRoute>
              <ParGroupPage />
            </ParRequiresSomethingToShowRoute>
          }
        >
          <Route index element={<ParGroupIndex />} />
          <Route
            path="employee-feedback"
            element={
              <ParRequiresActiveCycleRoute>
                <ParRequiresLeadRoute>
                  <Tab name="Employee Feedback" />
                </ParRequiresLeadRoute>
              </ParRequiresActiveCycleRoute>
            }
          />
          <Route
            path="request-360"
            element={
              <ParRequiresActiveCycleRoute>
                <ParRequiresLeadRoute>
                  <Tab name="Request 360" />
                </ParRequiresLeadRoute>
              </ParRequiresActiveCycleRoute>
            }
          />
          <Route
            path="provide-360"
            element={
              <ParRequiresActiveCycleRoute>
                <Tab name="Provide 360" />
              </ParRequiresActiveCycleRoute>
            }
          />
          <Route
            path="f2f"
            element={
              <ParRequiresActiveCycleRoute>
                <ParRequiresLeadRoute>
                  <Tab name="F2F" />
                </ParRequiresLeadRoute>
              </ParRequiresActiveCycleRoute>
            }
          />
          <Route path="history" element={<Tab name="History" />} />
          <Route path="cycle/*" element={<Tab name="Active cycle" />} />
          <Route path="give-feedback" element={<Tab name="Give feedback" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("an employee who has a lead", () => {
  beforeEach(() => hasLead("lead@wso2.com"));

  it("sees all five tabs", async () => {
    show();
    expect(await screen.findByRole("tab", { name: "Employee Feedback" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Request 360° Feedback" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Provide 360° Feedback" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "F2F" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "PAR History" })).toBeInTheDocument();
  });

  it("lands on Employee Feedback, so the group URL is never blank", async () => {
    show();
    expect(await screen.findByTestId("url")).toHaveTextContent(
      "/me/performance/employee-feedback",
    );
  });
});

describe("an employee with no lead", () => {
  beforeEach(() => hasLead(null));

  it("sees only Provide 360° and History", async () => {
    show();
    await screen.findByRole("tab", { name: "Provide 360° Feedback" });
    expect(screen.getByRole("tab", { name: "PAR History" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Employee Feedback" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Request 360° Feedback" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "F2F" })).not.toBeInTheDocument();
  });

  it("lands on Provide 360°, not a tab they don't have", async () => {
    show();
    expect(await screen.findByTestId("url")).toHaveTextContent("/me/performance/provide-360");
  });

  // Hiding a tab is not the gate — the URL can be typed or bookmarked.
  it("is redirected away from a tab reached by its URL", async () => {
    show("/me/performance/employee-feedback");
    expect(await screen.findByTestId("url")).toHaveTextContent("/me/performance/provide-360");
    expect(screen.getByTestId("tab-body")).toHaveTextContent("Provide 360");
  });

  it("is redirected away from Request 360° too", async () => {
    show("/me/performance/request-360");
    expect(await screen.findByTestId("url")).toHaveTextContent("/me/performance/provide-360");
  });

  it("is redirected away from F2F too", async () => {
    show("/me/performance/f2f");
    expect(await screen.findByTestId("url")).toHaveTextContent("/me/performance/provide-360");
  });

  it("still reaches the tabs they do have", async () => {
    show("/me/performance/history");
    expect(await screen.findByTestId("tab-body")).toHaveTextContent("History");
  });
});

describe("an employee with an active lead but no open PAR cycle", () => {
  beforeEach(() => {
    hasLead("lead@wso2.com");
    hasNoActiveCycle();
  });

  it("sees only the PAR History tab", async () => {
    show();
    await screen.findByRole("tab", { name: "PAR History" });
    expect(screen.getAllByRole("tab")).toHaveLength(1);
  });

  it("lands on PAR History, so the group URL is never blank", async () => {
    show();
    expect(await screen.findByTestId("url")).toHaveTextContent("/me/performance/history");
  });

  it("is redirected to PAR History when deep-linking straight to a cycle-scoped tab", async () => {
    show("/me/performance/f2f");
    expect(await screen.findByTestId("url")).toHaveTextContent("/me/performance/history");
  });
});

// Interns do not participate in PAR, full stop — confirmed directly,
// unconditionally. An earlier version of this gate only redirected an
// intern with no active cycle and no history, on the theory that par-app's
// employeeTypes config lists INTERNSHIP as cycle-eligible — but a test
// intern account with a lead and an active cycle assigned still saw the
// full tab set, which was wrong. See useParEmployeeItemVisible.
describe("an intern", () => {
  beforeEach(() => isIntern());

  it("is redirected to /me even leadless with no active cycle", async () => {
    hasLead(null);
    hasNoActiveCycle();
    show();
    // Exact match, not a substring: "/me" is itself a prefix of
    // "/me/performance", so a substring check here would also pass if the
    // redirect never fired at all.
    expect(await screen.findByTestId("url")).toHaveTextContent(/^\/me$/);
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("is redirected to /me even with a lead and an active cycle assigned", async () => {
    hasLead("lead@wso2.com");
    hasActiveCycle();
    show();
    expect(await screen.findByTestId("url")).toHaveTextContent(/^\/me$/);
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("still reaches the group directly by URL — the redirect is not fooled by a deep link", async () => {
    hasLead("lead@wso2.com");
    hasActiveCycle();
    show("/me/performance/history");
    expect(await screen.findByTestId("url")).toHaveTextContent(/^\/me$/);
  });

  it("is not shown tabs while identity resolution is still pending, even though isLoading is already false", async () => {
    hasLead("lead@wso2.com");
    hasActiveCycle();
    profile.isPending = true;
    show();
    expect(await screen.findByTestId("url")).toHaveTextContent("/me/performance");
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
});

// Deliberate: a slow or failed lookup must not hide tabs from someone who does
// have a lead. Access is enforced server-side, not by which tabs render.
describe("before the lookup has answered", () => {
  it("shows every tab rather than the leadless set", async () => {
    employeeInfo.isSuccess = false;
    show();
    expect(await screen.findByRole("tab", { name: "Employee Feedback" })).toBeInTheDocument();
  });

  it("serves a deep-linked gated tab rather than redirecting", async () => {
    employeeInfo.isSuccess = false;
    show("/me/performance/employee-feedback");
    expect(await screen.findByTestId("tab-body")).toHaveTextContent("Employee Feedback");
  });

  it("sends nobody anywhere while the signed-in email is still loading", async () => {
    profile.isLoading = true;
    show();
    expect(await screen.findByTestId("url")).toHaveTextContent("/me/performance");
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
});

describe("a PAR 2.0 cycle", () => {
  function withPar2(run: () => Promise<void>) {
    return async () => {
      const saved = window.config;
      window.config = {
        ...(saved ?? {}),
        ONE_WSO2_PREVIEW_FEATURES: { par2: true, leadership360: true },
      } as Window["config"];
      try {
        hasActiveCycle();
        cycleForms.isSuccess = true;
        cycleForms.data = ["SELF_REVIEW", "PEER_360"];
        await run();
      } finally {
        window.config = saved;
      }
    };
  }

  it(
    "has three tabs and opens on the self-review",
    withPar2(async () => {
      hasLead("lead@wso2.com");
      show();
      expect(await screen.findByRole("tab", { name: "Active cycle" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Give feedback" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "History" })).toBeInTheDocument();
      expect(screen.getAllByRole("tab")).toHaveLength(3);
      expect(await screen.findByTestId("url")).toHaveTextContent("/me/performance/cycle/self-review");
    }),
  );

  it(
    "without a lead, has Give feedback and History and opens on Give feedback",
    withPar2(async () => {
      hasLead(null);
      show();
      expect(await screen.findByRole("tab", { name: "Give feedback" })).toBeInTheDocument();
      expect(screen.queryByRole("tab", { name: "Active cycle" })).not.toBeInTheDocument();
      expect(screen.getAllByRole("tab")).toHaveLength(2);
      expect(await screen.findByTestId("url")).toHaveTextContent("/me/performance/give-feedback");
    }),
  );

  it(
    "keeps today's tabs for a cycle without the PAR 2.0 forms",
    withPar2(async () => {
      hasLead("lead@wso2.com");
      cycleForms.data = ["SELF_REVIEW"];
      show();
      expect(await screen.findByRole("tab", { name: "Request 360° Feedback" })).toBeInTheDocument();
      expect(screen.queryByRole("tab", { name: "Active cycle" })).not.toBeInTheDocument();
    }),
  );
});
