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
import type { Leadership360MyFeedback } from "../api/leadership360Types";

// One 360° feedback tab, two kinds of feedback, decided by who it's about: a
// member of the leadership team gets Leadership 360° feedback (a survey,
// optionally anonymous), anyone else feedback for their PAR (named to their
// lead, counts toward their review). Give feedback asks for the person first.
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

export type GiveFeedbackItemState = "todo" | "draft" | "submitted" | "declined" | "closed";

/** One person in the Give feedback list: someone who asked you, or a leader you've started or given
 * Leadership 360° feedback on. */
export interface GiveFeedbackItem {
  email: string;
  name?: string;
  kind: FeedbackKind;
  state: GiveFeedbackItemState;
  /** Their request to you, when they (or their lead) asked; or your offer, when nobody did. */
  request?: Par360ReviewRequest;
  /** PAR 360°: nobody asked; you offered. Until you submit it counts as your draft. */
  offered?: boolean;
  /** Leadership 360°: the draft is anonymous, kept in this browser. */
  anonymousDraft?: boolean;
  /** Leadership 360°: how you last gave it. */
  given?: { anonymous: true; month: string } | { anonymous: false; on: string };
}

const STATE_ORDER: Record<GiveFeedbackItemState, number> = { todo: 0, draft: 0, submitted: 1, declined: 2, closed: 2 };

const PAR_ITEM_STATE: Record<FeedbackState, GiveFeedbackItemState> = {
  asked: "todo",
  offer: "todo",
  open: "todo",
  draft: "draft",
  given: "submitted",
  declined: "declined",
  closed: "closed",
};

/** Everything in Give feedback, waiting ones first: requests to you, and Leadership 360° feedback you
 * started or gave without being asked. A leader's request counts as answered once you've given them
 * feedback in this survey, named or anonymous; the leader never sees which. */
export function giveFeedbackItems({
  requests,
  leaderEmails,
  leaderNames = new Map(),
  mine,
  localDraftLeaders = [],
  parDeadlinePassed,
  surveyOpen,
}: {
  requests: Par360ReviewRequest[];
  /** Members of the leadership team, lower-case. */
  leaderEmails: Set<string>;
  leaderNames?: Map<string, string>;
  mine?: Leadership360MyFeedback;
  /** Leaders with an anonymous draft in this browser, lower-case. */
  localDraftLeaders?: string[];
  parDeadlinePassed: boolean;
  surveyOpen: boolean;
}): GiveFeedbackItem[] {
  const named = mine?.named ?? [];
  const anonymous = mine?.anonymous ?? [];
  const serverDrafts = new Set((mine?.drafts ?? []).map((d) => d.leaderEmail.toLowerCase()));
  const localDrafts = new Set(localDraftLeaders.map((e) => e.toLowerCase()));

  const leadershipItem = (email: string, name: string | undefined, request?: Par360ReviewRequest): GiveFeedbackItem => {
    const key = email.toLowerCase();
    const lastNamed = named.find((g) => g.leaderEmail.toLowerCase() === key);
    const lastAnonymous = anonymous
      .filter((g) => g.leaderEmail.toLowerCase() === key)
      .reduce<Leadership360MyFeedback["anonymous"][number] | undefined>(
        (latest, g) => (!latest || g.month > latest.month ? g : latest),
        undefined,
      );
    const given: GiveFeedbackItem["given"] = lastNamed
      ? { anonymous: false, on: lastNamed.submittedOn }
      : lastAnonymous
        ? { anonymous: true, month: lastAnonymous.month }
        : undefined;
    const hasDraft = serverDrafts.has(key) || localDrafts.has(key);
    const state: GiveFeedbackItemState =
      request?.reviewStatus === "REJECTED"
        ? "declined"
        : hasDraft && surveyOpen
          ? "draft"
          : given || request?.reviewStatus === "SHARED"
            ? "submitted"
            : surveyOpen
              ? "todo"
              : "closed";
    return {
      email,
      name: name ?? leaderNames.get(key),
      kind: "LEADERSHIP",
      state,
      request,
      anonymousDraft: state === "draft" && !serverDrafts.has(key),
      given,
    };
  };

  const items: GiveFeedbackItem[] = requests.map((r) => {
    if (leaderEmails.has(r.employeeEmail.toLowerCase())) return leadershipItem(r.employeeEmail, r.employeeName, r);
    const offered = !r.isEmployeeRequested && !r.isLeadRequested;
    const state = PAR_ITEM_STATE[parFeedbackState(r, parDeadlinePassed)];
    return {
      email: r.employeeEmail,
      name: r.employeeName,
      kind: "PAR",
      // An offer opened and left without an answer is still yours to finish, not a request to decline.
      state: offered && state === "todo" ? "draft" : state,
      request: r,
      offered,
    };
  });

  // Leaders you started or gave feedback on without being asked.
  const asked = new Set(requests.map((r) => r.employeeEmail.toLowerCase()));
  const unasked = new Map<string, string>();
  for (const email of [
    ...(mine?.drafts ?? []).map((d) => d.leaderEmail),
    ...localDraftLeaders,
    ...named.map((g) => g.leaderEmail),
    ...anonymous.map((g) => g.leaderEmail),
  ]) {
    const key = email.toLowerCase();
    if (!asked.has(key) && !unasked.has(key)) unasked.set(key, email);
  }
  for (const email of unasked.values()) items.push(leadershipItem(email, undefined));

  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => STATE_ORDER[a.item.state] - STATE_ORDER[b.item.state] || a.i - b.i)
    .map(({ item }) => item);
}

/** How many people are waiting on your feedback: the number on the Give feedback tab. */
export function waitingCount(items: GiveFeedbackItem[]): number {
  return items.filter((item) => item.state === "todo" || item.state === "draft").length;
}

/** Whether Give feedback's picker lists someone. People already in your list are left out (you
 * continue or respond there), except leaders you've given feedback on, who can be given it again. */
export function pickableForNewFeedback(email: string, items: GiveFeedbackItem[]): boolean {
  const key = email.toLowerCase();
  return !items.some(
    (item) => item.email.toLowerCase() === key && (item.kind === "PAR" || item.state === "todo" || item.state === "draft"),
  );
}

/** Where a Give feedback row came from, shown under the name: who asked you, or Voluntary when nobody
 * did (an offer, or Leadership 360° feedback you chose to give). */
export function feedbackSource(item: GiveFeedbackItem): string {
  const r = item.request;
  if (!r || isVoluntary(item)) return "Voluntary";
  const firstName = (item.name ?? item.email).split(/[\s@]/)[0];
  if (r.isEmployeeRequested && r.isLeadRequested) return `Requested by ${firstName} and their lead`;
  return r.isEmployeeRequested ? `Requested by ${firstName}` : "Requested by their lead";
}

/** Nobody asked you: a PAR 360° offer, or Leadership 360° feedback you chose to give. */
export function isVoluntary(item: GiveFeedbackItem): boolean {
  return !item.request || (!item.request.isEmployeeRequested && !item.request.isLeadRequested);
}
