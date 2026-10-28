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

// The answer for "Not observed", left out of every average.
export const NOT_OBSERVED = "NOT_OBSERVED";

// Responses an employee needs before they see their summary.
export const MIN_360_RESPONSES = 3;
// Most reviewers an employee can have (declined requests don't count).
export const MAX_360_REVIEWERS = 8;

// GET .../review-form — the caller's own feedback on one employee.
export interface Review360Form {
  template: FormTemplate;
  employeeEmail: string;
  employeeName?: string | null;
  answers: FormAnswers;
  reviewStatus: Par360ReviewStatus;
}

export interface QuestionAverage {
  questionId: string;
  average: number;
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

// GET .../review-summary — the employee's own anonymised summary.
export interface Review360Summary {
  template: FormTemplate;
  responseCount: number;
  available: boolean;
  reason?: string;
  index?: number;
  questionAverages: QuestionAverage[];
  comments: Record<string, string[]>;
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
