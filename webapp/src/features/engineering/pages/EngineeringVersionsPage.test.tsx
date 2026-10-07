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
import EngineeringVersionsPage from "./EngineeringVersionsPage";

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

const versionsPath = downloadStatsPaths.versions;

function renderVersions(path: string = versionsPath) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Where />
        <Routes>
          <Route path={versionsPath} element={<EngineeringVersionsPage />} />
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

// Identity Server is the first active Product, so it is the fallback.
const repositoriesBody = {
  repositories: [
    { id: 9, repoName: "old", productName: "Retired", isActive: false },
    { id: 3, repoName: "product-is", productName: "Identity Server", isActive: true },
    { id: 1, repoName: "product-apim", productName: "API Manager", isActive: true },
  ],
};

// Identity Server's six Versions over two September days (a line needs two
// points to be drawn): v1.5 has 50 downloads and the others 10 each, so the
// grand total is 100 and the shares read 50.0% and 10.0%. Names differ from
// Tags so the legend, the table's Version column and its Tag column can each
// be told apart.
const sixVersions = {
  series: ["v1.0", "v1.1", "v1.2", "v1.3", "v1.4", "v1.5"].map((tag) => ({
    releaseTag: tag,
    releaseName: `IS ${tag.slice(1)}`,
    points: [
      { date: "2026-09-27", value: tag === "v1.5" ? 20 : 4 },
      { date: "2026-09-28", value: tag === "v1.5" ? 30 : 6 },
    ],
  })),
};

// v1.5's two Assets: one of 481,689,600 bytes ("459.4 MB"), one of unknown size.
const v15Assets = [
  { releaseTag: "v1.5", assetName: "wso2is-1.5.zip", assetSize: 481689600, downloadCount: 7 },
  { releaseTag: "v1.5", assetName: "wso2is-1.5.zip.sha1", assetSize: null, downloadCount: 2 },
];
const v10Assets = [
  { releaseTag: "v1.0", assetName: "wso2is-1.0.zip", assetSize: 1024, downloadCount: 1 },
];

// API Manager's two Versions, for a Product switch: v4.0.0 leads.
const apimVersions = {
  series: [
    { releaseTag: "v3.0.0", releaseName: "APIM 3.0.0", points: [{ date: "2026-09-28", value: 1 }] },
    { releaseTag: "v4.0.0", releaseName: "APIM 4.0.0", points: [{ date: "2026-09-28", value: 9 }] },
  ],
};

// Twelve Versions with distinct downloads (v2.12 has 120, v2.1 has 10), so
// the table has a second page and a definite order.
const twelveVersions = {
  series: Array.from({ length: 12 }, (_, i) => ({
    releaseTag: `v2.${i + 1}`,
    releaseName: `IS 2.${i + 1}`,
    points: [{ date: "2026-09-28", value: (i + 1) * 10 }],
  })),
};

// Twelve Assets of one Version, so the Assets table has a second page.
const twelveAssets = Array.from({ length: 12 }, (_, i) => ({
  releaseTag: "v1.5",
  assetName: `asset-${String(i + 1).padStart(2, "0")}.zip`,
  assetSize: 1024 * (i + 1),
  downloadCount: i + 1,
}));

