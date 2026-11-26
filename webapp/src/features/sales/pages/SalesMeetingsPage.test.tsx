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
import type { Meeting } from "../api/salesTypes";
import type { MeetingsQueryParams } from "../api/useSalesData";
import type { EchoCallsClient } from "../echoCalls/api/echoCallsClient";
import type { CallContextClient } from "../callContext/api/callContextClient";

// The two backends are replaced at their clients, so the real hooks and cache run: the
// Echo calls list and the live call context answer from the invented calls in
// ../echoCalls/testing; the Sales backend's list is a stub recording what it was asked.
const state = vi.hoisted(() => ({
  echoConfigured: true,
  echoClient: null as unknown as EchoCallsClient,
  contextClient: null as unknown as CallContextClient,
  salesMeetings: [] as Meeting[],
}));
const salesList = vi.fn((params: MeetingsQueryParams) => params);

vi.mock("@config/apiConfig", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@config/apiConfig")>()),
  isEchoBackendConfigured: () => state.echoConfigured,
}));
vi.mock("../echoCalls/api/echoCallsClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../echoCalls/api/echoCallsClient")>()),
  httpEchoCallsClient: () => state.echoClient,
}));
vi.mock("../callContext/api/callContextClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../callContext/api/callContextClient")>()),
  httpCallContextClient: () => state.contextClient,
}));
vi.mock("../api/useSalesData", () => ({
  isSalesBackendConfigured: () => true,
  useSalesRegions: () => ({ data: { regions: ["Sales - APAC", "Sales - EU"] }, isLoading: false, error: null }),
  useMeetings: (params: MeetingsQueryParams) => {
    salesList(params);
    const enabled = params.enabled !== false;
    const meetings = enabled ? state.salesMeetings : [];
    return {
      data: enabled ? { count: meetings.length, meetings } : undefined,
      isLoading: false,
      isFetching: false,
      error: null,
    };
  },
}));
vi.mock("../components/SalesShell", () => ({
  default: ({ title, children }: { title: string; children: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));
vi.mock("../components/AttachmentsDialog", () => ({ default: () => null }));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "user-under-test" }, retry: () => {} }),
  foldIdentityError: (query: unknown) => query,
}));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router";
import SalesMeetingsPage from "./SalesMeetingsPage";
import { MEETINGS, mockCallContextClient, mockEchoCallsClient } from "../echoCalls/testing/mockCalls";

function Where() {
  const { search } = useLocation();
  return <div data-testid="where">{search}</div>;
}

function renderAt(path = "/sales/meetings") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <QueryClientProvider client={client}>
        <SalesMeetingsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const where = () => new URLSearchParams(screen.getByTestId("where").textContent ?? "");
const bodyRows = () => screen.getAllByRole("row").slice(1);

let echo: { calls: ReturnType<typeof vi.fn>; filters: ReturnType<typeof vi.fn> };
let context: ReturnType<typeof vi.fn>;

beforeEach(() => {
  state.echoConfigured = true;
  state.salesMeetings = MEETINGS.slice(0, 10);
  const echoMock = mockEchoCallsClient();
  echo = { calls: vi.fn(echoMock.calls), filters: vi.fn(echoMock.filters) };
  state.echoClient = echo as unknown as EchoCallsClient;
  context = vi.fn(mockCallContextClient().context);
  state.contextClient = { context } as unknown as CallContextClient;
  salesList.mockClear();
});

// Page tests drive MUI selects and an autocomplete; give a busy runner room.
const SLOW = { timeout: 15000 };

