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

// The Active cycle tracker: where the employee is in the cycle, and the one thing to do next.
import type { ParCycle, ParRating, Par360Reviewer, Par360ReviewRequest } from "../api/types";
import { MIN_360_RESPONSES } from "../api/review360Types";
import { isDeadlinePassed } from "./parDeadline";

export type HomeStepKey = "self-review" | "360" | "lead-review" | "f2f";
export type HomeStepState = "done" | "current" | "upcoming";
/** Whose move a step is: the employee's, someone else's, nobody's yet (it opens later), or done.
 * "enough" is 360° feedback with enough answers for results while more can still come in;
 * "closed", a step whose deadline passed before it was finished (for 360° feedback, without
 * enough answers). */
export type HomeStepStatus = "todo" | "waiting" | "locked" | "enough" | "done" | "closed";

export interface HomeStep {
  key: HomeStepKey;
  label: string;
  state: HomeStepState;
  status: HomeStepStatus;
  /** Who a waiting step waits on. */
  waitingOn?: string;
  detail: string;
  due?: string;
  /** What the date chip says before the date: the employee's own deadlines are "Due"; someone
   * else's, "Expected by". */
  dueLabel?: string;
}

export interface NextUp {
  title: string;
  body: string;
  /** Something for the employee to do, nothing for now (someone else's move), or all done. */
  tone: "todo" | "waiting" | "done";
  /** When the thing to do is due, if it has a deadline. */
  due?: string;
}

export interface HomeInput {
  cycle: ParCycle;
  rating: ParRating;
  // Sections of the self-review answered so far, and how many there are.
  selfReviewProgress?: { answered: number; total: number };
  reviewers: Par360Reviewer[];
  requests: Par360ReviewRequest[];
  /** A member of the leadership team: their 360° feedback is Leadership 360°, and only how many
   * responded is known, not who. */
  leadership?: { responseCount: number };
  /** The lead's name, when known. */
  leadName?: string;
}

export function feedbackProgress(reviewers: Par360Reviewer[]) {
  const asked = reviewers.filter((r) => r.reviewStatus !== "REJECTED" && r.reviewStatus !== "SANITIZED").length;
  const responded = reviewers.filter((r) => r.reviewStatus === "SHARED").length;
  const declined = reviewers.filter((r) => r.reviewStatus === "REJECTED").length;
  return { asked, responded, declined };
}

// Requests for your feedback you haven't answered yet.
export function openRequests(requests: Par360ReviewRequest[]): Par360ReviewRequest[] {
  return requests.filter((r) => r.reviewStatus === "PENDING" || r.reviewStatus === "DRAFT");
}

export function homeSteps({ cycle, rating, selfReviewProgress, reviewers, leadership, leadName }: HomeInput): HomeStep[] {
  const lead = leadName ?? "your lead";
  const Lead = leadName ?? "Your lead";
  const selfShared = rating.parEmployeeStatus === "SHARED" || rating.parEmployeeStatus === "SHARED_BLOCKED";
  const leadShared = rating.parLeadStatus === "SHARED";
  const f2fDone = rating.parF2fStatus === "COMPLETED";
  // Nothing is submitted for the employee at a deadline: their own steps lock, so a missed one closes.
  const selfMissed = !selfShared && isDeadlinePassed(cycle.parEmployeeDeadline);
  const f2fMissed = !f2fDone && isDeadlinePassed(cycle.parF2FDeadline);
  const { asked, responded: parResponded } = feedbackProgress(reviewers);
  const responded = leadership ? leadership.responseCount : parResponded;
  const feedbackDone = responded >= MIN_360_RESPONSES || leadShared || isDeadlinePassed(cycle.parThreeSixtyRatingDeadline);

  const steps: Omit<HomeStep, "state" | "status" | "waitingOn">[] = [
    {
      key: "self-review",
      label: "Self-review",
      detail: selfShared
        ? "Shared with your lead"
        : selfMissed
          ? "Not shared by the deadline"
          : rating.parEmployeeStatus === "DRAFT"
          ? selfReviewProgress
            ? `${selfReviewProgress.answered} of ${selfReviewProgress.total} sections`
            : "Draft saved"
          : "Not started",
      due: cycle.parEmployeeDeadline,
    },
    {
      key: "360",
      label: "360° feedback",
      detail: leadership
        ? `Leadership 360°: ${responded > 0 ? `${responded} submitted` : "none yet"}`
        : asked === 0
          ? feedbackDone
            ? "None requested"
            : "None requested yet"
          : `${responded} of ${asked} submitted`,
      due: cycle.parThreeSixtyRatingDeadline,
    },
    {
      key: "lead-review",
      label: "Lead review",
      detail: leadShared
        ? "Shared with you"
        : rating.parLeadStatus === "DRAFT"
          ? `${Lead} is writing it`
          : selfShared || selfMissed
            ? `With ${lead}`
            : `${Lead} reviews after you share`,
      due: cycle.parLeadDeadline,
      dueLabel: "Expected by",
    },
    {
      key: "f2f",
      label: "Face-to-face",
      detail: f2fDone
        ? "Done"
        : f2fMissed
          ? "Not marked done by the deadline"
          : rating.parF2fStatus === "SCHEDULED"
          ? "Booked"
          : leadShared
            ? `You book it with ${lead}`
            : `Opens after ${lead} shares`,
      due: cycle.parF2FDeadline,
    },
  ];
  const done: Record<HomeStepKey, boolean> = {
    "self-review": selfShared || selfMissed,
    "360": feedbackDone,
    "lead-review": leadShared,
    f2f: f2fDone || f2fMissed,
  };
  // Asking enough people is the employee's part; after that, 360° feedback waits on them. With
  // enough answers it's "enough" while more can still come in (a leader's always can), "done"
  // once everyone asked has answered or the window has closed.
  const feedbackOpen = !leadShared && !isDeadlinePassed(cycle.parThreeSixtyRatingDeadline);
  const moreToCome = leadership !== undefined || parResponded < asked;
  const status: Record<HomeStepKey, HomeStepStatus> = {
    "self-review": selfShared ? "done" : selfMissed ? "closed" : "todo",
    "360": feedbackDone
      ? responded < MIN_360_RESPONSES
        ? "closed"
        : feedbackOpen && moreToCome
          ? "enough"
          : "done"
      : asked >= MIN_360_RESPONSES
        ? "waiting"
        : "todo",
    "lead-review": leadShared ? "done" : "waiting",
    // The employee books the F2F, once the lead has shared.
    f2f: f2fDone ? "done" : f2fMissed ? "closed" : leadShared ? "todo" : "locked",
  };
  const waitingOn: Partial<Record<HomeStepKey, string>> = { "360": "reviewers", "lead-review": lead };
  const current = steps.find((s) => !done[s.key])?.key;
  return steps.map((s) => ({
    ...s,
    state: done[s.key] ? "done" : s.key === current ? "current" : "upcoming",
    status: status[s.key],
    ...(status[s.key] === "waiting" ? { waitingOn: waitingOn[s.key] } : {}),
  }));
}

