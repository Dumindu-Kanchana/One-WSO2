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
import { deadlinePassedEverywhereAt, isDeadlinePassed } from "./parDeadline";

describe("isDeadlinePassed", () => {
  it("is false for a bare date still in the future", () => {
    expect(isDeadlinePassed("2999-01-01")).toBe(false);
  });

  it("is true for a bare date in the past", () => {
    expect(isDeadlinePassed("2000-01-01")).toBe(true);
  });

  it("fails closed for a full ISO timestamp rather than reading as never-passed", () => {
    expect(isDeadlinePassed("2999-01-01T00:00:00.000Z")).toBe(true);
  });

  it("fails closed for an empty or malformed value", () => {
    expect(isDeadlinePassed("")).toBe(true);
    expect(isDeadlinePassed("not-a-date")).toBe(true);
  });
});

describe("deadlinePassedEverywhereAt", () => {
  it("is the start of the next day at UTC-12, the second after the deadline ends there", () => {
    expect(deadlinePassedEverywhereAt("2026-12-05").toISOString()).toBe("2026-12-06T12:00:00.000Z");
  });
});
