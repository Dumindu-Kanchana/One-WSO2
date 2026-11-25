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
import type { ReactNode } from "react";
import { HttpError } from "@api/http";

// echo-backend is replaced by a double of GET /admin/stats behind the same client
// interface, so the real hook, cache and page run against the contract's shape. The shell
// has its own suite; here it only frames the page. Who is an admin is the Sales gate's
// answer, set per test.
const access = vi.hoisted(() => ({ isAdmin: true }));
const adminStats = vi.hoisted(() => vi.fn());

vi.mock("@config/apiConfig", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@config/apiConfig")>()),
  isEchoBackendConfigured: () => true,
  isSalesBackendConfigured: () => true,
}));
vi.mock("@features/sales/echoStats/api/echoStatsClient", () => ({
  httpEchoStatsClient: () => ({ adminStats }),
}));
vi.mock("../api/useSalesGate", () => ({
  useSalesGate: () => ({ isResolved: true, isAdmin: access.isAdmin, workEmail: "admin@wso2.com" }),
}));
vi.mock("../components/SalesShell", () => ({
  default: ({ title, children }: { title: string; children: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "user-under-test" }, retry: () => {} }),
  foldIdentityError: (query: unknown) => query,
}));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
// jsdom lays nothing out, so a percentage-sized container measures 0×0 and draws nothing;
// a fixed box lets the charts render, as the MIS chart suites do.
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => (
      <actual.ResponsiveContainer width={800} height={220}>
        {children as never}
      </actual.ResponsiveContainer>
    ),
  };
});

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router";
import EchoStatsPage from "./EchoStatsPage";
import { emptyEchoAdminStats, mockEchoAdminStats } from "../echoStats/testing/mockEchoStats";
import type { EchoAdminStats, StatsDays } from "../echoStats/types";

function Where() {
  const { pathname, search } = useLocation();
  return <div data-testid="where">{pathname + search}</div>;
}

function renderPage(entry = "/sales/echo-stats") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Where />
      <QueryClientProvider client={client}>
        <EchoStatsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const section = (name: string) => within(screen.getByRole("region", { name }));
const tile = (scope: ReturnType<typeof section>, name: string) => scope.getByRole("group", { name });
const answer = (build: (days: StatsDays) => EchoAdminStats) =>
  adminStats.mockImplementation(async (days: StatsDays) => build(days));

beforeEach(() => {
  access.isAdmin = true;
  adminStats.mockReset();
  answer(mockEchoAdminStats);
});

