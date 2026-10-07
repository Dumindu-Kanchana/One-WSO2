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

import { Box, Button, Divider, Grid, Paper, TextField } from "@wso2/oxygen-ui";
import { ChevronDown, ChevronUp, ListFilter } from "@wso2/oxygen-ui-icons-react";
import { type JSX, type ReactNode, useState } from "react";
import { type StatsFilters } from "../utils/filters";
import RepoMultiSelect from "./RepoMultiSelect";

export type FilterUpdate = Record<string, string | number[] | null>;

interface FilterBarProps {
  filters: StatsFilters;
  onChange: (updates: FilterUpdate) => void;
  /**
   * Replaces the product picker in the always-visible row. Versions and
   * Packages put a Product select and a multi-select there.
   */
  pickerSlot?: ReactNode;
  /** Additional <Grid size={...}> items rendered inside the collapsible filter row. */
  filterSlot?: ReactNode;
}

// The filter card every analytics screen opens with (ADR 0002): the product
// picker and a "Filters" button that folds the From and To dates and the
// screen's own controls away. Open by default, as on the standalone.
export default function FilterBar({
  filters,
  onChange,
  pickerSlot,
  filterSlot,
}: FilterBarProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      {/* Always-visible row: product picker (or the screen's own) + filter toggle */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <Box
          sx={{
            flex: 1,
            minWidth: 240,
            display: "flex",
            alignItems: "center",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          {pickerSlot ?? (
            <RepoMultiSelect value={filters.repos} onChange={(repos) => onChange({ repos })} />
          )}
        </Box>
        <Button
          variant="outlined"
          size="small"
          color="primary"
          onClick={() => setIsOpen((o) => !o)}
          startIcon={<ListFilter size={16} />}
          endIcon={isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        >
          Filters
        </Button>
      </Box>

      {/* Collapsible: date range + page-specific filter controls */}
      {isOpen && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, sm: 6, md: 3, lg: 2 }}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="From"
                slotProps={{ inputLabel: { shrink: true } }}
                value={filters.from}
                onChange={(e) => onChange({ from: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3, lg: 2 }}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="To"
                slotProps={{ inputLabel: { shrink: true } }}
                value={filters.to}
                onChange={(e) => onChange({ to: e.target.value })}
              />
            </Grid>
            {filterSlot}
          </Grid>
        </>
      )}
    </Paper>
  );
}
