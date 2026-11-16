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
import { MemoryRouter, Route, Routes } from "react-router";
import type { Okr, OkrScope } from "../api/okrTypes";
import { testKeyResult as kr, testOkr } from "../testing/fixtures";

const LEAD = 993;
const ADMIN = 999;
const HANNAH = "hannah@example.com";
const RAVI = "ravi@example.com";
let privileges: number[];
const listed = vi.fn<(scope: OkrScope) => void>();
const setStatus = vi.fn();
const dialogProps = vi.fn();
const mutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, error: null });
let closedToo = false;

// Hannah's team's list: Ravi's own objective, and Hannah's, where Ravi has a key
// result. Everyone's also has Arjun's, and Hannah's that holds only her own.
const ravis = () =>
  testOkr({
    okrId: 1,
    ownerEmail: RAVI,
    ownerName: "Ravi Kumar",
    ownerLeadEmail: HANNAH,
    ownerInTeam: true,
    objective: "Automate the release checks",
    keyResults: [
      kr({ keyResultId: 1, ownerEmail: RAVI, ownerName: "Ravi Kumar", title: "Runs in CI", ownerInTeam: true, dueDate: "2999-06-30" }),
    ],
  });
const hannahs = () =>
  testOkr({
    okrId: 2,
    ownerEmail: HANNAH,
    ownerName: "Hannah Lee",
    ownerInTeam: false,
    objective: "Improve reliability",
    keyResults: [
      kr({ keyResultId: 2, ownerEmail: HANNAH, title: "Score of 95", ownerInTeam: false, dueDate: "2999-12-31" }),
      kr({ keyResultId: 3, ownerEmail: RAVI, ownerName: "Ravi Kumar", title: "Release checks", ownerInTeam: true, dueDate: "2999-12-31" }),
    ],
  });
const okr = (over: Partial<Okr>) => testOkr(over);

