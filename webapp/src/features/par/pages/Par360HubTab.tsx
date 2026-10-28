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

import { useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@wso2/oxygen-ui";
import { PlusIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useMeProfile } from "@features/my/api/useMeProfile";
import { useActiveParCycle, useParEmployeeInfo, useParRating } from "../api/useParData";
import { useRequestReviewers, useReviewers, useReviewRequests, useSubmitReview } from "../api/usePar360";
import { useReviewSummary } from "../api/useReview360";
import { MAX_360_REVIEWERS, MIN_360_RESPONSES } from "../api/review360Types";
import type { ParCycle, Par360ReviewRequest, Par360ReviewStatus } from "../api/types";
import { Par360RequestPicker } from "../components/Par360RequestDialog";
import Par360FeedbackDialog from "../components/Par360FeedbackDialog";
import Par360SummaryView from "../components/Par360SummaryView";
import ParEmptyState from "../components/ParEmptyState";
import { formatShortDate } from "../util/parDate";
import { isDeadlinePassed } from "../util/parDeadline";
import { feedbackProgress, openRequests } from "../util/parHome";

type HubView = "about" | "requests" | "given";

// PAR 2.0 360° feedback in one place: who you asked and who has responded
// (never what they wrote), the requests waiting on you, and what you've given.
export default function Par360HubTab() {
  const profile = useMeProfile();
  const workEmail = profile.data?.userInfo.workEmail;
  const activeCycles = useActiveParCycle(workEmail);
  const cycle = activeCycles.data?.[0];
  const requests = useReviewRequests(cycle?.parCycleId, workEmail);
  const [params, setParams] = useSearchParams();
  const view: HubView = params.get("view") === "requests" ? "requests" : params.get("view") === "given" ? "given" : "about";

  if (profile.isLoading || activeCycles.isLoading) {
    return <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5, maxWidth: 1100 }} />;
  }
  if (activeCycles.isError) {
    return (
      <ErrorNotice error={activeCycles.error} onRetry={() => activeCycles.refetch()} retrying={activeCycles.isFetching}>
        Couldn't load your PAR cycle.
      </ErrorNotice>
    );
  }
  if (!cycle || !workEmail) {
    return <Alert severity="info">There's no PAR cycle open for you right now.</Alert>;
  }

  const open = openRequests(requests.data ?? []);
  const given = (requests.data ?? []).filter((r) => r.reviewStatus === "SHARED" || r.reviewStatus === "REJECTED");

  return (
    <Stack spacing={2} sx={{ maxWidth: 1100, pt: 0.5 }}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={view}
        onChange={(_, next: HubView | null) => next && setParams(next === "about" ? {} : { view: next }, { replace: true })}
        aria-label="360° feedback views"
      >
        <ToggleButton value="about" sx={{ textTransform: "none", px: 2 }}>
          About me
        </ToggleButton>
        <ToggleButton value="requests" sx={{ textTransform: "none", px: 2 }}>
          Requests to me{open.length > 0 ? ` (${open.length})` : ""}
        </ToggleButton>
        <ToggleButton value="given" sx={{ textTransform: "none", px: 2 }}>
          Given{given.length > 0 ? ` (${given.length})` : ""}
        </ToggleButton>
      </ToggleButtonGroup>

      {view === "about" ? (
        <AboutMe cycle={cycle} workEmail={workEmail} />
      ) : requests.isLoading ? (
        <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1.5 }} />
      ) : requests.isError ? (
        <ErrorNotice error={requests.error} onRetry={() => requests.refetch()} retrying={requests.isFetching}>
          Couldn't load feedback requests.
        </ErrorNotice>
      ) : (
        <RequestList cycle={cycle} requests={view === "requests" ? open : given} given={view === "given"} />
      )}
    </Stack>
  );
}

