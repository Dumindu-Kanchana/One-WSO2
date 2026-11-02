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

import { useMemo, useState, type ReactNode } from "react";
import { Navigate, useSearchParams } from "react-router";
import {
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
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useMeProfile } from "@features/my/api/useMeProfile";
import { useParEmployeeInfo } from "../api/useParData";
import { useReviewers, useReviewRequests, useSubmitReview } from "../api/usePar360";
import { useParFeedbackParts } from "../api/useParFeedbackParts";
import {
  useCurrentLeadership360Survey,
  useLeadership360Leaders,
  useMyLeadership360Feedback,
} from "../api/useLeadership360";
import type { ParCycle, Par360ReviewRequest } from "../api/types";
import Par360FeedbackDialog from "../components/Par360FeedbackDialog";
import Par360GiveFeedbackDialog, { type FeedbackStart } from "../components/Par360GiveFeedbackDialog";
import Leadership360FeedbackDialog from "../components/Leadership360FeedbackDialog";
import ParEmptyState from "../components/ParEmptyState";
import { PersonRow, StatusChip } from "../components/Par360PeopleRows";
import { localDraftLeaders } from "../util/leadership360LocalDraft";
import { formatShortDate } from "../util/parDate";
import { isDeadlinePassed } from "../util/parDeadline";
import { openRequests } from "../util/parHome";

type View = "requests" | "given";

const MONTH_NAME = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const monthName = (month: string) => {
  const [year, m] = month.split("-").map(Number);
  return MONTH_NAME.format(new Date(Date.UTC(year, m - 1, 1)));
};

