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
import EngineeringDownloadsPage from "./EngineeringDownloadsPage";
import EngineeringOverviewPage from "./EngineeringOverviewPage";

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

const downloadsPath = downloadStatsPaths.downloads;

function renderDownloads(path: string = downloadsPath) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Where />
        <Routes>
          <Route path={downloadsPath} element={<EngineeringDownloadsPage />} />
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

const repositoriesBody = {
  repositories: [
    { id: 1, repoName: "product-apim", productName: "API Manager", isActive: true },
    { id: 2, repoName: "product-is", productName: "Identity Server", isActive: true },
    { id: 3, repoName: "product-observability", productName: "Observability", isActive: true },
    { id: 9, repoName: "old", productName: "Retired", isActive: false },
  ],
};

// Two Products over three June days. The per-day totals are 40, 85 and 1,500,
// so the period reads: total 1,625, average 542, highest 29 Jun, lowest 27 Jun.
const juneDaily = {
  series: [
    {
      repoId: 1,
      repoName: "product-apim",
      points: [
        { date: "2026-06-27", value: 40 },
        { date: "2026-06-28", value: 60 },
      ],
    },
    {
      repoId: 2,
      repoName: "product-is",
      points: [
        { date: "2026-06-28", value: 25 },
        { date: "2026-06-29", value: 1500 },
      ],
    },
  ],
};

// The per-month totals are 1,601, 1,900 and 2,001: total 5,502, average 1,834.
const monthly = {
  series: [
    {
      repoId: 1,
      repoName: "product-apim",
      points: [
        { date: "2025-01", value: 1600 },
        { date: "2025-02", value: 1900 },
        { date: "2025-03", value: 2000 },
      ],
    },
    {
      repoId: 3,
      repoName: "product-observability",
      points: [
        { date: "2025-01", value: 1 },
        { date: "2025-02", value: 0 },
        { date: "2025-03", value: 1 },
      ],
    },
  ],
};

const cumulative = {
  series: [
    {
      repoId: 1,
      repoName: "product-apim",
      points: [
        { date: "2026-06-28", value: 900 },
        { date: "2026-06-29", value: 940 },
      ],
    },
  ],
};

// One Product over twelve days, so the table has a second page.
const twelveDays = {
  series: [
    {
      repoId: 1,
      repoName: "product-apim",
      points: Array.from({ length: 12 }, (_, i) => ({
        date: `2026-06-${String(i + 1).padStart(2, "0")}`,
        value: i + 1,
      })),
    },
  ],
};

type Answer = (url: URL) => Response | Promise<Response>;
type Answers = { repositories?: Answer; daily?: Answer; total?: Answer };

