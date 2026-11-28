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

import { useImperativeHandle, type ReactNode, type Ref } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ParCycle, ParRating } from "../api/types";
import { encodeParComment } from "../util/parComment";
import type { ParRichTextFieldHandle } from "./ParRichTextField";

let rating: ParRating;
let responseCount = 3;
let responsesFail = false;
const retryResponses = vi.fn();
// What the suggestion query holds once it's asked for, and whether the last
// render asked for it. (The render that seeds the saved summary starts with an
// empty one, but React discards it before any query could fetch.)
let suggestion: { data?: unknown; isLoading?: boolean; isError?: boolean; error?: Error } = {};
let suggestionAskedFor = false;
const save = vi.fn();
let summarySavePending = false;

vi.mock("../api/useParData", () => ({ useParRating: () => ({ data: rating, isLoading: false, isError: false }) }));
let ratingUpdatePending = false;
const ratingMutate = vi.fn();
vi.mock("../api/useLeadRatingUpdate", () => ({
  useLeadRatingUpdate: () => ({ mutate: ratingMutate, isPending: ratingUpdatePending }),
}));
vi.mock("../api/useLeadHistory", () => ({ useParEmployeeReviews: () => ({ isSuccess: true, data: [] }) }));
let selfReviewLookup: { data?: null; isError?: boolean; error?: Error; refetch?: () => void } = { data: null };
vi.mock("../api/useSelfReview", () => ({ useSelfReview: () => selfReviewLookup }));
vi.mock("../api/useReview360", () => ({
  useParShowsPar2: () => ({ showsPar2: true }),
  useReviewResponses: () =>
    responsesFail
      ? { data: undefined, isError: true, error: new Error("Unavailable"), isFetching: false, refetch: retryResponses }
      : { data: { responseCount } },
}));
vi.mock("../api/useLead360Summary", () => ({
  useLead360SummarySuggestion: (_cycle: number, _email: string, _count: number, enabled: boolean) => {
    suggestionAskedFor = enabled;
    return enabled ? suggestion : {};
  },
  useSaveLead360Summary: () => ({ mutate: save, mutateAsync: save, isPending: summarySavePending }),
}));
vi.mock("../hooks/useGoogleDrivePicker", () => ({
  useGoogleDrivePicker: () => ({ openPicker: vi.fn(), isLoading: false, error: null }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));
// A textarea for the editor, where Tab takes the suggestion, as in the real
// one (ParRichTextField.test.tsx).
vi.mock("./ParRichTextField", () => ({
  default: function Field({
    value,
    onChange,
    placeholder,
    suggestion,
    onAcceptSuggestion,
    disabled,
    ref,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    suggestion?: ReactNode;
    onAcceptSuggestion?: () => void;
    disabled?: boolean;
    ref?: Ref<ParRichTextFieldHandle>;
  }) {
    useImperativeHandle(ref, () => ({ replaceContents: (html: string) => onChange(html) }));
    return (
      <div>
        <textarea
          aria-label={placeholder || EMPTY_FIELD}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Tab" && onAcceptSuggestion) onAcceptSuggestion();
          }}
        />
        {suggestion}
      </div>
    );
  },
}));
vi.mock("./ParLead360Evidence", () => ({ default: () => null, ParLead360Guidance: () => null }));
vi.mock("./Leadership360ResultsCard", () => ({ default: () => null }));

const { default: ParLeadReviewPanel } = await import("./ParLeadReviewPanel");

const cycle = {
  parCycleId: 2,
  parCycleEndDate: "2999-12-31",
  parLeadDeadline: "2999-12-31",
  parEmployeeDeadline: "2999-12-01",
  parThreeSixtyRatingDeadline: "2999-12-01",
  parCycleConfigurations: { parRatings: ["Successful"] },
} as unknown as ParCycle;
const FIELD = "Summarise the 360° feedback";
// Deadlines that have passed, in a cycle's order: a PAR 2.0 PAR is shared only after both.
const PASSED_SELF_REVIEW = "2020-01-01";
const PASSED_360 = "2020-01-02";
// The summary field while a suggestion shows in it, with no placeholder.
const EMPTY_FIELD = "summary field with a suggestion";
const SUGGESTED = { summary: "Colleagues see real ownership.\nThey'd like earlier updates.", responseCount: 3 };

function show(overrides: Partial<ParRating> = {}) {
  rating = {
    parRatingId: 7,
    parCycleId: 2,
    parEmployeeEmail: "alex@example.com",
    parEmployeeStatus: "SHARED",
    parLeadStatus: "DRAFT",
    parIsLeadershipEmployee: false,
    ...overrides,
  } as ParRating;
  return render(<ParLeadReviewPanel cycle={cycle} employeeEmail="alex@example.com" />);
}

beforeEach(() => {
  ratingUpdatePending = false;
  summarySavePending = false;
  ratingMutate.mockReset();
  selfReviewLookup = { data: null };
  responseCount = 3;
  responsesFail = false;
  retryResponses.mockReset();
  cycle.parThreeSixtyRatingDeadline = "2999-12-01";
  cycle.parLeadDeadline = "2999-12-31";
  delete cycle.parLeadHardDeadline;
  cycle.parEmployeeDeadline = "2999-12-01";
  suggestion = { data: SUGGESTED };
  suggestionAskedFor = false;
  save.mockReset();
});

