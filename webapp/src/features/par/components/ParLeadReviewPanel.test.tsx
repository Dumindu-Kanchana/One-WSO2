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

import { useEffect, useImperativeHandle, type ReactNode, type Ref } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HttpError } from "@api/http";
import type { ParCycle, ParRating } from "../api/types";
import { encodeParComment } from "../util/parComment";
import type { ParRichTextFieldHandle } from "./ParRichTextField";

let rating: ParRating;
let responseCount = 3;
// What the suggestion query holds once it's asked for, and whether the last
// render asked for it. (The render that seeds the saved summary starts with an
// empty one, but React discards it before any query could fetch.)
let suggestion: { data?: unknown; isLoading?: boolean; isError?: boolean; error?: Error } = {};
let suggestionAskedFor = false;
const save = vi.fn();

vi.mock("../api/useParData", () => ({ useParRating: () => ({ data: rating, isLoading: false, isError: false }) }));
vi.mock("../api/useLeadRatingUpdate", () => ({ useLeadRatingUpdate: () => ({ mutate: vi.fn(), isPending: false }) }));
vi.mock("../api/useLeadHistory", () => ({ useParEmployeeReviews: () => ({ isSuccess: true, data: [] }) }));
vi.mock("../api/useSelfReview", () => ({ useSelfReview: () => ({ data: null }) }));
vi.mock("../api/useReview360", () => ({
  useParShowsPar2: () => ({ showsPar2: true }),
  useReviewResponses: () => ({ data: { responseCount } }),
}));
vi.mock("../api/useLead360Summary", () => ({
  useLead360SummarySuggestion: (_cycle: number, _email: string, _count: number, enabled: boolean) => {
    suggestionAskedFor = enabled;
    // As the hook does once it has read one, the rating then says what the
    // suggestion was written from (seen on the next render).
    const written = (suggestion.data as { responseCount?: number } | undefined)?.responseCount;
    useEffect(() => {
      if (enabled && written !== undefined) rating = { ...rating, parLead360SuggestionResponses: written };
    }, [enabled, written]);
    return enabled ? suggestion : {};
  },
  useSaveLead360Summary: () => ({ mutate: save, mutateAsync: save, isPending: false }),
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
    ref,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    suggestion?: ReactNode;
    onAcceptSuggestion?: () => void;
    ref?: Ref<ParRichTextFieldHandle>;
  }) {
    useImperativeHandle(ref, () => ({ replaceContents: (html: string) => onChange(html) }));
    return (
      <div>
        <textarea
          aria-label={placeholder || EMPTY_FIELD}
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
  parCycleConfigurations: { parRatings: ["Successful"] },
} as unknown as ParCycle;
const FIELD = "Summarise the 360° feedback";
// The summary field while a suggestion shows in it, with no placeholder.
const EMPTY_FIELD = "summary field with a suggestion";
const SUGGESTED = { summary: "Colleagues see real ownership.\nThey'd like earlier updates.", responseCount: 3, suggestionsLeft: 9 };

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
  render(<ParLeadReviewPanel cycle={cycle} employeeEmail="alex@example.com" />);
}

beforeEach(() => {
  responseCount = 3;
  suggestion = { data: SUGGESTED };
  suggestionAskedFor = false;
  save.mockReset();
});

describe("ParLeadReviewPanel: 360° summary", () => {
  const INSERTED = "<p>Colleagues see real ownership.</p><p>They'd like earlier updates.</p>";

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

  it("needs 3 submitted responses before there's a suggestion", () => {
    responseCount = 2;
    show();
    expect(suggestionAskedFor).toBe(false);
    expect(screen.getByLabelText(FIELD)).toBeInTheDocument();
  });

  it("leaves the lead's own words alone when no responses came in since the last suggestion", () => {
    show({ parLead360Summary: encodeParComment("<p>My own words.</p>"), parLead360SuggestionResponses: 3 });
    expect(screen.getByLabelText(FIELD)).toHaveValue("<p>My own words.</p>");
    expect(suggestionAskedFor).toBe(false);
    expect(screen.queryByRole("button", { name: /suggestion/ })).not.toBeInTheDocument();
  });

  it("offers the updated suggestion again only when more responses come in, once it's dismissed", () => {
    responseCount = 5;
    suggestion = { data: { ...SUGGESTED, responseCount: 5 } };
    show({ parLead360Summary: encodeParComment("<p>My own words.</p>"), parLead360SuggestionResponses: 3 });
    fireEvent.click(screen.getByRole("button", { name: "Show updated suggestion" }));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Suggested from 5 360° responses")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /suggestion/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText(FIELD)).toHaveValue("<p>My own words.</p>");
  });

  it("offers the suggestion from newer responses, and replaces the lead's words only on Replace", () => {
    responseCount = 5;
    suggestion = { data: { ...SUGGESTED, responseCount: 5 } };
    show({ parLead360Summary: encodeParComment("<p>My own words.</p>"), parLead360SuggestionResponses: 3 });
    expect(screen.getByText("2 new 360° responses since the last suggestion.")).toBeInTheDocument();
    expect(suggestionAskedFor).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Show updated suggestion" }));
    expect(screen.getByText("Suggested from 5 360° responses")).toBeInTheDocument();
    // Its text doesn't replace them on a click.
    fireEvent.click(screen.getByText("Colleagues see real ownership."));
    expect(screen.getByLabelText(FIELD)).toHaveValue("<p>My own words.</p>");
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText(FIELD)).toHaveValue(INSERTED);
  });

  it("offers one when the lead wrote their own before any suggestion", () => {
    show({ parLead360Summary: encodeParComment("<p>My own words.</p>") });
    fireEvent.click(screen.getByRole("button", { name: "Show suggestion" }));
    expect(screen.getByText("Suggested from 3 360° responses")).toBeInTheDocument();
  });

  it("offers no update once no more can be written", () => {
    responseCount = 5;
    show({
      parLead360Summary: encodeParComment("<p>My own words.</p>"),
      parLead360SuggestionResponses: 3,
      parLead360SuggestionsLeft: 0,
    });
    expect(screen.queryByRole("button", { name: /suggestion/ })).not.toBeInTheDocument();
  });

  it("says so quietly when a suggestion can't be written, and not when none can be", () => {
    suggestion = { isError: true, error: new Error("HTTP 503") };
    show();
    expect(screen.getByText(/Couldn't write a suggestion just now/)).toBeInTheDocument();
    cleanup();
    suggestion = { isError: true, error: new HttpError("/suggestion", 429, "{}") };
    show();
    expect(screen.queryByText(/Couldn't write a suggestion/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(FIELD)).toBeInTheDocument();
  });

  it("says on sharing that a suggestion not inserted isn't shared", () => {
    show({ parRating: "Successful", parLeadComment: encodeParComment("<p>Great cycle.</p>") });
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(screen.getByText(/The suggestion in grey is only included if you insert it/)).toBeInTheDocument();
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
  });
});
