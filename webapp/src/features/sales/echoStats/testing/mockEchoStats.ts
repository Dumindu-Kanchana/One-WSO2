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

// A GET /admin/stats answer shaped exactly as the contract gives it, for the tests and for
// building the page before echo-backend serves it. Every list holds at least one row, so a
// render of it reaches every section; `emptyEchoAdminStats` is the opposite, a deployment
// with nothing in it yet.

import type { EchoAdminStats, StatsDays } from "../types";
import type { EchoStatsClient } from "../api/echoStatsClient";

const DAY_MS = 24 * 60 * 60 * 1000;
const TO = Date.parse("2026-11-26T10:00:00Z");

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The range the backend would answer for `days`, ending at a fixed instant. */
function rangeFor(days: StatsDays): EchoAdminStats["range"] {
  const from = Date.parse(`${isoDate(TO - days * DAY_MS)}T00:00:00Z`);
  return { from: new Date(from).toISOString().replace(".000Z", "Z"), to: "2026-11-26T10:00:00Z", days };
}

/** One entry per day in range, oldest first; quiet weekends, as a real month would be. */
function dailyFor(days: StatsDays): EchoAdminStats["usage"]["daily"] {
  return Array.from({ length: days + 1 }, (_, index) => {
    const ms = TO - (days - index) * DAY_MS;
    const weekday = new Date(ms).getUTCDay();
    const quiet = weekday === 0 || weekday === 6;
    const users = quiet ? 0 : 3 + (index % 5);
    return { date: isoDate(ms), users, events: users * 7 };
  });
}

