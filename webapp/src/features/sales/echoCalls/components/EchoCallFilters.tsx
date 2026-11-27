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

import { useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  ListItemText,
  MenuItem,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { SearchIcon } from "@wso2/oxygen-ui-icons-react";
import { useDebouncedValue } from "@hooks/useDebouncedValue";
import { meetingTypeLabel } from "../../api/salesTypes";
import { useCallFilterOptions } from "../api/useEchoCalls";
import { hasEchoFilters, type CallFilters } from "../util/callFilters";

interface Choice {
  value: string;
  label: string;
  secondary?: string | null;
  calls?: number;
}

/**
 * Pick any number of a list, e.g. several AMs. Shows "All …" when nothing is picked, the
 * one pick by name, or the first and how many more, so the bar keeps its width.
 *
 * A pick the options no longer carry (a link shared last month) is still listed, so it
 * can be unticked rather than filtering invisibly.
 */
function MultiChoice({
  label,
  allLabel,
  value,
  options,
  onChange,
  width,
  disabled,
}: {
  label: string;
  allLabel: string;
  value: string[];
  options: Choice[];
  onChange: (value: string[]) => void;
  width: number;
  disabled?: boolean;
}) {
  const known = new Set(options.map((o) => o.value));
  const all: Choice[] = [...options, ...value.filter((v) => !known.has(v)).map((v) => ({ value: v, label: v }))];
  const labelOf = (v: string) => all.find((o) => o.value === v)?.label ?? v;

  return (
    <TextField
      select
      size="small"
      label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => {
        // A multiple select hands back an array (a string only from browser autofill).
        const next = event.target.value as unknown as string[] | string;
        onChange(typeof next === "string" ? next.split(",") : next);
      }}
      slotProps={{
        select: {
          multiple: true,
          displayEmpty: true,
          renderValue: (selected) => {
            const picks = selected as string[];
            if (picks.length === 0) {
              return (
                <Box component="span" sx={{ color: "text.secondary" }}>
                  {allLabel}
                </Box>
              );
            }
            return picks.length === 1 ? labelOf(picks[0]) : `${labelOf(picks[0])} +${picks.length - 1}`;
          },
          MenuProps: { slotProps: { paper: { sx: { maxHeight: 380 } } } },
        },
        inputLabel: { shrink: true },
      }}
      sx={{ width, maxWidth: "100%" }}
    >
      {all.map((option) => (
        <MenuItem key={option.value} value={option.value} dense>
          <Checkbox size="small" checked={value.includes(option.value)} sx={{ p: 0.5, mr: 1 }} />
          <ListItemText
            primary={option.label}
            secondary={option.secondary ?? undefined}
            slotProps={{ secondary: { variant: "caption" } }}
          />
          {option.calls !== undefined && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
              {option.calls}
            </Typography>
          )}
        </MenuItem>
      ))}
    </TextField>
  );
}

type PickKind = "account" | "opportunity";

interface Pick {
  kind: PickKind;
  id: string;
  name: string;
  calls?: number;
}

/**
 * Accounts and opportunities, searched by name as you type, any number of each. The backend
 * answers with the top matches of each, most calls first. An account matches its own calls
 * and its opportunities' calls.
 */
function AccountOpportunityPicker({
  filters,
  onChange,
  knownNames,
  disabled,
}: {
  filters: CallFilters;
  onChange: (patch: Partial<CallFilters>) => void;
  knownNames: Record<string, string>;
  disabled?: boolean;
}) {
  const [term, setTerm] = useState("");
  const settled = useDebouncedValue(term, 300);
  const options = useCallFilterOptions(settled, !disabled);

  const picks: Pick[] = [
    ...(options.data?.accounts ?? []).map((a) => ({ kind: "account" as const, ...a })),
    ...(options.data?.opportunities ?? []).map((o) => ({ kind: "opportunity" as const, ...o })),
  ];
  // A pick the current answer doesn't list (another term, or a shared link) keeps its name
  // from the calls on screen, else shows its id.
  const chosen = (kind: PickKind, id: string): Pick =>
    picks.find((p) => p.kind === kind && p.id === id) ?? { kind, id, name: knownNames[id] ?? id };
  const value: Pick[] = [
    ...filters.accounts.map((id) => chosen("account", id)),
    ...filters.opportunities.map((id) => chosen("opportunity", id)),
  ];

  return (
    <Autocomplete
      multiple
      size="small"
      // One chip and "+N" when not focused, so the bar keeps its width.
      limitTags={1}
      disableCloseOnSelect
      options={picks}
      value={value}
      disabled={disabled}
      // The backend already matched the term; filtering again here would hide its answers.
      filterOptions={(x) => x}
      groupBy={(p) => (p.kind === "account" ? "Accounts" : "Opportunities")}
      getOptionLabel={(p) => p.name}
      isOptionEqualToValue={(a, b) => a.kind === b.kind && a.id === b.id}
      getOptionKey={(p) => `${p.kind}:${p.id}`}
      loading={options.isFetching}
      onInputChange={(_, next, reason) => {
        // Only typing searches; a pick or a clear empties the box, and the search with it.
        setTerm(reason === "input" ? next : "");
      }}
      onChange={(_, next) =>
        onChange({
          accounts: next.filter((p) => p.kind === "account").map((p) => p.id),
          opportunities: next.filter((p) => p.kind === "opportunity").map((p) => p.id),
        })
      }
      noOptionsText={options.error ? "Couldn't load accounts and opportunities." : "No matching account or opportunity"}
      renderOption={({ key, ...props }, p) => (
        <li key={key} {...props}>
          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, width: "100%", minWidth: 0 }}>
            <Typography variant="body2" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {p.name}
            </Typography>
            {p.calls !== undefined && (
              <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                {p.calls} {p.calls === 1 ? "call" : "calls"}
              </Typography>
            )}
          </Box>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Account or opportunity"
          placeholder={value.length === 0 ? "Search by name" : undefined}
          InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <>
                <SearchIcon size={16} style={{ marginLeft: 4, marginRight: 2 }} />
                {params.InputProps.startAdornment}
              </>
            ),
          }}
        />
      )}
      sx={{
        width: 280,
        maxWidth: "100%",
        // One line at rest, as tall as the selects beside it; every pick shows while editing.
        "& .MuiAutocomplete-inputRoot:not(.Mui-focused)": { flexWrap: "nowrap" },
        "& .MuiAutocomplete-tag": { maxWidth: 150 },
      }}
    />
  );
}

