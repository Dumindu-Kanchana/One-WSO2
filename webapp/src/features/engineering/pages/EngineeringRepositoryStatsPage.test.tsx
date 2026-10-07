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
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { downloadStatsPaths } from "@constants/downloadStatsApps";
import EngineeringRepositoryStatsPage from "./EngineeringRepositoryStatsPage";

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

const STATS = downloadStatsPaths.repositoryStats;

function renderStats(path: string = STATS) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Where />
        <Routes>
          <Route path={STATS} element={<EngineeringRepositoryStatsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
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

const repositories = {
  repositories: [
    {
      id: 7,
      repoName: "product-apim",
      productName: "API Manager",
      isActive: true,
      latestSnapshot: {
        stargazersCount: 120,
        forksCount: 30,
        watchersCount: 8,
        openIssuesCount: 2,
      },
    },
    {
      id: 8,
      repoName: "product-is",
      productName: "Identity Server",
      isActive: true,
      latestSnapshot: {
        stargazersCount: 40,
        forksCount: 9,
        watchersCount: 3,
        openIssuesCount: 1,
      },
    },
    {
      id: 9,
      repoName: "product-old",
      productName: "Retired",
      isActive: false,
      latestSnapshot: {
        stargazersCount: 1,
        forksCount: 1,
        watchersCount: 1,
        openIssuesCount: 1,
      },
    },
  ],
};

const clones = {
  series: [
    {
      repoId: 7,
      repoName: "product-apim",
      points: [
        { date: "2026-09-28", count: 10, uniques: 4 },
        { date: "2026-09-29", count: 6, uniques: 2 },
      ],
    },
    {
      repoId: 8,
      repoName: "product-is",
      points: [{ date: "2026-09-28", count: 1, uniques: 1 }],
    },
  ],
};

function statsFetch(url: string): Promise<Response> {
  if (url.includes("/api/v1/repositories")) return Promise.resolve(json(repositories));
  if (url.includes("/stats/clones")) return Promise.resolve(json(clones));
  if (url.includes("/stats/metric")) {
    return Promise.resolve(
      json({
        series: [
          {
            repoId: 7,
            repoName: "product-apim",
            points: [
              { date: "2026-09-01", value: 5 },
              { date: "2026-09-28", value: 3 },
            ],
          },
        ],
      }),
    );
  }
  return Promise.resolve(json({}, 404));
}

// The preview, not-connected and https rungs are the shell's —
// DownloadStatsShell.test.tsx walks them, and the Overview suite keeps two on
// a real screen.
describe("Repository Stats", () => {
  it("keeps the measure in the address, explains unique cloners, and searches the table", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T12:00:00.000Z"));
    window.config = configured();
    const fetchMock = vi.fn(statsFetch);
    vi.stubGlobal("fetch", fetchMock);

    renderStats();

    expect(await screen.findByRole("heading", { name: "Repository Stats" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Unique cloners are summed per day and the same person on different days counts separately.",
      ),
    ).toBeInTheDocument();
    expect(await screen.findByRole("cell", { name: "API Manager" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Identity Server" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "Retired" })).not.toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "120" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "16" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "6" })).toBeInTheDocument();

    const clonesCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/stats/clones"));
    const clonesUrl = new URL(String(clonesCall?.[0]));
    expect(clonesUrl.searchParams.get("from")).toBe("2026-08-31");
    expect(clonesUrl.searchParams.get("to")).toBe("2026-09-30");

    await userEvent.click(screen.getByRole("combobox", { name: "Measure" }));
    await userEvent.click(await screen.findByRole("option", { name: "Forks" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("stat=forks"));
    expect(screen.getByTestId("where")).toHaveTextContent("from=2026-08-31");
    expect(screen.getByTestId("where")).toHaveTextContent("to=2026-09-30");
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) => String(call[0]).includes("metric=forks")),
      ).toBe(true),
    );

    await userEvent.type(screen.getByRole("textbox", { name: "Search products" }), "Identity");
    expect(screen.queryByRole("cell", { name: "API Manager" })).not.toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Identity Server" })).toBeInTheDocument();
  });

  it("keeps the search field when nothing matches", async () => {
    window.config = configured();
    vi.stubGlobal("fetch", vi.fn(statsFetch));
    renderStats();

    const search = await screen.findByRole("textbox", { name: "Search products" });
    await userEvent.type(search, "no-such-product");
    expect(screen.getByText("No products match your search")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Search products" })).toBeInTheDocument();
    await userEvent.clear(screen.getByRole("textbox", { name: "Search products" }));
    expect(await screen.findByRole("cell", { name: "API Manager" })).toBeInTheDocument();
  });

  it("dashes clone columns when clone history fails", async () => {
    window.config = configured();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/repositories")) return json(repositories);
        if (url.includes("/stats/clones")) return json({ message: "clones unavailable" }, 500);
        return json({ series: [] });
      }),
    );
    renderStats(`${STATS}?stat=uniqueCloners`);
    expect(await screen.findByText(/clones unavailable/i)).toBeInTheDocument();
    expect(await screen.findByRole("cell", { name: "API Manager" })).toBeInTheDocument();
    expect(screen.getAllByRole("cell", { name: "—" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("cell", { name: "0" })).not.toBeInTheDocument();
  });

  it("drops a daily query error when the table returns to Total", async () => {
    window.config = configured();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/repositories")) return json(repositories);
        if (url.includes("/stats/clones")) return json(clones);
        if (url.includes("metric=forks")) return json({ message: "forks unavailable" }, 500);
        return json({
          series: [{ repoId: 7, repoName: "product-apim", points: [{ date: "2026-09-28", value: 3 }] }],
        });
      }),
    );
    renderStats();
    expect(await screen.findByRole("cell", { name: "120" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Daily" }));
    expect(await screen.findByText(/forks unavailable/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Total" }));
    expect(screen.queryByText(/forks unavailable/i)).not.toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "120" })).toBeInTheDocument();
  });

  it("reads a month as the sum of that month's daily changes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T12:00:00.000Z"));
    window.config = configured();
    vi.stubGlobal("fetch", vi.fn(statsFetch));
    renderStats();

    expect(await screen.findByRole("cell", { name: "120" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Monthly" }));
    expect(await screen.findByRole("heading", { name: "Change in 2026-09" })).toBeInTheDocument();
    expect(screen.getAllByRole("cell", { name: "8" })).toHaveLength(4);
    expect(screen.queryByRole("cell", { name: "120" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Daily" }));
    expect(await screen.findByRole("heading", { name: "Change on 2026-09-29" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "0" })).not.toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "120" })).not.toBeInTheDocument();
    const day = screen.getByLabelText("Day") as HTMLInputElement;
    expect(day.value).toBe("2026-09-29");
    expect(day.min).toBe("2026-08-31");
    expect(day.max).toBe("2026-09-30");

    fireEvent.change(day, { target: { value: "" } });
    expect(screen.queryByRole("cell", { name: "120" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("cell", { name: "—" }).length).toBeGreaterThan(0);
  });

  it("keeps the grain in the address and asks the metric series for it", async () => {
    window.config = configured();
    const fetchMock = vi.fn(statsFetch);
    vi.stubGlobal("fetch", fetchMock);
    renderStats(`${STATS}?interval=month`);

    expect(await screen.findByRole("cell", { name: "120" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Chart type" })).not.toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("interval=month");
    const monthCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("interval=month"));
    expect(monthCall).toBeTruthy();
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("interval=day"))).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: "Monthly" }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("interval=day"))).toBe(true),
    );
  });

  it("limits the table and the request to the products in the address", async () => {
    window.config = configured();
    const fetchMock = vi.fn(statsFetch);
    vi.stubGlobal("fetch", fetchMock);
    renderStats(`${STATS}?repos=7`);

    expect(await screen.findByRole("cell", { name: "API Manager" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "Identity Server" })).not.toBeInTheDocument();
    const metricCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/stats/metric"));
    expect(new URL(String(metricCall?.[0])).searchParams.get("repos")).toBe("7");
  });

  it("plots unique cloners from clone history without asking for a cloner metric", async () => {
    window.config = configured();
    const fetchMock = vi.fn(statsFetch);
    vi.stubGlobal("fetch", fetchMock);
    renderStats(`${STATS}?stat=uniqueCloners&interval=cumulative`);

    expect(await screen.findByRole("cell", { name: "6" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Unique cloners are summed per day and the same person on different days counts separately.",
      ),
    ).toBeInTheDocument();
    const clonesCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/stats/clones"));
    expect(new URL(String(clonesCall?.[0])).searchParams.get("interval")).toBeNull();
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("metric=uniqueCloners"))).toBe(false);
    expect(screen.getByRole("group", { name: "Chart type" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Bars" }));
    expect(screen.getByTestId("where")).not.toHaveTextContent("chart=");
  });

  it("plots only the dates the API returned", async () => {
    window.config = configured();
    vi.stubGlobal("fetch", vi.fn(statsFetch));
    renderStats(`${STATS}?from=2026-08-31&to=2026-09-30`);
    expect(await screen.findByText("2026-09-28")).toBeInTheDocument();
    expect(screen.queryByText("2026-08-31")).not.toBeInTheDocument();
  });

  it("does not request stats when From is after To", async () => {
    window.config = configured();
    const fetchMock = vi.fn(statsFetch);
    vi.stubGlobal("fetch", fetchMock);
    renderStats(`${STATS}?from=2026-09-10&to=2026-09-01`);
    expect(await screen.findByText("From is after To.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/stats/"))).toBe(false);
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
    renderStats();
    expect(await screen.findByText("No data for the selected range")).toBeInTheDocument();
  });

  it("names a failed table query when the chart request succeeded", async () => {
    window.config = configured();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/repositories")) return json({ repositories: [] });
        if (url.includes("metric=forks")) return json({ message: "forks unavailable" }, 500);
        return json({ series: [] });
      }),
    );
    renderStats(`${STATS}?interval=month`);
    await userEvent.click(await screen.findByRole("button", { name: "Monthly" }));
    expect(await screen.findByText(/forks unavailable/i)).toBeInTheDocument();
    expect(screen.getByText("No data for the selected range")).toBeInTheDocument();
  });

  it("shows an error the person can retry", async () => {
    window.config = configured();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/repositories")) return json({ repositories: [] });
      return json({ message: "no" }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderStats();
    expect(await screen.findByText(/couldn't load repository stats/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(fetchMock.mock.calls.filter((call) => String(call[0]).includes("/stats/")).length).toBeGreaterThan(1);
  });
});

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}
