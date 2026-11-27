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
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DelayedSkeleton, DetailSkeleton, FactsSkeleton, Refreshing, TableSkeleton } from "./EaSkeletons";

describe("DelayedSkeleton", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("holds the space but draws nothing for the first 150 ms, so a quick answer never blinks", () => {
    const { container } = render(
      <DelayedSkeleton minHeight={120}>
        <div data-testid="bars" />
      </DelayedSkeleton>,
    );
    const box = container.firstElementChild as HTMLElement;
    expect(box.getAttribute("aria-busy")).toBe("true");
    expect(getComputedStyle(box).minHeight).toBe("120px");
    expect(container.querySelector('[data-testid="bars"]')).toBeNull();
    act(() => void vi.advanceTimersByTime(149));
    expect(container.querySelector('[data-testid="bars"]')).toBeNull();
    act(() => void vi.advanceTimersByTime(2));
    expect(container.querySelector('[data-testid="bars"]')).not.toBeNull();
  });

  it("draws nothing at all when the answer arrives first", () => {
    const { container, unmount } = render(
      <DelayedSkeleton minHeight={120}>
        <div data-testid="bars" />
      </DelayedSkeleton>,
    );
    act(() => void vi.advanceTimersByTime(100));
    unmount();
    act(() => void vi.advanceTimersByTime(500));
    expect(container.querySelector('[data-testid="bars"]')).toBeNull();
  });
});

describe("Refreshing", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("keeps the old content on screen, dimmed, and adds a progress bar only when the answer is slow", () => {
    const { queryByTestId, queryByRole, container } = render(
      <Refreshing active>
        <div data-testid="old" />
      </Refreshing>,
    );
    expect(queryByTestId("old")).toBeTruthy();
    expect(container.firstElementChild?.getAttribute("aria-busy")).toBe("true");
    expect(queryByRole("progressbar")).toBeNull();
    act(() => void vi.advanceTimersByTime(151));
    expect(queryByTestId("old")).toBeTruthy();
    expect(queryByRole("progressbar")).toBeTruthy();
  });

  it("is plain content when nothing is being fetched", () => {
    const { queryByRole, container } = render(
      <Refreshing active={false}>
        <div data-testid="old" />
      </Refreshing>,
    );
    act(() => void vi.advanceTimersByTime(500));
    expect(container.firstElementChild?.getAttribute("aria-busy")).toBeNull();
    expect(queryByRole("progressbar")).toBeNull();
  });
});

describe("skeletons with real titles", () => {
  it("FactsSkeleton keeps every label and puts a placeholder where each value will be", () => {
    const { getByText, container } = render(<FactsSkeleton labels={["Traveller", "Dates"]} two={["Traveller"]} />);
    expect(getByText("Traveller")).toBeTruthy();
    expect(getByText("Dates")).toBeTruthy();
    expect(container.querySelectorAll(".MuiSkeleton-root")).toHaveLength(3);
  });

  it("TableSkeleton keeps the column headers", () => {
    const { getByRole } = render(<TableSkeleton ariaLabel="Per diems" columns={[{ key: "d", label: "No. of Days", render: () => null }]} rows={2} />);
    expect(getByRole("columnheader", { name: "No. of Days" })).toBeTruthy();
    expect(getByRole("table", { name: "Per diems" }).querySelectorAll("tbody tr")).toHaveLength(2);
  });

  it("DetailSkeleton shows the known tabs as text", () => {
    const { getByText } = render(
      <DetailSkeleton facts={["Dates"]} tabs={["Travel Information"]} moreTabs={2}>
        <div />
      </DetailSkeleton>,
    );
    expect(getByText("Travel Information")).toBeTruthy();
  });
});
