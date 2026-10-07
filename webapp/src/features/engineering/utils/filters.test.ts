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
import type { ChartSeries } from "./chartTypes";
import {
  buildDateMatrix,
  defaultRange,
  mergeParams,
  parseFilters,
  periodSummary,
  productNameById,
  toChartSeries,
} from "./filters";

describe("defaultRange", () => {
  it("is the last 30 days through today", () => {
    expect(defaultRange(new Date("2026-10-07T12:00:00Z"))).toEqual({
      from: "2026-09-07",
      to: "2026-10-07",
    });
  });

  it("reads today in UTC, not in the viewer's zone", () => {
    // 03:00 UTC on 8 October is still the evening of 7 October in
    // America/Los_Angeles (the suite's zone); the range ends on the UTC day.
    expect(defaultRange(new Date("2026-10-08T03:00:00Z"))).toEqual({
      from: "2026-09-08",
      to: "2026-10-08",
    });
  });
});

describe("parseFilters", () => {
  const now = new Date("2026-10-07T12:00:00Z");

  it("applies the defaults: last 30 days, every Product, Daily", () => {
    expect(parseFilters(new URLSearchParams(""), now)).toEqual({
      from: "2026-09-07",
      to: "2026-10-07",
      repos: [],
      interval: "day",
    });
  });

  it("reads the address and drops ids that are not positive integers", () => {
    const filters = parseFilters(
      new URLSearchParams("from=2026-01-01&to=2026-03-31&repos=4,2,x,0,-3,1.5&interval=month"),
      now,
    );
    expect(filters).toEqual({
      from: "2026-01-01",
      to: "2026-03-31",
      repos: [4, 2],
      interval: "month",
    });
  });

  it("knows the three intervals and falls back to Daily for anything else", () => {
    expect(parseFilters(new URLSearchParams("interval=cumulative"), now).interval).toBe("cumulative");
    expect(parseFilters(new URLSearchParams("interval=month"), now).interval).toBe("month");
    expect(parseFilters(new URLSearchParams("interval=weekly"), now).interval).toBe("day");
  });

  it("treats a blank date as absent", () => {
    expect(parseFilters(new URLSearchParams("from=&to="), now)).toMatchObject({
      from: "2026-09-07",
      to: "2026-10-07",
    });
  });
});

describe("mergeParams", () => {
  it("sets values and joins arrays with commas", () => {
    const next = mergeParams(new URLSearchParams("a=1"), { repos: [1, 2], interval: "month", n: 7 });
    expect(next.get("a")).toBe("1");
    expect(next.get("repos")).toBe("1,2");
    expect(next.get("interval")).toBe("month");
    expect(next.get("n")).toBe("7");
  });

  it("removes a key whose value is empty: null, undefined, an empty string or an empty array", () => {
    const current = new URLSearchParams("a=1&b=2&c=3&d=4&keep=yes");
    const next = mergeParams(current, { a: null, b: undefined, c: "", d: [] });
    expect(next.get("a")).toBeNull();
    expect(next.get("b")).toBeNull();
    expect(next.get("c")).toBeNull();
    expect(next.get("d")).toBeNull();
    expect(next.get("keep")).toBe("yes");
  });

  it("leaves the current params untouched", () => {
    const current = new URLSearchParams("a=1");
    mergeParams(current, { a: null, b: "2" });
    expect(current.toString()).toBe("a=1");
  });
});

describe("productNameById", () => {
  it("labels a Tracked repository by product name, or repository name when it has none", () => {
    const names = productNameById([
      { id: 1, repoName: "product-apim", productName: "API Manager" },
      { id: 2, repoName: "product-is", productName: null },
      { id: 3, repoName: "apk", productName: "" },
    ]);
    expect(names.get(1)).toBe("API Manager");
    expect(names.get(2)).toBe("product-is");
    expect(names.get(3)).toBe("apk");
  });
});

describe("toChartSeries", () => {
  it("keys each series by repository id and names it from the map, else by repository name", () => {
    const series = toChartSeries(
      [
        { repoId: 1, repoName: "product-apim", points: [{ date: "2026-06-01", value: 5 }] },
        { repoId: 2, repoName: "product-is", points: [] },
      ],
      new Map([[1, "API Manager"]]),
    );
    expect(series).toEqual([
      { key: "repo-1", name: "API Manager", points: [{ date: "2026-06-01", value: 5 }] },
      { key: "repo-2", name: "product-is", points: [] },
    ]);
  });
});

const apim: ChartSeries = {
  key: "repo-1",
  name: "API Manager",
  points: [
    { date: "2026-06-01", value: 5 },
    { date: "2026-06-02", value: 10 },
  ],
};
const identityServer: ChartSeries = {
  key: "repo-2",
  name: "Identity Server",
  points: [
    { date: "2026-06-01", value: 3 },
    { date: "2026-06-03", value: 4 },
  ],
};

describe("periodSummary", () => {
  it("sums the series per date first, then reads total, average, highest and lowest from those sums", () => {
    // Per date: 06-01 → 8, 06-02 → 10, 06-03 → 4.
    expect(periodSummary([apim, identityServer])).toEqual({
      total: 22,
      avgPerPoint: 7,
      peakDate: "2026-06-02",
      peakValue: 10,
      minDate: "2026-06-03",
      minValue: 4,
      pointCount: 3,
    });
  });

  it("names the earliest date when two dates tie", () => {
    const flat: ChartSeries = {
      key: "repo-1",
      name: "APK",
      points: [
        { date: "2026-06-02", value: 6 },
        { date: "2026-06-01", value: 6 },
      ],
    };
    expect(periodSummary([flat])).toMatchObject({ peakDate: "2026-06-01", minDate: "2026-06-01" });
  });

  it("is all zeros with no dates when there are no points", () => {
    expect(periodSummary([{ key: "repo-1", name: "APK", points: [] }])).toEqual({
      total: 0,
      avgPerPoint: 0,
      peakDate: null,
      peakValue: 0,
      minDate: null,
      minValue: 0,
      pointCount: 0,
    });
  });
});

describe("buildDateMatrix", () => {
  const matrix = buildDateMatrix([apim, identityServer]);

  it("lists every date once, newest first", () => {
    expect(matrix.dates).toEqual(["2026-06-03", "2026-06-02", "2026-06-01"]);
  });

  it("has one column per series, in series order", () => {
    expect(matrix.columns).toEqual([
      { key: "repo-1", name: "API Manager" },
      { key: "repo-2", name: "Identity Server" },
    ]);
  });

  it("reads a cell by date and series, and has no value where a series has no point", () => {
    expect(matrix.cell("2026-06-01", "repo-2")).toBe(3);
    expect(matrix.cell("2026-06-02", "repo-2")).toBeUndefined();
    expect(matrix.cell("2026-06-09", "repo-1")).toBeUndefined();
  });

  it("totals a date across the series", () => {
    expect(matrix.totalForDate("2026-06-01")).toBe(8);
    expect(matrix.totalForDate("2026-06-03")).toBe(4);
    expect(matrix.totalForDate("2026-06-09")).toBe(0);
  });
});
