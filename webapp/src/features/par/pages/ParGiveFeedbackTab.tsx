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
import type { Leadership360Leader } from "../api/leadership360Types";
import Par360FeedbackDialog from "../components/Par360FeedbackDialog";
import Par360GiveFeedbackDialog, { type FeedbackStart } from "../components/Par360GiveFeedbackDialog";
import Leadership360FeedbackDialog from "../components/Leadership360FeedbackDialog";
import ParEmptyState from "../components/ParEmptyState";
import { PersonRow, StatusChip } from "../components/Par360PeopleRows";
import { localDraftLeaders } from "../util/leadership360LocalDraft";
import { formatShortDate } from "../util/parDate";
import { isDeadlinePassed } from "../util/parDeadline";
import { feedbackSource, giveFeedbackItems, isVoluntary, type GiveFeedbackItem } from "../util/par360Feedback";

type Show = "all" | "requested" | "voluntary";

const EMPTY: Record<Show, string> = {
  all: "No one has asked for your feedback yet",
  requested: "No one has asked for your feedback yet",
  voluntary: "You haven't given feedback nobody asked for this cycle",
};

const MONTH_NAME = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const monthName = (month: string) => {
  const [year, m] = month.split("-").map(Number);
  return MONTH_NAME.format(new Date(Date.UTC(year, m - 1, 1)));
};

