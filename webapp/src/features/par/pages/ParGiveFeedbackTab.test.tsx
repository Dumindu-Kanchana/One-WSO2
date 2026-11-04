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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import type { ParCycle, ParParticipant, Par360ReviewRequest } from "../api/types";
import type {
  Leadership360CurrentSurvey,
  Leadership360Leader,
  Leadership360MyFeedback,
  Leadership360ResultsEntry,
} from "../api/leadership360Types";

const query = <T,>(data: T) => ({
  data,
  isLoading: false,
  isError: false,
  isFetching: false,
  error: null,
  refetch: vi.fn(),
});
const mutation = () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false, error: null });

const cycle = {
  parCycleId: 7,
  parCycleName: "2026 H2",
  parCycleStartDate: "2026-10-29",
  parCycleEndDate: "2026-12-15",
  parThreeSixtyRatingDeadline: "2999-01-01",
} as ParCycle;

const survey: Leadership360CurrentSurvey = {
  survey: {
    surveyId: 3,
    surveyName: "Leadership 360 · 2026 H2",
    formTemplateId: 1,
    startDate: "2026-10-29",
    endDate: "2026-11-08",
    status: "OPEN",
  },
  template: {
    formTemplateId: 1,
    formKind: "LEADERSHIP_360",
    formVersion: 1,
    definition: {
      kind: "LEADERSHIP_360",
      version: 1,
      title: "Leadership 360°",
      scales: {},
      sections: [
        {
          id: "vision",
          title: "Vision",
          questions: [
            { id: "q1", type: "RATING", text: "Sets direction" },
            { id: "q2", type: "RATING", text: "Explains why" },
          ],
        },
      ],
    },
  },
};

const leader = (workEmail: string, employeeName: string): Leadership360Leader => ({
  workEmail,
  employeeName,
  jobRole: "Director",
  employeeThumbnail: null,
});
const elena = leader("elena@example.com", "Elena");
const alexAsked: Par360ReviewRequest = {
  employeeEmail: "alex@example.com",
  reviewStatus: "PENDING",
  isEmployeeRequested: true,
  isLeadRequested: false,
};
const hannah = leader("hannah@example.com", "Hannah");

let parts: { cycle?: ParCycle; hasLead: boolean; leadership: boolean };
let currentSurvey: Leadership360CurrentSurvey | null;
let mine: Leadership360MyFeedback;
let requests: Par360ReviewRequest[];
let participants: ParParticipant[];
let results: Leadership360ResultsEntry[];
const resultsViews: string[] = [];
const offerMutate = vi.fn();

vi.mock("@features/my/api/useMeProfile", () => ({
  useMeProfile: () => ({
    data: {
      userInfo: { workEmail: "me@example.com" },
      employee: { managerEmail: "hannah@example.com", additionalManagerEmails: null },
    },
    isLoading: false,
  }),
}));

vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));

vi.mock("../api/useParFeedbackParts", () => ({
  useParFeedbackParts: () => ({ ...parts, isLoading: false, cycleError: null, retryCycle: vi.fn() }),
}));

vi.mock("../api/usePar360", () => ({
  useReviewRequests: () => query(requests),
  useReviewers: () => query([]),
  useRequestReviewers: () => mutation(),
  useSubmitReview: () => mutation(),
  useParticipants: () => query(participants),
  useOfferToReview: () => ({ ...mutation(), mutate: offerMutate }),
}));

vi.mock("../api/useParData", () => ({
  useParEmployeeInfo: () => query({ leadEmail: "hannah@example.com" }),
  useParRating: () => query({ parLeadStatus: "PENDING" }),
}));

vi.mock("../api/useReview360", () => ({
  useReviewSummary: () => query({ available: false }),
}));

vi.mock("../api/useLeadership360", async (importOriginal) => ({
  resultsSurveys: (await importOriginal<typeof import("../api/useLeadership360")>()).resultsSurveys,
  useCurrentLeadership360Survey: () => query(currentSurvey),
  useMyLeadership360Feedback: () => query(mine),
  useLeadership360Leaders: () => query([elena, hannah]),
  useLeadership360Surveys: () => query([{ ...survey.survey, status: "CLOSED" }]),
  useLeadership360Results: (_surveyId: number | undefined, view: string) => {
    resultsViews.push(view);
    return query(results);
  },
}));