describe("ParLeadReviewPanel: Top 5%/20%", () => {
  const STATEMENT = "The Top 5% / 20% rating decision was discussed and finalized with the functional lead.";
  // The select in the Top 5%/20% row (it carries no accessible name of its own).
  const specialRatingSelect = () => within(screen.getByText("Top 5%/20%").parentElement!).getByRole("combobox");
  const pick = (label: string) => {
    fireEvent.mouseDown(specialRatingSelect());
    fireEvent.click(screen.getByRole("option", { name: label }));
  };

  it("asks to confirm a Top 5% or Top 20% pick instead of a tick, and keeps the old pick on Cancel", () => {
    show({ parRating: "Successful" });
    expect(screen.queryByRole("checkbox", { name: /discussed and finalized/ })).not.toBeInTheDocument();
    const select = specialRatingSelect();
    expect(select).not.toHaveAttribute("aria-disabled", "true");

    pick("Top 5%");
    expect(screen.getByText(STATEMENT)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText(STATEMENT)).not.toBeInTheDocument();
    expect(select).toHaveTextContent("N/A");

    pick("Top 20%");
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(select).toHaveTextContent("Top 20%");
  });

  it("doesn't ask when N/A is picked", () => {
    show({ parRating: "Successful", parSpecialRating: "TOP5P" });
    pick("N/A");
    expect(screen.queryByText(STATEMENT)).not.toBeInTheDocument();
    expect(specialRatingSelect()).toHaveTextContent("N/A");
  });

  it("closes with the lead deadline in a PAR 2.0 cycle, saying so", () => {
    rating = { parRatingId: 7, parCycleId: 2, parEmployeeEmail: "alex@example.com", parEmployeeStatus: "SHARED",
      parLeadStatus: "DRAFT", parIsLeadershipEmployee: false, parRating: "Successful" } as ParRating;
    const closed = { ...cycle, parSpecialRatingDeadline: "2020-01-01" } as unknown as ParCycle;
    render(<ParLeadReviewPanel cycle={closed} employeeEmail="alex@example.com" />);
    expect(screen.getByText("Top 5%/20% can't be given after the lead deadline, 1 Jan '20.")).toBeInTheDocument();
  });

  it("isn't offered to the leadership team", () => {
    show({ parRating: "Successful", parIsLeadershipEmployee: true, parSpecialRatingEligibility: false });
    expect(screen.queryByText("Top 5%/20%")).not.toBeInTheDocument();
  });
});