/** The requests the screen makes: the Products, and the daily or the total series. */
function stubApi(answers: Answers = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    const parsed = new URL(url);
    if (url.startsWith("https://stats.example/api/v1/repositories")) {
      return (answers.repositories ?? (() => json(repositoriesBody)))(parsed);
    }
    if (url.startsWith("https://stats.example/api/v1/stats/daily")) {
      return (answers.daily ?? (() => json(juneDaily)))(parsed);
    }
    if (url.startsWith("https://stats.example/api/v1/stats/total")) {
      return (answers.total ?? (() => json(cumulative)))(parsed);
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

const juneRange = `${downloadsPath}?from=2026-06-01&to=2026-06-30`;

async function chooseView(user: ReturnType<typeof userEvent.setup>, label: string): Promise<void> {
  await user.click(screen.getByRole("combobox", { name: "View" }));
  await user.click(await screen.findByRole("option", { name: label }));
}

describe("Downloads filter bar", () => {
  it("shows the product picker beside a Filters button that folds From, To and View away", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    renderDownloads(juneRange);

    expect(await screen.findByRole("tab", { name: "Downloads", selected: true })).toBeInTheDocument();
    const picker = screen.getByRole("combobox", { name: "Repositories" });
    expect(picker).toHaveAttribute("placeholder", "All repositories");
    expect(screen.getByLabelText("From")).toHaveValue("2026-06-01");
    expect(screen.getByLabelText("To")).toHaveValue("2026-06-30");
    expect(screen.getByRole("combobox", { name: "View" })).toHaveTextContent("Daily");

    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.queryByLabelText("From")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("To")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "View" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Repositories" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByLabelText("From")).toHaveValue("2026-06-01");
    expect(screen.getByRole("combobox", { name: "View" })).toBeInTheDocument();
  });

  it("offers Daily, Monthly and Cumulative as the View", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    renderDownloads(juneRange);

    await user.click(await screen.findByRole("combobox", { name: "View" }));
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Daily",
      "Monthly",
      "Cumulative",
    ]);
  });

  it("narrows the request to a Product picked from the picker and keeps it in the address", async () => {
    connected();
    const fetchMock = stubApi();
    const user = userEvent.setup();

    renderDownloads(juneRange);

    await user.click(await screen.findByRole("combobox", { name: "Repositories" }));
    await user.click(await screen.findByRole("option", { name: "Identity Server" }));

    expect(screen.getByTestId("where")).toHaveTextContent("repos=2");
    expect(screen.getByRole("button", { name: "Identity Server" })).toBeInTheDocument();
    await waitFor(() =>
      expect(requestsTo(fetchMock, "/stats/daily").at(-1)?.searchParams.get("repos")).toBe("2"),
    );
  });

  it("opens on the last 30 days in UTC, Daily, every Product, and asks the daily endpoint so", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-30T12:00:00.000Z"));
    connected();
    const fetchMock = stubApi();

    renderDownloads();

    expect(await screen.findByRole("tab", { name: "Downloads", selected: true })).toBeInTheDocument();
    expect(screen.getByLabelText("From")).toHaveValue("2026-05-31");
    expect(screen.getByLabelText("To")).toHaveValue("2026-06-30");
    expect(screen.getByRole("combobox", { name: "View" })).toHaveTextContent("Daily");
    expect(screen.getByRole("combobox", { name: "Repositories" })).toHaveAttribute(
      "placeholder",
      "All repositories",
    );
    // The chart names each Product, never a retired one.
    expect((await screen.findAllByText("Identity Server")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Retired")).not.toBeInTheDocument();

    const [requested] = requestsTo(fetchMock, "/stats/daily");
    expect(requested.searchParams.get("interval")).toBe("day");
    expect(requested.searchParams.get("from")).toBe("2026-05-31");
    expect(requested.searchParams.get("to")).toBe("2026-06-30");
    expect(requested.searchParams.get("repos")).toBeNull();
  });

  it("writes a changed View into the address together with the default dates", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-30T12:00:00.000Z"));
    connected();
    const fetchMock = stubApi({ daily: () => json(monthly) });
    const user = userEvent.setup();

    renderDownloads();
    expect(await screen.findByRole("combobox", { name: "View" })).toBeInTheDocument();

    await chooseView(user, "Monthly");

    const where = screen.getByTestId("where");
    expect(where).toHaveTextContent("interval=month");
    expect(where).toHaveTextContent("from=2026-05-31");
    expect(where).toHaveTextContent("to=2026-06-30");
    await waitFor(() =>
      expect(requestsTo(fetchMock, "/stats/daily").at(-1)?.searchParams.get("interval")).toBe("month"),
    );
  });

  it("keeps a changed date range in the address", async () => {
    connected();
    stubApi();
    renderDownloads();
    expect(await screen.findByLabelText("To")).toBeInTheDocument();
    const displayedTo = (screen.getByLabelText("To") as HTMLInputElement).value;
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-01-01" } });
    const where = await screen.findByTestId("where");
    expect(where).toHaveTextContent("from=2026-01-01");
    expect(where).toHaveTextContent(`to=${displayedTo}`);
  });

  it("keeps the current date when the field is cleared", async () => {
    connected();
    stubApi();
    renderDownloads(`${downloadsPath}?from=2026-01-01&to=2026-01-15`);
    expect(await screen.findByLabelText("From")).toHaveValue("2026-01-01");
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "" } });
    expect(screen.getByTestId("where")).toHaveTextContent("from=2026-01-01");
    expect(screen.getByLabelText("From")).toHaveValue("2026-01-01");
  });

  it("says From is after To, instead of the chart and the table, and asks for nothing", async () => {
    connected();
    const fetchMock = stubApi({ daily: () => json({ message: "no" }, 500) });
    renderDownloads(`${downloadsPath}?from=2026-09-10&to=2026-09-01`);
    expect(await screen.findByText("From is after To.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /downloads by product/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /downloads table/ })).not.toBeInTheDocument();
    expect(requestsTo(fetchMock, "/stats/")).toHaveLength(0);
  });

  it("limits the request to the Products in the address", async () => {
    connected();
    const fetchMock = stubApi({ daily: () => json({ series: [] }) });
    renderDownloads(`${downloadsPath}?repos=1`);
    expect(await screen.findByText("No data for the selected range")).toBeInTheDocument();
    expect(requestsTo(fetchMock, "/stats/daily")[0].searchParams.get("repos")).toBe("1");
  });
});

