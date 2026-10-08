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
import EngineeringPackagesPage from "./EngineeringPackagesPage";

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

const packagesPath = downloadStatsPaths.packages;

function renderPackages(path: string = packagesPath) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Where />
        <Routes>
          <Route path={packagesPath} element={<EngineeringPackagesPage />} />
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

// The Products the API says have Package downloads; Identity Server is first,
// so it is the fallback. (API Manager has Package downloads here but not in
// the Versions suite's list of every Tracked repository: the two lists differ
// on purpose, and this screen reads this one.)
const packageProductsBody = {
  count: 2,
  repos: [
    { repoId: 3, repoName: "product-is", productName: "Identity Server", packageCount: 6 },
    { repoId: 1, repoName: "product-apim", productName: "API Manager", packageCount: 1 },
  ],
};

// Identity Server's six Packages, answered out of order by activity so the
// sort shows: period downloads 60 down to 10 in steps of ten (is-core leads),
// all-time totals that order differently (is-cli's 1,200 is the largest), so
// a Cumulative figure can be told from a period one.
const sixPackages = {
  packages: [
    { packageName: "is-cli", periodDownloads: 50, totalDownloads: 1200, versionCount: 1 },
    { packageName: "is-core", periodDownloads: 60, totalDownloads: 900, versionCount: 2 },
    { packageName: "is-docs", periodDownloads: 10, totalDownloads: 100, versionCount: null },
    { packageName: "is-agent", periodDownloads: 40, totalDownloads: 400, versionCount: 1 },
    { packageName: "is-sdk", periodDownloads: 30, totalDownloads: 300, versionCount: 1 },
    { packageName: "is-ui", periodDownloads: 20, totalDownloads: 200, versionCount: 1 },
  ],
};
const namesByActivity = ["is-core", "is-cli", "is-agent", "is-sdk", "is-ui", "is-docs"];

// Each Package's pulls over two September days (a line needs two points).
const sixSeries = {
  series: sixPackages.packages.map((item) => ({
    packageName: item.packageName,
    points: [
      { date: "2026-09-27", value: item.periodDownloads / 2 },
      { date: "2026-09-28", value: item.periodDownloads / 2 },
    ],
  })),
};

// is-core's two versions, one of them never tagged; is-cli's one.
const isCoreVersions = [
  { versionId: 11, tags: "v1.0.0,v1.0.0-rc3", periodDownloads: 40, totalDownloads: 700 },
  { versionId: 12, tags: null, periodDownloads: 20, totalDownloads: 200 },
];
const isCliVersions = [{ versionId: 21, tags: "v2.0.0", periodDownloads: 50, totalDownloads: 1200 }];

// API Manager's one Package, for a Product switch.
const apimPackages = {
  packages: [{ packageName: "apim-gateway", periodDownloads: 7, totalDownloads: 70, versionCount: 1 }],
};
const apimSeries = {
  series: [
    {
      packageName: "apim-gateway",
      points: [
        { date: "2026-09-27", value: 3 },
        { date: "2026-09-28", value: 4 },
      ],
    },
  ],
};
const apimVersions = [{ versionId: 31, tags: "v4.0.0", periodDownloads: 7, totalDownloads: 70 }];

// Twelve Packages with distinct downloads (pkg-12 has 120, pkg-01 has 10), so
// the table has a second page and a definite order.
const twelvePackages = {
  packages: Array.from({ length: 12 }, (_, i) => ({
    packageName: `pkg-${String(i + 1).padStart(2, "0")}`,
    periodDownloads: (i + 1) * 10,
    totalDownloads: (i + 1) * 100,
    versionCount: 1,
  })),
};

// Twelve versions of one Package, so the Versions table has a second page.
const twelveVersions = Array.from({ length: 12 }, (_, i) => ({
  versionId: 100 + i + 1,
  tags: `v3.${i + 1}`,
  periodDownloads: 12 - i,
  totalDownloads: (12 - i) * 10,
}));

// The versions the API answers for a Package of Identity Server.
function versionsFor(url: URL): Response {
  const name = url.searchParams.get("package");
  if (name === "is-core") return json({ versions: isCoreVersions });
  if (name === "is-cli") return json({ versions: isCliVersions });
  return json({ versions: [] });
}

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

