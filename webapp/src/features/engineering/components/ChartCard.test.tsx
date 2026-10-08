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

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChartCard from "./ChartCard";

describe("ChartCard", () => {
  it("titles the chart, with the subtitle beneath and the action beside", () => {
    render(
      <ChartCard
        title="Daily downloads by product"
        subtitle="Downloads across the selected products and range"
        action={<button type="button">Export</button>}
      >
        <div>the chart</div>
      </ChartCard>,
    );
    expect(screen.getByRole("heading", { name: "Daily downloads by product" })).toBeInTheDocument();
    expect(screen.getByText("Downloads across the selected products and range")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
    expect(screen.getByText("the chart")).toBeInTheDocument();
  });

  it("has no line/bar toggle unless asked", () => {
    render(<ChartCard title="Daily Downloads (last 30 days)">chart</ChartCard>);
    expect(screen.queryByRole("button", { name: "Line chart" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bar chart" })).not.toBeInTheDocument();
  });

  it("offers Line chart and Bar chart buttons and tells the chart which one is chosen", async () => {
    const user = userEvent.setup();
    render(
      <ChartCard title="Downloads by version" showTypeToggle>
        {(variant) => <div>drawn as {variant}</div>}
      </ChartCard>,
    );
    expect(screen.getByText("drawn as line")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Line chart" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Bar chart" }));
    expect(screen.getByText("drawn as bar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bar chart" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Line chart" })).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps one of the two chosen: clicking the pressed button changes nothing", async () => {
    const user = userEvent.setup();
    render(
      <ChartCard title="Downloads by version" showTypeToggle defaultVariant="bar">
        {(variant) => <div>drawn as {variant}</div>}
      </ChartCard>,
    );
    await user.click(screen.getByRole("button", { name: "Bar chart" }));
    expect(screen.getByText("drawn as bar")).toBeInTheDocument();
  });

  it("follows the parent's default again when the parent changes it", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ChartCard title="Downloads by version" showTypeToggle defaultVariant="line">
        {(variant) => <div>drawn as {variant}</div>}
      </ChartCard>,
    );
    await user.click(screen.getByRole("button", { name: "Bar chart" }));
    expect(screen.getByText("drawn as bar")).toBeInTheDocument();

    // The interval moves to Monthly: the parent now wants bars, and the
    // person's earlier choice no longer applies.
    rerender(
      <ChartCard title="Downloads by version" showTypeToggle={false} defaultVariant="bar">
        {(variant) => <div>drawn as {variant}</div>}
      </ChartCard>,
    );
    expect(screen.getByText("drawn as bar")).toBeInTheDocument();

    // Back to Daily: the parent's default is lines again, so the chart is too.
    rerender(
      <ChartCard title="Downloads by version" showTypeToggle defaultVariant="line">
        {(variant) => <div>drawn as {variant}</div>}
      </ChartCard>,
    );
    expect(screen.getByText("drawn as line")).toBeInTheDocument();
  });

  it("tells the parent which chart type the person chose, so a screen can keep it in the address", async () => {
    const user = userEvent.setup();
    const onVariantChange = vi.fn();
    render(
      <ChartCard title="Daily downloads by product" showTypeToggle onVariantChange={onVariantChange}>
        {(variant) => <div>drawn as {variant}</div>}
      </ChartCard>,
    );

    await user.click(screen.getByRole("button", { name: "Bar chart" }));
    expect(onVariantChange).toHaveBeenLastCalledWith("bar");
    expect(screen.getByText("drawn as bar")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Line chart" }));
    expect(onVariantChange).toHaveBeenLastCalledWith("line");
    expect(onVariantChange).toHaveBeenCalledTimes(2);
  });

  it("renders plain children as they are", () => {
    render(
      <ChartCard title="Top Products (Downloads)">
        <table>
          <tbody>
            <tr>
              <td>API Manager</td>
            </tr>
          </tbody>
        </table>
      </ChartCard>,
    );
    expect(screen.getByRole("cell", { name: "API Manager" })).toBeInTheDocument();
  });
});
