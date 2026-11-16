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

import type { SxProps, Theme } from "@wso2/oxygen-ui";
import { Box } from "@wso2/oxygen-ui";
import LeaveDateField from "@features/leave/components/LeaveDateField";

// PAR's date fields (the cycle dialogs and the F2F dates) with the same
// calendar picker as Leave. The label sits inside the border like the other
// fields in these forms, or is left out where the screen labels the field
// itself. A typed date outside min/max is never handed on, since no PAR
// backend re-checks the range, and the field says why it was refused.
export default function ParDateField({
  value,
  onChange,
  min,
  max,
  disabled = false,
  error = false,
  helperText,
  label,
  ariaLabel,
  fullWidth = false,
  sx,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  label?: string;
  ariaLabel: string;
  fullWidth?: boolean;
  sx?: SxProps<Theme>;
}) {
  return (
    <Box sx={[{ width: fullWidth ? "100%" : 200 }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
      <LeaveDateField
        label={label}
        ariaLabel={ariaLabel}
        floatingLabel
        explainRange
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        error={error}
        helperText={helperText}
        onChange={onChange}
      />
    </Box>
  );
}