describe("Downloads chart card", () => {
  it.each([
    ["day", "Daily downloads by product"],
    ["month", "Monthly downloads by product"],
    ["cumulative", "Cumulative downloads by product"],
  ])("is titled by the %s interval with its subtitle", async (interval, title) => {
    connected();
    stubApi({ daily: () => json(interval === "month" ? monthly : juneDaily) });

    renderDownloads(`${juneRange}&interval=${interval}`);

    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByText("Downloads across the selected products and range")).toBeInTheDocument();
  });

  it("draws Daily as lines with short dates, offers the line/bar toggle and keeps bars in the address", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    const { container } = renderDownloads(juneRange);

    await waitFor(() => expect(container.querySelectorAll("path.recharts-line-curve")).toHaveLength(2));
    expect(container.querySelector(".recharts-bar")).toBeNull();
    expect(screen.getByText("Jun 27")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Line chart" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Bar chart" }));

    expect(screen.getByTestId("where")).toHaveTextContent("chart=bar");
    expect(container.querySelectorAll(".recharts-bar")).toHaveLength(2);
    expect(container.querySelector("path.recharts-line-curve")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Line chart" }));

    expect(screen.getByTestId("where")).not.toHaveTextContent("chart=");
    expect(container.querySelectorAll("path.recharts-line-curve")).toHaveLength(2);
  });

  it("opens with bars when the address says so", async () => {
    connected();
    stubApi();

    const { container } = renderDownloads(`${juneRange}&chart=bar`);

    await waitFor(() => expect(container.querySelectorAll(".recharts-bar")).toHaveLength(2));
    expect(screen.getByRole("button", { name: "Bar chart" })).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelector("path.recharts-line-curve")).toBeNull();
  });

  it("forgets the chart type when the View changes, and draws Monthly as bars with no toggle", async () => {
    connected();
    stubApi({ daily: () => json(monthly) });
    const user = userEvent.setup();

    const { container } = renderDownloads(`${juneRange}&chart=bar`);
    expect(await screen.findByRole("button", { name: "Bar chart" })).toBeInTheDocument();

    await chooseView(user, "Monthly");

    const where = screen.getByTestId("where");
    expect(where).toHaveTextContent("interval=month");
    expect(where).not.toHaveTextContent("chart=");
    expect(screen.queryByRole("button", { name: "Bar chart" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Line chart" })).not.toBeInTheDocument();
    await waitFor(() => expect(container.querySelectorAll(".recharts-bar")).toHaveLength(2));
    expect(container.querySelector("path.recharts-line-curve")).toBeNull();
    expect(screen.getAllByText("Observability").length).toBeGreaterThan(0);
    expect(screen.getByText("Jan 1")).toBeInTheDocument();
  });

  it("draws Cumulative as lines from the total endpoint, with no toggle", async () => {
    connected();
    const fetchMock = stubApi();

    const { container } = renderDownloads(`${juneRange}&interval=cumulative`);

    await waitFor(() => expect(container.querySelectorAll("path.recharts-line-curve")).toHaveLength(1));
    expect(screen.queryByRole("button", { name: "Line chart" })).not.toBeInTheDocument();
    expect(requestsTo(fetchMock, "/stats/total")).toHaveLength(1);
    expect(requestsTo(fetchMock, "/stats/daily")).toHaveLength(0);
  });
});

/** The card a tile's label sits in, as the reader sees it. */
function tile(label: string): HTMLElement {
  const card = screen.getByText(label).closest(".MuiCard-root");
  if (!card) throw new Error(`No tile labelled ${label}`);
  return card as HTMLElement;
}

/** The table card, found by its title. */
function tableCard(title: string): HTMLElement {
  return screen.getByRole("heading", { name: title }).parentElement as HTMLElement;
}

function rowsOf(card: HTMLElement): string[][] {
  const [, ...rows] = within(card).getAllByRole("row");
  return rows.map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent ?? ""));
}