// The Assets the API answers: the selected Version's, or every Version's when
// none is named.
function assetsFor(url: URL): Response {
  const version = url.searchParams.get("version");
  if (version === null) return json({ assets: [...v15Assets, ...v10Assets] });
  if (version === "v1.5") return json({ assets: v15Assets });
  if (version === "v1.0") return json({ assets: v10Assets });
  return json({ assets: [] });
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

/** The body rows' cells. The Versions rows are buttons rather than rows, so they are read from the table itself. */
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
type Answers = { repositories?: Answer; series?: Answer; assets?: Answer };

/** The requests the screen makes: the Products, a Product's Version series, and a Version's Assets. */
function stubApi(answers: Answers = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    const parsed = new URL(url);
    if (url.startsWith("https://stats.example/api/v1/repositories")) {
      return (answers.repositories ?? (() => json(repositoriesBody)))(parsed);
    }
    if (url.startsWith("https://stats.example/api/v1/stats/versions/")) {
      return (answers.series ?? (() => json(sixVersions)))(parsed);
    }
    if (url.startsWith("https://stats.example/api/v1/stats/assets/")) {
      return (answers.assets ?? assetsFor)(parsed);
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

const septemberRange = `${versionsPath}?from=2026-09-01&to=2026-09-30`;

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
describe("Versions filter bar", () => {
  it("shows the Product and Version selects beside a Filters button that folds From, To and Interval away", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    renderVersions(septemberRange);

    expect(await screen.findByRole("heading", { name: "Versions", level: 5 })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Product" })).toHaveTextContent("Identity Server"),
    );
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Version" })).toHaveTextContent("5 versions"),
    );
    expect(screen.getByLabelText("From")).toHaveValue("2026-09-01");
    expect(screen.getByLabelText("To")).toHaveValue("2026-09-30");
    expect(screen.getByRole("combobox", { name: "Interval" })).toHaveTextContent("Daily");

    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.queryByLabelText("From")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("To")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Interval" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Product" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Version" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByLabelText("From")).toHaveValue("2026-09-01");
    expect(screen.getByRole("combobox", { name: "Interval" })).toHaveTextContent("Daily");
  });

  it("offers the active Products only, and Daily, Monthly and Cumulative as the Interval", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    renderVersions(septemberRange);

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

  it("opens on the first active Product over the last 30 days in UTC, writes it into the address, and asks the series so", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T12:00:00.000Z"));
    connected();
    const fetchMock = stubApi();

    renderVersions();

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("repo=3"));
    expect(screen.getByLabelText("From")).toHaveValue("2026-08-31");
    expect(screen.getByLabelText("To")).toHaveValue("2026-09-30");
    expect(screen.getByRole("combobox", { name: "Interval" })).toHaveTextContent("Daily");
    expect(screen.queryByText("Retired")).not.toBeInTheDocument();

    await waitFor(() => expect(requestsTo(fetchMock, "/stats/versions/")).toHaveLength(1));
    const [requested] = requestsTo(fetchMock, "/stats/versions/");
    expect(requested.pathname).toBe("/api/v1/stats/versions/3/series");
    expect(requested.searchParams.get("interval")).toBe("day");
    expect(requested.searchParams.get("from")).toBe("2026-08-31");
    expect(requested.searchParams.get("to")).toBe("2026-09-30");
  });

  it("falls back to the first active Product when the address names an inactive one", async () => {
    connected();
    const fetchMock = stubApi();

    renderVersions(`${septemberRange}&repo=9`);

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("repo=3"));
    expect(screen.getByTestId("where")).not.toHaveTextContent("repo=9");
    expect(screen.getByRole("combobox", { name: "Product" })).toHaveTextContent("Identity Server");
    await waitFor(() => expect(requestsTo(fetchMock, "/stats/versions/")).toHaveLength(1));
    expect(requestsTo(fetchMock, "/stats/versions/")[0].pathname).toContain("/versions/3/");
  });

  it("switches Product from the select and keeps it in the address", async () => {
    connected();
    const fetchMock = stubApi();
    const user = userEvent.setup();

    renderVersions(`${septemberRange}&repo=3`);

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Product" })).toHaveTextContent("Identity Server"),
    );
    await choose(user, "Product", "API Manager");

    expect(screen.getByTestId("where")).toHaveTextContent("repo=1");
    expect(screen.getByRole("combobox", { name: "Product" })).toHaveTextContent("API Manager");
    await waitFor(() =>
      expect(requestsTo(fetchMock, "/stats/versions/").at(-1)?.pathname).toContain("/versions/1/"),
    );
  });

  it("writes a changed Interval into the address together with the default dates, and asks the series so", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T12:00:00.000Z"));
    connected();
    const fetchMock = stubApi();
    const user = userEvent.setup();

    renderVersions();
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("repo=3"));

    await choose(user, "Interval", "Monthly");

    const where = screen.getByTestId("where");
    expect(where).toHaveTextContent("interval=month");
    expect(where).toHaveTextContent("from=2026-08-31");
    expect(where).toHaveTextContent("to=2026-09-30");
    expect(where).toHaveTextContent("repo=3");
    await waitFor(() =>
      expect(requestsTo(fetchMock, "/stats/versions/").at(-1)?.searchParams.get("interval")).toBe(
        "month",
      ),
    );
  });

  it("keeps a changed date range in the address and keeps the date when a field is cleared", async () => {
    connected();
    stubApi();

    renderVersions(septemberRange);

    expect(await screen.findByLabelText("From")).toHaveValue("2026-09-01");
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-01-01" } });
    expect(screen.getByTestId("where")).toHaveTextContent("from=2026-01-01");
    expect(screen.getByTestId("where")).toHaveTextContent("to=2026-09-30");

    fireEvent.change(screen.getByLabelText("To"), { target: { value: "" } });
    expect(screen.getByTestId("where")).toHaveTextContent("to=2026-09-30");
    expect(screen.getByLabelText("To")).toHaveValue("2026-09-30");
  });
});