function AboutMe({ cycle, workEmail }: { cycle: ParCycle; workEmail: string }) {
  const leadEmail = useParEmployeeInfo(workEmail).data?.leadEmail ?? undefined;
  const rating = useParRating(cycle.parCycleId, workEmail);
  const reviewers = useReviewers(cycle.parCycleId, workEmail);
  const requestReviewers = useRequestReviewers(cycle.parCycleId, workEmail);
  const summary = useReviewSummary(cycle.parCycleId, workEmail);
  const [adding, setAdding] = useState(false);

  const list = reviewers.data ?? [];
  const { asked, responded, declined } = feedbackProgress(list);
  const leadShared = rating.data?.parLeadStatus === "SHARED";
  const deadlinePassed = isDeadlinePassed(cycle.parThreeSixtyRatingDeadline);
  const full = asked >= MAX_360_REVIEWERS;
  const blocked = deadlinePassed || leadShared || full;

  return (
    <Stack spacing={2}>
      <Card variant="outlined" sx={{ p: 2 }}>
        <Typography sx={{ fontWeight: 600 }}>Your 360° summary</Typography>
        {summary.isLoading ? (
          <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 1, mt: 1 }} />
        ) : summary.data?.available ? (
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Averages and comments from everyone who responded. Names are left out and comments are sorted, so
              none of it points to one person.
            </Typography>
            <Par360SummaryView
              definition={summary.data.template.definition}
              responseCount={summary.data.responseCount}
              index={summary.data.index}
              questionAverages={summary.data.questionAverages}
              comments={summary.data.comments}
            />
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {summary.data?.reason ?? "Your summary appears here once your lead shares your PAR."}
          </Typography>
        )}
      </Card>

      <Card variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2, flexWrap: "wrap" }}>
          <Box>
            <Typography sx={{ fontWeight: 600 }}>People you asked</Typography>
            <Typography variant="body2" color="text.secondary">
              {asked === 0
                ? `Ask ${MIN_360_RESPONSES} to ${MAX_360_REVIEWERS} people who worked closely with you this cycle.`
                : `${responded} of ${asked} responded${declined ? `, ${declined} declined` : ""}. You see who responded, never what they wrote.`}{" "}
              {!deadlinePassed && !leadShared && `Due ${formatShortDate(cycle.parThreeSixtyRatingDeadline)}.`}
            </Typography>
          </Box>
          {!adding && (
            <Button
              variant="contained"
              startIcon={<PlusIcon size={16} />}
              disabled={blocked}
              onClick={() => setAdding(true)}
            >
              Ask for feedback
            </Button>
          )}
        </Box>
        {leadShared && (
          <Alert severity="info" sx={{ mt: 1.5 }}>
            Your lead has shared your PAR, so no more feedback can be requested.
          </Alert>
        )}
        {full && !leadShared && (
          <Typography variant="caption" color="text.secondary">
            You've asked {MAX_360_REVIEWERS} people, the most for one cycle.
          </Typography>
        )}
        {adding && (
          <Box sx={{ mt: 2 }}>
            <Par360RequestPicker
              open={adding}
              selfEmail={workEmail}
              leadEmail={leadEmail}
              existingEmails={list.map((r) => r.reviewerEmail)}
              onSubmit={(emails) => requestReviewers.mutate(emails, { onSuccess: () => setAdding(false) })}
              onCancel={() => setAdding(false)}
              isSubmitting={requestReviewers.isPending}
              error={requestReviewers.error ?? undefined}
            />
          </Box>
        )}
        <Box sx={{ mt: 2 }}>
          {reviewers.isLoading ? (
            <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />
          ) : reviewers.isError ? (
            <ErrorNotice error={reviewers.error} onRetry={() => reviewers.refetch()} retrying={reviewers.isFetching}>
              Couldn't load your reviewers.
            </ErrorNotice>
          ) : list.length === 0 ? (
            <ParEmptyState text="You haven't asked anyone yet" />
          ) : (
            <Stack divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />}>
              {list.map((r) => (
                <PersonRow key={r.reviewerEmail} name={r.reviewerName} email={r.reviewerEmail}>
                  <StatusChip status={r.reviewStatus} />
                </PersonRow>
              ))}
            </Stack>
          )}
        </Box>
      </Card>
    </Stack>
  );
}