describe("Downloads period tiles", () => {
  it("shows four tiles for Daily, read from the day totals across the Products", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    renderDownloads(juneRange);

    expect(await screen.findByText("Average Downloads")).toBeInTheDocument();
    expect(within(tile("Average Downloads")).getByText("542")).toBeInTheDocument();
    expect(within(tile("Highest Day (29 Jun 2026)")).getByText("1.5K")).toBeInTheDocument();
    expect(within(tile("Lowest Day (27 Jun 2026)")).getByText("40")).toBeInTheDocument();
    expect(within(tile("Period Total (01 Jun 2026 – 30 Jun 2026)")).getByText("1.6K")).toBeInTheDocument();

    const info = tile("Average Downloads").querySelector("svg.lucide-info");
    expect(info).not.toBeNull();
    await user.hover(info as Element);
    expect(
      await screen.findByText(
        "Average downloads per day across all selected products in the selected date range",
      ),
    ).toBeInTheDocument();
  });

  it("names months on the Monthly tiles and explains the average per month", async () => {
    connected();
    stubApi({ daily: () => json(monthly) });
    const user = userEvent.setup();

    renderDownloads(`${downloadsPath}?from=2025-01-01&to=2025-04-30&interval=month`);

    expect(await screen.findByText("Average Downloads")).toBeInTheDocument();
    expect(within(tile("Average Downloads")).getByText("1.8K")).toBeInTheDocument();
    expect(within(tile("Highest Month (Mar 2025)")).getByText("2K")).toBeInTheDocument();
    expect(within(tile("Lowest Month (Jan 2025)")).getByText("1.6K")).toBeInTheDocument();
    expect(within(tile("Period Total (Jan 2025 – Apr 2025)")).getByText("5.5K")).toBeInTheDocument();

    await user.hover(tile("Average Downloads").querySelector("svg.lucide-info") as Element);
    expect(
      await screen.findByText(
        "Average downloads per month across all selected products in the selected date range",
      ),
    ).toBeInTheDocument();
  });

  it("shows no tiles for Cumulative", async () => {
    connected();
    stubApi();

    renderDownloads(`${juneRange}&interval=cumulative`);

    expect((await screen.findAllByText("940")).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Cumulative downloads table" })).toBeInTheDocument();
    expect(screen.queryByText("Average Downloads")).not.toBeInTheDocument();
    expect(screen.queryByText(/Period Total/)).not.toBeInTheDocument();
  });
});

describe("Downloads table", () => {
  it("lays Daily out as one row per date, newest first, a column per Product and a bold Total", async () => {
    connected();
    stubApi();

    renderDownloads(juneRange);

    await screen.findByRole("columnheader", { name: "Total" });
    const card = tableCard("Daily downloads table");
    expect(within(card).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Date",
      "API Manager",
      "Identity Server",
      "Total",
    ]);
    expect(within(card).getByRole("columnheader", { name: "Total" }).querySelector("strong")).not.toBeNull();
    expect(rowsOf(card)).toEqual([
      ["29 Jun 2026", "0", "1.5K", "1.5K"],
      ["28 Jun 2026", "60", "25", "85"],
      ["27 Jun 2026", "40", "0", "40"],
    ]);
    // The Total column is bold in every row, the figures are not.
    const [, firstRow] = within(card).getAllByRole("row");
    const cells = within(firstRow).getAllByRole("cell");
    expect(cells[3].querySelector("strong")).toHaveTextContent("1.5K");
    expect(cells[2].querySelector("strong")).toBeNull();
  });

  it("writes months as the API labels them in the Monthly table", async () => {
    connected();
    stubApi({ daily: () => json(monthly) });

    renderDownloads(`${downloadsPath}?from=2025-01-01&to=2025-04-30&interval=month`);

    await screen.findByRole("columnheader", { name: "Total" });
    const card = tableCard("Monthly downloads table");
    expect(within(card).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Date",
      "API Manager",
      "Observability",
      "Total",
    ]);
    expect(rowsOf(card)).toEqual([
      ["2025-03", "2K", "1", "2K"],
      ["2025-02", "1.9K", "0", "1.9K"],
      ["2025-01", "1.6K", "1", "1.6K"],
    ]);
  });

  it("writes the Cumulative table's dates as calendar days", async () => {
    connected();
    stubApi();

    renderDownloads(`${juneRange}&interval=cumulative`);

    await screen.findByRole("columnheader", { name: "Total" });
    const card = tableCard("Cumulative downloads table");
    expect(rowsOf(card)).toEqual([
      ["29 Jun 2026", "940", "940"],
      ["28 Jun 2026", "900", "900"],
    ]);
  });
});

