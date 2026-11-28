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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ParCycle, ParRatingMinimal, ParTeamSummary } from "../api/types";

let rosters: { details: Partial<ParRatingMinimal>[] }[];
vi.mock("../api/useLeadTeams", () => ({
  useParTeamsDetails: () => ({ isLoading: false, isError: false, data: rosters }),
}));
vi.mock("../api/useLeadReminders", () => ({ useSend360Reminder: () => ({ mutate: vi.fn(), isPending: false }) }));
const ratingMutateAsync = vi.fn();
const refreshAfterRatingUpdates = vi.fn();
vi.mock("../api/useLeadRatingUpdate", () => ({
  useLeadRatingUpdate: () => ({ mutateAsync: ratingMutateAsync }),
  useRefreshAfterRatingUpdates: () => refreshAfterRatingUpdates,
}));
vi.mock("../api/useReview360", () => ({
  useParShowsPar2: () => ({ showsPar2: true }),
  useReviewIndexes: () => ({ data: undefined }),
}));
vi.mock("../api/useLeadership360", () => ({
  cycleSurvey: () => undefined,
  useLeadership360Surveys: () => ({ data: undefined }),
  useLeadership360Results: () => ({ data: undefined }),
}));
vi.mock("@features/leave/api/useLeaveData", () => ({ useLeaveEmployees: () => ({ data: [] }) }));
vi.mock("@features/my/api/useMeProfile", () => ({
  useMeProfile: () => ({ data: { userInfo: { workEmail: "lead@example.com" } } }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));
vi.mock("./ParSyncEmployeeDialog", () => ({ default: () => null }));
vi.mock("./ParCycleDatesDialog", () => ({ default: () => null }));

const { default: ParLeadTeamRoster } = await import("./ParLeadTeamRoster");

// All 360° feedback is in; Field Ops has a later self-review deadline of its own.
const cycle = {
  parCycleId: 2,
  parCycleName: "2027 H1",
  parCycleStartDate: "2027-01-01",
  parCycleEndDate: "2027-06-30",
  parEmployeeDeadline: "2020-01-01",
  parThreeSixtyRatingDeadline: "2020-01-02",
  parLeadDeadline: "2999-12-31",
  parCycleConfigurations: { departmentEmployeeDeadlines: [{ department: "FIELD OPS", deadline: "2999-12-01" }] },
} as unknown as ParCycle;
const team = (id: number, department: string, name: string, done: number): ParTeamSummary =>
  ({
    parTeamId: id,
    parCycleId: 2,
    parBusinessUnit: "Corporate",
    parDepartment: department,
    parTeam: name,
    numberOfTeamMembers: 1,
    summary: { employeeParCompletedCount: done, leadsReviewCompletedCount: 0, f2fCompletedCount: 0 },
  }) as ParTeamSummary;
const member = (id: number, name: string, email: string): Partial<ParRatingMinimal> => ({
  parRatingId: id,
  parEmployeeName: name,
  parEmployeeEmail: email,
  parEmployeeStatus: "SHARED",
  parLeadStatus: "DRAFT",
  par360ReviewStatus: "PENDING",
  par360ReviewCounts: { sharedReviewCount: 0, requestedReviewCount: 0 } as ParRatingMinimal["par360ReviewCounts"],
  parF2fStatus: "PENDING",
});
const PLATFORM = team(1, "PLATFORM", "RELIABILITY", 1);
const FIELD_OPS = team(2, "FIELD OPS", "PARTNERS", 0);
const row = (name: string) => screen.getByText(name).closest("[role=row]") as HTMLElement;
const pickRow = (name: string) => fireEvent.click(within(row(name)).getByRole("checkbox"));

beforeEach(() => {
  rosters = [
    { details: [member(11, "Maya Fernando", "maya@example.com")] },
    { details: [member(12, "Leo Tanaka", "leo@example.com")] },
  ];
});

describe("ParLeadTeamRoster", () => {
  it("lists a lead's direct reports across their teams in one table, with a Team column", () => {
    render(<ParLeadTeamRoster cycle={cycle} teams={[PLATFORM, FIELD_OPS]} onOpenReview={() => {}} />);
    expect(screen.getByRole("columnheader", { name: "Team" })).toBeInTheDocument();
    expect(within(row("Maya Fernando")).getByText("PLATFORM / RELIABILITY")).toBeInTheDocument();
    expect(within(row("Leo Tanaka")).getByText("FIELD OPS / PARTNERS")).toBeInTheDocument();
    // The cards count every team: one of two self-reviews shared.
    expect(screen.getByText("Self-reviews shared").closest("div")!.parentElement).toHaveTextContent("1 / 2");
  });

  it("finds members by their team in the search", () => {
    render(<ParLeadTeamRoster cycle={cycle} teams={[PLATFORM, FIELD_OPS]} onOpenReview={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("Search Members"), { target: { value: "partners" } });
    expect(screen.getByText("Leo Tanaka")).toBeInTheDocument();
    expect(screen.queryByText("Maya Fernando")).not.toBeInTheDocument();
  });

  it("shares a team's PARs once that team's own deadline has passed, whatever the others' are", () => {
    render(<ParLeadTeamRoster cycle={cycle} teams={[PLATFORM, FIELD_OPS]} onOpenReview={() => {}} />);
    pickRow("Maya Fernando");
    expect(screen.getByRole("button", { name: "Share" })).toBeEnabled();
    pickRow("Leo Tanaka");
    expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
  });

  it("shares the picked PARs one by one, then reloads the rosters once", async () => {
    rosters = [
      { details: [member(11, "Maya Fernando", "maya@example.com"), member(13, "Sam Perera", "sam@example.com")] },
      { details: [member(12, "Leo Tanaka", "leo@example.com")] },
    ];
    ratingMutateAsync.mockReset().mockResolvedValue(undefined);
    refreshAfterRatingUpdates.mockReset().mockResolvedValue(undefined);
    render(<ParLeadTeamRoster cycle={cycle} teams={[PLATFORM, FIELD_OPS]} onOpenReview={() => {}} />);
    pickRow("Maya Fernando");
    pickRow("Sam Perera");
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Share" }));
    await waitFor(() => expect(refreshAfterRatingUpdates).toHaveBeenCalledTimes(1));
    expect(ratingMutateAsync.mock.calls.map(([v]) => [v.employeeEmail, v.refreshLater])).toEqual([
      ["maya@example.com", true],
      ["sam@example.com", true],
    ]);
    expect(refreshAfterRatingUpdates).toHaveBeenCalledWith(["maya@example.com", "sam@example.com"]);
  });

  it("names the team and has no Team column for a lead with one team", () => {
    rosters = [rosters[0]];
    render(<ParLeadTeamRoster cycle={cycle} teams={[PLATFORM]} onOpenReview={() => {}} />);
    expect(screen.getByText("Corporate / PLATFORM / RELIABILITY")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Team" })).not.toBeInTheDocument();
  });
});
