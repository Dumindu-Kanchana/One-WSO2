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

// One stable colour per series name — a Product on Overview, Downloads and
// Repository Stats, a Tag on Versions, a Package on Packages — so the same
// name wears the same colour on every screen. Assigned by a hash of the name,
// never by the series' position, which would change with every filter.
export function colorForName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return SERIES_STROKES[h % SERIES_STROKES.length];
}
