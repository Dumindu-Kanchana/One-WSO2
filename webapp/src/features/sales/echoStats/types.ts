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

// GET {echoBackendUrl}/admin/stats?days= — the Echo admin stats contract, as the Echo
// backend answers it. Sales admins only; anyone else gets 403.
//
// Timestamps are RFC 3339 UTC; `date` and `weekStart` are calendar dates (yyyy-MM-dd, UTC).
// Counts are integers. Rates are 0..1, and null when their denominator is 0. Every list
// arrives sorted and capped as noted, so nothing here re-sorts it.
//
// Regions: a person's region is the Sales Region found most often among the open deals they
// own on the Deals list (null when none has one); a deal's is its own Sales Region (null when
// unset). Every "by region" list reports a null region as "Unassigned".

import type { MergeStatus } from "../meddpicc/types";

/** The ranges the endpoint accepts; anything else is a 400. */
export const STATS_DAYS = [7, 30, 90] as const;
export type StatsDays = (typeof STATS_DAYS)[number];
export const DEFAULT_STATS_DAYS: StatsDays = 30;

/** How a by-region list names the deals and people with no region. */
export const UNASSIGNED_REGION = "Unassigned";

export interface StatsRange {
  from: string;
  to: string;
  days: StatsDays;
}

// ---- usage: who uses Echo --------------------------------------------------

/** The actions the Echo backend logs, one per protected route. */
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

/** Weekly active users, for the trend line beside the daily one. */
export interface UsageWeek {
  /** The Monday (UTC) the ISO week starts on, yyyy-MM-dd. Weeks touching the range, oldest first, zero-filled. */
  weekStart: string;
  users: number;
  events: number;
}

export interface UsageUser {
  email: string;
  region: string | null;
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

export interface UsageByRegion {
  region: string;
  users: number;
  events: number;
}

export interface UsageStats {
  /** The oldest usage event there is; null while there are none. Usage is only counted from here. */
  trackedSince: string | null;
  /** Distinct users with any event in range. */
  activeUsers: number;
  daily: UsageDay[];
  weekly: UsageWeek[];
  /** Most events first, max 200. */
  users: UsageUser[];
  /** Most events first. */
  byAction: UsageByAction[];
  /** Active users by their region, most users first. */
  byRegion: UsageByRegion[];
}

// ---- recording: the calls Echo can analyse ---------------------------------

export interface RecorderStats {
  email: string;
  region: string | null;
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

/** Recorded calls by the recorder's region. */
export interface RecordingByRegion {
  region: string;
  calls: number;
  analysed: number;
  recorders: number;
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
  /** Most calls first. */
  byRegion: RecordingByRegion[];
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
  region: string | null;
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

// ---- progress: how deals move ----------------------------------------------
//
// The open deals on the Deals list now, and the stage changes and closes in range, from
// Salesforce stage history.

export interface StageCount {
  stage: string;
  deals: number;
}

export type StageDirection = "FORWARD" | "BACK" | "WON" | "LOST";

export interface StageChange {
  opportunityId: string;
  name: string;
  ownerEmail: string | null;
  region: string | null;
  from: string;
  to: string;
  at: string;
  /** A StageDirection; typed as string so a newer backend's value still renders. */
  direction: string;
}

export interface ProgressByRegion {
  region: string;
  openDeals: number;
  stageChanges: number;
  closedWon: number;
  closedLost: number;
}

export interface ProgressByOwner {
  ownerEmail: string;
  region: string | null;
  openDeals: number;
  stageChanges: number;
  closedWon: number;
  closedLost: number;
}

export interface ProgressStats {
  asOf: string;
  openDeals: number;
  /** In stage order where known, else by name. */
  byStage: StageCount[];
  /** Deals whose stage changed at least once in range. */
  stageChanges: number;
  /** Of those, whose latest change in range moved to a later stage. */
  movedForward: number;
  movedBack: number;
  /** Deals that reached a won stage in range. */
  closedWon: number;
  closedLost: number;
  /** Stage changes in range, newest first, max 50. */
  changes: StageChange[];
  /** Most open deals first. */
  byRegion: ProgressByRegion[];
  /** Most open deals first, max 200. */
  byOwner: ProgressByOwner[];
}

// ---- quietDeals: open deals with no customer email in range -----------------

export interface QuietDeal {
  opportunityId: string;
  name: string;
  ownerEmail: string | null;
  region: string | null;
  stage: string;
  /** Null when no customer email was ever logged. */
  lastEmailAt: string | null;
  lastActivityAt: string | null;
  lastCallAt: string | null;
}

export interface QuietByOwner {
  ownerEmail: string;
  region: string | null;
  openDeals: number;
  quiet: number;
}

export interface QuietByRegion {
  region: string;
  openDeals: number;
  quiet: number;
}

export interface QuietDealsStats {
  asOf: string;
  openDeals: number;
  /** Of the open deals, with no customer email in range. */
  quiet: number;
  /** Max 100; never emailed first, then longest since the last email. */
  deals: QuietDeal[];
  /** Most quiet first, max 200. */
  byOwner: QuietByOwner[];
  /** Most quiet first. */
  byRegion: QuietByRegion[];
}

// ---- model: Claude usage (still sent; the page does not show it) -----------

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
  progress: ProgressStats;
  quietDeals: QuietDealsStats;
}