vi.mock("../components/Par360FeedbackDialog", () => ({
  default: ({ employeeName }: { employeeName: string }) => <div>PAR form for {employeeName}</div>,
}));
vi.mock("../components/Leadership360FeedbackDialog", () => ({
  default: ({
    leader: l,
    anonymousUsedThisMonth,
  }: {
    leader: Leadership360Leader;
    anonymousUsedThisMonth: boolean;
  }) => (
    <div>
      Leadership form for {l.employeeName}
      {anonymousUsedThisMonth ? " (named only this month)" : ""}
    </div>
  ),
}));
vi.mock("../components/Leadership360SummaryDialog", () => ({ default: () => null }));
vi.mock("../components/Par360SummaryView", () => ({ default: () => null }));
vi.mock("../components/Par360RequestDialog", () => ({ Par360RequestPicker: () => null }));

const { default: ParGiveFeedbackTab } = await import("./ParGiveFeedbackTab");

function show() {
  render(
    <MemoryRouter initialEntries={["/me/performance/give-feedback"]}>
      <ParGiveFeedbackTab />
    </MemoryRouter>,
  );
}

const noFeedback = (): Leadership360MyFeedback => ({ drafts: [], named: [], anonymous: [], currentMonth: "2026-11" });

/** Give feedback, then a person from the list. */
async function pick(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("button", { name: "Give feedback" }));
  await user.type(screen.getByRole("combobox", { name: "Who is it for?" }), name);
  await user.click(screen.getByRole("option", { name: new RegExp(name) }));
}