/** The body rows' cells. The Package rows are buttons rather than rows, so they are read from the table itself. */
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

type Answer = (url: URL) => Response | Promise<Response>;
type Answers = { products?: Answer; breakdown?: Answer; series?: Answer; versions?: Answer };

/**
 * The requests the screen makes: the Products with Package downloads, a
 * Product's Package breakdown and Package series, and a Package's versions.
 */
function stubApi(answers: Answers = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    const parsed = new URL(url);
    if (parsed.pathname === "/api/v1/stats/packages/repos") {
      return (answers.products ?? (() => json(packageProductsBody)))(parsed);
    }
    if (/^\/api\/v1\/stats\/packages\/\d+\/series$/.test(parsed.pathname)) {
      return (answers.series ?? (() => json(sixSeries)))(parsed);
    }
    if (/^\/api\/v1\/stats\/packages\/\d+\/versions$/.test(parsed.pathname)) {
      return (answers.versions ?? versionsFor)(parsed);
    }
    if (/^\/api\/v1\/stats\/packages\/\d+$/.test(parsed.pathname)) {
      return (answers.breakdown ?? (() => json(sixPackages)))(parsed);
    }
    return json({}, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const pending = () => new Promise<Response>(() => {});

/** The requests whose path matches, in order. */
function requestsTo(fetchMock: ReturnType<typeof stubApi>, pathname: RegExp): URL[] {
  return fetchMock.mock.calls
    .map((call) => new URL(String(call[0])))
    .filter((url) => pathname.test(url.pathname));
}

const breakdownOf = (repoId: number) => new RegExp(`^/api/v1/stats/packages/${repoId}$`);
const seriesOf = (repoId: number) => new RegExp(`^/api/v1/stats/packages/${repoId}/series$`);
const versionsOf = (repoId: number) => new RegExp(`^/api/v1/stats/packages/${repoId}/versions$`);
/** Anything about a Product's Packages: the breakdown, the series or a Package's versions. */
const anyPackageData = /^\/api\/v1\/stats\/packages\/\d+/;

const septemberRange = `${packagesPath}?from=2026-09-01&to=2026-09-30`;

async function choose(
  user: ReturnType<typeof userEvent.setup>,
  select: string,
  option: string,
): Promise<void> {
  await user.click(screen.getByRole("combobox", { name: select }));
  await user.click(await screen.findByRole("option", { name: option }));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// The preview, not-connected and https rungs are the shell's —
// DownloadStatsShell.test.tsx walks them, and the Overview suite keeps two on
// a real screen.
describe("Packages filter bar", () => {
  it("shows the Product and Chart packages selects beside a Filters button that folds From, To and Interval away", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    renderPackages(septemberRange);

    expect(await screen.findByRole("tab", { name: "Packages", selected: true })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Product" })).toHaveTextContent("Identity Server"),
    );
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Chart packages" })).toHaveTextContent("5 packages"),
    );
    expect(screen.getByLabelText("From")).toHaveValue("2026-09-01");
    expect(screen.getByLabelText("To")).toHaveValue("2026-09-30");
    expect(screen.getByRole("combobox", { name: "Interval" })).toHaveTextContent("Daily");

    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.queryByLabelText("From")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("To")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Interval" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Product" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Chart packages" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByLabelText("From")).toHaveValue("2026-09-01");
    expect(screen.getByRole("combobox", { name: "Interval" })).toHaveTextContent("Daily");
  });

  it("offers the Products with Package downloads, and Daily, Monthly and Cumulative as the Interval", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    renderPackages(septemberRange);

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Product" })).toHaveTextContent("Identity Server"),
    );
    await user.click(screen.getByRole("combobox", { name: "Product" }));
    let listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Identity Server",
      "API Manager",
    ]);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());

    await user.click(screen.getByRole("combobox", { name: "Interval" }));
    listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Daily",
      "Monthly",
      "Cumulative",
    ]);
  });

  it("opens on the first offered Product over the last 30 days in UTC, writes it into the address, and asks the breakdown and the series so", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T12:00:00.000Z"));
    connected();
    const fetchMock = stubApi();

    renderPackages();

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("repo=3"));
    expect(screen.getByLabelText("From")).toHaveValue("2026-08-31");
    expect(screen.getByLabelText("To")).toHaveValue("2026-09-30");
    expect(screen.getByRole("combobox", { name: "Interval" })).toHaveTextContent("Daily");

    await waitFor(() => expect(requestsTo(fetchMock, breakdownOf(3))).toHaveLength(1));
    const [breakdown] = requestsTo(fetchMock, breakdownOf(3));
    expect(breakdown.searchParams.get("from")).toBe("2026-08-31");
    expect(breakdown.searchParams.get("to")).toBe("2026-09-30");
    await waitFor(() => expect(requestsTo(fetchMock, seriesOf(3))).toHaveLength(1));
    const [series] = requestsTo(fetchMock, seriesOf(3));
    expect(series.searchParams.get("interval")).toBe("day");
    expect(series.searchParams.get("from")).toBe("2026-08-31");
    expect(series.searchParams.get("to")).toBe("2026-09-30");
    expect(requestsTo(fetchMock, breakdownOf(1))).toHaveLength(0);
  });

  it("falls back to the first offered Product when the address names one the API does not offer", async () => {
    connected();
    const fetchMock = stubApi();

    renderPackages(`${septemberRange}&repo=9`);

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("repo=3"));
    expect(screen.getByTestId("where")).not.toHaveTextContent("repo=9");
    expect(screen.getByRole("combobox", { name: "Product" })).toHaveTextContent("Identity Server");
    await waitFor(() => expect(requestsTo(fetchMock, breakdownOf(3))).toHaveLength(1));
    expect(requestsTo(fetchMock, breakdownOf(9))).toHaveLength(0);
  });

  it("switches Product from the select and keeps it in the address", async () => {
    connected();
    const fetchMock = stubApi();
    const user = userEvent.setup();

    renderPackages(`${septemberRange}&repo=3`);

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Product" })).toHaveTextContent("Identity Server"),
    );
    await choose(user, "Product", "API Manager");

    expect(screen.getByTestId("where")).toHaveTextContent("repo=1");
    expect(screen.getByRole("combobox", { name: "Product" })).toHaveTextContent("API Manager");
    await waitFor(() => expect(requestsTo(fetchMock, breakdownOf(1))).toHaveLength(1));
    await waitFor(() => expect(requestsTo(fetchMock, seriesOf(1))).toHaveLength(1));
  });

  it("writes a changed Interval into the address together with the default dates, and asks the series so", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T12:00:00.000Z"));
    connected();
    const fetchMock = stubApi();
    const user = userEvent.setup();

    renderPackages();
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("repo=3"));

    await choose(user, "Interval", "Monthly");

    const where = screen.getByTestId("where");
    expect(where).toHaveTextContent("interval=month");
    expect(where).toHaveTextContent("from=2026-08-31");
    expect(where).toHaveTextContent("to=2026-09-30");
    expect(where).toHaveTextContent("repo=3");
    await waitFor(() =>
      expect(requestsTo(fetchMock, seriesOf(3)).at(-1)?.searchParams.get("interval")).toBe("month"),
    );
    // The breakdown has no Interval: it is asked once, for the range.
    expect(requestsTo(fetchMock, breakdownOf(3))).toHaveLength(1);
  });

  it("keeps a changed date range in the address and keeps the date when a field is cleared", async () => {
    connected();
    stubApi();

    renderPackages(septemberRange);

    expect(await screen.findByLabelText("From")).toHaveValue("2026-09-01");
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-01-01" } });
    expect(screen.getByTestId("where")).toHaveTextContent("from=2026-01-01");
    expect(screen.getByTestId("where")).toHaveTextContent("to=2026-09-30");

    fireEvent.change(screen.getByLabelText("To"), { target: { value: "" } });
    expect(screen.getByTestId("where")).toHaveTextContent("to=2026-09-30");
    expect(screen.getByLabelText("To")).toHaveValue("2026-09-30");
  });
});

