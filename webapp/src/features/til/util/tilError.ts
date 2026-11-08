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

// Shared error helpers for the til feature — same arrangement menu/leave use.
import { describeError, httpRetry, isNetworkFailure } from "@api/errors";
import { HttpError } from "@api/http";

export { describeError, isNetworkFailure };

/** No retries on 4xx — a 403 (not in the submitting... group) is a final answer. */
export const tilRetry = httpRetry;

/** True when a single entry wasn't found (deleted, or a bad/stale link) —
 * same shape as Sales' own isForbidden, one status code read off HttpError. */
export function isNotFound(error: unknown): boolean {
  return error instanceof HttpError && error.status === 404;
}

/** What to say under the form when saving an entry failed on the network,
 * or undefined when it failed some other way. Short of being offline, the
 * likeliest cause is a filter on the way that refuses text looking like a
 * shell command (a curl line, a path such as /dev/null) before the request
 * reaches the backend. That refusal carries no CORS headers, so all the page
 * ever sees is the browser's own "Failed to fetch". A connection lost after
 * the server saved the entry fails the same way, offline included, so no
 * message says it wasn't saved. Saving an edit again only writes the same
 * thing twice, but sharing a new entry again would post it twice. For a new
 * entry the feed is fetched again and the dialog keeps the draft through a
 * close, so its author can check the feed first. */
export function unsentEntryMessage(error: unknown, editing: boolean): string | undefined {
  if (!isNetworkFailure(error)) return undefined;
  const lost = editing ? "this may not have been saved" : "this may not have been shared";
  const next = editing
    ? "Saving it again is safe."
    : "Check the feed before sharing it again: what you wrote stays here if you close this.";
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return `You seem to be offline, so ${lost}. Check your connection. ${next}`;
  }
  return (
    `The connection to the server failed, so ${lost}. ${next} Text that looks like a command, such as a curl ` +
    "line or a file path, can be blocked on the way: reword or remove it before trying again."
  );
}
