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
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { downloadStatsPaths, type DownloadStatsScreen } from "@constants/downloadStatsApps";
import DownloadStatsShell from "./DownloadStatsShell";

// The ladder every Download Stats screen stands behind, rendered on its route
// with the HTTP boundary mocked. The screen itself is a probe: on every rung
// but the last it must be absent, which is also how we know it asked for
// nothing.

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

function configure(overrides: Partial<NonNullable<Window["config"]>> = {}) {
  window.config = {
    ...(window.config ?? {}),
    ONE_WSO2_PREVIEW_FEATURES: { engineering: true },
    ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL: "https://stats.example",
    ...overrides,
  } as Window["config"];
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function userInfo(answer: () => Promise<Response>) {
  return vi.fn(async (url: string) => (url.includes("/user-info") ? answer() : json({}, 404)));
}

function show(screenKey: DownloadStatsScreen, actions?: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[downloadStatsPaths[screenKey]]}>
        <Routes>
          <Route
            path={downloadStatsPaths[screenKey]}
            element={
              <DownloadStatsShell screen={screenKey} actions={actions}>
                <div>the real screen</div>
              </DownloadStatsShell>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const theScreen = () => screen.queryByText("the real screen");
const denial = () => screen.queryByText(/don't have access to admin/i);
const ADMIN_DESCRIPTION = "Manage tracked repositories and review DB sync and scraper job history.";

describe("a screen anyone may open", () => {
  it("renders, with its title and the standalone's description above it", () => {
    configure();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    show("overview");
    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(
      screen.getByText("Download activity and repository stats across all WSO2 products."),
    ).toBeInTheDocument();
    expect(theScreen()).toBeInTheDocument();
    // Only Admin is the API's to decide, so nobody else is asked about.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each<[DownloadStatsScreen, string, string]>([
    ["overview", "Overview", "Download activity and repository stats across all WSO2 products."],
    [
      "downloads",
      "Downloads",
      "Daily, monthly, and cumulative download trends across tracked products and date ranges.",
    ],
    [
      "versions",
      "Versions",
      "Per-release download breakdown and asset-level stats for each tracked product.",
    ],
    [
      "packages",
      "Packages",
      "GitHub container package downloads per product — package totals and per-version breakdowns.",
    ],
    [
      "repositoryStats",
      "Repository Stats",
      "Stars, forks, watchers, open issues, and clone traffic over time for each tracked repository.",
    ],
  ])("opens %s titled %s with the standalone's sentence beneath", (key, title, description) => {
    configure();
    vi.stubGlobal("fetch", vi.fn());
    show(key);
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();
    expect(theScreen()).toBeInTheDocument();
  });

  it("allows an http address on localhost", () => {
    configure({ ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL: "http://localhost:8080" });
    show("downloads");
    expect(theScreen()).toBeInTheDocument();
  });
});

describe("the ladder in front of every screen", () => {
  it("says Engineering is not available while the preview flag is off, and nothing else", () => {
    configure({ ONE_WSO2_PREVIEW_FEATURES: {} });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    show("overview");
    expect(screen.getByText("Engineering isn't available yet.")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(theScreen()).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("names the missing setting when the API address is unset, and makes no request", () => {
    configure({ ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL: "" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    show("admin");
    expect(screen.getByText(/download stats isn't connected yet/i)).toBeInTheDocument();
    expect(screen.getByText("ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL")).toBeInTheDocument();
    // Still named and described: nobody has been refused anything.
    expect(screen.getByRole("heading", { name: "Admin" })).toBeInTheDocument();
    expect(screen.getByText(ADMIN_DESCRIPTION)).toBeInTheDocument();
    expect(denial()).not.toBeInTheDocument();
    expect(theScreen()).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses an http address that is not localhost, and sends no token to it", () => {
    configure({ ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL: "http://stats.example" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    show("admin");
    expect(screen.getByText(/needs an https address/i)).toBeInTheDocument();
    expect(screen.getByText(ADMIN_DESCRIPTION)).toBeInTheDocument();
    expect(denial()).not.toBeInTheDocument();
    expect(theScreen()).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("the Admin check", () => {
  it("shows a spinner while the API is deciding, and no denial", () => {
    configure();
    vi.stubGlobal("fetch", userInfo(() => new Promise<Response>(() => {})));
    show("admin");
    expect(screen.getByText(/checking your admin access/i)).toBeInTheDocument();
    expect(denial()).not.toBeInTheDocument();
    expect(theScreen()).not.toBeInTheDocument();
  });

  // Before the denied rung, not after. A failed request also leaves us with no
  // answer, and reporting that as a missing permission sends someone chasing
  // a role they already hold.
  it("reports a failed check as an error with Retry, never as a denial", async () => {
    configure();
    const fetchMock = userInfo(async () => json({ message: "gateway timed out" }, 502));
    vi.stubGlobal("fetch", fetchMock);
    show("admin");
    expect(await screen.findByText(/couldn't check admin access/i)).toBeInTheDocument();
    expect(denial()).not.toBeInTheDocument();
    expect(theScreen()).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(1));
  });

  it("treats the API's 403 as the answer no, not as a failed check", async () => {
    configure();
    vi.stubGlobal("fetch", userInfo(async () => json({ message: "forbidden" }, 403)));
    show("admin");
    expect(await screen.findByText(/don't have access to admin/i)).toBeInTheDocument();
    expect(screen.queryByText(/couldn't check admin access/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("explains the refusal to someone the API says is not an Admin, and keeps the screen's actions back", async () => {
    configure();
    vi.stubGlobal("fetch", userInfo(async () => json({ email: "a@wso2.com", isAdmin: false })));
    show("admin", <button type="button">Add tracked repository</button>);
    expect(await screen.findByText(/don't have access to admin/i)).toBeInTheDocument();
    expect(screen.getByText(/ask someone who already manages that list/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Admin" })).toBeInTheDocument();
    // The description sells a screen being withheld, so it goes with the screen.
    expect(screen.queryByText(ADMIN_DESCRIPTION)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add tracked repository" })).not.toBeInTheDocument();
    expect(theScreen()).not.toBeInTheDocument();
  });

  it("renders the screen, its description and its actions for an Admin", async () => {
    configure();
    vi.stubGlobal("fetch", userInfo(async () => json({ email: "a@wso2.com", isAdmin: true })));
    show("admin", <button type="button">Add tracked repository</button>);
    expect(await screen.findByText("the real screen")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Admin" })).toBeInTheDocument();
    expect(screen.getByText(ADMIN_DESCRIPTION)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add tracked repository" })).toBeInTheDocument();
    expect(denial()).not.toBeInTheDocument();
  });
});
