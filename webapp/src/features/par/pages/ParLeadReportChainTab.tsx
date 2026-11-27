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
  Avatar,
  Box,
  Breadcrumbs,
  Card,
  Chip,
  DataGrid,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Link,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { CalendarIcon, ChevronRightIcon, CopyIcon, EyeIcon, PencilIcon, SearchIcon, UsersRoundIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { describeError } from "@api/errors";
import { useMeProfile } from "@features/my/api/useMeProfile";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useLeaveEmployees } from "@features/leave/api/useLeaveData";
import { formatShortDate } from "../util/parDate";
import { useActiveParCycle } from "../api/useParData";
import { useParReportLevels } from "../api/useLeadReports";
import { filterChainReports, isEmployeeALead } from "../util/parReportChain";
import { calculateCycleActiveStep } from "../util/parCycleActiveStep";
import ParCycleDatesDialog from "../components/ParCycleDatesDialog";
import ParStatusChip from "../components/ParStatusChip";
import ParLeadReviewTabs from "../components/ParLeadReviewTabs";
import type { ParChainReport } from "../api/types";

interface BreadcrumbEntry {
  email: string;
  name: string;
}

// People Ops → Performance → Lead Portal → Report Chain: par-app's
// ReportChainView.tsx. Starts at the caller's own direct reports; each row
// whose isEmployeeALead is "True" gets a "View Subordinates" action that
// drills into THAT person's own direct reports, one level at a time, with a
// breadcrumb trail back up once a lead's team is open (none at the top: it
// would only link to itself). The backend allows this as long as the
// requested email is somewhere in the caller's own reporting chain.
export default function ParLeadReportChainTab() {
  const profile = useMeProfile();
  const workEmail = profile.data?.userInfo.workEmail;
  const activeCycles = useActiveParCycle(workEmail);
  const cycle = activeCycles.data?.[0];

  const [history, setHistory] = useState<BreadcrumbEntry[]>([]);
  const currentEmail = history.length > 0 ? history[history.length - 1].email : workEmail;
  const reports = useParReportLevels(cycle?.parCycleId, currentEmail);
  const { showSuccess, showError } = useNotifications();
  // No org-wide employee directory of our own — reuses Leave's for avatars.
  const thumbnails = useLeaveEmployees();
  const thumbnailByEmail = useMemo(
    () => new Map(thumbnails.data?.map((e) => [e.workEmail, e.employeeThumbnail]) ?? []),
    [thumbnails.data],
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [showLeadsOnly, setShowLeadsOnly] = useState(false);
  const [cycleDatesOpen, setCycleDatesOpen] = useState(false);
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

  if (reviewEmployeeEmail) {
    return (
      <ParLeadReviewTabs cycle={cycle} employeeEmail={reviewEmployeeEmail} onBack={() => setReviewEmployeeEmail(undefined)} />
    );
  }

  const openSubordinates = (row: ParChainReport) => {
    setHistory((prev) => [...prev, { email: row.parEmployeeEmail, name: row.parEmployeeName }]);
    setShowLeadsOnly(false);
    setSearchQuery("");
  };

  const navigateTo = (index: number) => {
    // index === -1 is "Direct Reports" itself, back to the caller's own root.
    setHistory((prev) => (index < 0 ? [] : prev.slice(0, index + 1)));
  };

  const rows = filterChainReports(reports.data ?? [], searchQuery, showLeadsOnly);

  const columns: DataGrid.GridColDef<ParChainReport>[] = [
    {
      field: "parEmployeeName",
      headerName: "Team Member",
      flex: 1.5,
      renderCell: (params) => (
        <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
          <Box
            role="button"
            tabIndex={0}
            aria-label={`Open review for ${params.row.parEmployeeName}`}
            onClick={() => setReviewEmployeeEmail(params.row.parEmployeeEmail)}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setReviewEmployeeEmail(params.row.parEmployeeEmail);
              }
            }}
            sx={{ cursor: "pointer", display: "flex", alignItems: "center", width: "fit-content" }}
          >
            <Avatar
              src={thumbnailByEmail.get(params.row.parEmployeeEmail) || undefined}
              slotProps={{ img: { referrerPolicy: "no-referrer" } }}
              sx={{ mr: 1.5, height: "2.2rem", width: "2.2rem" }}
            />
            <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
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
        </Box>
      ),
    },
    {
      field: "parEmployeeStatus",
      headerName: "Employee PAR",
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
      renderCell: (params) => (
        <ParStatusChip
          content={params.row.par360ReviewStatus}
          countDetails={{
            completed: params.row.par360ReviewCounts.sharedReviewCount,
            total: params.row.par360ReviewCounts.requestedReviewCount,
          }}
        />
      ),
    },
    {
      field: "parLeadStatus",
      headerName: "Lead's PAR",
      flex: 0.8,
      display: "flex",
      align: "center",
      headerAlign: "center",
      renderCell: (params) => <ParStatusChip content={params.row.parLeadStatus} />,
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
      flex: 0.7,
      display: "flex",
      align: "center",
      renderCell: (params) => (
        <Stack direction="row">
          <Tooltip title={params.row.parLeadStatus === "SHARED" ? "View" : "Review"} arrow>
            <IconButton onClick={() => setReviewEmployeeEmail(params.row.parEmployeeEmail)}>
              {params.row.parLeadStatus === "SHARED" ? <EyeIcon size={18} /> : <PencilIcon size={18} />}
            </IconButton>
          </Tooltip>
          {isEmployeeALead(params.row) && (
            <Tooltip title={`View ${params.row.parEmployeeName}'s Subordinates`} arrow>
              <IconButton onClick={() => openSubordinates(params.row)}>
                <UsersRoundIcon size={18} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
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
        <Tooltip title="Open Cycle Dates" arrow>
          <IconButton onClick={() => setCycleDatesOpen(true)} aria-label="cycle dates">
            <CalendarIcon size={18} />
          </IconButton>
        </Tooltip>
      </Stack>

      <Card variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 1.5 }}>
          {/* Where you are, once a lead's team is open; the top level has no trail (it would only link to itself). */}
          <Box sx={{ minWidth: 0 }}>
            {history.length > 0 && (
              <Breadcrumbs separator={<ChevronRightIcon size={14} />}>
                <Link component="button" underline="hover" onClick={() => navigateTo(-1)}>
                  Direct Reports
                </Link>
                {history.map((entry, index) =>
                  // The team that's open is where the trail ends, not a link back to itself.
                  index === history.length - 1 ? (
                    <Typography key={entry.email} component="span" color="text.primary" aria-current="page">
                      {entry.name}
                    </Typography>
                  ) : (
                    <Link key={entry.email} component="button" underline="hover" onClick={() => navigateTo(index)}>
                      {entry.name}
                    </Link>
                  ),
                )}
              </Breadcrumbs>
            )}
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <FormControlLabel
              control={<Switch checked={showLeadsOnly} onChange={(e) => setShowLeadsOnly(e.target.checked)} />}
              label="Show Leads Only"
            />
            <TextField
              size="small"
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
        {reports.isError ? (
          <ErrorNotice error={reports.error} onRetry={() => reports.refetch()} retrying={reports.isFetching}>
            Couldn't load this report chain level.
          </ErrorNotice>
        ) : (
          <DataGrid.DataGrid
            rows={rows}
            columns={columns}
            getRowId={(row) => row.parRatingId}
            rowHeight={56}
            loading={reports.isLoading}
            disableRowSelectionOnClick
            sx={{ border: "none" }}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            pageSizeOptions={[10, 20, 25]}
          />
        )}
      </Card>

      <ParCycleDatesDialog
        cycle={cycle}
        open={cycleDatesOpen}
        onClose={() => setCycleDatesOpen(false)}
        activeStep={calculateCycleActiveStep(cycle)}
      />
    </Stack>
  );
}
