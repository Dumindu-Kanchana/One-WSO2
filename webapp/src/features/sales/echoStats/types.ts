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

// GET {echoBackendUrl}/admin/stats?days= — the Echo admin stats contract, as echo-backend
// answers it. Sales admins only; anyone else gets 403.
//
// Timestamps are RFC 3339 UTC; `date` and `weekStart` are calendar dates (yyyy-MM-dd, UTC).
// Counts are integers. Rates are 0..1, and null when their denominator is 0. Every list
// arrives sorted and capped as noted, so nothing here re-sorts it.

import type { MergeStatus } from "../meddpicc/types";

/** The ranges the endpoint accepts; anything else is a 400. */
export const STATS_DAYS = [7, 30, 90] as const;
export type StatsDays = (typeof STATS_DAYS)[number];
export const DEFAULT_STATS_DAYS: StatsDays = 30;

export interface StatsRange {
  from: string;
  to: string;
  days: StatsDays;
}

// ---- usage: who uses Echo --------------------------------------------------

/** The actions echo-backend logs, one per protected route. */
export type UsageAction =
  | "deals.list"
  | "deal.view"
  | "deal.approve"
  | "deal.reject"
  | "deal.ask"
  | "deal.move_stage"
  | "deal.include_calls"
  | "meetings.coverage"
  | "meeting.reanalyse"
  | "admin.stats";

export interface UsageDay {
  /** yyyy-MM-dd. One per day in range, oldest first, zero-filled. */
  date: string;
  users: number;
  events: number;
}

export interface UsageUser {
  email: string;
  lastSeen: string;
  /** Every action. */
  events: number;
  dealViews: number;
  approvals: number;
  rejections: number;
  asks: number;
  reanalyses: number;
}

export interface UsageByAction {
  /** A UsageAction; typed as string so a newer backend's action still renders. */
  action: string;
  events: number;
  users: number;
}

export interface UsageStats {
  /** The oldest usage event there is; null while there are none. Usage is only counted from here. */
  trackedSince: string | null;
  /** Distinct users with any event in range. */
  activeUsers: number;
  daily: UsageDay[];
  /** Most events first, max 200. */
  users: UsageUser[];
  /** Most events first. */
  byAction: UsageByAction[];
}

// ---- recording: the calls Echo can analyse ---------------------------------

export interface RecorderStats {
  email: string;
  calls: number;
  withTranscript: number;
  analysed: number;
  lastCallAt: string | null;
}

export interface MeetingTypeStats {
  /** "Unspecified" when the meeting has no type. */
  type: string;
  calls: number;
}

export interface RecordingWeek {
  /** The Monday (UTC) the ISO week starts on, yyyy-MM-dd. Oldest first. */
  weekStart: string;
  calls: number;
  analysed: number;
}

export interface RecordingStats {
  /** Sales calls held in range: active, and not of an internal type. */
  calls: number;
  withTranscript: number;
  /** With a DONE run on the current transcript. */
  analysed: number;
  /** Latest run of the current transcript FAILED, for a reason other than an empty transcript. */
  failed: number;
  /** Latest run failed because the transcript had no lines. */
  emptyTranscript: number;
  /** Distinct hosts. */
  recorders: number;
  /** Most calls first, max 200. */
  byRecorder: RecorderStats[];
  /** Most calls first. */
  byMeetingType: MeetingTypeStats[];
  weekly: RecordingWeek[];
}

// ---- decisions: what AMs did with Echo's suggestions -----------------------

export interface FieldDecisions {
  fieldKey: string;
  label: string;
  approved: number;
  edited: number;
  rejected: number;
  pending: number;
  approvedAsIsRate: number | null;
}

export interface RejectReasonCount {
  /** A RejectReason; typed as string so a newer backend's reason still renders. */
  reason: string;
  count: number;
}

export interface ConfidenceBand {
  /** "0.0-0.1" … "0.9-1.0", ascending; only bands with decisions. */
  band: string;
  decided: number;
  approvedAsIsRate: number | null;
}

export interface MergeStatusDecisions {
  mergeStatus: MergeStatus;
  decided: number;
  approvedAsIsRate: number | null;
}

export interface UserDecisions {
  email: string;
  approved: number;
  edited: number;
  rejected: number;
}

export interface DecisionStats {
  /** Approved as proposed. */
  approved: number;
  /** Approved with a changed value. */
  edited: number;
  rejected: number;
  /** Proposals waiting now; not bound to the range. */
  pending: number;
  /** approved / (approved + edited + rejected). */
  approvedAsIsRate: number | null;
  /** Most decided first. */
  byField: FieldDecisions[];
  /** Most first. */
  rejectReasons: RejectReasonCount[];
  byConfidence: ConfidenceBand[];
  byMergeStatus: MergeStatusDecisions[];
  /** Most decisions first, max 200. */
  byUser: UserDecisions[];
}

// ---- salesforce: MEDDPICC completeness of the open deals, now ---------------

export interface SalesforceFieldGaps {
  fieldKey: string;
  label: string;
  dealsInScope: number;
  filled: number;
  missing: number;
  /** Missing, with a PROPOSED Echo suggestion waiting for the AM. */
  echoProposed: number;
}

export interface DealGaps {
  opportunityId: string;
  name: string;
  ownerEmail: string | null;
  stage: string;
  inScope: number;
  missing: number;
  echoProposed: number;
}

export interface SalesforceStats {
  asOf: string;
  /** Open deals on Echo's Opportunities list. */
  deals: number;
  fieldsInScope: number;
  fieldsFilled: number;
  fieldsMissing: number;
  fillRate: number | null;
  echoCanFill: number;
  /** Most missing first. */
  byField: SalesforceFieldGaps[];
  /** Most missing first, max 25. */
  dealsWithMostGaps: DealGaps[];
}

// ---- model: Claude usage ---------------------------------------------------

export interface ModelPurposeStats {
  purpose: string;
  calls: number;
  failed: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}

export interface ModelStats {
  calls: number;
  failed: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** Most input tokens first. */
  byPurpose: ModelPurposeStats[];
}

export interface EchoAdminStats {
  range: StatsRange;
  usage: UsageStats;
  recording: RecordingStats;
  decisions: DecisionStats;
  salesforce: SalesforceStats;
  model: ModelStats;
}