// Every test mounts five sections of tables and two recharts charts.
describe("EchoStatsPage", { timeout: 20000 }, () => {
  it("shows every section, in order, from a full response", async () => {
    renderPage();
    await screen.findByRole("region", { name: "Usage" });

    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Usage",
      "Calls recorded",
      "AM decisions on Echo's suggestions",
      "Salesforce completeness",
      "Claude usage",
    ]);
    expect(screen.getByText("27 Oct – 26 Nov 2026")).toBeInTheDocument();

    const usage = section("Usage");
    expect(tile(usage, "Active users")).toHaveTextContent("12");
    expect(usage.getByRole("figure", { name: "Daily active users, 30 days" })).toBeInTheDocument();
    const nadia = within(usage.getByRole("cell", { name: "nadia@wso2.com" }).closest("tr") as HTMLElement);
    expect(nadia.getByRole("cell", { name: "1,240" })).toBeInTheDocument();
    expect(nadia.getByRole("cell", { name: "620" })).toBeInTheDocument();
    expect(usage.getByRole("table", { name: "Actions" })).toHaveTextContent("Opened an opportunity");

    const calls = section("Calls recorded");
    // Thousands separators.
    expect(tile(calls, "Calls")).toHaveTextContent("1,285");
    expect(tile(calls, "Empty transcript")).toHaveTextContent("3");
    expect(calls.getByRole("figure", { name: "Calls and analysed calls by week, 30 days" })).toBeInTheDocument();
    expect(calls.getByRole("table", { name: "By recorder" })).toHaveTextContent("kasun@wso2.com");
    expect(calls.getByRole("table", { name: "By meeting type" })).toHaveTextContent("Discovery Call");

    const decisions = section("AM decisions on Echo's suggestions");
    expect(tile(decisions, "Approved as proposed")).toHaveTextContent("120");
    expect(tile(decisions, "Approved as proposed rate")).toHaveTextContent("72.7%");
    // Never called accuracy, and it says why.
    expect(decisions.getByText(/not how accurate they were: measuring accuracy needs the labelled gold set/)).toBeInTheDocument();
    expect(decisions.queryByText(/^accuracy$/i)).not.toBeInTheDocument();
    const economicBuyer = within(decisions.getByRole("cell", { name: "Economic Buyer" }).closest("tr") as HTMLElement);
    expect(economicBuyer.getByRole("cell", { name: "62.5%" })).toBeInTheDocument();
    expect(decisions.getByRole("table", { name: "Reject reasons" })).toHaveTextContent("Wrong value");
    expect(decisions.getByRole("table", { name: "Reject reasons" })).toHaveTextContent("No reason given");
    // Every PROPOSED suggestion, on any deal: labelled so it isn't read as the Deals list's count.
    expect(tile(decisions, "Pending suggestions (all deals)")).toHaveTextContent("48");
    expect(decisions.getByRole("table", { name: "By confidence" })).toHaveTextContent("0.8-0.9");
    const merge = decisions.getByRole("table", { name: "By merge status" });
    for (const status of ["SINGLE", "MERGED", "FALLBACK"]) expect(merge).toHaveTextContent(status);
    expect(decisions.getByRole("table", { name: "By user" })).toHaveTextContent("nadia@wso2.com");

    const salesforce = section("Salesforce completeness");
    expect(tile(salesforce, "Fill rate")).toHaveTextContent("41.7%");
    expect(tile(salesforce, "Fill rate")).toHaveTextContent("150 of 360 fields");
    expect(tile(salesforce, "Echo can fill")).toHaveTextContent("60");
    expect(salesforce.getByRole("table", { name: "By field, most missing first" })).toHaveTextContent("Paper Process");
    expect(salesforce.getByRole("link", { name: "Harbourline – API platform" })).toHaveAttribute(
      "href",
      "/sales/deals/006MOCK0000HARB",
    );

    const model = section("Claude usage");
    expect(tile(model, "Input tokens")).toHaveTextContent("9,000,000");
    expect(tile(model, "Cache write tokens")).toHaveTextContent("900,000");
    expect(model.getByRole("table", { name: "By purpose, most input tokens first" })).toHaveTextContent("call.vote");
  });

  it("asks for 30 days first, and the range toggle asks again for the range picked", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("region", { name: "Usage" });
    expect(adminStats).toHaveBeenLastCalledWith(30);

    const range = within(screen.getByRole("group", { name: "Range" }));
    expect(range.getByRole("button", { name: "30 days" })).toHaveAttribute("aria-pressed", "true");
    await user.click(range.getByRole("button", { name: "90 days" }));

    await waitFor(() => expect(adminStats).toHaveBeenLastCalledWith(90));
    expect(await screen.findByRole("figure", { name: "Daily active users, 90 days" })).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/sales/echo-stats?days=90");

    await user.click(range.getByRole("button", { name: "7 days" }));
    await waitFor(() => expect(adminStats).toHaveBeenLastCalledWith(7));
  });

  it("opens on the range in the address, and falls back to 30 days for one the endpoint would refuse", async () => {
    const first = renderPage("/sales/echo-stats?days=7");
    await screen.findByRole("region", { name: "Usage" });
    expect(adminStats).toHaveBeenLastCalledWith(7);
    first.unmount();

    renderPage("/sales/echo-stats?days=14");
    await screen.findByRole("region", { name: "Usage" });
    expect(adminStats).toHaveBeenLastCalledWith(30);
  });

  it("shows a dash, not 0%, for a rate with nothing to divide by", async () => {
    renderPage();
    const decisions = within(await screen.findByRole("region", { name: "AM decisions on Echo's suggestions" }));
    // Paper Process has only pending suggestions: nothing decided, so no rate.
    const paper = within(decisions.getByRole("cell", { name: "Paper Process" }).closest("tr") as HTMLElement);
    expect(paper.getAllByRole("cell").at(-1)).toHaveTextContent(/^—$/);
  });

  it("says usage is counted only since tracking started, when that is inside the range", async () => {
    renderPage();
    const usage = within(await screen.findByRole("region", { name: "Usage" }));
    expect(
      usage.getByText(
        "Usage is counted only since tracking started on 20 Nov 2026, so this range shows nothing before then.",
      ),
    ).toBeInTheDocument();
  });

  it("says nothing about tracking when it started before the range", async () => {
    answer((days) => {
      const stats = mockEchoAdminStats(days);
      stats.usage.trackedSince = "2026-09-01T00:00:00Z";
      return stats;
    });
    renderPage();
    const usage = within(await screen.findByRole("region", { name: "Usage" }));
    expect(usage.queryByText(/counted only since tracking started/)).not.toBeInTheDocument();
  });

  it("shows an empty state for every empty list, and dashes for every rate", async () => {
    answer(emptyEchoAdminStats);
    renderPage();
    const usage = within(await screen.findByRole("region", { name: "Usage" }));
    expect(
      usage.getByText("Usage is counted only since tracking started, and nothing has been recorded yet."),
    ).toBeInTheDocument();
    // The chart says why it is empty rather than drawing flat bars; so does the users table.
    expect(usage.queryByRole("figure")).not.toBeInTheDocument();
    expect(usage.getAllByText("No one used Echo in this range.")).toHaveLength(2);
    expect(usage.getByText("No actions in this range.")).toBeInTheDocument();

    const calls = section("Calls recorded");
    expect(calls.queryByRole("figure")).not.toBeInTheDocument();
    expect(calls.getAllByText("No calls recorded in this range.")).toHaveLength(3);

    const decisions = section("AM decisions on Echo's suggestions");
    expect(tile(decisions, "Approved as proposed rate")).toHaveTextContent("—");
    expect(decisions.getByText("No suggestions decided in this range, and none pending.")).toBeInTheDocument();
    expect(decisions.getByText("No suggestions rejected in this range.")).toBeInTheDocument();
    expect(decisions.getAllByText("No suggestions decided in this range.")).toHaveLength(3);

    const salesforce = section("Salesforce completeness");
    expect(tile(salesforce, "Fill rate")).toHaveTextContent("—");
    expect(salesforce.getByText("No open opportunities on the list.")).toBeInTheDocument();
    expect(salesforce.getByText("No open opportunities are missing a field.")).toBeInTheDocument();

    expect(section("Claude usage").getByText("Echo made no requests to Claude in this range.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("tells a caller who is not a Sales admin that the page is for admins, and asks nothing", async () => {
    access.isAdmin = false;
    renderPage();
    expect(screen.getByText("Echo stats are for Sales admins only.")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Range" })).not.toBeInTheDocument();
    expect(adminStats).not.toHaveBeenCalled();
  });

  // meet-app's admins and echo-backend's are kept apart and can disagree: echo-backend's 403
  // gets the same explanation, not an error.
  it("meets echo-backend's 403 with the admins-only explanation, not an error", async () => {
    adminStats.mockRejectedValue(new HttpError("https://echo/admin/stats?days=30", 403, ""));
    renderPage();
    expect(await screen.findByText(/Echo stats are for Sales admins only, and Echo doesn't list you as one/)).toBeInTheDocument();
    expect(screen.queryByText(/Couldn't load Echo stats/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("reports any other failure with a Retry", async () => {
    const user = userEvent.setup();
    // A 5xx is retried once (salesRetry) before it is reported, so it fails twice here.
    const outage = new HttpError("https://echo/admin/stats?days=30", 503, "");
    adminStats.mockRejectedValueOnce(outage).mockRejectedValueOnce(outage);
    renderPage();
    expect(await screen.findByText(/Couldn't load Echo stats/, undefined, { timeout: 5000 })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("region", { name: "Usage" })).toBeInTheDocument();
  });

  it("says it is loading until the answer arrives", async () => {
    let resolve: (value: EchoAdminStats) => void = () => {};
    adminStats.mockImplementation(() => new Promise<EchoAdminStats>((r) => (resolve = r)));
    renderPage();
    expect(await screen.findByText("Loading Echo stats…")).toBeInTheDocument();
    resolve(mockEchoAdminStats(30));
    expect(await screen.findByRole("region", { name: "Usage" })).toBeInTheDocument();
  });
});
