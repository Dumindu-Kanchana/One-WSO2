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
import { activityDate, isIsolatedPoint, jobStatusLabel } from "./display";

describe("activityDate", () => {
  it("keeps a calendar date and drops anything else", () => {
    expect(activityDate("2026-09-28")).toBe("2026-09-28");
    expect(activityDate("28 Sep 2026")).toBeUndefined();
    expect(activityDate(null)).toBeUndefined();
  });
});

describe("jobStatusLabel", () => {
  it("names the collection job states and keeps an unknown one", () => {
    expect(jobStatusLabel("FAILED")).toBe("Failed");
    expect(jobStatusLabel("PARTIAL_FAILURE")).toBe("Partial failure");
    expect(jobStatusLabel("SUCCESS")).toBe("Success");
    expect(jobStatusLabel("STARTED")).toBe("Started");
    expect(jobStatusLabel("QUEUED")).toBe("QUEUED");
  });
});

describe("isIsolatedPoint", () => {
  const data = [
    { date: "2026-09-01", "repo-1": null },
    { date: "2026-09-02", "repo-1": 40 },
    { date: "2026-09-03", "repo-1": null },
  ];

  it("marks a lone download and skips a point that has a neighbor", () => {
    expect(isIsolatedPoint(data, "repo-1", 1)).toBe(true);
    expect(isIsolatedPoint(data, "repo-1", 0)).toBe(false);
    const run = [
      { date: "2026-09-01", "repo-1": 1 },
      { date: "2026-09-02", "repo-1": 2 },
    ];
    expect(isIsolatedPoint(run, "repo-1", 0)).toBe(false);
    expect(isIsolatedPoint(run, "repo-1", 1)).toBe(false);
  });
});
