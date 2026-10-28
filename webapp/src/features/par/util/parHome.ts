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

// PAR 2.0 Home: where the employee is in the cycle, and the one thing to do next.
import type { ParCycle, ParRating, Par360Reviewer, Par360ReviewRequest } from "../api/types";
import { MIN_360_RESPONSES } from "../api/review360Types";
import { isDeadlinePassed } from "./parDeadline";

export type HomeStepKey = "self-review" | "360" | "lead-review" | "f2f" | "complete";
export type HomeStepState = "done" | "current" | "upcoming";

export interface HomeStep {
  key: HomeStepKey;
  label: string;
  state: HomeStepState;
  detail: string;
  due?: string;
}

export interface NextUp {
  title: string;
  body: string;
  // The Me → Performance tab the action opens, if there is one.
  action?: { label: string; segment: string };
}

export interface HomeInput {
  cycle: ParCycle;
  rating: ParRating;
  // Sections of the self-review answered so far, and how many there are.
  selfReviewProgress?: { answered: number; total: number };
  reviewers: Par360Reviewer[];
  requests: Par360ReviewRequest[];
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

export function homeSteps({ cycle, rating, selfReviewProgress, reviewers }: HomeInput): HomeStep[] {
  const selfShared = rating.parEmployeeStatus === "SHARED" || rating.parEmployeeStatus === "SHARED_BLOCKED";
  const leadShared = rating.parLeadStatus === "SHARED";
  const f2fDone = rating.parF2fStatus === "COMPLETED";
  const { asked, responded } = feedbackProgress(reviewers);
  const feedbackDone = responded >= MIN_360_RESPONSES || leadShared || isDeadlinePassed(cycle.parThreeSixtyRatingDeadline);

  const steps: Omit<HomeStep, "state">[] = [
    {
      key: "self-review",
      label: "Self-review",
      detail: selfShared
        ? "Shared with your lead"
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
      detail: asked === 0 ? "No one asked yet" : `${responded} of ${asked} responded`,
      due: cycle.parThreeSixtyRatingDeadline,
    },
    {
      key: "lead-review",
      label: "Lead review",
      detail: leadShared ? "Shared with you" : rating.parLeadStatus === "DRAFT" ? "In progress" : "Not started",
      due: cycle.parLeadDeadline,
    },
    {
      key: "f2f",
      label: "F2F",
      detail: f2fDone ? "Done" : rating.parF2fStatus === "SCHEDULED" ? "Booked" : "Not booked",
      due: cycle.parF2FDeadline,
    },
    { key: "complete", label: "Complete", detail: leadShared && f2fDone ? "Download your PAR" : "" },
  ];
  const done: Record<HomeStepKey, boolean> = {
    "self-review": selfShared,
    "360": feedbackDone,
    "lead-review": leadShared,
    f2f: f2fDone,
    complete: leadShared && f2fDone,
  };
  const current = steps.find((s) => !done[s.key])?.key;
  return steps.map((s) => ({ ...s, state: done[s.key] ? "done" : s.key === current ? "current" : "upcoming" }));
}

// One next action, in the order the cycle needs them. Waiting on someone else
// is said plainly rather than inventing something to do.
export function nextUp({ cycle, rating, selfReviewProgress, reviewers, requests }: HomeInput): NextUp {
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
          action: { label: "Continue", segment: "employee-feedback" },
        }
      : {
          title: "Start your self-review",
          body: "Four short sections on your impact, goals, growth and the support you need. It saves as you type.",
          action: { label: "Start", segment: "employee-feedback" },
        };
  }
  if (feedbackOpen && asked < MIN_360_RESPONSES) {
    return {
      title: "Ask for 360° feedback",
      body: `Ask at least ${MIN_360_RESPONSES} people who worked closely with you this cycle (${asked} so far).`,
      action: { label: "Ask for feedback", segment: "360" },
    };
  }
  const waiting = openRequests(requests);
  const giveFeedback: NextUp | undefined =
    waiting.length > 0 && !isDeadlinePassed(cycle.parThreeSixtyRatingDeadline)
      ? {
          title: `Give feedback to ${waiting[0].employeeName ?? waiting[0].employeeEmail}`,
          body:
            waiting.length > 1
              ? `${waiting.length} people asked for your 360° feedback. It takes about five minutes each.`
              : "They asked for your 360° feedback. It takes about five minutes.",
          action: { label: "Give feedback", segment: "360" },
        }
      : undefined;
  // While the lead reviews, feedback others are waiting on is the thing to do.
  if (!leadShared) {
    return (
      giveFeedback ?? {
        title: "Your lead is reviewing",
        body: "Nothing for you to do right now. You'll get an email when your lead shares your PAR.",
      }
    );
  }
  // Once the lead has shared, your own F2F comes first.
  if (rating.parF2fStatus !== "COMPLETED") {
    return rating.parF2fStatus === "SCHEDULED"
      ? {
          title: "Your face-to-face is booked",
          body: "Talk through your PAR with your lead, then mark the F2F as done.",
          action: { label: "Open F2F", segment: "f2f" },
        }
      : {
          title: "Book your face-to-face",
          body: "Your lead has shared your PAR. Find a time to talk it through.",
          action: { label: "Book F2F", segment: "f2f" },
        };
  }
  if (giveFeedback) return giveFeedback;
  return {
    title: "Your PAR is complete",
    body: "Download the final PAR, with your lead's feedback and your 360° summary, for your records.",
    action: { label: "Open your PAR", segment: "employee-feedback" },
  };
}
