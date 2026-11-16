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

import type { Theme } from "@wso2/oxygen-ui";

// A rating scale's colours, low to high: red, pink, pale cream, mint, green.
const SCALE_TINTS = {
  light: ["#e8978d", "#efc0b9", "#eedfa6", "#b8dec0", "#93cf9f"],
  dark: [
    "rgba(239, 83, 80, 0.55)",
    "rgba(239, 83, 80, 0.32)",
    "rgba(255, 202, 40, 0.26)",
    "rgba(102, 187, 106, 0.32)",
    "rgba(102, 187, 106, 0.55)",
  ],
};

/**
 * Styles for the button at `index` of a `count`-option rating scale, low to high: plain until
 * picked, then one flat colour for where it sits on the scale.
 */
export const scaleTintSx = (index: number, count: number) => (theme: Theme) => {
  const last = SCALE_TINTS.light.length - 1;
  const tint = count > 1 ? Math.round((index / (count - 1)) * last) : last / 2;
  return {
    "&.Mui-selected, &.Mui-selected:hover": { bgcolor: SCALE_TINTS.light[tint], fontWeight: 600 },
    ...theme.applyStyles("dark", {
      "&.Mui-selected, &.Mui-selected:hover": { bgcolor: SCALE_TINTS.dark[tint] },
    }),
  };
};
