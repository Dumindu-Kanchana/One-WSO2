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
import { fireEvent, render, screen } from "@testing-library/react";
import type { ParLegacyHistory } from "../api/types";

const history: {
  data?: ParLegacyHistory[];
  isLoading: boolean;
  isError: boolean;
  error?: Error;
  isFetching: boolean;
  refetch: () => void;
} = {
  data: [],
  isLoading: false,
  isError: false,
  isFetching: false,
  refetch: () => {},
};

const requestedCycles = vi.hoisted(() => [] as string[]);
vi.mock("../api/useParAdmin", () => ({
  useLegacyParHistoryByCycle: (cycleName: string) => {
    requestedCycles.push(cycleName);
    return history;
  },
}));
vi.mock("../api/useLeadHistory", () => ({
  useParLegacyHistory: () => ({ data: undefined, isLoading: false, isError: false }),
}));
// Module-level, like `history`: a fresh array per render would rebuild the
// memoized columns every time, which React Query never does in production.
const leaveEmployees = { data: [] };
vi.mock("@features/leave/api/useLeaveData", () => ({ useLeaveEmployees: () => leaveEmployees }));

const { default: ParAdminLegacyCycleView } = await import("./ParAdminLegacyCycleView");

function legacyRecord(overrides: Partial<ParLegacyHistory> = {}): ParLegacyHistory {
  return {
    legacyHeaderId: 1,
    employeeEmail: "jane@wso2.com",
    employeeName: "Jane Doe",
    location: null,
    businessUnit: "Engineering",
    department: "Platform",
    team: "Core",
    subTeam: null,
    reviewerName: "Lead One",
    reviewerEmail: null,
    cycleName: "2024 Performance Evaluation - H1",
    reviewCompletedDate: null,
    overallRating: null,
    overallSpecialRating: null,
    overallCommentEmployee: "employee comment",
    overallCommentManager: "lead comment",
    employeeScoreCode: null,
    managerScoreCode: 3,
    employeeHasQuestionAnswer: false,
    questionAnswers: null,
    feedback360: null,
    ...overrides,
  };
}

// Two teams (one per lead) for the given cycle. Lead One's team has a named
// employee and one whose sheet row had no name.
function seed(cycleName: string) {
  history.data = [
    legacyRecord({ legacyHeaderId: 1, cycleName }),
    legacyRecord({ legacyHeaderId: 2, cycleName, employeeEmail: "noname@wso2.com", employeeName: null }),
    legacyRecord({ legacyHeaderId: 3, cycleName, employeeEmail: "sam@wso2.com", employeeName: "Sam Lee", reviewerName: "Lead Two" }),
  ];
}

function show(cycleName: string, onBack: () => void = () => {}) {
  return render(<ParAdminLegacyCycleView cycleName={cycleName} onBack={onBack} />);
}

function openTeam(index: number) {
  fireEvent.click(screen.getAllByRole("button", { name: "Open Group" })[index]);
}

beforeEach(() => {
  history.isLoading = false;
  history.isError = false;
  history.error = undefined;
});

