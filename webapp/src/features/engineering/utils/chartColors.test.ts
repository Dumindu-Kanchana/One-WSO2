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

function contrast(foreground: string, surface: string): number {
  const luminance = (hex: string): number => {
    const linear = [1, 3, 5].map((index) => {
      const value = parseInt(hex.slice(index, index + 2), 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const left = luminance(foreground);
  const right = luminance(surface);
  const [hi, lo] = left > right ? [left, right] : [right, left];
  return (hi + 0.05) / (lo + 0.05);
}

describe("colorForName", () => {
  it("starts from One's stroke list and keeps the hue readable on white and near-black", () => {
    for (const name of [...PRODUCTS, ""]) {
      const light = colorForName(name, "light");
      const dark = colorForName(name, "dark");
      expect(light).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(dark).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(contrast(light, "#ffffff")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(dark, "#121212")).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("gives a Product the same colour on every screen, whatever else is drawn beside it", () => {
    const alone = colorForName("API Manager");
    const afterOthers = [...PRODUCTS].reverse().map((name) => colorForName(name));
    expect(afterOthers[PRODUCTS.length - 1]).toBe(alone);
    expect(PRODUCTS.map((name) => colorForName(name))).toEqual(
      [...PRODUCTS].map((name) => colorForName(name)),
    );
  });

  it("is assigned by name, not by position: reordering the series moves no colour", () => {
    const inOrder = new Map(PRODUCTS.map((name) => [name, colorForName(name)]));
    const shuffled = ["APK", "Choreo Connect", "API Manager", "Streaming Integrator", "Identity Server", "Micro Integrator"];
    for (const name of shuffled) {
      expect(colorForName(name)).toBe(inOrder.get(name));
    }
  });

  it("spreads different names over more than one colour", () => {
    expect(new Set(PRODUCTS.map((name) => colorForName(name))).size).toBeGreaterThan(1);
  });

  it("keeps a name's colour stable in each mode, and can shift it between modes", () => {
    expect(colorForName("", "light")).toBe(colorForName("", "light"));
    expect(colorForName("API Manager", "dark")).toBe(colorForName("API Manager", "dark"));
    expect(SERIES_STROKES.length).toBeGreaterThan(1);
  });
});