describe("SalesMeetingsPage — the Echo scope", () => {
  it("lists from the Echo backend, with each call's owner, region and opportunity from its own context", async () => {
    renderAt();
    expect(await screen.findByRole("link", { name: "Harbourline – API platform" })).toBeInTheDocument();
    expect(echo.calls).toHaveBeenCalledTimes(1);
    expect(echo.calls.mock.calls[0][0]).toMatchObject({ page: 0, pageSize: 10, owners: [], regions: [] });
    // No further lookup for the page: the list brought its context.
    expect(context).not.toHaveBeenCalled();
    expect(salesList).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));

    const harbourline = bodyRows()[0];
    expect(harbourline).toHaveTextContent("Nadia Perera");
    expect(harbourline).toHaveTextContent("APAC");
    // An opportunity with no owner in Salesforce: the host, marked.
    const meridian = screen.getByText("Meridian – identity discovery").closest("tr") as HTMLElement;
    expect(meridian).toHaveTextContent("priya@wso2.com");
    expect(within(meridian).getByText("Host")).toBeInTheDocument();
  });

  it("sends the filters in the URL to the Echo backend, and lists only what matches", async () => {
    renderAt("/sales/meetings?owner=lars@wso2.com&region=EU&type=renewal&from=2026-11-01&to=2026-11-30");
    await waitFor(() => expect(bodyRows()).toHaveLength(2));
    expect(echo.calls.mock.calls[0][0]).toMatchObject({
      owners: ["lars@wso2.com"],
      regions: ["EU"],
      types: ["renewal"],
      from: "2026-11-01",
      to: "2026-11-30",
    });
    expect(bodyRows().map((row) => within(row).getAllByRole("link")[0].textContent)).toEqual([
      "Nordlys – commercial terms",
      "Nordlys – security questionnaire",
    ]);
  });

  it("filters by several accounts, an account matching its opportunities' calls too", async () => {
    renderAt("/sales/meetings?account=001Hb00000Nordl001&account=001Hb00000Merid001");
    // Nordlys's three deal calls, and Meridian's account call and deal call.
    await waitFor(() => expect(bodyRows()).toHaveLength(5));
    expect(echo.calls.mock.calls[0][0]).toMatchObject({ accounts: ["001Hb00000Nordl001", "001Hb00000Merid001"] });
  });

  it("writes a picked owner to the URL and goes back to the first page", SLOW, async () => {
    renderAt();
    await screen.findByRole("link", { name: "Harbourline – API platform" });
    await userEvent.click(screen.getByRole("button", { name: /next page/i }));
    await waitFor(() => expect(echo.calls).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })));

    await userEvent.click(screen.getByRole("combobox", { name: "Opportunity Owner (AM)" }));
    await userEvent.click(await screen.findByRole("option", { name: /Lars Holm/ }));
    await userEvent.keyboard("{Escape}");

    expect(where().getAll("owner")).toEqual(["lars@wso2.com"]);
    await waitFor(() =>
      expect(echo.calls).toHaveBeenLastCalledWith(expect.objectContaining({ page: 0, owners: ["lars@wso2.com"] })),
    );
    // His deals by his name; his account-only call by his email, as its host.
    await waitFor(() => expect(bodyRows()).toHaveLength(4));
    bodyRows().forEach((row) => expect(row).toHaveTextContent(/Lars Holm|lars@wso2\.com/));
  });

  it("finds an account or opportunity by name as you type, and filters by the one picked", SLOW, async () => {
    renderAt();
    await screen.findByRole("link", { name: "Harbourline – API platform" });
    await userEvent.type(screen.getByRole("combobox", { name: "Account or opportunity" }), "nord");
    await waitFor(() => expect(echo.filters).toHaveBeenCalledWith("nord"));
    // Once the narrowed answer is in: only Nordlys is offered.
    await waitFor(() => expect(screen.queryByRole("option", { name: /Harbourline/ })).not.toBeInTheDocument());
    expect(screen.getByRole("option", { name: /Nordlys Energi AS/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("option", { name: /Nordlys – IAM renewal/ }));

    expect(where().get("opportunity")).toBe("006Hb00000Nordl001");
    expect(where().get("account")).toBeNull();
    await waitFor(() => expect(bodyRows()).toHaveLength(3));
  });

  it("clears the Echo filters, keeping the search", SLOW, async () => {
    renderAt("/sales/meetings?q=nordlys&region=EU");
    await waitFor(() => expect(bodyRows()).toHaveLength(3));
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(where().toString()).toBe("q=nordlys");
  });

  it("falls back to the Sales backend's list, with a notice, when the Echo backend fails", SLOW, async () => {
    echo.calls.mockRejectedValue(new Error("down"));
    renderAt("/sales/meetings?owner=lars@wso2.com");
    // After the hook's one retry.
    expect(
      await screen.findByText(/isn't available right now, so those filters aren't applied/, {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    await waitFor(() => expect(salesList).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true, echoOnly: true })));
    expect(screen.queryByRole("group", { name: "Filter calls" })).not.toBeInTheDocument();
    // The rows still get their live details, in one request for the page.
    await waitFor(() => expect(context).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("link", { name: "Harbourline – API platform" })).toBeInTheDocument();
  });

  it("lists from the Sales backend, with a notice and no Echo request, when the Echo backend isn't configured", () => {
    state.echoConfigured = false;
    renderAt();
    expect(screen.getByText(/the Echo backend \(ONE_WSO2_ECHO_BACKEND_URL\) isn't configured/)).toBeInTheDocument();
    expect(echo.calls).not.toHaveBeenCalled();
    expect(context).not.toHaveBeenCalled();
    expect(bodyRows()).toHaveLength(10);
    // Today's data: the host, marked, and the meeting's own customer name.
    expect(bodyRows()[0]).toHaveTextContent("nadia@wso2.com");
    expect(within(bodyRows()[0]).getByText("Host")).toBeInTheDocument();
  });
});

describe("SalesMeetingsPage — the All scope", () => {
  it("lists from the Sales backend and asks for the page's live details in one request", async () => {
    renderAt("/sales/meetings?scope=all");
    expect(await screen.findByRole("link", { name: "Harbourline – API platform" })).toBeInTheDocument();
    expect(echo.calls).not.toHaveBeenCalled();
    expect(context).toHaveBeenCalledTimes(1);
    const request = context.mock.calls[0][0] as { opportunityIds: string[]; accountIds: string[] };
    expect(request.opportunityIds).toEqual([...request.opportunityIds].sort());
    expect(new Set(request.opportunityIds).size).toBe(request.opportunityIds.length);
    expect(request.opportunityIds).toContain("006Hb00000Nordl001");
    // Account-only calls, and the accounts deal snapshots name.
    expect(request.accountIds).toContain("001Hb00000Merid001");
    expect(request.accountIds).toContain("001Hb00000Harbr001");
    // An account-only call takes its account's region.
    const meridian = screen.getByText("Meridian Bank – monthly sync").closest("tr") as HTMLElement;
    expect(meridian).toHaveTextContent("EU");
  });

  it("keeps the list, on today's data, when the live details fail", SLOW, async () => {
    context.mockRejectedValue(new Error("down"));
    renderAt("/sales/meetings?scope=all");
    // Rows are there at once; once the request (and its one retry) fails, today's data stays.
    expect(bodyRows()).toHaveLength(10);
    await waitFor(() => expect(within(bodyRows()[0]).getByText("Host")).toBeInTheDocument(), { timeout: 5000 });
    expect(context).toHaveBeenCalledTimes(2);
    expect(bodyRows()).toHaveLength(10);
    expect(within(bodyRows()[0]).getByRole("link", { name: "Harbourline" })).toHaveAttribute(
      "href",
      "/sales/deals/006Hb00000Harbr001",
    );
  });

  it("switches scope, keeping only the search", SLOW, async () => {
    renderAt("/sales/meetings?q=harbour&owner=nadia@wso2.com");
    await userEvent.click(screen.getByRole("button", { name: "All" }));
    expect(where().toString()).toBe("scope=all&q=harbour");
  });
});
