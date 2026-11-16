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

export function isQuestionAnswered(question: FormQuestion, answers: SelfReviewAnswers): boolean {
  const value = answers[question.id];
  return typeof value === "string" && value.trim() !== "";
}

export function isSectionAnswered(section: FormSection, answers: SelfReviewAnswers): boolean {
  return section.questions.some((q) => isQuestionAnswered(q, answers));
}

// What still stops the employee sharing: required sections left empty. Each
// entry names the section, for the message.
export function shareBlockers(definition: FormDefinition, answers: SelfReviewAnswers): string[] {
  const blockers: string[] = [];
  for (const section of definition.sections) {
    for (const q of section.questions) {
      if (q.required && !isQuestionAnswered(q, answers)) blockers.push(`${section.title} is empty`);
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
