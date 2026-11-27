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
import type { ParCycle, ParTeamSummary } from "../api/types";

vi.mock("../api/useLeadTeams", () => ({
  useParTeamDetails: () => ({ isLoading: false, isError: false, data: { details: [] } }),
}));
vi.mock("@features/leave/api/useLeaveData", () => ({ useLeaveEmployees: () => ({ data: [] }) }));
vi.mock("../api/useReview360", () => ({ useParShowsPar2: () => ({ showsPar2: false }) }));
vi.mock("../api/useLeadership360", () => ({
  cycleSurvey: () => undefined,
  useLeadership360Surveys: () => ({ data: undefined }),
  useLeadership360Results: () => ({ data: undefined }),
}));

const { default: ParOrgTeamRoster } = await import("./ParOrgTeamRoster");

describe("ParOrgTeamRoster", () => {
  it("goes back to all teams from the back arrow as well as the link", () => {
    const onBack = vi.fn();
    render(
      <ParOrgTeamRoster
        cycle={{ parCycleId: 2 } as ParCycle}
        team={{ parTeamId: 5, parBusinessUnit: "Engineering", parDepartment: "Platform" } as ParTeamSummary}
        onBack={onBack}
        onOpenReview={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Back to all teams" }));
    fireEvent.click(screen.getByRole("button", { name: "All Teams" }));
    expect(onBack).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Engineering / Platform")).toBeInTheDocument();
  });
});
