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
import type { ReactElement } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { downloadStatsPaths } from "@constants/downloadStatsApps";
import EngineeringRepositoryStatsPage from "./EngineeringRepositoryStatsPage";

// jsdom lays nothing out, so the chart's percentage-sized container would
// measure 0×0 and draw nothing. The chart is the kit's SeriesChart on the
// Oxygen charts wrapper, which carries its own nested recharts, so the
// wrapper's container is the one to give a size (see SeriesChart.test.tsx).
vi.mock("@wso2/oxygen-ui-charts-react", async () => {
  const React = await import("react");
  const actual = await vi.importActual<typeof import("@wso2/oxygen-ui-charts-react")>(
    "@wso2/oxygen-ui-charts-react",
  );
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

// The wrapper's recharts calls `new ResizeObserver` unguarded; jsdom has none.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const originalConfig = window.config;

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

afterEach(() => {
  window.config = originalConfig;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const statsPath = downloadStatsPaths.repositoryStats;

function renderStats(path: string = statsPath) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Where />
        <Routes>
          <Route path={statsPath} element={<EngineeringRepositoryStatsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}

function connected(): void {
  window.config = {
    ...(window.config ?? {}),
    ONE_WSO2_PREVIEW_FEATURES: { engineering: true },
    ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL: "https://stats.example",
  } as Window["config"];
}

// Two active Products with their latest GitHub counts, and a retired one that
// is never listed.
const repositoriesBody = {
  repositories: [
    {
      id: 7,
      repoName: "product-apim",
      productName: "API Manager",
      isActive: true,
      latestSnapshot: { stargazersCount: 120, forksCount: 30, watchersCount: 8, openIssuesCount: 2 },
    },
    {
      id: 8,
      repoName: "product-is",
      productName: "Identity Server",
      isActive: true,
      latestSnapshot: { stargazersCount: 40, forksCount: 9, watchersCount: 3, openIssuesCount: 1 },
    },
    {
      id: 9,
      repoName: "product-old",
      productName: "Retired",
      isActive: false,
      latestSnapshot: { stargazersCount: 1, forksCount: 1, watchersCount: 1, openIssuesCount: 1 },
    },
  ],
};

// Clone history over two September days. API Manager: 16 clones by 6 cloners
// in all, 10 by 4 on the 28th. Identity Server: one clone by one cloner, on
// the 28th. Nothing on the 30th, the range's last day.
const clonesBody = {
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
      points: [
        { date: "2026-09-28", count: 1, uniques: 1 },
        { date: "2026-09-29", count: 0, uniques: 0 },
      ],
    },
  ],
};

// API Manager's daily changes in September, per Stat. On the 28th: 3 stars,
// 1 fork, 1 watcher and one issue closed (-1). Identity Server has no series,
// so its day and month cells read 0.
const DAILY_CHANGES: Record<string, Array<{ date: string; value: number }>> = {
  stars: [
    { date: "2026-09-01", value: 5 },
    { date: "2026-09-28", value: 3 },
  ],
  forks: [
    { date: "2026-09-01", value: 2 },
    { date: "2026-09-28", value: 1 },
  ],
  watchers: [{ date: "2026-09-28", value: 1 }],
  openIssues: [
    { date: "2026-09-01", value: 1 },
    { date: "2026-09-28", value: -1 },
  ],
};

// The API's own month figures for the same changes: 8 stars, 3 forks, 1
// watcher, and 0 open issues (one opened, one closed).
const SEPTEMBER_CHANGES: Record<string, number> = { stars: 8, forks: 3, watchers: 1, openIssues: 0 };

// The metric endpoint's answer: API Manager's changes for the asked Stat at
// the asked Interval.
function metricSeriesFor(url: URL): Response {
  const metric = url.searchParams.get("metric") ?? "stars";
  const points =
    url.searchParams.get("interval") === "month"
      ? [{ date: "2026-09", value: SEPTEMBER_CHANGES[metric] ?? 0 }]
      : (DAILY_CHANGES[metric] ?? []);
  return json({ series: [{ repoId: 7, repoName: "product-apim", points }] });
}

// Twelve Products with distinct star counts, so the table has a second page
// and a definite order.
const twelveProducts = {
  repositories: Array.from({ length: 12 }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return {
      id: 100 + i + 1,
      repoName: `product-${n}`,
      productName: `Product ${n}`,
      isActive: true,
      latestSnapshot: { stargazersCount: (i + 1) * 10, forksCount: 0, watchersCount: 0, openIssuesCount: 0 },
    };
  }),
};

type Answer = (url: URL) => Response | Promise<Response>;
type Answers = { repositories?: Answer; clones?: Answer; metric?: Answer };

/** The requests the screen makes: the Products, the clone history, and a Stat's series. */
function stubApi(answers: Answers = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    const parsed = new URL(url);
    if (url.startsWith("https://stats.example/api/v1/repositories")) {
      return (answers.repositories ?? (() => json(repositoriesBody)))(parsed);
    }
    if (url.startsWith("https://stats.example/api/v1/stats/clones")) {
      return (answers.clones ?? (() => json(clonesBody)))(parsed);
    }
    if (url.startsWith("https://stats.example/api/v1/stats/metric")) {
      return (answers.metric ?? metricSeriesFor)(parsed);
    }
    return json({}, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const pending = () => new Promise<Response>(() => {});

function requestsTo(fetchMock: ReturnType<typeof stubApi>, path: string): URL[] {
  return fetchMock.mock.calls
    .map((call) => String(call[0]))
    .filter((url) => url.includes(path))
    .map((url) => new URL(url));
}

/** The Stats asked of the metric endpoint at one Interval, in alphabetical order. */
function measuresAskedAt(fetchMock: ReturnType<typeof stubApi>, interval: string): string[] {
  return requestsTo(fetchMock, "/stats/metric")
    .filter((url) => url.searchParams.get("interval") === interval)
    .map((url) => url.searchParams.get("metric") ?? "")
    .sort();
}

const septemberRange = `${statsPath}?from=2026-08-31&to=2026-09-30`;

/** The card a title heads, as the reader sees it; the cards' titles are h3s, the screen's is the h5. */
function card(title: string): HTMLElement {
  const found = screen.getByRole("heading", { name: title, level: 3 }).closest(".MuiCard-root");
  if (!found) throw new Error(`No card titled ${title}`);
  return found as HTMLElement;
}

function headersOf(table: HTMLElement): string[] {
  return within(table)
    .getAllByRole("columnheader")
    .map((header) => header.textContent ?? "");
}

/** The body rows' cells, as the reader sees them. */
function rowsOf(table: HTMLElement): string[][] {
  return Array.from(table.querySelectorAll("tbody tr")).map((row) =>
    Array.from(row.querySelectorAll("td")).map((cell) => cell.textContent ?? ""),
  );
}

/** The names the chart's legend lists, in alphabetical order (the legend's own order is the chart wrapper's). */
function legendOf(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll(".recharts-legend-item-text"))
    .map((item) => item.textContent ?? "")
    .sort();
}

async function choose(user: ReturnType<typeof userEvent.setup>, select: string, option: string): Promise<void> {
  await user.click(screen.getByRole("combobox", { name: select }));
  await user.click(await screen.findByRole("option", { name: option }));
}

const TOTAL_ROWS = [
  ["API Manager", "120", "30", "8", "2", "16", "6"],
  ["Identity Server", "40", "9", "3", "1", "1", "1"],
];

// The preview, not-connected and https rungs are the shell's —
// DownloadStatsShell.test.tsx walks them, and the Overview suite keeps two on
// a real screen.
describe("Repository Stats filter bar", () => {
  it("shows the product picker beside a Filters button that folds From, To, Stat and Interval away", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    renderStats(septemberRange);

    expect(await screen.findByRole("heading", { name: "Repository Stats" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Repositories" })).toHaveAttribute(
      "placeholder",
      "All repositories",
    );
    expect(screen.getByLabelText("From")).toHaveValue("2026-08-31");
    expect(screen.getByLabelText("To")).toHaveValue("2026-09-30");
    expect(screen.getByRole("combobox", { name: "Stat" })).toHaveTextContent("Stars");
    expect(screen.getByRole("combobox", { name: "Interval" })).toHaveTextContent("Daily");

    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.queryByLabelText("From")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("To")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Stat" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Interval" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Repositories" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByLabelText("From")).toHaveValue("2026-08-31");
    expect(screen.getByRole("combobox", { name: "Stat" })).toHaveTextContent("Stars");
  });

  it("offers the six Stats and the three Intervals", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    renderStats(septemberRange);

    await user.click(await screen.findByRole("combobox", { name: "Stat" }));
    expect(
      within(await screen.findByRole("listbox"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Stars", "Forks", "Watchers", "Open Issues", "Total Clones", "Unique Cloners"]);
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("combobox", { name: "Interval" }));
    expect(
      within(await screen.findByRole("listbox"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Daily", "Monthly", "Cumulative"]);
  });

  it("opens on the last 30 days, Stars and Daily, asks the Stars series and the clone history so, and lists the active Products", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T12:00:00.000Z"));
    connected();
    const fetchMock = stubApi();

    renderStats();

    expect(await screen.findByRole("heading", { name: "Repository Stats" })).toBeInTheDocument();
    expect(screen.getByLabelText("From")).toHaveValue("2026-08-31");
    expect(screen.getByLabelText("To")).toHaveValue("2026-09-30");
    expect(screen.getByRole("combobox", { name: "Stat" })).toHaveTextContent("Stars");
    expect(screen.getByRole("combobox", { name: "Interval" })).toHaveTextContent("Daily");

    await screen.findByRole("columnheader", { name: "Stars" });
    expect(rowsOf(card("Current stats"))).toEqual(TOTAL_ROWS);
    expect(screen.queryByText("Retired")).not.toBeInTheDocument();

    const [metric] = requestsTo(fetchMock, "/stats/metric");
    expect(metric.searchParams.get("metric")).toBe("stars");
    expect(metric.searchParams.get("interval")).toBe("day");
    expect(metric.searchParams.get("from")).toBe("2026-08-31");
    expect(metric.searchParams.get("to")).toBe("2026-09-30");
    expect(metric.searchParams.get("repos")).toBeNull();
    const [clones] = requestsTo(fetchMock, "/stats/clones");
    expect(clones.searchParams.get("from")).toBe("2026-08-31");
    expect(clones.searchParams.get("to")).toBe("2026-09-30");
    expect(clones.searchParams.get("interval")).toBeNull();
  });

  it("writes a changed Stat into the address with the default dates, and asks for that series", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T12:00:00.000Z"));
    connected();
    const fetchMock = stubApi();
    const user = userEvent.setup();

    renderStats();
    expect(await screen.findByRole("heading", { name: "Stars over time" })).toBeInTheDocument();

    await choose(user, "Stat", "Forks");

    const where = screen.getByTestId("where");
    expect(where).toHaveTextContent("stat=forks");
    expect(where).toHaveTextContent("from=2026-08-31");
    expect(where).toHaveTextContent("to=2026-09-30");
    expect(screen.getByRole("heading", { name: "Forks over time" })).toBeInTheDocument();
    await waitFor(() =>
      expect(requestsTo(fetchMock, "/stats/metric").at(-1)?.searchParams.get("metric")).toBe("forks"),
    );
  });

  it("keeps the Interval in the address and asks the series at that grain", async () => {
    connected();
    const fetchMock = stubApi();
    const user = userEvent.setup();

    renderStats(`${septemberRange}&interval=month`);

    expect(await screen.findByRole("combobox", { name: "Interval" })).toHaveTextContent("Monthly");
    await waitFor(() =>
      expect(requestsTo(fetchMock, "/stats/metric")[0]?.searchParams.get("interval")).toBe("month"),
    );

    await choose(user, "Interval", "Cumulative");

    expect(screen.getByTestId("where")).toHaveTextContent("interval=cumulative");
    await waitFor(() =>
      expect(requestsTo(fetchMock, "/stats/metric").at(-1)?.searchParams.get("interval")).toBe("cumulative"),
    );
  });

  it("narrows the table and the requests to a Product picked from the picker, and keeps it in the address", async () => {
    connected();
    const fetchMock = stubApi();
    const user = userEvent.setup();

    renderStats(septemberRange);
    await screen.findByRole("columnheader", { name: "Stars" });
    expect(rowsOf(card("Current stats"))).toHaveLength(2);

    await user.click(screen.getByRole("combobox", { name: "Repositories" }));
    await user.click(await screen.findByRole("option", { name: "Identity Server" }));

    expect(screen.getByTestId("where")).toHaveTextContent("repos=8");
    expect(screen.getByRole("button", { name: "Identity Server" })).toBeInTheDocument();
    await waitFor(() =>
      expect(requestsTo(fetchMock, "/stats/metric").at(-1)?.searchParams.get("repos")).toBe("8"),
    );
    expect(requestsTo(fetchMock, "/stats/clones").at(-1)?.searchParams.get("repos")).toBe("8");
    await waitFor(() =>
      expect(rowsOf(card("Current stats"))).toEqual([["Identity Server", "40", "9", "3", "1", "1", "1"]]),
    );
  });

  it("keeps the current date when a date field is cleared", async () => {
    connected();
    stubApi();

    renderStats(septemberRange);

    expect(await screen.findByLabelText("From")).toHaveValue("2026-08-31");
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "" } });
    expect(screen.getByTestId("where")).toHaveTextContent("from=2026-08-31");
    expect(screen.getByLabelText("From")).toHaveValue("2026-08-31");
  });

  it("says From is after To instead of the chart and the table, and asks for nothing", async () => {
    connected();
    const fetchMock = stubApi();

    renderStats(`${statsPath}?from=2026-09-10&to=2026-09-01`);

    expect(await screen.findByText("From is after To.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /over time/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Current stats" })).not.toBeInTheDocument();
    expect(requestsTo(fetchMock, "/stats/")).toHaveLength(0);
  });
});

describe("Repository Stats chart card", () => {
  it.each([
    ["stars", "Stars"],
    ["forks", "Forks"],
    ["watchers", "Watchers"],
    ["openIssues", "Open Issues"],
    ["clones", "Total Clones"],
    ["uniqueCloners", "Unique Cloners"],
  ])("is titled by the %s Stat with its subtitle", async (stat, label) => {
    connected();
    stubApi();

    renderStats(`${septemberRange}&stat=${stat}`);

    expect(await screen.findByRole("heading", { name: `${label} over time` })).toBeInTheDocument();
    expect(screen.getByText("Repository stats and clone traffic per product")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Stat" })).toHaveTextContent(label);
  });

  it("draws Daily as lines over the dates the API returned, with the line/bar toggle in the card header and not in the filter row", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    const { container } = renderStats(septemberRange);

    await waitFor(() => expect(container.querySelectorAll("path.recharts-line-curve")).toHaveLength(1));
    expect(legendOf(container)).toEqual(["API Manager"]);
    expect(screen.getByText("2026-09-01")).toBeInTheDocument();
    expect(screen.getByText("2026-09-28")).toBeInTheDocument();
    expect(screen.queryByText("2026-08-31")).not.toBeInTheDocument();

    const chart = card("Stars over time");
    expect(within(chart).getByRole("button", { name: "Line chart" })).toHaveAttribute("aria-pressed", "true");
    expect(within(chart).getByRole("button", { name: "Bar chart" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Chart type" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bars" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Line" })).not.toBeInTheDocument();

    await user.click(within(chart).getByRole("button", { name: "Bar chart" }));

    expect(container.querySelectorAll(".recharts-bar")).toHaveLength(1);
    expect(container.querySelector("path.recharts-line-curve")).toBeNull();
    // The chart type stays the reader's, for this visit, and is not written into the address.
    expect(screen.getByTestId("where")).not.toHaveTextContent("chart=");
  });

  it("draws Monthly as bars with no toggle", async () => {
    connected();
    stubApi();

    const { container } = renderStats(`${septemberRange}&interval=month`);

    await waitFor(() => expect(container.querySelectorAll(".recharts-bar")).toHaveLength(1));
    expect(container.querySelector("path.recharts-line-curve")).toBeNull();
    expect(within(card("Stars over time")).getByText("2026-09")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Line chart" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bar chart" })).not.toBeInTheDocument();
  });

  it("plots a clone Stat from the clone history, summed per month for Monthly, without asking for a cloner metric", async () => {
    connected();
    const fetchMock = stubApi();

    const { container } = renderStats(`${septemberRange}&stat=uniqueCloners&interval=month`);

    expect(await screen.findByRole("heading", { name: "Unique Cloners over time" })).toBeInTheDocument();
    await waitFor(() => expect(container.querySelectorAll(".recharts-bar")).toHaveLength(2));
    expect(legendOf(container)).toEqual(["API Manager", "Identity Server"]);
    expect(within(card("Unique Cloners over time")).getByText("2026-09")).toBeInTheDocument();
    expect(requestsTo(fetchMock, "/stats/clones")[0].searchParams.get("interval")).toBeNull();
    expect(requestsTo(fetchMock, "/stats/metric")).toHaveLength(0);
  });

  it("runs a clone Stat up as Cumulative over the clone history's days, keeping the toggle", async () => {
    connected();
    stubApi();

    const { container } = renderStats(`${septemberRange}&stat=clones&interval=cumulative`);

    expect(await screen.findByRole("heading", { name: "Total Clones over time" })).toBeInTheDocument();
    await waitFor(() => expect(container.querySelectorAll("path.recharts-line-curve")).toHaveLength(2));
    expect(legendOf(container)).toEqual(["API Manager", "Identity Server"]);
    const chart = card("Total Clones over time");
    expect(within(chart).getByText("2026-09-28")).toBeInTheDocument();
    expect(within(chart).getByText("2026-09-29")).toBeInTheDocument();
    expect(within(card("Total Clones over time")).getByRole("button", { name: "Line chart" })).toBeInTheDocument();
  });
});

describe("Current stats", () => {
  it("is titled Current stats with Total, Monthly and Daily toggles, and reads the latest counts and the range's clones per Product", async () => {
    connected();
    stubApi();

    renderStats(septemberRange);

    await screen.findByRole("columnheader", { name: "Stars" });
    const table = card("Current stats");
    expect(headersOf(table)).toEqual([
      "Product",
      "Stars",
      "Forks",
      "Watchers",
      "Open Issues",
      "Clones",
      "Unique Cloners",
    ]);
    expect(within(table).getByRole("button", { name: "Total" })).toHaveAttribute("aria-pressed", "true");
    expect(within(table).getByRole("button", { name: "Monthly" })).toHaveAttribute("aria-pressed", "false");
    expect(within(table).getByRole("button", { name: "Daily" })).toHaveAttribute("aria-pressed", "false");
    expect(table.querySelector('input[type="date"], input[type="month"]')).toBeNull();
    expect(rowsOf(table)).toEqual(TOTAL_ROWS);
    // The rows are plain rows, not buttons: nothing opens from them.
    expect(table.querySelectorAll('tbody tr[role="button"]')).toHaveLength(0);
    // The explanation moved into the Unique Cloners header's tooltip.
    expect(
      screen.queryByText(
        "Unique cloners are summed per day and the same person on different days counts separately.",
      ),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Latest counts/)).not.toBeInTheDocument();
  });

  it("reads a month as the sum of that month's daily changes and clones, from a month input that opens on the range's last month", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    renderStats(septemberRange);
    await screen.findByRole("columnheader", { name: "Stars" });

    await user.click(within(card("Current stats")).getByRole("button", { name: "Monthly" }));

    const table = card("Current stats");
    const month = within(table).getByLabelText("Month") as HTMLInputElement;
    expect(month.type).toBe("month");
    expect(month.value).toBe("2026-09");
    await waitFor(() =>
      expect(rowsOf(table)).toEqual([
        ["API Manager", "8", "3", "1", "0", "16", "6"],
        ["Identity Server", "0", "0", "0", "0", "1", "1"],
      ]),
    );

    fireEvent.change(month, { target: { value: "2026-08" } });
    expect(rowsOf(table)).toEqual([
      ["API Manager", "0", "0", "0", "0", "0", "0"],
      ["Identity Server", "0", "0", "0", "0", "0", "0"],
    ]);
  });

  it("reads a day's changes and clones from a day input that opens on the range's last day, with 0 where a Product has no point", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    renderStats(septemberRange);
    await screen.findByRole("columnheader", { name: "Stars" });

    await user.click(within(card("Current stats")).getByRole("button", { name: "Daily" }));

    const table = card("Current stats");
    const day = within(table).getByLabelText("Day") as HTMLInputElement;
    expect(day.type).toBe("date");
    expect(day.value).toBe("2026-09-30");
    // Nothing happened on the 30th, so every cell reads 0 — never a dash.
    await waitFor(() =>
      expect(rowsOf(table)).toEqual([
        ["API Manager", "0", "0", "0", "0", "0", "0"],
        ["Identity Server", "0", "0", "0", "0", "0", "0"],
      ]),
    );
    expect(within(table).queryByText("—")).not.toBeInTheDocument();

    fireEvent.change(day, { target: { value: "2026-09-28" } });
    expect(rowsOf(table)).toEqual([
      ["API Manager", "3", "1", "1", "-1", "10", "4"],
      ["Identity Server", "0", "0", "0", "0", "1", "1"],
    ]);
  });

  it("reads the latest GitHub counts when the day picker is cleared, and still sums clones over the range", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    renderStats(septemberRange);
    await screen.findByRole("columnheader", { name: "Stars" });
    const table = card("Current stats");

    await user.click(within(table).getByRole("button", { name: "Daily" }));
    await waitFor(() =>
      expect(rowsOf(table)).toEqual([
        ["API Manager", "0", "0", "0", "0", "0", "0"],
        ["Identity Server", "0", "0", "0", "0", "0", "0"],
      ]),
    );

    fireEvent.change(within(table).getByLabelText("Day"), { target: { value: "" } });
    expect(within(table).getByLabelText("Day")).toHaveValue("");
    expect(rowsOf(table)).toEqual(TOTAL_ROWS);
  });

  it("resets the picker to the range's end whenever the mode changes, and drops it for Total", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    renderStats(septemberRange);
    await screen.findByRole("columnheader", { name: "Stars" });
    const table = card("Current stats");

    await user.click(within(table).getByRole("button", { name: "Daily" }));
    fireEvent.change(within(table).getByLabelText("Day"), { target: { value: "2026-09-28" } });
    expect(within(table).getByLabelText("Day")).toHaveValue("2026-09-28");

    await user.click(within(table).getByRole("button", { name: "Monthly" }));
    expect(within(table).getByLabelText("Month")).toHaveValue("2026-09");
    expect(within(table).queryByLabelText("Day")).not.toBeInTheDocument();

    await user.click(within(table).getByRole("button", { name: "Daily" }));
    expect(within(table).getByLabelText("Day")).toHaveValue("2026-09-30");

    await user.click(within(table).getByRole("button", { name: "Total" }));
    expect(table.querySelector('input[type="date"], input[type="month"]')).toBeNull();
    await waitFor(() => expect(rowsOf(table)).toEqual(TOTAL_ROWS));
  });

  it("asks for the four daily series only when the table leaves Total, sharing the chart's when it is one of them", async () => {
    connected();
    const fetchMock = stubApi();
    const user = userEvent.setup();

    renderStats(`${septemberRange}&interval=month`);
    await screen.findByRole("columnheader", { name: "Stars" });
    expect(measuresAskedAt(fetchMock, "month")).toEqual(["stars"]);
    expect(measuresAskedAt(fetchMock, "day")).toEqual([]);

    await user.click(within(card("Current stats")).getByRole("button", { name: "Monthly" }));

    await waitFor(() =>
      expect(measuresAskedAt(fetchMock, "day")).toEqual(["forks", "openIssues", "stars", "watchers"]),
    );
    expect(measuresAskedAt(fetchMock, "month")).toEqual(["stars"]);

    // At Daily the chart already holds the Stars series: the table reads that
    // one rather than asking for it again.
    await choose(user, "Interval", "Daily");
    await waitFor(() =>
      expect(measuresAskedAt(fetchMock, "day")).toEqual(["forks", "openIssues", "stars", "watchers"]),
    );
  });

  it("searches Products from a magnifier in the Product header, says when none match, and clears with the button or Escape", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    renderStats(septemberRange);
    await screen.findByRole("columnheader", { name: "Stars" });
    const table = card("Current stats");
    expect(within(table).queryByRole("textbox")).not.toBeInTheDocument();

    await user.click(within(table).getByRole("button", { name: "Filter by product" }));
    const field = within(table).getByRole("textbox", { name: "Filter products" });
    expect(field).toHaveAttribute("placeholder", "Filter…");
    expect(field).toHaveFocus();

    await user.type(field, "ident");
    expect(rowsOf(table)).toEqual([["Identity Server", "40", "9", "3", "1", "1", "1"]]);
    expect(within(table).getByText("1–1 of 1")).toBeInTheDocument();

    await user.clear(field);
    await user.type(field, "zzz");
    expect(within(table).getByText("No products match your search")).toBeInTheDocument();
    // The header stays, so the search can be changed.
    expect(headersOf(table)).toHaveLength(7);

    await user.keyboard("{Escape}");
    expect(within(table).queryByText("No products match your search")).not.toBeInTheDocument();
    expect(rowsOf(table)).toHaveLength(2);
    expect(within(table).queryByRole("textbox")).not.toBeInTheDocument();

    await user.click(within(table).getByRole("button", { name: "Filter by product" }));
    await user.type(within(table).getByRole("textbox", { name: "Filter products" }), "api");
    expect(rowsOf(table)).toHaveLength(1);
    await user.click(within(table).getByRole("button", { name: "Clear product filter" }));
    expect(rowsOf(table)).toHaveLength(2);
    expect(within(table).getByRole("button", { name: "Filter by product" })).toBeInTheDocument();
  });

  it("explains Unique Cloners in a tooltip on its header", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    renderStats(septemberRange);
    await screen.findByRole("columnheader", { name: "Stars" });

    await user.hover(within(card("Current stats")).getByText("Unique Cloners"));

    expect(
      await screen.findByText(
        "Unique cloners summed per day. Same person on different days counts separately.",
      ),
    ).toBeInTheDocument();
  });

  it("pages the Products ten at a time with first, next and last buttons and the rows-per-page choices", async () => {
    connected();
    stubApi({ repositories: () => json(twelveProducts), clones: () => json({ series: [] }) });
    const user = userEvent.setup();

    renderStats(septemberRange);
    await screen.findByRole("columnheader", { name: "Stars" });
    const table = card("Current stats");

    expect(rowsOf(table)).toHaveLength(10);
    expect(rowsOf(table)[0]).toEqual(["Product 01", "10", "0", "0", "0", "0", "0"]);
    expect(rowsOf(table)[9][0]).toBe("Product 10");
    expect(within(table).getByText("1–10 of 12")).toBeInTheDocument();

    await user.click(within(table).getByRole("button", { name: /go to next page/i }));
    expect(rowsOf(table).map((row) => row[0])).toEqual(["Product 11", "Product 12"]);
    expect(rowsOf(table)[1][1]).toBe("120");

    await user.click(within(table).getByRole("button", { name: /go to first page/i }));
    expect(rowsOf(table)[0][0]).toBe("Product 01");
    await user.click(within(table).getByRole("button", { name: /go to last page/i }));
    expect(rowsOf(table)[0][0]).toBe("Product 11");

    await user.click(within(table).getByRole("combobox", { name: /rows per page/i }));
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "10",
      "25",
      "50",
      "100",
    ]);
    await user.click(within(listbox).getByRole("option", { name: "25" }));
    expect(rowsOf(table)).toHaveLength(12);
    expect(within(table).getByText("1–12 of 12")).toBeInTheDocument();
  });
});

