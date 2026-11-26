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

import { describe, expect, it } from "vitest";
import { STATS_DAYS, UNASSIGNED_REGION } from "../types";
import { weekStartOf } from "../util/statsFormat";
import { emptyEchoAdminStats, mockEchoAdminStats } from "./mockEchoStats";

// The demo response is what the screenshots and the page tests show, so its figures must
// agree with each other the way the backend's do, in every range.

const sum = <T>(rows: readonly T[], of: (row: T) => number) => rows.reduce((total, row) => total + of(row), 0);

describe.each(STATS_DAYS)("mockEchoAdminStats(%i)", (days) => {
  const stats = mockEchoAdminStats(days);

  it("covers the range asked for, one day per entry and the weeks touching it", () => {
    expect(stats.range.days).toBe(days);
    expect(stats.usage.daily).toHaveLength(days + 1);
    expect(stats.usage.daily[0].date).toBe(stats.range.from.slice(0, 10));
    expect(stats.usage.weekly[0].weekStart).toBe(weekStartOf(stats.usage.daily[0].date));
    expect(stats.recording.weekly.map((w) => w.weekStart)).toEqual(stats.usage.weekly.map((w) => w.weekStart));
  });

  it("counts usage only from when tracking started, and its totals agree", () => {
    const { usage } = stats;
    const since = (usage.trackedSince as string).slice(0, 10);
    for (const day of usage.daily) if (day.date < since) expect(day).toMatchObject({ users: 0, events: 0 });
    expect(usage.users).toHaveLength(usage.activeUsers);
    expect(sum(usage.users, (u) => u.events)).toBe(sum(usage.daily, (d) => d.events));
    expect(sum(usage.weekly, (w) => w.events)).toBe(sum(usage.daily, (d) => d.events));
    expect(sum(usage.byRegion, (r) => r.users)).toBe(usage.activeUsers);
    expect(sum(usage.byAction, (a) => a.events)).toBe(sum(usage.daily, (d) => d.events));
    for (const week of usage.weekly) {
      const inWeek = usage.daily.filter((d) => weekStartOf(d.date) === week.weekStart);
      expect(week.users).toBeGreaterThanOrEqual(Math.max(0, ...inWeek.map((d) => d.users)));
      expect(week.users).toBeLessThanOrEqual(usage.activeUsers);
    }
  });

  it("adds the calls up the same way by week, recorder, region and meeting type", () => {
    const { recording } = stats;
    expect(recording.calls).toBeGreaterThan(0);
    expect(sum(recording.weekly, (w) => w.calls)).toBe(recording.calls);
    expect(sum(recording.weekly, (w) => w.analysed)).toBe(recording.analysed);
    expect(sum(recording.byRecorder, (r) => r.calls)).toBe(recording.calls);
    expect(sum(recording.byRecorder, (r) => r.withTranscript)).toBe(recording.withTranscript);
    expect(recording.byRecorder).toHaveLength(recording.recorders);
    expect(sum(recording.byRegion, (r) => r.calls)).toBe(recording.calls);
    expect(sum(recording.byRegion, (r) => r.recorders)).toBe(recording.recorders);
    expect(sum(recording.byMeetingType, (t) => t.calls)).toBe(recording.calls);
    expect(recording.withTranscript).toBeLessThanOrEqual(recording.calls);
    expect(recording.analysed + recording.emptyTranscript).toBeLessThanOrEqual(recording.withTranscript);
  });

  it("adds the decisions up by field, user, reason, band and merge status", () => {
    const { decisions } = stats;
    const decided = decisions.approved + decisions.edited + decisions.rejected;
    expect(sum(decisions.byField, (f) => f.approved + f.edited + f.rejected)).toBe(decided);
    expect(sum(decisions.byField, (f) => f.pending)).toBe(decisions.pending);
    expect(sum(decisions.byUser, (u) => u.approved + u.edited + u.rejected)).toBe(decided);
    expect(sum(decisions.rejectReasons, (r) => r.count)).toBe(decisions.rejected);
    expect(sum(decisions.byConfidence, (b) => b.decided)).toBe(decided);
    expect(sum(decisions.byMergeStatus, (m) => m.decided)).toBe(decided);
    // Every suggestion waiting on an open deal's missing field is pending, and some more.
    expect(decisions.pending).toBeGreaterThanOrEqual(stats.salesforce.echoCanFill);
  });

  it("describes the same open deals in completeness, progress and quiet deals", () => {
    const { salesforce, progress, quietDeals } = stats;
    expect(progress.openDeals).toBe(salesforce.deals);
    expect(quietDeals.openDeals).toBe(salesforce.deals);
    expect(salesforce.fieldsMissing).toBe(salesforce.fieldsInScope - salesforce.fieldsFilled);
    expect(sum(salesforce.byField, (f) => f.missing)).toBe(salesforce.fieldsMissing);
    expect(sum(salesforce.byField, (f) => f.echoProposed)).toBe(salesforce.echoCanFill);
    expect(sum(progress.byStage, (s) => s.deals)).toBe(progress.openDeals);
    expect(sum(progress.byRegion, (r) => r.openDeals)).toBe(progress.openDeals);
    expect(sum(progress.byOwner, (o) => o.openDeals)).toBe(progress.openDeals);
    expect(sum(quietDeals.byOwner, (o) => o.openDeals)).toBe(quietDeals.openDeals);
    expect(sum(quietDeals.byRegion, (r) => r.quiet)).toBe(quietDeals.quiet);
    expect(quietDeals.deals).toHaveLength(Math.min(100, quietDeals.quiet));
  });

  it("splits the opportunities that moved by their latest change, and lists every change in range", () => {
    const { progress } = stats;
    expect(progress.movedForward + progress.movedBack + progress.closedWon + progress.closedLost).toBe(
      progress.stageChanges,
    );
    expect(sum(progress.byRegion, (r) => r.stageChanges)).toBe(progress.stageChanges);
    expect(sum(progress.byOwner, (o) => o.closedWon)).toBe(progress.closedWon);
    expect(new Set(progress.changes.map((c) => c.opportunityId)).size).toBe(Math.min(progress.stageChanges, 50));
    for (const change of progress.changes) expect(change.at >= stats.range.from).toBe(true);
  });

  it("reports a missing region as Unassigned in the by-region lists, never as null", () => {
    for (const list of [stats.usage.byRegion, stats.recording.byRegion, stats.progress.byRegion, stats.quietDeals.byRegion]) {
      for (const row of list) expect(row.region).toBeTruthy();
    }
    expect(stats.progress.byRegion.map((r) => r.region)).toContain(UNASSIGNED_REGION);
  });
});

