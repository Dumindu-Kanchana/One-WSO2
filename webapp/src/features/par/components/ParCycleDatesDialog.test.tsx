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
import ParCycleDatesDialog from "./ParCycleDatesDialog";
import type { ParCycle } from "../api/types";

// The stepper asks whether the cycle has the PAR 2.0 forms.
vi.mock("../api/useReview360", () => ({ useParShowsPar2: () => ({ showsPar2: false }) }));

const cycle = {
  parCycleId: 7,
  parEvaluationStartDate: "2026-07-01",
  parEmployeeDeadline: "2026-11-30",
  parLeadDeadline: "2026-12-10",
  parSpecialRatingDeadline: "2026-12-10",
  parEvaluationEndDate: "2026-12-31",
} as ParCycle;

describe("ParCycleDatesDialog", () => {
  it("shows the cycle's dates and closes from its Close button", () => {
    const onClose = vi.fn();
    render(<ParCycleDatesDialog cycle={cycle} open onClose={onClose} />);
    expect(screen.getByRole("dialog", { name: "Cycle Dates" })).toBeInTheDocument();
    expect(screen.getByText("Employee PAR Deadline")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
