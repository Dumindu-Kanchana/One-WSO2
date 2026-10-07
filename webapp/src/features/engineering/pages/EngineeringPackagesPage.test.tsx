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
import type { ReactElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { downloadStatsPaths } from "@constants/downloadStatsApps";
import EngineeringPackagesPage from "./EngineeringPackagesPage";

vi.mock("recharts", async () => {
  const React = await import("react");
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
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

const originalConfig = window.config;

afterEach(() => {
  window.config = originalConfig;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function renderPackages(path: string = downloadStatsPaths.packages) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Where />
        <Routes>
          <Route path={downloadStatsPaths.packages} element={<EngineeringPackagesPage />} />
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

const packages = ["helm-a", "helm-b", "helm-c", "helm-d", "helm-e", "helm-f"].map((name, index) => ({
  packageName: name,
  periodDownloads: 60 - index * 10,
  totalDownloads: 100,
  versionCount: 1,
}));

describe("Packages", () => {
  it("offers only products with package downloads, narrows the chart to five, and lists a chosen package's versions", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T12:00:00.000Z"));
    window.config = configured();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/api/v1/repositories")) {
        return json({
          repositories: [{ id: 1, repoName: "product-apim", productName: "API Manager", isActive: true }],
        });
      }
      if (url.includes("/stats/packages/repos")) {
        return json({
          count: 1,
          repos: [{ repoId: 3, repoName: "product-is", productName: "Identity Server", packageCount: 6 }],
        });
      }
      if (url.includes("/stats/packages/3/series")) {
        return json({
          series: packages.map((item) => ({
            packageName: item.packageName,
            points: [{ date: "2026-09-28", value: item.periodDownloads }],
          })),
        });
      }
      if (url.includes("/stats/packages/3/versions")) {
        return json({
          versions: [{ versionId: 9, tags: "1.2.3", periodDownloads: 4, totalDownloads: 9 }],
        });
      }
      if (url.match(/\/stats\/packages\/3(\?|$)/)) return json({ packages });
      return json({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPackages();

    expect(await screen.findByRole("heading", { name: "Packages" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "helm-f" })).toBeInTheDocument();
    expect(screen.getAllByText("helm-a").length).toBeGreaterThan(1);
    for (const name of ["helm-a", "helm-b", "helm-c", "helm-d", "helm-e", "helm-f"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.getAllByText("helm-f")).toHaveLength(1);
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.queryByText("API Manager")).not.toBeInTheDocument();

    const breakdown = new URL(
      String(fetchMock.mock.calls.find((call) => /\/stats\/packages\/3(\?|$)/.test(String(call[0])))?.[0]),
    );
    expect(breakdown.searchParams.get("from")).toBe("2026-08-31");
    expect(breakdown.searchParams.get("to")).toBe("2026-09-30");
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("repo=3"));

    await userEvent.click(screen.getByRole("button", { name: "helm-f" }));
    expect(await screen.findByText("1.2.3")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    const versions = new URL(
      String(fetchMock.mock.calls.find((call) => String(call[0]).includes("/versions"))?.[0]),
    );
    expect(versions.searchParams.get("package")).toBe("helm-f");
  });

  it("drops the chosen package when the product changes", async () => {
    window.config = configured();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/stats/packages/repos")) {
        return json({
          count: 2,
          repos: [
            { repoId: 3, repoName: "product-is", productName: "Identity Server", packageCount: 1 },
            { repoId: 4, repoName: "product-apim", productName: "API Manager", packageCount: 1 },
          ],
        });
      }
      if (url.includes("/stats/packages/3/versions")) {
        return json({ versions: [{ versionId: 9, tags: "1.2.3", periodDownloads: 4, totalDownloads: 9 }] });
      }
      if (url.includes("/stats/packages/3/series") || url.includes("/stats/packages/4/series")) {
        return json({ series: [] });
      }
      if (url.match(/\/stats\/packages\/3(\?|$)/)) {
        return json({
          packages: [{ packageName: "helm-f", periodDownloads: 10, totalDownloads: 10, versionCount: 1 }],
        });
      }
      if (url.match(/\/stats\/packages\/4(\?|$)/)) {
        return json({
          packages: [{ packageName: "apim", periodDownloads: 3, totalDownloads: 3, versionCount: 1 }],
        });
      }
      return json({ versions: [] });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPackages();
    await userEvent.click(await screen.findByRole("button", { name: "helm-f" }));
    expect(await screen.findByText("Versions of helm-f")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("combobox", { name: "Product" }));
    await userEvent.click(await screen.findByRole("option", { name: "API Manager" }));
    expect(screen.queryByText("Versions of helm-f")).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        (call) => String(call[0]).includes("/stats/packages/4/versions") && String(call[0]).includes("helm-f"),
      ),
    ).toBe(false);
  });

  it("does not request packages when From is after To", async () => {
    window.config = configured();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/stats/packages/repos")) {
        return json({
          count: 1,
          repos: [{ repoId: 3, repoName: "product-is", productName: "Identity Server", packageCount: 1 }],
        });
      }
      return json({ packages: [], series: [] });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPackages(`${downloadStatsPaths.packages}?from=2026-09-10&to=2026-09-01&repo=3`);
    expect(await screen.findByText("From is after To.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => /\/stats\/packages\/3/.test(String(call[0])))).toBe(false);
  });

  it("says when no product has package downloads", async () => {
    window.config = configured();
    vi.stubGlobal("fetch", vi.fn(async () => json({ count: 0, repos: [] })));
    renderPackages();
    expect(await screen.findByText("No products have package downloads")).toBeInTheDocument();
  });

  it("keeps the grain in the address and asks the series for it", async () => {
    window.config = configured();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/stats/packages/repos")) {
        return json({ count: 1, repos: [{ repoId: 3, repoName: "product-is", productName: "Identity Server", packageCount: 1 }] });
      }
      if (url.includes("/series")) return json({ series: [] });
      return json({ packages: [] });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPackages(`${downloadStatsPaths.packages}?interval=month&repo=3`);
    expect(await screen.findByText("No packages in the selected range")).toBeInTheDocument();
    const seriesCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/series"));
    expect(new URL(String(seriesCall?.[0])).searchParams.get("interval")).toBe("month");
    expect(screen.getByTestId("where")).toHaveTextContent("interval=month");
  });

  it("can show every package on the chart", async () => {
    window.config = configured();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/stats/packages/repos")) {
          return json({
            count: 1,
            repos: [{ repoId: 3, repoName: "product-is", productName: "Identity Server", packageCount: 6 }],
          });
        }
        if (url.includes("/series")) {
          return json({
            series: packages.map((item) => ({
              packageName: item.packageName,
              points: [{ date: "2026-09-28", value: item.periodDownloads }],
            })),
          });
        }
        return json({ packages });
      }),
    );
    renderPackages();
    expect(await screen.findAllByText("helm-f")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Every package" }));
    expect(screen.getAllByText("helm-f").length).toBeGreaterThan(1);
  });

  it("uses the API's cumulative total", async () => {
    window.config = configured();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/stats/packages/repos")) {
          return json({
            count: 1,
            repos: [{ repoId: 3, repoName: "product-is", productName: "Identity Server", packageCount: 1 }],
          });
        }
        if (url.includes("/series")) return json({ series: [] });
        return json({
          packages: [{ packageName: "helm-a", periodDownloads: 10, totalDownloads: 80, versionCount: 1 }],
        });
      }),
    );
    renderPackages(`${downloadStatsPaths.packages}?interval=cumulative&repo=3`);
    expect(await screen.findByText("80")).toBeInTheDocument();
    expect(screen.queryByText("10")).not.toBeInTheDocument();
  });

  it("shows an error the person can retry", async () => {
    window.config = configured();
    const fetchMock = vi.fn(async () => json({ message: "no" }, 500));
    vi.stubGlobal("fetch", fetchMock);
    renderPackages();
    expect(await screen.findByText(/couldn't load products/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });
});

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}
