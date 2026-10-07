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
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { type JSX } from "react";
import { ENGINEERING_ADMIN_ITEM_ID, downloadStatsPaths } from "@constants/downloadStatsApps";
import { claimOf, foldVisibility, type VisibilityShell } from "@components/side-rail/visibilityFold";
import { engineeringAdminVisibility } from "@features/engineering/api/engineeringAdminVisibility";
import { useTrackedRepositories } from "@features/engineering/api/useTrackedRepositories";
import { formatDateTime } from "../utils/format";
import EngineeringAdminPage from "./EngineeringAdminPage";

vi.mock("@asgardeo/react", () => ({
  useAsgardeo: () => ({
    isSignedIn: true,
    isLoading: false,
    getAccessToken: async () => "test-token",
    signIn: vi.fn(),
  }),
}));

const originalConfig = window.config;
const originalShowPicker = HTMLInputElement.prototype.showPicker;
let showPicker: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // jsdom has no native picker. The calendar button asks for one; the test
  // then sets the hidden input, which is what a person's pick would do.
  showPicker = vi.fn();
  HTMLInputElement.prototype.showPicker = showPicker as unknown as () => void;
});

afterEach(() => {
  HTMLInputElement.prototype.showPicker = originalShowPicker;
  window.config = originalConfig;
  vi.unstubAllGlobals();
});

interface RepoRow {
  id: number;
  orgName: string;
  repoName: string;
  productName: string | null;
  assetPrefixes: string[];
  isActive: boolean;
  trackPackages: boolean;
}

const tracked: { count: number; repositories: RepoRow[] } = {
  count: 3,
  repositories: [
    {
      id: 7,
      orgName: "wso2",
      repoName: "product-apim",
      productName: "API Manager",
      assetPrefixes: ["wso2am"],
      isActive: true,
      trackPackages: false,
    },
    {
      id: 9,
      orgName: "wso2",
      repoName: "product-old",
      productName: "Retired",
      assetPrefixes: [],
      isActive: false,
      trackPackages: false,
    },
    {
      id: 11,
      orgName: "wso2",
      repoName: "product-is",
      productName: null,
      assetPrefixes: ["wso2is", "wso2is-tool"],
      isActive: true,
      trackPackages: true,
    },
  ],
};

const longError =
  "snapshot write failed: the collector could not persist the nightly snapshot for product-apim";

const syncLogs = {
  count: 4,
  logs: [
    {
      id: 4,
      source: "DB_SYNC",
      status: "FAILED",
      reposSynced: 3,
      reposFailed: 1,
      errorMessage: longError,
      startedAt: "2026-10-04T02:00:00Z",
      completedAt: "2026-10-04T02:05:00Z",
    },
    {
      id: 5,
      source: "PACKAGE_SCRAPE",
      status: "SUCCESS",
      reposSynced: 1,
      reposFailed: 0,
      errorMessage: null,
      startedAt: "2026-10-05T02:00:00Z",
      completedAt: "2026-10-05T02:01:00Z",
    },
    {
      id: 6,
      source: "DB_SYNC",
      status: "PARTIAL_FAILURE",
      reposSynced: 2,
      reposFailed: 1,
      errorMessage: null,
      startedAt: "2026-10-06T02:00:00Z",
      completedAt: null,
    },
    {
      id: 7,
      source: "PACKAGE_SCRAPE",
      status: "STARTED",
      reposSynced: 0,
      reposFailed: 0,
      errorMessage: null,
      startedAt: "2026-10-07T02:00:00Z",
      completedAt: null,
    },
  ],
};

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

function pathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function methodOf(init?: RequestInit): string {
  return init?.method ?? "GET";
}

interface Answers {
  userInfo?: () => Response | Promise<Response>;
  repositories?: () => Response | Promise<Response>;
  logs?: () => Response | Promise<Response>;
  products?: () => Response | Promise<Response>;
  post?: (url: string, init: RequestInit) => Response | Promise<Response>;
  patch?: (url: string, init: RequestInit) => Response | Promise<Response>;
  delete?: (url: string, init: RequestInit) => Response | Promise<Response>;
}

function stubApi(answers: Answers = {}) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = methodOf(init);
    const path = pathname(url);
    if (path === "/api/v1/user-info") {
      return (answers.userInfo ?? (() => json({ email: "a@wso2.com", isAdmin: true })))();
    }
    if (method === "POST") return (answers.post ?? (() => json({ id: 40 }, 201)))(url, init ?? {});
    if (method === "PATCH") return (answers.patch ?? (() => new Response(null, { status: 204 })))(url, init ?? {});
    if (method === "DELETE") return (answers.delete ?? (() => new Response(null, { status: 204 })))(url, init ?? {});
    if (path === "/api/v1/admin/repositories") return (answers.repositories ?? (() => json(tracked)))();
    if (path === "/api/v1/admin/sync/logs") return (answers.logs ?? (() => json(syncLogs)))();
    if (path === "/api/v1/repositories") {
      return (answers.products ?? (() => json({ count: 0, repositories: [] })))();
    }
    return json({ message: `unexpected ${method} ${path}` }, 404);
  });
}

