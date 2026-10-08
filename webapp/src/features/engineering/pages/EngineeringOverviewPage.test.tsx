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
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import AuthGuard from "@layouts/AuthGuard";
import { downloadStatsPaths } from "@constants/downloadStatsApps";
import EngineeringOverviewPage from "./EngineeringOverviewPage";

const auth = vi.hoisted(() => {
  window.config = {
    ...(window.config ?? {}),
    ONE_WSO2_AUTH_BASE_URL: "https://auth.example.com/t/test",
    ONE_WSO2_AUTH_CLIENT_ID: "test-client",
    ONE_WSO2_AUTH_SIGN_IN_REDIRECT_URL: "http://localhost:3000",
    ONE_WSO2_AUTH_SIGN_OUT_REDIRECT_URL: "http://localhost:3000",
    ONE_WSO2_DEV_BYPASS_AUTH: false,
  } as Window["config"];
  return {
    isSignedIn: true,
    isLoading: false,
    signIn: vi.fn(),
  };
});

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
    isSignedIn: auth.isSignedIn,
    isLoading: auth.isLoading,
    getAccessToken: async () => "test-token",
    signIn: auth.signIn,
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

function renderOverview({ signedIn = true }: { signedIn?: boolean } = {}) {
  auth.isSignedIn = signedIn;
  auth.isLoading = false;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[downloadStatsPaths.overview]}>
        <Where />
        <Routes>
          <Route element={<AuthGuard />}>
            <Route path={downloadStatsPaths.overview} element={<EngineeringOverviewPage />} />
          </Route>
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

// Overview on staging, 7 Oct 2026, in miniature. Products
// Tracked is 1,234 rather than 10 so a compact "1.2K" would be caught.
const apiManager = {
  repoId: 1,
  repoName: "product-apim",
  productName: "API Manager",
  todayDownloads: 100,
  totalDownloads: 95900,
  stars: 4,
};

const summaryBody = {
  trackedRepositories: 1234,
  totalDownloads: 254200,
  totalClonesLast14d: 88,
  todayDownloads: 205,
  todayDeltaPct: 3,
  asOfDate: "2026-09-28",
  monthDownloads: 42,
  topProducts: [apiManager],
};

const dailyBody = {
  from: "2026-08-29",
  to: "2026-09-28",
  interval: "day",
  series: [
    { repoId: 1, repoName: "product-apim", points: [{ date: "2026-09-27", value: 40 }] },
    { repoId: 2, repoName: "product-is", points: [{ date: "2026-09-28", value: 25 }] },
  ],
};

const repositoriesBody = {
  count: 2,
  repositories: [
    { id: 1, repoName: "product-apim", productName: "API Manager", isActive: true },
    { id: 2, repoName: "product-is", productName: "Identity Server", isActive: true },
  ],
};

type Answers = {
  summary?: () => Response | Promise<Response>;
  daily?: () => Response | Promise<Response>;
  repositories?: () => Response | Promise<Response>;
};

