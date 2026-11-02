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

import type { FormAnswers } from "../api/leadership360Types";

// Anonymous Leadership 360° drafts never go to the server: a server draft has to
// know who you are, which would sit next to your anonymous answers. They're kept
// in this browser instead, per signed-in person, survey and leader. Storage can
// be unavailable (private windows, blocked site data); then drafts just aren't
// kept, and nothing breaks.
const PREFIX = "par-l360-anonymous-draft";

const keyFor = (workEmail: string, surveyId: number, leaderEmail: string) =>
  `${PREFIX}:${workEmail.toLowerCase()}:${surveyId}:${leaderEmail.toLowerCase()}`;

export function readLocalDraft(workEmail: string, surveyId: number, leaderEmail: string): FormAnswers | null {
  try {
    const raw = window.localStorage.getItem(keyFor(workEmail, surveyId, leaderEmail));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as FormAnswers) : null;
  } catch {
    return null;
  }
}

/** Saves the draft; false when the browser won't keep it. */
export function writeLocalDraft(
  workEmail: string,
  surveyId: number,
  leaderEmail: string,
  answers: FormAnswers,
): boolean {
  try {
    window.localStorage.setItem(keyFor(workEmail, surveyId, leaderEmail), JSON.stringify(answers));
    return true;
  } catch {
    return false;
  }
}

export function removeLocalDraft(workEmail: string, surveyId: number, leaderEmail: string): void {
  try {
    window.localStorage.removeItem(keyFor(workEmail, surveyId, leaderEmail));
  } catch {
    // Nothing kept, nothing to remove.
  }
}

/** The leaders this person has an anonymous draft for in a survey (lower-case emails). */
export function localDraftLeaders(workEmail: string, surveyId: number): string[] {
  const prefix = `${PREFIX}:${workEmail.toLowerCase()}:${surveyId}:`;
  try {
    const leaders: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(prefix)) leaders.push(key.slice(prefix.length));
    }
    return leaders;
  } catch {
    return [];
  }
}
