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

import type { ReactNode } from "react";
import { Box, Button, InputAdornment, TextField, ToggleButton, ToggleButtonGroup } from "@wso2/oxygen-ui";
import { SearchIcon } from "@wso2/oxygen-ui-icons-react";
import LeaveDateField from "@features/leave/components/LeaveDateField";
import { NO_OKR_FILTERS, isFilteringOkrs, type OkrFilters, type OkrStatusFilter } from "../util/okr";

// Search, where each stands, and a due-date range, for a list of OKRs. Shared
// by My OKRs and Manage OKRs. All leaves out closed ones, which show under
// Closed. The dates use the same picker as Leave, whose
// label sits above the field, so the row lines its controls up at the bottom.
export default function OkrFilterBar({
  filters,
  onChange,
  searchLabel,
  extra,
  actions,
}: {
  filters: OkrFilters;
  onChange: (filters: OkrFilters) => void;
  searchLabel: string;
  /** Controls placed after the search box (Manage OKRs: My team / Everyone). */
  extra?: ReactNode;
  /** Controls at the far end (Manage OKRs: Set an OKR). */
  actions?: ReactNode;
}) {
  const set = (change: Partial<OkrFilters>) => onChange({ ...filters, ...change });
  return (
    <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-end", flexWrap: "wrap" }}>
      <TextField
        size="small"
        placeholder={searchLabel}
        value={filters.search}
        onChange={(e) => set({ search: e.target.value })}
        sx={{ minWidth: 240, flex: { xs: 1, sm: "0 1 300px" } }}
        slotProps={{
          htmlInput: { "aria-label": searchLabel },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon size={16} />
              </InputAdornment>
            ),
          },
        }}
      />
      {extra}
      <ToggleButtonGroup
        size="small"
        exclusive
        value={filters.status}
        onChange={(_e, v: OkrStatusFilter | null) => v && set({ status: v })}
        aria-label="Show"
      >
        <ToggleButton value="all">All</ToggleButton>
        <ToggleButton value="open">Open</ToggleButton>
        <ToggleButton value="completed">Completed</ToggleButton>
        <ToggleButton value="closed">Closed</ToggleButton>
      </ToggleButtonGroup>
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end", flexWrap: "wrap" }}>
        <Box sx={{ width: 170 }}>
          <LeaveDateField
            label="Due from"
            value={filters.dueFrom}
            max={filters.dueTo || undefined}
            onChange={(v) => set({ dueFrom: v })}
          />
        </Box>
        <Box sx={{ width: 170 }}>
          <LeaveDateField
            label="Due to"
            value={filters.dueTo}
            min={filters.dueFrom || undefined}
            onChange={(v) => set({ dueTo: v })}
          />
        </Box>
      </Box>
      {isFilteringOkrs(filters) && (
        <Button size="small" onClick={() => onChange(NO_OKR_FILTERS)}>
          Clear filters
        </Button>
      )}
      {actions && (
        <>
          <Box sx={{ flex: 1 }} />
          {actions}
        </>
      )}
    </Box>
  );
}
