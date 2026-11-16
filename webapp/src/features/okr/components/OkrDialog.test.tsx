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
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpError } from "@api/http";
import type { OkrPerson } from "../api/okrTypes";
import type { OkrOwnerOption } from "../api/useOkrOwnerSearch";
import { testKeyResult, testOkr } from "../testing/fixtures";

const create = vi.fn<(input: unknown) => Promise<null>>(async () => null);
const update = vi.fn<(input: unknown) => Promise<null>>(async () => null);
const showError = vi.fn();
const searched = vi.fn<(text: string, everyone: boolean, enabled: boolean) => void>();
const teamSearched = vi.fn<(owner: string | undefined, text: string) => void>();
const people: OkrOwnerOption[] = [
  { workEmail: "Ravi.Kumar@example.com", name: "Ravi Kumar", jobRole: "Engineer", thumbnail: null },
  { workEmail: "maya@example.com", name: "Maya Fernando", jobRole: null, thumbnail: null },
];
const team: OkrPerson[] = [{ workEmail: "nadia@example.com", name: "Nadia Rahman", jobRole: "SRE" }];

vi.mock("../api/useOkrs", () => ({
  useCreateOkr: () => ({ mutateAsync: create, isPending: false, error: null }),
  useUpdateOkr: () => ({ mutateAsync: update, isPending: false, error: null }),
  useOkrTeam: (owner: string | undefined, text: string) => {
    teamSearched(owner, text);
    return { data: owner ? team : [], isFetching: false, isError: false };
  },
}));
vi.mock("../api/useOkrOwnerSearch", () => ({
  useOkrOwnerSearch: (text: string, everyone: boolean, enabled: boolean) => {
    searched(text, everyone, enabled);
    return { data: people, isFetching: false, isError: false };
  },
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError }),
}));

const { default: OkrDialog } = await import("./OkrDialog");

// The objective and its first key result, with the key result's due date: the
// objective has none of its own.
function fill({ keyResult = "Runs in CI", due = "2026-12-31" } = {}) {
  fireEvent.change(screen.getByLabelText("Objective"), { target: { value: "  Automate the release checks " } });
  fireEvent.change(screen.getByLabelText("Key result 1"), { target: { value: keyResult } });
  if (due) fireEvent.change(screen.getByLabelText("Due date"), { target: { value: due } });
}

beforeEach(() => {
  for (const fn of [create, update, showError, searched, teamSearched]) fn.mockReset();
});

describe("OkrDialog", () => {
  it("searches a lead's own team, and sets the objective for who they pick", async () => {
    render(<OkrDialog open onClose={() => {}} />);
    expect(searched).toHaveBeenLastCalledWith("", false, true);
    expect(screen.getByText("Anyone in your team, directly or further down.")).toBeInTheDocument();

    await userEvent.type(screen.getByRole("combobox", { name: "Whose objective" }), "rav");
    await waitFor(() => expect(searched).toHaveBeenLastCalledWith("rav", false, true));
    await userEvent.click(await screen.findByText("Ravi Kumar"));
    fill();
    fireEvent.change(screen.getByLabelText("Baseline"), { target: { value: " 3 " } });
    fireEvent.change(screen.getByLabelText("Target"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Set OKR" }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        ownerEmail: "ravi.kumar@example.com",
        objective: "Automate the release checks",
        keyResults: [{ title: "Runs in CI", baseline: "3", target: "10", dueDate: "2026-12-31" }],
      }),
    );
  });

  it("takes as many key results as it needs", () => {
    render(<OkrDialog open onClose={() => {}} owner={{ workEmail: "hannah@example.com" }} />);
    for (let i = 0; i < 7; i++) fireEvent.click(screen.getByRole("button", { name: "Add a key result" }));
    expect(screen.getByLabelText("Key result 8")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a key result" })).toBeInTheDocument();
  });

  it("searches everyone for a People Ops admin", () => {
    render(<OkrDialog open onClose={() => {}} canPickAnyone />);
    expect(searched).toHaveBeenLastCalledWith("", true, true);
    expect(screen.getByText("Anyone in the company.")).toBeInTheDocument();
  });

  it("asks whose objective it is before saving", () => {
    render(<OkrDialog open onClose={() => {}} />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Set OKR" }));
    expect(screen.getByText("Pick whose objective it is.")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("names the person already picked, and gives a key result to someone in their team", async () => {
    render(<OkrDialog open onClose={() => {}} owner={{ workEmail: "hannah@example.com", name: "Hannah Lee" }} />);
    expect(screen.getByText("Hannah Lee")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Whose objective" })).not.toBeInTheDocument();
    expect(searched).toHaveBeenLastCalledWith("", false, false);
    expect(teamSearched).toHaveBeenLastCalledWith("hannah@example.com", "");

    fill({ due: "2026-11-30" });
    await userEvent.click(screen.getByRole("combobox", { name: "Owner of key result 1" }));
    await userEvent.click(await screen.findByText("Nadia Rahman"));
    fireEvent.click(screen.getByRole("button", { name: "Set OKR" }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerEmail: "hannah@example.com",
          keyResults: [{ title: "Runs in CI", ownerEmail: "nadia@example.com", baseline: "", target: "", dueDate: "2026-11-30" }],
        }),
      ),
    );
  });

  it("has no due date for the objective, and won't save a key result without one, or one with no title", () => {
    render(<OkrDialog open onClose={() => {}} owner={{ workEmail: "hannah@example.com" }} />);
    // The one date field is the key result's.
    expect(screen.getAllByLabelText("Due date")).toHaveLength(1);
    fill({ due: "" });
    fireEvent.click(screen.getByRole("button", { name: "Set OKR" }));
    expect(screen.getByText("Pick a due date.")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-11-30" } });
    fireEvent.change(screen.getByLabelText("Key result 1"), { target: { value: " " } });
    fireEvent.change(screen.getByLabelText("Baseline"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Set OKR" }));
    expect(screen.getByText("Write the key result, or remove it.")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("changes an objective from the version it opened, keeping its key results' IDs", async () => {
    const okr = testOkr({
      version: 4,
      keyResults: [testKeyResult({ keyResultId: 7, ownerEmail: "nadia@example.com", ownerName: "Nadia Rahman" })],
    });
    const onClose = vi.fn();
    render(<OkrDialog open onClose={onClose} okr={okr} />);
    fireEvent.change(screen.getByLabelText("Objective"), { target: { value: "Grow it" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({
        okrId: 1,
        update: {
          version: 4,
          objective: "Grow it",
          keyResults: [
            {
              keyResultId: 7,
              title: "Gross retention at 92%",
              ownerEmail: "nadia@example.com",
              baseline: "",
              target: "",
              dueDate: "2026-12-31",
            },
          ],
        },
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("closes, saying so, when someone changed the objective meanwhile", async () => {
    update.mockRejectedValueOnce(new HttpError("http://people/okrs/1", 409, '{"message":"Someone changed this OKR"}'));
    const onClose = vi.fn();
    render(<OkrDialog open onClose={onClose} okr={testOkr()} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(showError).toHaveBeenCalledWith("Someone changed this OKR");
  });
});