/** The three requests the screen makes, each answerable on its own. */
function stubApi(answers: Answers = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.startsWith("https://stats.example/api/v1/stats/summary")) {
      return (answers.summary ?? (() => jsonResponse(summaryBody)))();
    }
    if (url.startsWith("https://stats.example/api/v1/stats/daily")) {
      return (answers.daily ?? (() => jsonResponse(dailyBody)))();
    }
    if (url.startsWith("https://stats.example/api/v1/repositories")) {
      return (answers.repositories ?? (() => jsonResponse(repositoriesBody)))();
    }
    return jsonResponse({}, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const pending = () => new Promise<Response>(() => {});

type User = ReturnType<typeof userEvent.setup>;

/** The three ways a person opens a whole-tile or whole-row link. */
const activations: Array<(user: User, target: HTMLElement) => Promise<void>> = [
  (user, target) => user.click(target),
  async (user, target) => {
    target.focus();
    await user.keyboard("{Enter}");
  },
  async (user, target) => {
    target.focus();
    await user.keyboard(" ");
  },
];

function callsTo(fetchMock: ReturnType<typeof stubApi>, path: string): number {
  return fetchMock.mock.calls.filter((call) => String(call[0]).includes(path)).length;
}

/** The card a tile's label sits in, as the reader sees it. */
function tile(label: string): HTMLElement {
  const card = screen.getByText(label).closest(".MuiCard-root");
  if (!card) throw new Error(`No tile labelled ${label}`);
  return card as HTMLElement;
}

function topProductsCard(): HTMLElement {
  return screen.getByRole("heading", { name: "Top Products (Downloads)" }).parentElement as HTMLElement;
}

// The preview, not-connected and https rungs are the shell's, and
// DownloadStatsShell.test.tsx walks them. Two are kept here on the real
// screen, because a probe cannot prove that a screen with three queries
// sends none of them.
describe("Engineering Overview", () => {
  it("shows the five headline tiles with their icons, figures and trend chip", async () => {
    connected();
    const fetchMock = stubApi();

    renderOverview();

    // The description is up before the figures; the first figure is the
    // sign the summary has arrived. The tab already names the screen.
    expect(await screen.findByText("205")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("heading", { name: "Overview" })).not.toBeInTheDocument();
    expect(
      screen.getByText("Download activity and repository stats across all WSO2 products."),
    ).toBeInTheDocument();

    const yesterday = tile("Yesterday's Downloads");
    expect(yesterday.querySelector("svg.lucide-download")).not.toBeNull();
    expect(within(yesterday).getByText("3.0%")).toBeInTheDocument();
    expect(yesterday.querySelector("svg.lucide-trending-up")).not.toBeNull();

    const month = tile("This Month's Downloads");
    expect(month.querySelector("svg.lucide-calendar-days")).not.toBeNull();
    expect(within(month).getByText("42")).toBeInTheDocument();

    const total = tile("Total Downloads");
    expect(total.querySelector("svg.lucide-database")).not.toBeNull();
    expect(within(total).getByText("254.2K")).toBeInTheDocument();

    const tracked = tile("Products Tracked");
    expect(tracked.querySelector("svg.lucide-boxes")).not.toBeNull();
    expect(within(tracked).getByText("1,234")).toBeInTheDocument();

    const clones = tile("Clones (14d)");
    expect(clones.querySelector("svg.lucide-copy")).not.toBeNull();
    expect(within(clones).getByText("88")).toBeInTheDocument();

    const summaryCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).startsWith("https://stats.example/api/v1/stats/summary"),
    ) as [string, RequestInit] | undefined;
    expect(summaryCall?.[1]).toMatchObject({
      headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
    });
  });

  it("shows a fall as a red down chip without a minus sign", async () => {
    connected();
    stubApi({ summary: () => jsonResponse({ ...summaryBody, todayDeltaPct: -3 }) });

    renderOverview();

    expect(await screen.findByText("205")).toBeInTheDocument();
    const yesterday = tile("Yesterday's Downloads");
    expect(within(yesterday).getByText("3.0%")).toBeInTheDocument();
    expect(within(yesterday).queryByText("-3.0%")).not.toBeInTheDocument();
    expect(yesterday.querySelector("svg.lucide-trending-down")).not.toBeNull();
    expect(yesterday.querySelector("svg.lucide-trending-up")).toBeNull();
  });

  it("explains yesterday, this month, the total and the clones in tooltips", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    renderOverview();
    expect(await screen.findByText("205")).toBeInTheDocument();

    const explained: Array<[string, string]> = [
      ["Yesterday's Downloads", "New downloads on the latest sync day, across all products."],
      ["This Month's Downloads", "Downloads so far this calendar month, across all products."],
      ["Total Downloads", "Sum of the latest cumulative download count across all tracked products."],
      ["Clones (14d)", "Total git clones across all products in the last 14 days."],
    ];
    for (const [label, sentence] of explained) {
      const info = tile(label).querySelector("svg.lucide-info");
      expect(info, `${label} has an info icon`).not.toBeNull();
      await user.hover(info as Element);
      expect(await screen.findByText(sentence)).toBeInTheDocument();
      await user.unhover(info as Element);
    }
    expect(tile("Products Tracked").querySelector("svg.lucide-info")).toBeNull();
  });

  it.each([
    [
      "Yesterday's Downloads",
      "/engineering/download-stats/downloads?interval=day&from=2026-09-28&to=2026-09-28",
    ],
    [
      "This Month's Downloads",
      "/engineering/download-stats/downloads?interval=month&from=2026-09-01&to=2026-09-28",
    ],
    ["Total Downloads", "/engineering/download-stats/downloads?interval=cumulative"],
  ])("opens Downloads from the %s tile by mouse, Enter and Space", async (label, address) => {
    connected();
    stubApi();
    const user = userEvent.setup();

    for (const activate of activations) {
      const { unmount } = renderOverview();
      expect(await screen.findByText("205")).toBeInTheDocument();

      await activate(user, screen.getByRole("button", { name: new RegExp(label) }));

      expect(screen.getByTestId("where").textContent).toBe(address);
      unmount();
    }
  });

  it("opens This Month's through today when the API names no as-of day, and offers no day for Yesterday's", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-07T12:00:00.000Z"));
    connected();
    stubApi({ summary: () => jsonResponse({ ...summaryBody, asOfDate: null }) });
    const user = userEvent.setup();

    renderOverview();
    expect(await screen.findByText("205")).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: /Yesterday's Downloads/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /This Month's Downloads/ }));

    expect(screen.getByTestId("where").textContent).toBe(
      "/engineering/download-stats/downloads?interval=month&from=2026-10-01&to=2026-10-07",
    );
  });

  it("offers Products Tracked and Clones as figures, not as links", async () => {
    connected();
    stubApi();

    renderOverview();
    expect(await screen.findByText("205")).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: /Products Tracked/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Clones \(14d\)/ })).not.toBeInTheDocument();
    expect(tile("Products Tracked").closest("[tabindex]")).toBeNull();
  });

  it("draws the daily chart beside the top products, naming each Product in the legend", async () => {
    connected();
    const fetchMock = stubApi();

    renderOverview();

    expect(await screen.findByRole("heading", { name: "Daily Downloads (last 30 days)" })).toBeInTheDocument();
    // Identity Server is charted but not a top product, so it is the legend's alone.
    expect(await screen.findByText("Identity Server")).toBeInTheDocument();
    expect(screen.getAllByText("API Manager")).toHaveLength(2);
    expect(screen.queryByText("product-is")).not.toBeInTheDocument();
    // Short dates on the X axis, "Jun 28" rather than the ISO date.
    expect(screen.getByText("Sep 27")).toBeInTheDocument();
    expect(screen.queryByText("2026-09-27")).not.toBeInTheDocument();

    const list = topProductsCard();
    expect(within(list).getByText("Product")).toBeInTheDocument();
    expect(within(list).getByText("Total")).toBeInTheDocument();
    const row = within(list).getByRole("button", { name: /API Manager/ });
    expect(within(row).getByText("95.9K")).toBeInTheDocument();

    const dailyCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/api/v1/stats/daily"));
    expect(String(dailyCall?.[0])).toContain("interval=day");
  });

  it("draws the daily chart by repository name before the Products arrive", async () => {
    connected();
    stubApi({ repositories: pending });

    renderOverview();

    expect(await screen.findByText("product-is")).toBeInTheDocument();
    expect(screen.getByText("product-apim")).toBeInTheDocument();
    expect(screen.queryByText("Identity Server")).not.toBeInTheDocument();
  });

  it("lists the six largest Products by total downloads, largest first", async () => {
    connected();
    const product = (repoId: number, productName: string, totalDownloads: number) => ({
      ...apiManager,
      repoId,
      repoName: productName.toLowerCase().replace(/ /g, "-"),
      productName,
      totalDownloads,
    });
    stubApi({
      summary: () =>
        jsonResponse({
          ...summaryBody,
          topProducts: [
            product(5, "Micro Integrator Tooling", 892),
            product(7, "Oxygen UI", 0),
            product(1, "API Manager", 95900),
            product(3, "API Manager Tooling", 73800),
            product(6, "Observability", 18),
            product(2, "Identity Server", 78600),
            product(4, "Microgateway", 4900),
          ],
        }),
    });

    renderOverview();
    expect(await screen.findByText("205")).toBeInTheDocument();

    const rows = within(topProductsCard()).getAllByRole("button");
    expect(rows.map((row) => row.textContent)).toEqual([
      "API Manager95.9K",
      "Identity Server78.6K",
      "API Manager Tooling73.8K",
      "Microgateway4.9K",
      "Micro Integrator Tooling892",
      "Observability18",
    ]);
    expect(screen.queryByText("Oxygen UI")).not.toBeInTheDocument();
  });

  it("opens Downloads for a Product from its row by mouse, Enter and Space", async () => {
    connected();
    stubApi();
    const user = userEvent.setup();

    for (const activate of activations) {
      const { unmount } = renderOverview();
      expect(await screen.findByText("205")).toBeInTheDocument();

      await activate(user, within(topProductsCard()).getByRole("button", { name: /API Manager/ }));

      expect(screen.getByTestId("where").textContent).toBe(
        "/engineering/download-stats/downloads?repos=1",
      );
      unmount();
    }
  });

  it("shows a skeleton on every tile, the chart and six list rows until the answers arrive", async () => {
    connected();
    stubApi({ summary: pending, daily: pending, repositories: pending });

    const { container } = renderOverview();

    expect(await screen.findByText("Yesterday's Downloads")).toBeInTheDocument();
    expect(screen.getByText("Clones (14d)")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Daily Downloads (last 30 days)" })).toBeInTheDocument();
    expect(screen.queryByText("205")).not.toBeInTheDocument();
    expect(topProductsCard().querySelectorAll(".MuiSkeleton-root")).toHaveLength(6);
    // Five tiles, one chart, six rows.
    expect(container.querySelectorAll(".MuiSkeleton-root")).toHaveLength(12);
  });

  it("draws the chart while the tiles and the list are still waiting for the summary", async () => {
    connected();
    stubApi({ summary: pending });

    const { container } = renderOverview();

    expect(await screen.findByText("Identity Server")).toBeInTheDocument();
    expect(topProductsCard().querySelectorAll(".MuiSkeleton-root")).toHaveLength(6);
    expect(container.querySelectorAll(".MuiSkeleton-root")).toHaveLength(11);
  });

  it("shows the figures and the list while the chart is still waiting for the daily series", async () => {
    connected();
    stubApi({ daily: pending });

    const { container } = renderOverview();

    expect(await screen.findByText("205")).toBeInTheDocument();
    expect(within(topProductsCard()).getByRole("button", { name: /API Manager/ })).toBeInTheDocument();
    expect(container.querySelectorAll(".MuiSkeleton-root")).toHaveLength(1);
  });

  it("shows an em dash on every tile and the server's message with Retry in the list when the summary fails", async () => {
    connected();
    let summaryAnswers = 0;
    const fetchMock = stubApi({
      summary: () =>
        summaryAnswers++ === 0
          ? jsonResponse({ message: "Summary is being rebuilt." }, 500)
          : jsonResponse(summaryBody),
    });

    renderOverview();

    expect(await screen.findAllByText("—")).toHaveLength(5);
    const list = topProductsCard();
    expect(within(list).getByText("Something went wrong")).toBeInTheDocument();
    expect(within(list).getByText("Summary is being rebuilt.")).toBeInTheDocument();
    // The chart is the daily series', not the summary's, and still draws.
    expect(screen.getByText("Identity Server")).toBeInTheDocument();
    expect(screen.queryByText("No data for the selected range")).not.toBeInTheDocument();

    await userEvent.click(within(list).getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("205")).toBeInTheDocument();
    expect(within(topProductsCard()).getByRole("button", { name: /API Manager/ })).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
    expect(callsTo(fetchMock, "/stats/summary")).toBe(2);
  });

  it("shows the chart's error with Retry on its own when the daily series fails", async () => {
    connected();
    const fetchMock = stubApi({
      daily: () => jsonResponse({ message: "Daily series unavailable." }, 500),
    });

    renderOverview();

    expect(await screen.findByText("Daily series unavailable.")).toBeInTheDocument();
    expect(screen.getByText("205")).toBeInTheDocument();
    expect(within(topProductsCard()).getByRole("button", { name: /API Manager/ })).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(callsTo(fetchMock, "/stats/daily")).toBe(2));
    expect(callsTo(fetchMock, "/stats/summary")).toBe(1);
  });

  it("falls back to the default sentence when a failure carries no message", async () => {
    connected();
    stubApi({ daily: () => new Response("<html>Bad gateway</html>", { status: 502 }) });

    renderOverview();

    expect(await screen.findByText("We couldn't load this data. Please try again.")).toBeInTheDocument();
    expect(screen.queryByText(/Bad gateway/)).not.toBeInTheDocument();
  });

  it("says when there are no tracked products and no data for the range", async () => {
    connected();
    stubApi({
      summary: () => jsonResponse({ ...summaryBody, topProducts: [] }),
      daily: () => jsonResponse({ ...dailyBody, series: [] }),
    });

    renderOverview();

    expect(await screen.findByText("No tracked products yet")).toBeInTheDocument();
    expect(screen.getByText("No data for the selected range")).toBeInTheDocument();
    expect(screen.getByText("205")).toBeInTheDocument();
  });

  it("does not send the access token to an http address", () => {
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_PREVIEW_FEATURES: { engineering: true },
      ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL: "http://stats.example",
    } as Window["config"];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderOverview();

    expect(screen.getByText(/needs an https address/i)).toBeInTheDocument();
    expect(screen.queryByText("Yesterday's Downloads")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows an http address on localhost", async () => {
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_PREVIEW_FEATURES: { engineering: true },
      ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL: "http://localhost:8080",
    } as Window["config"];
    const fetchMock = vi.fn<(url: string) => Promise<Response>>();
    fetchMock.mockImplementation(pending);
    vi.stubGlobal("fetch", fetchMock);

    renderOverview();

    expect(await screen.findByText("Yesterday's Downloads")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/^http:\/\/localhost:8080\//);
  });

  it("allows an http address on IPv6 loopback", async () => {
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_PREVIEW_FEATURES: { engineering: true },
      ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL: "http://[::1]:8080",
    } as Window["config"];
    const fetchMock = vi.fn<(url: string) => Promise<Response>>();
    fetchMock.mockImplementation(pending);
    vi.stubGlobal("fetch", fetchMock);

    renderOverview();

    expect(await screen.findByText("Yesterday's Downloads")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/^http:\/\/\[::1\]:8080\//);
  });

  it("says Download Stats is not connected when the API address is missing, and asks for nothing", () => {
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_PREVIEW_FEATURES: { engineering: true },
      ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL: "",
    } as Window["config"];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderOverview();

    expect(screen.getByText(/download stats isn't connected yet/i)).toBeInTheDocument();
    expect(screen.getByText("ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL")).toBeInTheDocument();
    expect(screen.queryByText("Yesterday's Downloads")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends someone who is not signed in to sign in before Overview loads", async () => {
    window.config = {
      ...(window.config ?? {}),
      ONE_WSO2_PREVIEW_FEATURES: { engineering: true },
      ONE_WSO2_DEV_BYPASS_AUTH: false,
    } as Window["config"];
    auth.signIn.mockClear();

    renderOverview({ signedIn: false });

    // AuthGuard asks the SDK whether it still holds a session before redirecting.
    await waitFor(() => expect(auth.signIn).toHaveBeenCalled());
    expect(screen.queryByRole("heading", { name: "Overview" })).not.toBeInTheDocument();
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
