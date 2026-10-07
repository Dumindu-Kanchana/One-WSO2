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
import { colorForName, SERIES_STROKES } from "./chartColors";

const PRODUCTS = [
  "API Manager",
  "Identity Server",
  "Micro Integrator",
  "APK",
  "Streaming Integrator",
  "Choreo Connect",
];

describe("colorForName", () => {
  it("picks a colour from One's stroke list", () => {
    for (const name of PRODUCTS) {
      expect(SERIES_STROKES).toContain(colorForName(name));
    }
  });

  it("gives a Product the same colour on every screen, whatever else is drawn beside it", () => {
    const alone = colorForName("API Manager");
    const afterOthers = [...PRODUCTS].reverse().map(colorForName);
    expect(afterOthers[PRODUCTS.length - 1]).toBe(alone);
    expect(PRODUCTS.map(colorForName)).toEqual([...PRODUCTS].map(colorForName));
  });

  it("is assigned by name, not by position: reordering the series moves no colour", () => {
    const inOrder = new Map(PRODUCTS.map((name) => [name, colorForName(name)]));
    const shuffled = ["APK", "Choreo Connect", "API Manager", "Streaming Integrator", "Identity Server", "Micro Integrator"];
    for (const name of shuffled) {
      expect(colorForName(name)).toBe(inOrder.get(name));
    }
  });

  it("spreads different names over more than one colour", () => {
    expect(new Set(PRODUCTS.map(colorForName)).size).toBeGreaterThan(1);
  });

  it("treats an empty name as a name too", () => {
    expect(SERIES_STROKES).toContain(colorForName(""));
  });
});