// Give feedback: one list of everyone who asked for your feedback and the
// feedback you've given, waiting ones first. Who it's about decides the form:
// Leadership 360° for a member of the leadership team, PAR feedback for anyone
// else. Give feedback starts feedback nobody asked for, the person first.
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
  const leaders = useLeadership360Leaders(parts.leadership);
  const decline = useSubmitReview(cycle?.parCycleId);
  const { showSuccess, showError } = useNotifications();
  const [choosing, setChoosing] = useState(false);
  const [giving, setGiving] = useState<FeedbackStart | null>(null);
  const [viewing, setViewing] = useState<GiveFeedbackItem | null>(null);
  const [declining, setDeclining] = useState<GiveFeedbackItem | null>(null);
  // Which rows to show, kept in the URL so a reload or a link keeps it.
  const [params, setParams] = useSearchParams();
  const showParam = params.get("show");
  const show: Show = showParam === "requested" || showParam === "voluntary" ? showParam : "all";

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
  const leaderByEmail = useMemo(
    () => new Map((leaders.data ?? []).map((l) => [l.workEmail.toLowerCase(), l])),
    [leaders.data],
  );

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

  const deadlinePassed = isDeadlinePassed(cycle.parThreeSixtyRatingDeadline);
  // Anonymous drafts live in this browser only (read again on every render, so a closed form shows up).
  const localDrafts = surveyId !== undefined ? localDraftLeaders(workEmail, surveyId) : [];
  const items = giveFeedbackItems({
    requests: requests.data ?? [],
    leaderEmails: new Set(leaderByEmail.keys()),
    leaderNames: new Map([...leaderByEmail].map(([email, l]) => [email, l.employeeName])),
    mine: mine.data,
    localDraftLeaders: localDrafts,
    parDeadlinePassed: deadlinePassed,
    surveyOpen: Boolean(openSurvey),
  });
  const voluntary = items.filter(isVoluntary);
  const requested = items.filter((item) => !isVoluntary(item));
  const shown = show === "voluntary" ? voluntary : show === "requested" ? requested : items;
  const waiting = shown.filter((item) => item.state === "todo" || item.state === "draft");
  const currentMonth = mine.data?.currentMonth;
  const anonymousUsedThisMonth = (leaderEmail: string) =>
    (mine.data?.anonymous ?? []).some(
      (g) => g.month === currentMonth && g.leaderEmail.toLowerCase() === leaderEmail.toLowerCase(),
    );
  const leaderOf = (item: GiveFeedbackItem): Leadership360Leader =>
    leaderByEmail.get(item.email.toLowerCase()) ?? {
      workEmail: item.email,
      employeeName: item.name ?? item.email,
      jobRole: null,
      employeeThumbnail: null,
    };
  const open = (item: GiveFeedbackItem) =>
    setGiving(
      item.kind === "LEADERSHIP"
        ? { kind: "LEADERSHIP", leader: leaderOf(item) }
        : { kind: "PAR", email: item.email, name: item.name ?? item.email },
    );
  const loading = requests.isLoading || (parts.leadership && (leaders.isLoading || mine.isLoading));

  return (
    <Stack spacing={2} sx={{ maxWidth: 1100, pt: 0.5 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={show}
          onChange={(_, next: Show | null) => next && setParams(next === "all" ? {} : { show: next }, { replace: true })}
          aria-label="Show"
        >
          <ToggleButton value="all" sx={{ textTransform: "none", px: 2 }}>
            All
          </ToggleButton>
          <ToggleButton value="requested" sx={{ textTransform: "none", px: 2 }}>
            Requested
          </ToggleButton>
          <ToggleButton value="voluntary" sx={{ textTransform: "none", px: 2 }}>
            Voluntary
          </ToggleButton>
        </ToggleButtonGroup>
        <Button variant="contained" onClick={() => setChoosing(true)}>
          Give feedback
        </Button>
      </Box>

      {loading ? (
        <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1.5 }} />
      ) : requests.isError ? (
        <ErrorNotice error={requests.error} onRetry={() => requests.refetch()}>
          Couldn't load feedback requests.
        </ErrorNotice>
      ) : (
        <Card variant="outlined" sx={{ p: 2 }}>
          {shown.length === 0 ? (
            <ParEmptyState text={EMPTY[show]} />
          ) : (
            <>
              {waiting.length > 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  About five minutes each.
                  {waiting.some((item) => !isVoluntary(item)) &&
                    " If you haven't worked closely enough with someone to help, decline instead."}
                  {!deadlinePassed && ` Due ${formatShortDate(cycle.parThreeSixtyRatingDeadline)}.`}
                </Typography>
              )}
              <Stack divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />}>
                {shown.map((item) => (
                  <PersonRow
                    key={`${item.kind}-${item.email}`}
                    name={item.name}
                    email={item.email}
                    note={[feedbackSource(item), leaderByEmail.get(item.email.toLowerCase())?.jobRole]
                      .filter(Boolean)
                      .join(" · ")}
                    kind={item.kind}
                  >
                    <ItemActions
                      item={item}
                      onOpen={() => open(item)}
                      onView={() => setViewing(item)}
                      onDecline={() => setDeclining(item)}
                    />
                  </PersonRow>
                ))}
              </Stack>
            </>
          )}
        </Card>
      )}

      {choosing && (
        <Par360GiveFeedbackDialog
          onClose={() => setChoosing(false)}
          workEmail={workEmail}
          cycle={cycle}
          workedWith={workedWith}
          survey={openSurvey}
          leaders={leaders.data ?? []}
          items={items}
          onStart={(start) => {
            setChoosing(false);
            setGiving(start);
          }}
        />
      )}
      {(giving?.kind === "PAR" || viewing) && (
        <Par360FeedbackDialog
          open
          onClose={() => {
            setGiving(null);
            setViewing(null);
          }}
          parCycleId={cycle.parCycleId}
          employeeEmail={giving?.kind === "PAR" ? giving.email : viewing!.email}
          employeeName={giving?.kind === "PAR" ? giving.name : (viewing!.name ?? viewing!.email)}
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
          draft={(mine.data?.drafts ?? []).find(
            (d) => d.leaderEmail.toLowerCase() === giving.leader.workEmail.toLowerCase(),
          )}
          anonymousUsedThisMonth={anonymousUsedThisMonth(giving.leader.workEmail)}
          currentMonth={currentMonth}
          onSubmitted={(leader) => showSuccess(`Your feedback on ${leader.employeeName} was submitted.`)}
        />
      )}

      <Dialog open={Boolean(declining)} onClose={() => setDeclining(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Decline this request?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {declining && (declining.name ?? declining.email)} will see that you declined, so they can ask someone
            else. Anything you started is discarded.
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
                { employeeWorkEmail: declining.email, payload: { par360ReviewStatus: "REJECTED" } },
                {
                  onSuccess: () => {
                    showSuccess(`You declined ${declining.name ?? declining.email}'s request.`);
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
    </Stack>
  );
}

// What a row says and offers: Respond or Continue while it waits on you, then
// how it ended.
function ItemActions({
  item,
  onOpen,
  onView,
  onDecline,
}: {
  item: GiveFeedbackItem;
  onOpen: () => void;
  onView: () => void;
  onDecline: () => void;
}) {
  if (item.state === "submitted") {
    const label =
      item.given?.anonymous === true
        ? `Submitted anonymously · ${monthName(item.given.month)}`
        : item.given?.anonymous === false
          ? `Submitted · ${formatShortDate(item.given.on)}`
          : "Submitted";
    return (
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <Chip size="small" color="success" label={label} />
        {/* Leadership 360° answers can't be opened again once submitted. */}
        {item.kind === "PAR" && (
          <Button size="small" onClick={onView}>
            View
          </Button>
        )}
      </Box>
    );
  }
  if (item.state === "declined") return <StatusChip status="REJECTED" />;
  if (item.state === "closed") return <Chip size="small" variant="outlined" label="Closed" />;
  const draft = item.state === "draft";
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
      {draft && <Chip size="small" variant="outlined" label={item.anonymousDraft ? "Anonymous draft" : "Draft"} />}
      {item.request && !item.offered && (
        <Button size="small" color="inherit" onClick={onDecline}>
          Decline
        </Button>
      )}
      <Button size="small" variant="contained" onClick={onOpen}>
        {draft ? "Continue" : "Respond"}
      </Button>
    </Box>
  );
}
