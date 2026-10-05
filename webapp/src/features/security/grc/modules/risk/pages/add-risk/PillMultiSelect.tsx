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

import { FormControl, FormHelperText, FormLabel, ToggleButton, ToggleButtonGroup, Typography } from "@wso2/oxygen-ui";
import type { JSX } from "react";

interface PillMultiSelectProps<T extends string | number> {
  label: string;
  required?: boolean;
  options: { value: T; label: string }[];
  value: T[];
  onChange: (value: T[]) => void;
  error?: string;
  ariaLabel: string;
  // Shown when there is nothing to pick yet, e.g. an admin has not added any
  // products. Without it an empty group looks like a broken form.
  emptyMessage?: string;
}

// A multi-select rendered as pills, the same look as Security Compliance
// Reference. Used for Platform, Product and Environment.
export default function PillMultiSelect<T extends string | number>({
  label,
  required,
  options,
  value,
  onChange,
  error,
  ariaLabel,
  emptyMessage,
}: PillMultiSelectProps<T>): JSX.Element {
  return (
    <FormControl error={!!error}>
      <FormLabel sx={{ mb: 1.5, fontWeight: 500 }}>
        {label}
        {required && (
          <span aria-hidden="true" style={{ marginLeft: 4 }}>
            *
          </span>
        )}
        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
          (select all that apply)
        </Typography>
      </FormLabel>
      {options.length === 0 && emptyMessage ? (
        <Typography variant="body2" color="text.secondary">
          {emptyMessage}
        </Typography>
      ) : (
        <ToggleButtonGroup
          value={value}
          onChange={(_, next: T[] | null) => onChange(next ?? [])}
          aria-label={ariaLabel}
          sx={{ flexWrap: "wrap", gap: 1 }}
        >
          {options.map((opt) => (
            <ToggleButton
              key={opt.value}
              value={opt.value}
              size="small"
              sx={{
                borderRadius: "20px !important",
                px: 2,
                border: "1px solid !important",
                "&.Mui-selected": {
                  backgroundColor: "primary.main",
                  color: "#fff",
                  borderColor: "primary.main !important",
                },
                "&.Mui-selected:hover": {
                  backgroundColor: "primary.dark",
                },
              }}
            >
              {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      )}
      {error && <FormHelperText error>{error}</FormHelperText>}
    </FormControl>
  );
}
