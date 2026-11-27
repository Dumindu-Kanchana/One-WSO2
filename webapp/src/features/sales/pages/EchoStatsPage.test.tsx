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

// The Echo backend is replaced by a double of GET /admin/stats behind the same client
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
import { formatCount, formatRate, formatShare } from "../echoStats/util/statsFormat";
import { formatDateTime } from "../util/salesTime";

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
const rowOf = (scope: ReturnType<typeof section>, table: string, cell: string) =>
  within(within(scope.getByRole("table", { name: table })).getByRole("cell", { name: cell }).closest("tr") as HTMLElement);
const headersOf = (scope: ReturnType<typeof section>, table: string) =>
  within(scope.getByRole("table", { name: table }))
    .getAllByRole("columnheader")
    .map((h) => h.textContent);
const answer = (build: (days: StatsDays) => EchoAdminStats) =>
  adminStats.mockImplementation(async (days: StatsDays) => build(days));

/** The demo answer the page is showing, for figures to compare against. */
const demo = mockEchoAdminStats(30);

beforeEach(() => {
  access.isAdmin = true;
  adminStats.mockReset();
  answer(mockEchoAdminStats);
});

const ADOPTION = ["Usage", "Calls recorded", "Deal progress", "Quiet deals"];
const QUALITY = ["AM decisions on Echo's suggestions", "Analysis outcomes", "Salesforce completeness"];
const sectionTitles = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);

