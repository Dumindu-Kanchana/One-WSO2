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
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { Okr, OkrComment } from "../api/okrTypes";
import { testAction, testKeyResult, testOkr } from "../testing/fixtures";

const calls = {
  setStatus: vi.fn(),
  remove: vi.fn(),
  setKeyResultStatus: vi.fn(),
  measure: vi.fn(),
  addAction: vi.fn(),
  updateAction: vi.fn(),
  removeAction: vi.fn(),
  comment: vi.fn(),
};
let comments: OkrComment[] = [];
const mutation = (fn: (...args: unknown[]) => void) => () => ({
  mutate: fn,
  isPending: false,
  isError: false,
  error: null,
});

vi.mock("../api/useOkrs", () => ({
  useSetOkrStatus: mutation(calls.setStatus),
  useDeleteOkr: mutation(calls.remove),
  useSetKeyResultStatus: mutation(calls.setKeyResultStatus),
  useUpdateKeyResultMeasure: mutation(calls.measure),
  useAddOkrAction: mutation(calls.addAction),
  useUpdateOkrAction: mutation(calls.updateAction),
  useRemoveOkrAction: mutation(calls.removeAction),
  useOkrComments: () => ({ data: comments, isLoading: false, isError: false }),
  useAddOkrComment: () => ({ mutate: calls.comment, isPending: false, isError: false, error: null }),
}));
vi.mock("./OkrDialog", () => ({ default: () => <div>Edit dialog</div> }));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));

const { default: OkrObjectiveCard } = await import("./OkrObjectiveCard");

const show = (okr: Okr) => render(<OkrObjectiveCard okr={okr} index={0} />);
const menuItems = () => screen.getAllByRole("menuitem").map((m) => m.textContent);

beforeEach(() => {
  Object.values(calls).forEach((fn) => fn.mockReset());
  comments = [];
});