// Give feedback, both kinds in one place: requests for your PAR feedback and
// the open Leadership 360° survey (Requests to me), what you've given (Given),
// and Give feedback to start new feedback (the kind, then the person). A
// request is answered with Respond on its row.
export default function ParGiveFeedbackTab() {
  const profile = useMeProfile();
  const workEmail = profile.data?.userInfo.workEmail;
  const parts = useParFeedbackParts(workEmail, profile.isLoading);
  const { cycle } = parts;
  const requests = useReviewRequests(cycle?.parCycleId, workEmail);
  const reviewers = useReviewers(parts.hasLead ? cycle?.parCycleId : undefined, workEmail);
  const parLeadEmail = useParEmployeeInfo(workEmail, Boolean(cycle) && parts.hasLead).data?.leadEmail;
  const survey = useCurrentLeadership360Survey(parts.leadership);
  const openSurvey = parts.leadership ? (survey.data ?? undefined) : undefined;
  const surveyId = openSurvey?.survey.surveyId;
  const mine = useMyLeadership360Feedback(surveyId);
  const { showSuccess } = useNotifications();
  const [params, setParams] = useSearchParams();
  const [choosing, setChoosing] = useState(false);
  const [giving, setGiving] = useState<FeedbackStart | null>(null);

  const serverDrafts = mine.data?.drafts ?? [];
  // Anonymous drafts live in this browser only (read again on every render, so a closed form shows up).
  const localDrafts = workEmail && surveyId !== undefined ? localDraftLeaders(workEmail, surveyId) : [];
  const named = mine.data?.named ?? [];
  const anonymousGiven = mine.data?.anonymous ?? [];
  const needsLeaders = serverDrafts.length + localDrafts.length + named.length + anonymousGiven.length > 0;
  const leaders = useLeadership360Leaders(needsLeaders);

  const employee = profile.data?.employee;
  const workedWith = useMemo(
    () => [
      parLeadEmail,
      employee?.managerEmail,
      ...(employee?.additionalManagerEmails ?? "").split(",").map((e) => e.trim()),
      ...(requests.data ?? []).map((r) => r.employeeEmail),
      ...(reviewers.data ?? []).map((r) => r.reviewerEmail),
    ],
    [parLeadEmail, employee, requests.data, reviewers.data],
  );

  const view: View = params.get("view") === "given" ? "given" : "requests";

  if (parts.isLoading) {
    return <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5, maxWidth: 1100 }} />;
  }
  if (!cycle) {
    if (parts.cycleError) {
      return (
        <ErrorNotice error={parts.cycleError} onRetry={parts.retryCycle}>
          Couldn't load your PAR cycle.
        </ErrorNotice>
      );
    }
    // Feedback is given in a PAR 2.0 cycle; the index picks a tab that has something.
    return <Navigate to="/me/performance" replace />;
  }
  if (!workEmail) return null;

  const parOpen = openRequests(requests.data ?? []);
  const parGiven = (requests.data ?? []).filter((r) => r.reviewStatus === "SHARED" || r.reviewStatus === "REJECTED");
  const leaderByEmail = new Map((leaders.data ?? []).map((l) => [l.workEmail.toLowerCase(), l]));
  const leadershipGivenCount = named.length + anonymousGiven.length;
  // Your Leadership 360° drafts wait alongside the PAR requests; starting new Leadership 360°
  // feedback is Give feedback, so the open survey itself needs no row of its own.
  const leadershipDrafts = [
    ...serverDrafts.map((d) => ({ leaderEmail: d.leaderEmail, anonymous: false })),
    ...localDrafts.map((leaderEmail) => ({ leaderEmail, anonymous: true })),
  ];
  const requestCount = parOpen.length + leadershipDrafts.length;
  const givenCount = parGiven.length + leadershipGivenCount;
  const parListState = requests.isLoading ? "loading" : requests.isError ? "error" : "ready";
  const currentMonth = mine.data?.currentMonth;
  const anonymousUsedThisMonth = (leaderEmail: string) =>
    anonymousGiven.some((g) => g.month === currentMonth && g.leaderEmail.toLowerCase() === leaderEmail.toLowerCase());

  return (
    <Stack spacing={2} sx={{ maxWidth: 1100, pt: 0.5 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={view}
          onChange={(_, next: View | null) =>
            next && setParams(next === "requests" ? {} : { view: next }, { replace: true })
          }
          aria-label="Feedback views"
        >
          <ToggleButton value="requests" sx={{ textTransform: "none", px: 2 }}>
            Requests to me{requestCount > 0 ? ` (${requestCount})` : ""}
          </ToggleButton>
          <ToggleButton value="given" sx={{ textTransform: "none", px: 2 }}>
            Given{givenCount > 0 ? ` (${givenCount})` : ""}
          </ToggleButton>
        </ToggleButtonGroup>
        <Button variant="contained" onClick={() => setChoosing(true)}>
          Give feedback
        </Button>
      </Box>

      {view === "requests" && (
        <ParList state={parListState} retry={() => requests.refetch()} error={requests.error}>
          <RequestList
            cycle={cycle}
            requests={parOpen}
            given={false}
            extra={leadershipDrafts.map((d) => {
              const leader = leaderByEmail.get(d.leaderEmail.toLowerCase());
              return (
                <PersonRow
                  key={`l360-${d.leaderEmail}-${d.anonymous}`}
                  name={leader?.employeeName}
                  email={d.leaderEmail}
                  note={leader?.jobRole}
                  kind="LEADERSHIP"
                >
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                    <Chip size="small" label={d.anonymous ? "Anonymous draft" : "Named draft"} variant="outlined" />
                    {leader && (
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => setGiving({ kind: "LEADERSHIP", leader })}
                      >
                        Continue
                      </Button>
                    )}
                  </Box>
                </PersonRow>
              );
            })}
          />
        </ParList>
      )}

      {view === "given" && (
        <Stack spacing={2}>
          {(parGiven.length > 0 || leadershipGivenCount === 0) && (
            <ParList state={parListState} retry={() => requests.refetch()} error={requests.error}>
              <RequestList cycle={cycle} requests={parGiven} given />
            </ParList>
          )}
          {leadershipGivenCount > 0 && (
            <Card variant="outlined" sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {openSurvey?.survey.surveyName}. Leadership 360° answers can't be opened again once submitted.
              </Typography>
              <Stack divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />}>
                {named.map((g, i) => {
                  const leader = leaderByEmail.get(g.leaderEmail.toLowerCase());
                  return (
                    <PersonRow
                      key={`named-${g.leaderEmail}-${i}`}
                      name={leader?.employeeName}
                      email={g.leaderEmail}
                      note={leader?.jobRole}
                      kind="LEADERSHIP"
                    >
                      <Chip size="small" variant="outlined" label={`Named · ${formatShortDate(g.submittedOn)}`} />
                    </PersonRow>
                  );
                })}
                {anonymousGiven.map((g) => {
                  const leader = leaderByEmail.get(g.leaderEmail.toLowerCase());
                  return (
                    <PersonRow
                      key={`anonymous-${g.leaderEmail}-${g.month}`}
                      name={leader?.employeeName}
                      email={g.leaderEmail}
                      note={leader?.jobRole}
                      kind="LEADERSHIP"
                    >
                      <Chip size="small" variant="outlined" label={`Anonymous · ${monthName(g.month)}`} />
                    </PersonRow>
                  );
                })}
              </Stack>
            </Card>
          )}
        </Stack>
      )}

      {choosing && (
        <Par360GiveFeedbackDialog
          onClose={() => setChoosing(false)}
          workEmail={workEmail}
          cycle={cycle}
          requests={requests.data ?? []}
          workedWith={workedWith}
          survey={openSurvey}
          myLeadership={mine.data}
          localDraftLeaders={localDrafts}
          onStart={(start) => {
            setChoosing(false);
            setGiving(start);
          }}
        />
      )}
      {giving?.kind === "PAR" && (
        <Par360FeedbackDialog
          open
          onClose={() => setGiving(null)}
          parCycleId={cycle.parCycleId}
          employeeEmail={giving.email}
          employeeName={giving.name}
          deadline={cycle.parThreeSixtyRatingDeadline}
        />
      )}
      {giving?.kind === "LEADERSHIP" && openSurvey && (
        <Leadership360FeedbackDialog
          key={giving.leader.workEmail}
          open
          onClose={() => setGiving(null)}
          survey={openSurvey}
          leader={giving.leader}
          workEmail={workEmail}
          draft={serverDrafts.find((d) => d.leaderEmail.toLowerCase() === giving.leader.workEmail.toLowerCase())}
          anonymousUsedThisMonth={anonymousUsedThisMonth(giving.leader.workEmail)}
          currentMonth={currentMonth}
          onSubmitted={(leader) => showSuccess(`Your feedback on ${leader.employeeName} was submitted.`)}
        />
      )}
    </Stack>
  );
}

