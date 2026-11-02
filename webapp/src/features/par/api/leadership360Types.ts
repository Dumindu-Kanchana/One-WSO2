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

// Shapes of the PAR backend's form and Leadership 360° endpoints (modules/types/forms.bal).

export type FormQuestionType = "RATING" | "TEXT" | "CHOICE" | "GOALS";

export interface FormScale {
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
  // A label for every rating from min to max.
  labels?: string[];
  allowNotObserved?: boolean;
}

export interface FormChoiceOption {
  value: string;
  label: string;
}

export interface FormQuestion {
  id: string;
  type: FormQuestionType;
  text: string;
  // Short explanation under the question.
  hint?: string;
  required?: boolean;
  scale?: string;
  options?: FormChoiceOption[];
  maxLength?: number;
  // Example text shown in an empty answer (TEXT).
  placeholder?: string;
  // Most goals accepted (GOALS); a goal's statuses are its `options`.
  maxItems?: number;
  // Reported only in aggregate, never per response.
  aggregateOnly?: boolean;
}

export interface FormSection {
  id: string;
  title: string;
  hint?: string;
  // "HEADER" renders the section above the steps instead of as a step.
  display?: string;
  questions: FormQuestion[];
}

export interface FormDefinition {
  kind: string;
  version: number;
  title: string;
  scales: Record<string, FormScale>;
  sections: FormSection[];
}

export interface FormTemplate {
  formTemplateId: number;
  formKind: string;
  formVersion: number;
  definition: FormDefinition;
}

// Answers keyed by question id: a rating number or a text/choice string.
export type FormAnswers = Record<string, number | string | null>;

export type Leadership360SurveyStatus = "UPCOMING" | "OPEN" | "CLOSED";

// A PAR 2.0 cycle's survey runs on the cycle's 360° dates; the pilot has no cycle.
export interface Leadership360Survey {
  surveyId: number;
  surveyName: string;
  formTemplateId: number;
  parCycleId?: number;
  startDate: string;
  endDate: string;
  status: Leadership360SurveyStatus;
}

export interface Leadership360CurrentSurvey {
  survey: Leadership360Survey;
  template: FormTemplate;
}

export interface Leadership360Leader {
  workEmail: string;
  employeeName: string;
  jobRole: string | null;
  employeeThumbnail: string | null;
}

export interface Leadership360FeedbackInput {
  leaderEmail: string;
  answers: FormAnswers;
  anonymous: boolean;
}

// A named draft saved on the server (anonymous drafts stay in the browser).
export type Leadership360Draft = Leadership360FeedbackInput;

export interface Leadership360NamedGiven {
  leaderEmail: string;
  submittedOn: string;
}

export interface Leadership360AnonymousGiven {
  leaderEmail: string;
  // YYYY-MM
  month: string;
}

export interface Leadership360MyFeedback {
  drafts: Leadership360Draft[];
  // Newest first.
  named: Leadership360NamedGiven[];
  anonymous: Leadership360AnonymousGiven[];
  // YYYY-MM: anonymous feedback on a leader is allowed once in it.
  currentMonth: string;
}

export interface FormQuestionAverage {
  questionId: string;
  average: number;
  ratingCount: number;
}

export interface Leadership360NamedResponse {
  respondentEmail: string;
  respondentName: string | null;
  submittedOn: string | null;
  // The respondent's latest response, the one whose scores count.
  latest: boolean;
  answers: FormAnswers;
}

export interface Leadership360NamedComment {
  respondentEmail: string;
  respondentName: string | null;
  comment: string;
}

export interface Leadership360Summary {
  leaderEmail: string;
  // Responses that count: each anonymous one, and each named person once.
  responseCount: number;
  available: boolean;
  reason?: string;
  overallAverage?: number;
  questionAverages: FormQuestionAverage[];
  // From anonymous feedback.
  comments: string[];
  // From named feedback, shown with their author.
  namedComments: Leadership360NamedComment[];
  // PAR admins only.
  relationshipCounts?: Record<string, number>;
  // PAR admins and the leader's manager only.
  namedResponses?: Leadership360NamedResponse[];
}

export interface Leadership360ResultsEntry {
  leader: Leadership360Leader;
  // Responses that count: each anonymous one, and each named person once.
  responseCount: number;
  available: boolean;
}

// Which screen reads results, which sets the role the backend answers in:
// your own (Me), the leaders who report to you (Lead View), or every leader
// (Admin View, PAR admins only).
export type Leadership360View = "SELF" | "REPORTS" | "ALL";
