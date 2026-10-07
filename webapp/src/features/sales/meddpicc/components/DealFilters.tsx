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

import { useState, type FormEvent } from "react";
import {
  Box,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
} from "@wso2/oxygen-ui";
import { SearchIcon, XIcon } from "@wso2/oxygen-ui-icons-react";

const ALL = "__all__";

export interface OwnerOption {
  email: string;
  name: string;
}

/**
 * The filters above the deal list: search, owner, stage and "hide closed".
 *
 * Search submits as a form, like MeetingFilters, so each keystroke isn't a
 * request. The select filters apply at once — one change, one request.
 */
export default function DealFilters({
  search,
  onSearchChange,
  owner,
  onOwnerChange,
  owners,
  stage,
  onStageChange,
  stages,
  hideClosed,
  onHideClosedChange,
}: {
  /** The APPLIED search, not the draft. */
  search: string | null;
  onSearchChange: (search: string | null) => void;
  /** Owner email, or null for everyone. */
  owner: string | null;
  onOwnerChange: (owner: string | null) => void;
  owners: OwnerOption[];
  stage: string | null;
  onStageChange: (stage: string | null) => void;
  stages: string[];
  hideClosed: boolean;
  onHideClosedChange: (hideClosed: boolean) => void;
}) {
  const [draft, setDraft] = useState(search ?? "");
  // Resynced during render when the applied search changes from outside, as MeetingFilters does.
  const applied = search ?? "";
  const [lastApplied, setLastApplied] = useState(applied);
  if (applied !== lastApplied) {
    setLastApplied(applied);
    setDraft(applied);
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = draft.trim();
    onSearchChange(trimmed ? trimmed : null);
  };

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", mb: 2 }}>
      <Box component="form" role="search" onSubmit={submit} sx={{ flex: 1, minWidth: 240 }}>
        <TextField
          fullWidth
          size="small"
          type="search"
          label="Search"
          placeholder="Deal or account name"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  {draft && (
                    <IconButton
                      size="small"
                      onClick={() => {
                        setDraft("");
                        onSearchChange(null);
                      }}
                      aria-label="Clear search"
                    >
                      <XIcon size={16} />
                    </IconButton>
                  )}
                  <IconButton size="small" type="submit" aria-label="Search deals">
                    <SearchIcon size={16} />
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel id="deals-owner-label">Owner</InputLabel>
        <Select
          labelId="deals-owner-label"
          label="Owner"
          value={owner ?? ALL}
          onChange={(event) => {
            const value = event.target.value as string;
            onOwnerChange(value === ALL ? null : value);
          }}
        >
          <MenuItem value={ALL}>All owners</MenuItem>
          {owners.map((o) => (
            <MenuItem key={o.email} value={o.email}>
              {o.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel id="deals-stage-label">Stage</InputLabel>
        <Select
          labelId="deals-stage-label"
          label="Stage"
          value={stage ?? ALL}
          onChange={(event) => {
            const value = event.target.value as string;
            onStageChange(value === ALL ? null : value);
          }}
        >
          <MenuItem value={ALL}>All stages</MenuItem>
          {stages.map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControlLabel
        control={
          <Switch size="small" checked={hideClosed} onChange={(event) => onHideClosedChange(event.target.checked)} />
        }
        label="Hide closed"
      />
    </Box>
  );
}