describe("Downloads table's date filter", () => {
  let showPicker: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // jsdom has no native picker to open; the hidden input is driven by
    // setting its value, as a person's pick would.
    showPicker = vi.fn();
    HTMLInputElement.prototype.showPicker = showPicker as unknown as () => void;
  });

  it("filters the rows to one day from the Date header's calendar and clears it from the chip", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    renderDownloads(juneRange);

    await screen.findByRole("columnheader", { name: /Total/ });
    const card = tableCard("Daily downloads table");
    await user.click(within(card).getByRole("button", { name: "Filter by date" }));
    expect(showPicker).toHaveBeenCalledTimes(1);

    const picker = card.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(picker, { target: { value: "2026-06-28" } });

    expect(rowsOf(card)).toEqual([["28 Jun 2026", "60", "25", "85"]]);
    const chip = within(card).getByRole("button", { name: "28 Jun 2026" });
    expect(within(card).getByRole("button", { name: "Change date filter" })).toBeInTheDocument();

    await user.click(within(chip).getByTestId("CancelIcon"));

    expect(rowsOf(card)).toHaveLength(3);
    expect(within(card).queryByRole("button", { name: "28 Jun 2026" })).not.toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Filter by date" })).toBeInTheDocument();
  });

  it("filters the Monthly table to one month from a month picker", async () => {
    connected();
    stubApi({ daily: () => json(monthly) });

    renderDownloads(`${downloadsPath}?from=2025-01-01&to=2025-04-30&interval=month`);

    await screen.findByRole("columnheader", { name: /Total/ });
    const card = tableCard("Monthly downloads table");
    expect(card.querySelector('input[type="date"]')).toBeNull();
    fireEvent.change(card.querySelector('input[type="month"]') as HTMLInputElement, {
      target: { value: "2025-02" },
    });

    expect(rowsOf(card)).toEqual([["2025-02", "1.9K", "0", "1.9K"]]);
    expect(within(card).getByRole("button", { name: "2025-02" })).toBeInTheDocument();
  });

  it("forgets the chosen date when the View changes", async () => {
    connected();
    stubApi({
      daily: (url) => json(url.searchParams.get("interval") === "month" ? monthly : juneDaily),
    });
    const user = userEvent.setup();

    renderDownloads(juneRange);

    await screen.findByRole("columnheader", { name: /Total/ });
    fireEvent.change(
      tableCard("Daily downloads table").querySelector('input[type="date"]') as HTMLInputElement,
      { target: { value: "2026-06-28" } },
    );
    expect(rowsOf(tableCard("Daily downloads table"))).toHaveLength(1);

    await chooseView(user, "Monthly");

    await screen.findByRole("heading", { name: "Monthly downloads table" });
    const card = tableCard("Monthly downloads table");
    await waitFor(() => expect(rowsOf(card)).toHaveLength(3));
    expect(within(card).queryByRole("button", { name: "28 Jun 2026" })).not.toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Filter by date" })).toBeInTheDocument();
  });
});

