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
import { Download } from "@wso2/oxygen-ui-icons-react";
import { StatCard } from "./StatCard";
import TrendIndicator from "./TrendIndicator";

describe("StatCard", () => {
  it("shows the figure over its label, with the icon in its disc", () => {
    const { container } = render(
      <StatCard label="Total Downloads" value="1.5K" icon={<Download data-testid="icon" />} iconColor="info" />,
    );
    expect(screen.getByText("1.5K")).toBeInTheDocument();
    expect(screen.getByText("Total Downloads")).toBeInTheDocument();
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container.querySelector(".MuiSkeleton-root")).not.toBeInTheDocument();
  });

  it("shows a skeleton in place of the figure while loading", () => {
    const { container } = render(<StatCard label="Total Downloads" value="1.5K" isLoading />);
    expect(container.querySelector(".MuiSkeleton-root")).toBeInTheDocument();
    expect(screen.queryByText("1.5K")).not.toBeInTheDocument();
    expect(screen.getByText("Total Downloads")).toBeInTheDocument();
  });

  it("shows an em dash in place of the figure when its request failed", () => {
    render(<StatCard label="Total Downloads" value="1.5K" isError />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("1.5K")).not.toBeInTheDocument();
  });

  it("explains itself in a tooltip on the info icon", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <StatCard label="Clones (14d)" value="88" tooltipText="Total git clones across all products in the last 14 days." />,
    );
    const info = container.querySelector("svg.lucide-info");
    expect(info).not.toBeNull();
    await user.hover(info as Element);
    expect(
      await screen.findByText("Total git clones across all products in the last 14 days."),
    ).toBeInTheDocument();
  });

  it("has no info icon without a tooltip", () => {
    const { container } = render(<StatCard label="Products Tracked" value="10" />);
    expect(container.querySelector("svg.lucide-info")).toBeNull();
  });

  it("is a button that opens on click, Enter and Space when it has somewhere to go", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<StatCard label="Yesterday's Downloads" value="205" onClick={onClick} />);
    const tile = screen.getByRole("button", { name: /Yesterday's Downloads/ });
    expect(tile).toHaveAttribute("tabindex", "0");

    await user.click(tile);
    expect(onClick).toHaveBeenCalledTimes(1);

    tile.focus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(2);

    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);

    await user.keyboard("a");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("is not focusable or clickable without somewhere to go", () => {
    render(<StatCard label="Products Tracked" value="10" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Products Tracked").closest("[tabindex]")).toBeNull();
  });
});

describe("TrendIndicator", () => {
  it("shows a green rise to one decimal", () => {
    const { container } = render(<TrendIndicator pct={3.456} />);
    expect(screen.getByText("3.5%")).toBeInTheDocument();
    expect(container.querySelector("svg.lucide-trending-up")).not.toBeNull();
    expect(container.querySelector("svg.lucide-trending-down")).toBeNull();
  });

  it("shows a red fall as a positive figure", () => {
    const { container } = render(<TrendIndicator pct={-12.34} />);
    expect(screen.getByText("12.3%")).toBeInTheDocument();
    expect(container.querySelector("svg.lucide-trending-down")).not.toBeNull();
  });

  it("counts no change as a rise", () => {
    const { container } = render(<TrendIndicator pct={0} />);
    expect(screen.getByText("0.0%")).toBeInTheDocument();
    expect(container.querySelector("svg.lucide-trending-up")).not.toBeNull();
  });

  it("shows nothing when the percentage is unknown", () => {
    const { container, rerender } = render(<TrendIndicator pct={null} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<TrendIndicator pct={undefined} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<TrendIndicator pct={Number.NaN} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("sits in the tile's top row as its trend chip", () => {
    render(<StatCard label="Yesterday's Downloads" value="205" trend={<TrendIndicator pct={3} />} />);
    expect(screen.getByText("3.0%")).toBeInTheDocument();
  });
});
