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

import { isNetworkFailure } from "@api/errors";
import { HttpError } from "@api/http";

/** What the Library was doing when it failed: the words used for it depend on that. */
export type LibraryTask = "search" | "answer" | "write";

export type FailureKind = "offline" | "unreachable" | "slow" | "busy" | "signin" | "denied" | "missing" | "down" | "other";

export interface LibraryFailure {
  readonly kind: FailureKind;
  /** A sentence for the reader: what happened, and what to do about it. Never a status code or a browser's own wording. */
  readonly message: string;
  /** Whether trying again can help. A sign-in that ended or a refusal will not change on a second try. */
  readonly retryable: boolean;
}

/** Thrown when a request is still unanswered after the time it was given, so the page stops waiting for it. */
export class RequestTimeoutError extends Error {
  constructor() {
    super("The request took too long.");
    this.name = "RequestTimeoutError";
  }
}

const WORDS: Record<LibraryTask, { slow: string; busy: string; down: string; other: string; missing: string }> = {
  search: {
    slow: "The search is taking longer than usual, so we stopped waiting. Please try again in a moment.",
    busy: "You've searched a lot in a short time. Wait a minute, then try again.",
    down: "Search isn't responding right now. Please try again in a few minutes.",
    other: "Couldn't run that search just now. Please try again.",
    missing: "We couldn't find that. Please search again.",
  },
  answer: {
    slow: "The written answer took too long, so we stopped waiting.",
    busy: "The written answer is paused because you've searched a lot.",
    down: "The written answer isn't available right now.",
    other: "The written answer isn't available right now.",
    missing: "The written answer isn't available right now.",
  },
  write: {
    slow: "Writing that is taking longer than usual, so we stopped waiting. The service may be busy - try again in a moment.",
    busy: "Too many messages are being written right now. Wait a minute, then try again.",
    down: "The writing service isn't responding right now. Please try again in a few minutes.",
    other: "Couldn't write that just now. Please try again.",
    missing: "These results aren't in your search any more. Search again, then try this.",
  },
};

/**
 * Turns whatever went wrong into one plain sentence, so a slow or unreachable service is told to the reader in words
 * they can act on: wait, check the connection, try later, or sign in again.
 */
export function describeLibraryFailure(error: unknown, task: LibraryTask): LibraryFailure {
  const words = WORDS[task];
  if (error instanceof RequestTimeoutError || (error instanceof Error && error.name === "TimeoutError")) {
    return { kind: "slow", message: words.slow, retryable: true };
  }
  if (error instanceof HttpError) {
    const { status } = error;
    if (status === 401) {
      return { kind: "signin", message: "Your sign-in has ended. Reload the page to sign in again.", retryable: false };
    }
    if (status === 403) return { kind: "denied", message: "You don't have access to this.", retryable: false };
    if (status === 404) return { kind: "missing", message: words.missing, retryable: true };
    if (status === 408 || status === 504) return { kind: "slow", message: words.slow, retryable: true };
    if (status === 429) return { kind: "busy", message: words.busy, retryable: true };
    if (status === 502 || status === 503) return { kind: "down", message: words.down, retryable: true };
    return { kind: "other", message: words.other, retryable: true };
  }
  if (isNetworkFailure(error)) {
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    return offline
      ? { kind: "offline", message: "You seem to be offline. Check your connection, then try again.", retryable: true }
      : {
          kind: "unreachable",
          message: "We couldn't reach the server. Check your connection, then try again in a moment.",
          retryable: true,
        };
  }
  return { kind: "other", message: words.other, retryable: true };
}
