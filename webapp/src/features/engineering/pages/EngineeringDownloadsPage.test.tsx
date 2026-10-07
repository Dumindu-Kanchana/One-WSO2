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
import type { ReactElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { downloadStatsPaths } from "@constants/downloadStatsApps";
import EngineeringDownloadsPage from "./EngineeringDownloadsPage";
import EngineeringOverviewPage from "./EngineeringOverviewPage";

vi.mock("recharts", async () => {
  const React = await import("react");
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) =>
      React.createElement(actual.ResponsiveContainer, { width: 640, height: 280, children }),
  };
});

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
  vi.useRealTimers();
});

function renderDownloads(path: string = downloadStatsPaths.downloads) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Where />
        <Routes>
          <Route path={downloadStatsPaths.downloads} element={<EngineeringDownloadsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// The preview, not-connected and https rungs are the shell's —
// DownloadStatsShell.test.tsx walks them, and the Overview suite keeps two on
// a real screen.
describe("Downloads", () => {
  it("opens on the last 30 days and lists the API's daily release downloads", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T12:00:00.000Z"));
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_PREVIEW_FEATURES: { engineering: true },
      ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL: "https://stats.example",
    } as Window["config"];

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/api/v1/repositories")) {
        return json({
          repositories: [
            { id: 1, repoName: "product-apim", productName: "API Manager", isActive: true },
            { id: 2, repoName: "old", productName: "Retired", isActive: false },
          ],
        });
      }
      if (url.includes("/api/v1/stats/daily")) {
        return json({
          series: [
            {
              repoId: 1,
              repoName: "product-apim",
              points: [{ date: "2026-09-28", value: 40 }],
            },
          ],
        });
      }
      return json({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderDownloads();

    expect(await screen.findByRole("heading", { name: "Downloads" })).toBeInTheDocument();
    expect((await screen.findAllByText("API Manager")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("40").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2026-09-28").length).toBeGreaterThan(0);
    expect(screen.queryByText("Retired")).not.toBeInTheDocument();

    const dailyCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/stats/daily"));
    const requested = new URL(String(dailyCall?.[0]));
    expect(requested.searchParams.get("interval")).toBe("day");
    const from = requested.searchParams.get("from") ?? "";
    const to = requested.searchParams.get("to") ?? "";
    expect(from).toBe("2026-08-31");
    expect(to).toBe("2026-09-30");
  });

  it("keeps a changed date range in the address", async () => {
    window.config = configured();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/repositories")) return json({ repositories: [] });
        return json({ series: [] });
      }),
    );
    renderDownloads();
    const displayedTo = (screen.getByLabelText("To") as HTMLInputElement).value;
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-01-01" } });
    const where = await screen.findByTestId("where");
    expect(where).toHaveTextContent("from=2026-01-01");
    expect(where).toHaveTextContent(`to=${displayedTo}`);
  });

  it("keeps the current date when the field is cleared", async () => {
    window.config = configured();
    vi.stubGlobal("fetch", vi.fn(async () => json({ series: [], repositories: [] })));
    renderDownloads(`${downloadStatsPaths.downloads}?from=2026-01-01&to=2026-01-15`);
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "" } });
    expect(screen.getByTestId("where")).toHaveTextContent("from=2026-01-01");
    expect((screen.getByLabelText("From") as HTMLInputElement).value).toBe("2026-01-01");
  });

  it("does not request downloads when From is after To", async () => {
    window.config = configured();
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("/stats/") ? json({ message: "no" }, 500) : json({ repositories: [] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderDownloads(`${downloadStatsPaths.downloads}?from=2026-09-10&to=2026-09-01`);
    expect(await screen.findByText("From is after To.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/stats/"))).toBe(false);
  });

  it("limits the request to the products in the address", async () => {
    window.config = configured();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/repositories")) {
        return json({
          repositories: [{ id: 1, repoName: "product-apim", productName: "API Manager", isActive: true }],
        });
      }
      return json({ series: [] });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderDownloads(`${downloadStatsPaths.downloads}?repos=1`);
    expect(await screen.findByText("No data for the selected range")).toBeInTheDocument();
    const dailyCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/stats/daily"));
    expect(new URL(String(dailyCall?.[0])).searchParams.get("repos")).toBe("1");
  });

  it("asks for monthly bars when the address says month", async () => {
    window.config = configured();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/repositories")) return json({ repositories: [] });
      if (url.includes("/stats/daily")) {
        return json({
          series: [{ repoId: 1, repoName: "product-apim", points: [{ date: "2026-09", value: 12 }] }],
        });
      }
      return json({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderDownloads(`${downloadStatsPaths.downloads}?interval=month`);
    expect((await screen.findAllByText("12")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("group", { name: "Chart type" })).not.toBeInTheDocument();
    const dailyCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/stats/daily"));
    expect(new URL(String(dailyCall?.[0])).searchParams.get("interval")).toBe("month");
  });

  it("reads a running total from the cumulative endpoint", async () => {
    window.config = configured();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/repositories")) return json({ repositories: [] });
      if (url.includes("/stats/total")) {
        return json({
          series: [{ repoId: 1, repoName: "product-apim", points: [{ date: "2026-09-28", value: 900 }] }],
        });
      }
      return json({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderDownloads(`${downloadStatsPaths.downloads}?interval=cumulative`);
    expect(await screen.findByText("900")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/stats/total"))).toBe(true);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/stats/daily"))).toBe(false);
  });

  it("says there is no data when the range is empty", async () => {
    window.config = configured();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/repositories")) return json({ repositories: [] });
        return json({ series: [] });
      }),
    );
    renderDownloads();
    expect(await screen.findByText("No data for the selected range")).toBeInTheDocument();
  });

  it("shows an error the person can retry", async () => {
    window.config = configured();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/repositories")) return json({ repositories: [] });
      return json({ message: "no" }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderDownloads();
    expect(await screen.findByText(/couldn't load release downloads/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(fetchMock.mock.calls.filter((call) => String(call[0]).includes("/stats/daily")).length).toBeGreaterThan(1);
  });

  it("opens Downloads from the Overview headlines", async () => {
    window.config = configured();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/stats/summary")) {
          return json({
            trackedRepositories: 1,
            totalDownloads: 900,
            totalClonesLast14d: 1,
            todayDownloads: 5,
            todayDeltaPct: 1,
            asOfDate: "2026-09-28",
            monthDownloads: 8,
            topProducts: [],
          });
        }
        if (url.includes("/repositories")) return json({ repositories: [] });
        return json({ series: [] });
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[downloadStatsPaths.overview]}>
          <Where />
          <Routes>
            <Route path={downloadStatsPaths.overview} element={<EngineeringOverviewPage />} />
            <Route path={downloadStatsPaths.downloads} element={<EngineeringDownloadsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("link", { name: /this month's downloads/i })).toHaveAttribute(
      "href",
      "/engineering/download-stats/downloads?interval=month&from=2026-09-01&to=2026-09-28",
    );
    expect(screen.getByRole("link", { name: /total downloads/i })).toHaveAttribute(
      "href",
      "/engineering/download-stats/downloads?interval=cumulative",
    );
    await userEvent.click(await screen.findByRole("link", { name: /yesterday's downloads/i }));
    expect(await screen.findByTestId("where")).toHaveTextContent(
      "/engineering/download-stats/downloads?interval=day&from=2026-09-28&to=2026-09-28",
    );
    expect(await screen.findByRole("heading", { name: "Downloads" })).toBeInTheDocument();
  });
});

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}

function configured(): Window["config"] {
  return {
    ...(window.config ?? {}),
    ONE_WSO2_PREVIEW_FEATURES: { engineering: true },
    ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL: "https://stats.example",
  } as Window["config"];
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