describe("ParLeadReviewPanel: the employee's self-review", () => {
  it("says when it couldn't be loaded, with Retry, rather than that it wasn't shared", () => {
    selfReviewLookup = { isError: true, error: new Error("HTTP 500"), refetch: vi.fn() };
    show();
    expect(screen.getByText(/Couldn't load the employee's self-review/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
    expect(screen.queryByText("The employee hasn't shared their self-review yet")).not.toBeInTheDocument();
  });
});

describe("ParLeadReviewPanel: 360° summary", () => {
  const INSERTED = "<p>Colleagues see real ownership.</p><p>They'd like earlier updates.</p>";
  const HINT = "A suggested summary is available after the 360° deadline if 3 or more people respond.";

  // Once all 360° feedback is in, unless a test says otherwise.
  beforeEach(() => {
    cycle.parThreeSixtyRatingDeadline = PASSED_360;
  });

  it("shows the suggestion in grey while the summary is empty, and a click on it inserts it as paragraphs", () => {
    show();
    expect(screen.getByText("Suggested from 3 360° responses")).toBeInTheDocument();
    // It isn't in the summary until it's inserted, and there's no asking for another.
    expect(screen.getByLabelText(EMPTY_FIELD)).toHaveValue("");
    expect(screen.queryByRole("button", { name: /Suggest|Insert/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Colleagues see real ownership."));
    expect(screen.getByLabelText(FIELD)).toHaveValue(INSERTED);
    expect(screen.queryByText("Suggested from 3 360° responses")).not.toBeInTheDocument();
  });

  it("inserts it on Tab in the empty field", () => {
    show();
    fireEvent.keyDown(screen.getByLabelText(EMPTY_FIELD), { key: "Tab" });
    expect(screen.getByLabelText(FIELD)).toHaveValue(INSERTED);
  });

  it("shows placeholder lines while the suggestion is written", () => {
    suggestion = { isLoading: true };
    show();
    expect(screen.getByText("Writing a suggestion from the 360° feedback…")).toBeInTheDocument();
    expect(screen.queryByText("Colleagues see real ownership.")).not.toBeInTheDocument();
  });

  it("lets the lead draft the summary before the 360° deadline, at any number of responses, with no suggestion", () => {
    cycle.parThreeSixtyRatingDeadline = "2999-12-01";
    for (const count of [0, 2, 3]) {
      responseCount = count;
      const view = show();
      expect(suggestionAskedFor).toBe(false);
      expect(screen.getByLabelText(FIELD)).toHaveValue("");
      expect(screen.queryByText(/Suggested from/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Available after 3/)).not.toBeInTheDocument();
      view.unmount();
    }
  });

  it("says beside the heading when a suggestion comes, while the lead can write the summary", () => {
    cycle.parThreeSixtyRatingDeadline = "2999-12-01";
    show();
    expect(screen.getByRole("img", { name: HINT })).toBeInTheDocument();
  });

  it("keeps the summary to write, with no suggestion, after the 360° deadline with fewer than 3", () => {
    responseCount = 2;
    show();
    expect(suggestionAskedFor).toBe(false);
    expect(screen.getByLabelText(FIELD)).toBeInTheDocument();
    expect(screen.queryByText(/suggested summary from the 360° feedback/)).not.toBeInTheDocument();
  });

  it("says when the 360° responses couldn't be loaded after the deadline, with Retry, under the summary", () => {
    responsesFail = true;
    const view = show();
    expect(screen.getByLabelText(FIELD)).toBeInTheDocument();
    expect(screen.getByText(/Couldn't load the 360° responses/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retryResponses).toHaveBeenCalled();
    view.unmount();

    // Before the deadline the count doesn't matter yet.
    cycle.parThreeSixtyRatingDeadline = "2999-12-01";
    show();
    expect(screen.queryByText(/Couldn't load the 360° responses/)).not.toBeInTheDocument();
  });

  it("offers the suggestion under the lead's own words without writing one until it's asked for", () => {
    show({ parLead360Summary: encodeParComment("<p>My own words.</p>"), parLead360SuggestionResponses: 3 });
    expect(screen.getByLabelText(FIELD)).toHaveValue("<p>My own words.</p>");
    expect(suggestionAskedFor).toBe(false);
    expect(screen.getByText("There's a suggested summary from the 360° feedback.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show updated suggestion" })).not.toBeInTheDocument();
  });

  it("offers it again once it's dismissed", () => {
    show({ parLead360Summary: encodeParComment("<p>My own words.</p>"), parLead360SuggestionResponses: 3 });
    fireEvent.click(screen.getByRole("button", { name: "Show suggestion" }));
    expect(screen.getByText("Suggested from 3 360° responses")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Suggested from 3 360° responses")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show suggestion" })).toBeInTheDocument();
    expect(screen.getByLabelText(FIELD)).toHaveValue("<p>My own words.</p>");
  });

  it("replaces the lead's words with the suggestion only on Replace", () => {
    show({ parLead360Summary: encodeParComment("<p>My own words.</p>") });
    fireEvent.click(screen.getByRole("button", { name: "Show suggestion" }));
    // Its text doesn't replace them on a click.
    fireEvent.click(screen.getByText("Colleagues see real ownership."));
    expect(screen.getByLabelText(FIELD)).toHaveValue("<p>My own words.</p>");
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText(FIELD)).toHaveValue(INSERTED);
  });

  it("says so quietly when a suggestion can't be written", () => {
    suggestion = { isError: true, error: new Error("HTTP 503") };
    show();
    expect(screen.getByText("Couldn't write a suggestion just now. It's tried again after an hour.")).toBeInTheDocument();
    expect(screen.getByLabelText(FIELD)).toBeInTheDocument();
  });

  it("keeps asking for a suggestion after a failure, even once the lead starts writing", () => {
    suggestion = { isError: true, error: new Error("HTTP 503") };
    show();
    fireEvent.change(screen.getByLabelText(FIELD), { target: { value: "<p>My own start.</p>" } });
    // Still asked for, so the hourly retry the message promises carries on.
    expect(suggestionAskedFor).toBe(true);
    expect(screen.getByText("Couldn't write a suggestion just now. It's tried again after an hour.")).toBeInTheDocument();
  });

  it("says on sharing that a suggestion not inserted isn't shared", () => {
    cycle.parEmployeeDeadline = PASSED_SELF_REVIEW;
    cycle.parThreeSixtyRatingDeadline = PASSED_360;
    show({ parRating: "Successful", parLeadComment: encodeParComment("<p>Great cycle.</p>") });
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(screen.getByText(/The suggestion in grey is only included if you insert it/)).toBeInTheDocument();
  });

  it("keeps the share confirmation open while sharing, so nothing can be edited behind it", () => {
    cycle.parEmployeeDeadline = PASSED_SELF_REVIEW;
    cycle.parThreeSixtyRatingDeadline = PASSED_360;
    const view = show({ parRating: "Successful", parLeadComment: encodeParComment("<p>Great cycle.</p>") });
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    ratingUpdatePending = true;
    view.rerender(<ParLeadReviewPanel cycle={cycle} employeeEmail="alex@example.com" />);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sharing…" })).toBeDisabled();
  });

  it("saves the latest summary before sharing, and the confirmation can't be dismissed meanwhile", async () => {
    cycle.parEmployeeDeadline = PASSED_SELF_REVIEW;
    cycle.parThreeSixtyRatingDeadline = PASSED_360;
    suggestion = {};
    let finishSave = () => {};
    save.mockImplementation(() => new Promise<void>((resolve) => (finishSave = resolve)));
    const view = show({ parRating: "Successful", parLeadComment: encodeParComment("<p>Great cycle.</p>") });
    fireEvent.change(screen.getByLabelText(FIELD), { target: { value: "<p>Clear ownership.</p>" } });
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Share" }));
    expect(save).toHaveBeenCalledWith(encodeParComment("<p>Clear ownership.</p>"));

    summarySavePending = true;
    view.rerender(<ParLeadReviewPanel cycle={cycle} employeeEmail="alex@example.com" />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    const backdrop = document.querySelector(".MuiBackdrop-root")!;
    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);
    expect(screen.getByText("Share Lead's Feedback?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(ratingMutate).not.toHaveBeenCalled();

    summarySavePending = false;
    await act(async () => finishSave());
    expect(ratingMutate).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ parLeadStatus: "SHARED" }) }),
      expect.anything(),
    );
  });

  it("isn't there for a member of the leadership team", () => {
    show({ parIsLeadershipEmployee: true });
    expect(screen.queryByText("360° summary")).not.toBeInTheDocument();
  });

  it("shows the shared summary read-only", () => {
    show({
      parLeadStatus: "SHARED",
      parLeadComment: encodeParComment("<p>Great cycle.</p>"),
      parLead360Summary: encodeParComment("<p>Colleagues see real ownership.</p>"),
    });
    expect(screen.getByText("360° summary")).toBeInTheDocument();
    expect(screen.getByText("Colleagues see real ownership.")).toBeInTheDocument();
    expect(suggestionAskedFor).toBe(false);
    expect(screen.queryByText("Suggested from 3 360° responses")).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /suggested summary/ })).not.toBeInTheDocument();
  });
});