describe("Repository Stats states", () => {
  it("shows a skeleton in the chart card and skeleton rows in the table until the series arrive", async () => {
    connected();
    stubApi({ metric: pending, clones: pending });

    renderStats(septemberRange);

    expect(await screen.findByRole("heading", { name: "Stars over time" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Current stats" })).toBeInTheDocument();
    expect(card("Stars over time").querySelector(".MuiSkeleton-root")).not.toBeNull();
    expect(card("Current stats").querySelectorAll(".MuiSkeleton-root")).toHaveLength(5);
    expect(screen.queryByText("No data for the selected range")).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader")).not.toBeInTheDocument();
  });

  it("says there is no data in the chart when the series is empty, while the table keeps the latest counts", async () => {
    connected();
    stubApi({ metric: () => json({ series: [] }) });

    renderStats(septemberRange);

    expect(await screen.findByText("No data for the selected range")).toBeInTheDocument();
    await screen.findByRole("columnheader", { name: "Stars" });
    expect(rowsOf(card("Current stats"))).toEqual(TOTAL_ROWS);
  });

  it("says no Products are tracked when the API lists none", async () => {
    connected();
    stubApi({
      repositories: () => json({ repositories: [] }),
      metric: () => json({ series: [] }),
      clones: () => json({ series: [] }),
    });

    renderStats(septemberRange);

    expect(await screen.findByText("No data for the selected range")).toBeInTheDocument();
    expect(await within(card("Current stats")).findByText("No products are tracked")).toBeInTheDocument();
    expect(screen.queryByText("No products match your search")).not.toBeInTheDocument();
  });

  it("shows the server's message with Retry in the chart card when the series fails, and recovers on Retry", async () => {
    connected();
    let answers = 0;
    const fetchMock = stubApi({
      metric: (url) => (answers++ === 0 ? json({ message: "Stars are being recounted." }, 500) : metricSeriesFor(url)),
    });
    const user = userEvent.setup();

    const { container } = renderStats(septemberRange);

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    const chart = card("Stars over time");
    expect(within(chart).getByText("Stars are being recounted.")).toBeInTheDocument();
    // The table reads nothing from that series at Total.
    await screen.findByRole("columnheader", { name: "Stars" });
    expect(rowsOf(card("Current stats"))).toEqual(TOTAL_ROWS);

    await user.click(within(chart).getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(container.querySelectorAll("path.recharts-line-curve")).toHaveLength(1));
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    expect(requestsTo(fetchMock, "/stats/metric")).toHaveLength(2);
  });

  it("falls back to the default sentence when a failure carries no message", async () => {
    connected();
    stubApi({ metric: () => new Response("<html>Bad gateway</html>", { status: 502 }) });

    renderStats(septemberRange);

    expect(await screen.findByText("We couldn't load this data. Please try again.")).toBeInTheDocument();
    expect(screen.queryByText(/Bad gateway/)).not.toBeInTheDocument();
  });

  it("shows the error with Retry in the Current stats card when the clone history fails, while the chart draws the Stars", async () => {
    connected();
    let answers = 0;
    const fetchMock = stubApi({
      clones: () => (answers++ === 0 ? json({ message: "Clone history is unavailable." }, 500) : json(clonesBody)),
    });
    const user = userEvent.setup();

    const { container } = renderStats(septemberRange);

    const table = card("Current stats");
    expect(await within(table).findByText("Clone history is unavailable.")).toBeInTheDocument();
    expect(within(table).queryByRole("columnheader")).not.toBeInTheDocument();
    await waitFor(() => expect(container.querySelectorAll("path.recharts-line-curve")).toHaveLength(1));
    expect(screen.getAllByText("Something went wrong")).toHaveLength(1);

    await user.click(within(table).getByRole("button", { name: "Retry" }));

    await within(table).findByRole("columnheader", { name: "Stars" });
    expect(rowsOf(table)).toEqual(TOTAL_ROWS);
    expect(requestsTo(fetchMock, "/stats/clones")).toHaveLength(2);
  });

  it("shows a failed daily series in the table at Monthly, and drops it on return to Total", async () => {
    connected();
    stubApi({
      metric: (url) =>
        url.searchParams.get("metric") === "forks" && url.searchParams.get("interval") === "day"
          ? json({ message: "Forks are unavailable." }, 500)
          : metricSeriesFor(url),
    });
    const user = userEvent.setup();

    const { container } = renderStats(septemberRange);
    await screen.findByRole("columnheader", { name: "Stars" });
    const table = card("Current stats");

    await user.click(within(table).getByRole("button", { name: "Monthly" }));

    expect(await within(table).findByText("Forks are unavailable.")).toBeInTheDocument();
    expect(within(table).getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(within(table).getByLabelText("Month")).toHaveValue("2026-09");
    // The chart's Stars are untouched.
    expect(container.querySelectorAll("path.recharts-line-curve")).toHaveLength(1);

    await user.click(within(table).getByRole("button", { name: "Total" }));

    expect(within(table).queryByText("Forks are unavailable.")).not.toBeInTheDocument();
    expect(rowsOf(table)).toEqual(TOTAL_ROWS);
  });

  it("shows an error with Retry instead of the chart and the table when the Products fail, and recovers", async () => {
    connected();
    let answers = 0;
    stubApi({
      repositories: () =>
        answers++ === 0 ? json({ message: "Products are unavailable." }, 500) : json(repositoriesBody),
    });
    const user = userEvent.setup();

    renderStats(septemberRange);

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Products are unavailable.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /over time/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Current stats" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("heading", { name: "Stars over time" })).toBeInTheDocument();
    await screen.findByRole("columnheader", { name: "Stars" });
    expect(rowsOf(card("Current stats"))).toEqual(TOTAL_ROWS);
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
