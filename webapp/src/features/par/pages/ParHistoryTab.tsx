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

import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import { ArrowLeftIcon, ChevronRightIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useMeProfile } from "@features/my/api/useMeProfile";
import { formatShortDate } from "../util/parDate";
import { deriveLegacyCycleDates, formatLegacyCycleName, legacyCycleLabel } from "../util/parLegacyHistory";
import { useParLegacyHistory } from "../api/useLeadHistory";
import { useClosedParCycles, useParRating } from "../api/useParData";
import ParRatingSummary from "../components/ParRatingSummary";
import ParLegacyRecordDetail from "../components/ParLegacyRecordDetail";
import type { ParCycle, ParLegacyHistory } from "../api/types";

type Row =
  | { kind: "real"; cycle: ParCycle; cycleName: string; start: string | null; end: string | null }
  | { kind: "legacy"; record: ParLegacyHistory; cycleName: string; start: string | null; end: string | null };

// People Ops → Performance → History: "My History" tab (the lead-only
// "Report Chain" tab belongs with the Lead Portal work, not here). Merges
// in the employee's own legacy PAR history (2015+) alongside current-system
// cycles, in the same table-row layout this tab always had. The backend
// permits this for the signed-in user's own email (or an admin).
const rowLabel = (row: Row) => (row.kind === "legacy" ? legacyCycleLabel(row.cycleName) : row.cycleName);

export default function ParHistoryTab() {
  const profile = useMeProfile();
  const workEmail = profile.data?.userInfo.workEmail;
  const realCycles = useClosedParCycles(workEmail, Boolean(workEmail));
  const legacyHistory = useParLegacyHistory(workEmail, Boolean(workEmail));
  const [opened, setOpened] = useState<Row | undefined>(undefined);

  // Hoisted above every early return (Rules of Hooks) and memoized so
  // re-renders (e.g. opening/closing a record) don't re-sort/re-derive the
  // whole list every time.
  const rows = useMemo<Row[]>(() => {
    const realRows: Row[] = (realCycles.data ?? []).map((cycle) => ({
      kind: "real",
      cycle,
      cycleName: cycle.parCycleName,
      start: cycle.parCycleStartDate,
      end: cycle.parCycleEndDate,
    }));
    const legacyRows: Row[] = (legacyHistory.data ?? []).map((record) => {
      // Real migrated data can carry either the raw or canonical 2015 cycle
      // name -- normalize before computing dates or showing it anywhere.
      const cycleName = formatLegacyCycleName(record.cycleName);
      const { startDate, endDate } = deriveLegacyCycleDates(cycleName);
      return { kind: "legacy", record, cycleName, start: startDate, end: endDate };
    });
    return [...realRows, ...legacyRows].sort((a, b) => {
      if (!a.start) return 1;
      if (!b.start) return -1;
      return b.start.localeCompare(a.start);
    });
  }, [realCycles.data, legacyHistory.data]);

  if (profile.isLoading || realCycles.isLoading || legacyHistory.isLoading) {
    return <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />;
  }
  if (profile.isError) {
    return (
      <ErrorNotice error={profile.error} onRetry={() => profile.refetch()} retrying={profile.isFetching}>
        Couldn't load your profile.
      </ErrorNotice>
    );
  }
  if (realCycles.isError) {
    return (
      <ErrorNotice error={realCycles.error} onRetry={() => realCycles.refetch()} retrying={realCycles.isFetching}>
        Couldn't load your past PAR cycles.
      </ErrorNotice>
    );
  }
  if (opened) {
    return (
      <Box>
        <Button
          size="small"
          startIcon={<ArrowLeftIcon size={14} />}
          onClick={() => setOpened(undefined)}
          sx={{ mb: 1.5 }}
        >
          History
        </Button>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
            {rowLabel(opened)}
          </Typography>
          {opened.kind === "legacy" && (
            <Chip
              label="Legacy - PeopleHR"
              size="small"
              color="warning"
              variant="outlined"
              sx={{ height: 20, fontSize: 10.5, fontWeight: 600 }}
            />
          )}
        </Stack>
        {opened.kind === "real" ? (
          <Box sx={{ maxWidth: 880 }}>
            <RealCycleDetail cycle={opened.cycle} workEmail={workEmail} />
          </Box>
        ) : (
          <ParLegacyRecordDetail record={opened.record} hideThreeSixtyFeedback />
        )}
      </Box>
    );
  }

  // legacyHistory.data === null means enableLegacyParDataView is off
  // server-side (see useParLegacyHistory's own comment) -- not "no legacy
  // records". Shows the same notice this tab always had before legacy
  // support was added here.
  const legacyDisabled = legacyHistory.data === null;

  // Unlike the single-column rating-summary detail view above (which stays
  // reading-width capped), the history LIST uses the full page width, same
  // as every other admin DataGrid screen in this feature (e.g.
  // ParOrgEmployeeViewTab.tsx) -- a fixed 880px cap made the table look
  // boxed-in with a large dead strip of empty page to its right.
  return (
    <Box>
      {legacyDisabled && (
        <Alert severity="info" sx={{ mb: 2 }}>
          PAR history data is available only for PAR cycles from 2024 H2 onwards. Please refer to
          PeopleHR for the history data.
        </Alert>
      )}
      {legacyHistory.isError && (
        <ErrorNotice
          sx={{ mb: 2 }}
          error={legacyHistory.error}
          onRetry={() => legacyHistory.refetch()}
          retrying={legacyHistory.isFetching}
        >
          Couldn't load your legacy PAR history.
        </ErrorNotice>
      )}
      {rows.length === 0 ? <Alert severity="info">No past PAR cycles on file.</Alert> : <HistoryTable rows={rows} onOpen={setOpened} />}
    </Box>
  );
}

