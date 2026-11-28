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
import { Alert, Box, Button, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { formatDate } from "@features/my/api/derive";
import { useParRating } from "../api/useParData";
import { useSaveParRating } from "../api/useParMutations";
import { isDeadlinePassed } from "../util/parDeadline";
import { formatShortDate } from "../util/parDate";
import ParDateField from "./ParDateField";
import type { ParCycle } from "../api/types";

function todayDateOnly(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// par-app's F2fPanel.tsx, isEmployeeView=false: same alerts and date form as
// ParF2fTab.tsx's employee view.
export default function ParLeadF2fPanel({ cycle, employeeEmail }: { cycle: ParCycle; employeeEmail: string }) {
  const rating = useParRating(cycle.parCycleId, employeeEmail);
  const save = useSaveParRating(cycle.parCycleId, employeeEmail);
  const { showSuccess, showError } = useNotifications();

  const [completedDate, setCompletedDate] = useState("");
  const [dateTouched, setDateTouched] = useState(false);

  if (rating.isLoading) {
    return <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1.5 }} />;
  }
  if (rating.isError) {
    return (
      <ErrorNotice error={rating.error} onRetry={() => rating.refetch()} retrying={rating.isFetching}>
        Couldn't load this employee's PAR record.
      </ErrorNotice>
    );
  }
  if (!rating.data) {
    return <Alert severity="info">This employee's record for this cycle isn't ready yet.</Alert>;
  }

  const parRating = rating.data;
  const deadlinePassed = isDeadlinePassed(cycle.parF2FDeadline);
  const leadShared = parRating.parLeadStatus === "SHARED";
  const status = parRating.parF2fStatus;
  const completed = status === "COMPLETED";
  const showForm = !completed && !deadlinePassed;

  const handleMarkCompleted = () => {
    if (!completedDate) {
      setDateTouched(true);
      return;
    }
    save.mutate(
      { parRatingId: parRating.parRatingId, parF2fStatus: "COMPLETED", parF2fDate: completedDate },
      {
        onSuccess: () => showSuccess("Successfully updated the F2F status"),
        onError: (err) => showError(describeError(err)),
      },
    );
  };

  return (
    <Box sx={{ pt: 0.5 }}>
      <Stack spacing={1.75}>
        {!deadlinePassed && status === "SCHEDULED" && <Alert severity="success">F2F meeting is scheduled</Alert>}
        {deadlinePassed && !completed && (
          <Alert severity="error">
            The deadline for updating the F2F has passed on {formatShortDate(cycle.parF2FDeadline)}.
          </Alert>
        )}
        {!deadlinePassed && !completed && (
          <Alert severity="info">
            Please complete your F2F meeting before the deadline: {formatShortDate(cycle.parF2FDeadline)}.
          </Alert>
        )}
        {!leadShared && !deadlinePassed && (
          <Alert severity="info">Lead's feedback must be completed to update F2F status</Alert>
        )}
        {completed && parRating.parF2fDate && (
          <Alert severity="success">F2F completed on {formatShortDate(parRating.parF2fDate)}</Alert>
        )}

        {showForm && (
          <>
            <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "flex-start", sm: "center" }, gap: 2 }}>
              <Typography sx={{ fontWeight: 500, width: { sm: "20%" } }}>F2F Completed Date:</Typography>
              <ParDateField
                value={completedDate}
                min={formatDate(cycle.parCycleStartDate)}
                max={todayDateOnly()}
                disabled={!leadShared}
                error={dateTouched && !completedDate}
                helperText={dateTouched && !completedDate ? "Required" : undefined}
                ariaLabel="F2F completed date"
                fullWidth
                onChange={(v) => {
                  setCompletedDate(v);
                  setDateTouched(false);
                }}
              />
            </Box>

            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5 }}>
              <Button variant="contained" disabled={!leadShared || save.isPending} onClick={handleMarkCompleted}>
                {save.isPending ? "Saving…" : "Mark as completed"}
              </Button>
            </Box>
          </>
        )}
      </Stack>
    </Box>
  );
}
