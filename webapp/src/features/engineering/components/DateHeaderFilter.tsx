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

import { Box, Chip, IconButton, Tooltip } from "@wso2/oxygen-ui";
import { CalendarDays } from "@wso2/oxygen-ui-icons-react";
import { type JSX, useRef } from "react";

interface DateHeaderFilterProps {
  /** A calendar day (YYYY-MM-DD) or a month (YYYY-MM). */
  type: "date" | "month";
  /** The chosen value in the input's own form; empty when none is chosen. */
  value: string;
  onChange: (value: string) => void;
  /** How the chosen value reads on the chip; the raw value otherwise. */
  format?: (value: string) => string;
}

// A calendar icon for a table header that opens the browser's own date or
// month picker and shows the chosen value as a removable chip beside it, as
// the standalone's Date header does (ADR 0002). The input sits hidden under
// the icon so the picker anchors there; the icon is what a person sees.
export default function DateHeaderFilter({
  type,
  value,
  onChange,
  format,
}: DateHeaderFilterProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const label = value ? (format ? format(value) : value) : null;

  return (
    <>
      <Tooltip title={label ? "Change date" : "Filter by date"}>
        <Box sx={{ position: "relative", display: "inline-flex" }}>
          <input
            ref={inputRef}
            type={type}
            aria-hidden="true"
            tabIndex={-1}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0,
              pointerEvents: "none",
              width: "100%",
              height: "100%",
            }}
          />
          <IconButton
            size="small"
            aria-label={label ? "Change date filter" : "Filter by date"}
            onClick={() => inputRef.current?.showPicker()}
          >
            <CalendarDays size={15} />
          </IconButton>
        </Box>
      </Tooltip>
      {label && (
        <Chip
          size="small"
          label={label}
          color="primary"
          onDelete={() => onChange("")}
          sx={{ height: 22, fontSize: "0.7rem" }}
        />
      )}
    </>
  );
}