// Every test mounts several sections of tables and recharts charts.
describe("EchoStatsPage", { timeout: 20000 }, () => {
  it("opens on Adoption, with its four sections in order, and no Claude usage anywhere", async () => {
    renderPage();
    await screen.findByRole("region", { name: "Usage" });

    const tabs = within(screen.getByRole("tablist", { name: "Echo stats views" }));
    expect(tabs.getByRole("tab", { name: "Adoption" })).toHaveAttribute("aria-selected", "true");
    expect(tabs.getByRole("tab", { name: "Quality" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tabpanel", { name: "Adoption" })).toBeInTheDocument();
    expect(sectionTitles()).toEqual(ADOPTION);
    expect(screen.getByText("27 Oct – 26 Nov 2026")).toBeInTheDocument();
    expect(screen.queryByText(/Claude/)).not.toBeInTheDocument();
    expect(screen.queryByText(/tokens/i)).not.toBeInTheDocument();
  });

  it("switches to Quality and back, keeping the tab in the address and asking for nothing new", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("region", { name: "Usage" });
    expect(adminStats).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("tab", { name: "Quality" }));
    expect(sectionTitles()).toEqual(QUALITY);
    expect(screen.getByRole("tabpanel", { name: "Quality" })).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent(/^\/sales\/echo-stats\?tab=quality$/);
    expect(screen.queryByText(/Claude/)).not.toBeInTheDocument();
    // Both tabs read the one answer.
    expect(adminStats).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("tab", { name: "Adoption" }));
    expect(sectionTitles()).toEqual(ADOPTION);
    // Adoption is the default, so it stays out of the address.
    expect(screen.getByTestId("where")).toHaveTextContent(/^\/sales\/echo-stats$/);
  });

  it("opens on the tab in the address, and on Adoption for one it doesn't know", async () => {
    const first = renderPage("/sales/echo-stats?tab=quality&days=90");
    await screen.findByRole("region", { name: "Analysis outcomes" });
    expect(sectionTitles()).toEqual(QUALITY);
    expect(adminStats).toHaveBeenLastCalledWith(90);
    first.unmount();

    renderPage("/sales/echo-stats?tab=claude");
    await screen.findByRole("region", { name: "Usage" });
    expect(sectionTitles()).toEqual(ADOPTION);
  });

  it("shows usage with the active-users trend, a Region column and active users by region", async () => {
    renderPage();
    const usage = within(await screen.findByRole("region", { name: "Usage" }));
    expect(tile(usage, "Active users")).toHaveTextContent(String(demo.usage.activeUsers));
    // Thousands separators.
    const events = demo.usage.daily.reduce((total, day) => total + day.events, 0);
    expect(events).toBeGreaterThan(999);
    expect(tile(usage, "Events")).toHaveTextContent(formatCount(events));

    // A line of daily active users with weekly active users beside it, not the old daily bars.
    const trend = usage.getByRole("figure", { name: "Daily and weekly active users, 30 days" });
    expect(within(trend).getByText("Active that day")).toBeInTheDocument();
    expect(within(trend).getByText("Active that week")).toBeInTheDocument();
    expect(trend.querySelectorAll(".recharts-line")).toHaveLength(2);
    expect(trend.querySelector(".recharts-bar")).toBeNull();

    expect(headersOf(usage, "Users").slice(0, 3)).toEqual(["User", "Region", "Last seen"]);
    const top = demo.usage.users[0];
    const row = rowOf(usage, "Users", top.email);
    expect(row.getByRole("cell", { name: top.region ?? "Unassigned" })).toBeInTheDocument();
    expect(row.getByRole("cell", { name: formatCount(top.events) })).toBeInTheDocument();
    // Someone who owns no open deal with a region is Unassigned, as in the by-region lists.
    const unassigned = demo.usage.users.find((u) => u.region === null);
    expect(unassigned).toBeDefined();
    expect(rowOf(usage, "Users", (unassigned as { email: string }).email).getByRole("cell", { name: "Unassigned" })).toBeInTheDocument();

    const [region] = demo.usage.byRegion;
    expect(rowOf(usage, "Active users by region", region.region).getByRole("cell", { name: String(region.users) })).toBeInTheDocument();
    expect(usage.queryByRole("table", { name: "Actions" })).not.toBeInTheDocument();
  });

  it("shows calls recorded with the recorder's Region, by region and by meeting type", async () => {
    renderPage();
    const calls = within(await screen.findByRole("region", { name: "Calls recorded" }));
    expect(tile(calls, "Calls")).toHaveTextContent(formatCount(demo.recording.calls));
    expect(tile(calls, "Recorders")).toHaveTextContent(String(demo.recording.recorders));
    expect(tile(calls, "Analysed")).toHaveTextContent(formatCount(demo.recording.analysed));
    // How the analysis went is the Quality tab's.
    expect(calls.queryByRole("group", { name: "Empty transcript" })).not.toBeInTheDocument();
    expect(calls.getByRole("figure", { name: "Calls and analysed calls by week, 30 days" })).toBeInTheDocument();

    expect(headersOf(calls, "By recorder").slice(0, 2)).toEqual(["Recorder", "Region"]);
    const recorder = demo.recording.byRecorder[0];
    expect(rowOf(calls, "By recorder", recorder.email).getByRole("cell", { name: recorder.region ?? "Unassigned" })).toBeInTheDocument();
    const [region] = demo.recording.byRegion;
    const regionRow = rowOf(calls, "By region", region.region);
    expect(regionRow.getAllByRole("cell").map((c) => c.textContent)).toEqual([
      region.region,
      formatCount(region.calls),
      formatCount(region.analysed),
      formatCount(region.recorders),
    ]);
    expect(calls.getByRole("table", { name: "By meeting type" })).toHaveTextContent("Discovery Call");
  });

  it("shows deal progress: the tiles, open deals by stage, recent changes linking to the deal, by region and by owner", async () => {
    renderPage();
    const progress = within(await screen.findByRole("region", { name: "Deal progress" }));
    const p = demo.progress;
    expect(tile(progress, "Open opportunities")).toHaveTextContent(String(p.openDeals));
    expect(tile(progress, "Stage changes")).toHaveTextContent(String(p.stageChanges));
    expect(tile(progress, "Moved forward")).toHaveTextContent(String(p.movedForward));
    expect(tile(progress, "Moved back")).toHaveTextContent(String(p.movedBack));
    expect(tile(progress, "Won")).toHaveTextContent(String(p.closedWon));
    expect(tile(progress, "Lost")).toHaveTextContent(String(p.closedLost));
    const byStage = progress.getByRole("figure", { name: "Open opportunities by stage" });
    expect(byStage.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(p.byStage.length);

    expect(headersOf(progress, "Recent stage changes")).toEqual([
      "Opportunity",
      "Owner",
      "Region",
      "Stage change",
      "Direction",
      "When",
    ]);
    const [latest] = p.changes;
    const link = within(progress.getByRole("table", { name: "Recent stage changes" })).getAllByRole("link", { name: latest.name })[0];
    expect(link).toHaveAttribute("href", `/sales/deals/${latest.opportunityId}`);
    const row = within(link.closest("tr") as HTMLElement);
    expect(row.getByRole("cell", { name: `${latest.from} → ${latest.to}` })).toBeInTheDocument();
    expect(row.getByRole("cell", { name: formatDateTime(latest.at) })).toBeInTheDocument();

    const unassigned = rowOf(progress, "By region", "Unassigned");
    const expected = p.byRegion.find((r) => r.region === "Unassigned");
    expect(unassigned.getAllByRole("cell")[1]).toHaveTextContent(String(expected?.openDeals));
    expect(headersOf(progress, "By owner")).toEqual(["Owner", "Region", "Open", "Stage changes", "Won", "Lost"]);
    expect(rowOf(progress, "By owner", p.byOwner[0].ownerEmail).getByRole("cell", { name: p.byOwner[0].region ?? "Unassigned" })).toBeInTheDocument();
  });

  it("shows quiet deals: the share quiet, never-emailed first, by owner and by region", async () => {
    renderPage();
    const quiet = within(await screen.findByRole("region", { name: "Quiet deals" }));
    const q = demo.quietDeals;
    expect(tile(quiet, "Open opportunities")).toHaveTextContent(String(q.openDeals));
    expect(tile(quiet, "Quiet")).toHaveTextContent(String(q.quiet));
    expect(tile(quiet, "Share quiet")).toHaveTextContent(formatShare(q.quiet, q.openDeals));

    expect(headersOf(quiet, "Quiet opportunities")).toEqual([
      "Opportunity",
      "Owner",
      "Region",
      "Stage",
      "Last email",
      "Last activity",
      "Last call",
    ]);
    const [first] = q.deals;
    expect(first.lastEmailAt).toBeNull();
    const link = quiet.getByRole("link", { name: first.name });
    expect(link).toHaveAttribute("href", `/sales/deals/${first.opportunityId}`);
    expect(within(link.closest("tr") as HTMLElement).getByRole("cell", { name: "Never" })).toBeInTheDocument();
    const emailed = q.deals.find((d) => d.lastEmailAt !== null);
    expect(emailed).toBeDefined();
    const emailedRow = within(quiet.getByRole("link", { name: emailed?.name }).closest("tr") as HTMLElement);
    expect(emailedRow.getByRole("cell", { name: formatDateTime(emailed?.lastEmailAt) })).toBeInTheDocument();

    expect(headersOf(quiet, "By owner")).toEqual(["Owner", "Region", "Open", "Quiet"]);
    const [region] = q.byRegion;
    expect(rowOf(quiet, "By region", region.region).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      region.region,
      String(region.openDeals),
      String(region.quiet),
    ]);
  });

  it("shows decisions with Region by user, analysis outcomes and Salesforce completeness on Quality", async () => {
    renderPage("/sales/echo-stats?tab=quality");
    const decisions = within(await screen.findByRole("region", { name: "AM decisions on Echo's suggestions" }));
    const d = demo.decisions;
    expect(tile(decisions, "Approved as proposed")).toHaveTextContent(String(d.approved));
    expect(tile(decisions, "Approved as proposed rate")).toHaveTextContent(formatRate(d.approvedAsIsRate));
    expect(tile(decisions, "Pending suggestions (all deals)")).toHaveTextContent(String(d.pending));
    // Never called accuracy, and it says why.
    expect(decisions.getByText(/not how accurate they were: measuring accuracy needs the labelled gold set/)).toBeInTheDocument();
    expect(decisions.getByRole("table", { name: "Reject reasons" })).toHaveTextContent("No reason given");
    for (const status of ["SINGLE", "MERGED", "FALLBACK"]) {
      expect(decisions.getByRole("table", { name: "By merge status" })).toHaveTextContent(status);
    }
    expect(headersOf(decisions, "By user").slice(0, 2)).toEqual(["User", "Region"]);
    const [byUser] = d.byUser;
    expect(rowOf(decisions, "By user", byUser.email).getByRole("cell", { name: byUser.region ?? "Unassigned" })).toBeInTheDocument();

    const analysis = section("Analysis outcomes");
    expect(analysis.getByText(`What became of the ${formatCount(demo.recording.calls)} sales calls recorded in this range.`)).toBeInTheDocument();
    expect(tile(analysis, "With transcript")).toHaveTextContent(formatCount(demo.recording.withTranscript));
    expect(tile(analysis, "Analysed")).toHaveTextContent(formatCount(demo.recording.analysed));
    expect(tile(analysis, "Analysis failed")).toHaveTextContent(formatCount(demo.recording.failed));
    expect(tile(analysis, "Empty transcript")).toHaveTextContent(formatCount(demo.recording.emptyTranscript));

    const salesforce = section("Salesforce completeness");
    expect(tile(salesforce, "Fill rate")).toHaveTextContent(formatRate(demo.salesforce.fillRate));
    const gap = demo.salesforce.dealsWithMostGaps[0];
    expect(salesforce.getByRole("link", { name: gap.name })).toHaveAttribute("href", `/sales/deals/${gap.opportunityId}`);
  });

  it("asks for 30 days first, and the range toggle asks again for the range picked, on either tab", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("region", { name: "Usage" });
    expect(adminStats).toHaveBeenLastCalledWith(30);

    const range = within(screen.getByRole("group", { name: "Range" }));
    expect(range.getByRole("button", { name: "30 days" })).toHaveAttribute("aria-pressed", "true");
    await user.click(range.getByRole("button", { name: "90 days" }));

    await waitFor(() => expect(adminStats).toHaveBeenLastCalledWith(90));
    expect(await screen.findByRole("figure", { name: "Daily and weekly active users, 90 days" })).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/sales/echo-stats?days=90");

    await user.click(screen.getByRole("tab", { name: "Quality" }));
    await user.click(range.getByRole("button", { name: "7 days" }));
    await waitFor(() => expect(adminStats).toHaveBeenLastCalledWith(7));
    const params = new URLSearchParams(screen.getByTestId("where").textContent?.split("?")[1]);
    expect(Object.fromEntries(params)).toEqual({ tab: "quality", days: "7" });
  });

  it("falls back to 30 days for a range the endpoint would refuse", async () => {
    renderPage("/sales/echo-stats?days=14");
    await screen.findByRole("region", { name: "Usage" });
    expect(adminStats).toHaveBeenLastCalledWith(30);
  });

  it("shows a dash, not 0%, for a rate with nothing to divide by", async () => {
    answer((days) => {
      const stats = mockEchoAdminStats(days);
      stats.decisions.byField = [
        { fieldKey: "paperProcess", label: "Paper process", approved: 0, edited: 0, rejected: 0, pending: 6, approvedAsIsRate: null },
      ];
      return stats;
    });
    renderPage("/sales/echo-stats?tab=quality");
    const decisions = within(await screen.findByRole("region", { name: "AM decisions on Echo's suggestions" }));
    const paper = rowOf(decisions, "By field", "Paper process");
    expect(paper.getAllByRole("cell").at(-1)).toHaveTextContent(/^—$/);
  });

  it("says usage is counted only since tracking started, when that is inside the range", async () => {
    renderPage();
    const usage = within(await screen.findByRole("region", { name: "Usage" }));
    expect(
      usage.getByText("Usage is counted only since tracking started on 2 Nov 2026, so this range shows nothing before then."),
    ).toBeInTheDocument();
  });

  it("says nothing about tracking when it started before the range", async () => {
    renderPage("/sales/echo-stats?days=7");
    const usage = within(await screen.findByRole("region", { name: "Usage" }));
    expect(usage.queryByText(/counted only since tracking started/)).not.toBeInTheDocument();
  });

  it("shows an empty state for every empty list and chart on Adoption, and dashes for its rates", async () => {
    answer(emptyEchoAdminStats);
    renderPage();
    const usage = within(await screen.findByRole("region", { name: "Usage" }));
    expect(usage.getByText("Usage is counted only since tracking started, and nothing has been recorded yet.")).toBeInTheDocument();
    // The trend says why it is empty rather than drawing flat lines; so do the two tables.
    expect(usage.queryByRole("figure")).not.toBeInTheDocument();
    expect(usage.getAllByText("No one used Echo in this range.")).toHaveLength(3);

    const calls = section("Calls recorded");
    expect(calls.queryByRole("figure")).not.toBeInTheDocument();
    expect(calls.getAllByText("No calls recorded in this range.")).toHaveLength(4);

    const progress = section("Deal progress");
    expect(progress.queryByRole("figure")).not.toBeInTheDocument();
    expect(progress.getByText("No open opportunities on the list.")).toBeInTheDocument();
    expect(progress.getByText("No opportunity changed stage in the last 30 days.")).toBeInTheDocument();
    expect(progress.getAllByText("No open opportunities, and no stage changes in this range.")).toHaveLength(2);

    const quiet = section("Quiet deals");
    expect(tile(quiet, "Share quiet")).toHaveTextContent("—");
    expect(quiet.getByText("Every open opportunity has a customer email in the last 30 days.")).toBeInTheDocument();
    expect(quiet.getAllByText("No open opportunities on the list.")).toHaveLength(2);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows an empty state for every empty list on Quality, and dashes for its rates", async () => {
    answer(emptyEchoAdminStats);
    renderPage("/sales/echo-stats?tab=quality");
    const decisions = within(await screen.findByRole("region", { name: "AM decisions on Echo's suggestions" }));
    expect(tile(decisions, "Approved as proposed rate")).toHaveTextContent("—");
    expect(decisions.getByText("No suggestions decided in this range, and none pending.")).toBeInTheDocument();
    expect(decisions.getByText("No suggestions rejected in this range.")).toBeInTheDocument();
    expect(decisions.getAllByText("No suggestions decided in this range.")).toHaveLength(3);

    expect(tile(section("Analysis outcomes"), "With transcript")).toHaveTextContent("0");

    const salesforce = section("Salesforce completeness");
    expect(tile(salesforce, "Fill rate")).toHaveTextContent("—");
    expect(salesforce.getByText("No open opportunities on the list.")).toBeInTheDocument();
    expect(salesforce.getByText("No open opportunities are missing a field.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("says the quiet list is cut short when it holds fewer than the quiet count", async () => {
    answer((days) => {
      const stats = mockEchoAdminStats(days);
      stats.quietDeals.quiet = stats.quietDeals.deals.length + 5;
      return stats;
    });
    renderPage();
    const quiet = within(await screen.findByRole("region", { name: "Quiet deals" }));
    const shown = demo.quietDeals.deals.length;
    expect(quiet.getByText(`Showing the first ${shown} of ${shown + 5}.`)).toBeInTheDocument();
  });

  it("tells a caller who is not a Sales admin that the page is for admins, and asks nothing", async () => {
    access.isAdmin = false;
    renderPage();
    expect(screen.getByText("Echo stats are for Sales admins only.")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Range" })).not.toBeInTheDocument();
    expect(adminStats).not.toHaveBeenCalled();
  });

  // The admins known to ONE_WSO2_REVOPS_BACKEND_URL and to ONE_WSO2_ECHO_BACKEND_URL are kept
  // apart and can disagree: the Echo backend's 403 gets the same explanation, not an error.
  it("meets the Echo backend's 403 with the admins-only explanation, not an error", async () => {
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
