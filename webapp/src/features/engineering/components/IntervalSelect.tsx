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

import { FormControl, InputLabel, MenuItem, Select } from "@wso2/oxygen-ui";
import { type JSX, useId } from "react";
import type { ReleaseDownloadGrain } from "../api/productDownloadStats";
import { INTERVAL_LABEL } from "../constants/intervalLabels";

interface IntervalSelectProps {
  /** "View" on Downloads, "Interval" elsewhere, as on the standalone. */
  label: string;
  value: ReleaseDownloadGrain;
  onChange: (interval: ReleaseDownloadGrain) => void;
}

// The Interval control of the filter bar's folding row: Daily, Monthly or
// Cumulative. Labelled through InputLabel + labelId so the combobox carries
// the label as its accessible name.
export default function IntervalSelect({ label, value, onChange }: IntervalSelectProps): JSX.Element {
  const labelId = useId();
  return (
    <FormControl fullWidth size="small">
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select
        labelId={labelId}
        label={label}
        value={value}
        onChange={(event) => onChange(event.target.value as ReleaseDownloadGrain)}
      >
        {Object.entries(INTERVAL_LABEL).map(([interval, intervalLabel]) => (
          <MenuItem key={interval} value={interval}>
            {intervalLabel}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
