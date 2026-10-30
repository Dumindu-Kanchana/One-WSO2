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
import { fireEvent, render, screen } from "@testing-library/react";

const RAW = "(3) ANNUAL PERFORMANCE REVIEW - Engineering Employees";
const CANONICAL = "2015 ANNUAL PERFORMANCE REVIEW for Engineering Employees";

vi.mock("../api/useParAdmin", () => ({
  useParCyclesByStatus: () => ({ data: [], isLoading: false, isError: false }),
  useDistinctLegacyParCycles: () => ({
    data: [{ cycleName: RAW }, { cycleName: CANONICAL }, { cycleName: "2016 Quarterly Review - Q3/Q4" }],
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("../components/ParOrgSummary", () => ({ default: () => null }));
vi.mock("../components/ParAdminLegacyCycleView", () => ({
  default: ({ cycleName, storedCycleNames }: { cycleName: string; storedCycleNames: string[] }) => (
    <div data-testid="legacy-cycle-view">{JSON.stringify({ cycleName, storedCycleNames })}</div>
  ),
}));

const { default: ParAdminHistoryTab } = await import("./ParAdminHistoryTab");

const LABEL = "2015 Annual Performance Evaluation - Engineering Employees";

describe("ParAdminHistoryTab legacy cycles", () => {
  it("lists two stored spellings of one 2015 cycle as a single row", () => {
    render(<ParAdminHistoryTab />);
    expect(screen.getAllByText(LABEL)).toHaveLength(1);
    expect(screen.getByText("2016 Quarterly Review - Q3/Q4")).toBeInTheDocument();
  });

  it.each(["2015 Annual", "ANNUAL PERFORMANCE REVIEW - Engineering", "for Engineering Employees", "  q3/q4 "])(
    "search %j finds the cycle by its shown title or any stored spelling",
    (text) => {
      render(<ParAdminHistoryTab />);
      fireEvent.change(screen.getByPlaceholderText("Search Cycle"), { target: { value: text } });
      const expected = text.toLowerCase().includes("q3/q4") ? "2016 Quarterly Review - Q3/Q4" : LABEL;
      expect(screen.getByText(expected)).toBeInTheDocument();
    },
  );

  it("opens the merged cycle with every stored spelling", () => {
    render(<ParAdminHistoryTab />);
    fireEvent.click(screen.getByRole("button", { name: `Open ${LABEL}` }));
    expect(JSON.parse(screen.getByTestId("legacy-cycle-view").textContent!)).toEqual({
      cycleName: CANONICAL,
      storedCycleNames: [RAW, CANONICAL],
    });
  });
});
