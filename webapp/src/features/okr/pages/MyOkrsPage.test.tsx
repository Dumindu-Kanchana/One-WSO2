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
import type { Okr } from "../api/okrTypes";
import { due, testKeyResult as kr, testOkr } from "../testing/fixtures";

let okrs: { data?: Okr[]; isLoading?: boolean; isError?: boolean; error?: Error };
const useOkrs = vi.fn<(email: string | undefined) => typeof okrs>(() => okrs);
const dialogs = vi.fn<(props: { owner?: { workEmail: string; name?: string } }) => void>();
const mutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, error: null });

vi.mock("@api/useUserInfo", () => ({
  useUserInfo: () => ({
    data: { workEmail: "ravi@example.com", firstName: "Ravi", lastName: "Kumar" },
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("../api/useOkrs", () => ({
  useOkrs: (email: string | undefined) => useOkrs(email),
  useSetOkrStatus: mutation,
  useDeleteOkr: mutation,
  useSetKeyResultStatus: mutation,
  useUpdateKeyResultMeasure: mutation,
  useAddOkrAction: mutation,
  useUpdateOkrAction: mutation,
  useRemoveOkrAction: mutation,
}));
vi.mock("../components/OkrDialog", () => ({
  default: (props: { owner?: { workEmail: string; name?: string } }) => {
    dialogs(props);
    return <div>Set an OKR dialog</div>;
  },
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));

const { default: MyOkrsPage } = await import("./MyOkrsPage");

const RAVI = "ravi@example.com";
const okr = (over: Partial<Okr>) =>
  testOkr({ ownerEmail: RAVI, ownerName: "Ravi Kumar", objective: "Automate the release checks", ...over });
const cards = () => screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

beforeEach(() => {
  useOkrs.mockClear();
  dialogs.mockClear();
});

describe("MyOkrsPage", () => {
  it("shows the objectives you own and those with a key result of yours, open ones first", () => {
    okrs = {
      data: [
        okr({ okrId: 1, keyResults: [kr({ keyResultId: 1, ownerEmail: RAVI, status: "COMPLETED" })] }),
        okr({
          okrId: 2,
          objective: "Improve reliability",
          ownerEmail: "hannah@example.com",
          ownerName: "Hannah Lee",
          canManage: false,
          keyResults: [
            kr({ keyResultId: 2, ownerEmail: "hannah@example.com", ownerName: "Hannah Lee" }),
            kr({ keyResultId: 3, ownerEmail: RAVI, ownerName: "Ravi Kumar", dueDate: "2000-01-31" }),
          ],
        }),
        okr({ okrId: 3, objective: "Ship the onboarding flow", status: "COMPLETED", keyResults: [kr({ keyResultId: 4, ownerEmail: RAVI })] }),
      ],
    };
    render(<MyOkrsPage />);
    expect(useOkrs).toHaveBeenCalledWith(RAVI);
    expect(cards()).toEqual(["Improve reliability", "Automate the release checks", "Ship the onboarding flow"]);
    // Counts what's yours: all of your own objective's, and only your own on Hannah's.
    expect(screen.getByText("1 of 3 key results completed · 1 overdue")).toBeInTheDocument();
    expect(screen.getByText("Hannah Lee's objective")).toBeInTheDocument();
  });

  it("shows only your key results on someone else's objective, and leaves managing it to them", () => {
    okrs = {
      data: [
        okr({
          okrId: 2,
          objective: "Improve reliability",
          ownerEmail: "hannah@example.com",
          ownerName: "Hannah Lee",
          canManage: true,
          keyResults: [
            kr({ keyResultId: 2, ownerEmail: "hannah@example.com", title: "Score of 95" }),
            kr({ keyResultId: 3, ownerEmail: RAVI, title: "Release checks" }),
          ],
        }),
      ],
    };
    render(<MyOkrsPage />);
    expect(screen.getByText("Release checks")).toBeInTheDocument();
    expect(screen.queryByText("Score of 95")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change Improve reliability" })).not.toBeInTheDocument();
  });

  it("leaves out someone else's objective with no key result of yours", () => {
    okrs = {
      data: [
        okr({ okrId: 1 }),
        okr({ okrId: 2, objective: "Not mine", ownerEmail: "hannah@example.com", keyResults: [kr({ ownerEmail: "x@example.com" })] }),
      ],
    };
    render(<MyOkrsPage />);
    expect(cards()).toEqual(["Automate the release checks"]);
  });

  it("lets you change only what's yours to change", () => {
    okrs = {
      data: [
        okr({ okrId: 1, keyResults: [kr({ keyResultId: 1, ownerEmail: RAVI, title: "Runs in CI" })] }),
        okr({
          okrId: 2,
          objective: "Improve reliability",
          ownerEmail: "hannah@example.com",
          canManage: false,
          keyResults: [
            kr({ keyResultId: 2, ownerEmail: "hannah@example.com", title: "Score of 95", canUpdate: false }),
            kr({ keyResultId: 3, ownerEmail: RAVI, title: "Release checks", canUpdate: true }),
          ],
        }),
      ],
    };
    render(<MyOkrsPage />);
    expect(screen.getByRole("button", { name: "Change Automate the release checks" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change Improve reliability" })).not.toBeInTheDocument();
    // The status of your key result is a menu; your lead's is only shown.
    expect(screen.getAllByRole("button", { name: /^Status: .*Change it$/ })).toHaveLength(2);
  });

  it("sets an OKR for yourself", () => {
    okrs = { data: [okr({})] };
    render(<MyOkrsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Set an OKR" }));
    expect(dialogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ owner: { workEmail: RAVI, name: "Ravi Kumar" } }),
    );
  });

  it("says so when there are none, and still lets you set one", () => {
    okrs = { data: [] };
    render(<MyOkrsPage />);
    expect(screen.getByText("No OKRs yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Set an OKR" }));
    expect(screen.getByText("Set an OKR dialog")).toBeInTheDocument();
  });

  it("says when they couldn't be loaded", () => {
    okrs = { isError: true, error: new Error("boom") };
    render(<MyOkrsPage />);
    expect(screen.getByText(/Couldn't load your OKRs\./)).toBeInTheDocument();
  });

  describe("search and filters", () => {
    const four = () => {
      okrs = {
        data: [
          okr({ okrId: 1, objective: "Automate the release checks", keyResults: due("2999-03-31") }),
          okr({
            okrId: 2,
            objective: "Ship the onboarding flow",
            keyResults: [kr({ title: "Docs published", ownerEmail: RAVI, dueDate: "2999-06-30" })],
            status: "COMPLETED",
          }),
          okr({ okrId: 3, objective: "Publish the runbooks", keyResults: due("2000-01-31") }),
          okr({ okrId: 4, objective: "Move to one dashboard", status: "CLOSED", closeReason: "Replaced", keyResults: due("2999-06-30") }),
        ],
      };
      render(<MyOkrsPage />);
    };

    it("leaves closed ones to their own filter", () => {
      four();
      expect(cards()).not.toContain("Move to one dashboard");
      expect(screen.getByText(/1 closed, under Closed/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Closed" }));
      expect(cards()).toEqual(["Move to one dashboard"]);
      const closed = screen.getByRole("heading", { name: "Move to one dashboard" }).closest(".MuiCard-root") as HTMLElement;
      expect(within(closed).getByText("Replaced")).toBeInTheDocument();
    });

    it("finds text in the objective or a key result", () => {
      four();
      fireEvent.change(screen.getByLabelText("Search objectives and key results"), { target: { value: "docs" } });
      expect(cards()).toEqual(["Ship the onboarding flow"]);
    });

    it("filters by where each stands: open, completed or closed", () => {
      four();
      // Overdue is for key results, not a state of the objective.
      expect(screen.queryByRole("button", { name: "Overdue" })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Open" }));
      expect(cards()).toEqual(["Publish the runbooks", "Automate the release checks"]);
      fireEvent.click(screen.getByRole("button", { name: "Completed" }));
      expect(cards()).toEqual(["Ship the onboarding flow"]);
    });

    it("filters by due date, both ends included", () => {
      four();
      // The same calendar picker as Leave, not the browser's own.
      expect(screen.getAllByRole("button", { name: /choose date/i })).toHaveLength(2);
      fireEvent.change(screen.getByLabelText("Due from"), { target: { value: "2999-03-31" } });
      expect(cards()).toEqual(["Automate the release checks", "Ship the onboarding flow"]);
      fireEvent.change(screen.getByLabelText("Due to"), { target: { value: "2999-03-31" } });
      expect(cards()).toEqual(["Automate the release checks"]);
    });

    it("says when nothing matches, and clears", () => {
      four();
      fireEvent.change(screen.getByLabelText("Search objectives and key results"), {
        target: { value: "nothing like it" },
      });
      expect(screen.getByText("Nothing matches")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
      expect(cards()).toHaveLength(3);
      expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
    });
  });
});
