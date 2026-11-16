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

/** Where an objective stands: being worked on, achieved, or no longer pursued. */
export type OkrStatus = "OPEN" | "COMPLETED" | "CLOSED";

export const KEY_RESULT_STATUSES = ["NOT_STARTED", "AT_RISK", "IN_PROGRESS", "ON_TRACK", "COMPLETED"] as const;
export type KeyResultStatus = (typeof KEY_RESULT_STATUSES)[number];

export const OKR_OBJECTIVE_MAX_LENGTH = 300;
export const OKR_KEY_RESULT_MAX_LENGTH = 200;
export const OKR_MEASURE_MAX_LENGTH = 50;
export const OKR_ACTION_MAX_LENGTH = 300;
export const OKR_COMMENT_MAX_LENGTH = 2000;
export const OKR_CLOSE_REASON_MAX_LENGTH = 500;

/** A status a key result had, and who set it when. */
export interface OkrStatusChange {
  status: KeyResultStatus;
  changedBy: string;
  /** UTC */
  changedOn: string;
}

/** An initiative or action towards a key result. */
export interface OkrAction {
  actionId: number;
  title: string;
  done: boolean;
  doneBy?: string;
  doneOn?: string;
  commentCount: number;
  createdBy: string;
  createdOn: string;
}

export interface OkrKeyResult {
  keyResultId: number;
  ownerEmail: string;
  ownerName?: string;
  title: string;
  baseline?: string;
  target?: string;
  /** YYYY-MM-DD */
  dueDate: string;
  status: KeyResultStatus;
  /** Oldest first; the first is from when it was added. */
  statusHistory: OkrStatusChange[];
  actions: OkrAction[];
  /** Whether you may change its status and measure and work on its actions:
   * you own it, or you manage the objective. */
  canUpdate: boolean;
  /** In your team's list: whether its owner is in your team. */
  ownerInTeam?: boolean;
}

/** An objective owned by one person, with key results for them or their team.
 * It has no due date: each key result has its own. */
export interface Okr {
  okrId: number;
  ownerEmail: string;
  ownerName?: string;
  ownerLeadEmail?: string;
  objective: string;
  status: OkrStatus;
  closeReason?: string;
  statusChangedBy?: string;
  statusChangedOn?: string;
  /** Sent back with a change, so one someone made meanwhile isn't overwritten. */
  version: number;
  keyResults: OkrKeyResult[];
  /** Whether you may change the objective and all its key results: you own
   * it, lead its owner, or are a People Ops admin. */
  canManage: boolean;
  /** In your team's list: whether its owner is in your team. */
  ownerInTeam?: boolean;
  createdBy: string;
  createdOn: string;
  updatedBy: string;
  updatedOn: string;
}

export interface OkrComment {
  commentId: number;
  comment: string;
  createdBy: string;
  authorName?: string;
  createdOn: string;
}

/** Someone a key result can be given to. */
export interface OkrPerson {
  workEmail: string;
  name: string;
  jobRole?: string;
  thumbnail?: string;
}

/** A key result as entered; an existing one carries its ID. */
export interface KeyResultEntry {
  keyResultId?: number;
  title: string;
  ownerEmail?: string;
  baseline?: string;
  target?: string;
  /** YYYY-MM-DD */
  dueDate: string;
}

export interface OkrCreate {
  /** Yours when left out. */
  ownerEmail?: string;
  objective: string;
  keyResults: KeyResultEntry[];
}

export interface OkrUpdate {
  version: number;
  objective?: string;
  /** All of them: ones left out are removed. */
  keyResults?: KeyResultEntry[];
}

/** A list of OKRs: your team's (objectives owned by someone in your reporting
 * chain, and those with a key result of such a person's), or (People Ops
 * admins) everyone's. */
export type OkrScope = "team" | "all";
