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
import {
  formatBytes,
  formatCompact,
  formatDate,
  formatDateTime,
  formatMonthYear,
  formatNumber,
  jobStatusLabel,
  productLabel,
} from "./format";

describe("formatCompact", () => {
  it("abbreviates thousands and millions to one decimal", () => {
    expect(formatCompact(1500)).toBe("1.5K");
    expect(formatCompact(2_300_000)).toBe("2.3M");
    expect(formatCompact(999)).toBe("999");
    expect(formatCompact(0)).toBe("0");
  });

  it("shows an em dash for a missing figure", () => {
    expect(formatCompact(null)).toBe("—");
    expect(formatCompact(undefined)).toBe("—");
    expect(formatCompact(Number.NaN)).toBe("—");
  });
});

describe("formatNumber", () => {
  it("writes the full figure with thousands separators", () => {
    expect(formatNumber(1500)).toBe("1,500");
    expect(formatNumber(1_234_567)).toBe("1,234,567");
    expect(formatNumber(0)).toBe("0");
  });

  it("shows an em dash for a missing figure", () => {
    expect(formatNumber(null)).toBe("—");
    expect(formatNumber(undefined)).toBe("—");
  });
});

describe("formatBytes", () => {
  it("scales to the largest whole unit with one decimal", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(481_689_600)).toBe("459.4 MB");
    expect(formatBytes(1_099_511_627_776)).toBe("1 TB");
  });

  it("shows an em dash for an unknown size", () => {
    expect(formatBytes(null)).toBe("—");
    expect(formatBytes(undefined)).toBe("—");
  });
});

describe("formatDate", () => {
  it("writes a calendar date as day, short month, year in UTC", () => {
    expect(formatDate("2026-06-25")).toBe("25 Jun 2026");
    expect(formatDate("2026-01-07")).toBe("07 Jan 2026");
  });

  it("keeps the UTC day for an instant that is the day before in the viewer's zone", () => {
    // 00:30 UTC on 25 June is still 24 June in America/Los_Angeles (the suite's zone).
    expect(formatDate("2026-06-25T00:30:00Z")).toBe("25 Jun 2026");
  });

  it("shows an em dash for a blank and keeps an unreadable value", () => {
    expect(formatDate("")).toBe("—");
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });
});

describe("formatMonthYear", () => {
  it("writes a month label or a calendar date as short month and year", () => {
    expect(formatMonthYear("2025-03")).toBe("Mar 2025");
    expect(formatMonthYear("2025-01-01")).toBe("Jan 2025");
    expect(formatMonthYear("2026-10-07")).toBe("Oct 2026");
  });

  it("shows an em dash for a blank and keeps an unreadable value", () => {
    expect(formatMonthYear(null)).toBe("—");
    expect(formatMonthYear("")).toBe("—");
    expect(formatMonthYear("not-a-month")).toBe("not-a-month");
  });
});

describe("formatDateTime", () => {
  it("writes an instant in the viewer's local zone as day, month, year, time", () => {
    // Sync runs are instants, so the viewer's own clock applies: derive the
    // expected local fields from Date rather than pinning one zone.
    const instant = new Date("2026-10-07T13:00:00Z");
    const pad = (n: number) => String(n).padStart(2, "0");
    const expected = `${pad(instant.getDate())} Oct ${instant.getFullYear()}, ${pad(instant.getHours())}:${pad(instant.getMinutes())}`;
    expect(formatDateTime("2026-10-07T13:00:00Z")).toBe(expected);
    expect(formatDateTime("2026-10-07T13:00:00Z")).toMatch(/^\d{2} Oct \d{4}, \d{2}:\d{2}$/);
  });

  it("shows an em dash for a blank and keeps an unreadable value", () => {
    expect(formatDateTime("")).toBe("—");
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime("not-a-time")).toBe("not-a-time");
  });
});

describe("productLabel", () => {
  it("prefers the product name and falls back to the repository name", () => {
    expect(productLabel("API Manager", "product-apim")).toBe("API Manager");
    expect(productLabel(null, "product-apim")).toBe("product-apim");
    expect(productLabel("", "product-apim")).toBe("product-apim");
    expect(productLabel("   ", "product-apim")).toBe("product-apim");
  });
});

describe("jobStatusLabel", () => {
  it("names the sync statuses and keeps an unknown one", () => {
    expect(jobStatusLabel("FAILED")).toBe("Failed");
    expect(jobStatusLabel("PARTIAL_FAILURE")).toBe("Partial failure");
    expect(jobStatusLabel("SUCCESS")).toBe("Success");
    expect(jobStatusLabel("STARTED")).toBe("Started");
    expect(jobStatusLabel("QUEUED")).toBe("QUEUED");
  });
});
