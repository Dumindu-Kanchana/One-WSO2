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

import { TableRow } from "@wso2/oxygen-ui";
import { type JSX, type ReactNode } from "react";
import { activateOnEnterOrSpace } from "../utils/activation";

interface SelectableRowProps {
  selected: boolean;
  /** A click, Enter or Space on the row. The parent decides whether that selects or clears. */
  onActivate: () => void;
  children: ReactNode;
}

// A table row the reader picks to open a detail panel on — a Version for its
// Assets, a Package for its versions — as the standalone's rows are picked
// (ADR 0002): a whole-row click with keyboard support rather than a text
// button, so the name renders in its own case, highlighted while selected.
export default function SelectableRow({
  selected,
  onActivate,
  children,
}: SelectableRowProps): JSX.Element {
  return (
    <TableRow
      hover
      selected={selected}
      role="button"
      aria-pressed={selected}
      tabIndex={0}
      sx={{ cursor: "pointer" }}
      onClick={onActivate}
      onKeyDown={activateOnEnterOrSpace(onActivate)}
    >
      {children}
    </TableRow>
  );
}
