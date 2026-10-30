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

import { useLayoutEffect, useRef, useState } from "react";
import {
  Box,
  Card,
  Chip,
  InputAdornment,
  Link,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from "@wso2/oxygen-ui";
import { ChevronRightIcon, SearchIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useDistinctLegacyParCycles, useParCyclesByStatus } from "../api/useParAdmin";
import { buildAdminHistoryRows, type AdminHistoryRow } from "../util/parAdminHistory";
import { formatShortDate } from "../util/parDate";
import { legacyCycleLabel } from "../util/parLegacyHistory";
import ParEmptyState from "../components/ParEmptyState";
import ParOrgSummary from "../components/ParOrgSummary";
import ParAdminLegacyCycleView from "../components/ParAdminLegacyCycleView";
import type { ParCycle } from "../api/types";

type Selection = { kind: "none" } | { kind: "real"; cycle: ParCycle } | { kind: "legacy"; cycleName: string; storedCycleNames: string[] };

const cycleLabel = (row: AdminHistoryRow) => (row.isLegacy ? legacyCycleLabel(row.cycleName) : row.cycleName);

// Admin Portal's History tab: every closed real cycle merged with every
// distinct legacy (pre-par-app) cycle, org-wide, latest first. Selecting a
// real cycle reopens ParOrgSummary in its read-only historyMode; selecting a
// legacy cycle opens the legacy-only drill-down, since legacy data has no
// real cycle/team model to reuse ParOrgSummary for.
export default function ParAdminHistoryTab() {
  const closedCycles = useParCyclesByStatus("CLOSED");
  const legacyCycles = useDistinctLegacyParCycles();
  const [selection, setSelection] = useState<Selection>({ kind: "none" });
  const [searchText, setSearchText] = useState("");
  // The row last opened, so coming back from a cycle scrolls the list back
  // to it instead of leaving the admin at the top of a long list. A layout
  // effect, so the scroll lands before paint rather than visibly jumping.
  const [lastOpenedKey, setLastOpenedKey] = useState<string | undefined>(undefined);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());

  useLayoutEffect(() => {
    if (selection.kind === "none" && lastOpenedKey) {
      rowRefs.current.get(lastOpenedKey)?.scrollIntoView({ block: "center" });
    }
  }, [selection.kind, lastOpenedKey]);

  if (selection.kind === "real") {
    return <ParOrgSummary cycle={selection.cycle} historyMode onBack={() => setSelection({ kind: "none" })} />;
  }
  if (selection.kind === "legacy") {
    return (
      <ParAdminLegacyCycleView
        cycleName={selection.cycleName}
        storedCycleNames={selection.storedCycleNames}
        onBack={() => setSelection({ kind: "none" })}
      />
    );
  }

  if (closedCycles.isLoading || legacyCycles.isLoading) {
    return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1.5 }} />;
  }
  if (closedCycles.isError) {
    return (
      <ErrorNotice error={closedCycles.error} onRetry={() => closedCycles.refetch()} retrying={closedCycles.isFetching}>
        Couldn't load past PAR cycles.
      </ErrorNotice>
    );
  }
  if (legacyCycles.isError) {
    return (
      <ErrorNotice error={legacyCycles.error} onRetry={() => legacyCycles.refetch()} retrying={legacyCycles.isFetching}>
        Couldn't load legacy PAR cycles.
      </ErrorNotice>
    );
  }

  // Pre-sorted by buildAdminHistoryRows on the raw end date, latest first.
  const rows = buildAdminHistoryRows(closedCycles.data ?? [], legacyCycles.data ?? []);

  if (rows.length === 0) {
    return <ParEmptyState text="No past PAR cycles found." />;
  }

  // Matches the shown title or any stored spelling, so the names admins
  // knew before the 2015 relabel still find their cycle.
  const search = searchText.trim().toLowerCase();
  const filteredRows = search
    ? rows.filter((row) => [cycleLabel(row), ...(row.storedCycleNames ?? [row.cycleName])].some((name) => name.toLowerCase().includes(search)))
    : rows;

  const handleOpen = (row: AdminHistoryRow) => {
    if (row.isLegacy) {
      setLastOpenedKey(row.key);
      setSelection({ kind: "legacy", cycleName: row.cycleName, storedCycleNames: row.storedCycleNames ?? [row.cycleName] });
    } else {
      const cycle = closedCycles.data?.find((c) => c.parCycleId === row.parCycleId);
      if (cycle) {
        setLastOpenedKey(row.key);
        setSelection({ kind: "real", cycle });
      }
    }
  };

  // Plain scrollable table, no pagination -- same as the employee's own
  // History tab (ParHistoryTab.tsx), so the full list of cycles is one
  // scroll rather than pages of ten.
  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1.5 }}>
        <TextField
          size="small"
          placeholder="Search Cycle"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon size={16} />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>
      {filteredRows.length === 0 ? (
        <ParEmptyState text="No cycles match your search." />
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Cycle Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Start Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>End Date</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow
                  key={row.key}
                  ref={(el) => {
                    if (el) rowRefs.current.set(row.key, el);
                    else rowRefs.current.delete(row.key);
                  }}
                  hover
                  selected={row.key === lastOpenedKey}
                  sx={{ cursor: "pointer" }}
                  onClick={() => handleOpen(row)}
                >
                  {/* The row keeps its native <tr> semantics; the cycle name
                      is the keyboard-reachable control. stopPropagation so a
                      click on it doesn't also fire the row's handler. */}
                  <TableCell>
                    <Link
                      component="button"
                      underline="hover"
                      color="inherit"
                      aria-label={`Open ${cycleLabel(row)}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpen(row);
                      }}
                      sx={{ textAlign: "left", font: "inherit" }}
                    >
                      {cycleLabel(row)}
                    </Link>
                    {row.isLegacy && <Chip label="Legacy" size="small" color="warning" variant="outlined" sx={{ ml: 1 }} />}
                  </TableCell>
                  <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>{row.startDate ? formatShortDate(row.startDate) : "-"}</TableCell>
                  <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>{row.endDate ? formatShortDate(row.endDate) : "-"}</TableCell>
                  <TableCell align="right">
                    <ChevronRightIcon size={16} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Card>
  );
}
