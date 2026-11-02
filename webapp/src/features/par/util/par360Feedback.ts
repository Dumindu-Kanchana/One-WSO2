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

import type { Par360ReviewRequest } from "../api/types";

// One 360° feedback tab, two kinds of feedback: for someone's PAR (named to
// their lead, counts toward their review) or Leadership 360° (a survey about
// a member of the leadership team, optionally anonymous). Give feedback asks
// for the kind first, then lists only the people it applies to.
export type FeedbackKind = "PAR" | "LEADERSHIP";

export type FeedbackState =
  // PAR: they (or their lead) asked you and you haven't started.
  | "asked"
  // PAR: nobody asked you; you can offer.
  | "offer"
  // Leadership 360°: open to anyone, not started.
  | "open"
  | "draft"
  | "given"
  // PAR: you declined their request.
  | "declined"
  // PAR: the cycle's 360° deadline has passed.
  | "closed";

export function canStart(state: FeedbackState): boolean {
  return state === "asked" || state === "offer" || state === "open" || state === "draft";
}

/** Where your PAR feedback for one person stands: what they asked of you
 * (if anything), what you've done with it, and whether the cycle's 360°
 * deadline has passed. */
export function parFeedbackState(request: Par360ReviewRequest | undefined, deadlinePassed: boolean): FeedbackState {
  const status = request?.reviewStatus;
  if (status === "SHARED" || status === "SANITIZED") return "given";
  if (status === "REJECTED") return "declined";
  if (deadlinePassed) return "closed";
  if (status === "DRAFT") return "draft";
  return request ? "asked" : "offer";
}

/** Leadership 360° feedback can always be given (named any time, anonymous once a month, which the
 * form itself enforces), so it's either a draft to continue or open. */
export function leadershipFeedbackState(hasDraft: boolean): FeedbackState {
  return hasDraft ? "draft" : "open";
}

export interface PickerPerson {
  email: string;
  name: string;
  jobRole: string | null;
  /** Someone you work with: your lead, who asked you, who you asked. */
  suggested: boolean;
}

/** The people a Give feedback picker lists, yourself excluded: the ones
 * you work with first, then everyone by name. */
export function pickerPeople({
  selfEmail,
  people,
  workedWith,
}: {
  selfEmail: string;
  people: { email: string; name: string; jobRole?: string | null }[];
  workedWith: (string | null | undefined)[];
}): PickerPerson[] {
  const self = selfEmail.toLowerCase();
  const related = new Set(workedWith.filter((e): e is string => Boolean(e)).map((e) => e.toLowerCase()));
  return people
    .filter((p) => p.email.toLowerCase() !== self)
    .map((p) => ({
      email: p.email,
      name: p.name,
      jobRole: p.jobRole ?? null,
      suggested: related.has(p.email.toLowerCase()),
    }))
    .sort((a, b) => Number(b.suggested) - Number(a.suggested) || a.name.localeCompare(b.name));
}
