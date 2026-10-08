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

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpError } from "@api/http";
import { colorForName } from "../utils/chartColors";
import type { ChartSeries } from "../utils/chartTypes";
import SeriesChart from "./SeriesChart";
import SeriesChartTooltip from "./SeriesChartTooltip";

// How a Download Stats chart is given a size under jsdom — the approach every
// screen test (tickets 03–08) must copy.
//
// jsdom lays nothing out, so a percentage-sized ResponsiveContainer measures
// 0×0 and draws nothing. The screens used to mock `recharts`'s container, but
// that no longer reaches the chart: `@wso2/oxygen-ui-charts-react` carries its
// OWN copy of recharts (3.3.0, nested under its node_modules), so the
// `ResponsiveContainer` the kit imports from the wrapper is a different module
// from the top-level `recharts` the old mock replaced. Mock the wrapper's export
// instead; its fixed size flows into the wrapper's inner container as plain
// numbers. The wrapper's recharts also calls `new ResizeObserver` without
// checking for it, and jsdom has none, so a stub is needed too.
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

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

const apim: ChartSeries = {
  key: "repo-1",
  name: "API Manager",
  points: [
    { date: "2026-06-01", value: 1500 },
    { date: "2026-06-02", value: 3000 },
  ],
};
const identityServer: ChartSeries = {
  key: "repo-2",
  name: "Identity Server",
  points: [
    { date: "2026-06-01", value: 400 },
    { date: "2026-06-03", value: 900 },
  ],
};

describe("SeriesChart", () => {
  it("shows a skeleton of the chart's height while loading", () => {
    const { container } = render(<SeriesChart series={[]} isLoading height={240} />);
    const skeleton = container.querySelector(".MuiSkeleton-root");
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveStyle({ height: "240px" });
    expect(container.querySelector("svg")).toBeNull();
  });

  it("shows the error placeholder with Retry when the request failed", async () => {
    const onRetry = vi.fn();
    render(<SeriesChart series={[]} isError onRetry={onRetry} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("We couldn't load this data. Please try again.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("puts the server's own message under the error title when the response carried one", () => {
    const error = new HttpError("/x", 400, JSON.stringify({ message: "Range may not exceed 366 days." }));
    render(<SeriesChart series={[]} isError error={error} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Range may not exceed 366 days.")).toBeInTheDocument();
  });

  it("says there is no data for the selected range when nothing came back", () => {
    const { rerender } = render(<SeriesChart series={[]} />);
    expect(screen.getByText("No data for the selected range")).toBeInTheDocument();
    rerender(<SeriesChart series={[{ key: "repo-1", name: "API Manager", points: [] }]} />);
    expect(screen.getByText("No data for the selected range")).toBeInTheDocument();
  });

  it("takes a screen's own empty sentence", () => {
    render(<SeriesChart series={[]} emptyTitle="No release data for this product / range" />);
    expect(screen.getByText("No release data for this product / range")).toBeInTheDocument();
  });

  it("draws one line per series in its Product's colour, with a legend", () => {
    const { container } = render(<SeriesChart series={[apim, identityServer]} />);
    expect(screen.getByText("API Manager")).toBeInTheDocument();
    expect(screen.getByText("Identity Server")).toBeInTheDocument();
    const curves = container.querySelectorAll("path.recharts-line-curve");
    expect(curves).toHaveLength(2);
    expect(curves[0]).toHaveAttribute("stroke", colorForName("API Manager"));
    expect(curves[1]).toHaveAttribute("stroke", colorForName("Identity Server"));
    expect(container.querySelector(".recharts-bar")).toBeNull();
  });

  it("draws bars instead when asked", () => {
    const { container } = render(<SeriesChart series={[apim, identityServer]} variant="bar" />);
    expect(container.querySelectorAll(".recharts-bar").length).toBe(2);
    expect(container.querySelector("path.recharts-line-curve")).toBeNull();
    expect(screen.getByText("API Manager")).toBeInTheDocument();
  });

  it("labels the Y axis in compact figures and the X axis in short dates when asked", () => {
    render(<SeriesChart series={[apim, identityServer]} xTickFormat="short" />);
    expect(screen.getAllByText(/^\d+(\.\d)?K$/).length).toBeGreaterThan(0);
    expect(screen.getByText("Jun 1")).toBeInTheDocument();
    expect(screen.queryByText("2026-06-01")).not.toBeInTheDocument();
  });

  it("keeps the raw date on the X axis otherwise", () => {
    render(<SeriesChart series={[apim, identityServer]} />);
    expect(screen.getByText("2026-06-01")).toBeInTheDocument();
  });
});

describe("SeriesChartTooltip", () => {
  it("lists the series at the hovered date from largest to smallest with compact figures", () => {
    const { container } = render(
      <SeriesChartTooltip
        active
        label="2026-06-01"
        payload={[
          { dataKey: "repo-2", name: "Identity Server", value: 400, color: "#111111" },
          { dataKey: "repo-1", name: "API Manager", value: 1500, color: "#222222" },
          { dataKey: "repo-3", name: "APK", value: 25000, color: "#333333" },
        ]}
        coordinate={{ x: 0, y: 0 }}
        accessibilityLayer={false}
      />,
    );
    expect(screen.getByText("2026-06-01")).toBeInTheDocument();
    const rows = [...(container.firstElementChild as HTMLElement).querySelectorAll(":scope > div")].map(
      (row) => row.textContent,
    );
    expect(rows).toEqual(["APK25K", "API Manager1.5K", "Identity Server400"]);
  });

  it("renders nothing while inactive or with nothing to show", () => {
    const { container, rerender } = render(
      <SeriesChartTooltip active={false} payload={[]} coordinate={{ x: 0, y: 0 }} accessibilityLayer={false} />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<SeriesChartTooltip active payload={[]} coordinate={{ x: 0, y: 0 }} accessibilityLayer={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
