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
import EngineeringVersionsPage from "./EngineeringVersionsPage";

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

function renderVersions(path: string = downloadStatsPaths.versions) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Where />
        <Routes>
          <Route path={downloadStatsPaths.versions} element={<EngineeringVersionsPage />} />
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

function series() {
  const tags = ["v1.0", "v1.1", "v1.2", "v1.3", "v1.4", "v1.5"];
  return {
    series: tags.map((tag) => ({
      releaseTag: tag,
      releaseName: tag,
      points: [{ date: "2026-09-28", value: tag === "v1.5" ? 50 : 10 }],
    })),
  };
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
describe("Versions", () => {
  it("opens on the first active product, narrows the chart, and lists a chosen release's files", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T12:00:00.000Z"));
    window.config = configured();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/repositories")) {
        return json({
          repositories: [
            { id: 9, repoName: "old", productName: "Retired", isActive: false },
            { id: 3, repoName: "product-is", productName: "Identity Server", isActive: true },
            { id: 1, repoName: "product-apim", productName: "API Manager", isActive: true },
          ],
        });
      }
      if (url.includes("/stats/versions/3/series")) return json(series());
      if (url.includes("/stats/assets/3")) {
        return json({
          assets: [{ assetName: "wso2is.zip", downloadCount: 7, releaseTag: "v1.5" }],
        });
      }
      return json({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderVersions();

    expect(await screen.findByRole("heading", { name: "Versions" })).toBeInTheDocument();
    expect(await screen.findByText("50.0%")).toBeInTheDocument();
    expect(screen.getAllByText("v1.5").length).toBeGreaterThan(1);
    expect(screen.getAllByText("v1.0")).toHaveLength(1);
    expect(screen.queryByText("Retired")).not.toBeInTheDocument();

    const requested = new URL(
      String(fetchMock.mock.calls.find((call) => String(call[0]).includes("/series"))?.[0]),
    );
    expect(requested.pathname).toContain("/stats/versions/3/series");
    expect(requested.searchParams.get("interval")).toBe("day");
    expect(requested.searchParams.get("from")).toBe("2026-08-31");
    expect(requested.searchParams.get("to")).toBe("2026-09-30");
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("repo=3"));

    await userEvent.click(screen.getByRole("button", { name: "v1.5" }));
    expect(await screen.findByText("wso2is.zip")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    const assets = new URL(
      String(fetchMock.mock.calls.find((call) => String(call[0]).includes("/assets/"))?.[0]),
    );
    expect(assets.searchParams.get("version")).toBe("v1.5");

    await userEvent.click(screen.getByRole("button", { name: "Clear release" }));
    expect(screen.queryByText("wso2is.zip")).not.toBeInTheDocument();
  });

  it("searches releases without changing their share of the whole range", async () => {
    window.config = configured();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/repositories")) {
        return json({ repositories: [{ id: 3, repoName: "product-is", productName: "Identity Server", isActive: true }] });
      }
      if (url.includes("/series")) return json(series());
      return json({ assets: [] });
    }));
    renderVersions();
    expect(await screen.findByRole("button", { name: "v1.5" })).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "Search releases" }), "v1.0");
    expect(screen.queryByRole("button", { name: "v1.5" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "v1.0" })).toBeInTheDocument();
    expect(screen.getByText("10.0%")).toBeInTheDocument();
  });

  it("can show every release on the chart", async () => {
    window.config = configured();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/repositories")) {
        return json({ repositories: [{ id: 3, repoName: "product-is", productName: "Identity Server", isActive: true }] });
      }
      if (url.includes("/series")) return json(series());
      return json({ assets: [] });
    }));
    renderVersions();
    expect(await screen.findAllByText("v1.0")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Every release" }));
    expect(screen.getAllByText("v1.0").length).toBeGreaterThan(1);
  });

  it("says when the product has no releases", async () => {
    window.config = configured();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/repositories")) {
        return json({ repositories: [{ id: 3, repoName: "product-is", productName: "Identity Server", isActive: true }] });
      }
      return json({ series: [] });
    }));
    renderVersions();
    expect(await screen.findByText("No releases in the selected range")).toBeInTheDocument();
  });

  it("says when the chosen release has no files", async () => {
    window.config = configured();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/repositories")) {
        return json({ repositories: [{ id: 3, repoName: "product-is", productName: "Identity Server", isActive: true }] });
      }
      if (url.includes("/series")) return json(series());
      return json({ assets: [] });
    }));
    renderVersions();
    await userEvent.click(await screen.findByRole("button", { name: "v1.0" }));
    expect(await screen.findByText("No files in the selected range")).toBeInTheDocument();
  });

  it("shows an error the person can retry", async () => {
    window.config = configured();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/repositories")) {
        return json({ repositories: [{ id: 3, repoName: "product-is", productName: "Identity Server", isActive: true }] });
      }
      return json({ message: "no" }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderVersions();
    expect(await screen.findByText(/couldn't load releases/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(fetchMock.mock.calls.filter((call) => String(call[0]).includes("/series")).length).toBeGreaterThan(1);
  });

  it("keeps v1.10 ahead of v1.9 when choosing the five most recent releases", async () => {
    window.config = configured();
    const tags = ["v1.6", "v1.7", "v1.8", "v1.9", "v1.10", "v1.11"];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/repositories")) {
          return json({
            repositories: [{ id: 3, repoName: "product-is", productName: "Identity Server", isActive: true }],
          });
        }
        if (url.includes("/series")) {
          return json({
            series: tags.map((tag) => ({
              releaseTag: tag,
              releaseName: tag,
              points: [{ date: "2026-09-28", value: 1 }],
            })),
          });
        }
        return json({ assets: [] });
      }),
    );
    renderVersions();
    expect(await screen.findAllByText("v1.10")).toHaveLength(2);
    expect(screen.getAllByText("v1.6")).toHaveLength(1);
  });

  it("uses the last cumulative point as the release total", async () => {
    window.config = configured();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/repositories")) {
          return json({
            repositories: [{ id: 3, repoName: "product-is", productName: "Identity Server", isActive: true }],
          });
        }
        if (url.includes("/series")) {
          return json({
            series: [
              {
                releaseTag: "v1.0",
                releaseName: "v1.0",
                points: [
                  { date: "2026-09-01", value: 10 },
                  { date: "2026-09-02", value: 20 },
                ],
              },
            ],
          });
        }
        return json({ assets: [] });
      }),
    );
    renderVersions(`${downloadStatsPaths.versions}?interval=cumulative`);
    expect((await screen.findAllByText("20")).length).toBeGreaterThan(0);
    expect(screen.queryByText("30")).not.toBeInTheDocument();
    expect(screen.getByText("100.0%")).toBeInTheDocument();
  });

  it("gives each release its own chart colour", async () => {
    window.config = configured();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/repositories")) {
          return json({
            repositories: [{ id: 3, repoName: "product-is", productName: "Identity Server", isActive: true }],
          });
        }
        if (url.includes("/series")) {
          return json({
            series: ["v1.0", "v1.1"].map((tag) => ({
              releaseTag: tag,
              releaseName: tag,
              points: [{ date: "2026-09-28", value: 1 }],
            })),
          });
        }
        return json({ assets: [] });
      }),
    );
    renderVersions();
    expect(await screen.findByRole("button", { name: "v1.0" })).toBeInTheDocument();
    const strokes = [...document.querySelectorAll("[stroke]")].map((node) => node.getAttribute("stroke"));
    expect(strokes).toContain("#3E6FA3");
    expect(strokes).toContain("#4FA39B");
  });

  it("draws monthly release downloads as bars", async () => {
    window.config = configured();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/repositories")) {
          return json({
            repositories: [{ id: 3, repoName: "product-is", productName: "Identity Server", isActive: true }],
          });
        }
        if (url.includes("/series")) {
          expect(new URL(url).searchParams.get("interval")).toBe("month");
          return json({
            series: [
              { releaseTag: "v1.0", releaseName: "v1.0", points: [{ date: "2026-09", value: 4 }] },
              { releaseTag: "v1.1", releaseName: "v1.1", points: [{ date: "2026-09", value: 6 }] },
            ],
          });
        }
        return json({ assets: [] });
      }),
    );
    renderVersions(`${downloadStatsPaths.versions}?interval=month`);
    expect(await screen.findByRole("button", { name: "v1.0" })).toBeInTheDocument();
    const fills = [...document.querySelectorAll("[fill]")].map((node) => node.getAttribute("fill"));
    expect(fills).toContain("#3E6FA3");
    expect(fills).toContain("#4FA39B");
  });

  it("shows an error when the product list fails", async () => {
    window.config = configured();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/repositories")) return json({ message: "no" }, 500);
      return json({ series: [] });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderVersions();
    expect(await screen.findByText(/couldn't load products/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/series"))).toBe(false);
  });
});

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}
