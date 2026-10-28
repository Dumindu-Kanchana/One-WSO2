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

import type { FormDefinition, FormQuestion, FormScale } from "../api/leadership360Types";
import type { QuestionAverage } from "../api/review360Types";

/** Every rating of a scale with its label: the template's own, else just the number. */
export function ratingLabels(scale: FormScale): { value: number; label: string }[] {
  return Array.from({ length: scale.max - scale.min + 1 }, (_, i) => {
    const value = scale.min + i;
    const label = scale.labels?.[i] ?? (value === scale.min ? scale.minLabel : value === scale.max ? scale.maxLabel : "");
    return { value, label: label ?? "" };
  });
}

/** One decimal, the way the index is shown everywhere. */
export function formatIndex(value: number | undefined): string {
  return value === undefined ? "–" : value.toFixed(1);
}

/** The rated questions (the behaviours), in template order. */
export function ratedQuestions(definition: FormDefinition): FormQuestion[] {
  return definition.sections.flatMap((s) => s.questions).filter((q) => q.type === "RATING");
}

/** The written questions (keep / start / stop), in template order. */
export function textQuestions(definition: FormDefinition): FormQuestion[] {
  return definition.sections.flatMap((s) => s.questions).filter((q) => q.type === "TEXT");
}

/** Each behaviour with its average, in template order; behaviours nobody rated have none. */
export function behaviourAverages(
  definition: FormDefinition,
  averages: QuestionAverage[],
): { question: FormQuestion; average?: number; ratingCount: number }[] {
  const byId = new Map(averages.map((a) => [a.questionId, a]));
  return ratedQuestions(definition).map((question) => ({
    question,
    average: byId.get(question.id)?.average,
    ratingCount: byId.get(question.id)?.ratingCount ?? 0,
  }));
}

/** How the index compares with the team's, in words for the guidance line. */
export function indexComparison(index: number | undefined, teamIndex: number | undefined): string | undefined {
  if (index === undefined || teamIndex === undefined) return undefined;
  // Compared as shown (one decimal), so the words never contradict the numbers beside them.
  const diff = Math.round((Number(formatIndex(index)) - Number(formatIndex(teamIndex))) * 10) / 10;
  if (diff === 0) return "in line with the team";
  return `${Math.abs(diff).toFixed(1)} ${diff > 0 ? "above" : "below"} the team average`;
}
