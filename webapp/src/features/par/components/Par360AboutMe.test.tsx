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
import type { ParCycle } from "../api/types";

let rating: { parLeadStatus: string; parIsLeadershipEmployee: boolean } = {
  parLeadStatus: "PENDING",
  parIsLeadershipEmployee: false,
};
const requestReviewers = { mutate: vi.fn(), isPending: false, error: null };
vi.mock("../api/useParData", () => ({
  useParEmployeeInfo: () => ({ data: { leadEmail: "hannah@example.com" } }),
  useParRating: () => ({ data: rating }),
}));
vi.mock("../api/usePar360", () => ({
  useReviewers: () => ({
    data: [{ reviewerEmail: "alex@example.com", reviewerName: "Alex Morgan", reviewStatus: "SHARED", relationship: "PEER" }],
    isLoading: false,
    isError: false,
  }),
  useRequestReviewers: () => requestReviewers,
  useParticipants: () => ({
    data: [
      { workEmail: "alex@example.com", employeeName: "Alex Morgan" },
      { workEmail: "maya@example.com", employeeName: "Maya Fernando" },
    ],
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("../api/useReview360", () => ({ useReviewSummary: () => ({ data: undefined, isLoading: false }) }));
vi.mock("../api/useReviewerSuggestions", () => ({
  useReviewerSuggestions: () => ({
    data: { meetingsSince: "2026-08-13", suggestions: [{ workEmail: "maya@example.com", employeeName: "Maya Fernando" }] },
  }),
}));
vi.mock("@features/leave/api/useLeaveData", () => ({
  useLeaveEmployees: () => ({ data: [], isLoading: false, isError: false }),
}));

const { default: Par360AboutMe } = await import("./Par360AboutMe");

const cycle = (deadline: string) => ({ parCycleId: 2, parThreeSixtyRatingDeadline: deadline }) as ParCycle;
const OPEN = "2999-12-31";

beforeEach(() => {
  rating = { parLeadStatus: "PENDING", parIsLeadershipEmployee: false };
  requestReviewers.mutate.mockReset();
});

describe("Par360AboutMe", () => {
  it("shows the calendar suggestions and the people search straight away", () => {
    render(<Par360AboutMe cycle={cycle(OPEN)} workEmail="ravi@example.com" />);
    expect(screen.queryByRole("button", { name: "Request feedback" })).not.toBeInTheDocument();
    // How many have answered sits on the title's line.
    expect(screen.getByText("Feedback requests").parentElement).toContainElement(screen.getByText("1 of 1 submitted."));
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.getByText("Suggested from your calendar:")).toBeInTheDocument();
    const field = screen.getByRole("combobox");
    expect(field).not.toHaveFocus();
    // The suggestions come before the field, and both before the people already asked.
    const suggestion = screen.getByRole("button", { name: "Add Maya Fernando" });
    const asked = screen.getByText("Alex Morgan");
    expect(suggestion.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(field.compareDocumentPosition(asked) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("starts again empty once a request goes through", () => {
    requestReviewers.mutate.mockImplementation((_vars, { onSuccess }) => onSuccess());
    render(<Par360AboutMe cycle={cycle(OPEN)} workEmail="ravi@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Add Maya Fernando" }));
    fireEvent.click(screen.getByRole("button", { name: "Peer" }));
    fireEvent.click(screen.getByRole("button", { name: "Request" }));
    expect(requestReviewers.mutate).toHaveBeenCalledWith(
      { reviewerEmails: ["maya@example.com"], relationships: { "maya@example.com": "PEER" } },
      expect.anything(),
    );
    expect(screen.queryByText("How does each person work with you?")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request" })).toBeDisabled();
  });

  it("keeps what was picked when the request fails", () => {
    render(<Par360AboutMe cycle={cycle(OPEN)} workEmail="ravi@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Add Maya Fernando" }));
    fireEvent.click(screen.getByRole("button", { name: "Peer" }));
    fireEvent.click(screen.getByRole("button", { name: "Request" }));
    expect(screen.getByText("How does each person work with you?")).toBeInTheDocument();
  });

  it("has no picker once the lead has shared the PAR", () => {
    rating = { parLeadStatus: "SHARED", parIsLeadershipEmployee: false };
    render(<Par360AboutMe cycle={cycle(OPEN)} workEmail="ravi@example.com" />);
    expect(screen.getByText("Your lead has shared your PAR, so no more feedback can be requested.")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("has no picker after the 360° deadline", () => {
    render(<Par360AboutMe cycle={cycle("2020-01-01")} workEmail="ravi@example.com" />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText(/Suggested from/)).not.toBeInTheDocument();
    expect(screen.getByText("Alex Morgan")).toBeInTheDocument();
  });
});