describe("Packages chart card", () => {
  it("is titled Downloads by package with its subtitle, and starts narrowed to the five most active Packages", async () => {
    connected();
    stubApi();

    const { container } = renderPackages(septemberRange);

    expect(await screen.findByRole("heading", { name: "Downloads by package" })).toBeInTheDocument();
    expect(
      screen.getByText("Package pulls over the selected range, from exact scraped totals"),
    ).toBeInTheDocument();
    await waitFor(() => expect(container.querySelectorAll("path.recharts-line-curve")).toHaveLength(5));
    // Every Package but the least active, is-docs.
    expect(legendOf(container)).toEqual(["is-agent", "is-cli", "is-core", "is-sdk", "is-ui"]);
    expect(screen.getByRole("combobox", { name: "Chart packages" })).toHaveTextContent("5 packages");
    expect(screen.getByRole("button", { name: "Line chart" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: /every package/i })).not.toBeInTheDocument();
  });

  it("offers every Package with a checkbox, narrows the chart to the chosen ones, and means every Package when none is chosen", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    const { container } = renderPackages(septemberRange);
    await waitFor(() => expect(container.querySelectorAll("path.recharts-line-curve")).toHaveLength(5));

    await user.click(screen.getByRole("combobox", { name: "Chart packages" }));
    const listbox = await screen.findByRole("listbox");
    // Most active first, as the table lists them.
    const options = within(listbox).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(namesByActivity);
    expect(within(options[0]).getByRole("checkbox")).toBeChecked();
    expect(within(options[5]).getByRole("checkbox")).not.toBeChecked();

    // Unchecking every chosen Package leaves an empty selection: every Package.
    for (const name of ["is-core", "is-cli", "is-agent", "is-sdk", "is-ui"]) {
      await user.click(within(listbox).getByRole("option", { name }));
    }
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    expect(screen.getByRole("combobox", { name: "Chart packages" })).toHaveTextContent("All packages");
    await waitFor(() => expect(container.querySelectorAll("path.recharts-line-curve")).toHaveLength(6));
    expect(legendOf(container)).toContain("is-docs");

    // One chosen Package reads as its name.
    await choose(user, "Chart packages", "is-docs");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    expect(screen.getByRole("combobox", { name: "Chart packages" })).toHaveTextContent("is-docs");
    await waitFor(() => expect(container.querySelectorAll("path.recharts-line-curve")).toHaveLength(1));
    expect(legendOf(container)).toEqual(["is-docs"]);

    // The table is never narrowed by the chart's selection.
    expect(rowsOf(card("Packages"))).toHaveLength(6);
  });

  it("draws Daily as lines with short dates and switches to bars from the toggle", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    const { container } = renderPackages(septemberRange);

    await waitFor(() => expect(container.querySelectorAll("path.recharts-line-curve")).toHaveLength(5));
    expect(container.querySelector(".recharts-bar")).toBeNull();
    expect(container.textContent).toContain("Sep 27");
    expect(container.textContent).not.toContain("2026-09-27");

    await user.click(screen.getByRole("button", { name: "Bar chart" }));

    expect(container.querySelectorAll(".recharts-bar")).toHaveLength(5);
    expect(container.querySelector("path.recharts-line-curve")).toBeNull();
  });

  it("draws Monthly as bars with no toggle", async () => {
    connected();
    stubApi();

    const { container } = renderPackages(`${septemberRange}&interval=month`);

    await waitFor(() => expect(container.querySelectorAll(".recharts-bar")).toHaveLength(5));
    expect(container.querySelector("path.recharts-line-curve")).toBeNull();
    expect(screen.queryByRole("button", { name: "Bar chart" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Line chart" })).not.toBeInTheDocument();
  });

  it("draws Cumulative as lines with the toggle", async () => {
    connected();
    stubApi();

    const { container } = renderPackages(`${septemberRange}&interval=cumulative`);

    await waitFor(() => expect(container.querySelectorAll("path.recharts-line-curve")).toHaveLength(5));
    expect(screen.getByRole("button", { name: "Line chart" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Bar chart" })).toBeInTheDocument();
  });
});

describe("Packages table", () => {
  it("lists every Package by period downloads, highest first, in compact figures, and says the figure is the range's", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    renderPackages(septemberRange);

    await screen.findByRole("columnheader", { name: "Package" });
    const table = card("Packages");
    expect(headersOf(table)).toEqual(["Package", "Downloads"]);
    expect(rowsOf(table)).toEqual([
      ["is-core", "60"],
      ["is-cli", "50"],
      ["is-agent", "40"],
      ["is-sdk", "30"],
      ["is-ui", "20"],
      ["is-docs", "10"],
    ]);
    expect(within(table).getByText("1–6 of 6")).toBeInTheDocument();

    await user.hover(within(table).getByText("Downloads"));
    expect(await screen.findByText("Downloads within the selected date range")).toBeInTheDocument();
  });

  it("shows the all-time total for Cumulative, in the same order, and says it is as of the latest sync", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    renderPackages(`${septemberRange}&interval=cumulative`);

    await screen.findByRole("columnheader", { name: "Package" });
    const table = card("Packages");
    expect(rowsOf(table)).toEqual([
      ["is-core", "900"],
      ["is-cli", "1.2K"],
      ["is-agent", "400"],
      ["is-sdk", "300"],
      ["is-ui", "200"],
      ["is-docs", "100"],
    ]);

    await user.hover(within(table).getByText("Downloads"));
    expect(await screen.findByText("All-time downloads, as of the latest sync")).toBeInTheDocument();
  });

  it("pages the Packages ten at a time with first, next and last buttons and the rows-per-page choices", async () => {
    connected();
    stubApi({ breakdown: () => json(twelvePackages) });
    const user = userEvent.setup();

    renderPackages(septemberRange);

    await screen.findByRole("columnheader", { name: "Package" });
    const table = card("Packages");
    expect(rowsOf(table)).toHaveLength(10);
    expect(rowsOf(table)[0]).toEqual(["pkg-12", "120"]);
    expect(rowsOf(table)[9][0]).toBe("pkg-03");
    expect(within(table).getByText("1–10 of 12")).toBeInTheDocument();

    await user.click(within(table).getByRole("button", { name: /go to next page/i }));
    expect(rowsOf(table).map((row) => row[0])).toEqual(["pkg-02", "pkg-01"]);

    await user.click(within(table).getByRole("button", { name: /go to first page/i }));
    expect(rowsOf(table)[0][0]).toBe("pkg-12");
    await user.click(within(table).getByRole("button", { name: /go to last page/i }));
    expect(rowsOf(table)[0][0]).toBe("pkg-02");

    await user.click(within(table).getByRole("combobox", { name: /rows per page/i }));
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option").map((o) => o.textContent)).toEqual([
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

/** A Package's row in the Packages table, as the button it is. */
function packageRow(name: string): HTMLElement {
  return within(card("Packages")).getByRole("button", { name: new RegExp(`^${name}\\b`) });
}

/** The chip in the Versions card naming the picked Package. */
function packageChip(name: string): HTMLElement {
  return within(card("Versions")).getByRole("button", { name });
}

describe("Versions panel", () => {
  it("opens on the most active Package, highlighting its row, and lists its Tags in monospace — #id where a version has none — with compact downloads", async () => {
    connected();
    const fetchMock = stubApi();

    renderPackages(septemberRange);

    await screen.findByRole("columnheader", { name: "Tags" });
    const versions = card("Versions");
    expect(packageChip("is-core")).toBeInTheDocument();
    expect(headersOf(versions)).toEqual(["Tags", "Downloads"]);
    expect(rowsOf(versions)).toEqual([
      ["v1.0.0,v1.0.0-rc3", "40"],
      ["#12", "20"],
    ]);
    expect(within(versions).getByText("v1.0.0,v1.0.0-rc3")).toHaveStyle("font-family: monospace");
    expect(within(versions).getByText("#12")).toHaveStyle("font-family: monospace");
    expect(within(versions).getByText("1–2 of 2")).toBeInTheDocument();

    expect(packageRow("is-core")).toHaveAttribute("aria-pressed", "true");
    expect(packageRow("is-cli")).toHaveAttribute("aria-pressed", "false");

    // One request, for that Package alone: never one for the previous Product's, or for none.
    const requested = requestsTo(fetchMock, versionsOf(3));
    expect(requested).toHaveLength(1);
    expect(requested[0].searchParams.get("package")).toBe("is-core");
    expect(requested[0].searchParams.get("from")).toBe("2026-09-01");
    expect(requested[0].searchParams.get("to")).toBe("2026-09-30");
  });

  it("shows the versions' all-time totals for Cumulative and says so", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    renderPackages(`${septemberRange}&interval=cumulative`);

    await screen.findByRole("columnheader", { name: "Tags" });
    const versions = card("Versions");
    expect(rowsOf(versions)).toEqual([
      ["v1.0.0,v1.0.0-rc3", "700"],
      ["#12", "200"],
    ]);

    await user.hover(within(versions).getByText("Downloads"));
    expect(await screen.findByText("All-time downloads, as of the latest sync")).toBeInTheDocument();
  });

  it("changes the Package from another row, by click, Enter and Space", async () => {
    connected();
    const fetchMock = stubApi();
    const user = userEvent.setup();

    renderPackages(septemberRange);

    await screen.findByRole("columnheader", { name: "Tags" });

    await user.click(packageRow("is-cli"));

    expect(packageChip("is-cli")).toBeInTheDocument();
    expect(packageRow("is-cli")).toHaveAttribute("aria-pressed", "true");
    expect(packageRow("is-core")).toHaveAttribute("aria-pressed", "false");
    await waitFor(() => expect(rowsOf(card("Versions"))).toEqual([["v2.0.0", "50"]]));
    expect(requestsTo(fetchMock, versionsOf(3)).at(-1)?.searchParams.get("package")).toBe("is-cli");

    packageRow("is-core").focus();
    await user.keyboard("{Enter}");
    expect(packageChip("is-core")).toBeInTheDocument();
    expect(packageRow("is-core")).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(rowsOf(card("Versions"))).toHaveLength(2));

    packageRow("is-cli").focus();
    await user.keyboard(" ");
    expect(packageChip("is-cli")).toBeInTheDocument();
    expect(packageRow("is-cli")).toHaveAttribute("aria-pressed", "true");

    // Clicking the picked row keeps it picked; the chip is how it is cleared.
    await user.click(packageRow("is-cli"));
    expect(packageChip("is-cli")).toBeInTheDocument();
    expect(packageRow("is-cli")).toHaveAttribute("aria-pressed", "true");
  });

  it("clears the Package from its chip, showing the hint and asking to select a package, and asks for nothing", async () => {
    connected();
    const fetchMock = stubApi();
    const user = userEvent.setup();

    renderPackages(septemberRange);

    await screen.findByRole("columnheader", { name: "Tags" });
    await user.click(within(packageChip("is-core")).getByTestId("CancelIcon"));

    const versions = card("Versions");
    expect(within(versions).queryByRole("button", { name: "is-core" })).not.toBeInTheDocument();
    expect(within(versions).getByText("Select a package to see versions")).toBeInTheDocument();
    expect(within(versions).queryByRole("columnheader")).not.toBeInTheDocument();
    expect(packageRow("is-core")).toHaveAttribute("aria-pressed", "false");
    await user.hover(versions.querySelector("svg.lucide-info") as Element);
    expect(await screen.findByText("Click a package row to see its versions")).toBeInTheDocument();
    expect(requestsTo(fetchMock, versionsOf(3))).toHaveLength(1);
  });

  it("says No tagged version data yet when the picked Package has none", async () => {
    connected();
    stubApi({ versions: () => json({ versions: [] }) });

    renderPackages(septemberRange);

    expect(await screen.findByText("No tagged version data yet")).toBeInTheDocument();
    const versions = card("Versions");
    expect(packageChip("is-core")).toBeInTheDocument();
    expect(within(versions).queryByRole("columnheader")).not.toBeInTheDocument();
  });

  it("pages the versions ten at a time with the rows-per-page choices", async () => {
    connected();
    stubApi({ versions: () => json({ versions: twelveVersions }) });
    const user = userEvent.setup();

    renderPackages(septemberRange);

    await screen.findByRole("columnheader", { name: "Tags" });
    const versions = card("Versions");
    expect(rowsOf(versions)).toHaveLength(10);
    expect(rowsOf(versions)[0]).toEqual(["v3.1", "12"]);
    expect(within(versions).getByText("1–10 of 12")).toBeInTheDocument();

    await user.click(within(versions).getByRole("button", { name: /go to next page/i }));
    expect(rowsOf(versions)).toEqual([
      ["v3.11", "2"],
      ["v3.12", "1"],
    ]);

    await user.click(within(versions).getByRole("combobox", { name: /rows per page/i }));
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "10",
      "25",
      "50",
      "100",
    ]);
    await user.click(within(listbox).getByRole("option", { name: "25" }));
    expect(rowsOf(versions)).toHaveLength(12);
  });

  it("starts over on a Product change: the new Product's most active Package is picked and asked for once, never the old one's", async () => {
    connected();
    const fetchMock = stubApi({
      breakdown: (url) => json(url.pathname.endsWith("/packages/1") ? apimPackages : sixPackages),
      series: (url) => json(url.pathname.includes("/packages/1/") ? apimSeries : sixSeries),
      versions: (url) =>
        url.pathname.includes("/packages/1/") ? json({ versions: apimVersions }) : versionsFor(url),
    });
    const user = userEvent.setup();

    renderPackages(`${septemberRange}&repo=3`);

    await screen.findByRole("columnheader", { name: "Tags" });
    await user.click(packageRow("is-cli"));
    expect(packageChip("is-cli")).toBeInTheDocument();

    await choose(user, "Product", "API Manager");

    // The cards start over for the new Product, so they are looked up afresh.
    await waitFor(() => expect(packageChip("apim-gateway")).toBeInTheDocument());
    expect(rowsOf(card("Packages"))).toEqual([["apim-gateway", "7"]]);
    expect(packageRow("apim-gateway")).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(rowsOf(card("Versions"))).toEqual([["v4.0.0", "7"]]));
    expect(screen.getByRole("combobox", { name: "Chart packages" })).toHaveTextContent("apim-gateway");

    // The new Product's versions were asked for once, for its top Package — never for the old Product's.
    const forApim = requestsTo(fetchMock, versionsOf(1));
    expect(forApim).toHaveLength(1);
    expect(forApim[0].searchParams.get("package")).toBe("apim-gateway");
  });
});

describe("Packages states", () => {
  it("shows a skeleton in the chart card and skeleton rows in both cards while the Products are resolved", async () => {
    connected();
    const fetchMock = stubApi({ products: pending });

    const { container } = renderPackages(septemberRange);

    expect(await screen.findByRole("heading", { name: "Downloads by package" })).toBeInTheDocument();
    expect(card("Packages").querySelectorAll(".MuiSkeleton-root")).toHaveLength(5);
    expect(card("Versions").querySelectorAll(".MuiSkeleton-root")).toHaveLength(5);
    expect(container.querySelectorAll(".MuiSkeleton-root")).toHaveLength(11);
    expect(screen.queryByText(/No package data/)).not.toBeInTheDocument();
    expect(screen.queryByText("No packages found")).not.toBeInTheDocument();
    expect(screen.queryByText("Select a package to see versions")).not.toBeInTheDocument();
    expect(requestsTo(fetchMock, anyPackageData)).toHaveLength(0);
  });

  it("keeps the Versions skeleton while the breakdown loads, as the Package to open on is not yet known", async () => {
    connected();
    const fetchMock = stubApi({ breakdown: pending });

    const { container } = renderPackages(septemberRange);

    await waitFor(() => expect(container.querySelectorAll("path.recharts-line-curve")).toHaveLength(6));
    expect(card("Packages").querySelectorAll(".MuiSkeleton-root")).toHaveLength(5);
    expect(card("Versions").querySelectorAll(".MuiSkeleton-root")).toHaveLength(5);
    expect(screen.getByRole("combobox", { name: "Chart packages" })).toHaveTextContent("All packages");
    expect(requestsTo(fetchMock, versionsOf(3))).toHaveLength(0);
  });

  it("says there is no package data, no packages, and to select a package when the Product has none in the range", async () => {
    connected();
    const fetchMock = stubApi({ breakdown: () => json({ packages: [] }), series: () => json({ series: [] }) });

    renderPackages(septemberRange);

    expect(await screen.findByText("No package data for this product / range yet")).toBeInTheDocument();
    expect(await within(card("Packages")).findByText("No packages found")).toBeInTheDocument();
    expect(within(card("Versions")).getByText("Select a package to see versions")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Chart packages" })).toHaveTextContent("All packages");
    expect(card("Versions").querySelector("svg.lucide-info")).not.toBeNull();
    expect(requestsTo(fetchMock, versionsOf(3))).toHaveLength(0);
  });

  it("shows the server's message with Retry in the Packages card when the breakdown fails, keeps the Versions skeleton, and recovers on Retry", async () => {
    connected();
    let answers = 0;
    const fetchMock = stubApi({
      breakdown: () =>
        answers++ === 0 ? json({ message: "Packages are being counted." }, 500) : json(sixPackages),
    });
    const user = userEvent.setup();

    renderPackages(septemberRange);

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    const packages = card("Packages");
    expect(within(packages).getByText("Packages are being counted.")).toBeInTheDocument();
    expect(screen.getAllByText("Something went wrong")).toHaveLength(1);
    // The versions wait on the breakdown for the Package to open on.
    expect(card("Versions").querySelectorAll(".MuiSkeleton-root")).toHaveLength(5);
    expect(requestsTo(fetchMock, versionsOf(3))).toHaveLength(0);

    await user.click(within(packages).getByRole("button", { name: "Retry" }));

    await screen.findByRole("columnheader", { name: "Package" });
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    expect(await screen.findByRole("columnheader", { name: "Tags" })).toBeInTheDocument();
    expect(packageChip("is-core")).toBeInTheDocument();
    expect(requestsTo(fetchMock, breakdownOf(3))).toHaveLength(2);
  });

  it("shows the server's message with Retry in the chart alone when the series fails, and recovers on Retry", async () => {
    connected();
    let answers = 0;
    const fetchMock = stubApi({
      series: () => (answers++ === 0 ? json({ message: "Series are being rebuilt." }, 500) : json(sixSeries)),
    });
    const user = userEvent.setup();

    const { container } = renderPackages(septemberRange);

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Series are being rebuilt.")).toBeInTheDocument();
    expect(screen.getAllByText("Something went wrong")).toHaveLength(1);
    await screen.findByRole("columnheader", { name: "Package" });
    expect(rowsOf(card("Packages"))).toHaveLength(6);

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(container.querySelectorAll("path.recharts-line-curve")).toHaveLength(5));
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    expect(requestsTo(fetchMock, seriesOf(3))).toHaveLength(2);
  });

  it("shows the server's message with Retry in the Versions card alone when the versions fail", async () => {
    connected();
    let answers = 0;
    stubApi({
      versions: (url) =>
        answers++ === 0 ? json({ message: "Versions are being counted." }, 500) : versionsFor(url),
    });
    const user = userEvent.setup();

    renderPackages(septemberRange);

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    const versions = card("Versions");
    expect(within(versions).getByText("Versions are being counted.")).toBeInTheDocument();
    expect(screen.getAllByText("Something went wrong")).toHaveLength(1);
    expect(packageChip("is-core")).toBeInTheDocument();
    expect(rowsOf(card("Packages"))).toHaveLength(6);

    await user.click(within(versions).getByRole("button", { name: "Retry" }));

    await within(versions).findByRole("columnheader", { name: "Tags" });
    expect(rowsOf(versions)).toHaveLength(2);
  });

  it("shows an error with Retry instead of the chart and the cards when the Products fail, and recovers", async () => {
    connected();
    let answers = 0;
    stubApi({
      products: () =>
        answers++ === 0 ? json({ message: "Products are unavailable." }, 503) : json(packageProductsBody),
    });
    const user = userEvent.setup();

    renderPackages(septemberRange);

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Products are unavailable.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Downloads by package" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Versions" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("heading", { name: "Downloads by package" })).toBeInTheDocument();
    await waitFor(() => expect(packageChip("is-core")).toBeInTheDocument());
  });

  it("says when no Product has package downloads, and asks for nothing more", async () => {
    connected();
    const fetchMock = stubApi({ products: () => json({ count: 0, repos: [] }) });

    renderPackages(septemberRange);

    expect(await screen.findByText("No product has package downloads")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Downloads by package" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Product" })).toBeInTheDocument();
    expect(requestsTo(fetchMock, anyPackageData)).toHaveLength(0);
  });

  it("says From is after To instead of the chart and the cards, and asks for nothing", async () => {
    connected();
    const fetchMock = stubApi({ breakdown: () => json({ message: "no" }, 500) });

    renderPackages(`${packagesPath}?from=2026-09-10&to=2026-09-01&repo=3`);

    expect(await screen.findByText("From is after To.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Product" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Downloads by package" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Versions" })).not.toBeInTheDocument();
    await waitFor(() => expect(requestsTo(fetchMock, /\/packages\/repos$/)).toHaveLength(1));
    expect(requestsTo(fetchMock, anyPackageData)).toHaveLength(0);
  });
});
