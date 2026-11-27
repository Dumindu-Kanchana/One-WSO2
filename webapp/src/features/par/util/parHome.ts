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

// The Active cycle tabs: each step's state, and what the open step's panel says at its top.
import type { ParCycle, ParRating, Par360Reviewer } from "../api/types";
import { MIN_360_RESPONSES } from "../api/review360Types";
import { formatShortDate } from "./parDate";
import { isDeadlinePassed } from "./parDeadline";
import { employeeDeadlineFor } from "./parDepartments";

export type HomeStepKey = "self-review" | "360" | "lead-review" | "f2f";

/** A step's state: the one word its tab shows. */
export type StepState = "not-started" | "in-progress" | "not-available" | "done" | "incomplete";

export const STEP_STATE_LABEL: Record<StepState, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  "not-available": "Not available yet",
  done: "Completed",
  incomplete: "Incomplete",
};

export interface HomeStep {
  key: HomeStepKey;
  label: string;
  state: StepState;
}

/** The date on the right of the open step's heading. */
export interface StepDue {
  label: "Due" | "Open until" | "Expected by";
  date: string;
  /** Days left show only for the employee's own deadline while the step is theirs to do. */
  countdown: boolean;
}

/** The top of the open step's panel: its heading, the date on its right, and the one line an Incomplete step has. */
export interface StepHeader {
  title: string;
  due?: StepDue;
  line?: string;
}

export interface HomeInput {
  cycle: ParCycle;
  rating: ParRating;
  reviewers: Par360Reviewer[];
  /** A member's 360° responses received, offered ones too; while unknown, those from people asked. */
  received?: number;
  /** A member of the leadership team: their 360° feedback is Leadership 360°, and only how many
   * responded is known, not who. */
  leadership?: { responseCount: number };
}

const STEPS: { key: HomeStepKey; label: string }[] = [
  { key: "self-review", label: "Self-review" },
  { key: "360", label: "360° feedback" },
  { key: "lead-review", label: "Lead review" },
  { key: "f2f", label: "Face-to-face" },
];

export function feedbackProgress(reviewers: Par360Reviewer[]) {
  const asked = reviewers.filter((r) => r.reviewStatus !== "REJECTED" && r.reviewStatus !== "SANITIZED").length;
  const responded = reviewers.filter((r) => r.reviewStatus === "SHARED").length;
  const declined = reviewers.filter((r) => r.reviewStatus === "REJECTED").length;
  return { asked, responded, declined };
}

function facts({ cycle, rating, reviewers, received, leadership }: HomeInput) {
  const selfShared = rating.parEmployeeStatus === "SHARED" || rating.parEmployeeStatus === "SHARED_BLOCKED";
  const leadShared = rating.parLeadStatus === "SHARED";
  const f2fDone = rating.parF2fStatus === "COMPLETED";
  const { asked, responded } = feedbackProgress(reviewers);
  const deadline360Passed = isDeadlinePassed(cycle.parThreeSixtyRatingDeadline);
  // Sharing the PAR stops requests for a member's PAR 360° feedback; a leader's Leadership 360° still
  // counts until the 360° deadline. In a PAR 2.0 cycle a lead can't share before then, so only the
  // missed-deadline job does, when a self-review wasn't shared by its deadline (or a PAR shared before that rule).
  const closedEarly = !leadership && leadShared && !deadline360Passed;
  return {
    selfShared,
    // Nothing is submitted for the employee at a deadline: their own steps lock, so a missed one is Incomplete.
    selfMissed: !selfShared && isDeadlinePassed(employeeDeadlineFor(cycle, rating.parDepartment)),
    leadShared,
    f2fDone,
    f2fMissed: !f2fDone && isDeadlinePassed(cycle.parF2FDeadline),
    asked,
    received: leadership ? leadership.responseCount : (received ?? responded),
    closedEarly,
    closed360: deadline360Passed || closedEarly,
  };
}

