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

/** Give feedback, then the kind (when asked), then a person from the list. */
async function pick(user: ReturnType<typeof userEvent.setup>, kind: string | null, name: string) {
  await user.click(screen.getByRole("button", { name: "Give feedback" }));
  if (kind) await user.click(screen.getByRole("button", { name: new RegExp(kind) }));
  await user.type(screen.getByRole("combobox", { name: "Who is it for?" }), name);
  await user.click(screen.getByRole("option", { name: new RegExp(name) }));
}

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
  it("lists your Leadership 360° drafts with the requests: named from the server, anonymous from this browser", () => {
    mine = { ...noFeedback(), drafts: [{ leaderEmail: "hannah@example.com", answers: {}, anonymous: false }] };
    window.localStorage.setItem("par-l360-anonymous-draft:me@example.com:3:elena@example.com", "{}");
    show();
    expect(screen.queryByText("Leadership 360 · 2026 H2")).not.toBeInTheDocument();
    expect(screen.getByText("Named draft")).toBeInTheDocument();
    expect(screen.getByText("Anonymous draft")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Requests to me (2)" })).toBeInTheDocument();
  });

  it("lists Leadership 360° feedback you gave under Given, without its content", async () => {
    const user = userEvent.setup();
    mine = {
      ...noFeedback(),
      named: [{ leaderEmail: "hannah@example.com", submittedOn: "2026-11-02" }],
      anonymous: [{ leaderEmail: "elena@example.com", month: "2026-11" }],
    };
    show();
    await user.click(screen.getByRole("button", { name: "Given (2)" }));
    expect(screen.getByText("Named · 2 Nov '26")).toBeInTheDocument();
    expect(screen.getByText("Anonymous · November 2026")).toBeInTheDocument();
  });

  it("says nobody is waiting when there's nothing, with no banner for the open survey", () => {
    show();
    expect(screen.getByText("No one is waiting on your feedback")).toBeInTheDocument();
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

  it("asks for the kind first, then lists only the leadership team for Leadership 360°", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Give feedback" }));
    expect(screen.getByRole("button", { name: /For a PAR/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Leadership 360°/ }));
    await user.click(screen.getByRole("combobox", { name: "Who is it for?" }));
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toHaveLength(2);
    expect(options[0]).toContain("Hannah");
    expect(screen.getByText("Leaders you work with")).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: /Elena/ }));
    expect(screen.getByText("Leadership form for Elena")).toBeInTheDocument();
  });

  it("goes back from the person list to the kinds", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Give feedback" }));
    await user.click(screen.getByRole("button", { name: /For a PAR/ }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: /Leadership 360°/ })).toBeInTheDocument();
  });

  it("opens the form for someone who asked you", async () => {
    const user = userEvent.setup();
    requests = [alexAsked];
    show();
    await pick(user, "For a PAR", "Alex");
    expect(screen.getByText("PAR form for Alex")).toBeInTheDocument();
  });

  it("confirms before offering PAR feedback nobody asked for, and Back returns to the list", async () => {
    const user = userEvent.setup();
    show();
    await pick(user, "For a PAR", "Alex");
    expect(screen.getByText(/Offer feedback for Alex's 2026 H2 PAR\?/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("combobox", { name: "Who is it for?" })).toHaveValue("");
    expect(offerMutate).not.toHaveBeenCalled();
    await user.type(screen.getByRole("combobox", { name: "Who is it for?" }), "Alex");
    await user.click(screen.getByRole("option", { name: /Alex/ }));
    await user.click(screen.getByRole("button", { name: "Offer feedback" }));
    expect(offerMutate).toHaveBeenCalledWith("alex@example.com", expect.anything());
  });

  it("can't pick someone you've already given feedback", async () => {
    const user = userEvent.setup();
    requests = [{ ...alexAsked, reviewStatus: "SHARED" }];
    show();
    await user.click(screen.getByRole("button", { name: "Give feedback" }));
    await user.click(screen.getByRole("button", { name: /For a PAR/ }));
    await user.click(screen.getByRole("combobox", { name: "Who is it for?" }));
    expect(screen.getByRole("option", { name: /Alex/ })).toHaveAttribute("aria-disabled", "true");
  });

  it("marks each request with its kind", () => {
    requests = [{ ...alexAsked, employeeName: "Alex" }];
    show();
    expect(screen.getByRole("button", { name: "Requests to me (1)" })).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("PAR")).toBeInTheDocument();
  });

  it("keeps leaders pickable after feedback, and the form knows this month's anonymous one is used", async () => {
    const user = userEvent.setup();
    mine = { ...noFeedback(), anonymous: [{ leaderEmail: "elena@example.com", month: "2026-11" }] };
    show();
    await user.click(screen.getByRole("button", { name: "Give feedback" }));
    await user.click(screen.getByRole("button", { name: /Leadership 360°/ }));
    await user.click(screen.getByRole("combobox", { name: "Who is it for?" }));
    const elena = screen.getByRole("option", { name: /Elena/ });
    expect(elena).not.toHaveAttribute("aria-disabled", "true");
    expect(elena).toHaveTextContent("Given before");
    await user.click(elena);
    expect(screen.getByText("Leadership form for Elena (named only this month)")).toBeInTheDocument();
  });
});