/**
 * The Echo scope's own filters, under the scope and search: Opportunity Owner (AM), Region,
 * one account or opportunity, call type, and a date range. Every change applies at once
 * (one change, one request, as DealFilters' selects do) and goes to the URL through
 * `onChange`; the page resets to its first page.
 *
 * `knownNames` names picked accounts and opportunities the options don't list, from the
 * calls on screen, which all belong to one of them.
 */
export default function EchoCallFilters({
  filters,
  onChange,
  knownNames,
  disabled,
}: {
  filters: CallFilters;
  onChange: (patch: Partial<CallFilters>) => void;
  knownNames: Record<string, string>;
  disabled?: boolean;
}) {
  // The complete owner, region and call type lists: the unnarrowed answer.
  const options = useCallFilterOptions("", !disabled);
  const owners: Choice[] = (options.data?.owners ?? []).map((o) => ({
    value: o.email,
    label: o.name?.trim() || o.email,
    secondary: o.name?.trim() ? o.email : null,
    calls: o.calls,
  }));
  const regions: Choice[] = (options.data?.regions ?? []).map((r) => ({ value: r.region, label: r.region, calls: r.calls }));
  const types: Choice[] = (options.data?.callTypes ?? []).map((t) => ({
    value: t.type,
    label: meetingTypeLabel(t.type) ?? t.type,
    calls: t.calls,
  }));

  return (
    <Box
      role="group"
      aria-label="Filter calls"
      sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", mb: 2 }}
    >
      <MultiChoice
        label="Opportunity Owner (AM)"
        allLabel="All owners"
        value={filters.owners}
        options={owners}
        onChange={(next) => onChange({ owners: next })}
        width={220}
        disabled={disabled}
      />
      <MultiChoice
        label="Region"
        allLabel="All regions"
        value={filters.regions}
        options={regions}
        onChange={(next) => onChange({ regions: next })}
        width={150}
        disabled={disabled}
      />
      <AccountOpportunityPicker filters={filters} onChange={onChange} knownNames={knownNames} disabled={disabled} />
      <MultiChoice
        label="Call type"
        allLabel="All call types"
        value={filters.types}
        options={types}
        onChange={(next) => onChange({ types: next })}
        width={170}
        disabled={disabled}
      />
      <TextField
        size="small"
        type="date"
        label="From"
        value={filters.from ?? ""}
        disabled={disabled}
        onChange={(event) => onChange({ from: event.target.value || null })}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: filters.to ?? undefined } }}
        sx={{ width: 160 }}
      />
      <TextField
        size="small"
        type="date"
        label="To"
        value={filters.to ?? ""}
        disabled={disabled}
        onChange={(event) => onChange({ to: event.target.value || null })}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: filters.from ?? undefined } }}
        sx={{ width: 160 }}
      />
      {/* Without the options the selects offer nothing to pick, which would look like no
          owners, regions or call types at all: say so, and offer to ask again. What is
          already picked stays picked and applied. */}
      {options.error && !options.data && (
        <Alert
          severity="error"
          sx={{ py: 0, alignItems: "center" }}
          action={
            <Button color="inherit" size="small" onClick={() => void options.refetch()}>
              Retry
            </Button>
          }
        >
          Couldn't load the filter options.
        </Alert>
      )}
      {hasEchoFilters(filters) && (
        <Button
          size="small"
          onClick={() =>
            onChange({ owners: [], regions: [], types: [], accounts: [], opportunities: [], from: null, to: null })
          }
          sx={{ textTransform: "none" }}
        >
          Clear filters
        </Button>
      )}
    </Box>
  );
}
