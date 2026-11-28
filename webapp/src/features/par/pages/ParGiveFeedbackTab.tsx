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

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
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
import { useDiscardReviewForm } from "../api/useReview360";
import { useParFeedbackParts } from "../api/useParFeedbackParts";
import {
  useCurrentLeadership360Survey,
  useDiscardLeadership360Draft,
  useLeadership360Leaders,
  useLeadership360Surveys,
  useMyLeadership360Feedback,
} from "../api/useLeadership360";
import type { Leadership360Leader } from "../api/leadership360Types";
import Par360FeedbackDialog from "../components/Par360FeedbackDialog";
import Par360GiveFeedbackPicker, { type FeedbackStart } from "../components/Par360GiveFeedbackPicker";
import Leadership360FeedbackDialog from "../components/Leadership360FeedbackDialog";
import ParEmptyState from "../components/ParEmptyState";
import { PersonRow, StatusChip } from "../components/Par360PeopleRows";
import { localDraftLeaders, removeClosedSurveyDrafts, removeLocalDraft } from "../util/leadership360LocalDraft";
import { formatShortDate } from "../util/parDate";
import { isDeadlinePassed } from "../util/parDeadline";
import { feedbackSource, giveFeedbackItems, isVoluntary, isWaiting, type GiveFeedbackItem } from "../util/par360Feedback";
import ParDueChip from "../components/ParDueChip";

type Show = "all" | "requested" | "voluntary";

const FILTERS: Show[] = ["all", "requested", "voluntary"];
const SHOW_LABEL: Record<Show, string> = { all: "All", requested: "Requested", voluntary: "Voluntary" };

const EMPTY: Record<Show, string> = {
  all: "No one has asked for your feedback yet",
  requested: "No one has asked for your feedback yet",
  voluntary: "You haven't given feedback nobody asked for this cycle",
};

// Asked of all feedback, at the end of Requested's and Voluntary's descriptions.
const COMMENTS_NOTE = "Please ensure your comments are professional, constructive, and detailed to add meaningful insights.";

// What the Requested and Voluntary filters show; All has only the tab's own description.
const SHOW_DESCRIPTION: Partial<Record<Show, string>> = {
  requested: `Here you'll find feedback requests from colleagues. You can share your feedback or decline it if you haven't worked closely enough with the person to provide meaningful feedback. ${COMMENTS_NOTE}`,
  voluntary: `Share feedback proactively with anyone you have worked with, without needing a request. ${COMMENTS_NOTE}`,
};

