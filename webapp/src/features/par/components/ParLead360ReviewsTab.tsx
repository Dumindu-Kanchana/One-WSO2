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
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { PlusIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useMeProfile } from "@features/my/api/useMeProfile";
import { useLeaveEmployees } from "@features/leave/api/useLeaveData";
import { employeeDisplayName } from "@features/leave/util/employeeName";
import { useReviewers, useRequestReviewers } from "../api/usePar360";
import { useParEmployeeReviews } from "../api/useLeadHistory";
import Par360RequestDialog from "./Par360RequestDialog";
import ParEmptyState from "./ParEmptyState";
import { Par360StatusChip } from "./ParChips";
import { ParCommentView } from "./ParContent";
import { decodeParComment } from "../util/parComment";
import { isDeadlinePassed } from "../util/parDeadline";
import type { ParCycle } from "../api/types";

// par-app's Review.tsx "360 Reviews" tab: every reviewer requested for this
// employee, with a "View Feedback" action once SHARED/REJECTED, and a
// Request button reusing Par360RequestDialog aimed at this employee's reviewer
// list instead of the caller's own.
export default function ParLead360ReviewsTab({
  cycle,
  employeeEmail,
  leadStatus,
  leadStatusKnown,
}: {
  cycle: ParCycle;
  employeeEmail: string;
  /** ParLeadReviewTabs' own `rating.data?.parLeadStatus`. */
  leadStatus: string | undefined;
  /** ParLeadReviewTabs' own `rating.isSuccess` — while the lead's own status
   * is still loading or failed to load, the Request action must not open
   * just because `leadStatus` reads as `undefined !== "SHARED"`. */
  leadStatusKnown: boolean;
}) {
  const profile = useMeProfile();
  const leadEmail = profile.data?.userInfo.workEmail;
  const reviewers = useReviewers(cycle.parCycleId, employeeEmail);
  const requestReviewers = useRequestReviewers(cycle.parCycleId, employeeEmail);
  const reviews = useParEmployeeReviews(cycle.parCycleId, employeeEmail);
  const employees = useLeaveEmployees();
  const nameByEmail = useMemo(() => new Map(employees.data?.map((e) => [e.workEmail, employeeDisplayName(e)]) ?? []), [employees.data]);
  const thumbnailByEmail = useMemo(
    () => new Map(employees.data?.map((e) => [e.workEmail, e.employeeThumbnail]) ?? []),
    [employees.data],
  );

  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [viewingReviewerEmail, setViewingReviewerEmail] = useState<string | undefined>(undefined);

  const requestBlocked = !leadStatusKnown || isDeadlinePassed(cycle.parThreeSixtyRatingDeadline) || leadStatus === "SHARED";

  if (reviewers.isLoading) {
    return <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />;
  }
  if (reviewers.isError) {
    return (
      <ErrorNotice error={reviewers.error} onRetry={() => reviewers.refetch()} retrying={reviewers.isFetching}>
        Couldn't load this employee's reviewers.
      </ErrorNotice>
    );
  }

  const viewingReview = viewingReviewerEmail
    ? (reviews.data ?? []).find((r) => r.reviewerEmail === viewingReviewerEmail)
    : undefined;

  return (
    <Box sx={{ pt: 0.5 }}>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Tooltip title={requestBlocked ? "Action not available" : ""} arrow>
          <span>
            <Button
              variant="contained"
              startIcon={<PlusIcon size={16} />}
              disabled={requestBlocked}
              onClick={() => setRequestDialogOpen(true)}
            >
              Request 360° Feedback
            </Button>
          </span>
        </Tooltip>
      </Box>

      {/* Same table treatment as Provide 360° → Voluntary Feedback. */}
      {(reviewers.data ?? []).length === 0 ? (
        <ParEmptyState text="No requests available" />
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Requested by</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {(reviewers.data ?? []).map((reviewer) => (
              <TableRow key={reviewer.reviewerEmail}>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Avatar
                      src={thumbnailByEmail.get(reviewer.reviewerEmail) || undefined}
                      slotProps={{ img: { referrerPolicy: "no-referrer" } }}
                      sx={{ width: "2.2rem", height: "2.2rem", borderRadius: 3 }}
                    />
                    <Box>
                      <Typography variant="body2">
                        {nameByEmail.get(reviewer.reviewerEmail) || reviewer.reviewerEmail}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {reviewer.reviewerEmail}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Par360StatusChip status={reviewer.reviewStatus} />
                </TableCell>
                <TableCell>
                  {reviewer.isLeadRequested && leadEmail && (
                    <Chip size="small" variant="outlined" color="info" label={leadEmail} sx={{ mr: 0.5 }} />
                  )}
                  {reviewer.isEmployeeRequested && (
                    <Chip size="small" variant="outlined" color="error" label={employeeEmail} />
                  )}
                </TableCell>
                <TableCell align="right">
                  {(reviewer.reviewStatus === "SHARED" || reviewer.reviewStatus === "REJECTED") && (
                    <Button size="small" onClick={() => setViewingReviewerEmail(reviewer.reviewerEmail)}>
                      View
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Par360RequestDialog
        open={requestDialogOpen}
        onClose={() => setRequestDialogOpen(false)}
        selfEmail={employeeEmail}
        leadEmail={leadEmail}
        existingEmails={(reviewers.data ?? []).map((r) => r.reviewerEmail)}
        onSubmit={(emails) => requestReviewers.mutate(emails, { onSuccess: () => setRequestDialogOpen(false) })}
        isSubmitting={requestReviewers.isPending}
        error={requestReviewers.error ?? undefined}
      />

      {/* Shows the reviewer's own info (name/avatar), not the employee's. */}
      <Dialog open={Boolean(viewingReviewerEmail)} onClose={() => setViewingReviewerEmail(undefined)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          360° Feedback
          {viewingReview?.reviewStatus === "REJECTED" && <Chip label="REJECTED" color="error" size="small" />}
        </DialogTitle>
        <DialogContent>
          {viewingReview ? (
            <>
              <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
                <Avatar
                  src={(viewingReviewerEmail && thumbnailByEmail.get(viewingReviewerEmail)) || undefined}
                  slotProps={{ img: { referrerPolicy: "no-referrer" } }}
                  sx={{ width: "2.2rem", height: "2.2rem", borderRadius: 3, mr: 1.5 }}
                />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {(viewingReviewerEmail && nameByEmail.get(viewingReviewerEmail)) || viewingReviewerEmail}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {viewingReviewerEmail}
                  </Typography>
                </Box>
              </Box>

              {viewingReview.reviewStatus !== "REJECTED" && (
                <Box sx={{ mb: 3, display: "flex", alignItems: "center", gap: 2 }}>
                  <Typography sx={{ fontWeight: 500 }}>Rating:</Typography>
                  <Chip size="small" label={viewingReview.reviewRating} color="primary" variant="outlined" />
                </Box>
              )}
              <Box sx={{ mb: 1 }}>
                <Typography sx={{ fontWeight: 500, mb: 1 }}>
                  {viewingReview.reviewStatus !== "REJECTED" ? "Feedback:" : "Rejection Reason:"}
                </Typography>
                <ParCommentView html={decodeParComment(viewingReview.reviewComment)} />
              </Box>
            </>
          ) : reviews.isLoading ? (
            <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1.5 }} />
          ) : reviews.isError ? (
            <ErrorNotice error={reviews.error} onRetry={() => reviews.refetch()} retrying={reviews.isFetching}>
              Couldn't load this reviewer's feedback.
            </ErrorNotice>
          ) : (
            <Alert severity="info">This reviewer hasn't shared any comment.</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setViewingReviewerEmail(undefined)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
