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

// Shapes of the PAR backend's structured 360° endpoints (Review360* in
// modules/types/forms.bal).
import type { FormAnswers, FormTemplate } from "./leadership360Types";
import type { Par360ReviewStatus } from "./types";

export type ParCycleFormKind = "SELF_REVIEW" | "PEER_360";

// Responses an employee needs before they see their summary.
export const MIN_360_RESPONSES = 3;

// How a reviewer works with the employee, picked by whoever asks for the feedback (the 360° form's
// relationship question, answered on the request).
export const REVIEW_360_RELATIONSHIPS = [
  { value: "PEER", label: "Peer" },
  { value: "CROSS_TEAM", label: "Cross-team" },
] as const;

export function relationshipLabel(value: string | null | undefined): string | undefined {
  return REVIEW_360_RELATIONSHIPS.find((r) => r.value === value)?.label;
}

// GET .../review-form — the caller's own feedback on one employee.
export interface Review360Form {
  template: FormTemplate;
  employeeEmail: string;
  employeeName?: string | null;
  answers: FormAnswers;
  reviewStatus: Par360ReviewStatus;
  // Answers given when the feedback was asked for (the relationship), not asked again.
  requestAnswers?: FormAnswers;
}

// A behaviour's average. The employee's own summary gives no counts.
export interface SummaryAverage {
  questionId: string;
  average: number;
  ratingCount?: number;
}

export interface QuestionAverage extends SummaryAverage {
  ratingCount: number;
}

export interface Review360Response {
  reviewerEmail: string;
  reviewerName?: string | null;
  answers: FormAnswers;
}

// GET .../review-responses — for the employee's lead, report chain and PAR admins.
export interface Review360Responses {
  template: FormTemplate;
  responseCount: number;
  index?: number;
  teamIndex?: number;
  teamMembersWithResponses: number;
  questionAverages: QuestionAverage[];
  responses: Review360Response[];
}

// GET .../review-summary — the employee's own anonymised summary: averages only, never comments
// or counts. The averages include feedback offered unasked, whose reviewers the employee's list
// leaves out, so a count could show that someone not on it responded.
export interface Review360Summary {
  template: FormTemplate;
  available: boolean;
  reason?: string;
  index?: number;
  questionAverages: SummaryAverage[];
}

export interface Review360Index {
  employeeEmail: string;
  responseCount: number;
  index?: number;
}

// GET /par-cycles/{id}/review-indexes?leadEmail=
export interface Review360TeamIndexes {
  teamIndex?: number;
  members: Review360Index[];
}

// GET .../reviewer-suggestions — people to ask, from the employee's calendar.
// The screens show the names only; the counts and the date come only in the
// employee's own response and aren't shown.
export interface ReviewerSuggestion {
  workEmail: string;
  employeeName: string;
  meetingsTogether?: number;
}

export interface ReviewerSuggestions {
  // The first day of the meetings counted (YYYY-MM-DD).
  meetingsSince: string;
  // Most met first.
  suggestions: ReviewerSuggestion[];
}
