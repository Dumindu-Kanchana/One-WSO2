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
import { render, screen } from "@testing-library/react";
import ParDueChip from "./ParDueChip";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 5, 9, 0));
});
afterEach(() => vi.useRealTimers());

const chip = (due: string) => {
  render(<ParDueChip due={due} />);
  return screen.getByText(/Due/).closest(".MuiChip-root")!;
};

describe("ParDueChip", () => {
  it("gives the date and days left, grey while there's time", () => {
    const el = chip("2026-11-10");
    expect(el).toHaveTextContent("Due 10 Nov '26 · 5 days left");
    expect(el.className).toMatch(/MuiChip-outlined/);
  });

  it("turns amber in the last three days and on the day, its own amber rather than the theme's warning", () => {
    const el = chip("2026-11-06");
    expect(el).toHaveTextContent("Due 6 Nov '26 · 1 day left");
    expect(el.className).not.toMatch(/colorWarning|outlined/);
    expect(getComputedStyle(el).backgroundColor).toBe("rgb(254, 243, 199)");
  });

  it("says only the days left where the date is shown nearby", () => {
    render(<ParDueChip due="2026-11-10" daysOnly />);
    expect(screen.getByText("5 days left")).toBeInTheDocument();
  });

  it("says due today", () => {
    expect(chip("2026-11-05")).toHaveTextContent("Due today");
  });

  it("shows nothing once it has passed, since the task locks then", () => {
    const { container } = render(<ParDueChip due="2026-11-04" />);
    expect(container).toBeEmptyDOMElement();
    expect(render(<ParDueChip due="2026-11-04" daysOnly />).container).toBeEmptyDOMElement();
  });
});
