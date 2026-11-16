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

vi.mock("@features/leave/api/useLeaveData", () => ({
  useLeaveEmployees: () => ({ data: [], isLoading: false, isError: false }),
}));
vi.mock("../api/usePar360", () => ({
  useParticipants: () => ({
    data: [
      { workEmail: "alex@example.com", employeeName: "Alex Morgan" },
      { workEmail: "sam@example.com", employeeName: "Sam Lee" },
      { workEmail: "maya@example.com", employeeName: "Maya Fernando" },
      ...Array.from({ length: 10 }, (_, i) => ({ workEmail: `p${i}@example.com`, employeeName: `Person ${i}` })),
    ],
    isLoading: false,
    isError: false,
  }),
}));
let suggestions: unknown = undefined;
vi.mock("../api/useReviewerSuggestions", () => ({ useReviewerSuggestions: () => ({ data: suggestions }) }));

const { Par360RequestPicker } = await import("./Par360RequestDialog");

function renderPicker(
  onSubmit: (emails: string[], relationships?: Record<string, string>) => void,
  { existingEmails = [] as string[], subjectName = undefined as string | undefined, alwaysShown = false } = {},
) {
  return render(
    <Par360RequestPicker
      open
      selfEmail="ravi@example.com"
      leadEmail="hannah@example.com"
      existingEmails={existingEmails}
      onSubmit={onSubmit}
      onCancel={alwaysShown ? undefined : () => {}}
      isSubmitting={false}
      error={undefined}
      parCycleId={2}
      askRelationship
      subjectName={subjectName}
    />,
  );
}

beforeEach(() => {
  suggestions = undefined;
});

// Typing an address and a comma adds it, as picking it from the list does.
function add(email: string) {
  const field = screen.getByRole("combobox");
  fireEvent.change(field, { target: { value: email } });
  fireEvent.keyDown(field, { key: "," });
}

describe("Par360RequestPicker", () => {
  it("asks Peer or Cross-team for each person before requesting", () => {
    const onSubmit = vi.fn();
    renderPicker(onSubmit);
    add("alex@example.com");
    add("sam@example.com");
    expect(screen.getByText("How does each person work with you?")).toBeInTheDocument();
    const request = screen.getByRole("button", { name: "Request" });
    expect(request).toBeDisabled();

    fireEvent.click(screen.getAllByRole("button", { name: "Peer" })[0]);
    expect(request).toBeDisabled();
    fireEvent.click(screen.getAllByRole("button", { name: "Cross-team" })[1]);
    fireEvent.click(request);
    expect(onSubmit).toHaveBeenCalledWith(["alex@example.com", "sam@example.com"], {
      "alex@example.com": "PEER",
      "sam@example.com": "CROSS_TEAM",
    });
  });

  it("drops a person removed from the list", () => {
    const onSubmit = vi.fn();
    renderPicker(onSubmit);
    add("alex@example.com");
    add("sam@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Remove Sam Lee" }));
    fireEvent.click(screen.getByRole("button", { name: "Peer" }));
    fireEvent.click(screen.getByRole("button", { name: "Request" }));
    expect(onSubmit).toHaveBeenCalledWith(["alex@example.com"], { "alex@example.com": "PEER" });
  });

  it("suggests people from the calendar by name only, adding them with Peer or Cross-team still to choose", () => {
    suggestions = {
      meetingsSince: "2026-08-13",
      suggestions: [
        { workEmail: "maya@example.com", employeeName: "Maya Fernando", meetingsTogether: 9 },
        { workEmail: "sam@example.com", employeeName: "Sam Lee", meetingsTogether: 1 },
        { workEmail: "alex@example.com", employeeName: "Alex Morgan", meetingsTogether: 4 },
      ],
    };
    const onSubmit = vi.fn();
    renderPicker(onSubmit, { existingEmails: ["alex@example.com"] });
    expect(screen.getByText("Suggested from your calendar:")).toBeInTheDocument();
    expect(screen.queryByText(/meeting|13 Aug/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Maya Fernando" })).toHaveTextContent(/^Maya Fernando$/);
    expect(screen.getByRole("button", { name: "Add Sam Lee" })).toBeInTheDocument();
    expect(screen.queryByText(/Alex Morgan/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add Maya Fernando" }));
    expect(screen.queryByRole("button", { name: "Add Maya Fernando" })).not.toBeInTheDocument();
    const request = screen.getByRole("button", { name: "Request" });
    expect(request).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cross-team" }));
    fireEvent.click(request);
    expect(onSubmit).toHaveBeenCalledWith(["maya@example.com"], { "maya@example.com": "CROSS_TEAM" });
  });

  it("says whose calendar for a lead", () => {
    suggestions = { meetingsSince: "2026-08-13", suggestions: [{ workEmail: "maya@example.com", employeeName: "Maya Fernando" }] };
    renderPicker(vi.fn(), { subjectName: "Ravi" });
    expect(screen.getByText("Suggested from Ravi's calendar:")).toBeInTheDocument();
  });

  it("says whose calendar when the name isn't known", () => {
    suggestions = { meetingsSince: "2026-08-13", suggestions: [{ workEmail: "maya@example.com", employeeName: "Maya Fernando" }] };
    renderPicker(vi.fn(), { subjectName: "them" });
    expect(screen.getByText("Suggested from their calendar:")).toBeInTheDocument();
  });

  it("offers the suggestions 8 at a time, with Suggest more for the rest", () => {
    suggestions = {
      meetingsSince: "2026-08-13",
      suggestions: Array.from({ length: 10 }, (_, i) => ({ workEmail: `p${i}@example.com`, employeeName: `Person ${i}` })),
    };
    renderPicker(vi.fn());
    const chips = () => screen.getAllByRole("button", { name: /^Add Person/ });
    expect(chips()).toHaveLength(8);
    expect(screen.queryByRole("button", { name: "Add Person 8" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add Person 0" }));
    expect(chips()).toHaveLength(7);

    fireEvent.click(screen.getByRole("button", { name: "Suggest more" }));
    expect(chips()).toHaveLength(9);
    expect(screen.getByRole("button", { name: "Add Person 9" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Suggest more" })).not.toBeInTheDocument();
  });

  it("keeps Suggest more when every shown suggestion is picked", () => {
    suggestions = {
      meetingsSince: "2026-08-13",
      suggestions: Array.from({ length: 9 }, (_, i) => ({ workEmail: `p${i}@example.com`, employeeName: `Person ${i}` })),
    };
    renderPicker(vi.fn());
    for (let i = 0; i < 8; i++) fireEvent.click(screen.getByRole("button", { name: `Add Person ${i}` }));
    fireEvent.click(screen.getByRole("button", { name: "Suggest more" }));
    expect(screen.getByRole("button", { name: "Add Person 8" })).toBeInTheDocument();
  });

  it("has Cancel and takes focus when it's opened, but neither when it's always shown", () => {
    const { unmount } = renderPicker(vi.fn());
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveFocus();
    unmount();

    renderPicker(vi.fn(), { alwaysShown: true });
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).not.toHaveFocus();
  });

  it("leaves the row out when there's nothing to suggest", () => {
    renderPicker(vi.fn());
    expect(screen.queryByText(/Suggested from/)).not.toBeInTheDocument();
  });
});
