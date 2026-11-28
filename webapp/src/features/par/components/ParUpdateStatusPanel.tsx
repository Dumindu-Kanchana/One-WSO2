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
import { Alert, Box, Button, Card, CardContent, ComplexSelect, Divider, Grid, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useParRating } from "../api/useParData";
import { useLeadRatingUpdate } from "../api/useLeadRatingUpdate";
import ParDateField from "./ParDateField";
import type { ParCycle, ParEmployeeStatus, ParF2fStatus, ParLeadStatus } from "../api/types";

function todayDateOnly(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// The statuses an Update Status panel starts from, as saved.
interface SavedStatuses {
  parRatingId: number;
  employeeStatus: ParEmployeeStatus;
  leadStatus: ParLeadStatus;
  f2fStatus: ParF2fStatus;
  f2fDate: string;
}

const sameStatuses = (a: SavedStatuses, b: SavedStatuses | undefined) =>
  b !== undefined &&
  a.parRatingId === b.parRatingId &&
  a.employeeStatus === b.employeeStatus &&
  a.leadStatus === b.leadStatus &&
  a.f2fStatus === b.f2fStatus &&
  a.f2fDate === b.f2fDate;

// Admin-only direct override of the four status/date fields a normal
// review flow only ever moves one at a time. Distinct from
// ParLeadReviewPanel.tsx: that one edits rating/comment content, this one
// edits workflow state — same PATCH resource, different field set.
export default function ParUpdateStatusPanel({ cycle, employeeEmail }: { cycle: ParCycle; employeeEmail: string }) {
  const rating = useParRating(cycle.parCycleId, employeeEmail);
  const ratingUpdate = useLeadRatingUpdate(cycle.parCycleId);
  const { showSuccess, showError } = useNotifications();

  const [employeeStatus, setEmployeeStatus] = useState<ParEmployeeStatus>("PENDING");
  const [leadStatus, setLeadStatus] = useState<ParLeadStatus>("PENDING");
  // The real value, not collapsed to the two options the dropdown below
  // offers (matches legacy's UpdateStatusPanel.tsx) — otherwise a save that
  // doesn't touch this field would overwrite a SCHEDULED record with PENDING.
  const [f2fStatus, setF2fStatus] = useState<ParF2fStatus>("PENDING");
  const [f2fDate, setF2fDate] = useState("");
  const [seededFrom, setSeededFrom] = useState<SavedStatuses | undefined>(undefined);
  // Set once the PAR admin's own save has succeeded (and the record has been read again), so what it stored replaces
  // every field. Not before: a refresh that arrives while the save is on its way keeps the edits, in case it fails.
  const [reseedAll, setReseedAll] = useState(false);

  const parRatingData = rating.data;

  // Seeded from what's saved, and again whenever that changes, so the fields start from the stored statuses. After
  // the admin's own save, or for another PAR, every field takes what's stored. When something else changes it (the
  // employee shares, another tab saves), a field the admin is changing keeps their edit, and the others follow.
  const saved: SavedStatuses | undefined = parRatingData
    ? {
        parRatingId: parRatingData.parRatingId,
        employeeStatus: parRatingData.parEmployeeStatus,
        leadStatus: parRatingData.parLeadStatus,
        f2fStatus: parRatingData.parF2fStatus,
        f2fDate: parRatingData.parF2fDate ?? "",
      }
    : undefined;
  if (saved && (reseedAll || !sameStatuses(saved, seededFrom))) {
    const before = !reseedAll && seededFrom?.parRatingId === saved.parRatingId ? seededFrom : undefined;
    const follow = <T,>(local: T, was: T | undefined, now: T) => (before && local !== was ? local : now);
    setEmployeeStatus(follow(employeeStatus, before?.employeeStatus, saved.employeeStatus));
    setLeadStatus(follow(leadStatus, before?.leadStatus, saved.leadStatus));
    setF2fStatus(follow(f2fStatus, before?.f2fStatus, saved.f2fStatus));
    setF2fDate(follow(f2fDate, before?.f2fDate, saved.f2fDate));
    setSeededFrom(saved);
    setReseedAll(false);
  }

  if (rating.isLoading) {
    return <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />;
  }
  if (rating.isError) {
    return (
      <ErrorNotice error={rating.error} onRetry={() => rating.refetch()} retrying={rating.isFetching}>
        Couldn't load this employee's PAR record.
      </ErrorNotice>
    );
  }
  if (!parRatingData) {
    return <Alert severity="info">This employee's record for this cycle isn't ready yet.</Alert>;
  }

  // Employee status locks once the lead has shared; F2F only opens up once
  // the lead's feedback is shared, or is already Completed (so an admin can
  // still revert a mistaken entry).
  const employeeStatusDisabled = leadStatus === "SHARED";
  const f2fDisabled = leadStatus !== "SHARED" && f2fStatus !== "COMPLETED";

  const dirty =
    employeeStatus !== parRatingData.parEmployeeStatus ||
    leadStatus !== parRatingData.parLeadStatus ||
    f2fStatus !== parRatingData.parF2fStatus ||
    f2fDate !== (parRatingData.parF2fDate ?? "");

  const handleSave = () => {
    ratingUpdate.mutate(
      {
        employeeEmail,
        parRatingId: parRatingData.parRatingId,
        // Only what changed, so a field left as it was is never sent back over a newer value.
        payload: {
          ...(employeeStatus !== parRatingData.parEmployeeStatus ? { parEmployeeStatus: employeeStatus } : {}),
          ...(leadStatus !== parRatingData.parLeadStatus ? { parLeadStatus: leadStatus } : {}),
          ...(f2fStatus !== parRatingData.parF2fStatus ? { parF2fStatus: f2fStatus } : {}),
          ...(f2fStatus === "COMPLETED" &&
          f2fDate &&
          (f2fStatus !== parRatingData.parF2fStatus || f2fDate !== (parRatingData.parF2fDate ?? ""))
            ? { parF2fDate: f2fDate }
            : {}),
        },
      },
      {
        onSuccess: () => {
          setReseedAll(true);
          showSuccess("Status updated");
        },
        onError: (err) => showError(describeError(err)),
      },
    );
  };

  const handleCancel = () => {
    setEmployeeStatus(parRatingData.parEmployeeStatus);
    setLeadStatus(parRatingData.parLeadStatus);
    setF2fStatus(parRatingData.parF2fStatus);
    setF2fDate(parRatingData.parF2fDate ?? "");
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2.5} sx={{ maxWidth: 560 }}>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Review status
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <ComplexSelect
                  label="Employee PAR Status"
                  labelAnchor="border"
                  fullWidth
                  value={employeeStatus}
                  disabled={employeeStatusDisabled || ratingUpdate.isPending}
                  onChange={(e) => setEmployeeStatus(e.target.value as ParEmployeeStatus)}
                >
                  <ComplexSelect.MenuItem value="PENDING">Pending</ComplexSelect.MenuItem>
                  <ComplexSelect.MenuItem value="DRAFT">Draft</ComplexSelect.MenuItem>
                  <ComplexSelect.MenuItem value="SHARED">Shared</ComplexSelect.MenuItem>
                  <ComplexSelect.MenuItem value="SHARED_BLOCKED" disabled>
                    Shared Blocked
                  </ComplexSelect.MenuItem>
                </ComplexSelect>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <ComplexSelect
                  label="Lead's Feedback Status"
                  labelAnchor="border"
                  fullWidth
                  value={leadStatus}
                  disabled={ratingUpdate.isPending}
                  onChange={(e) => setLeadStatus(e.target.value as ParLeadStatus)}
                >
                  <ComplexSelect.MenuItem value="PENDING">Pending</ComplexSelect.MenuItem>
                  <ComplexSelect.MenuItem value="DRAFT">Draft</ComplexSelect.MenuItem>
                  <ComplexSelect.MenuItem value="SHARED">Shared</ComplexSelect.MenuItem>
                </ComplexSelect>
              </Grid>
            </Grid>
          </Box>

          <Divider />

          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Face to face
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <ComplexSelect
                  label="F2F Status"
                  labelAnchor="border"
                  fullWidth
                  value={f2fStatus}
                  disabled={f2fDisabled || ratingUpdate.isPending}
                  onChange={(e) => setF2fStatus(e.target.value as ParF2fStatus)}
                >
                  <ComplexSelect.MenuItem value="PENDING">Pending</ComplexSelect.MenuItem>
                  <ComplexSelect.MenuItem value="COMPLETED">Completed</ComplexSelect.MenuItem>
                </ComplexSelect>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <ParDateField
                  label="F2F Date"
                  fullWidth
                  ariaLabel="F2F date"
                  value={f2fDate}
                  min={cycle.parCycleStartDate}
                  max={todayDateOnly()}
                  disabled={f2fStatus !== "COMPLETED" || ratingUpdate.isPending}
                  onChange={setF2fDate}
                />
              </Grid>
            </Grid>
          </Box>

          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, pt: 1, borderTop: 1, borderColor: "divider" }}>
            <Button disabled={!dirty || ratingUpdate.isPending} onClick={handleCancel}>
              Cancel
            </Button>
            <Button variant="contained" disabled={!dirty || ratingUpdate.isPending} onClick={handleSave}>
              {ratingUpdate.isPending ? "Updating…" : "Update"}
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