describe("ParAdminLegacyCycleView", () => {
  it.each([
    ["the cycle fails to load", () => {
      history.isError = true;
      history.error = new Error("Failed to fetch");
    }],
    ["the cycle is still loading", () => {
      history.isLoading = true;
    }],
  ])("keeps Back and the History link when %s", (_, setState) => {
    const cycle = "2016 Quarterly Review - Q3/Q4";
    seed(cycle);
    setState();
    const onBack = vi.fn();
    show(cycle, onBack);

    expect(screen.getByText(cycle)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    expect(onBack).toHaveBeenCalledTimes(2);
    if (history.isError) {
      expect(screen.getByText(/Couldn't load this legacy cycle's PAR history/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    }
  });

  it("titles a 2015 cycle with its new name but still loads it by the stored name", () => {
    const stored = "2015 ANNUAL PERFORMANCE REVIEW for Team Leads";
    seed(stored);
    requestedCycles.length = 0;
    show(stored);
    expect(screen.getByText("2015 Annual Performance Evaluation - Team Leads")).toBeInTheDocument();
    expect(screen.queryByText(stored)).not.toBeInTheDocument();
    expect(new Set(requestedCycles)).toEqual(new Set([stored]));

    openTeam(0);
    expect(screen.getByText("2015 Annual Performance Evaluation - Team Leads")).toBeInTheDocument();
    expect(screen.queryByText(stored)).not.toBeInTheDocument();
  });

  it("titles any other cycle exactly as stored", () => {
    seed("2016 Quarterly Review - Q3/Q4");
    show("2016 Quarterly Review - Q3/Q4");
    expect(screen.getByText("2016 Quarterly Review - Q3/Q4")).toBeInTheDocument();
  });

  it("shows the 5%/20% slot columns from 2021 on", () => {
    seed("2024 Performance Evaluation - H1");
    show("2024 Performance Evaluation - H1");
    expect(screen.getByText("5% Slots")).toBeInTheDocument();
    expect(screen.getByText("20% Slots")).toBeInTheDocument();
  });

  it("hides the 5%/20% slot columns before 2021", () => {
    seed("2018 Performance Evaluation - Q1");
    show("2018 Performance Evaluation - Q1");
    expect(screen.queryByText("5% Slots")).not.toBeInTheDocument();
    expect(screen.queryByText("20% Slots")).not.toBeInTheDocument();
  });

  it("roster shows each member's own legacy name, falling back to the email", () => {
    seed("2024 Performance Evaluation - H1");
    show("2024 Performance Evaluation - H1");
    openTeam(0);

    expect(screen.getByText("Members")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("jane@wso2.com")).toBeInTheDocument();
    // Same team, no migrated name: shown once, as the email, never Jane's name.
    expect(screen.getAllByText("noname@wso2.com")).toHaveLength(1);
    expect(screen.getAllByText("Jane Doe")).toHaveLength(1);
  });

  it("roster search filters by name or email and says when nothing matches", () => {
    seed("2024 Performance Evaluation - H1");
    show("2024 Performance Evaluation - H1");
    openTeam(0);
    const search = screen.getByPlaceholderText("Search Members");

    fireEvent.change(search, { target: { value: "jane" } });
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.queryByText("noname@wso2.com")).not.toBeInTheDocument();

    // A pasted email with a trailing space still matches.
    fireEvent.change(search, { target: { value: "noname@wso2.com " } });
    expect(screen.getByText("noname@wso2.com")).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "nobody" } });
    expect(screen.getByText("No members match your search.")).toBeInTheDocument();
  });

  it("clears the roster search when a different team is opened", () => {
    seed("2024 Performance Evaluation - H1");
    show("2024 Performance Evaluation - H1");
    openTeam(0);
    fireEvent.change(screen.getByPlaceholderText("Search Members"), { target: { value: "jane" } });

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    openTeam(1);

    expect(screen.getByPlaceholderText("Search Members")).toHaveValue("");
    expect(screen.getByText("Sam Lee")).toBeInTheDocument();
  });

  it("keeps the roster search when coming back from a record", () => {
    seed("2024 Performance Evaluation - H1");
    show("2024 Performance Evaluation - H1");
    openTeam(0);
    fireEvent.change(screen.getByPlaceholderText("Search Members"), { target: { value: "jane" } });

    fireEvent.click(screen.getByText("Jane Doe"));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByPlaceholderText("Search Members")).toHaveValue("jane");
    expect(screen.queryByText("noname@wso2.com")).not.toBeInTheDocument();
  });

  it("sorts the roster by name when a team is opened", () => {
    history.data = [
      legacyRecord({ legacyHeaderId: 1, employeeEmail: "zoe@wso2.com", employeeName: "Zoe Young" }),
      legacyRecord({ legacyHeaderId: 2, employeeEmail: "adam@wso2.com", employeeName: "Adam Smith" }),
    ];
    show("2024 Performance Evaluation - H1");
    openTeam(0);
    const names = screen.getAllByText(/^(Adam Smith|Zoe Young)$/).map((el) => el.textContent);
    expect(names).toEqual(["Adam Smith", "Zoe Young"]);
  });

  it("hides the special-rating columns for 2021 H1, which the summary list can't resolve", () => {
    seed("2021 Performance Evaluation - H1");
    show("2021 Performance Evaluation - H1");
    expect(screen.queryByText("5% Slots")).not.toBeInTheDocument();
    openTeam(0);
    expect(screen.queryByText("Top 5%/20% Rating")).not.toBeInTheDocument();
  });

  it("team search ignores the hidden slot counts", () => {
    seed("2018 Performance Evaluation - Q1");
    show("2018 Performance Evaluation - Q1");
    fireEvent.change(screen.getByPlaceholderText("Search Team"), { target: { value: "0" } });
    expect(screen.queryAllByRole("button", { name: "Open Group" })).toHaveLength(0);
  });

  it("roster shows the Top 5%/20% Rating column from 2021 on and hides it before", () => {
    seed("2024 Performance Evaluation - H1");
    const { unmount } = show("2024 Performance Evaluation - H1");
    openTeam(0);
    expect(screen.getByText("Top 5%/20% Rating")).toBeInTheDocument();
    unmount();

    seed("2018 Performance Evaluation - Q1");
    show("2018 Performance Evaluation - Q1");
    openTeam(0);
    expect(screen.getByText("Members")).toBeInTheDocument();
    expect(screen.queryByText("Top 5%/20% Rating")).not.toBeInTheDocument();
  });
});
