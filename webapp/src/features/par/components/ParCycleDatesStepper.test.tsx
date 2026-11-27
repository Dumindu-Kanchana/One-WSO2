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
import { fireEvent, render, screen } from "@testing-library/react";
import type { ParCycle } from "../api/types";

let showsPar2 = true;
let lookup: { isLoading?: boolean; error?: Error | null } = {};
const retry = vi.fn();
vi.mock("../api/useReview360", () => ({
  useParShowsPar2: () => ({ showsPar2, isLoading: false, error: null, retry, retrying: false, ...lookup }),
}));

const { default: ParCycleDatesStepper } = await import("./ParCycleDatesStepper");

const cycle = {
  parCycleId: 7,
  parEvaluationStartDate: "2026-11-25",
  parEmployeeDeadline: "2026-12-02",
  parLeadDeadline: "2026-12-12",
  parLeadHardDeadline: "2026-12-15",
  parSpecialRatingDeadline: "2026-12-16",
  parEvaluationEndDate: "2026-12-22",
} as ParCycle;

const labels = () => screen.getAllByText(/Date$|Deadline$|Submission$/).map((e) => e.textContent);

// The steps shown as reached (a check in a filled circle).
const reachedCount = (container: HTMLElement) => container.querySelectorAll(".MuiAvatar-root").length;

afterEach(() => {
  lookup = {};
});

describe("ParCycleDatesStepper", () => {
  it("shows a PAR 2.0 cycle's hard lead deadline right after the lead deadline, and no Top 5%/20% step", () => {
    showsPar2 = true;
    render(<ParCycleDatesStepper cycle={cycle} />);
    expect(labels()).toEqual([
      "Start Date",
      "Employee PAR Deadline",
      "Lead's PAR Deadline",
      "Hard Lead Deadline",
      "End Date",
    ]);
    expect(screen.getByText("15 Dec '26")).toBeInTheDocument();
  });

  it("leaves the hard lead deadline out of a PAR 1.0 cycle, which keeps its Top 5%/20% step", () => {
    showsPar2 = false;
    render(<ParCycleDatesStepper cycle={cycle} />);
    expect(screen.queryByText("Hard Lead Deadline")).not.toBeInTheDocument();
    expect(labels()).toEqual([
      "Start Date",
      "Employee PAR Deadline",
      "Lead's PAR Deadline",
      "Top 5%/20% Rating Submission",
      "End Date",
    ]);
  });

  it("reaches a PAR 2.0 cycle's steps from the five PAR 1.0 ones", () => {
    showsPar2 = true;
    // 3 (the Top 5%/20% deadline, its lead deadline) reaches the lead deadline; the hard lead deadline is still ahead
    // on a day before it, whenever the test runs.
    vi.useFakeTimers({ now: new Date(2026, 11, 1), toFake: ["Date"] });
    try {
      const { container, unmount } = render(<ParCycleDatesStepper cycle={cycle} activeStep={3} />);
      expect(reachedCount(container)).toBe(3);
      unmount();
    } finally {
      vi.useRealTimers();
    }
    const hardPassed = { ...cycle, parLeadHardDeadline: "2020-01-01" } as ParCycle;
    const second = render(<ParCycleDatesStepper cycle={hardPassed} activeStep={3} />);
    expect(reachedCount(second.container)).toBe(4);
    second.unmount();
    const ended = render(<ParCycleDatesStepper cycle={cycle} activeStep={4} />);
    expect(reachedCount(ended.container)).toBe(5);
  });

  it("shows no steps until it's known whether the cycle is a PAR 2.0 one, and says so if that fails", () => {
    lookup = { isLoading: true };
    const loading = render(<ParCycleDatesStepper cycle={cycle} />);
    expect(screen.queryByText("Start Date")).not.toBeInTheDocument();
    loading.unmount();
    lookup = { error: new Error("Network down") };
    render(<ParCycleDatesStepper cycle={cycle} />);
    expect(screen.queryByText("Start Date")).not.toBeInTheDocument();
    expect(screen.getByText(/Couldn't load the cycle's dates\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalled();
  });

  it("reaches a PAR 1.0 cycle's steps as given", () => {
    showsPar2 = false;
    const { container } = render(<ParCycleDatesStepper cycle={cycle} activeStep={3} />);
    expect(reachedCount(container)).toBe(4);
  });
});