function RequestList({ cycle, requests, given }: { cycle: ParCycle; requests: Par360ReviewRequest[]; given: boolean }) {
  const decline = useSubmitReview(cycle.parCycleId);
  const { showSuccess, showError } = useNotifications();
  const [opened, setOpened] = useState<Par360ReviewRequest | null>(null);
  const [declining, setDeclining] = useState<Par360ReviewRequest | null>(null);
  const deadlinePassed = isDeadlinePassed(cycle.parThreeSixtyRatingDeadline);
  const nameOf = (r: Par360ReviewRequest) => r.employeeName ?? r.employeeEmail;

  if (requests.length === 0) {
    return (
      <Card variant="outlined" sx={{ p: 2 }}>
        <ParEmptyState text={given ? "You haven't given any feedback this cycle yet" : "No one is waiting on your feedback"} />
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      {!given && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          About five minutes each. If you haven't worked closely enough with someone to help, decline instead.
          {!deadlinePassed && ` Due ${formatShortDate(cycle.parThreeSixtyRatingDeadline)}.`}
        </Typography>
      )}
      <Stack divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />}>
        {requests.map((r) => (
          <PersonRow
            key={r.employeeEmail}
            name={r.employeeName}
            email={r.employeeEmail}
            note={r.isLeadRequested && !r.isEmployeeRequested ? "Asked by their lead" : undefined}
          >
            {given ? (
              r.reviewStatus === "SHARED" ? (
                <Button size="small" onClick={() => setOpened(r)}>
                  View
                </Button>
              ) : (
                <StatusChip status="REJECTED" />
              )
            ) : (
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                {r.reviewStatus === "DRAFT" && <Chip size="small" label="Draft" variant="outlined" />}
                <Button size="small" color="inherit" disabled={deadlinePassed} onClick={() => setDeclining(r)}>
                  Decline
                </Button>
                <Button size="small" variant="contained" disabled={deadlinePassed} onClick={() => setOpened(r)}>
                  {r.reviewStatus === "DRAFT" ? "Continue" : "Give feedback"}
                </Button>
              </Box>
            )}
          </PersonRow>
        ))}
      </Stack>

      {opened && (
        <Par360FeedbackDialog
          open
          onClose={() => setOpened(null)}
          parCycleId={cycle.parCycleId}
          employeeEmail={opened.employeeEmail}
          employeeName={nameOf(opened)}
          deadline={cycle.parThreeSixtyRatingDeadline}
        />
      )}

      <Dialog open={Boolean(declining)} onClose={() => setDeclining(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Decline this request?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {declining && nameOf(declining)} will see that you declined, so they can ask someone else. Anything you
            started is discarded.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeclining(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={decline.isPending}
            onClick={() =>
              declining &&
              decline.mutate(
                { employeeWorkEmail: declining.employeeEmail, payload: { par360ReviewStatus: "REJECTED" } },
                {
                  onSuccess: () => {
                    showSuccess(`You declined ${nameOf(declining)}'s request.`);
                    setDeclining(null);
                  },
                  onError: (err) => showError(describeError(err)),
                },
              )
            }
          >
            {decline.isPending ? "Declining…" : "Decline"}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

function PersonRow({
  name,
  email,
  note,
  children,
}: {
  name?: string | null;
  email: string;
  note?: string;
  children: ReactNode;
}) {
  const display = name ?? email;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.25 }}>
      <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>{display.charAt(0).toUpperCase()}</Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
          {display}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap component="div">
          {note ? `${note} · ${email}` : email}
        </Typography>
      </Box>
      {children}
    </Box>
  );
}

function StatusChip({ status }: { status: Par360ReviewStatus }) {
  if (status === "SHARED") return <Chip size="small" color="success" label="Responded" />;
  if (status === "REJECTED") return <Chip size="small" label="Declined" />;
  return <Chip size="small" variant="outlined" label="Waiting" />;
}