describe("Downloads table's pages", () => {
  it("shows ten dates a page, newest first, with first, next and last buttons and the rows-per-page choices", async () => {
    connected();
    stubApi({ daily: () => json(twelveDays) });
    const user = userEvent.setup();

    renderDownloads(juneRange);

    await screen.findByRole("columnheader", { name: /Total/ });
    const card = tableCard("Daily downloads table");
    expect(rowsOf(card)).toHaveLength(10);
    expect(rowsOf(card)[0]).toEqual(["12 Jun 2026", "12", "12"]);
    expect(rowsOf(card)[9][0]).toBe("03 Jun 2026");
    expect(within(card).getByText("1–10 of 12")).toBeInTheDocument();

    await user.click(within(card).getByRole("button", { name: /go to next page/i }));
    expect(rowsOf(card)).toEqual([
      ["02 Jun 2026", "2", "2"],
      ["01 Jun 2026", "1", "1"],
    ]);

    await user.click(within(card).getByRole("button", { name: /go to first page/i }));
    expect(rowsOf(card)[0][0]).toBe("12 Jun 2026");
    await user.click(within(card).getByRole("button", { name: /go to last page/i }));
    expect(rowsOf(card)[0][0]).toBe("02 Jun 2026");

    await user.click(within(card).getByRole("combobox", { name: /rows per page/i }));
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "10",
      "25",
      "50",
      "100",
    ]);
    await user.click(within(listbox).getByRole("option", { name: "25" }));
    expect(rowsOf(card)).toHaveLength(12);
    expect(within(card).getByText("1–12 of 12")).toBeInTheDocument();
  });
});

describe("Downloads states", () => {
  it("shows a skeleton in the chart card and skeleton rows in the table until the series arrives", async () => {
    connected();
    stubApi({ daily: pending });

    const { container } = renderDownloads(juneRange);

    expect(await screen.findByRole("heading", { name: "Daily downloads by product" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Daily downloads table" })).toBeInTheDocument();
    expect(container.querySelectorAll(".MuiSkeleton-root").length).toBeGreaterThan(1);
    expect(tableCard("Daily downloads table").querySelector(".MuiSkeleton-root")).not.toBeNull();
    expect(screen.queryByText(/No data for the selected range/)).not.toBeInTheDocument();
    expect(screen.queryByText("Average Downloads")).not.toBeInTheDocument();
  });

  it("says there is no data in the chart and the table, and shows no tiles, when the range is empty", async () => {
    connected();
    stubApi({ daily: () => json({ series: [] }) });

    renderDownloads(juneRange);

    expect(await screen.findByText("No data for the selected range")).toBeInTheDocument();
    expect(within(tableCard("Daily downloads table")).getByText("No data for the selected range.")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader")).not.toBeInTheDocument();
    expect(screen.queryByText("Average Downloads")).not.toBeInTheDocument();
    expect(screen.queryByText(/Period Total/)).not.toBeInTheDocument();
  });

  it("shows the server's message with Retry when the series fails, and recovers on Retry", async () => {
    connected();
    let answers = 0;
    const fetchMock = stubApi({
      daily: () =>
        answers++ === 0 ? json({ message: "Downloads are being rebuilt." }, 500) : json(juneDaily),
    });
    const user = userEvent.setup();

    renderDownloads(juneRange);

    expect((await screen.findAllByText("Something went wrong")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Downloads are being rebuilt.").length).toBeGreaterThan(0);
    expect(screen.queryByText(/No data for the selected range/)).not.toBeInTheDocument();
    expect(screen.queryByText("Average Downloads")).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Retry" })[0]);

    expect(await screen.findByText("Average Downloads")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    expect(requestsTo(fetchMock, "/stats/daily")).toHaveLength(2);
  });

  it("falls back to the default sentence when a failure carries no message", async () => {
    connected();
    stubApi({ daily: () => new Response("<html>Bad gateway</html>", { status: 502 }) });

    renderDownloads(juneRange);

    expect((await screen.findAllByText("We couldn't load this data. Please try again.")).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Bad gateway/)).not.toBeInTheDocument();
  });
});

describe("Downloads from the Overview", () => {
  it("opens from the Overview headlines on the address the tile wrote", async () => {
    connected();
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
            <Route path={downloadsPath} element={<EngineeringDownloadsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    // The three tiles' addresses are the Overview suite's; this is the round
    // trip, from a tile to the Downloads screen reading that address.
    await userEvent.click(await screen.findByRole("button", { name: /yesterday's downloads/i }));
    expect(await screen.findByTestId("where")).toHaveTextContent(
      "/engineering/download-stats/downloads?interval=day&from=2026-09-28&to=2026-09-28",
    );
    expect(await screen.findByRole("tab", { name: "Downloads", selected: true })).toBeInTheDocument();
    expect(screen.getByLabelText("From")).toHaveValue("2026-09-28");
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