describe("OkrObjectiveCard", () => {
  it("numbers the objective and says how many key results are completed", () => {
    show(
      testOkr({
        keyResults: [testKeyResult({ keyResultId: 1, status: "COMPLETED" }), testKeyResult({ keyResultId: 2 })],
      }),
    );
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 key results completed")).toBeInTheDocument();
  });

  it("offers editing, completing, closing and deleting an open one, and reopening a finished one", () => {
    const { unmount } = show(testOkr());
    fireEvent.click(screen.getByRole("button", { name: "Change Grow enterprise retention" }));
    expect(menuItems()).toEqual(["Edit", "Mark completed", "Close", "Delete"]);
    unmount();

    show(
      testOkr({
        status: "CLOSED",
        closeReason: "Merged into the renewal objective",
        statusChangedBy: "a@example.com",
        ownerName: "Amal",
      }),
    );
    expect(screen.getByText("Merged into the renewal objective")).toBeInTheDocument();
    expect(screen.getByText(/Closed by Amal/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Change Grow enterprise retention" }));
    expect(menuItems()).toEqual(["Reopen", "Delete"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Reopen" }));
    expect(calls.setStatus).toHaveBeenCalledWith({ okrId: 1, status: "OPEN", reason: undefined }, expect.anything());
  });

  it("has no menu for someone who doesn't manage it", () => {
    show(testOkr({ canManage: false }));
    expect(screen.queryByRole("button", { name: "Change Grow enterprise retention" })).not.toBeInTheDocument();
  });

  it("says whose someone else's objective is, and leaves managing it to its owner's page", () => {
    render(<OkrObjectiveCard okr={testOkr({ ownerName: "Hannah Lee" })} index={0} othersObjective />);
    expect(screen.getByText("Hannah Lee's objective")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change Grow enterprise retention" })).not.toBeInTheDocument();
  });

  it("says what deleting does before it does it", () => {
    show(testOkr());
    fireEvent.click(screen.getByRole("button", { name: "Change Grow enterprise retention" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(screen.getByText(/Only an OKR nobody has worked on can be deleted/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(calls.remove).toHaveBeenCalledWith(1, expect.anything());
  });
});

describe("a key result", () => {
  const withKeyResult = (over = {}, okrOver: Partial<Okr> = {}) =>
    show(
      testOkr({
        version: 3,
        keyResults: [
          testKeyResult({
            keyResultId: 5,
            title: "Maintain an NPS of 60+",
            ownerName: "Priya Nair",
            baseline: "59",
            target: "60",
            ...over,
          }),
        ],
        ...okrOver,
      }),
    );

  it("shows whose it is, its measure and due date, and where it stands", () => {
    withKeyResult({ dueDate: "2000-01-31", status: "AT_RISK" });
    expect(screen.getByText("Priya Nair")).toBeInTheDocument();
    expect(screen.getByText("59 → 60")).toBeInTheDocument();
    // The key result is overdue; the objective, the topic it sits under, is just open.
    expect(screen.getAllByText("Overdue")).toHaveLength(1);
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Status: At risk. Change it" })).toBeInTheDocument();
  });

  it("changes its status from the menu", () => {
    withKeyResult();
    fireEvent.click(screen.getByRole("button", { name: "Status: Not started. Change it" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "On track" }));
    expect(calls.setKeyResultStatus).toHaveBeenCalledWith({ keyResultId: 5, status: "ON_TRACK" }, expect.anything());
  });

  it("only shows its status to someone who can't change it, or once the objective is completed", () => {
    const { unmount } = withKeyResult({ canUpdate: false });
    expect(screen.queryByRole("button", { name: /Change it$/ })).not.toBeInTheDocument();
    expect(screen.getByText("Not started")).toBeInTheDocument();
    unmount();
    withKeyResult({}, { status: "COMPLETED" });
    expect(screen.queryByRole("button", { name: /Change it$/ })).not.toBeInTheDocument();
  });

  it("opens its status over time", () => {
    withKeyResult();
    fireEvent.click(screen.getByRole("button", { name: "Status over time" }));
    expect(screen.getByText("Status over time")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide chart" })).toBeInTheDocument();
  });

  it("changes its measure from the version the objective is at", () => {
    withKeyResult();
    fireEvent.click(screen.getByRole("button", { name: "Show the details of Maintain an NPS of 60+" }));
    fireEvent.click(screen.getByRole("button", { name: "Change the baseline and target" }));
    fireEvent.change(screen.getByLabelText("Target"), { target: { value: " 62 " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(calls.measure).toHaveBeenCalledWith(
      { keyResultId: 5, version: 3, baseline: "59", target: "62" },
      expect.anything(),
    );
  });

  describe("its actions", () => {
    const open = (over = {}, okrOver: Partial<Okr> = {}) => {
      withKeyResult(
        { actions: [testAction({ actionId: 9, title: "Run the survey", commentCount: 2 })], ...over },
        okrOver,
      );
      fireEvent.click(screen.getByRole("button", { name: "Show the details of Maintain an NPS of 60+" }));
    };

    it("are added, ticked off and removed by whoever may update it", () => {
      open();
      fireEvent.change(screen.getByLabelText("Add an action"), { target: { value: " Share the results " } });
      fireEvent.keyDown(screen.getByLabelText("Add an action"), { key: "Enter" });
      expect(calls.addAction).toHaveBeenCalledWith({ keyResultId: 5, title: "Share the results" }, expect.anything());
      fireEvent.click(screen.getByRole("checkbox", { name: "Run the survey: not done" }));
      expect(calls.updateAction).toHaveBeenCalledWith({ actionId: 9, done: true }, expect.anything());
      fireEvent.click(screen.getByRole("button", { name: "Remove Run the survey" }));
      expect(calls.removeAction).toHaveBeenCalledWith(9, expect.anything());
    });

    it("are only read by someone who may not", () => {
      open({ canUpdate: false });
      expect(screen.queryByLabelText("Add an action")).not.toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: "Run the survey: not done" })).toBeDisabled();
      expect(screen.queryByRole("button", { name: "Remove Run the survey" })).not.toBeInTheDocument();
    });

    it("each open to their comments, where anyone who can see it adds one", () => {
      comments = [
        {
          commentId: 1,
          comment: "Two moved above 90.",
          createdBy: "h@example.com",
          authorName: "Hannah Lee",
          createdOn: "2026-10-20T11:30:00Z",
        },
      ];
      open({ canUpdate: false });
      fireEvent.click(screen.getByRole("button", { name: "2 comments on Run the survey" }));
      const thread = screen.getByText("Two moved above 90.").parentElement?.parentElement as HTMLElement;
      expect(within(thread).getByText("Hannah Lee")).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("Add a comment"), { target: { value: " Good. " } });
      fireEvent.click(screen.getByRole("button", { name: "Comment" }));
      expect(calls.comment).toHaveBeenCalledWith("Good.", expect.anything());
    });

    it("take no new comments once the objective is closed", () => {
      open({}, { status: "CLOSED" });
      fireEvent.click(screen.getByRole("button", { name: "2 comments on Run the survey" }));
      expect(screen.queryByLabelText("Add a comment")).not.toBeInTheDocument();
    });
  });
});
