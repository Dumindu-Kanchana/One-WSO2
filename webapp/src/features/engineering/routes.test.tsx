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
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, useLocation } from "react-router";
import { downloadStatsPaths } from "@constants/downloadStatsApps";
import { engineeringRoutes } from "./routes";

// Where a Download Stats address lands, on the real route table App.tsx
// mounts. Every screen here is behind the preview flag, which this file leaves
// OFF: a screen reached while the perspective is hidden says so and asks for
// nothing, so what is left to see is the address itself — which is the point.

vi.mock("@asgardeo/react", () => ({
  useAsgardeo: () => ({
    isSignedIn: true,
    isLoading: false,
    getAccessToken: async () => "test-token",
    signIn: vi.fn(),
  }),
}));

const originalConfig = window.config;

afterEach(() => {
  window.config = originalConfig;
  vi.unstubAllGlobals();
});

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}

function visit(address: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[address]}>
        <Where />
        <Routes>{engineeringRoutes}</Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const where = () => screen.getByTestId("where").textContent;

describe("the Download Stats addresses", () => {
  it("open the app's root on Overview", () => {
    visit("/engineering/download-stats");
    expect(where()).toBe(downloadStatsPaths.overview);
  });

  // An earlier address carries its filters in the query string, and a
  // redirect that dropped them would open a different view.
  it.each([
    ["/engineering/downloads", downloadStatsPaths.downloads],
    ["/engineering/versions", downloadStatsPaths.versions],
    ["/engineering/packages", downloadStatsPaths.packages],
    ["/engineering/repository-stats", downloadStatsPaths.repositoryStats],
    ["/engineering/admin", downloadStatsPaths.admin],
  ])("forwards an earlier address %s to %s, query string and all", (old, current) => {
    visit(`${old}?from=2026-01-01&interval=month&repo=4`);
    expect(where()).toBe(`${current}?from=2026-01-01&interval=month&repo=4`);
  });

  it("keep the app's root forward's query string too", () => {
    visit("/engineering/download-stats?from=2026-01-01");
    expect(where()).toBe(`${downloadStatsPaths.overview}?from=2026-01-01`);
  });

  // The route stays registered while the flag is off, as the perspective's
  // comment in perspectives.ts promises: a direct visit is answered, not left
  // to the catch-all. And it is not forwarded — the Engineering perspective
  // does not exist, so there is no first row to forward to.
  it("answer a direct visit to /engineering while Engineering is hidden, without forwarding", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    visit("/engineering");
    expect(screen.getByText("Engineering isn't available yet.")).toBeInTheDocument();
    expect(where()).toBe("/engineering");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("say the same on every screen while Engineering is hidden", () => {
    for (const path of Object.values(downloadStatsPaths)) {
      const { unmount } = visit(path);
      expect(screen.getByText("Engineering isn't available yet."), path).toBeInTheDocument();
      unmount();
    }
  });
});