function calls(fetchMock: ReturnType<typeof stubApi>, path: string, method = "GET"): number {
  return fetchMock.mock.calls.filter((call) => {
    const init = call[1] as RequestInit | undefined;
    return methodOf(init) === method && pathname(String(call[0])) === path;
  }).length;
}

function bodies(fetchMock: ReturnType<typeof stubApi>, method: string): unknown[] {
  return fetchMock.mock.calls
    .filter((call) => methodOf(call[1] as RequestInit | undefined) === method)
    .map((call) => JSON.parse(String((call[1] as RequestInit).body)));
}

function urls(fetchMock: ReturnType<typeof stubApi>, method: string): string[] {
  return fetchMock.mock.calls
    .filter((call) => methodOf(call[1] as RequestInit | undefined) === method)
    .map((call) => String(call[0]));
}

function deferred(): { promise: Promise<Response>; finish: (response: Response) => void } {
  let finish: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  return { promise, finish };
}

function repositoryStore(seed: RepoRow[] = tracked.repositories) {
  let rows = seed.map((row) => ({ ...row, assetPrefixes: [...row.assetPrefixes] }));
  let nextId = 100;
  return {
    list: () => json({ count: rows.length, repositories: rows }),
    create: (init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Omit<RepoRow, "id">;
      rows = [...rows, { id: nextId, ...body }];
      nextId += 1;
      return json({ id: nextId - 1 }, 201);
    },
    update: (url: string, init?: RequestInit) => {
      const id = Number(url.match(/(\d+)$/)?.[1]);
      const body = JSON.parse(String(init?.body)) as Partial<RepoRow>;
      rows = rows.map((row) => (row.id === id ? { ...row, ...body } : row));
      return new Response(null, { status: 204 });
    },
    deactivate: (url: string) => {
      const id = Number(url.match(/(\d+)$/)?.[1]);
      rows = rows.map((row) => (row.id === id ? { ...row, isActive: false } : row));
      return new Response(null, { status: 204 });
    },
  };
}

/** The products query the other screens read, so a write's refresh is a real fetch. */
function ProductListProbe(): JSX.Element {
  const products = useTrackedRepositories();
  return <div>{products.data ? "products loaded" : "products waiting"}</div>;
}

function AdminHarness({
  client,
  watchProducts,
}: {
  client: QueryClient;
  watchProducts: boolean;
}): JSX.Element {
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[downloadStatsPaths.admin]}>
        <Routes>
          <Route path={downloadStatsPaths.admin} element={<EngineeringAdminPage />} />
        </Routes>
      </MemoryRouter>
      {watchProducts ? <ProductListProbe /> : null}
    </QueryClientProvider>
  );
}

function renderAdmin(watchProducts = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(<AdminHarness client={client} watchProducts={watchProducts} />);
  return {
    ...view,
    showProducts(next: boolean) {
      view.rerender(<AdminHarness client={client} watchProducts={next} />);
    },
  };
}

function openAdmin(answers?: Answers, watchProducts = false) {
  window.config = configured();
  const fetchMock = stubApi(answers);
  vi.stubGlobal("fetch", fetchMock);
  const view = renderAdmin(watchProducts);
  return { fetchMock, ...view };
}

function cardAround(text: string): HTMLElement {
  const card = screen.getByText(text).closest(".MuiCard-root");
  if (!card) throw new Error(`no card around ${text}`);
  return card as HTMLElement;
}

function repositoriesCard(): HTMLElement {
  return cardAround("Repository");
}

function syncCard(): HTMLElement {
  return cardAround("Sync & scrape history");
}

function column(scope: HTMLElement, label: string): HTMLElement {
  const found = within(scope)
    .getAllByRole("columnheader")
    .find((header) => (header.textContent ?? "").includes(label));
  if (!found) throw new Error(`no column ${label}`);
  return found;
}

function chip(scope: HTMLElement, label: string): HTMLElement {
  const found = within(scope)
    .getAllByText(label)
    .map((node) => node.closest(".MuiChip-root"))
    .find((node): node is HTMLElement => node instanceof HTMLElement);
  if (!found) throw new Error(`no chip ${label}`);
  return found;
}

function rowOf(name: string): HTMLElement {
  const row = screen.getByRole("cell", { name }).closest("tr");
  if (!row) throw new Error(`no row ${name}`);
  return row as HTMLElement;
}

function manyRepositories(count: number): { count: number; repositories: RepoRow[] } {
  return {
    count,
    repositories: Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      orgName: "wso2",
      repoName: `repo-${index + 1}`,
      productName: `Product ${index + 1}`,
      assetPrefixes: [],
      isActive: true,
      trackPackages: false,
    })),
  };
}

function manyLogs(count: number) {
  return {
    count,
    logs: Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      source: index % 2 === 0 ? "DB_SYNC" : "PACKAGE_SCRAPE",
      status: "SUCCESS",
      reposSynced: index,
      reposFailed: 0,
      errorMessage: null,
      startedAt: `2026-09-${String(index + 1).padStart(2, "0")}T02:00:00Z`,
      completedAt: `2026-09-${String(index + 1).padStart(2, "0")}T02:01:00Z`,
    })),
  };
}

