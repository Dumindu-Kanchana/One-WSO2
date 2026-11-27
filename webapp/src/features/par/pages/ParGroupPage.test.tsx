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

let par2: { showsPar2: boolean; isLoading: boolean; error: Error | null };
let lead: { hasLead: boolean; isLoading: boolean };

vi.mock("@features/my/api/useMeProfile", () => ({
  useMeProfile: () => ({ data: { userInfo: { workEmail: "me@example.com" } }, isLoading: false }),
}));
vi.mock("../api/useParData", () => ({
  useActiveParCycle: () => ({ data: [{ parCycleId: 2 }], isLoading: false }),
  useParEmployeeItemVisible: vi.fn(),
  useParHasActiveCycle: vi.fn(),
  useParHasLead: () => lead,
}));
vi.mock("../api/useReview360", () => ({ useParShowsPar2: () => par2 }));

const { ParOpensPar2PageRoute, ParRequiresLeadRoute, ParRequiresPar2CycleRoute } = await import("./ParGroupPage");

const SELF_REVIEW = "/me/performance/cycle/self-review";

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

const show = () =>
  render(
    <MemoryRouter initialEntries={[SELF_REVIEW]}>
      <Where />
      <Routes>
        <Route path="/me/performance" element={<div>First tab</div>} />
        <Route
          path={SELF_REVIEW}
          element={
            <ParRequiresPar2CycleRoute>
              <div>Self-review</div>
            </ParRequiresPar2CycleRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  par2 = { showsPar2: true, isLoading: false, error: null };
  lead = { hasLead: true, isLoading: false };
});

describe("ParRequiresPar2CycleRoute", () => {
  it("opens Active cycle in a cycle with the PAR 2.0 forms", () => {
    show();
    expect(screen.getByText("Self-review")).toBeInTheDocument();
  });

  it("opens the first tab instead, by URL, in any other cycle", () => {
    par2 = { ...par2, showsPar2: false };
    show();
    expect(screen.getByText("First tab")).toBeInTheDocument();
    expect(screen.queryByText("Self-review")).not.toBeInTheDocument();
  });

  it("shows nothing while that's looked up, or when it couldn't be, and keeps the link", () => {
    par2 = { showsPar2: false, isLoading: true, error: null };
    const { unmount } = show();
    expect(screen.queryByText("Self-review")).not.toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent(SELF_REVIEW);
    unmount();
    par2 = { showsPar2: false, isLoading: false, error: new Error("HTTP 500") };
    show();
    expect(screen.queryByText("Self-review")).not.toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent(SELF_REVIEW);
  });
});

describe("ParRequiresLeadRoute", () => {
  const showLeadOnly = (fallback?: string) =>
    render(
      <MemoryRouter initialEntries={[SELF_REVIEW]}>
        <Where />
        <Routes>
          <Route path="/me/performance/*" element={null} />
          <Route
            path={SELF_REVIEW}
            element={
              <ParRequiresLeadRoute fallback={fallback}>
                <div>Self-review</div>
              </ParRequiresLeadRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

  it("sends a leadless employee to Provide 360°, or to the fallback given", () => {
    lead = { hasLead: false, isLoading: false };
    const { unmount } = showLeadOnly();
    expect(screen.getByTestId("where")).toHaveTextContent("/me/performance/provide-360");
    unmount();
    showLeadOnly("/me/performance/give-feedback");
    expect(screen.getByTestId("where")).toHaveTextContent("/me/performance/give-feedback");
  });
});

describe("ParOpensPar2PageRoute", () => {
  const originalConfig = window.config;
  const setPar2 = (on: boolean) => {
    window.config = { ...(originalConfig ?? {}), ONE_WSO2_PREVIEW_FEATURES: { par2: on } } as Window["config"];
  };
  const showOld = () =>
    render(
      <MemoryRouter initialEntries={["/me/performance/provide-360"]}>
        <Where />
        <Routes>
          <Route path="/me/performance/give-feedback" element={<div>Provide Feedback</div>} />
          <Route
            path="/me/performance/provide-360"
            element={
              <ParOpensPar2PageRoute to="/me/performance/give-feedback">
                <div>Provide 360° Feedback (PAR 1.0)</div>
              </ParOpensPar2PageRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

  it("opens the PAR 2.0 page from a PAR 1.0 address in a PAR 2.0 cycle, with par2 on", () => {
    setPar2(true);
    try {
      showOld();
      expect(screen.getByTestId("where")).toHaveTextContent("/me/performance/give-feedback");
      expect(screen.queryByText("Provide 360° Feedback (PAR 1.0)")).not.toBeInTheDocument();
    } finally {
      window.config = originalConfig;
    }
  });

  it("keeps the PAR 1.0 page in a PAR 1.0 cycle, or with par2 off", () => {
    setPar2(true);
    par2 = { ...par2, showsPar2: false };
    try {
      showOld();
      expect(screen.getByText("Provide 360° Feedback (PAR 1.0)")).toBeInTheDocument();
    } finally {
      window.config = originalConfig;
    }
    setPar2(false);
    par2 = { ...par2, showsPar2: true };
    try {
      const view = showOld();
      expect(view.getAllByText("Provide 360° Feedback (PAR 1.0)").length).toBeGreaterThan(0);
    } finally {
      window.config = originalConfig;
    }
  });
});
