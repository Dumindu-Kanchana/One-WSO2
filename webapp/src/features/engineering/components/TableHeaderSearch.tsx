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

import { Box, IconButton, InputBase, Tooltip } from "@wso2/oxygen-ui";
import { Search, X } from "@wso2/oxygen-ui-icons-react";
import { type JSX, useState } from "react";

interface TableHeaderSearchProps {
  /** The column's title, e.g. "Version". */
  title: string;
  /**
   * What one row is, for the accessible names: "Filter by version",
   * "Filter versions", "Clear version filter".
   */
  noun: string;
  value: string;
  onChange: (value: string) => void;
}

// A column header with the standalone's inline search (ADR 0002): a
// magnifier that reveals a small "Filter…" field and a clear button; Escape
// clears the field and closes it. Versions searches its Version column with
// it and Repository Stats its Product column. The field is closed on mount,
// so a parent that keys this on the Product forgets a search with it — but
// it is shown whenever it holds a value, so a table redrawn after a reload
// never filters its rows behind a closed field.
export default function TableHeaderSearch({
  title,
  noun,
  value,
  onChange,
}: TableHeaderSearchProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const showField = isOpen || value !== "";
  const clear = () => {
    onChange("");
    setIsOpen(false);
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      {title}
      {showField ? (
        <>
          <InputBase
            autoFocus
            placeholder="Filter…"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") clear();
            }}
            inputProps={{
              "aria-label": `Filter ${noun}s`,
              autoComplete: "off",
              // Password managers offer to fill any lone text field; these
              // attributes tell the common ones this is not a login.
              "data-lpignore": "true",
              "data-1p-ignore": "true",
              "data-bwignore": "true",
              "data-form-type": "other",
            }}
            sx={{
              fontSize: "0.8rem",
              width: 110,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          />
          <Tooltip title="Clear filter">
            <IconButton size="small" aria-label={`Clear ${noun} filter`} onClick={clear}>
              <X size={14} />
            </IconButton>
          </Tooltip>
        </>
      ) : (
        <Tooltip title={`Filter by ${noun}`}>
          <IconButton
            size="small"
            aria-label={`Filter by ${noun}`}
            onClick={() => setIsOpen(true)}
          >
            <Search size={14} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
