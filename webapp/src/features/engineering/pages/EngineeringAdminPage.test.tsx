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
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { ENGINEERING_ADMIN_ITEM_ID, downloadStatsPaths } from "@constants/downloadStatsApps";
import { claimOf, foldVisibility, type VisibilityShell } from "@components/side-rail/visibilityFold";
import { engineeringAdminVisibility } from "@features/engineering/api/engineeringAdminVisibility";
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

afterEach(() => {
  window.config = originalConfig;
  vi.unstubAllGlobals();
});

function renderAdmin() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[downloadStatsPaths.admin]}>
        <Routes>
          <Route path={downloadStatsPaths.admin} element={<EngineeringAdminPage />} />
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
  count: 2,
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
  ],
};

const logs = {
  count: 1,
  logs: [
    {
      id: 4,
      source: "DB_SYNC",
      status: "FAILED",
      reposSynced: 3,
      reposFailed: 1,
      errorMessage: "snapshot write failed",
      startedAt: "2026-10-04T02:00:00Z",
      completedAt: "2026-10-04T02:05:00Z",
    },
  ],
};

function adminFetch(isAdmin: boolean) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/user-info")) return json({ email: "a@wso2.com", isAdmin });
    if (url.includes("/admin/repositories") && (!init?.method || init.method === "GET")) return json(repositories);
    if (url.includes("/admin/sync/logs")) return json(logs);
    if (init?.method === "POST") return json({ id: 11 }, 201);
    if (init?.method === "PATCH" || init?.method === "DELETE") return new Response(null, { status: 204 });
    return json({}, 404);
  });
}

function rail(isAdmin: boolean) {
  const answer = engineeringAdminVisibility({ isAdmin, resolving: false });
  return foldVisibility(
    [{ name: "engineering", claim: claimOf("engineering"), ...answer }],
    {
      perspectiveKey: "engineering",
      sectionIds: new Set([ENGINEERING_ADMIN_ITEM_ID]),
      sriLankaOnlyIds: new Set(),
      isSriLankaEmployee: true,
      employeeRecordResolving: false,
      employeeRecordFailed: false,
      retryEmployeeRecord: () => undefined,
      capabilities: new Set(),
    } satisfies VisibilityShell,
  );
}

describe("Admin", () => {
  it("keeps organisation and repository name fixed after creation", async () => {
    window.config = configured();
    const fetchMock = adminFetch(true);
    vi.stubGlobal("fetch", fetchMock);
    renderAdmin();
    await userEvent.click(await screen.findByRole("button", { name: "Edit API Manager" }));
    expect(screen.getByRole("textbox", { name: "Organisation" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Repository" })).toBeDisabled();
    await userEvent.clear(screen.getByRole("textbox", { name: "Product name" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Product name" }), "APIM");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(fetchMock.mock.calls.some((call) => call[1]?.method === "PATCH")).toBe(true));
    const patched = fetchMock.mock.calls.find((call) => call[1]?.method === "PATCH");
    expect(JSON.parse(String(patched?.[1]?.body))).toEqual({
      productName: "APIM",
      assetPrefixes: ["wso2am"],
      isActive: true,
      trackPackages: false,
    });
    expect(String(patched?.[0])).toContain("/admin/repositories/7");
  });

  it("clears a failed deactivation before the next repository is confirmed", async () => {
    window.config = configured();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes("/user-info")) return json({ email: "a@wso2.com", isAdmin: true });
        if (url.includes("/admin/sync/logs")) return json(logs);
        if (init?.method === "DELETE") return json({ message: "deactivate failed" }, 500);
        if (url.includes("/admin/repositories")) return json(repositories);
        return json({}, 404);
      }),
    );
    renderAdmin();
    await userEvent.click(await screen.findByRole("button", { name: "Deactivate API Manager" }));
    await userEvent.click(screen.getByRole("button", { name: /^Deactivate$/ }));
    expect(await screen.findByText(/deactivate failed/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Deactivate API Manager" }));
    expect(screen.queryByText(/deactivate failed/i)).not.toBeInTheDocument();
  });

  it("shows an error the person can retry", async () => {
    window.config = configured();
    const fetchMock = vi.fn(async () => json({ message: "no" }, 500));
    vi.stubGlobal("fetch", fetchMock);
    renderAdmin();
    expect(await screen.findByText(/couldn't check admin access/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });

  it("hides the row and the screen from someone who is not an admin, and lets an admin add, deactivate, and read job history", async () => {
    expect(rail(false).canSee({ id: ENGINEERING_ADMIN_ITEM_ID })).toBe(false);
    expect(rail(true).canSee({ id: ENGINEERING_ADMIN_ITEM_ID })).toBe(true);

    window.config = configured();
    vi.stubGlobal("fetch", adminFetch(false));
    const { unmount } = renderAdmin();
    expect(await screen.findByText(/don't have access to admin/i)).toBeInTheDocument();
    unmount();

    const fetchMock = adminFetch(true);
    vi.stubGlobal("fetch", fetchMock);
    renderAdmin();

    expect(await screen.findByRole("cell", { name: "Retired" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Failed" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: formatDateTime("2026-10-04T02:00:00Z") })).toBeInTheDocument();
    expect(screen.queryByText("2026-10-04T02:00:00Z")).not.toBeInTheDocument();
    expect(screen.getByText("snapshot write failed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start|run now|sync now/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Add tracked repository" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await userEvent.type(screen.getByRole("textbox", { name: "Organisation" }), "wso2");
    await userEvent.type(screen.getByRole("textbox", { name: "Repository" }), "product-is");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((call) => call[1]?.method === "POST")).toBe(true),
    );
    const created = fetchMock.mock.calls.find((call) => call[1]?.method === "POST");
    expect(JSON.parse(String(created?.[1]?.body))).toMatchObject({
      orgName: "wso2",
      repoName: "product-is",
      assetPrefixes: [],
    });

    await userEvent.click(screen.getByRole("button", { name: "Deactivate API Manager" }));
    await userEvent.click(screen.getByRole("button", { name: /^Deactivate$/ }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          (call) => call[1]?.method === "DELETE" && String(call[0]).includes("/admin/repositories/7"),
        ),
      ).toBe(true),
    );
  });
});