export function mockEchoAdminStats(days: StatsDays = 30): EchoAdminStats {
  return {
    range: rangeFor(days),
    usage: {
      trackedSince: "2026-11-20T09:00:00Z",
      activeUsers: 12,
      daily: dailyFor(days),
      users: [
        {
          email: "nadia@wso2.com",
          lastSeen: "2026-11-26T09:12:00Z",
          events: 1240,
          dealViews: 620,
          approvals: 31,
          rejections: 4,
          asks: 18,
          reanalyses: 2,
        },
        {
          email: "kasun@wso2.com",
          lastSeen: "2026-11-25T16:40:00Z",
          events: 40,
          dealViews: 20,
          approvals: 3,
          rejections: 1,
          asks: 5,
          reanalyses: 0,
        },
      ],
      byAction: [
        { action: "deal.view", events: 640, users: 9 },
        { action: "deals.list", events: 410, users: 11 },
        { action: "deal.approve", events: 34, users: 6 },
      ],
    },
    recording: {
      calls: 1285,
      withTranscript: 70,
      analysed: 66,
      failed: 2,
      emptyTranscript: 3,
      recorders: 9,
      byRecorder: [
        { email: "nadia@wso2.com", calls: 14, withTranscript: 12, analysed: 12, lastCallAt: "2026-11-25T14:00:00Z" },
        { email: "kasun@wso2.com", calls: 9, withTranscript: 7, analysed: 6, lastCallAt: "2026-11-24T08:30:00Z" },
      ],
      byMeetingType: [
        { type: "Discovery Call", calls: 30 },
        { type: "Unspecified", calls: 11 },
      ],
      weekly: [
        { weekStart: "2026-11-16", calls: 22, analysed: 19 },
        { weekStart: "2026-11-23", calls: 20, analysed: 17 },
      ],
    },
    decisions: {
      approved: 120,
      edited: 30,
      rejected: 15,
      pending: 48,
      approvedAsIsRate: 0.727,
      byField: [
        {
          fieldKey: "economicBuyer",
          label: "Economic Buyer",
          approved: 10,
          edited: 4,
          rejected: 2,
          pending: 3,
          approvedAsIsRate: 0.625,
        },
        // Only pending: nothing decided yet, so there is no rate to give.
        {
          fieldKey: "paperProcess",
          label: "Paper Process",
          approved: 0,
          edited: 0,
          rejected: 0,
          pending: 6,
          approvedAsIsRate: null,
        },
      ],
      rejectReasons: [
        { reason: "WRONG_VALUE", count: 7 },
        { reason: "NOT_SUPPORTED", count: 5 },
        // Stored without a reason; the backend can send it though the dialog never offers it.
        { reason: "UNSPECIFIED", count: 1 },
      ],
      byConfidence: [
        { band: "0.6-0.7", decided: 12, approvedAsIsRate: 0.5 },
        { band: "0.8-0.9", decided: 40, approvedAsIsRate: 0.85 },
      ],
      byMergeStatus: [
        { mergeStatus: "SINGLE", decided: 100, approvedAsIsRate: 0.8 },
        { mergeStatus: "MERGED", decided: 50, approvedAsIsRate: 0.62 },
        { mergeStatus: "FALLBACK", decided: 15, approvedAsIsRate: 0.4 },
      ],
      byUser: [
        { email: "nadia@wso2.com", approved: 10, edited: 2, rejected: 1 },
        { email: "kasun@wso2.com", approved: 4, edited: 1, rejected: 0 },
      ],
    },
    salesforce: {
      asOf: "2026-11-26T10:00:00Z",
      deals: 40,
      fieldsInScope: 360,
      fieldsFilled: 150,
      fieldsMissing: 210,
      fillRate: 0.417,
      echoCanFill: 60,
      byField: [
        { fieldKey: "paperProcess", label: "Paper Process", dealsInScope: 30, filled: 5, missing: 25, echoProposed: 8 },
        { fieldKey: "metrics", label: "Metrics", dealsInScope: 40, filled: 28, missing: 12, echoProposed: 4 },
      ],
      dealsWithMostGaps: [
        {
          opportunityId: "006MOCK0000HARB",
          name: "Harbourline – API platform",
          ownerEmail: "nadia@wso2.com",
          stage: "Qualify",
          inScope: 12,
          missing: 9,
          echoProposed: 3,
        },
      ],
    },
    model: {
      calls: 400,
      failed: 3,
      inputTokens: 9000000,
      outputTokens: 400000,
      cacheReadTokens: 2000000,
      cacheWriteTokens: 900000,
      byPurpose: [
        {
          purpose: "call.vote",
          calls: 200,
          failed: 1,
          inputTokens: 6000000,
          outputTokens: 300000,
          cacheReadTokens: 1500000,
        },
      ],
    },
  };
}

/** A deployment with nothing in it yet: no usage, no calls, no decisions, no open deals. */
export function emptyEchoAdminStats(days: StatsDays = 30): EchoAdminStats {
  return {
    range: rangeFor(days),
    usage: { trackedSince: null, activeUsers: 0, daily: dailyFor(days).map((d) => ({ ...d, users: 0, events: 0 })), users: [], byAction: [] },
    recording: {
      calls: 0,
      withTranscript: 0,
      analysed: 0,
      failed: 0,
      emptyTranscript: 0,
      recorders: 0,
      byRecorder: [],
      byMeetingType: [],
      weekly: [],
    },
    decisions: {
      approved: 0,
      edited: 0,
      rejected: 0,
      pending: 0,
      approvedAsIsRate: null,
      byField: [],
      rejectReasons: [],
      byConfidence: [],
      byMergeStatus: [],
      byUser: [],
    },
    salesforce: {
      asOf: "2026-11-26T10:00:00Z",
      deals: 0,
      fieldsInScope: 0,
      fieldsFilled: 0,
      fieldsMissing: 0,
      fillRate: null,
      echoCanFill: 0,
      byField: [],
      dealsWithMostGaps: [],
    },
    model: {
      calls: 0,
      failed: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      byPurpose: [],
    },
  };
}

/** The demo implementation of GET /admin/stats. */
export const mockEchoStatsClient: EchoStatsClient = {
  adminStats: async (days) => structuredClone(mockEchoAdminStats(days)),
};