// Provide Feedback: one list of everyone who asked for your feedback and the
// feedback you've given, waiting ones first. Who it's about decides the form:
// Leadership 360° for a member of the leadership team, PAR feedback for anyone
// else. The search above the list starts feedback nobody asked for, the person
// first.
export default function ParGiveFeedbackTab() {
  const profile = useMeProfile();
  const workEmail = profile.data?.userInfo.workEmail;
  const parts = useParFeedbackParts(workEmail, profile.isLoading);
  // Where feedback goes now: the open cycle, or held for the next one (cycle 0).
  const { feedbackCycle: cycle, held } = parts;
  const requests = useReviewRequests(cycle?.parCycleId, workEmail);
  const reviewers = useReviewers(parts.hasLead ? parts.cycle?.parCycleId : undefined, workEmail);
  const parLeadEmail = useParEmployeeInfo(workEmail, Boolean(parts.cycle) && parts.hasLead).data?.leadEmail;
  const survey = useCurrentLeadership360Survey(parts.leadership);
  const surveys = useLeadership360Surveys(parts.leadership);
  const openSurvey = parts.leadership ? (survey.data ?? undefined) : undefined;
  const surveyId = openSurvey?.survey.surveyId;
  const mine = useMyLeadership360Feedback(surveyId);
  const leaders = useLeadership360Leaders(parts.leadership);
  const decline = useSubmitReview(cycle?.parCycleId);
  const discard = useDiscardReviewForm(cycle?.parCycleId);
  const discardLeadership = useDiscardLeadership360Draft(surveyId, workEmail);
  const { showSuccess, showError } = useNotifications();
  const [giving, setGiving] = useState<FeedbackStart | null>(null);
  const [viewing, setViewing] = useState<GiveFeedbackItem | null>(null);
  const [declining, setDeclining] = useState<GiveFeedbackItem | null>(null);
  const [discarding, setDiscarding] = useState<GiveFeedbackItem | null>(null);
  // Which rows to show, kept in the URL so a reload or a link keeps it; Requested unless said otherwise.
  // While feedback is held for the next cycle nobody can ask: all of it is voluntary, with no filter.
  const [params, setParams] = useSearchParams();
  const showParam = params.get("show");
  const show: Show = held ? "voluntary" : (FILTERS.find((f) => f === showParam) ?? "requested");

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

  // Anonymous drafts kept in this browser for a survey that has closed are removed. Only for one listed as
  // closed: a draft for a survey whose state isn't known (say, one opened since the list was read) stays.
  const closedSurveyIds = useMemo(
    () => (surveys.data ?? []).filter((s) => s.status === "CLOSED").map((s) => s.surveyId),
    [surveys.data],
  );
  useEffect(() => {
    if (closedSurveyIds.length > 0) removeClosedSurveyDrafts(closedSurveyIds);
  }, [closedSurveyIds]);

  if (parts.isLoading) {
    return <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />;
  }
  if (!cycle || !workEmail) return null;

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
  const waiting = shown.filter(isWaiting);
  // Anonymous feedback is given once per leader per cycle.
  const anonymousGiven = (leaderEmail: string) =>
    (mine.data?.anonymous ?? []).some((g) => g.leaderEmail.toLowerCase() === leaderEmail.toLowerCase());
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
  // Without the leadership team, a request for Leadership 360° feedback would open the PAR form.
  const leadersFailed = parts.leadership && leaders.isError && !leaders.data;

  return (
    <Stack spacing={2} sx={{ pt: 0.5 }}>
      <Typography variant="body2" color="text.secondary">
        Share your feedback to help your colleagues recognise their strengths and find opportunities to grow.
      </Typography>
      <Par360GiveFeedbackPicker
        workEmail={workEmail}
        cycle={cycle}
        workedWith={workedWith}
        held={held}
        survey={openSurvey}
        leaders={leaders.data ?? []}
        items={items}
        disabled={Boolean(loading || leadersFailed)}
        onStart={setGiving}
      />
      {!held && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={show}
            onChange={(_, next: Show | null) =>
              next && setParams(next === "requested" ? {} : { show: next }, { replace: true })
            }
            aria-label="Show"
          >
            {FILTERS.map((f) => (
              <ToggleButton key={f} value={f} sx={{ textTransform: "none", px: 2 }}>
                {SHOW_LABEL[f]}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      )}
      {/* Between cycles there's no filter, but everything is voluntary: Voluntary's description stays. */}
      {SHOW_DESCRIPTION[show] && (
        <Typography variant="body2" color="text.secondary">
          {SHOW_DESCRIPTION[show]}
        </Typography>
      )}

      {loading ? (
        <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1.5 }} />
      ) : requests.isError ? (
        <ErrorNotice error={requests.error} onRetry={() => requests.refetch()}>
          Couldn't load feedback requests.
        </ErrorNotice>
      ) : leadersFailed ? (
        <ErrorNotice error={leaders.error} onRetry={() => leaders.refetch()} retrying={leaders.isFetching}>
          Couldn't load the leadership team.
        </ErrorNotice>
      ) : (
        <Card variant="outlined" sx={{ p: 2 }}>
          {shown.length === 0 ? (
            <ParEmptyState text={held ? "You haven't given any feedback yet" : EMPTY[show]} />
          ) : (
            <>
              {/* The due date only while a cycle is taking feedback. */}
              {waiting.length > 0 && !held && !deadlinePassed && (
                <Box sx={{ display: "flex", mb: 1 }}>
                  <ParDueChip due={cycle.parThreeSixtyRatingDeadline} />
                </Box>
              )}
              <Stack divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />}>
                {shown.map((item, i) => (
                  <PersonRow
                    key={`${item.kind}-${item.email}-${i}`}
                    name={item.name}
                    email={item.email}
                    note={feedbackSource(item)}
                    kind={item.kind}
                  >
                    <ItemActions
                      item={item}
                      onOpen={() => open(item)}
                      onView={() => setViewing(item)}
                      onDecline={() => setDeclining(item)}
                      onDiscard={() => setDiscarding(item)}
                    />
                  </PersonRow>
                ))}
              </Stack>
            </>
          )}
        </Card>
      )}

      {(giving?.kind === "PAR" || viewing?.kind === "PAR") && (
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
          held={held}
        />
      )}
      {viewing?.kind === "LEADERSHIP" && viewing.given?.anonymous === false && openSurvey && (
        <Leadership360FeedbackDialog
          open
          onClose={() => setViewing(null)}
          survey={openSurvey}
          leader={leaderOf(viewing)}
          workEmail={workEmail}
          submitted={{ answers: viewing.given.answers ?? {}, on: viewing.given.on }}
          onSubmitted={() => {}}
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
          anonymousGiven={anonymousGiven(giving.leader.workEmail)}
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
                    // Declining a leader also deletes your named Leadership 360° draft on them (the
                    // backend does); an anonymous one is only in this browser.
                    if (declining.kind === "LEADERSHIP" && surveyId !== undefined) {
                      removeLocalDraft(workEmail, surveyId, declining.email);
                    }
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

      <Dialog open={Boolean(discarding)} onClose={() => setDiscarding(null)} maxWidth="xs" fullWidth>
        {discarding && <DiscardConfirm item={discarding} />}
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDiscarding(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={discard.isPending || discardLeadership.isPending}
            onClick={() =>
              discarding &&
              (discarding.kind === "LEADERSHIP" ? discardLeadership : discard).mutate(discarding.email, {
                onSuccess: () => {
                  showSuccess(
                    discarding.kind === "LEADERSHIP"
                      ? `Your draft on ${discarding.name ?? discarding.email} was discarded.`
                      : `Your feedback for ${discarding.name ?? discarding.email} was discarded.`,
                  );
                  setDiscarding(null);
                },
                onError: (err) => showError(describeError(err)),
              })
            }
          >
            {discard.isPending || discardLeadership.isPending ? "Discarding…" : "Discard"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

// What discarding deletes: PAR feedback you offered (the lead stops seeing it too), or a Leadership 360°
// draft, which was only ever yours; a leader's request to you stays.
function DiscardConfirm({ item }: { item: GiveFeedbackItem }) {
  const name = item.name ?? item.email;
  const leadership = item.kind === "LEADERSHIP";
  return (
    <>
      <DialogTitle>{leadership ? `Discard your draft on ${name}?` : `Discard your feedback for ${name}?`}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          {leadership
            ? `${item.request && !item.answered ? "Their request stays in your list. " : ""}You can give feedback any time.`
            : `Your draft will be deleted on ${name}. You can offer feedback again later.`}
        </Typography>
      </DialogContent>
    </>
  );
}

const givenLabel = (given: NonNullable<GiveFeedbackItem["given"]>) =>
  given.anonymous ? "Submitted anonymously" : `Submitted · ${formatShortDate(given.on)}`;

// What a row says and offers: Respond or Continue while it waits on you (with
// Decline when you were asked, and Discard for PAR feedback you offered or a
// Leadership 360° draft), then how it ended.
function ItemActions({
  item,
  onOpen,
  onView,
  onDecline,
  onDiscard,
}: {
  item: GiveFeedbackItem;
  onOpen: () => void;
  onView: () => void;
  onDecline: () => void;
  onDiscard: () => void;
}) {
  if (item.state === "submitted") {
    return (
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <Chip size="small" color="success" label={item.given ? givenLabel(item.given) : "Submitted"} />
        {/* Anonymous Leadership 360° feedback can't be opened: nothing links it to you. */}
        {(item.kind === "PAR" || item.given?.anonymous === false) && (
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
      {/* Once you've given a leader feedback their request is answered: nothing to decline. */}
      {item.request && !item.offered && !item.answered && (
        <Button size="small" color="inherit" onClick={onDecline}>
          Decline
        </Button>
      )}
      {(item.kind === "PAR" ? isVoluntary(item) : draft) && (
        <Button size="small" color="inherit" onClick={onDiscard}>
          Discard
        </Button>
      )}
      <Button size="small" variant="contained" onClick={onOpen}>
        {draft ? "Continue" : "Respond"}
      </Button>
    </Box>
  );
}