describe("the demo across ranges", () => {
  // Inside the 7 days every decision comes from a logged approve or reject request.
  it("decides fields only through the requests the usage log counts, once tracking has started", () => {
    const { usage, decisions } = mockEchoAdminStats(7);
    expect(decisions.rejected).toBe(sum(usage.users, (u) => u.rejections));
    expect(decisions.approved + decisions.edited).toBeGreaterThanOrEqual(sum(usage.users, (u) => u.approvals));
    for (const user of decisions.byUser) {
      const logged = usage.users.find((u) => u.email === user.email);
      expect(logged).toBeDefined();
      expect(user.rejected).toBe(logged?.rejections);
    }
  });

  it("shows the tracking note's case in 30 and 90 days, and not in 7", () => {
    const tracked = mockEchoAdminStats(30).usage.trackedSince as string;
    expect(tracked > mockEchoAdminStats(30).range.from).toBe(true);
    expect(tracked > mockEchoAdminStats(90).range.from).toBe(true);
    expect(tracked < mockEchoAdminStats(7).range.from).toBe(true);
  });

  it("only grows as the range widens", () => {
    const [week, month, quarter] = STATS_DAYS.map((days) => mockEchoAdminStats(days));
    expect(week.recording.calls).toBeLessThan(month.recording.calls);
    expect(month.recording.calls).toBeLessThan(quarter.recording.calls);
    expect(week.quietDeals.quiet).toBeGreaterThanOrEqual(month.quietDeals.quiet);
  });

  it("has nothing in the empty answer but zero-filled days and weeks", () => {
    const empty = emptyEchoAdminStats(30);
    expect(empty.usage.daily).toHaveLength(31);
    expect(empty.usage.daily.every((d) => d.users === 0)).toBe(true);
    expect(empty.progress.changes).toEqual([]);
    expect(empty.quietDeals.deals).toEqual([]);
  });
});