describe("ParLeadReviewPanel: sharing before the employee has", () => {
  const originalConfig = window.config;
  const setPar2 = (on: boolean) => {
    window.config = { ...(originalConfig ?? {}), ONE_WSO2_PREVIEW_FEATURES: { par2: on } } as Window["config"];
  };
  afterEach(() => {
    window.config = originalConfig;
  });
  // A cycle that can't give the missed-deadline rating (Needs Improvements isn't one of its ratings): the
  // backend leaves such a PAR to its lead, who can share it once the self-review has closed.
  const closedCycle = {
    ...cycle,
    parEmployeeDeadline: "2020-01-01",
    parThreeSixtyRatingDeadline: "2020-01-02",
  } as unknown as ParCycle;
  const ready = {
    parRatingId: 7,
    parCycleId: 2,
    parEmployeeEmail: "alex@example.com",
    parEmployeeStatus: "DRAFT",
    parLeadStatus: "DRAFT",
    parIsLeadershipEmployee: false,
    parRating: "Successful",
    parLeadComment: encodeParComment("<p>Great cycle.</p>"),
  } as ParRating;

  it("can share once the self-review has closed, with PAR 2.0, in a cycle with no missed-deadline rating", () => {
    setPar2(true);
    rating = ready;
    render(<ParLeadReviewPanel cycle={closedCycle} employeeEmail="alex@example.com" />);
    expect(screen.getByRole("button", { name: "Share" })).toBeEnabled();
  });

  it("turns Share on when the self-review closes while the panel is open, in a cycle with no missed-deadline rating", () => {
    setPar2(true);
    rating = ready;
    // The self-review deadline has passed everywhere from the end of that day at UTC-12: 2026-12-02 12:00 UTC.
    vi.useFakeTimers({ now: new Date("2026-12-02T11:59:00Z") });
    try {
      const closing = {
        ...cycle,
        parEmployeeDeadline: "2026-12-01",
        parThreeSixtyRatingDeadline: "2026-11-30",
      } as unknown as ParCycle;
      render(<ParLeadReviewPanel cycle={closing} employeeEmail="alex@example.com" />);
      expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
      act(() => vi.advanceTimersByTime(59_000));
      expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
      act(() => vi.advanceTimersByTime(2_000));
      expect(screen.getByRole("button", { name: "Share" })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("turns Share on when the self-review closes between showing the panel and setting its timer", () => {
    setPar2(true);
    rating = ready;
    vi.useFakeTimers({ now: new Date("2026-12-02T11:59:00Z") });
    // Rendered while it's open; by the time the timer is set, it has closed.
    const now = vi.spyOn(Date, "now").mockReturnValue(new Date("2026-12-02T12:00:30Z").getTime());
    try {
      const closing = {
        ...cycle,
        parEmployeeDeadline: "2026-12-01",
        parThreeSixtyRatingDeadline: "2026-11-30",
      } as unknown as ParCycle;
      render(<ParLeadReviewPanel cycle={closing} employeeEmail="alex@example.com" />);
      expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
      vi.setSystemTime(new Date("2026-12-02T12:00:30Z"));
      act(() => vi.advanceTimersByTime(1));
      expect(screen.getByRole("button", { name: "Share" })).toBeEnabled();
    } finally {
      now.mockRestore();
      vi.useRealTimers();
    }
  });

  it("waits for the employee to share without PAR 2.0", () => {
    setPar2(false);
    rating = ready;
    render(<ParLeadReviewPanel cycle={closedCycle} employeeEmail="alex@example.com" />);
    expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
    expect(screen.queryByText(/You can share once/)).not.toBeInTheDocument();
  });
});

describe("ParLeadReviewPanel: a PAR not shared by its deadline", () => {
  const originalConfig = window.config;
  afterEach(() => {
    window.config = originalConfig;
  });
  const missedCycle = {
    ...cycle,
    parEmployeeDeadline: "2020-01-01",
    parCycleConfigurations: {
      parRatings: ["Successful", "Needs Improvements", "Step Up"],
      employeeRatings: ["Successful", "Needs Improvements"],
      leadershipAllowedRatings: ["Successful", "Step Up"],
      top5p20pEnabledRating: "Successful",
      evidenceEnabledRating: "Needs Improvements",
      missedDeadlineRating: "Needs Improvements",
      leadershipMissedDeadlineRating: "Step Up",
    },
  } as unknown as ParCycle;
  const missed = {
    parRatingId: 7,
    parCycleId: 2,
    parEmployeeEmail: "alex@example.com",
    parEmployeeName: "Alex Morgan",
    parEmployeeStatus: "PENDING",
    parLeadStatus: "DRAFT",
    parIsLeadershipEmployee: false,
    parRating: "Successful",
  } as ParRating;

  it.each(["PENDING", "DRAFT"] as const)(
    "shows the missed-deadline rating, fixed, and that the lead has nothing to submit (self-review %s)",
    (parEmployeeStatus) => {
      rating = { ...missed, parEmployeeStatus };
      render(<ParLeadReviewPanel cycle={missedCycle} employeeEmail="alex@example.com" />);
      expect(screen.queryByText("Successful")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Rating auto-assigned and locked")).toBeInTheDocument();
      expect(
        screen.getByText(/Alex didn't share their self-review by the deadline, so their rating is Needs Improvements/),
      ).toHaveTextContent("There's nothing for you to submit.");
      expect(screen.queryByRole("button", { name: /Share|Save draft/i })).not.toBeInTheDocument();
      expect(screen.getByLabelText("Enter your comment here")).toBeDisabled();
      expect(screen.getByLabelText(FIELD)).toBeDisabled();
      expect(suggestionAskedFor).toBe(false);
    },
  );

  it("isn't fixed once the employee has shared", () => {
    rating = { ...missed, parEmployeeStatus: "SHARED" };
    render(<ParLeadReviewPanel cycle={missedCycle} employeeEmail="alex@example.com" />);
    expect(screen.getByText("Successful")).toBeInTheDocument();
    expect(screen.queryByLabelText("Rating auto-assigned and locked")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByLabelText("Enter your comment here")).toBeEnabled();
  });

  it("gives the leadership team Step Up", () => {
    rating = { ...missed, parIsLeadershipEmployee: true };
    render(<ParLeadReviewPanel cycle={missedCycle} employeeEmail="alex@example.com" />);
    expect(screen.getByText(/so their rating is Step Up\. There's nothing for you to submit\./)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Share|Save draft/i })).not.toBeInTheDocument();
  });

  it("isn't fixed for People Ops", () => {
    rating = missed;
    render(<ParLeadReviewPanel cycle={missedCycle} employeeEmail="alex@example.com" isAdminView />);
    expect(screen.getByText("Successful")).toBeInTheDocument();
    expect(screen.queryByLabelText("Rating auto-assigned and locked")).not.toBeInTheDocument();
  });

  it("tells the lead, before the deadline, that they can share once the self-review is shared, with PAR 2.0", () => {
    window.config = { ...(originalConfig ?? {}), ONE_WSO2_PREVIEW_FEATURES: { par2: true } } as Window["config"];
    rating = missed;
    const openCycle = { ...missedCycle, parEmployeeDeadline: "2999-12-01" } as unknown as ParCycle;
    render(<ParLeadReviewPanel cycle={openCycle} employeeEmail="alex@example.com" />);
    expect(screen.getByText("You can share once Alex shares their self-review.")).toBeInTheDocument();
    expect(screen.queryByText(/their rating will be/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
  });
});

describe("ParLeadReviewPanel: a department's own rules", () => {
  const rulesCycle = {
    ...cycle,
    parThreeSixtyRatingDeadline: PASSED_360,
    parCycleConfigurations: {
      parRatings: ["Successful", "Needs Improvements", "Step Up"],
      employeeRatings: ["Successful", "Needs Improvements"],
      leadershipAllowedRatings: ["Successful", "Step Up"],
      top5p20pEnabledRating: "Successful",
      evidenceEnabledRating: "Needs Improvements",
      missedDeadlineRating: "Needs Improvements",
      leadershipMissedDeadlineRating: "Step Up",
      evidenceExemptDepartments: ["FIELD OPS", "PARTNER OPS"],
      departmentEmployeeDeadlines: [{ department: "FIELD OPS", deadline: "2999-12-01" }],
    },
  } as unknown as ParCycle;
  const needsImprovement = {
    parRatingId: 7,
    parCycleId: 2,
    parEmployeeEmail: "alex@example.com",
    parEmployeeName: "Alex Morgan",
    parEmployeeStatus: "SHARED",
    parLeadStatus: "DRAFT",
    parIsLeadershipEmployee: false,
    parRating: "Needs Improvements",
    parLeadComment: encodeParComment("<p>Needs work.</p>"),
  } as ParRating;
  const EVIDENCE = /Performance gaps were discussed/;

  it("needs the confirmation and a file for Needs Improvements elsewhere", () => {
    rating = { ...needsImprovement, parDepartment: "FIELD OPS ENGINEERING" };
    render(<ParLeadReviewPanel cycle={rulesCycle} employeeEmail="alex@example.com" />);
    expect(screen.getByRole("checkbox", { name: EVIDENCE })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
  });

  it("shares Needs Improvements without them in a department that needs no evidence", () => {
    rating = { ...needsImprovement, parDepartment: "Field Ops" };
    // Its own self-review deadline passed too, so it can be shared.
    const shareable = {
      ...rulesCycle,
      parEmployeeDeadline: PASSED_SELF_REVIEW,
      parCycleConfigurations: {
        ...rulesCycle.parCycleConfigurations,
        departmentEmployeeDeadlines: [{ department: "FIELD OPS", deadline: PASSED_SELF_REVIEW }],
      },
    } as unknown as ParCycle;
    render(<ParLeadReviewPanel cycle={shareable} employeeEmail="alex@example.com" />);
    expect(screen.queryByRole("checkbox", { name: EVIDENCE })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Attach from Google Drive/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeEnabled();
  });

  it("follows the department's own self-review deadline", () => {
    const passed = {
      ...rulesCycle,
      parEmployeeDeadline: "2020-01-01",
    } as unknown as ParCycle;
    rating = { ...needsImprovement, parEmployeeStatus: "PENDING", parRating: "Successful", parDepartment: "FIELD OPS" };
    render(<ParLeadReviewPanel cycle={passed} employeeEmail="alex@example.com" />);
    expect(screen.queryByLabelText("Rating auto-assigned and locked")).not.toBeInTheDocument();

    cleanup();
    rating = { ...rating, parDepartment: "FIELD OPS ENGINEERING" };
    render(<ParLeadReviewPanel cycle={passed} employeeEmail="alex@example.com" />);
    expect(screen.getByLabelText("Rating auto-assigned and locked")).toBeInTheDocument();
  });
});

describe("ParLeadReviewPanel: evidence links", () => {
  const evidenceCycle = {
    ...cycle,
    parCycleConfigurations: {
      parRatings: ["Successful", "Needs Improvements"],
      employeeRatings: ["Successful", "Needs Improvements"],
      top5p20pEnabledRating: "Successful",
      evidenceEnabledRating: "Needs Improvements",
    },
  } as unknown as ParCycle;
  const LINK = "https://drive.google.com/file/d/abc/view";
  const showWithLink = () => {
    rating = {
      parRatingId: 7,
      parCycleId: 2,
      parEmployeeEmail: "alex@example.com",
      parEmployeeStatus: "SHARED",
      parLeadStatus: "DRAFT",
      parIsLeadershipEmployee: false,
      parRating: "Needs Improvements",
      parLeadComment: encodeParComment("<p>Let's work on this.</p>"),
      parPerformanceNoticeAck: LINK,
    } as ParRating;
    render(<ParLeadReviewPanel cycle={evidenceCycle} employeeEmail="alex@example.com" />);
  };
  const savedPayload = () => ratingMutate.mock.calls.at(-1)![0].payload;

  it("takes the saved links away once the lead removes them all", async () => {
    showWithLink();
    fireEvent.click(screen.getByRole("button", { name: `Remove ${LINK}` }));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await act(async () => {});
    expect(savedPayload()).toMatchObject({ parPerformanceNoticeAck: "" });
  });

  it("leaves them out of a save that doesn't change them", async () => {
    showWithLink();
    fireEvent.change(screen.getByLabelText("Enter your comment here"), {
      target: { value: "<p>Let's work on this together.</p>" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await act(async () => {});
    expect(savedPayload()).toMatchObject({ parRating: "Needs Improvements" });
    expect(savedPayload()).not.toHaveProperty("parPerformanceNoticeAck");
  });
});

describe("ParLeadReviewPanel: hard lead deadline", () => {
  it("tells a late lead until when they can still share", () => {
    cycle.parLeadDeadline = "2000-01-01";
    cycle.parLeadHardDeadline = "2999-12-30";
    show({ parRating: "Successful" });
    expect(
      screen.getByText("The lead review deadline passed on 1 Jan '00. You can still share until 30 Dec '99, but it's late."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/before the deadline/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
  });

  it("closes the review after it: only PAR admins can rate and share", () => {
    cycle.parLeadDeadline = "2000-01-01";
    cycle.parLeadHardDeadline = "2000-01-04";
    show({ parRating: "Successful" });
    expect(
      screen.getByText("The hard lead deadline passed on 4 Jan '00. Only PAR admins can rate and share this PAR now."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/You can still share/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Share" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save draft" })).not.toBeInTheDocument();
  });

  it("closes the review when the hard lead deadline passes while it's open", () => {
    cycle.parLeadDeadline = "2000-01-01";
    cycle.parLeadHardDeadline = "2026-12-15";
    // The last minute of that day, in the browser's time zone.
    vi.useFakeTimers({ now: new Date(2026, 11, 15, 23, 59) });
    try {
      show({ parRating: "Successful" });
      expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(61_000));
      expect(screen.queryByRole("button", { name: "Share" })).not.toBeInTheDocument();
      expect(screen.getByText(/^The hard lead deadline passed on 15 Dec '26\./)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("closes an open Share confirmation when the hard lead deadline passes", () => {
    cycle.parEmployeeDeadline = PASSED_SELF_REVIEW;
    cycle.parThreeSixtyRatingDeadline = PASSED_360;
    cycle.parLeadDeadline = "2000-01-01";
    cycle.parLeadHardDeadline = "2026-12-15";
    vi.useFakeTimers({ now: new Date(2026, 11, 15, 23, 59) });
    try {
      show({ parRating: "Successful", parLeadComment: encodeParComment("<p>Steady work.</p>") });
      fireEvent.click(screen.getByRole("button", { name: "Share" }));
      expect(screen.getByText("Share Lead's Feedback?")).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(61_000));
      // Past its fade-out.
      act(() => vi.advanceTimersByTime(1_000));
      expect(screen.queryByText("Share Lead's Feedback?")).not.toBeInTheDocument();
      expect(ratingMutate).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("sends nothing, not even a changed 360° summary, when Share is confirmed after the hard lead deadline", async () => {
    cycle.parEmployeeDeadline = PASSED_SELF_REVIEW;
    cycle.parThreeSixtyRatingDeadline = PASSED_360;
    cycle.parLeadDeadline = "2000-01-01";
    cycle.parLeadHardDeadline = "2026-12-15";
    suggestion = {};
    vi.useFakeTimers({ now: new Date(2026, 11, 15, 23, 59) });
    try {
      show({ parRating: "Successful", parLeadComment: encodeParComment("<p>Steady work.</p>") });
      fireEvent.change(screen.getByLabelText(FIELD), { target: { value: "<p>Clear ownership.</p>" } });
      fireEvent.click(screen.getByRole("button", { name: "Share" }));
      // The deadline passes before the panel's timer has redrawn it.
      vi.setSystemTime(new Date(2026, 11, 16, 0, 0, 30));
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Share" }));
      await act(async () => {});
      act(() => vi.advanceTimersByTime(1_000));
      expect(save).not.toHaveBeenCalled();
      expect(ratingMutate).not.toHaveBeenCalled();
      expect(screen.queryByText("Share Lead's Feedback?")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("says N/A for a PAR the lead never rated, not the stored value", () => {
    cycle.parLeadDeadline = "2000-01-01";
    cycle.parLeadHardDeadline = "2000-01-04";
    show({ parRating: "NOT_ASSIGNED", parLeadStatus: "PENDING" });
    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(screen.queryByText("NOT_ASSIGNED")).not.toBeInTheDocument();
    expect(screen.getByText("Lead's feedback is pending")).toBeInTheDocument();
  });
});

describe("ParLeadReviewPanel: sharing once all 360° feedback is in", () => {
  const ready = {
    parRatingId: 7,
    parCycleId: 2,
    parEmployeeEmail: "alex@example.com",
    parEmployeeName: "Alex Morgan",
    parEmployeeStatus: "SHARED",
    parLeadStatus: "DRAFT",
    parIsLeadershipEmployee: false,
    parRating: "Successful",
    parLeadComment: encodeParComment("<p>Great cycle.</p>"),
  } as ParRating;
  const withDates = (employee: string, threeSixty: string, departmentDeadline?: string) =>
    ({
      ...cycle,
      parEmployeeDeadline: employee,
      parThreeSixtyRatingDeadline: threeSixty,
      parCycleConfigurations: {
        parRatings: ["Successful"],
        departmentEmployeeDeadlines: departmentDeadline ? [{ department: "FIELD OPS", deadline: departmentDeadline }] : [],
      },
    }) as unknown as ParCycle;

  it("waits for the 360° deadline, saying when, with a draft still saving", () => {
    rating = ready;
    render(<ParLeadReviewPanel cycle={withDates("2020-01-01", "2999-12-01")} employeeEmail="alex@example.com" />);
    expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
    expect(
      screen.getByText(
        /You can share from .+, when the 360° deadline has passed everywhere and all 360° feedback is in\. You can save a draft until then\./,
      ),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Enter your comment here"), { target: { value: "<p>Even better.</p>" } });
    expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled();
  });

  it("waits in Admin View too", async () => {
    rating = ready;
    render(<ParLeadReviewPanel cycle={withDates("2020-01-01", "2999-12-01")} employeeEmail="alex@example.com" isAdminView />);
    fireEvent.click(screen.getByRole("button", { name: "edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(await screen.findByRole("button", { name: "Save and Share" })).toBeDisabled();
  });

  it("waits for the employee's department's later self-review deadline", () => {
    rating = { ...ready, parDepartment: "Field Ops" };
    render(<ParLeadReviewPanel cycle={withDates("2020-01-01", "2020-01-02", "2999-12-01")} employeeEmail="alex@example.com" />);
    expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
    expect(screen.getByText(/You can share from .+, when Alex's self-review deadline has passed everywhere\./)).toBeInTheDocument();
  });

  it("turns Share on once the 360° deadline has passed everywhere, while the panel is open", () => {
    rating = ready;
    // The 360° deadline ends everywhere at 23:59:59 at UTC-12 on its day, so it has passed from 2026-12-06 12:00 UTC.
    vi.useFakeTimers({ now: new Date("2026-12-06T11:59:00Z") });
    try {
      render(<ParLeadReviewPanel cycle={withDates("2026-12-01", "2026-12-05")} employeeEmail="alex@example.com" />);
      expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
      act(() => vi.advanceTimersByTime(59_000));
      expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
      act(() => vi.advanceTimersByTime(2_000));
      expect(screen.getByRole("button", { name: "Share" })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens once the 360° deadline has passed", () => {
    rating = ready;
    render(<ParLeadReviewPanel cycle={withDates("2020-01-01", "2020-01-02")} employeeEmail="alex@example.com" />);
    expect(screen.getByRole("button", { name: "Share" })).toBeEnabled();
    expect(screen.queryByText(/You can share from/)).not.toBeInTheDocument();
  });
});

describe("ParLeadReviewPanel: saving without a comment", () => {
  const savedPayload = () => ratingMutate.mock.calls.at(-1)![0].payload;
  const pickRating = (label: string) => {
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Rating" }));
    fireEvent.click(screen.getByRole("option", { name: label }));
  };

  it("saves a draft with only a rating, leaving the comment out", async () => {
    show();
    pickRating("Successful");
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await act(async () => {});
    expect(savedPayload()).toMatchObject({ parLeadStatus: "DRAFT", parRating: "Successful" });
    expect(savedPayload()).not.toHaveProperty("parLeadComment");
  });

  it("still sends a comment the lead has cleared, so it's saved empty", async () => {
    show({ parRating: "Successful", parLeadComment: encodeParComment("<p>Great cycle.</p>") });
    fireEvent.change(screen.getByLabelText("Enter your comment here"), { target: { value: "<p><br></p>" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await act(async () => {});
    expect(savedPayload()).toMatchObject({ parLeadComment: encodeParComment("<p><br></p>") });
  });

  it("leaves out an admin comment nobody wrote in Admin View", async () => {
    rating = {
      parRatingId: 7,
      parCycleId: 2,
      parEmployeeEmail: "alex@example.com",
      parEmployeeStatus: "SHARED",
      parLeadStatus: "DRAFT",
      parIsLeadershipEmployee: false,
    } as ParRating;
    render(<ParLeadReviewPanel cycle={cycle} employeeEmail="alex@example.com" isAdminView />);
    fireEvent.click(screen.getByRole("button", { name: "edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("combobox", { name: "Rating" });
    pickRating("Successful");
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await act(async () => {});
    expect(savedPayload()).toMatchObject({ parRating: "Successful" });
    expect(savedPayload()).not.toHaveProperty("parLeadComment");
    expect(savedPayload()).not.toHaveProperty("parAdminComment");
  });
});

describe("ParLeadReviewPanel: Admin View saves", () => {
  const savedPayload = () => ratingMutate.mock.calls.at(-1)![0].payload;
  const COMMENT = "Enter your comment here";
  // The admin comment's field, as opposed to the lead's comment once editing is unlocked.
  const adminField = () => screen.getAllByLabelText(COMMENT).find((e) => e.closest(".MuiAccordion-root"))!;
  const leadField = () => screen.getAllByLabelText(COMMENT).find((e) => !e.closest(".MuiAccordion-root"))!;
  const showAsAdmin = (overrides: Partial<ParRating> = {}, forCycle: ParCycle = cycle) => {
    rating = {
      parRatingId: 7,
      parCycleId: 2,
      parEmployeeEmail: "alex@example.com",
      parEmployeeStatus: "SHARED",
      parLeadStatus: "DRAFT",
      parIsLeadershipEmployee: false,
      ...overrides,
    } as ParRating;
    return render(<ParLeadReviewPanel cycle={forCycle} employeeEmail="alex@example.com" isAdminView />);
  };

  it("saves the admin comment on its own, sending nothing else and needing no unlocking", () => {
    showAsAdmin({ parLeadStatus: "SHARED", parRating: "Successful", parLeadComment: encodeParComment("<p>Lead</p>") });
    fireEvent.click(screen.getByRole("button", { name: "Admin Comment" }));
    expect(screen.getByRole("button", { name: "Save comment" })).toBeDisabled();
    fireEvent.change(adminField(), { target: { value: "<p>Checked with the lead.</p>" } });
    fireEvent.click(screen.getByRole("button", { name: "Save comment" }));
    expect(savedPayload()).toEqual({ parAdminComment: encodeParComment("<p>Checked with the lead.</p>") });
  });

  it("clears the admin comment with an empty one", () => {
    showAsAdmin({ parAdminComment: encodeParComment("<p>Old note</p>") });
    fireEvent.change(adminField(), { target: { value: "<p><br></p>" } });
    fireEvent.click(screen.getByRole("button", { name: "Save comment" }));
    expect(savedPayload()).toEqual({ parAdminComment: "" });
  });

  it("keeps a shared PAR shared on Save draft, sending only what the admin changed", async () => {
    showAsAdmin({ parLeadStatus: "SHARED", parRating: "Successful", parLeadComment: encodeParComment("<p>Lead</p>") });
    fireEvent.click(screen.getByRole("button", { name: "edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("combobox", { name: "Rating" });
    expect(screen.getByText("Lead's feedback is shared with the employee")).toBeInTheDocument();
    expect(screen.queryByText(/Please share/)).not.toBeInTheDocument();
    fireEvent.change(leadField(), { target: { value: "<p>Lead, corrected.</p>" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await act(async () => {});
    expect(savedPayload()).toEqual({ parLeadComment: encodeParComment("<p>Lead, corrected.</p>") });
  });

  it("leaves a rating the lead saved meanwhile alone when the admin changed only the comment", async () => {
    const view = showAsAdmin({ parRating: "Successful", parLeadComment: encodeParComment("<p>Lead</p>") });
    fireEvent.click(screen.getByRole("button", { name: "edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("combobox", { name: "Rating" });
    // The lead saves another rating meanwhile, and a refetch brings it in.
    rating = { ...rating, parRating: "Needs Improvements" };
    view.rerender(<ParLeadReviewPanel cycle={cycle} employeeEmail="alex@example.com" isAdminView />);
    fireEvent.change(leadField(), { target: { value: "<p>Lead, corrected.</p>" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await act(async () => {});
    expect(savedPayload()).toEqual({ parLeadComment: encodeParComment("<p>Lead, corrected.</p>") });
  });

  it("still sends a comment edited while the previous save was on its way", async () => {
    showAsAdmin({ parRating: "Successful", parLeadComment: encodeParComment("<p>Lead</p>") });
    fireEvent.click(screen.getByRole("button", { name: "edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("combobox", { name: "Rating" });
    fireEvent.change(leadField(), { target: { value: "<p>First fix.</p>" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await act(async () => {});
    const firstSave = ratingMutate.mock.calls.at(-1)!;
    // Edited again before the first save comes back.
    fireEvent.change(leadField(), { target: { value: "<p>Second fix.</p>" } });
    act(() => firstSave[1].onSuccess());
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await act(async () => {});
    expect(savedPayload()).toEqual({ parLeadComment: encodeParComment("<p>Second fix.</p>") });
  });

  it("can't be edited once the cycle is closed, even before its end date", () => {
    showAsAdmin({}, { ...cycle, parCycleStatus: "CLOSED" } as ParCycle);
    expect(screen.queryByRole("button", { name: "edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save comment" })).not.toBeInTheDocument();
    expect(screen.getByText("Admin comment unavailable")).toBeInTheDocument();
  });
});
