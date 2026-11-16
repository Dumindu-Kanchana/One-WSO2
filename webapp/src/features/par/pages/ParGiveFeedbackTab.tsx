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
  useMyLeadership360Feedback,
} from "../api/useLeadership360";
import type { Leadership360Leader } from "../api/leadership360Types";
import Par360FeedbackDialog from "../components/Par360FeedbackDialog";
import Par360GiveFeedbackDialog, { type FeedbackStart } from "../components/Par360GiveFeedbackDialog";
import Leadership360FeedbackDialog from "../components/Leadership360FeedbackDialog";
import ParEmptyState from "../components/ParEmptyState";
import { PersonRow, StatusChip } from "../components/Par360PeopleRows";
import { localDraftLeaders, removeLocalDraft } from "../util/leadership360LocalDraft";
import { formatShortDate } from "../util/parDate";
import { isDeadlinePassed } from "../util/parDeadline";
import { feedbackSource, giveFeedbackItems, isVoluntary, isWaiting, type GiveFeedbackItem } from "../util/par360Feedback";
import ParDueChip from "../components/ParDueChip";

type Show = "all" | "requested" | "voluntary";

const EMPTY: Record<Show, string> = {
  all: "No one has asked for your feedback yet",
  requested: "No one has asked for your feedback yet",
  voluntary: "You haven't given feedback nobody asked for this cycle",
};

// Give feedback: one list of everyone who asked for your feedback and the
// feedback you've given, waiting ones first. Who it's about decides the form:
// Leadership 360° for a member of the leadership team, PAR feedback for anyone
// else. Give feedback starts feedback nobody asked for, the person first.
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
  const openSurvey = parts.leadership ? (survey.data ?? undefined) : undefined;
  const surveyId = openSurvey?.survey.surveyId;
  const mine = useMyLeadership360Feedback(surveyId);
  const leaders = useLeadership360Leaders(parts.leadership);
  const decline = useSubmitReview(cycle?.parCycleId);
  const discard = useDiscardReviewForm(cycle?.parCycleId);
  const discardLeadership = useDiscardLeadership360Draft(surveyId, workEmail);
  const { showSuccess, showError } = useNotifications();
  const [choosing, setChoosing] = useState(false);
  const [giving, setGiving] = useState<FeedbackStart | null>(null);
  const [viewing, setViewing] = useState<GiveFeedbackItem | null>(null);
  const [declining, setDeclining] = useState<GiveFeedbackItem | null>(null);
  const [discarding, setDiscarding] = useState<GiveFeedbackItem | null>(null);
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
        : { kind: "PAR", email: item.email, name: item.name ?? item.email, offered: isVoluntary(item) },
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
          {held && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              No PAR cycle is taking feedback right now. Feedback you give now counts toward the next PAR cycle.
            </Typography>
          )}
          {shown.length === 0 ? (
            <ParEmptyState text={held ? "You haven't given any feedback yet" : EMPTY[show]} />
          ) : (
            <>
              {waiting.length > 0 && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    About five minutes each.
                    {waiting.some((item) => !isVoluntary(item)) &&
                      " If you haven't worked closely enough with someone to help, decline instead."}
                  </Typography>
                  {!held && !deadlinePassed && <ParDueChip due={cycle.parThreeSixtyRatingDeadline} />}
                </Box>
              )}
              <Stack divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />}>
                {shown.map((item, i) => (
                  <PersonRow
                    key={`${item.kind}-${item.email}-${i}`}
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
                      onDiscard={() => setDiscarding(item)}
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
          held={held}
          survey={openSurvey}
          leaders={leaders.data ?? []}
          items={items}
          onStart={(start) => {
            setChoosing(false);
            setGiving(start);
          }}
        />
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
          offered={giving?.kind === "PAR" ? Boolean(giving.offered) : isVoluntary(viewing!)}
          relationship={giving?.kind === "PAR" ? giving.relationship : undefined}
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