// One next action, in the order the cycle needs them. Waiting on someone else
// is said plainly rather than inventing something to do.
export function nextUp({
  cycle,
  rating,
  selfReviewProgress,
  reviewers,
  requests,
  leadership,
  leadName,
}: HomeInput): NextUp {
  const selfShared = rating.parEmployeeStatus === "SHARED" || rating.parEmployeeStatus === "SHARED_BLOCKED";
  const leadShared = rating.parLeadStatus === "SHARED";
  const { asked } = feedbackProgress(reviewers);
  const feedbackOpen = !leadShared && !isDeadlinePassed(cycle.parThreeSixtyRatingDeadline);

  if (!selfShared && !isDeadlinePassed(cycle.parEmployeeDeadline)) {
    return rating.parEmployeeStatus === "DRAFT"
      ? {
          title: "Finish and share your self-review",
          body: selfReviewProgress
            ? `${selfReviewProgress.answered} of ${selfReviewProgress.total} sections done. Your lead sees it once you share.`
            : "Your draft is saved. Your lead sees it once you share.",
          tone: "todo",
          due: cycle.parEmployeeDeadline,
        }
      : {
          title: "Start your self-review",
          body: "A few short sections on your impact and how you've grown. It saves as you type.",
          tone: "todo",
          due: cycle.parEmployeeDeadline,
        };
  }
  if (leadership && feedbackOpen && asked < MIN_360_RESPONSES && leadership.responseCount < MIN_360_RESPONSES) {
    return {
      title: "Request Leadership 360° feedback",
      body: "Request it from people who work closely with you. They can answer named or anonymously, and anyone can give it unrequested.",
      tone: "todo",
      due: cycle.parThreeSixtyRatingDeadline,
    };
  }
  if (!leadership && feedbackOpen && asked < MIN_360_RESPONSES) {
    return {
      title: "Request 360° feedback",
      body: `Request it from at least ${MIN_360_RESPONSES} people who worked closely with you this cycle (${asked} so far).`,
      tone: "todo",
      due: cycle.parThreeSixtyRatingDeadline,
    };
  }
  const waiting = openRequests(requests);
  const giveFeedback: NextUp | undefined =
    waiting.length > 0 && !isDeadlinePassed(cycle.parThreeSixtyRatingDeadline)
      ? {
          title:
            waiting.length > 1
              ? `${waiting.length} people asked for your feedback`
              : `${waiting[0].employeeName ?? waiting[0].employeeEmail} asked for your feedback`,
          body:
            waiting.length > 1
              ? "They asked for your 360° feedback, in Give feedback. About five minutes each."
              : "They asked for your 360° feedback, in Give feedback. It takes about five minutes.",
          tone: "todo",
          due: cycle.parThreeSixtyRatingDeadline,
        }
      : undefined;
  // While the lead reviews, feedback others are waiting on is the thing to do.
  if (!leadShared) {
    return (
      giveFeedback ?? {
        title: `${leadName ?? "Your lead"} is reviewing`,
        body: `Nothing for you to do right now. You'll get an email when ${leadName ?? "your lead"} shares your PAR.`,
        tone: "waiting",
      }
    );
  }
  // Once the lead has shared, your own F2F comes first, until its deadline.
  if (rating.parF2fStatus !== "COMPLETED" && !isDeadlinePassed(cycle.parF2FDeadline)) {
    return rating.parF2fStatus === "SCHEDULED"
      ? {
          title: "Your face-to-face is booked",
          body: "Talk through your PAR with your lead, then mark the F2F as done.",
          tone: "todo",
          due: cycle.parF2FDeadline,
        }
      : {
          title: "Book your face-to-face",
          body: "Your lead has shared your PAR. Find a time to talk it through.",
          tone: "todo",
          due: cycle.parF2FDeadline,
        };
  }
  if (giveFeedback) return giveFeedback;
  return {
    title: "Your PAR is complete",
    body: "Download the final PAR, with your lead's feedback and your 360° results, for your records.",
    tone: "done",
  };
}
