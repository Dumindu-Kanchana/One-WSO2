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
import type { ParCycle } from "../api/types";

let showsPar2 = true;
vi.mock("../api/useReview360", () => ({ useParShowsPar2: () => ({ showsPar2 }) }));

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

describe("ParCycleDatesStepper", () => {
  it("shows a PAR 2.0 cycle's hard lead deadline right after the lead deadline", () => {
    showsPar2 = true;
    render(<ParCycleDatesStepper cycle={cycle} />);
    expect(labels()).toEqual([
      "Start Date",
      "Employee PAR Deadline",
      "Lead's PAR Deadline",
      "Hard Lead Deadline",
      "Top 5%/20% Rating Submission",
      "End Date",
    ]);
    expect(screen.getByText("15 Dec '26")).toBeInTheDocument();
  });

  it("leaves it out of a PAR 1.0 cycle", () => {
    showsPar2 = false;
    render(<ParCycleDatesStepper cycle={cycle} />);
    expect(screen.queryByText("Hard Lead Deadline")).not.toBeInTheDocument();
    expect(labels()).toHaveLength(5);
  });
});