const rowNames = () =>
  ["Alex", "Sam", "Hannah", "Elena"]
    .map((name) => ({ name, at: document.body.textContent!.indexOf(name) }))
    .filter((r) => r.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((r) => r.name);

beforeEach(() => {
  parts = { cycle, hasLead: true, leadership: true };
  participants = [
    { workEmail: "elena@example.com", employeeName: "Elena" },
    { workEmail: "alex@example.com", employeeName: "Alex" },
  ];
  currentSurvey = survey;
  mine = noFeedback();
  window.localStorage.clear();
  requests = [];
  results = [];
  resultsViews.length = 0;
  offerMutate.mockReset();
});

describe("ParGiveFeedbackTab", () => {
  it("lists requests, drafts and what you've given in one list, waiting ones first", () => {
    requests = [
      { ...alexAsked, employeeEmail: "sam@example.com", employeeName: "Sam", reviewStatus: "SHARED" },
      { ...alexAsked, employeeName: "Alex" },
    ];
    mine = { ...noFeedback(), drafts: [{ leaderEmail: "hannah@example.com", answers: {}, anonymous: false }] };
    window.localStorage.setItem("par-l360-anonymous-draft:me@example.com:3:elena@example.com", "{}");
    show();
    expect(screen.queryByRole("button", { name: /Requests to me/ })).not.toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Anonymous draft")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();
    expect(rowNames().at(-1)).toBe("Sam");
  });

  it("shows Leadership 360° feedback you gave as submitted, without opening it again", () => {
    mine = {
      ...noFeedback(),
      named: [{ leaderEmail: "hannah@example.com", submittedOn: "2026-11-02" }],
      anonymous: [{ leaderEmail: "elena@example.com", month: "2026-11" }],
    };
    show();
    expect(screen.getByText("Submitted · 2 Nov '26")).toBeInTheDocument();
    expect(screen.getByText("Submitted anonymously · November 2026")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View" })).not.toBeInTheDocument();
  });

  it("answers a leader's request with the Leadership 360° form", async () => {
    const user = userEvent.setup();
    requests = [{ ...alexAsked, employeeEmail: "elena@example.com", employeeName: "Elena" }];
    show();
    expect(screen.getByText("Leadership 360°")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Respond" }));
    expect(screen.getByText("Leadership form for Elena")).toBeInTheDocument();
  });

  it("counts a leader's request as answered once you gave anonymous feedback", () => {
    requests = [{ ...alexAsked, employeeEmail: "elena@example.com", employeeName: "Elena" }];
    mine = { ...noFeedback(), anonymous: [{ leaderEmail: "elena@example.com", month: "2026-11" }] };
    show();
    expect(screen.getByText("Submitted anonymously · November 2026")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Respond" })).not.toBeInTheDocument();
  });

  it("filters to feedback you were asked for, or gave without being asked", async () => {
    const user = userEvent.setup();
    requests = [
      { ...alexAsked, employeeName: "Alex" },
      { ...alexAsked, employeeEmail: "sam@example.com", employeeName: "Sam", isEmployeeRequested: false },
    ];
    show();
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Voluntary" }));
    expect(screen.getByText("Sam")).toBeInTheDocument();
    expect(screen.queryByText("Alex")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Requested" }));
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.queryByText("Sam")).not.toBeInTheDocument();
  });

  it("says nobody asked when there's nothing, with no banner for the open survey", () => {
    show();
    expect(screen.getByText("No one has asked for your feedback yet")).toBeInTheDocument();
    expect(screen.queryByText("Leadership 360 · 2026 H2")).not.toBeInTheDocument();
  });
});

describe("Give feedback", () => {
  it("has one Give feedback button; a request is answered with Respond", async () => {
    const user = userEvent.setup();
    requests = [{ ...alexAsked, employeeName: "Alex" }];
    show();
    expect(screen.getAllByRole("button", { name: "Give feedback" })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Respond" }));
    expect(screen.getByText("PAR form for Alex")).toBeInTheDocument();
  });

  it("asks for the person first, from everyone, and a leader gets the Leadership 360° form", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Give feedback" }));
    expect(screen.queryByRole("button", { name: /For a PAR/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Who is it for?" }));
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toHaveLength(3);
    expect(options[0]).toContain("Hannah");
    expect(screen.getByText("People you work with")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Elena/ })).toHaveTextContent("Leadership 360°");
    await user.click(screen.getByRole("option", { name: /Elena/ }));
    expect(screen.getByText("Leadership form for Elena")).toBeInTheDocument();
  });

  it("leaves out people already in your list: you respond or continue there", async () => {
    const user = userEvent.setup();
    requests = [{ ...alexAsked, employeeName: "Alex" }];
    show();
    await user.click(screen.getByRole("button", { name: "Give feedback" }));
    await user.click(screen.getByRole("combobox", { name: "Who is it for?" }));
    expect(screen.queryByRole("option", { name: /Alex/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Elena/ })).toBeInTheDocument();
  });

  it("shows an offer you opened but didn't answer as your draft, with nothing to decline", () => {
    requests = [{ ...alexAsked, employeeName: "Alex", isEmployeeRequested: false }];
    show();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Decline" })).not.toBeInTheDocument();
  });

  it("confirms before offering PAR feedback nobody asked for, and Back returns to the list", async () => {
    const user = userEvent.setup();
    show();
    await pick(user, "Alex");
    expect(screen.getByText(/Offer feedback for Alex's 2026 H2 PAR\?/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("combobox", { name: "Who is it for?" })).toHaveValue("");
    expect(offerMutate).not.toHaveBeenCalled();
    await user.type(screen.getByRole("combobox", { name: "Who is it for?" }), "Alex");
    await user.click(screen.getByRole("option", { name: /Alex/ }));
    await user.click(screen.getByRole("button", { name: "Offer feedback" }));
    expect(offerMutate).toHaveBeenCalledWith("alex@example.com", expect.anything());
  });

  it("doesn't list someone you've already given PAR feedback", async () => {
    const user = userEvent.setup();
    requests = [{ ...alexAsked, reviewStatus: "SHARED" }];
    show();
    await user.click(screen.getByRole("button", { name: "Give feedback" }));
    await user.click(screen.getByRole("combobox", { name: "Who is it for?" }));
    expect(screen.queryByRole("option", { name: /Alex/ })).not.toBeInTheDocument();
  });

  it("can't pick a leader while no Leadership 360° survey is open", async () => {
    const user = userEvent.setup();
    currentSurvey = null;
    show();
    await user.click(screen.getByRole("button", { name: "Give feedback" }));
    await user.click(screen.getByRole("combobox", { name: "Who is it for?" }));
    const elenaOption = screen.getByRole("option", { name: /Elena/ });
    expect(elenaOption).toHaveAttribute("aria-disabled", "true");
    expect(elenaOption).toHaveTextContent("Leadership 360° closed");
  });

  it("marks each row with its kind", () => {
    requests = [{ ...alexAsked, employeeName: "Alex" }];
    show();
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("PAR 360°")).toBeInTheDocument();
  });

  it("keeps leaders pickable after feedback, and the form knows this month's anonymous one is used", async () => {
    const user = userEvent.setup();
    mine = { ...noFeedback(), anonymous: [{ leaderEmail: "elena@example.com", month: "2026-11" }] };
    show();
    await user.click(screen.getByRole("button", { name: "Give feedback" }));
    await user.click(screen.getByRole("combobox", { name: "Who is it for?" }));
    const elenaOption = screen.getByRole("option", { name: /Elena/ });
    expect(elenaOption).not.toHaveAttribute("aria-disabled", "true");
    expect(elenaOption).toHaveTextContent("Leadership 360° · Submitted");
    await user.click(elenaOption);
    expect(screen.getByText("Leadership form for Elena (named only this month)")).toBeInTheDocument();
  });
});