function ParList({
  state,
  error,
  retry,
  children,
}: {
  state: "loading" | "error" | "ready";
  error: Error | null;
  retry: () => void;
  children: ReactNode;
}) {
  if (state === "loading") return <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1.5 }} />;
  if (state === "error") {
    return (
      <ErrorNotice error={error} onRetry={retry}>
        Couldn't load feedback requests.
      </ErrorNotice>
    );
  }
  return <>{children}</>;
}

function RequestList({
  cycle,
  requests,
  given,
  extra = [],
}: {
  cycle: ParCycle;
  requests: Par360ReviewRequest[];
  given: boolean;
  /** More rows after the PAR requests: your Leadership 360° drafts. */
  extra?: ReactNode[];
}) {
  const decline = useSubmitReview(cycle.parCycleId);
  const { showSuccess, showError } = useNotifications();
  const [opened, setOpened] = useState<Par360ReviewRequest | null>(null);
  const [declining, setDeclining] = useState<Par360ReviewRequest | null>(null);
  const deadlinePassed = isDeadlinePassed(cycle.parThreeSixtyRatingDeadline);
  const nameOf = (r: Par360ReviewRequest) => r.employeeName ?? r.employeeEmail;

  if (requests.length === 0 && extra.length === 0) {
    return (
      <Card variant="outlined" sx={{ p: 2 }}>
        <ParEmptyState text={given ? "You haven't given any feedback this cycle yet" : "No one is waiting on your feedback"} />
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      {!given && requests.length > 0 && (
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
            kind="PAR"
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
                  {r.reviewStatus === "DRAFT" ? "Continue" : "Respond"}
                </Button>
              </Box>
            )}
          </PersonRow>
        ))}
        {extra}
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
