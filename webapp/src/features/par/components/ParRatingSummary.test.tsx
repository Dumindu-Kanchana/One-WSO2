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
import type { ParCycle, ParRating } from "../api/types";

vi.mock("@features/leave/api/useLeaveData", () => ({ useLeaveEmployees: () => ({ data: [] }) }));

const { default: ParRatingSummary } = await import("./ParRatingSummary");

const cycle = { parCycleConfigurations: {} } as Pick<ParCycle, "parCycleConfigurations">;
const shared = (parSpecialRating: string) =>
  ({ parRating: "Successful", parSpecialRating, parLeadComment: "", parEmployeeComment: "" }) as unknown as ParRating;

describe("ParRatingSummary", () => {
  it("shows no special-rating chip when there's no Top 5% or Top 20%", () => {
    render(<ParRatingSummary cycle={cycle} rating={shared("NOT_ASSIGNED")} />);
    expect(screen.getByText("PAR rating: Successful")).toBeInTheDocument();
    expect(screen.queryByText(/Top 5%|Top 20%|Not Assigned/)).not.toBeInTheDocument();
  });

  it("shows a Top 5% or Top 20% once the lead has given one", () => {
    const { unmount } = render(<ParRatingSummary cycle={cycle} rating={shared("TOP5P")} />);
    expect(screen.getByText("Top 5%")).toBeInTheDocument();
    unmount();
    render(<ParRatingSummary cycle={cycle} rating={shared("TOP20P")} />);
    expect(screen.getByText("Top 20%")).toBeInTheDocument();
  });
});
