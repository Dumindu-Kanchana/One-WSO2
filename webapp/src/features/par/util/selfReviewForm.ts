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

import type { FormDefinition, FormQuestion, FormSection } from "../api/leadership360Types";
import type { SelfReviewAnswers } from "../api/selfReviewTypes";
import { isEmptyHtml, paragraphsToHtml } from "./parComment";

/** The backend's limit on an answer when its question sets none (FORM_TEXT_MAX_LENGTH). */
const DEFAULT_ANSWER_MAX_LENGTH = 5000;

// Answers are written in the rich-text editor, so they're HTML, which starts with one of the editor's blocks. An
// answer saved before then is plain text: it's shown, and edited, as one paragraph per line.
const HTML_ANSWER = /^\s*<(p|ol|ul|h[1-6]|blockquote|pre)[\s>]/i;

/** An answer as rich-text HTML (not yet sanitized). HTML is passed through as it is, so the editor gets back
 * exactly what it sent out. */
export function answerHtml(value: string | null | undefined): string {
  const answer = value ?? "";
  return HTML_ANSWER.test(answer) ? answer : paragraphsToHtml(answer);
}

/** An answer for a read-only view or the PDF, which decode entities before sanitizing (sanitizeParHtml): a plain-text
 * answer is escaped once more, so text such as "<b>" still shows as it was written. */
export function answerViewHtml(value: string | null | undefined): string {
  const answer = value ?? "";
  return HTML_ANSWER.test(answer) ? answer : paragraphsToHtml(answer).replace(/&/g, "&amp;");
}

export function isQuestionAnswered(question: FormQuestion, answers: SelfReviewAnswers): boolean {
  const value = answers[question.id];
  return typeof value === "string" && !isEmptyHtml(answerHtml(value));
}

/** How many characters an answer is over its question's limit, or 0. The backend counts the HTML, so its
 * formatting counts too. */
export function answerOverLimit(question: FormQuestion, answers: SelfReviewAnswers): number {
  const value = answers[question.id];
  if (typeof value !== "string" || !isQuestionAnswered(question, answers)) return 0;
  return Math.max(0, value.length - (question.maxLength ?? DEFAULT_ANSWER_MAX_LENGTH));
}

/** Whether any answer is over its limit, which the backend refuses to save. */
export function anyAnswerOverLimit(definition: FormDefinition, answers: SelfReviewAnswers): boolean {
  return definition.sections.some((s) => s.questions.some((q) => answerOverLimit(q, answers) > 0));
}

export function isSectionAnswered(section: FormSection, answers: SelfReviewAnswers): boolean {
  return section.questions.some((q) => isQuestionAnswered(q, answers));
}

// What still stops the employee sharing: required sections left empty, and answers over their limit. Each
// entry names the section, for the message.
export function shareBlockers(definition: FormDefinition, answers: SelfReviewAnswers): string[] {
  const blockers: string[] = [];
  for (const section of definition.sections) {
    for (const q of section.questions) {
      if (q.required && !isQuestionAnswered(q, answers)) blockers.push(`${section.title} is empty`);
      else if (answerOverLimit(q, answers) > 0) blockers.push(`${section.title} is too long`);
    }
  }
  return blockers;
}

// What gets saved: the answers that have some text.
export function answersToSave(definition: FormDefinition, answers: SelfReviewAnswers): SelfReviewAnswers {
  const saved: SelfReviewAnswers = {};
  for (const section of definition.sections) {
    for (const q of section.questions) {
      if (isQuestionAnswered(q, answers)) saved[q.id] = answers[q.id];
    }
  }
  return saved;
}
