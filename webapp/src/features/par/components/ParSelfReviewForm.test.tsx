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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ParCycle, ParRating } from "../api/types";
import type { SelfReview } from "../api/selfReviewTypes";

const saveMutate = vi.fn();
const shareMutateAsync = vi.fn();
const unshareMutate = vi.fn();

vi.mock("../api/useSelfReview", () => ({
  useSaveSelfReview: () => ({ mutate: saveMutate, mutateAsync: vi.fn(), isPending: false }),
  useShareSelfReview: () => ({ mutateAsync: shareMutateAsync, isPending: false }),
}));
vi.mock("../api/useParMutations", () => ({
  useSaveParRating: () => ({ mutate: unshareMutate, isPending: false }),
}));
vi.mock("../api/useReview360", () => ({
  useReviewSummary: () => ({ data: undefined }),
}));
vi.mock("../api/useLeadership360", () => ({ useCycleLeadership360ForPdf: () => undefined }));
vi.mock("../api/useOkrs", () => ({
  useOkrs: () => ({
    isSuccess: true,
    data: [
      {
        okrId: 1,
        ownerEmail: "me@wso2.com",
        objective: "Grow enterprise retention",
        keyResults: ["Gross retention at 92%"],
        dueDate: "2099-06-30",
        status: "OPEN",
        createdBy: "cos@wso2.com",
        updatedBy: "cos@wso2.com",
      },
    ],
  }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));
vi.mock("./ParRatingSummary", () => ({ default: () => <div>Lead's feedback</div> }));

const { default: ParSelfReviewForm } = await import("./ParSelfReviewForm");

const cycle = { parCycleId: 2, parEmployeeDeadline: "2099-12-31", parCycleEndDate: "2099-12-31" } as ParCycle;
const selfReview: SelfReview = {
  employeeStatus: "PENDING",
  answers: {},
  template: {
    formTemplateId: 2,
    formKind: "SELF_REVIEW",
    formVersion: 1,
    definition: {
      kind: "SELF_REVIEW",
      version: 1,
      title: "Self-review",
      scales: {},
      sections: [
        { id: "impact", title: "Impact this cycle", questions: [{ id: "impact", type: "TEXT", text: "Impact this cycle", required: true }] },
        {
          id: "goals",
          title: "Goals from last cycle",
          questions: [
            { id: "goals", type: "GOALS", text: "Goals", options: [{ value: "ACHIEVED", label: "Achieved" }] },
          ],
        },
        { id: "growth", title: "Growth & learning", questions: [{ id: "growth", type: "TEXT", text: "Growth & learning", required: true }] },
        { id: "support", title: "Support you need", questions: [{ id: "support", type: "TEXT", text: "Support you need" }] },
      ],
    },
  },
};

function rating(parEmployeeStatus: string, parLeadStatus = "PENDING") {
  return { parRatingId: 9, parEmployeeStatus, parLeadStatus } as unknown as ParRating;
}

function show(status: string, answers = {}) {
  return render(
    <ParSelfReviewForm
      cycle={cycle}
      rating={rating(status)}
      selfReview={{ ...selfReview, employeeStatus: status, answers }}
      workEmail="me@wso2.com"
      leadEmail="lead@wso2.com"
    />,
  );
}

beforeEach(() => {
  saveMutate.mockReset();
  shareMutateAsync.mockReset();
  unshareMutate.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("ParSelfReviewForm", () => {
  it("opens on Start, then shows the four guided sections", () => {
    show("PENDING");
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    for (const title of ["Impact this cycle", "Goals from last cycle (optional)", "Growth & learning", "Support you need (optional)"]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    expect(screen.getByText("0 of 4 sections")).toBeInTheDocument();
  });

  it("autosaves what the employee writes, without blank answers", () => {
    vi.useFakeTimers();
    show("DRAFT");
    fireEvent.change(screen.getByRole("textbox", { name: "Impact this cycle" }), { target: { value: "Shipped it" } });
    act(() => vi.advanceTimersByTime(1500));
    expect(saveMutate).toHaveBeenCalledWith({ impact: "Shipped it" }, expect.anything());
  });

  it("shows when it last saved as a chip, with the due date", () => {
    vi.useFakeTimers();
    saveMutate.mockImplementationOnce((_answers, options: { onSuccess: () => void }) => options.onSuccess());
    show("DRAFT");
    expect(screen.getByText("Due 31 Dec '99")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Impact this cycle" }), { target: { value: "Shipped it" } });
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.getByText(/^Saved \d{1,2}:\d{2}/)).toBeInTheDocument();
  });

  it("says what's missing instead of sharing an incomplete review", () => {
    show("DRAFT", { impact: "Shipped it" });
    fireEvent.click(screen.getByRole("button", { name: "Share with lead" }));
    expect(screen.getByText(/Growth & learning is empty/)).toBeInTheDocument();
    expect(screen.queryByText("Share your self-review?")).not.toBeInTheDocument();
  });

  it("shows your OKRs beside the form and cites one into the first section", () => {
    show("DRAFT", { impact: "Shipped it" });
    expect(screen.getByText("Grow enterprise retention")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add to section 1" }));
    expect(screen.getByRole("textbox", { name: "Impact this cycle" })).toHaveValue(
      "Shipped it\nOKR: Grow enterprise retention (open, due 30 Jun '99)",
    );
  });

  it("shows a shared review read-only, with Unshare until the lead shares", () => {
    show("SHARED", { impact: "Shipped it", growth: "Learned it", goals: [{ title: "Halve onboarding", status: "ACHIEVED" }] });
    expect(screen.getByText("Shipped it")).toBeInTheDocument();
    expect(screen.getByText("Achieved")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unshare" })).toBeInTheDocument();
  });
});
