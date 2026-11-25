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
import type { StatsRange, UsageStats } from "../types";
import {
  actionLabel,
  formatCount,
  formatDay,
  formatRange,
  formatRate,
  mergeStatusLabel,
  statsRejectReasonLabel,
  usageTrackingNote,
} from "./statsFormat";

const range: StatsRange = { from: "2026-10-27T00:00:00Z", to: "2026-11-26T10:00:00Z", days: 30 };
const usage = (trackedSince: string | null): UsageStats => ({
  trackedSince,
  activeUsers: 0,
  daily: [],
  users: [],
  byAction: [],
});

describe("formatCount", () => {
  it("groups thousands", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(999)).toBe("999");
    expect(formatCount(1285)).toBe("1,285");
    expect(formatCount(9000000)).toBe("9,000,000");
  });
});

describe("formatRate", () => {
  it("reads a 0..1 rate as a percentage to one decimal", () => {
    expect(formatRate(0.727)).toBe("72.7%");
    expect(formatRate(0.5)).toBe("50%");
    expect(formatRate(1)).toBe("100%");
    expect(formatRate(0)).toBe("0%");
  });

  // Null is the contract's "nothing to divide by": a dash, never 0%.
  it("shows a dash when there is no rate", () => {
    expect(formatRate(null)).toBe("—");
    expect(formatRate(undefined)).toBe("—");
  });
});

describe("formatDay", () => {
  // The suite runs in America/Los_Angeles: read in the local zone, these would be a day early.
  it("reads a calendar date as that date, whatever the viewer's zone", () => {
    expect(formatDay("2026-11-23")).toBe("23 Nov");
    expect(formatDay("2026-01-01")).toBe("1 Jan");
  });

  it("leaves something that is not a date as it came", () => {
    expect(formatDay("soon")).toBe("soon");
  });
});

describe("formatRange", () => {
  it("names the first and last day of the range", () => {
    expect(formatRange(range)).toBe("27 Oct – 26 Nov 2026");
  });
});

describe("usageTrackingNote", () => {
  it("says nothing has been recorded when there is no usage yet", () => {
    expect(usageTrackingNote(usage(null), range)).toBe(
      "Usage is counted only since tracking started, and nothing has been recorded yet.",
    );
  });

  it("names the day tracking started when that is inside the range", () => {
    expect(usageTrackingNote(usage("2026-11-20T09:00:00Z"), range)).toBe(
      "Usage is counted only since tracking started on 20 Nov 2026, so this range shows nothing before then.",
    );
  });

  it("says nothing when tracking covers the whole range", () => {
    expect(usageTrackingNote(usage("2026-10-27T00:00:00Z"), range)).toBeNull();
    expect(usageTrackingNote(usage("2026-09-01T00:00:00Z"), range)).toBeNull();
  });
});

describe("labels", () => {
  it("names the logged actions, and shows one it doesn't know as sent", () => {
    expect(actionLabel("deal.view")).toBe("Opened an opportunity");
    expect(actionLabel("meeting.reanalyse")).toBe("Re-analysed a call");
    expect(actionLabel("deal.something_new")).toBe("deal.something_new");
  });

  it("names the reject reasons, including UNSPECIFIED, which the dialog never offers", () => {
    expect(statsRejectReasonLabel("WRONG_VALUE")).toBe("Wrong value");
    expect(statsRejectReasonLabel("NOT_SUPPORTED")).toBe("Quote doesn't show it");
    expect(statsRejectReasonLabel("UNSPECIFIED")).toBe("No reason given");
  });

  it("explains each merge status", () => {
    expect(mergeStatusLabel("SINGLE")).toBe("From one call");
    expect(mergeStatusLabel("FALLBACK")).toBe("Latest call only (combining failed)");
    expect(mergeStatusLabel("NEW")).toBe("NEW");
  });
});