// Plain scrollable table, no pagination -- reverted per explicit request:
// a paginated DataGrid felt less human-friendly here than just scrolling
// the full list. The admin History list (ParAdminHistoryTab) does the same;
// pagination stays only inside a cycle's own drill-down grids.
function HistoryTable({ rows, onOpen }: { rows: Row[]; onOpen: (row: Row) => void }) {
  // Default (not size="small") row height -- "small" made every row
  // noticeably more cramped for this plain <Table stickyHeader> list.
  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Cycle</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Start</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>End</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.kind === "real" ? `real-${row.cycle.parCycleId}` : `legacy-${row.record.legacyHeaderId}`}
              hover
              tabIndex={0}
              role="button"
              aria-label={`Open ${rowLabel(row)} review`}
              sx={{ cursor: "pointer" }}
              onClick={() => onOpen(row)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(row);
                }
              }}
            >
              <TableCell>
                {rowLabel(row)}
                {row.kind === "legacy" && (
                  <Chip
                    label="Legacy"
                    size="small"
                    color="warning"
                    variant="outlined"
                    sx={{ ml: 1, height: 20, fontSize: 10.5, fontWeight: 600 }}
                  />
                )}
              </TableCell>
              <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>{formatShortDate(row.start ?? undefined)}</TableCell>
              <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>{formatShortDate(row.end ?? undefined)}</TableCell>
              <TableCell align="right">
                <ChevronRightIcon size={16} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function RealCycleDetail({ cycle, workEmail }: { cycle: ParCycle; workEmail: string | undefined }) {
  const rating = useParRating(cycle.parCycleId, workEmail);

  if (rating.isLoading) {
    return <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1.5 }} />;
  }
  if (rating.isError) {
    return (
      <ErrorNotice error={rating.error} onRetry={() => rating.refetch()} retrying={rating.isFetching}>
        Couldn't load your record for this cycle.
      </ErrorNotice>
    );
  }
  if (!rating.data) {
    return <Alert severity="info">No record was found for you in this cycle.</Alert>;
  }
  return <ParRatingSummary cycle={cycle} rating={rating.data} />;
}
