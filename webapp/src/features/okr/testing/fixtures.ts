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

import type { Okr, OkrAction, OkrKeyResult } from "../api/okrTypes";

// Objectives, key results and actions for tests: an open objective of
// a@example.com's that the viewer manages, and key results due at the end of 2026.

export const testKeyResult = (over: Partial<OkrKeyResult> = {}): OkrKeyResult => ({
  keyResultId: 1,
  ownerEmail: "a@example.com",
  title: "Gross retention at 92%",
  dueDate: "2026-12-31",
  status: "NOT_STARTED",
  statusHistory: [{ status: "NOT_STARTED", changedBy: "a@example.com", changedOn: "2026-09-21T10:00:00Z" }],
  actions: [],
  canUpdate: true,
  ...over,
});

/** An objective's key results as one key result due on a day, for tests that
 * turn on when it's due. */
export const due = (dueDate: string, over: Partial<OkrKeyResult> = {}): OkrKeyResult[] => [
  testKeyResult({ dueDate, ...over }),
];

export const testAction = (over: Partial<OkrAction> = {}): OkrAction => ({
  actionId: 1,
  title: "Call the five largest accounts",
  done: false,
  commentCount: 0,
  createdBy: "a@example.com",
  createdOn: "2026-09-22T10:00:00Z",
  ...over,
});

export const testOkr = (over: Partial<Okr> = {}): Okr => ({
  okrId: 1,
  ownerEmail: "a@example.com",
  objective: "Grow enterprise retention",
  status: "OPEN",
  version: 1,
  keyResults: [],
  canManage: true,
  createdBy: "a@example.com",
  createdOn: "2026-09-21T10:00:00Z",
  updatedBy: "a@example.com",
  updatedOn: "2026-09-21T10:00:00Z",
  ...over,
});