function rail(isAdmin: boolean) {
  const answer = engineeringAdminVisibility({ isAdmin, resolving: false });
  return foldVisibility([{ name: "engineering", claim: claimOf("engineering"), ...answer }], {
    perspectiveKey: "engineering",
    sectionIds: new Set([ENGINEERING_ADMIN_ITEM_ID]),
    sriLankaOnlyIds: new Set(),
    isSriLankaEmployee: true,
    employeeRecordResolving: false,
    employeeRecordFailed: false,
    retryEmployeeRecord: () => undefined,
    capabilities: new Set(),
  } satisfies VisibilityShell);
}

describe("Admin access", () => {
  it("shows the resolving spinner and not the screen while Admin access is still being checked", async () => {
    window.config = configured();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    renderAdmin();
    expect(await screen.findByText("Checking your Admin access…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add repository" })).not.toBeInTheDocument();
    expect(screen.queryByText(/don't have access/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Repository" })).not.toBeInTheDocument();
  });

  it("shows an error the person can retry when the Admin check fails", async () => {
    window.config = configured();
    const fetchMock = vi.fn(async () => json({ message: "no" }, 500));
    vi.stubGlobal("fetch", fetchMock);
    renderAdmin();
    expect(await screen.findByText(/couldn't check admin access/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });

  it("hides the row and the screen from someone who is not an admin", async () => {
    expect(rail(false).canSee({ id: ENGINEERING_ADMIN_ITEM_ID })).toBe(false);
    expect(rail(true).canSee({ id: ENGINEERING_ADMIN_ITEM_ID })).toBe(true);

    const { fetchMock } = openAdmin({ userInfo: () => json({ email: "a@wso2.com", isAdmin: false }) });
    expect(await screen.findByText(/don't have access to admin/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add repository" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Repository" })).not.toBeInTheDocument();
    expect(urls(fetchMock, "GET").some((url) => url.includes("/admin/repositories"))).toBe(false);
  });
});

describe("Tracked repositories", () => {
  it("lists every tracked repository, including inactive ones, in the standalone's columns", async () => {
    openAdmin();
    expect(await screen.findByRole("cell", { name: "API Manager" })).toBeInTheDocument();

    const add = screen.getByRole("button", { name: "Add repository" });
    expect(add).toHaveClass("MuiButton-contained");
    expect(add.querySelector("svg.lucide-plus")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Add tracked repository" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start|run now|sync now/i })).not.toBeInTheDocument();

    const table = repositoriesCard();
    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent?.trim())).toEqual([
      "Product",
      "Repository",
      "Organization",
      "Prefixes",
      "Status",
      "Packages",
      "Actions",
    ]);

    const manager = rowOf("product-apim");
    expect(within(manager).getByRole("cell", { name: "API Manager" })).toBeInTheDocument();
    expect(within(manager).getByRole("cell", { name: "wso2" })).toBeInTheDocument();
    expect(within(manager).getByRole("cell", { name: "wso2am" })).toBeInTheDocument();
    expect(chip(manager, "Active")).toHaveClass("MuiChip-colorSuccess");
    expect(manager).not.toHaveStyle({ opacity: "0.5" });

    const retired = rowOf("product-old");
    expect(within(retired).getByRole("cell", { name: "Retired" })).toBeInTheDocument();
    expect(within(retired).getByRole("cell", { name: "All" })).toBeInTheDocument();
    expect(chip(retired, "Inactive")).toHaveClass("MuiChip-colorDefault");
    expect(retired).toHaveStyle({ opacity: "0.5" });

    const unnamed = rowOf("product-is");
    expect(within(unnamed).getByRole("cell", { name: "—" })).toBeInTheDocument();
    expect(within(unnamed).getByRole("cell", { name: "wso2is, wso2is-tool" })).toBeInTheDocument();
  });

  it("names the package switch, the activate switch and the edit pencil", async () => {
    const user = userEvent.setup();
    openAdmin();
    await screen.findByRole("cell", { name: "API Manager" });

    const packages = screen.getByRole("switch", { name: "Start tracking packages for API Manager" });
    const active = screen.getByRole("switch", { name: "Deactivate API Manager" });
    expect(packages.closest(".MuiSwitch-switchBase")).toHaveClass("MuiSwitch-colorSuccess");
    expect(active.closest(".MuiSwitch-switchBase")).toHaveClass("MuiSwitch-colorSuccess");
    expect(screen.getByRole("switch", { name: "Stop tracking packages for product-is" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Activate Retired" })).toBeInTheDocument();

    await user.hover(packages);
    expect(await screen.findByText("Start tracking packages for API Manager")).toBeInTheDocument();
    await user.unhover(packages);

    const edit = within(rowOf("product-apim")).getByRole("button", { name: "Edit" });
    expect(edit.querySelector("svg.lucide-pencil")).not.toBeNull();
    await user.hover(edit);
    expect(await screen.findByText("Edit")).toBeInTheDocument();
  });

  it("asks before enabling or disabling package tracking, in green or red, and updates that field", async () => {
    const user = userEvent.setup();
    const { fetchMock } = openAdmin();
    await screen.findByRole("cell", { name: "API Manager" });

    await user.click(screen.getByRole("switch", { name: "Start tracking packages for API Manager" }));
    const enableDialog = screen.getByRole("dialog", { name: "Enable package tracking?" });
    expect(
      within(enableDialog).getByText(
        'Start tracking packages for "API Manager"? web scraper will begin covering it on the next cron-job.',
      ),
    ).toBeInTheDocument();
    const enable = within(enableDialog).getByRole("button", { name: "Enable" });
    expect(enable).toHaveClass("MuiButton-containedSuccess");
    await user.click(enable);
    await waitFor(() => expect(bodies(fetchMock, "PATCH")).toEqual([{ trackPackages: true }]));
    expect(urls(fetchMock, "PATCH")[0]).toContain("/admin/repositories/7");
    expect(urls(fetchMock, "DELETE")).toHaveLength(0);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("switch", { name: "Stop tracking packages for product-is" }));
    const disableDialog = screen.getByRole("dialog", { name: "Disable package tracking?" });
    expect(
      within(disableDialog).getByText(
        'Stop tracking packages for "product-is"? web scraper will no longer cover it from the next cron-job onward.',
      ),
    ).toBeInTheDocument();
    expect(within(disableDialog).getByRole("button", { name: "Disable" })).toHaveClass("MuiButton-containedError");
    await user.click(within(disableDialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("asks before activating or deactivating, activates with update, and deactivates with deactivate", async () => {
    const user = userEvent.setup();
    const { fetchMock } = openAdmin();
    await screen.findByRole("cell", { name: "Retired" });

    await user.click(screen.getByRole("switch", { name: "Activate Retired" }));
    const activateDialog = screen.getByRole("dialog", { name: "Activate repository?" });
    expect(
      within(activateDialog).getByText(
        'Activate "Retired"? It will start appearing in charts, stats, and tables.',
      ),
    ).toBeInTheDocument();
    const activate = within(activateDialog).getByRole("button", { name: "Activate" });
    expect(activate).toHaveClass("MuiButton-containedSuccess");
    await user.click(activate);
    await waitFor(() => expect(bodies(fetchMock, "PATCH")).toEqual([{ isActive: true }]));
    expect(urls(fetchMock, "PATCH")[0]).toContain("/admin/repositories/9");
    expect(urls(fetchMock, "DELETE")).toHaveLength(0);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("switch", { name: "Deactivate API Manager" }));
    const deactivateDialog = screen.getByRole("dialog", { name: "Deactivate repository?" });
    expect(
      within(deactivateDialog).getByText(
        'Deactivate "API Manager"? It will be hidden from all charts, stats, and tables.',
      ),
    ).toBeInTheDocument();
    const deactivate = within(deactivateDialog).getByRole("button", { name: "Deactivate" });
    expect(deactivate).toHaveClass("MuiButton-containedError");
    await user.click(deactivate);
    await waitFor(() => expect(urls(fetchMock, "DELETE").some((url) => url.includes("/admin/repositories/7"))).toBe(true));
    expect(bodies(fetchMock, "PATCH")).toEqual([{ isActive: true }]);
  });

  it("shows the server's message and keeps the confirm open when a switch fails, then clears it", async () => {
    const user = userEvent.setup();
    openAdmin({
      patch: () => json({ message: "tracking failed" }, 500),
      delete: () => json({ message: "deactivate failed" }, 500),
    });
    await screen.findByRole("cell", { name: "API Manager" });

    await user.click(screen.getByRole("switch", { name: "Start tracking packages for API Manager" }));
    await user.click(screen.getByRole("button", { name: "Enable" }));
    expect(await screen.findByText("tracking failed")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Enable package tracking?" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Start tracking packages for API Manager", hidden: true })).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByRole("switch", { name: "Start tracking packages for API Manager" }));
    expect(screen.queryByText("tracking failed")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("switch", { name: "Deactivate API Manager" }));
    await user.click(screen.getByRole("button", { name: "Deactivate" }));
    expect(await screen.findByText("deactivate failed")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Deactivate repository?" })).toBeInTheDocument();
    expect(screen.queryByText(/failed to deactivate/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByRole("switch", { name: "Deactivate API Manager" }));
    expect(screen.queryByText("deactivate failed")).not.toBeInTheDocument();
  });

  it("disables the confirm button and that row's switches while the request is in flight", async () => {
    const user = userEvent.setup();
    const pending = deferred();
    const { fetchMock } = openAdmin({ delete: () => pending.promise });
    await screen.findByRole("cell", { name: "API Manager" });

    await user.click(screen.getByRole("switch", { name: "Deactivate API Manager" }));
    await user.click(screen.getByRole("button", { name: "Deactivate" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Deactivate" })).toBeDisabled();
      expect(urls(fetchMock, "DELETE")).toHaveLength(1);
    });
    expect(screen.getByRole("switch", { name: "Deactivate API Manager", hidden: true })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Start tracking packages for API Manager", hidden: true })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Activate Retired", hidden: true })).toBeEnabled();
    expect(screen.getByRole("switch", { name: "Stop tracking packages for product-is", hidden: true })).toBeEnabled();

    pending.finish(new Response(null, { status: 204 }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("switch", { name: "Deactivate API Manager" })).toBeEnabled();
  });

  it("pages tracked repositories ten at a time, with 10, 25, 50 and 100 and first and last", async () => {
    const user = userEvent.setup();
    openAdmin({ repositories: () => json(manyRepositories(12)) });
    expect(await screen.findByRole("cell", { name: "Product 1" })).toBeInTheDocument();
    const table = repositoriesCard();
    expect(within(table).getByRole("cell", { name: "Product 10" })).toBeInTheDocument();
    expect(within(table).queryByRole("cell", { name: "Product 11" })).not.toBeInTheDocument();
    expect(within(table).getByText("1–10 of 12")).toBeInTheDocument();

    await user.click(within(table).getByRole("button", { name: /go to next page/i }));
    expect(within(table).getByRole("cell", { name: "Product 11" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "Product 12" })).toBeInTheDocument();
    expect(within(table).queryByRole("cell", { name: "Product 1" })).not.toBeInTheDocument();

    await user.click(within(table).getByRole("button", { name: /go to first page/i }));
    expect(within(table).getByRole("cell", { name: "Product 1" })).toBeInTheDocument();
    await user.click(within(table).getByRole("button", { name: /go to last page/i }));
    expect(within(table).getByRole("cell", { name: "Product 12" })).toBeInTheDocument();

    await user.click(within(table).getByRole("combobox", { name: /rows per page/i }));
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "10",
      "25",
      "50",
      "100",
    ]);
    await user.click(within(listbox).getByRole("option", { name: "25" }));
    expect(within(table).getByRole("cell", { name: "Product 1" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "Product 12" })).toBeInTheDocument();
    expect(within(table).getByText("1–12 of 12")).toBeInTheDocument();
  });
});

describe("Add and edit form", () => {
  it("reads the standalone's titles, labels and helpers, and fixes org and repo on edit", async () => {
    const user = userEvent.setup();
    openAdmin();
    await screen.findByRole("cell", { name: "API Manager" });

    await user.click(screen.getByRole("button", { name: "Add repository" }));
    const add = screen.getByRole("dialog", { name: "Add tracked repository" });
    expect(within(add).getByRole("textbox", { name: "Org name" })).toBeRequired();
    expect(within(add).getByRole("textbox", { name: "Repo name" })).toBeRequired();
    expect(within(add).getByRole("textbox", { name: "Product name" })).not.toBeRequired();
    expect(within(add).getByText("GitHub org, also used as the owner path segment (e.g. wso2).")).toBeInTheDocument();
    expect(within(add).getByText("Display name shown on the dashboard (optional).")).toBeInTheDocument();
    expect(
      within(add).getByText("Comma-separated release-asset name prefixes to track. Leave empty for all assets."),
    ).toBeInTheDocument();
    expect(within(add).getByRole("switch", { name: "Active (synced daily)" })).toBeChecked();
    expect(
      within(add).getByRole("switch", { name: "Track packages (GitHub container packages, scraped nightly)" }),
    ).not.toBeChecked();
    expect(within(add).getByRole("button", { name: "Add" })).toBeDisabled();
    await user.type(within(add).getByRole("textbox", { name: "Org name" }), "   ");
    await user.type(within(add).getByRole("textbox", { name: "Repo name" }), "product-is");
    expect(within(add).getByRole("button", { name: "Add" })).toBeDisabled();
    await user.click(within(add).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(within(rowOf("product-apim")).getByRole("button", { name: "Edit" }));
    const edit = screen.getByRole("dialog", { name: "Edit repository" });
    expect(within(edit).getByRole("textbox", { name: "Org name" })).toBeDisabled();
    expect(within(edit).getByRole("textbox", { name: "Org name" })).toHaveValue("wso2");
    expect(within(edit).getByRole("textbox", { name: "Repo name" })).toBeDisabled();
    expect(within(edit).getByRole("textbox", { name: "Repo name" })).toHaveValue("product-apim");
    expect(within(edit).getByRole("textbox", { name: "Product name" })).toHaveValue("API Manager");
    expect(within(edit).getByRole("textbox", { name: "Asset prefixes" })).toHaveValue("wso2am");
    expect(within(edit).getByRole("button", { name: "Save" })).toBeEnabled();
    expect(within(edit).queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
  });

  it("sends the add and the edit, and keeps the input with the server's message when saving fails", async () => {
    const user = userEvent.setup();
    const pending = deferred();
    let posts = 0;
    const { fetchMock } = openAdmin({
      post: () => {
        posts += 1;
        return posts === 1 ? pending.promise : json({ message: "already tracked" }, 500);
      },
    });
    await screen.findByRole("cell", { name: "API Manager" });

    await user.click(screen.getByRole("button", { name: "Add repository" }));
    await user.type(screen.getByRole("textbox", { name: "Org name" }), "wso2");
    await user.type(screen.getByRole("textbox", { name: "Repo name" }), "product-is");
    await user.type(screen.getByRole("textbox", { name: "Asset prefixes" }), " wso2am , wso2is ");
    await user.click(screen.getByRole("switch", { name: "Active (synced daily)" }));
    await user.click(
      screen.getByRole("switch", { name: "Track packages (GitHub container packages, scraped nightly)" }),
    );
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
      expect(bodies(fetchMock, "POST")).toEqual([
        {
          orgName: "wso2",
          repoName: "product-is",
          productName: null,
          assetPrefixes: ["wso2am", "wso2is"],
          isActive: false,
          trackPackages: true,
        },
      ]);
    });
    pending.finish(json({ message: "already tracked" }, 500));
    expect(await screen.findByText("already tracked")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Add tracked repository" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Org name" })).toHaveValue("wso2");
    expect(screen.getByRole("textbox", { name: "Repo name" })).toHaveValue("product-is");
    expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(within(rowOf("product-apim")).getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByRole("textbox", { name: "Product name" }));
    await user.type(screen.getByRole("textbox", { name: "Product name" }), "APIM");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(bodies(fetchMock, "PATCH")).toHaveLength(1));
    expect(bodies(fetchMock, "PATCH")[0]).toEqual({
      productName: "APIM",
      assetPrefixes: ["wso2am"],
      isActive: true,
      trackPackages: false,
    });
    expect(urls(fetchMock, "PATCH")[0]).toContain("/admin/repositories/7");
    expect(bodies(fetchMock, "PATCH")[0]).not.toHaveProperty("orgName");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("Refresh after a write", () => {
  async function renderWritable() {
    const store = repositoryStore();
    const view = openAdmin(
      {
        repositories: () => store.list(),
        post: (_url, init) => store.create(init),
        patch: (url, init) => store.update(url, init),
        delete: (url) => store.deactivate(url),
      },
      true,
    );
    await screen.findByRole("cell", { name: "API Manager" });
    await screen.findByText("products loaded");
    const baseline = {
      products: calls(view.fetchMock, "/api/v1/repositories"),
      userInfo: calls(view.fetchMock, "/api/v1/user-info"),
    };
    view.showProducts(false);
    return { ...view, baseline };
  }

  async function expectRefreshed(
    fetchMock: ReturnType<typeof stubApi>,
    baseline: { products: number; userInfo: number },
  ) {
    await waitFor(() => expect(calls(fetchMock, "/api/v1/repositories")).toBeGreaterThan(baseline.products));
    expect(calls(fetchMock, "/api/v1/user-info")).toBe(baseline.userInfo);
    baseline.products = calls(fetchMock, "/api/v1/repositories");
  }

  function setField(name: string, value: string): void {
    fireEvent.change(screen.getByRole("textbox", { name }), { target: { value } });
  }

  it("refreshes the tracked repositories and the products after a repository is added", async () => {
    const user = userEvent.setup();
    const { fetchMock, baseline } = await renderWritable();
    await user.click(screen.getByRole("button", { name: "Add repository" }));
    setField("Org name", "wso2");
    setField("Repo name", "choreo");
    setField("Product name", "Choreo");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByRole("cell", { name: "Choreo" })).toBeInTheDocument();
    await expectRefreshed(fetchMock, baseline);
  });

  it("refreshes the tracked repositories and the products after a repository is edited", async () => {
    const user = userEvent.setup();
    const { fetchMock, baseline } = await renderWritable();
    await user.click(within(rowOf("product-apim")).getByRole("button", { name: "Edit" }));
    setField("Product name", "APIM");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("cell", { name: "APIM" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "API Manager" })).not.toBeInTheDocument();
    await expectRefreshed(fetchMock, baseline);
  });

  it("refreshes the tracked repositories and the products after an inactive repository is activated", async () => {
    const user = userEvent.setup();
    const { fetchMock, baseline } = await renderWritable();
    await user.click(screen.getByRole("switch", { name: "Activate Retired" }));
    await user.click(screen.getByRole("button", { name: "Activate" }));
    await waitFor(() => expect(within(rowOf("Retired")).getByText("Active")).toBeInTheDocument());
    await expectRefreshed(fetchMock, baseline);
  });

  it("refreshes the tracked repositories and the products after a repository is deactivated, and keeps it listed", async () => {
    const user = userEvent.setup();
    const { fetchMock, baseline } = await renderWritable();
    await user.click(screen.getByRole("switch", { name: "Deactivate API Manager" }));
    await user.click(screen.getByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(within(rowOf("API Manager")).getByText("Inactive")).toBeInTheDocument());
    expect(screen.getByRole("cell", { name: "API Manager" })).toBeInTheDocument();
    await expectRefreshed(fetchMock, baseline);
  });

  it("refreshes the tracked repositories and the products after package tracking is toggled", async () => {
    const user = userEvent.setup();
    const { fetchMock, baseline } = await renderWritable();
    await user.click(screen.getByRole("switch", { name: "Stop tracking packages for product-is" }));
    await user.click(screen.getByRole("button", { name: "Disable" }));
    expect(await screen.findByRole("switch", { name: "Start tracking packages for product-is" })).toBeInTheDocument();
    await expectRefreshed(fetchMock, baseline);
  });
});

describe("Sync and scrape history", () => {
  it("shows source labels, status chips, local times and an ellipsised error", async () => {
    openAdmin();
    expect(await screen.findByRole("heading", { name: "Sync & scrape history" })).toBeInTheDocument();
    await screen.findAllByText("DB Sync");
    expect(screen.queryByRole("heading", { name: "Collection jobs" })).not.toBeInTheDocument();

    const card = syncCard();
    const headers = within(card)
      .getAllByRole("columnheader")
      .map((header) => (header.textContent ?? "").replace(/\s+/g, " ").trim());
    expect(headers[0]).toMatch(/^Source/);
    expect(headers[1]).toMatch(/^Status/);
    expect(headers.slice(2)).toEqual(["Synced", "Failed", "Started", "Completed", "Error"]);

    expect(chip(card, "Failed")).toHaveClass("MuiChip-colorError");
    expect(chip(card, "Success")).toHaveClass("MuiChip-colorSuccess");
    expect(chip(card, "Partial failure")).toHaveClass("MuiChip-colorWarning");
    expect(chip(card, "Started")).toHaveClass("MuiChip-colorInfo");
    expect(within(card).getAllByText("DB Sync").length).toBeGreaterThan(0);
    expect(within(card).getAllByText("Scraper Sync").length).toBeGreaterThan(0);

    const started = formatDateTime("2026-10-04T02:00:00Z");
    const completed = formatDateTime("2026-10-04T02:05:00Z");
    expect(within(card).getByRole("cell", { name: started })).toBeInTheDocument();
    expect(within(card).getByRole("cell", { name: completed })).toBeInTheDocument();
    expect(screen.queryByText("2026-10-04T02:00:00Z")).not.toBeInTheDocument();
    expect(started).toMatch(/^\d{2} \w+ \d{4}, \d{2}:\d{2}$/);

    const failed = within(card).getByTitle(longError).closest("tr");
    if (!failed) throw new Error("no failed row");
    expect(within(failed as HTMLElement).queryByText("—")).not.toBeInTheDocument();

    const error = within(card).getByTitle(longError);
    expect(error).toHaveTextContent(longError);
    expect(error).toHaveStyle({ maxWidth: "280px", textOverflow: "ellipsis", whiteSpace: "nowrap" });

    const success = within(card).getByText("Success").closest("tr");
    if (!success) throw new Error("no success row");
    const successCells = within(success as HTMLElement).getAllByRole("cell");
    expect(successCells[5]).toHaveTextContent(formatDateTime("2026-10-05T02:01:00Z"));
    expect(successCells[6]).toHaveTextContent("—");
    expect(successCells[6]).not.toHaveAttribute("title");

    const partial = within(card).getByText("Partial failure").closest("tr");
    if (!partial) throw new Error("no partial row");
    expect(within(partial as HTMLElement).getAllByRole("cell")[5]).toHaveTextContent("—");
  });

  it("filters by source and status from the column headers", async () => {
    const user = userEvent.setup();
    openAdmin();
    await screen.findAllByText("DB Sync");
    const card = syncCard();

    await user.click(within(card).getByRole("combobox", { name: "Source" }));
    const sources = await screen.findByRole("listbox");
    expect(within(sources).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "All",
      "DB Sync",
      "Scraper Sync",
    ]);
    await user.click(within(sources).getByRole("option", { name: "Scraper Sync" }));
    const scraped = card.querySelector("tbody") as HTMLElement;
    expect(within(scraped).queryByText("DB Sync")).not.toBeInTheDocument();
    expect(within(scraped).getAllByText("Scraper Sync")).toHaveLength(2);

    await user.click(within(card).getByRole("combobox", { name: "Source" }));
    await user.click(within(await screen.findByRole("listbox")).getByRole("option", { name: "All" }));

    await user.click(within(card).getByRole("combobox", { name: "Status" }));
    const statuses = await screen.findByRole("listbox");
    expect(within(statuses).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "All",
      "Success",
      "Partial failure",
      "Failed",
      "Started",
    ]);
    await user.click(within(statuses).getByRole("option", { name: "Partial failure" }));
    const partial = card.querySelector("tbody") as HTMLElement;
    expect(within(partial).getByText("Partial failure")).toBeInTheDocument();
    expect(within(partial).queryByText("Success")).not.toBeInTheDocument();
    expect(within(partial).queryByText("Failed")).not.toBeInTheDocument();
    expect(within(partial).queryByText("Started")).not.toBeInTheDocument();
  });

  it("filters started and completed by the calendar day and says when nothing matches", async () => {
    const user = userEvent.setup();
    openAdmin();
    await screen.findAllByText("DB Sync");
    const card = syncCard();
    const started = column(card, "Started");

    await user.click(within(started).getByRole("button", { name: "Filter by date" }));
    expect(showPicker).toHaveBeenCalled();
    fireEvent.change(started.querySelector('input[type="date"]') as HTMLInputElement, {
      target: { value: "2026-10-04" },
    });
    const startedRows = card.querySelector("tbody") as HTMLElement;
    expect(within(startedRows).getByTitle(longError)).toBeInTheDocument();
    expect(within(startedRows).queryByText("Success")).not.toBeInTheDocument();
    expect(within(startedRows).queryByText("Partial failure")).not.toBeInTheDocument();

    const chip = within(started).getByRole("button", { name: "04 Oct 2026" });
    await user.click(within(chip).getByTestId("CancelIcon"));
    expect(within(card).getByText("Success")).toBeInTheDocument();
    expect(within(started).getByRole("button", { name: "Filter by date" })).toBeInTheDocument();

    const completed = column(card, "Completed");
    fireEvent.change(completed.querySelector('input[type="date"]') as HTMLInputElement, {
      target: { value: "2026-10-05" },
    });
    const completedRows = card.querySelector("tbody") as HTMLElement;
    expect(within(completedRows).getByText("Success")).toBeInTheDocument();
    expect(within(completedRows).queryByText("Failed")).not.toBeInTheDocument();
    expect(within(completedRows).queryByText("Partial failure")).not.toBeInTheDocument();

    fireEvent.change(completed.querySelector('input[type="date"]') as HTMLInputElement, {
      target: { value: "2020-01-01" },
    });
    expect(within(card).getByText("No results match the selected filters")).toBeInTheDocument();
    expect(within(card).queryByText("No results match the current filters.")).not.toBeInTheDocument();
  });

  it("pages sync history ten at a time with first and last", async () => {
    const user = userEvent.setup();
    openAdmin({ logs: () => json(manyLogs(12)) });
    await screen.findByRole("heading", { name: "Sync & scrape history" });
    const card = syncCard();
    expect(await within(card).findByText("1–10 of 12")).toBeInTheDocument();
    expect(within(card).getAllByRole("row")).toHaveLength(11);
    expect(within(card).queryByRole("cell", { name: "10" })).not.toBeInTheDocument();

    await user.click(within(card).getByRole("button", { name: /go to next page/i }));
    expect(within(card).getByRole("cell", { name: "10" })).toBeInTheDocument();
    expect(within(card).getByRole("cell", { name: "11" })).toBeInTheDocument();

    await user.click(within(card).getByRole("button", { name: /go to first page/i }));
    expect(within(card).queryByRole("cell", { name: "10" })).not.toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: /go to last page/i }));
    expect(within(card).getByRole("cell", { name: "11" })).toBeInTheDocument();

    await user.click(within(card).getByRole("combobox", { name: /rows per page/i }));
    await user.click(within(await screen.findByRole("listbox")).getByRole("option", { name: "100" }));
    expect(within(card).getByText("1–12 of 12")).toBeInTheDocument();
  });
});

describe("Admin states", () => {
  it("shows five skeleton rows while tracked repositories load and four while sync history loads", async () => {
    const { unmount } = openAdmin({ repositories: () => new Promise(() => undefined) });
    expect(await screen.findByRole("heading", { name: "Sync & scrape history" })).toBeInTheDocument();
    await screen.findAllByText("DB Sync");
    expect(document.querySelectorAll(".MuiSkeleton-root")).toHaveLength(5);
    expect(screen.queryByText("No tracked repositories")).not.toBeInTheDocument();
    unmount();

    openAdmin({ logs: () => new Promise(() => undefined) });
    expect(await screen.findByRole("cell", { name: "API Manager" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sync & scrape history" })).toBeInTheDocument();
    expect(document.querySelectorAll(".MuiSkeleton-root")).toHaveLength(4);
    expect(screen.queryByText("No sync or scrape runs yet")).not.toBeInTheDocument();
  });

  it("says when there are no tracked repositories and when there are no sync runs", async () => {
    const { unmount } = openAdmin({ repositories: () => json({ count: 0, repositories: [] }) });
    expect(await screen.findByText("No tracked repositories")).toBeInTheDocument();
    expect(screen.getByText("Add a repository to start collecting daily stats.")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Repository" })).not.toBeInTheDocument();
    expect(screen.getAllByText("DB Sync").length).toBeGreaterThan(0);
    unmount();

    openAdmin({ logs: () => json({ count: 0, logs: [] }) });
    expect(await screen.findByText("No sync or scrape runs yet")).toBeInTheDocument();
    expect(screen.queryByText("No sync or scrape runs recorded yet")).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /Source/ })).not.toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "API Manager" })).toBeInTheDocument();
  });

  it("shows the server's message with Retry for whichever table failed, and recovers", async () => {
    const user = userEvent.setup();
    let repositoriesFailed = true;
    const { unmount } = openAdmin({
      repositories: () =>
        repositoriesFailed ? json({ message: "repositories unavailable" }, 500) : json(tracked),
    });
    expect(await screen.findByText("repositories unavailable")).toBeInTheDocument();
    expect(screen.getAllByText("DB Sync").length).toBeGreaterThan(0);
    expect(screen.queryByText("No tracked repositories")).not.toBeInTheDocument();
    repositoriesFailed = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("cell", { name: "API Manager" })).toBeInTheDocument();
    unmount();

    let logsFailed = true;
    openAdmin({
      logs: () => (logsFailed ? json({ message: "history unavailable" }, 500) : json(syncLogs)),
    });
    expect(await screen.findByRole("cell", { name: "API Manager" })).toBeInTheDocument();
    const history = syncCard();
    expect(within(history).getByText("history unavailable")).toBeInTheDocument();
    logsFailed = false;
    await user.click(within(history).getByRole("button", { name: "Retry" }));
    expect((await screen.findAllByText("DB Sync")).length).toBeGreaterThan(0);
  });
});
