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
  Box,
  Button,
  Card,
  Chip,
  DataGrid,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { CalendarIcon, EyeIcon, SearchIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useMeProfile } from "@features/my/api/useMeProfile";
import { formatShortDate } from "../util/parDate";
import { useActiveParCycle } from "../api/useParData";
import { useParTeams } from "../api/useLeadTeams";
import { useSend360Reminder } from "../api/useLeadReminders";
import { calculateTeamsCompletionTotals } from "../util/parTeamsSummary";
import ParCycleDatesDialog from "../components/ParCycleDatesDialog";
import ParCompletionKpiTile from "../components/ParCompletionKpiTile";
import ParEmptyState from "../components/ParEmptyState";
import ParLeadTeamRoster from "../components/ParLeadTeamRoster";
import ParLeadReviewTabs from "../components/ParLeadReviewTabs";
import type { ParTeamSummary } from "../api/types";

export default function ParLeadDirectReportsTab() {
  const profile = useMeProfile();
  const workEmail = profile.data?.userInfo.workEmail;
  const activeCycles = useActiveParCycle(workEmail);
  const cycle = activeCycles.data?.[0];
  const teams = useParTeams(cycle?.parCycleId, workEmail);
  const send360Reminder = useSend360Reminder();
  const { showSuccess, showError } = useNotifications();

  const [cycleDatesOpen, setCycleDatesOpen] = useState(false);
  const [reminderConfirmOpen, setReminderConfirmOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<ParTeamSummary | undefined>(undefined);
  const [quickFilter, setQuickFilter] = useState("");
  const [reviewEmployeeEmail, setReviewEmployeeEmail] = useState<string | undefined>(undefined);

  if (activeCycles.isLoading || profile.isLoading) {
    return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1.5 }} />;
  }
  if (profile.isError) {
    return (
      <ErrorNotice error={profile.error} onRetry={() => profile.refetch()} retrying={profile.isFetching}>
        Couldn't load your profile.
      </ErrorNotice>
    );
  }
  if (activeCycles.isError) {
    return (
      <ErrorNotice error={activeCycles.error} onRetry={() => activeCycles.refetch()} retrying={activeCycles.isFetching}>
        Couldn't load the current PAR cycle.
      </ErrorNotice>
    );
  }
  if (!cycle) {
    return <Alert severity="info">Currently there is no ongoing PAR cycle</Alert>;
  }
  if (teams.isLoading) {
    return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1.5 }} />;
  }
  if (teams.isError) {
    return (
      <ErrorNotice error={teams.error} onRetry={() => teams.refetch()} retrying={teams.isFetching}>
        Couldn't load your teams.
      </ErrorNotice>
    );
  }

  const rows = teams.data ?? [];
  if (rows.length === 0) {
    return <ParEmptyState text="No teams found under your lead" />;
  }
  const singleTeam = rows.length === 1 ? rows[0] : undefined;
  const team = selectedTeam ?? singleTeam;

  if (reviewEmployeeEmail) {
    return (
      <ParLeadReviewTabs cycle={cycle} employeeEmail={reviewEmployeeEmail} onBack={() => setReviewEmployeeEmail(undefined)} />
    );
  }

  if (team) {
    return (
      <ParLeadTeamRoster
        cycle={cycle}
        team={team}
        showBack={!singleTeam}
        onBack={() => setSelectedTeam(undefined)}
        onOpenReview={setReviewEmployeeEmail}
      />
    );
  }

  // MultiTeamSummary.tsx's own onFilterModelChange: every field of the row
  // is searched, not just the ones shown as columns — and the search box
  // narrows the completion cards above too, not just the grid.
  const filteredRows = quickFilter
    ? rows.filter((row) =>
        Object.values(row).some((value) => String(value).toLowerCase().includes(quickFilter.toLowerCase())),
      )
    : rows;
  const totals = calculateTeamsCompletionTotals(filteredRows);

  const columns: DataGrid.GridColDef<ParTeamSummary>[] = [
    { field: "parBusinessUnit", headerName: "BU", flex: 1 },
    { field: "parDepartment", headerName: "Department", flex: 1 },
    { field: "parTeam", headerName: "Team", flex: 1 },
    { field: "parSubTeam", headerName: "Sub Team", flex: 1 },
    {
      field: "employeePar",
      headerName: "Employee PAR",
      flex: 0.8,
      valueGetter: (_v, row) => `${row.summary.employeeParCompletedCount}/${row.numberOfTeamMembers}`,
    },
    {
      field: "leadFeedback",
      headerName: "Lead's Feedback",
      flex: 0.8,
      valueGetter: (_v, row) => `${row.summary.leadsReviewCompletedCount}/${row.numberOfTeamMembers}`,
    },
    {
      field: "f2f",
      headerName: "F2F",
      flex: 0.6,
      valueGetter: (_v, row) => `${row.summary.f2fCompletedCount}/${row.numberOfTeamMembers}`,
    },
    {
      field: "open",
      headerName: "",
      sortable: false,
      flex: 0.3,
      display: "flex",
      align: "center",
      // The row already opens on click; this just makes that visible.
      renderCell: () => (
        <Box sx={{ display: "flex", color: "text.secondary" }}>
          <EyeIcon size={18} />
        </Box>
      ),
    },
  ];

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Chip label={cycle.parCycleName} size="small" color="primary" variant="outlined" />
          <Typography component="span" variant="caption" color="text.secondary">
            ({formatShortDate(cycle.parCycleStartDate)} - {formatShortDate(cycle.parCycleEndDate)})
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Open Cycle Dates" arrow>
            <IconButton onClick={() => setCycleDatesOpen(true)} aria-label="cycle dates">
              <CalendarIcon size={18} />
            </IconButton>
          </Tooltip>
          <Button variant="contained" onClick={() => setReminderConfirmOpen(true)}>
            Send 360° Reminder
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <ParCompletionKpiTile
            label="Employee PAR"
            completed={totals.totalEmployeeParComplete}
            total={totals.totalEmployees}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <ParCompletionKpiTile
            label="Lead's PAR"
            completed={totals.totalLeadReviewComplete}
            total={totals.totalEmployees}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <ParCompletionKpiTile
            label="F2F"
            completed={totals.totalF2fComplete}
            total={totals.totalEmployees}
          />
        </Grid>
      </Grid>

      <Card variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="h6">Teams</Typography>
          <TextField
            size="small"
            placeholder="Search Teams"
            value={quickFilter}
            onChange={(e) => setQuickFilter(e.target.value)}
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
        </Stack>
        <DataGrid.DataGrid
          rows={filteredRows}
          columns={columns}
          getRowId={(row) => row.parTeamId}
          rowHeight={60}
          disableRowSelectionOnClick
          onRowClick={(params) => setSelectedTeam(params.row)}
          sx={{ border: "none", "& .MuiDataGrid-row": { cursor: "pointer" } }}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          pageSizeOptions={[10, 20, 25]}
        />
      </Card>

      <ParCycleDatesDialog
        cycle={cycle}
        open={cycleDatesOpen}
        onClose={() => setCycleDatesOpen(false)}
      />

      {/* ConfirmationDialog.tsx's own maxWidth="md" — every confirmation in
          source uses this same shared component and size, not a narrower
          one-off. */}
      <Dialog open={reminderConfirmOpen} onClose={() => setReminderConfirmOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Send 360° Feedback Reminder?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            If you send 360° reminders, employees who haven't yet responded to their 360° feedback
            requests will receive a reminder. Do you wish to continue?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setReminderConfirmOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={send360Reminder.isPending}
            onClick={() =>
              send360Reminder.mutate(undefined, {
                onSuccess: () => {
                  setReminderConfirmOpen(false);
                  showSuccess("Successfully sent");
                },
                onError: (err) => showError(describeError(err)),
              })
            }
          >
            {send360Reminder.isPending ? "Sending…" : "Send"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
