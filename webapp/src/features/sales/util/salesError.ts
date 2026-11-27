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

// Shared error helpers for the Echo feature, re-exported so call sites keep a
// short import — the same arrangement menu, leave and finance use.
//
// `describeError` prefers the server's own `{message}`. That matters here
// because the meet-app backend explains refusals in full sentences ("Insufficient
// privileges to view the attachments!"), and discarding those in favour of a
// generic line would leave someone unable to tell a permission problem from an
// outage.
import { HttpError, RequestTimeoutError } from "@api/http";
import { describeError, httpRetry } from "@api/errors";

export { describeError };

/** No retries on 4xx — a 403 on someone else's meeting will not improve. */
export const salesRetry = httpRetry;

/**
 * How long an Echo read waits for an answer before giving up and retrying.
 *
 * The backends answer in well under a second, and a cold deal read that goes to
 * Salesforce takes a few. What this is for is the request the API gateway holds
 * for a minute or more before forwarding it, then answers fine on a second try:
 * without a limit, the meeting page waited 60–125 s on one of those. Reads only;
 * a write is never abandoned (see RequestOptions in @api/http).
 */
export const ECHO_READ_TIMEOUT_MS = 15_000;

/** The options every Echo read passes to authedGet / a reading authedPost. */
export const echoRead = { timeoutMs: ECHO_READ_TIMEOUT_MS } as const;

/**
 * For the queries that otherwise never retry — their failures (404 nothing
 * attached, 403 not yours) are final — one retry when the request timed out,
 * which says nothing about the answer.
 */
export function retryOnTimeout(failureCount: number, error: unknown): boolean {
  return error instanceof RequestTimeoutError && failureCount < 1;
}

/**
 * True when the failure is the backend refusing this caller outright.
 *
 * The service answers 403 on every endpoint for a caller in no authorised
 * group, so a single 403 is enough to conclude the whole app is unavailable to
 * them and show one explanation rather than an error per panel.
 */
export function isForbidden(error: unknown): boolean {
  return error instanceof HttpError && error.status === 403;
}
