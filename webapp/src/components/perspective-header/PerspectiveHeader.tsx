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

import { Typography } from "@wso2/oxygen-ui";
import type { ReactNode } from "react";

export interface PerspectiveHeaderProps {
  /**
   * Accepted but no longer rendered — see the note below. Kept on the interface
   * so the ~6 call sites don't all have to change, and so the intent of each
   * page is still readable at its call site.
   */
  eyebrow?: string;
  /**
   * Omitted when something else on the page already names it, such as a
   * selected tab. The subtitle still renders.
   */
  title?: ReactNode;
  subtitle?: ReactNode;
}

// The title + subtitle every perspective/placeholder page opens with (People
// Ops, Finance, My Team, ...).
//
// Two deliberate changes from the version that consolidated these blocks:
//
//  - The sparkle-prefixed "<name> perspective" chip is gone. It was decoration —
//    the rail already says which perspective you are in — and a filled
//    `color="primary"` chip put ~11px white text on brand orange, which measures
//    about 3.6:1 and fails WCAG AA.
//  - Sizes come from the theme instead of being hardcoded. `variant="h5"` is
//    16px/400 against the old 23px/700; restraint here is what makes a page read
//    as calm rather than shouted.
export default function PerspectiveHeader({ title, subtitle }: PerspectiveHeaderProps) {
  return (
    <>
      {title ? (
        <Typography variant="h5" sx={{ mb: 0.5 }}>
          {title}
        </Typography>
      ) : null}
      {subtitle && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2.25, maxWidth: "68ch" }}
        >
          {subtitle}
        </Typography>
      )}
    </>
  );
}
