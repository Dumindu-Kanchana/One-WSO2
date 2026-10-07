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

// One's chart strokes. Distinct so two series are not the same line; the list
// repeats only once it is exhausted. The standalone's palette and its map of
// pinned product names are deliberately not copied (spec: colours are One's).
export const SERIES_STROKES = [
  "#3E6FA3",
  "#4FA39B",
  "#6FA96B",
  "#E0A33E",
  "#C9756B",
  "#8C79B0",
  "#5C7D99",
  "#B7894C",
  "#A98DA0",
];

export type ChartMode = "light" | "dark";

// The legend prints the series colour as text, so it has to clear the text
// contrast floor, not only the 3:1 mark floor. White is the stricter light
// surface and #121212 the stricter dark one across One's themes.
const MIN_CONTRAST = 4.5;
const LIGHT_SURFACE = "#ffffff";
const DARK_SURFACE = "#121212";

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return h;
}

function channel(hex: string, index: number): number {
  return parseInt(hex.slice(index, index + 2), 16);
}

function luminance(hex: string): number {
  const linear = [1, 3, 5].map((index) => {
    const value = channel(hex, index) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foreground: string, surface: string): number {
  const left = luminance(foreground);
  const right = luminance(surface);
  const [hi, lo] = left > right ? [left, right] : [right, left];
  return (hi + 0.05) / (lo + 0.05);
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = channel(hex, 1) / 255;
  const g = channel(hex, 3) / 255;
  const b = channel(hex, 5) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h / 6, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const hue = (p: number, q: number, t: number): number => {
    let wrapped = t;
    if (wrapped < 0) wrapped += 1;
    if (wrapped > 1) wrapped -= 1;
    if (wrapped < 1 / 6) return p + (q - p) * 6 * wrapped;
    if (wrapped < 1 / 2) return q;
    if (wrapped < 2 / 3) return p + (q - p) * (2 / 3 - wrapped) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const rgb = s === 0 ? [l, l, l] : [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)];
  return `#${rgb.map((value) => Math.round(value * 255).toString(16).padStart(2, "0")).join("")}`;
}

// Keep the hue. Walk lightness until the colour clears the text floor on the
// surface this mode paints charts on, so a gold that reads on black also
// reads on white, and a blue that reads on white also reads on near-black.
function readable(hex: string, surface: string): string {
  if (contrast(hex, surface) >= MIN_CONTRAST) return hex;
  const { h, s, l } = hexToHsl(hex);
  const toward = surface === LIGHT_SURFACE ? -1 : 1;
  let lightness = l;
  let next = hex;
  for (let step = 0; step < 24 && contrast(next, surface) < MIN_CONTRAST; step++) {
    lightness = Math.min(0.92, Math.max(0.08, lightness + toward * 0.03));
    next = hslToHex(h, s, lightness);
  }
  return next;
}

// One stable colour per series name — a Product on Overview, Downloads and
// Repository Stats, a Tag on Versions, a Package on Packages — so the same
// name wears the same colour on every screen. Assigned by a hash of the name,
// never by the series' position, which would change with every filter. The
// mode only shifts lightness, so the hue survives a light/dark switch.
export function colorForName(name: string, mode: ChartMode = "light"): string {
  const base = SERIES_STROKES[hashName(name) % SERIES_STROKES.length];
  return readable(base, mode === "dark" ? DARK_SURFACE : LIGHT_SURFACE);
}
