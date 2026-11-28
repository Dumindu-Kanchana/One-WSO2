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
import userEvent from "@testing-library/user-event";

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
let suggestionsLoading = false;
vi.mock("../api/useReviewerSuggestions", () => ({
  useReviewerSuggestions: () => ({ data: suggestions, isLoading: suggestionsLoading }),
}));

const { Par360RequestPicker } = await import("./Par360RequestDialog");

function renderPicker(
  onSubmit: (emails: string[]) => void,
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
      subjectName={subjectName}
    />,
  );
}

beforeEach(() => {
  suggestions = undefined;
  suggestionsLoading = false;
});

// Typing an address and a comma adds it, as picking it from the list does.
function add(email: string) {
  const field = screen.getByRole("combobox");
  fireEvent.change(field, { target: { value: email } });
  fireEvent.keyDown(field, { key: "," });
}

describe("Par360RequestPicker: pasting addresses", () => {
  const paste = (text: string) =>
    fireEvent.paste(screen.getByRole("combobox"), { clipboardData: { getData: () => text } });
  const requested = (onSubmit: ReturnType<typeof vi.fn>) => {
    fireEvent.click(screen.getByRole("button", { name: "Request" }));
    return onSubmit.mock.calls.at(-1)![0];
  };

  it("adds everyone in a list copied from an email's To line, in any case", () => {
    const onSubmit = vi.fn();
    renderPicker(onSubmit);
    paste("Alex Morgan <Alex@Example.com>, Sam Lee <sam@example.com>");
    expect(requested(onSubmit)).toEqual(["alex@example.com", "sam@example.com"]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("adds a list separated only by spaces or new lines", () => {
    const onSubmit = vi.fn();
    renderPicker(onSubmit);
    paste("alex@example.com sam@example.com\nmaya@example.com");
    expect(requested(onSubmit)).toEqual(["alex@example.com", "sam@example.com", "maya@example.com"]);
  });

  it("names the addresses it couldn't add, until the field is used again", () => {
    const onSubmit = vi.fn();
    renderPicker(onSubmit, { existingEmails: ["sam@example.com"] });
    paste("alex@example.com; sam@example.com; gone@example.com; hannah@example.com; gone@example.com");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Not added, as they've already been asked or can't be asked: sam@example.com, gone@example.com, hannah@example.com",
    );
    expect(requested(onSubmit)).toEqual(["alex@example.com"]);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "ma" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("takes each address whole, naming one it can't add rather than adding the end of it", () => {
    const onSubmit = vi.fn();
    renderPicker(onSubmit);
    paste("other/alex@example.com; sam@example.com");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Not added, as they've already been asked or can't be asked: other/alex@example.com",
    );
    expect(requested(onSubmit)).toEqual(["sam@example.com"]);
  });

  it("leaves a single address in the search, as typing it would", async () => {
    const user = userEvent.setup();
    renderPicker(vi.fn());
    await user.click(screen.getByRole("combobox"));
    await user.paste("alex@example.com");
    expect(screen.getByRole("combobox")).toHaveValue("alex@example.com");
    expect(screen.getByRole("button", { name: "Request" })).toBeDisabled();
  });
});

describe("Par360RequestPicker", () => {
  it("requests the people picked, without asking how they work with you", () => {
    const onSubmit = vi.fn();
    renderPicker(onSubmit);
    const request = screen.getByRole("button", { name: "Request" });
    expect(request).toBeDisabled();
    add("alex@example.com");
    add("sam@example.com");
    expect(screen.queryByRole("button", { name: "Peer" })).not.toBeInTheDocument();
    fireEvent.click(request);
    expect(onSubmit).toHaveBeenCalledWith(["alex@example.com", "sam@example.com"]);
  });

  it("drops a person removed from the field", () => {
    const onSubmit = vi.fn();
    renderPicker(onSubmit);
    add("alex@example.com");
    add("sam@example.com");
    // A chip removes on Backspace, as from the keyboard.
    fireEvent.keyUp(screen.getByRole("button", { name: "sam@example.com" }), { key: "Backspace" });
    fireEvent.click(screen.getByRole("button", { name: "Request" }));
    expect(onSubmit).toHaveBeenCalledWith(["alex@example.com"]);
  });

  it("suggests people from the calendar by name only, adding them like any other pick", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Request" }));
    expect(onSubmit).toHaveBeenCalledWith(["maya@example.com"]);
  });

  it("holds the suggestions' place above the field while they load, and leaves none when there are none", () => {
    suggestionsLoading = true;
    const view = renderPicker(vi.fn());
    expect(screen.getByText("Suggested from your calendar:")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading suggestions" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Add / })).not.toBeInTheDocument();

    suggestionsLoading = false;
    suggestions = { meetingsSince: "2026-08-13", suggestions: [] };
    view.rerender(
      <Par360RequestPicker
        open
        selfEmail="ravi@example.com"
        leadEmail="hannah@example.com"
        existingEmails={[]}
        onSubmit={vi.fn()}
        onCancel={() => {}}
        isSubmitting={false}
        error={undefined}
        parCycleId={2}
      />,
    );
    expect(screen.queryByText("Suggested from your calendar:")).not.toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Loading suggestions" })).not.toBeInTheDocument();
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
