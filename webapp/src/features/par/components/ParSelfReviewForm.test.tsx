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
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ParCycle, ParRating } from "../api/types";
import type { SelfReview } from "../api/selfReviewTypes";

const saveMutate = vi.fn();
const saveMutateAsync = vi.fn();
const shareMutateAsync = vi.fn();
const unshareMutate = vi.fn();

vi.mock("../api/useSelfReview", () => ({
  useSaveSelfReview: () => ({ mutate: saveMutate, mutateAsync: saveMutateAsync, isPending: false }),
  useShareSelfReview: () => ({ mutateAsync: shareMutateAsync, isPending: false }),
}));
vi.mock("../api/useParMutations", () => ({
  useSaveParRating: () => ({ mutate: unshareMutate, isPending: false }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));
// A textarea for the rich-text editor, named as the real one is (ParRichTextField.test.tsx covers the editor).
vi.mock("./ParRichTextField", () => ({
  default: ({
    value,
    onChange,
    ariaLabel,
    disabled,
  }: {
    value: string;
    onChange: (v: string) => void;
    ariaLabel?: string;
    disabled?: boolean;
  }) => <textarea aria-label={ariaLabel} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />,
}));

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
        {
          id: "impact",
          title: "Impact this cycle",
          hint: "What did you contribute, and what changed because of it?",
          questions: [{ id: "impact", type: "TEXT", text: "Impact this cycle", required: true }],
        },
        { id: "growth", title: "Growth & learning", questions: [{ id: "growth", type: "TEXT", text: "Growth & learning", required: true }] },
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
  saveMutateAsync.mockReset();
  saveMutateAsync.mockResolvedValue(undefined);
  shareMutateAsync.mockReset();
  unshareMutate.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("ParSelfReviewForm", () => {
  it("saves an empty draft on Start, so it counts as started, then shows the two sections", () => {
    saveMutate.mockImplementation((_answers, options) => options.onSuccess());
    show("PENDING");
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(saveMutate).toHaveBeenCalledWith({}, expect.anything());
    for (const title of ["Impact this cycle", "Growth & learning"]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    expect(screen.getByText("0 of 2 sections")).toBeInTheDocument();
  });

  it("stays on Start when starting can't be saved", () => {
    saveMutate.mockImplementation((_answers, options) => options.onError(new Error("HTTP 503")));
    show("PENDING");
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
    expect(screen.queryByText("0 of 2 sections")).not.toBeInTheDocument();
  });

  it("autosaves what the employee writes, without blank answers", () => {
    vi.useFakeTimers();
    show("DRAFT");
    fireEvent.change(screen.getByRole("textbox", { name: "Impact this cycle" }), { target: { value: "Shipped it" } });
    act(() => vi.advanceTimersByTime(1500));
    expect(saveMutateAsync).toHaveBeenCalledWith({ impact: "Shipped it" });
  });

  it("saves what the autosave hasn't got to yet when the employee leaves", async () => {
    const view = show("DRAFT");
    fireEvent.change(screen.getByRole("textbox", { name: "Impact this cycle" }), { target: { value: "Shipped it" } });
    view.unmount();
    await waitFor(() => expect(saveMutate).toHaveBeenCalledWith({ impact: "Shipped it" }));
  });

  it("keeps the last answers when one is changed and changed back while a save is in flight", async () => {
    vi.useFakeTimers();
    let finishSave = () => {};
    saveMutateAsync.mockImplementationOnce(() => new Promise<void>((resolve) => (finishSave = resolve)));
    const view = show("DRAFT", { impact: "First" });
    const impact = () => screen.getByRole("textbox", { name: "Impact this cycle" });
    fireEvent.change(impact(), { target: { value: "Second" } });
    act(() => vi.advanceTimersByTime(1500));
    expect(saveMutateAsync).toHaveBeenCalledWith({ impact: "Second" });
    fireEvent.change(impact(), { target: { value: "First" } });
    view.unmount();
    expect(saveMutate).not.toHaveBeenCalled();
    await act(async () => finishSave());
    expect(saveMutate).toHaveBeenCalledWith({ impact: "First" });
  });

  it("shows when it last saved as a chip; the due date is the panel's, not the form's", async () => {
    vi.useFakeTimers();
    show("DRAFT");
    expect(screen.queryByText(/^Due /)).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Impact this cycle" }), { target: { value: "Shipped it" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(screen.getByText(/^Saved \d{1,2}:\d{2}/)).toBeInTheDocument();
  });

  it("asks to confirm sharing in PAR 1.0's words, naming the lead", async () => {
    show("DRAFT", { impact: "Shipped it", growth: "Learnt it" });
    fireEvent.click(screen.getByRole("button", { name: "Share with lead" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "If you share this review, your feedback will be made available to lead@wso2.com. Do you wish to continue?",
    );
  });

  it("keeps the share confirmation open while sharing, so no answer can change behind it", async () => {
    shareMutateAsync.mockImplementation(() => new Promise(() => {}));
    show("DRAFT", { impact: "Shipped it", growth: "Learnt it" });
    fireEvent.click(screen.getByRole("button", { name: "Share with lead" }));
    fireEvent.click(await screen.findByRole("button", { name: "Share" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled());
    expect(screen.getByRole("button", { name: "Sharing…" })).toBeDisabled();
    // Escape doesn't close it, and the answers behind it are locked.
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByText("Share your self-review?")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Impact this cycle", hidden: true })).toBeDisabled();
  });

  it("shares the latest answers: saved first, after an autosave still in flight", async () => {
    vi.useFakeTimers();
    let finishAutosave = () => {};
    saveMutateAsync.mockImplementationOnce(() => new Promise<void>((resolve) => (finishAutosave = resolve)));
    shareMutateAsync.mockResolvedValue(undefined);
    show("DRAFT", { impact: "First", growth: "Learnt it" });
    const impact = () => screen.getByRole("textbox", { name: "Impact this cycle" });
    fireEvent.change(impact(), { target: { value: "Second" } });
    act(() => vi.advanceTimersByTime(1500));
    fireEvent.change(impact(), { target: { value: "Third" } });
    fireEvent.click(screen.getByRole("button", { name: "Share with lead" }));
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await act(async () => {});
    expect(saveMutateAsync).toHaveBeenCalledTimes(1);
    expect(shareMutateAsync).not.toHaveBeenCalled();
    await act(async () => finishAutosave());
    expect(saveMutateAsync).toHaveBeenLastCalledWith({ impact: "Third", growth: "Learnt it" });
    expect(shareMutateAsync).toHaveBeenCalled();
    expect(saveMutateAsync.mock.invocationCallOrder.at(-1)!).toBeLessThan(shareMutateAsync.mock.invocationCallOrder[0]);
  });

  it("saves again on leaving when the autosave in flight fails", async () => {
    vi.useFakeTimers();
    let failAutosave: (err: Error) => void = () => {};
    saveMutateAsync.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => (failAutosave = reject)));
    const view = show("DRAFT", { impact: "First" });
    fireEvent.change(screen.getByRole("textbox", { name: "Impact this cycle" }), { target: { value: "Second" } });
    act(() => vi.advanceTimersByTime(1500));
    view.unmount();
    expect(saveMutate).not.toHaveBeenCalled();
    await act(async () => failAutosave(new Error("HTTP 503")));
    expect(saveMutate).toHaveBeenCalledWith({ impact: "Second" });
  });

  it("says what's missing instead of sharing an incomplete review", () => {
    show("DRAFT", { impact: "Shipped it" });
    fireEvent.click(screen.getByRole("button", { name: "Share with lead" }));
    expect(screen.getByText(/Growth & learning is empty/)).toBeInTheDocument();
    expect(screen.queryByText("Share your self-review?")).not.toBeInTheDocument();
  });

  it("shows nothing for a draft past its deadline: the step is Incomplete, and the panel says why", () => {
    render(
      <ParSelfReviewForm
        cycle={{ ...cycle, parEmployeeDeadline: "2000-01-01" }}
        rating={{ ...rating("DRAFT", "SHARED"), parLeadComment: "PHA+R29vZDwvcD4=" } as ParRating}
        selfReview={{ ...selfReview, employeeStatus: "DRAFT", answers: { impact: "Shipped it" } }}
        workEmail="me@wso2.com"
        leadEmail="lead@wso2.com"
      />,
    );
    expect(screen.queryByText("Shipped it")).not.toBeInTheDocument();
    expect(screen.queryByText(/deadline/)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows a shared review read-only, with Unshare until the lead shares", () => {
    show("SHARED", { impact: "Shipped it", growth: "Learned it" });
    expect(screen.getByText("What did you contribute, and what changed because of it?")).toBeInTheDocument();
    expect(screen.getByText("Shipped it")).toBeInTheDocument();
    expect(screen.getByText("Learned it")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unshare" })).toBeInTheDocument();
  });

  it("shows a locked review without Unshare, and without saying the lead has started", () => {
    show("SHARED_BLOCKED", { impact: "Shipped it", growth: "Learned it" });
    expect(screen.getByText("Shipped it")).toBeInTheDocument();
    expect(screen.queryByText(/lead/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unshare" })).not.toBeInTheDocument();
  });

  it("doesn't save an answer over its limit, and says by how much", () => {
    vi.useFakeTimers();
    show("DRAFT");
    fireEvent.change(screen.getByRole("textbox", { name: "Impact this cycle" }), {
      target: { value: `<p>${"x".repeat(5000)}</p>` },
    });
    act(() => vi.advanceTimersByTime(1500));
    expect(saveMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText("Too long by 7 characters (formatting counts too). Shorten it to save.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Share with lead" }));
    expect(screen.getByText(/Impact this cycle is too long/)).toBeInTheDocument();
  });

  it("shows a shared answer's formatting, and one written before the editor as paragraphs", () => {
    show("SHARED", { impact: "<p><strong>Shipped</strong> the port</p>", growth: "Learned Ballerina\nMentored two" });
    expect(screen.getByText("Shipped").tagName).toBe("STRONG");
    expect(screen.getByText("Learned Ballerina").tagName).toBe("P");
    expect(screen.getByText("Mentored two").tagName).toBe("P");
  });
});