vi.mock("@api/useUserInfo", () => ({
  useUserInfo: () => ({
    data: { workEmail: HANNAH, firstName: "Hannah", lastName: "Lee", privileges },
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));
vi.mock("../api/useOkrs", () => ({
  useOkrList: (scope: OkrScope) => {
    listed(scope);
    return {
      isSuccess: true,
      data:
        scope === "all"
          ? [
              ravis(),
              hannahs(),
              okr({ okrId: 4, ownerEmail: "arjun@example.com", ownerName: "Arjun Mehta", objective: "Grow renewals" }),
              okr({ okrId: 5, ownerEmail: HANNAH, ownerName: "Hannah Lee", objective: "Merge the rotas" }),
            ]
          : [
              ravis(),
              hannahs(),
              ...(closedToo
                ? [okr({ okrId: 3, ownerEmail: "nadia@example.com", ownerName: "Nadia", ownerInTeam: true, status: "CLOSED" })]
                : []),
            ],
    };
  },
  useSetOkrStatus: () => ({ mutate: setStatus, isPending: false }),
  useDeleteOkr: mutation,
  useSetKeyResultStatus: mutation,
  useUpdateKeyResultMeasure: mutation,
  useAddOkrAction: mutation,
  useUpdateOkrAction: mutation,
  useRemoveOkrAction: mutation,
}));
vi.mock("../components/OkrDialog", () => ({
  default: (props: unknown) => {
    dialogProps(props);
    return <div role="dialog" />;
  },
}));

const { default: ManageOkrsPage, RequiresOkrManagerRoute } = await import("./ManageOkrsPage");

const boards = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
const board = (name: string) => screen.getByRole("region", { name: `${name}'s OKRs` });

beforeEach(() => {
  listed.mockClear();
  setStatus.mockClear();
  dialogProps.mockClear();
  closedToo = false;
});

describe("ManageOkrsPage", () => {
  it("shows a lead their team's OKRs, one board per person, not their own", () => {
    privileges = [LEAD];
    render(<ManageOkrsPage />);
    expect(listed).toHaveBeenLastCalledWith("team");
    expect(boards()).toEqual(["Ravi Kumar"]);
    expect(within(board("Ravi Kumar")).getByText("2 objectives · 2 key results")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Everyone" })).not.toBeInTheDocument();
  });

  it("puts the lead's objective on the board of someone with a key result on it, with only theirs and no menu", () => {
    privileges = [LEAD];
    render(<ManageOkrsPage />);
    const ravi = board("Ravi Kumar");
    expect(within(ravi).getByText("Hannah Lee's objective")).toBeInTheDocument();
    expect(within(ravi).getByText("Release checks")).toBeInTheDocument();
    expect(within(ravi).queryByText("Score of 95")).not.toBeInTheDocument();
    // Ravi's own objective is managed here; Hannah's, on her My OKRs.
    expect(within(ravi).getByRole("button", { name: "Change Automate the release checks" })).toBeInTheDocument();
    expect(within(ravi).queryByRole("button", { name: "Change Improve reliability" })).not.toBeInTheDocument();
  });

  it("counts each objective and key result once, and closed ones apart", () => {
    privileges = [LEAD];
    closedToo = true;
    render(<ManageOkrsPage />);
    expect(
      screen.getByText(/^2 objectives for 1 person · 0 of 2 key results completed · 0 overdue · 1 closed, under Closed$/),
    ).toBeInTheDocument();
  });

  it("lets a People Ops admin switch to everyone's, still without their own board", () => {
    privileges = [LEAD, ADMIN];
    render(<ManageOkrsPage />);
    expect(listed).toHaveBeenLastCalledWith("team");
    fireEvent.click(screen.getByRole("button", { name: "Everyone" }));
    expect(listed).toHaveBeenLastCalledWith("all");
    expect(boards()).toEqual(["Arjun Mehta", "Ravi Kumar"]);
  });

  it("lets a lead pick only from their team, and an admin from anyone, never themselves", () => {
    privileges = [LEAD];
    const { unmount } = render(<ManageOkrsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Set an OKR" }));
    expect(dialogProps).toHaveBeenLastCalledWith(expect.objectContaining({ canPickAnyone: false }));
    expect(dialogProps.mock.lastCall?.[0]).not.toHaveProperty("self");
    unmount();

    privileges = [ADMIN];
    render(<ManageOkrsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Set an OKR" }));
    expect(dialogProps).toHaveBeenLastCalledWith(expect.objectContaining({ canPickAnyone: true }));
  });

  it("sets an OKR for the person whose board it is", () => {
    privileges = [LEAD];
    render(<ManageOkrsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Set an OKR for Ravi Kumar" }));
    expect(dialogProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ owner: { workEmail: RAVI, name: "Ravi Kumar" } }),
    );
  });

  it("finds a board by its person, and filters by key results' due dates", () => {
    privileges = [LEAD, ADMIN];
    render(<ManageOkrsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Everyone" }));
    fireEvent.change(screen.getByLabelText("Search people, objectives or key results"), { target: { value: "arjun" } });
    expect(boards()).toEqual(["Arjun Mehta"]);
    fireEvent.change(screen.getByLabelText("Due to"), { target: { value: "2999-01-01" } });
    expect(screen.getByText("Nothing matches")).toBeInTheDocument();
  });

  it("marks a team member's objective completed from its menu", () => {
    privileges = [LEAD];
    render(<ManageOkrsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Change Automate the release checks" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Mark completed" }));
    expect(setStatus).toHaveBeenCalledWith({ okrId: 1, status: "COMPLETED", reason: undefined }, expect.anything());
  });

  it("closes one with a reason, rather than deleting it", () => {
    privileges = [LEAD];
    render(<ManageOkrsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Change Automate the release checks" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Close" }));
    fireEvent.change(screen.getByLabelText("Why (optional)"), { target: { value: " Dropped this cycle " } });
    fireEvent.click(screen.getByRole("button", { name: "Close OKR" }));
    expect(setStatus).toHaveBeenCalledWith({ okrId: 1, status: "CLOSED", reason: "Dropped this cycle" }, expect.anything());
  });
});

describe("RequiresOkrManagerRoute", () => {
  const at = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/people-ops/okrs"
            element={
              <RequiresOkrManagerRoute>
                <p>Manage</p>
              </RequiresOkrManagerRoute>
            }
          />
          <Route path="/me/okrs" element={<p>Mine</p>} />
        </Routes>
      </MemoryRouter>,
    );

  it("lets leads and People Ops admins in", () => {
    privileges = [LEAD];
    const { unmount } = at("/people-ops/okrs");
    expect(screen.getByText("Manage")).toBeInTheDocument();
    unmount();
    privileges = [ADMIN];
    at("/people-ops/okrs");
    expect(screen.getByText("Manage")).toBeInTheDocument();
  });

  it("sends everyone else to their own OKRs", () => {
    privileges = [987];
    at("/people-ops/okrs");
    expect(screen.getByText("Mine")).toBeInTheDocument();
  });
});