describe("Versions chart card", () => {
  it("is titled Downloads by version and starts narrowed to the five most recent Versions by Tag", async () => {
    connected();
    stubApi();

    const { container } = renderVersions(septemberRange);

    expect(await screen.findByRole("heading", { name: "Downloads by version" })).toBeInTheDocument();
    await waitFor(() => expect(container.querySelectorAll("path.recharts-line-curve")).toHaveLength(5));
    expect(legendOf(container)).toEqual(["IS 1.1", "IS 1.2", "IS 1.3", "IS 1.4", "IS 1.5"]);
    expect(screen.getByRole("combobox", { name: "Version" })).toHaveTextContent("5 versions");
    expect(screen.getByRole("button", { name: "Line chart" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: /every release/i })).not.toBeInTheDocument();
  });

  it("offers every Version with a checkbox, narrows the chart to the chosen ones, and means every Version when none is chosen", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    const { container } = renderVersions(septemberRange);
    await waitFor(() => expect(container.querySelectorAll("path.recharts-line-curve")).toHaveLength(5));

    await user.click(screen.getByRole("combobox", { name: "Version" }));
    const listbox = await screen.findByRole("listbox");
    // By downloads, highest first, as the table lists them.
    const options = within(listbox).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "IS 1.5",
      "IS 1.0",
      "IS 1.1",
      "IS 1.2",
      "IS 1.3",
      "IS 1.4",
    ]);
    expect(within(options[0]).getByRole("checkbox")).toBeChecked();
    expect(within(options[1]).getByRole("checkbox")).not.toBeChecked();

    // Unchecking every chosen Version leaves an empty selection: every Version.
    for (const name of ["IS 1.5", "IS 1.1", "IS 1.2", "IS 1.3", "IS 1.4"]) {
      await user.click(within(listbox).getByRole("option", { name }));
    }
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    expect(screen.getByRole("combobox", { name: "Version" })).toHaveTextContent("All versions");
    await waitFor(() => expect(container.querySelectorAll("path.recharts-line-curve")).toHaveLength(6));
    expect(legendOf(container)).toContain("IS 1.0");

    // One chosen Version reads as its Tag.
    await choose(user, "Version", "IS 1.5");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    expect(screen.getByRole("combobox", { name: "Version" })).toHaveTextContent("v1.5");
    await waitFor(() => expect(container.querySelectorAll("path.recharts-line-curve")).toHaveLength(1));
    expect(legendOf(container)).toEqual(["IS 1.5"]);

    // The table is never narrowed by the chart's selection.
    expect(rowsOf(card("Versions"))).toHaveLength(6);
  });

  it("keeps v1.10 ahead of v1.9 when choosing the five most recent Versions", async () => {
    connected();
    stubApi({
      series: () =>
        json({
          series: ["v1.6", "v1.7", "v1.8", "v1.9", "v1.10", "v1.11"].map((tag) => ({
            releaseTag: tag,
            releaseName: `IS ${tag.slice(1)}`,
            points: [
              { date: "2026-09-27", value: 1 },
              { date: "2026-09-28", value: 1 },
            ],
          })),
        }),
    });

    const { container } = renderVersions(septemberRange);

    await waitFor(() => expect(container.querySelectorAll("path.recharts-line-curve")).toHaveLength(5));
    expect(legendOf(container)).toEqual(["IS 1.10", "IS 1.11", "IS 1.7", "IS 1.8", "IS 1.9"]);
  });

  it("draws Daily as lines and switches to bars from the toggle", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    const { container } = renderVersions(septemberRange);

    await waitFor(() => expect(container.querySelectorAll("path.recharts-line-curve")).toHaveLength(5));
    expect(container.querySelector(".recharts-bar")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Bar chart" }));

    expect(container.querySelectorAll(".recharts-bar")).toHaveLength(5);
    expect(container.querySelector("path.recharts-line-curve")).toBeNull();
  });

  it("draws Monthly as bars with no toggle", async () => {
    connected();
    stubApi();

    const { container } = renderVersions(`${septemberRange}&interval=month`);

    await waitFor(() => expect(container.querySelectorAll(".recharts-bar")).toHaveLength(5));
    expect(container.querySelector("path.recharts-line-curve")).toBeNull();
    expect(screen.queryByRole("button", { name: "Bar chart" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Line chart" })).not.toBeInTheDocument();
  });

  it("draws Cumulative as lines with the toggle", async () => {
    connected();
    stubApi();

    const { container } = renderVersions(`${septemberRange}&interval=cumulative`);

    await waitFor(() => expect(container.querySelectorAll("path.recharts-line-curve")).toHaveLength(5));
    expect(screen.getByRole("button", { name: "Line chart" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Bar chart" })).toBeInTheDocument();
  });
});

describe("Versions table", () => {
  it("lists every Version by downloads, highest first, with its Tag in monospace, compact downloads and a one-decimal share", async () => {
    connected();
    stubApi();

    renderVersions(septemberRange);

    await screen.findByRole("columnheader", { name: "Tag" });
    const table = card("Versions");
    expect(headersOf(table)).toEqual(["Version", "Tag", "Downloads", "Share"]);
    expect(rowsOf(table)).toEqual([
      ["IS 1.5", "v1.5", "50", "50.0%"],
      ["IS 1.0", "v1.0", "10", "10.0%"],
      ["IS 1.1", "v1.1", "10", "10.0%"],
      ["IS 1.2", "v1.2", "10", "10.0%"],
      ["IS 1.3", "v1.3", "10", "10.0%"],
      ["IS 1.4", "v1.4", "10", "10.0%"],
    ]);
    expect(within(table).getByText("v1.5")).toHaveStyle("font-family: monospace");
    expect(within(table).getByText("1–6 of 6")).toBeInTheDocument();
  });

  it("explains that Share is of every Version in the range", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    renderVersions(septemberRange);

    await screen.findByRole("columnheader", { name: "Tag" });
    await user.hover(within(card("Versions")).getByText("Share"));
    expect(
      await screen.findByText(
        "Percentage of total downloads across all displayed versions in the selected date range",
      ),
    ).toBeInTheDocument();
  });

  it("finds a Version by name or Tag from the magnifier in the Version header, keeps its share of the whole, and clears the search", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    renderVersions(septemberRange);

    await screen.findByRole("columnheader", { name: "Tag" });
    const table = card("Versions");
    expect(within(table).queryByRole("textbox")).not.toBeInTheDocument();

    await user.click(within(table).getByRole("button", { name: "Filter by version" }));
    const field = within(table).getByRole("textbox", { name: "Filter versions" });
    expect(field).toHaveAttribute("placeholder", "Filter…");
    expect(field).toHaveFocus();

    await user.type(field, "1.5");
    expect(rowsOf(table)).toEqual([["IS 1.5", "v1.5", "50", "50.0%"]]);
    expect(within(table).getByText("1–1 of 1")).toBeInTheDocument();

    await user.clear(field);
    await user.type(field, "V1.0");
    expect(rowsOf(table)).toEqual([["IS 1.0", "v1.0", "10", "10.0%"]]);

    await user.click(within(table).getByRole("button", { name: "Clear version filter" }));
    expect(rowsOf(table)).toHaveLength(6);
    expect(within(table).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(table).getByRole("button", { name: "Filter by version" })).toBeInTheDocument();
  });

  it("says when no Version matches the search, and clears it with Escape", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    renderVersions(septemberRange);

    await screen.findByRole("columnheader", { name: "Tag" });
    const table = card("Versions");
    await user.click(within(table).getByRole("button", { name: "Filter by version" }));
    await user.type(within(table).getByRole("textbox", { name: "Filter versions" }), "zzz");

    expect(within(table).getByText("No versions match your search")).toBeInTheDocument();
    // The header stays, so the search can be changed.
    expect(headersOf(table)).toEqual(["Version", "Tag", "Downloads", "Share"]);

    await user.keyboard("{Escape}");

    expect(within(table).queryByText("No versions match your search")).not.toBeInTheDocument();
    expect(rowsOf(table)).toHaveLength(6);
    expect(within(table).queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("sums a Version's Cumulative points as its total, and shares on those sums", async () => {
    connected();
    stubApi({
      series: () =>
        json({
          series: [
            {
              releaseTag: "v1.0",
              releaseName: "IS 1.0",
              points: [
                { date: "2026-09-01", value: 10 },
                { date: "2026-09-02", value: 20 },
              ],
            },
            {
              releaseTag: "v1.1",
              releaseName: "IS 1.1",
              points: [
                { date: "2026-09-01", value: 5 },
                { date: "2026-09-02", value: 5 },
              ],
            },
          ],
        }),
    });

    renderVersions(`${septemberRange}&interval=cumulative`);

    await screen.findByRole("columnheader", { name: "Tag" });
    expect(rowsOf(card("Versions"))).toEqual([
      ["IS 1.0", "v1.0", "30", "75.0%"],
      ["IS 1.1", "v1.1", "10", "25.0%"],
    ]);
  });

  it("pages the Versions ten at a time with first, next and last buttons and the rows-per-page choices", async () => {
    connected();
    stubApi({ series: () => json(twelveVersions) });
    const user = userEvent.setup();

    renderVersions(septemberRange);

    await screen.findByRole("columnheader", { name: "Tag" });
    const table = card("Versions");
    expect(rowsOf(table)).toHaveLength(10);
    expect(rowsOf(table)[0]).toEqual(["IS 2.12", "v2.12", "120", "15.4%"]);
    expect(rowsOf(table)[9][0]).toBe("IS 2.3");
    expect(within(table).getByText("1–10 of 12")).toBeInTheDocument();

    await user.click(within(table).getByRole("button", { name: /go to next page/i }));
    expect(rowsOf(table).map((row) => row[0])).toEqual(["IS 2.2", "IS 2.1"]);

    await user.click(within(table).getByRole("button", { name: /go to first page/i }));
    expect(rowsOf(table)[0][0]).toBe("IS 2.12");
    await user.click(within(table).getByRole("button", { name: /go to last page/i }));
    expect(rowsOf(table)[0][0]).toBe("IS 2.2");

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

/** A Version's row in the Versions table, as the button it is. */
function versionRow(name: string): HTMLElement {
  return within(card("Versions")).getByRole("button", { name: new RegExp(`^${name}\\b`) });
}

describe("Assets panel", () => {
  it("opens on the Version with the most downloads, highlighting its row, and lists its Assets with their sizes", async () => {
    connected();
    const fetchMock = stubApi();

    renderVersions(septemberRange);

    expect(await screen.findByRole("button", { name: "v1.5" })).toBeInTheDocument();
    await screen.findByRole("columnheader", { name: "Asset" });
    const assets = card("Assets");
    expect(headersOf(assets)).toEqual(["Asset", "Size", "Downloads"]);
    expect(rowsOf(assets)).toEqual([
      ["wso2is-1.5.zip", "459.4 MB", "7"],
      ["wso2is-1.5.zip.sha1", "—", "2"],
    ]);
    expect(within(assets).getByText("1–2 of 2")).toBeInTheDocument();

    expect(versionRow("IS 1.5")).toHaveAttribute("aria-pressed", "true");
    expect(versionRow("IS 1.0")).toHaveAttribute("aria-pressed", "false");

    // One request, for that Version alone: never one for the previous Product's, or for none.
    const requested = requestsTo(fetchMock, "/stats/assets/");
    expect(requested).toHaveLength(1);
    expect(requested[0].pathname).toBe("/api/v1/stats/assets/3");
    expect(requested[0].searchParams.get("version")).toBe("v1.5");
    expect(requested[0].searchParams.get("from")).toBe("2026-09-01");
    expect(requested[0].searchParams.get("to")).toBe("2026-09-30");
  });

  it("clears the Version when its row is clicked again, showing the hint and every Asset, and picks another from its row", async () => {
    connected();
    const fetchMock = stubApi();
    const user = userEvent.setup();

    renderVersions(septemberRange);

    await screen.findByRole("button", { name: "v1.5" });
    const assets = card("Assets");

    await user.click(versionRow("IS 1.5"));

    expect(within(assets).queryByRole("button", { name: "v1.5" })).not.toBeInTheDocument();
    expect(versionRow("IS 1.5")).toHaveAttribute("aria-pressed", "false");
    await waitFor(() => expect(rowsOf(assets)).toHaveLength(3));
    expect(requestsTo(fetchMock, "/stats/assets/").at(-1)?.searchParams.has("version")).toBe(false);
    await user.hover(assets.querySelector("svg.lucide-info") as Element);
    expect(await screen.findByText("Click a version row to see its assets")).toBeInTheDocument();

    await user.click(versionRow("IS 1.0"));

    expect(await within(assets).findByRole("button", { name: "v1.0" })).toBeInTheDocument();
    expect(versionRow("IS 1.0")).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(rowsOf(assets)).toEqual([["wso2is-1.0.zip", "1 KB", "1"]]));
  });

  it("picks and clears a Version with Enter and Space on its row", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    renderVersions(septemberRange);

    await screen.findByRole("button", { name: "v1.5" });
    const assets = card("Assets");

    versionRow("IS 1.0").focus();
    await user.keyboard("{Enter}");
    expect(await within(assets).findByRole("button", { name: "v1.0" })).toBeInTheDocument();
    expect(versionRow("IS 1.0")).toHaveAttribute("aria-pressed", "true");

    await user.keyboard(" ");
    expect(within(assets).queryByRole("button", { name: "v1.0" })).not.toBeInTheDocument();
    expect(versionRow("IS 1.0")).toHaveAttribute("aria-pressed", "false");
  });

  it("clears the Version from its chip", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    renderVersions(septemberRange);

    const chip = await screen.findByRole("button", { name: "v1.5" });
    const assets = card("Assets");
    await user.click(within(chip).getByTestId("CancelIcon"));

    expect(within(assets).queryByRole("button", { name: "v1.5" })).not.toBeInTheDocument();
    expect(assets.querySelector("svg.lucide-info")).not.toBeNull();
    expect(versionRow("IS 1.5")).toHaveAttribute("aria-pressed", "false");
  });

  it("says No asset data when the Version has none", async () => {
    connected();
    stubApi({ assets: () => json({ assets: [] }) });

    renderVersions(septemberRange);

    expect(await screen.findByText("No asset data")).toBeInTheDocument();
    const assets = card("Assets");
    expect(within(assets).getByRole("button", { name: "v1.5" })).toBeInTheDocument();
    expect(within(assets).queryByRole("columnheader")).not.toBeInTheDocument();
  });

  it("pages the Assets ten at a time with the rows-per-page choices", async () => {
    connected();
    stubApi({ assets: () => json({ assets: twelveAssets }) });
    const user = userEvent.setup();

    renderVersions(septemberRange);

    await screen.findByRole("columnheader", { name: "Asset" });
    const assets = card("Assets");
    expect(rowsOf(assets)).toHaveLength(10);
    expect(rowsOf(assets)[0]).toEqual(["asset-01.zip", "1 KB", "1"]);
    expect(within(assets).getByText("1–10 of 12")).toBeInTheDocument();

    await user.click(within(assets).getByRole("button", { name: /go to next page/i }));
    expect(rowsOf(assets).map((row) => row[0])).toEqual(["asset-11.zip", "asset-12.zip"]);
    expect(rowsOf(assets)[1][1]).toBe("12 KB");

    await user.click(within(assets).getByRole("combobox", { name: /rows per page/i }));
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "10",
      "25",
      "50",
      "100",
    ]);
    await user.click(within(listbox).getByRole("option", { name: "25" }));
    expect(rowsOf(assets)).toHaveLength(12);
  });

  it("starts over on a Product change: the search is forgotten and the new Product's top Version is picked", async () => {
    connected();
    const fetchMock = stubApi({
      series: (url) => json(url.pathname.includes("/versions/1/") ? apimVersions : sixVersions),
      assets: (url) =>
        url.pathname.endsWith("/assets/1")
          ? json({
              assets: [
                { releaseTag: "v4.0.0", assetName: "wso2am-4.0.0.zip", assetSize: 2048, downloadCount: 9 },
              ],
            })
          : assetsFor(url),
    });
    const user = userEvent.setup();

    renderVersions(`${septemberRange}&repo=3`);

    await screen.findByRole("button", { name: "v1.5" });
    await user.click(within(card("Versions")).getByRole("button", { name: "Filter by version" }));
    await user.type(within(card("Versions")).getByRole("textbox", { name: "Filter versions" }), "1.5");
    expect(rowsOf(card("Versions"))).toHaveLength(1);

    await choose(user, "Product", "API Manager");

    // The cards start over for the new Product, so they are looked up afresh.
    expect(await screen.findByRole("button", { name: "v4.0.0" })).toBeInTheDocument();
    const versions = card("Versions");
    const assets = card("Assets");
    await waitFor(() =>
      expect(rowsOf(versions)).toEqual([
        ["APIM 4.0.0", "v4.0.0", "9", "90.0%"],
        ["APIM 3.0.0", "v3.0.0", "1", "10.0%"],
      ]),
    );
    expect(within(versions).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(versions).getByRole("button", { name: "Filter by version" })).toBeInTheDocument();
    expect(versionRow("APIM 4.0.0")).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(rowsOf(assets)).toEqual([["wso2am-4.0.0.zip", "2 KB", "9"]]));
    expect(screen.getByRole("combobox", { name: "Version" })).toHaveTextContent("2 versions");

    // The new Product's Assets were asked for once, for its top Version — never for the old Product's.
    const forApim = requestsTo(fetchMock, "/stats/assets/1");
    expect(forApim).toHaveLength(1);
    expect(forApim[0].searchParams.get("version")).toBe("v4.0.0");
  });
});

describe("Versions states", () => {
  it("shows a skeleton in the chart card and skeleton rows in both cards while the Product is resolved and the series loads", async () => {
    connected();
    stubApi({ repositories: pending });

    const { container } = renderVersions(septemberRange);

    expect(await screen.findByRole("heading", { name: "Downloads by version" })).toBeInTheDocument();
    expect(card("Versions").querySelectorAll(".MuiSkeleton-root")).toHaveLength(5);
    expect(card("Assets").querySelectorAll(".MuiSkeleton-root")).toHaveLength(5);
    expect(container.querySelectorAll(".MuiSkeleton-root")).toHaveLength(11);
    expect(screen.queryByText(/No release data/)).not.toBeInTheDocument();
    expect(screen.queryByText("No versions found")).not.toBeInTheDocument();
    expect(screen.queryByText("No asset data")).not.toBeInTheDocument();
  });

  it("keeps the Assets skeleton while the Versions load, as the Version to open on is not yet known", async () => {
    connected();
    const fetchMock = stubApi({ series: pending });

    renderVersions(septemberRange);

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("repo=3"));
    expect(card("Versions").querySelectorAll(".MuiSkeleton-root")).toHaveLength(5);
    expect(card("Assets").querySelectorAll(".MuiSkeleton-root")).toHaveLength(5);
    expect(requestsTo(fetchMock, "/stats/assets/")).toHaveLength(0);
  });

  it("says there is no release data, no versions and no asset data when the Product has no Versions in the range", async () => {
    connected();
    stubApi({ series: () => json({ series: [] }), assets: () => json({ assets: [] }) });

    renderVersions(septemberRange);

    expect(await screen.findByText("No release data for this product / range")).toBeInTheDocument();
    expect(within(card("Versions")).getByText("No versions found")).toBeInTheDocument();
    expect(await within(card("Assets")).findByText("No asset data")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Version" })).toHaveTextContent("All versions");
    expect(card("Assets").querySelector("svg.lucide-info")).not.toBeNull();
  });

  it("shows the server's message with Retry in the chart and the Versions card when the series fails, and recovers on Retry", async () => {
    connected();
    let answers = 0;
    const fetchMock = stubApi({
      series: () =>
        answers++ === 0 ? json({ message: "Versions are being rebuilt." }, 500) : json(sixVersions),
    });
    const user = userEvent.setup();

    renderVersions(septemberRange);

    expect(await screen.findAllByText("Something went wrong")).toHaveLength(2);
    expect(screen.getAllByText("Versions are being rebuilt.")).toHaveLength(2);
    expect(within(card("Versions")).getByText("Something went wrong")).toBeInTheDocument();
    // The Assets wait on the Versions for the one to open on.
    expect(card("Assets").querySelectorAll(".MuiSkeleton-root")).toHaveLength(5);

    await user.click(within(card("Versions")).getByRole("button", { name: "Retry" }));

    await screen.findByRole("columnheader", { name: "Tag" });
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    expect(await within(card("Assets")).findByRole("button", { name: "v1.5" })).toBeInTheDocument();
    expect(requestsTo(fetchMock, "/stats/versions/")).toHaveLength(2);
  });

  it("shows the server's message with Retry in the Assets card alone when the Assets fail", async () => {
    connected();
    let answers = 0;
    stubApi({
      assets: (url) => (answers++ === 0 ? json({ message: "Assets are being counted." }, 500) : assetsFor(url)),
    });
    const user = userEvent.setup();

    renderVersions(septemberRange);

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    const assets = card("Assets");
    expect(within(assets).getByText("Assets are being counted.")).toBeInTheDocument();
    expect(screen.getAllByText("Something went wrong")).toHaveLength(1);
    expect(rowsOf(card("Versions"))).toHaveLength(6);

    await user.click(within(assets).getByRole("button", { name: "Retry" }));

    await within(assets).findByRole("columnheader", { name: "Asset" });
    expect(rowsOf(assets)).toHaveLength(2);
  });

  it("shows an error with Retry instead of the chart and the cards when the Products fail, and recovers", async () => {
    connected();
    let answers = 0;
    stubApi({
      repositories: () =>
        answers++ === 0 ? json({ message: "Products are unavailable." }, 503) : json(repositoriesBody),
    });
    const user = userEvent.setup();

    renderVersions(septemberRange);

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Products are unavailable.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Downloads by version" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Assets" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("heading", { name: "Downloads by version" })).toBeInTheDocument();
    expect(await within(card("Assets")).findByRole("button", { name: "v1.5" })).toBeInTheDocument();
  });

  it("says when no Products are tracked", async () => {
    connected();
    const fetchMock = stubApi({ repositories: () => json({ repositories: [] }) });

    renderVersions(septemberRange);

    expect(await screen.findByText("No products are tracked")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Downloads by version" })).not.toBeInTheDocument();
    expect(requestsTo(fetchMock, "/stats/")).toHaveLength(0);
  });

  it("says From is after To instead of the chart and the cards, and asks for nothing", async () => {
    connected();
    const fetchMock = stubApi({ series: () => json({ message: "no" }, 500) });

    renderVersions(`${versionsPath}?from=2026-09-10&to=2026-09-01&repo=3`);

    expect(await screen.findByText("From is after To.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Product" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Downloads by version" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Assets" })).not.toBeInTheDocument();
    await waitFor(() => expect(requestsTo(fetchMock, "/repositories")).toHaveLength(1));
    expect(requestsTo(fetchMock, "/stats/")).toHaveLength(0);
  });
});