export function homeSteps(input: HomeInput): HomeStep[] {
  const f = facts(input);
  const state: Record<HomeStepKey, StepState> = {
    "self-review": f.selfShared
      ? "done"
      : f.selfMissed
        ? "incomplete"
        : input.rating.parEmployeeStatus === "DRAFT"
          ? "in-progress"
          : "not-started",
    "360":
      f.received >= MIN_360_RESPONSES
        ? "done"
        : f.closed360
          ? "incomplete"
          : f.asked > 0 || f.received > 0
            ? "in-progress"
            : "not-started",
    "lead-review": f.leadShared ? "done" : "not-available",
    // Either of them marks it done, once the lead has shared.
    f2f: f.f2fDone ? "done" : f.f2fMissed ? "incomplete" : f.leadShared ? "not-started" : "not-available",
  };
  return STEPS.map((s) => ({ ...s, state: state[s.key] }));
}

export function stepHeader(input: HomeInput, key: HomeStepKey): StepHeader {
  const { cycle, leadership } = input;
  const f = facts(input);
  // Their department's own self-review deadline, or the cycle's.
  const selfReviewDeadline = employeeDeadlineFor(cycle, input.rating.parDepartment);
  const state = homeSteps(input).find((s) => s.key === key)!.state;
  const passed = (what: string, deadline: string) => `The ${what} deadline passed on ${formatShortDate(deadline)}.`;

  switch (key) {
    case "self-review":
      if (state === "done") return { title: "Self-review shared" };
      if (state === "incomplete") {
        return { title: "Self-review not shared", line: passed("self-review", selfReviewDeadline) };
      }
      return {
        title: state === "in-progress" ? "Write your self-review" : "Self-review",
        due: { label: "Due", date: selfReviewDeadline, countdown: true },
      };
    case "360": {
      const name = leadership ? "Leadership 360° feedback" : "360° feedback";
      const deadline = cycle.parThreeSixtyRatingDeadline;
      if (state === "incomplete") {
        return {
          title: `${name} incomplete`,
          // The backend keeps no date for when the PAR was shared.
          line: !f.closedEarly
            ? passed("360°", deadline)
            : input.rating.parRatingSharedBy === "SYSTEM"
              ? "Your PAR was rated and shared when your self-review deadline passed."
              : "Your lead shared your PAR before the 360° deadline.",
        };
      }
      if (state === "done") {
        // More can still come in until the window closes.
        return f.closed360 ? { title: name } : { title: name, due: { label: "Open until", date: deadline, countdown: false } };
      }
      // Once the lead has shared, no one can be asked any more, but a leader's Leadership 360° feedback still
      // comes in until the deadline.
      if (leadership && f.leadShared) return { title: name, due: { label: "Open until", date: deadline, countdown: false } };
      // Asking is the employee's part (at least 3 for a member); after that, the window is open until the deadline.
      const asking = state === "not-started" || (!leadership && f.asked < MIN_360_RESPONSES);
      return { title: `Request ${name}`, due: { label: asking ? "Due" : "Open until", date: deadline, countdown: true } };
    }
    case "lead-review":
      return state === "done"
        ? { title: "Your lead review" }
        : { title: "Lead review", due: { label: "Expected by", date: cycle.parLeadDeadline, countdown: false } };
    case "f2f":
      if (state === "done") return { title: "Face-to-face" };
      if (state === "incomplete") return { title: "Face-to-face not marked done", line: passed("face-to-face", cycle.parF2FDeadline) };
      return { title: "Face-to-face", due: { label: "Due", date: cycle.parF2FDeadline, countdown: state === "not-started" } };
  }
}

// The step Active cycle opens on: the self-review while it's yours to share, the lead's review once
// they've shared it, else 360° feedback while there's asking to do, else the self-review. Never the
// face-to-face.
export function landingStep(input: HomeInput): HomeStepKey {
  const state = Object.fromEntries(homeSteps(input).map((s) => [s.key, s.state])) as Record<HomeStepKey, StepState>;
  const open = (s: StepState) => s === "not-started" || s === "in-progress";
  if (open(state["self-review"])) return "self-review";
  if (state["lead-review"] === "done") return "lead-review";
  if (open(state["360"]) && facts(input).asked < MIN_360_RESPONSES) return "360";
  return "self-review";
}
