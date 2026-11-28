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
import { useRedrawAt } from "../hooks/useRedrawAt";
import {
  Avatar,
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
import { CalendarIcon, CopyIcon, EyeIcon, PencilIcon, SearchIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { isPreviewEnabled } from "@config/previewFeatures";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useLeaveEmployees } from "@features/leave/api/useLeaveData";
import { useMeProfile } from "@features/my/api/useMeProfile";
import { useParTeamsDetails } from "../api/useLeadTeams";
import { useSend360Reminder } from "../api/useLeadReminders";
import { useLeadRatingUpdate, useRefreshAfterRatingUpdates } from "../api/useLeadRatingUpdate";
import { useParShowsPar2, useReviewIndexes } from "../api/useReview360";
import { cycleSurvey, useLeadership360Results, useLeadership360Surveys } from "../api/useLeadership360";
import { formatIndex } from "../util/review360Form";
import { calculateCycleActiveStep } from "../util/parCycleActiveStep";
import { resolveGridSelectedIds } from "../util/parGridSelection";
import { deadlinePassedEverywhereAt, isDeadlinePassed } from "../util/parDeadline";
import { formatShortDate, formatShortDateTime } from "../util/parDate";
import { shareOpensAfter } from "../util/parDepartments";
import ParCycleDatesDialog from "./ParCycleDatesDialog";
import ParStatusChip from "./ParStatusChip";
import ParCompletionKpiTile from "./ParCompletionKpiTile";
import ParSyncEmployeeDialog from "./ParSyncEmployeeDialog";
import type { ParCycle, ParRatingMinimal, ParTeamSummary } from "../api/types";

// Shared "done" vocabulary across employee/lead/360 status fields (mirrors
// ParStatusChip's own COMPLETED_VALUES) — used for each row's
// stage-completion count.
const DONE_STATUSES = new Set(["SHARED", "SHARED_BLOCKED", "COMPLETED"]);

// How many of the five review stages this employee has finished — the same
// journey the roster used to spread across five unconnected chip columns,
// now also a single completion bar under their name.
function countCompletedStages(row: ParRatingMinimal): number {
  let n = 0;
  if (DONE_STATUSES.has(row.parEmployeeStatus)) n++;
  if (DONE_STATUSES.has(row.par360ReviewStatus)) n++;
  if (DONE_STATUSES.has(row.parLeadStatus)) n++;
  if (row.parRating && row.parRating !== "NOT_ASSIGNED") n++;
  if (row.parF2fStatus === "COMPLETED") n++;
  return n;
}

// This row's own progress through the same five stages the columns to the
// right break out individually — one glance at whether this person's
// review is moving at all.
function StageProgress({ row }: { row: ParRatingMinimal }) {
  const done = countCompletedStages(row);
  return (
    <Box
      sx={{
        width: 120,
        height: 4,
        borderRadius: 2,
        bgcolor: "action.hover",
        overflow: "hidden",
        mt: 0.5,
      }}
    >
      <Box
        sx={{
          width: `${(done / 5) * 100}%`,
          height: "100%",
          bgcolor: done === 5 ? "success.main" : done === 0 ? "action.disabled" : "primary.main",
        }}
      />
    </Box>
  );
}

/** A member with the team they're in. */
type Member = ParRatingMinimal & { team: ParTeamSummary };

/** A team by its department, team and sub-team: what tells a lead's teams apart. */
const teamName = (team: ParTeamSummary) =>
  [team.parDepartment, team.parTeam, team.parSubTeam].filter(Boolean).join(" / ");

// A lead's direct reports, across all their teams, in one list (a Team column tells them apart when there are
// several): the completion cards, the members, and the tools that act on them.
export default function ParLeadTeamRoster({
  cycle,
  teams,
  onOpenReview,
}: {
  cycle: ParCycle;
  teams: ParTeamSummary[];
  onOpenReview: (employeeEmail: string) => void;
}) {
  const details = useParTeamsDetails(cycle.parCycleId, teams.map((t) => t.parTeamId));
  const single = teams.length === 1 ? teams[0] : undefined;
  const send360Reminder = useSend360Reminder();
  const ratingUpdate = useLeadRatingUpdate(cycle.parCycleId);
  const refreshAfterRatingUpdates = useRefreshAfterRatingUpdates(cycle.parCycleId);
  const { showSuccess, showError } = useNotifications();
  const leadEmail = useMeProfile().data?.userInfo.workEmail;
  // A PAR 2.0 cycle adds each member's 360° index and the team's headline counts.
  const { showsPar2 } = useParShowsPar2(cycle.parCycleId);
  const indexes = useReviewIndexes(cycle.parCycleId, leadEmail, showsPar2);
  // In a PAR 2.0 cycle a team's PARs are shared once all their 360° feedback is in: once the 360° deadline (or the
  // team's later self-review deadline) has passed everywhere (the backend's checkShareOpen). Teams in different
  // departments can open at different times.
  const opensByTeam = new Map(
    teams.map((t) => {
      const opens = shareOpensAfter(cycle, t.parDepartment);
      return [t.parTeamId, { after: opens.after, at: deadlinePassedEverywhereAt(opens.date) }] as const;
    }),
  );
  const now = new Date().getTime();
  const nextOpeningMs = Math.min(
    ...[...opensByTeam.values()].map((o) => o.at.getTime()).filter((ms) => ms > now),
    Number.POSITIVE_INFINITY,
  );
  const waits = (team: ParTeamSummary) => showsPar2 && now < (opensByTeam.get(team.parTeamId)?.at.getTime() ?? 0);
  // The roster redraws when Share opens for a team, as the review panel does.
  useRedrawAt(nextOpeningMs, showsPar2 && Number.isFinite(nextOpeningMs));
  const indexByEmail = useMemo(
    () => new Map((indexes.data?.members ?? []).map((m) => [m.employeeEmail.toLowerCase(), m.index])),
    [indexes.data],
  );
  // Members in the leadership team get Leadership 360° feedback, not PAR 360°: how many responded
  // to the cycle's survey shows instead.
  const leadership = showsPar2 && isPreviewEnabled("leadership360");
  const surveys = useLeadership360Surveys(leadership);
  const leaderResults = useLeadership360Results(
    leadership ? cycleSurvey(surveys.data, cycle.parCycleId)?.surveyId : undefined,
    "REPORTS",
  );
  const leaderResponsesByEmail = useMemo(
    () => new Map((leaderResults.data ?? []).map((r) => [r.leader.workEmail.toLowerCase(), r.responseCount])),
    [leaderResults.data],
  );
  // No org-wide employee directory of our own — reuses Leave's for avatars.
  const employees = useLeaveEmployees();
  const thumbnailByEmail = useMemo(
    () => new Map(employees.data?.map((e) => [e.workEmail, e.employeeThumbnail]) ?? []),
    [employees.data],
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [cycleDatesOpen, setCycleDatesOpen] = useState(false);
  const [reminderConfirmOpen, setReminderConfirmOpen] = useState(false);
  const [shareConfirmOpen, setShareConfirmOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [syncEmployeeOpen, setSyncEmployeeOpen] = useState(false);

  if (details.isLoading) {
    return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1.5 }} />;
  }
  if (details.isError) {
    return (
      <ErrorNotice error={details.error} onRetry={() => details.refetch()} retrying={details.isFetching}>
        {single ? "Couldn't load this team's roster." : "Couldn't load your teams' rosters."}
      </ErrorNotice>
    );
  }

  const members: Member[] = (details.data ?? []).flatMap((roster, i) =>
    (roster.details ?? []).map((m) => ({ ...m, team: teams[i] })),
  );
  // The 360° responses tile counts PAR 360° only; leaders' feedback is Leadership 360°.
  const parMembers = members.filter((m) => !leaderResponsesByEmail.has(m.parEmployeeEmail.toLowerCase()));
  const filteredMembers = members
    .filter((member) =>
      [member.parEmployeeName, member.parEmployeeEmail, single ? "" : teamName(member.team)]
        .join(" ")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) => a.parEmployeeName.localeCompare(b.parEmployeeName));

  const teamSize = teams.reduce((n, t) => n + t.numberOfTeamMembers, 0);
  const selectedMembers = members.filter((m) => selectedIds.includes(m.parRatingId));
  // Share waits while any picked PAR's team does, or, with none picked, while every team does. The time shown is the
  // latest among them.
  const waitingFor = (selectedMembers.length > 0 ? selectedMembers : members).filter((m) => waits(m.team));
  const shareWaits =
    selectedMembers.length > 0 ? waitingFor.length > 0 : members.length > 0 && waitingFor.length === members.length;
  const lastToOpen = waitingFor
    .map((m) => opensByTeam.get(m.team.parTeamId)!)
    .reduce<{ after: string; at: Date } | undefined>((last, o) => (!last || o.at > last.at ? o : last), undefined);

  const handleCopyEmails = async () => {
    try {
      await navigator.clipboard.writeText(selectedMembers.map((m) => m.parEmployeeEmail).join(", "));
      showSuccess("Emails copied to clipboard");
    } catch (err) {
      showError(describeError(err));
    }
  };

  // Validated before the confirm dialog opens, not only at confirm-time.
  const handleOpenShareConfirm = () => {
    // After the hard lead deadline of a PAR 2.0 cycle, only PAR admins can share.
    const hardDeadline = showsPar2 ? cycle.parLeadHardDeadline : undefined;
    if (hardDeadline !== undefined && isDeadlinePassed(hardDeadline)) {
      showError(`The hard lead deadline passed on ${formatShortDate(hardDeadline)}. Only PAR admins can share now.`);
      return;
    }
    if (!selectedMembers.every((m) => m.parLeadStatus === "DRAFT")) {
      showError("Unable to share selected reviews. Please select only draft reviews.");
      return;
    }
    setShareConfirmOpen(true);
  };

  const handleShareConfirmed = async () => {
    setShareConfirmOpen(false);
    // Re-validated in case the selection changed since the dialog opened.
    if (!selectedMembers.every((m) => m.parLeadStatus === "DRAFT")) {
      showError("Unable to share selected reviews. Please select only draft reviews.");
      return;
    }
    setSharing(true);
    let passedCount = 0;
    let failedCount = 0;
    const reasons: string[] = [];
    const shared: string[] = [];
    // The rosters reload once, after the last share, rather than every team's after each one.
    for (const member of selectedMembers) {
      try {
        await ratingUpdate.mutateAsync({
          employeeEmail: member.parEmployeeEmail,
          parRatingId: member.parRatingId,
          payload: { parLeadStatus: "SHARED" },
          refreshLater: true,
        });
        passedCount++;
        shared.push(member.parEmployeeEmail);
      } catch (err) {
        failedCount++;
        reasons.push(describeError(err));
      }
    }
    if (shared.length > 0) await refreshAfterRatingUpdates(shared);
    setSharing(false);
    setSelectedIds([]);
    if (passedCount === 0) {
      showError(`Failed to share ${failedCount} ratings. ${reasons.join(", ")}`);
    } else if (failedCount !== 0) {
      showError(`Failed to update ${failedCount} ratings. ${reasons.join(", ")}`);
    } else {
      showSuccess(`Successfully updated ${passedCount} ratings`);
    }
  };

  const columns: DataGrid.GridColDef<Member>[] = [
    {
      field: "parEmployeeName",
      headerName: "Team Member",
      flex: 1.5,
      renderCell: (params) => (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            height: "100%",
          }}
        >
          <Box
            role="button"
            tabIndex={0}
            aria-label={`Open review for ${params.row.parEmployeeName}`}
            onClick={() => onOpenReview(params.row.parEmployeeEmail)}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenReview(params.row.parEmployeeEmail);
              }
            }}
            sx={{
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              width: "fit-content",
            }}
          >
            <Avatar
              src={thumbnailByEmail.get(params.row.parEmployeeEmail) || undefined}
              slotProps={{ img: { referrerPolicy: "no-referrer" } }}
              sx={{ mr: 1.5, height: "2.2rem", width: "2.2rem" }}
            />
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 600 }}>
                {params.row.parEmployeeName}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Typography variant="caption" sx={{ fontSize: 11.5 }} color="text.secondary">
                  {params.row.parEmployeeEmail}
                </Typography>
                <Tooltip title="Copy Email" arrow>
                  <IconButton
                    size="small"
                    aria-label="Copy Email"
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await navigator.clipboard.writeText(params.row.parEmployeeEmail);
                        showSuccess("Email copied");
                      } catch (err) {
                        showError(describeError(err));
                      }
                    }}
                  >
                    <CopyIcon size={13} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </Box>
          <Box sx={{ ml: "2.95rem" }}>
            <StageProgress row={params.row} />
          </Box>
        </Box>
      ),
    },
    // Only with more than one team; its column menu filters by it.
    ...(single
      ? []
      : [
          {
            field: "team",
            headerName: "Team",
            flex: 1.2,
            valueGetter: (_v, row) => teamName(row.team),
          } satisfies DataGrid.GridColDef<Member>,
        ]),
    {
      field: "parEmployeeStatus",
      headerName: showsPar2 ? "Self-review" : "Employee PAR",
      flex: 0.8,
      display: "flex",
      align: "center",
      headerAlign: "center",
      renderCell: (params) => <ParStatusChip content={params.row.parEmployeeStatus} />,
    },
    {
      field: "par360ReviewStatus",
      headerName: "360° Feedback",
      flex: 0.9,
      display: "flex",
      align: "center",
      headerAlign: "center",
      renderCell: (params) => {
        const leaderResponses = leaderResponsesByEmail.get(params.row.parEmployeeEmail.toLowerCase());
        if (leaderResponses !== undefined) {
          return (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.25 }}>
              <Chip size="small" variant="outlined" label="Leadership 360°" />
              <Typography variant="caption" color="text.secondary">
                {leaderResponses} {leaderResponses === 1 ? "response" : "responses"}
              </Typography>
            </Box>
          );
        }
        const chip = (
          <ParStatusChip
            content={params.row.par360ReviewStatus}
            countDetails={{
              completed: params.row.par360ReviewCounts.sharedReviewCount,
              total: params.row.par360ReviewCounts.requestedReviewCount,
            }}
          />
        );
        if (!showsPar2) return chip;
        const index = indexByEmail.get(params.row.parEmployeeEmail.toLowerCase());
        return (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0.25,
            }}
          >
            {chip}
            <Typography variant="caption" color="text.secondary">
              {index === undefined ? "No index yet" : `Index ${formatIndex(index)}`}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: "parLeadStatus",
      headerName: "Lead's PAR",
      flex: 0.8,
      display: "flex",
      align: "center",
      headerAlign: "center",
      // Not shared after the lead deadline: still possible until the cycle closes, but late.
      renderCell: (params) =>
        params.row.parLeadStatus !== "SHARED" && isDeadlinePassed(cycle.parLeadDeadline) ? (
          <Chip size="small" variant="outlined" color="error" label="Overdue" />
        ) : (
          <ParStatusChip content={params.row.parLeadStatus} />
        ),
    },
    {
      field: "parRating",
      headerName: "Rating",
      flex: 0.8,
      display: "flex",
      align: "center",
      headerAlign: "center",
      renderCell: (params) => <ParStatusChip content={params.row.parRating ?? ""} />,
    },
    {
      field: "parSpecialRating",
      headerName: "Top 5%/20% Rating",
      flex: 0.9,
      display: "flex",
      align: "center",
      headerAlign: "center",
      renderCell: (params) => <ParStatusChip content={params.row.parSpecialRating ?? ""} />,
    },
    {
      field: "parF2fStatus",
      headerName: "F2F",
      flex: 0.6,
      display: "flex",
      align: "center",
      headerAlign: "center",
      renderCell: (params) => <ParStatusChip content={params.row.parF2fStatus} />,
    },
    {
      field: "actions",
      headerName: "",
      sortable: false,
      flex: 0.5,
      display: "flex",
      align: "center",
      renderCell: (params) => (
        <Tooltip title={params.row.parLeadStatus === "SHARED" ? "View" : "Review"} arrow>
          <IconButton onClick={() => onOpenReview(params.row.parEmployeeEmail)}>
            {params.row.parLeadStatus === "SHARED" ? <EyeIcon size={18} /> : <PencilIcon size={18} />}
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
        <Box sx={{ minWidth: 0, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
          {single ? (
            <Typography component="span" variant="body1" sx={{ fontWeight: 600 }}>
              {[single.parBusinessUnit, single.parDepartment, single.parTeam, single.parSubTeam]
                .filter(Boolean)
                .join(" / ")}
            </Typography>
          ) : (
            <>
              <Chip label={cycle.parCycleName} size="small" color="primary" variant="outlined" />
              <Typography component="span" variant="caption" color="text.secondary">
                ({formatShortDate(cycle.parCycleStartDate)} - {formatShortDate(cycle.parCycleEndDate)})
              </Typography>
            </>
          )}
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
          <Tooltip title="Open Cycle Dates" arrow>
            <IconButton onClick={() => setCycleDatesOpen(true)} aria-label="cycle dates">
              <CalendarIcon size={18} />
            </IconButton>
          </Tooltip>
          <Button variant="contained" onClick={() => setReminderConfirmOpen(true)}>
            Send 360° Reminder
          </Button>
          <Button variant="contained" disabled={!leadEmail} onClick={() => setSyncEmployeeOpen(true)}>
            Sync an Employee
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: showsPar2 ? 3 : 4 }}>
          <ParCompletionKpiTile
            label={showsPar2 ? "Self-reviews shared" : "Employee PAR"}
            completed={teams.reduce((n, t) => n + t.summary.employeeParCompletedCount, 0)}
            total={teamSize}
          />
        </Grid>
        {showsPar2 && (
          <Grid size={{ xs: 12, sm: 3 }}>
            <ParCompletionKpiTile
              label={`PAR 360° responses${indexes.data?.teamIndex !== undefined ? ` · team index ${formatIndex(indexes.data.teamIndex)}` : ""}`}
              completed={parMembers.reduce((n, m) => n + m.par360ReviewCounts.sharedReviewCount, 0)}
              total={parMembers.reduce((n, m) => n + m.par360ReviewCounts.requestedReviewCount, 0)}
            />
          </Grid>
        )}
        <Grid size={{ xs: 12, sm: showsPar2 ? 3 : 4 }}>
          <ParCompletionKpiTile
            label={showsPar2 ? "Lead reviews done" : "Lead's PAR"}
            completed={teams.reduce((n, t) => n + t.summary.leadsReviewCompletedCount, 0)}
            total={teamSize}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: showsPar2 ? 3 : 4 }}>
          <ParCompletionKpiTile
            label="F2F"
            completed={teams.reduce((n, t) => n + t.summary.f2fCompletedCount, 0)}
            total={teamSize}
          />
        </Grid>
      </Grid>

      <Card variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 1.5 }}>
          <Typography variant="h6">Members</Typography>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button variant="contained" disabled={selectedIds.length === 0} onClick={handleCopyEmails} startIcon={<CopyIcon size={16} />}>
              Copy Emails
            </Button>
            <Tooltip
              title={
                shareWaits && lastToOpen
                  ? `Reviews can be shared from ${formatShortDateTime(lastToOpen.at)}, when ${
                      lastToOpen.after === "360"
                        ? "the 360° deadline"
                        : single
                          ? "this team's self-review deadline"
                          : "their team's self-review deadline"
                    } has passed everywhere.`
                  : ""
              }
            >
              <span>
                <Button
                  variant="contained"
                  disabled={selectedIds.length === 0 || sharing || shareWaits}
                  onClick={handleOpenShareConfirm}
                >
                  Share
                </Button>
              </span>
            </Tooltip>
            <TextField
              size="small"
              placeholder="Search Members"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
        </Stack>

        <DataGrid.DataGrid
          rows={filteredMembers}
          columns={columns}
          getRowId={(row) => row.parRatingId}
          rowHeight={56}
          checkboxSelection
          disableRowSelectionOnClick
          rowSelectionModel={{ type: "include", ids: new Set(selectedIds) }}
          onRowSelectionModelChange={(model) => setSelectedIds(resolveGridSelectedIds(model, filteredMembers.map((m) => ({ id: m.parRatingId }))))}
          sx={{ border: "none" }}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          pageSizeOptions={[10, 20, 25]}
        />
      </Card>

      <ParCycleDatesDialog
        cycle={cycle}
        open={cycleDatesOpen}
        onClose={() => setCycleDatesOpen(false)}
        activeStep={calculateCycleActiveStep(cycle)}
      />

      {/* ConfirmationDialog's own threeSixtyReminder copy — same dialog as
          MultiTeamSummary.tsx's, reused here since both send the same
          lead-scoped reminder regardless of which team you're viewing.
          ConfirmationDialog.tsx's own maxWidth="md", not a narrower one-off. */}
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

      {leadEmail && (
        <ParSyncEmployeeDialog
          open={syncEmployeeOpen}
          onClose={() => setSyncEmployeeOpen(false)}
          cycle={cycle}
          leadEmail={leadEmail}
        />
      )}

      {/* leadParBulkShare copy (config/constant.ts). Always the same
          message regardless of selection validity — the draft-only check
          runs at confirm-time (handleShareConfirmed), not here.
          ConfirmationDialog.tsx's own maxWidth="md". */}
      <Dialog open={shareConfirmOpen} onClose={() => setShareConfirmOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Bulk Share Lead's Feedback?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This will share the lead's feedback with all the selected members. You can't undo this
            action.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShareConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleShareConfirmed}>
            Share
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
