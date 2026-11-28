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

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { CircleCheckIcon, PlayCircleIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { ParCycle, ParRating } from "../api/types";
import type { SelfReview, SelfReviewAnswers } from "../api/selfReviewTypes";
import { useSaveParRating } from "../api/useParMutations";
import { useSaveSelfReview, useShareSelfReview } from "../api/useSelfReview";
import { isDeadlinePassed } from "../util/parDeadline";
import { employeeDeadlineFor } from "../util/parDepartments";
import {
  answerHtml,
  answerViewHtml,
  answerOverLimit,
  answersToSave,
  anyAnswerOverLimit,
  isQuestionAnswered,
  isSectionAnswered,
  shareBlockers,
} from "../util/selfReviewForm";
import { ParCommentView } from "./ParContent";
import ParRichTextField from "./ParRichTextField";

const AUTOSAVE_DELAY_MS = 1200;

// The guided self-review of a PAR 2.0 cycle: the template's sections, which autosave as
// the employee writes, shared with the lead in one step. Sharing state lives
// on the PAR record, so unsharing and the lead locking it in work as they do
// for the single comment.
export default function ParSelfReviewForm({
  cycle,
  rating,
  selfReview,
  workEmail,
  leadEmail,
}: {
  cycle: ParCycle;
  rating: ParRating;
  selfReview: SelfReview;
  workEmail: string;
  leadEmail: string | undefined;
}) {
  const definition = selfReview.template.definition;
  const save = useSaveSelfReview(cycle.parCycleId, workEmail);
  const share = useShareSelfReview(cycle.parCycleId, workEmail);
  const unshare = useSaveParRating(cycle.parCycleId, workEmail);
  const { showSuccess, showError } = useNotifications();

  const [answers, setAnswers] = useState<SelfReviewAnswers>(selfReview.answers);
  const lastSaved = useRef(JSON.stringify(answersToSave(definition, selfReview.answers)));
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [started, setStarted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [unsharing, setUnsharing] = useState(false);
  const [blockers, setBlockers] = useState<string[]>([]);

  const status = rating.parEmployeeStatus;
  const shared = status === "SHARED" || status === "SHARED_BLOCKED";
  // Their department's own self-review deadline, or the cycle's.
  const deadlinePassed = isDeadlinePassed(employeeDeadlineFor(cycle, rating.parDepartment));
  const editable = !shared && !deadlinePassed && (started || status === "DRAFT");
  // Same rule as the single comment: unshare until the lead shares their side.
  const canUnshare = status === "SHARED" && rating.parLeadStatus !== "SHARED" && !deadlinePassed;

  const toSave = answersToSave(definition, answers);
  const dirty = JSON.stringify(toSave) !== lastSaved.current;
  // An answer over its limit would be refused, so nothing saves until it's shortened.
  const overLimit = anyAnswerOverLimit(definition, answers);

  // The autosave in flight, if any: the answers it sends, and when it's done.
  const pendingSave = useRef<{ snapshot: string; done: Promise<void> } | null>(null);

  // Autosave a moment after the employee stops typing.
  useEffect(() => {
    if (!editable || !dirty || save.isPending || overLimit) return;
    const timer = window.setTimeout(() => {
      const snapshot = JSON.stringify(toSave);
      const done: Promise<void> = save
        .mutateAsync(toSave)
        .then(
          () => {
            lastSaved.current = snapshot;
            setSavedAt(new Date());
          },
          (err) => showError(describeError(err)),
        )
        .finally(() => {
          if (pendingSave.current?.done === done) pendingSave.current = null;
        });
      pendingSave.current = { snapshot, done };
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, editable, save.isPending]);

  // Leaving the page saves what the autosave hasn't got to yet. A save still in flight is waited for
  // first, then the last answers are saved unless that one kept them (it may have sent other answers,
  // changed and changed back, or failed), so the last answers are the ones kept.
  const leaving = useRef({ answers: toSave, editable: false });
  useEffect(() => {
    leaving.current = { answers: toSave, editable: editable && !share.isPending && !overLimit };
  });
  useEffect(
    () => () => {
      const { answers: last, editable: canSave } = leaving.current;
      if (!canSave) return;
      const snapshot = JSON.stringify(last);
      const saveIfNotKept = () => {
        if (lastSaved.current !== snapshot) save.mutate(last);
      };
      const pending = pendingSave.current;
      if (pending) void pending.done.then(saveIfNotKept);
      else saveIfNotKept();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const setAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setBlockers([]);
  };

  // Starting saves an empty draft, so the self-review counts as started and a reload keeps the form.
  const start = () =>
    save.mutate(toSave, {
      onSuccess: () => {
        lastSaved.current = JSON.stringify(toSave);
        setStarted(true);
      },
      onError: (err) => showError(describeError(err)),
    });

  const askToShare = () => {
    const missing = shareBlockers(definition, answers);
    setBlockers(missing);
    if (missing.length === 0) setConfirming(true);
  };

  // The confirmation stays open while sharing, so no answer can change behind it and then be lost.
  const [sharing, setSharing] = useState(false);
  const confirmShare = async () => {
    setSharing(true);
    try {
      // After any autosave in flight, so the answers shared are the last ones.
      await pendingSave.current?.done;
      if (JSON.stringify(toSave) !== lastSaved.current) {
        await save.mutateAsync(toSave);
        lastSaved.current = JSON.stringify(toSave);
      }
      await share.mutateAsync();
      setConfirming(false);
      showSuccess("Your self-review has been shared with your lead.");
    } catch (err) {
      showError(describeError(err));
    } finally {
      setSharing(false);
    }
  };

  const answered = definition.sections.filter((s) => isSectionAnswered(s, answers)).length;

  // Past the deadline an unshared self-review shows nothing: the step is Incomplete, and the panel's heading
  // says when the deadline passed. A shared one is for reading, with Unshare while that's still possible.
  // The lead's review has its own page.
  if (!shared && deadlinePassed) return null;
  if (shared) {
    return (
      <Stack spacing={1.5}>
        {/* Each section in a box of its own, with its hint and its answer. */}
        {definition.sections.map((section) => (
          <Box key={section.id} sx={{ border: 1, borderColor: "divider", borderRadius: "10px", px: 2, py: 1.75 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: section.hint ? 0.25 : 0.5 }}>
              {section.title}
            </Typography>
            {section.hint && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                {section.hint}
              </Typography>
            )}
            {section.questions.map((q) => (
              <Box key={q.id}>
                {section.questions.length > 1 && (
                  <Typography variant="caption" color="text.secondary" component="div">
                    {q.text}
                  </Typography>
                )}
                {isQuestionAnswered(q, selfReview.answers) ? (
                  <ParCommentView html={answerViewHtml(selfReview.answers[q.id])} />
                ) : (
                  <Typography variant="body2" sx={{ color: "text.disabled", fontStyle: "italic" }}>
                    Not answered
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        ))}
        {canUnshare && (
          <Box sx={{ pt: 1 }}>
            <Button variant="outlined" onClick={() => setUnsharing(true)}>
              Unshare
            </Button>
          </Box>
        )}
        <Dialog open={unsharing} onClose={() => setUnsharing(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Unshare your self-review?</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              This puts your self-review back in draft so you can change it. Your lead won't see it until you share
              again.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setUnsharing(false)}>Cancel</Button>
            <Button
              color="error"
              variant="contained"
              disabled={unshare.isPending}
              onClick={() =>
                unshare.mutate(
                  {
                    parRatingId: rating.parRatingId,
                    parEmployeeStatus: "DRAFT",
                  },
                  {
                    onSuccess: () => {
                      setUnsharing(false);
                      showSuccess("Your self-review is back in draft.");
                    },
                    onError: (err) => showError(describeError(err)),
                  },
                )
              }
            >
              {unshare.isPending ? "Unsharing…" : "Unshare"}
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    );
  }

  if (!editable && status === "PENDING") {
    return (
      <Card variant="outlined" sx={{ p: 4, textAlign: "center" }}>
        <Box
          sx={{
            color: "primary.main",
            display: "flex",
            justifyContent: "center",
            mb: 1.5,
          }}
        >
          <PlayCircleIcon size={36} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          Start your self-review
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 520, mx: "auto" }}>
          {definition.sections.length === 1 ? "One short section" : `${definition.sections.length} short sections`}:{" "}
          {definition.sections.map((s) => s.title.toLowerCase()).join(", ")}. Everything saves as you write.
        </Typography>
        <Button variant="contained" size="large" onClick={start} disabled={save.isPending}>
          {save.isPending ? "Starting…" : "Start"}
        </Button>
      </Card>
    );
  }

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Chip size="small" label={`${answered} of ${definition.sections.length} sections`} />
          {save.isPending ? (
            <Chip size="small" variant="outlined" label="Saving…" />
          ) : (
            savedAt && (
              <Chip
                size="small"
                variant="outlined"
                color="success"
                icon={<CircleCheckIcon size={14} />}
                label={`Saved ${savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
              />
            )
          )}
        </Box>
        <Button variant="contained" disabled={share.isPending || deadlinePassed} onClick={askToShare}>
          Share with lead
        </Button>
      </Box>

      {blockers.length > 0 && <Alert severity="warning">Before you share: {blockers.join("; ")}.</Alert>}

      {/* Each section: its name, its hint and the field. */}
      <Stack spacing={2.5}>
        {definition.sections.map((section) => (
          <Box key={section.id}>
            <Typography sx={{ fontWeight: 600, mb: section.hint ? 0.25 : 1 }}>
              {section.title}
              {section.questions.some((q) => q.required) ? "" : " (optional)"}
            </Typography>
            {section.hint && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {section.hint}
              </Typography>
            )}
            {section.questions.map((q) => {
              const over = answerOverLimit(q, answers);
              return (
                <Box key={q.id}>
                  <ParRichTextField
                    value={answerHtml(answers[q.id])}
                    onChange={(html) => setAnswer(q.id, html)}
                    placeholder={q.placeholder}
                    ariaLabel={q.text}
                    disabled={sharing}
                    minHeight="8rem"
                  />
                  {over > 0 && (
                    <Typography variant="caption" color="error" component="div" sx={{ mt: 0.5 }}>
                      Too long by {over.toLocaleString()} characters (formatting counts too). Shorten it to save.
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        ))}
      </Stack>

      <Dialog open={confirming} onClose={() => !sharing && setConfirming(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Share your self-review?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            If you share this review, your feedback will be made available to <b>{leadEmail || "your lead"}</b>. Do you
            wish to continue?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirming(false)} disabled={sharing}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void confirmShare()} disabled={sharing || save.isPending}>
            {sharing ? "Sharing…" : "Share"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
