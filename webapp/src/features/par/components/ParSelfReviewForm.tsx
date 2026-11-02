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
  IconButton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@wso2/oxygen-ui";
import { LightbulbIcon, PlayCircleIcon, PlusIcon, Trash2Icon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { isPreviewEnabled } from "@config/previewFeatures";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { FormQuestion } from "../api/leadership360Types";
import type { ParCycle, ParRating } from "../api/types";
import type { SelfReview, SelfReviewAnswers, SelfReviewGoal } from "../api/selfReviewTypes";
import { useSaveParRating } from "../api/useParMutations";
import { useSaveSelfReview, useShareSelfReview } from "../api/useSelfReview";
import { useReviewSummary } from "../api/useReview360";
import { useCycleLeadership360ForPdf } from "../api/useLeadership360";
import { decodeParComment } from "../util/parComment";
import { downloadPar2Pdf } from "../util/parPdf";
import { formatShortDate } from "../util/parDate";
import { isDeadlinePassed } from "../util/parDeadline";
import { answersToSave, goalsOf, isSectionAnswered, shareBlockers } from "../util/selfReviewForm";
import ParRatingSummary from "./ParRatingSummary";
import ParSelfReviewView from "./ParSelfReviewView";
import { ParOkrCard } from "./ParOkrPanel";
import { appendLine, okrCitation } from "../util/okr";

const AUTOSAVE_DELAY_MS = 1200;
const GOAL_MAX_LENGTH = 300;

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
  const deadlinePassed = isDeadlinePassed(cycle.parEmployeeDeadline);
  const editable = !shared && !deadlinePassed && (started || status === "DRAFT");
  // Same rule as the single comment: unshare until the lead shares their side.
  const canUnshare = status === "SHARED" && rating.parLeadStatus !== "SHARED" && !deadlinePassed;
  const leadShared = Boolean(rating.parLeadComment || rating.parRating);
  // The finished PAR's PDF carries the anonymised 360° summary when there is one.
  const review360 = useReviewSummary(cycle.parCycleId, workEmail, leadShared);
  // A leader's Leadership 360° results go in the PDF too, as of today while the survey is open.
  const leadership360 = useCycleLeadership360ForPdf(
    cycle.parCycleId,
    workEmail,
    leadShared && isPreviewEnabled("leadership360"),
  );

  const toSave = answersToSave(definition, answers);
  const dirty = JSON.stringify(toSave) !== lastSaved.current;

  // Autosave a moment after the employee stops typing.
  useEffect(() => {
    if (!editable || !dirty || save.isPending) return;
    const timer = window.setTimeout(() => {
      const snapshot = JSON.stringify(toSave);
      save.mutate(toSave, {
        onSuccess: () => {
          lastSaved.current = snapshot;
          setSavedAt(new Date());
        },
        onError: (err) => showError(describeError(err)),
      });
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, editable, save.isPending]);

  const setAnswer = (questionId: string, value: string | SelfReviewGoal[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setBlockers([]);
  };

  const askToShare = () => {
    const missing = shareBlockers(definition, answers);
    setBlockers(missing);
    if (missing.length === 0) setConfirming(true);
  };

  const confirmShare = async () => {
    try {
      if (dirty) {
        await save.mutateAsync(toSave);
        lastSaved.current = JSON.stringify(toSave);
      }
      await share.mutateAsync();
      setConfirming(false);
      showSuccess("Your self-review has been shared with your lead.");
    } catch (err) {
      showError(describeError(err));
    }
  };

  const answered = definition.sections.filter((s) => isSectionAnswered(s, answers)).length;
  // OKRs cite into the first section's text (Impact this cycle).
  const citeSection = definition.sections.findIndex((sec) => sec.questions.some((q) => q.type === "TEXT"));
  const citeQuestion = definition.sections[citeSection]?.questions.find((q) => q.type === "TEXT");
  const citeOkr = citeQuestion
    ? (okr: Parameters<typeof okrCitation>[0]) => {
        const current = typeof answers[citeQuestion.id] === "string" ? (answers[citeQuestion.id] as string) : "";
        setAnswer(citeQuestion.id, appendLine(current, okrCitation(okr)));
        showSuccess(`Added to section ${citeSection + 1}.`);
      }
    : undefined;

  if (shared || (deadlinePassed && status !== "DRAFT")) {
    const view = <ParSelfReviewView definition={definition} answers={selfReview.answers} />;
    return (
      <Stack spacing={1.75} sx={{ maxWidth: 1100 }}>
        {status === "SHARED" && <Alert severity="success">Your self-review has been shared with your lead.</Alert>}
        {status === "SHARED_BLOCKED" && (
          <Alert severity={rating.parLeadStatus === "SHARED" ? "success" : "info"}>
            {rating.parLeadStatus === "SHARED"
              ? "Your lead has shared their review."
              : "Your self-review is locked in while your lead completes theirs."}
          </Alert>
        )}
        {!shared && (
          <Alert severity="error">
            The deadline for your self-review passed on {formatShortDate(cycle.parEmployeeDeadline)}.
          </Alert>
        )}
        {leadShared ? (
          <ParRatingSummary
            cycle={cycle}
            rating={rating}
            selfReview={view}
            onDownloadPdf={() =>
              downloadPar2Pdf({
                rating,
                leadComment: decodeParComment(rating.parLeadComment),
                selfReview: { definition, answers: selfReview.answers },
                review360: review360.data ?? undefined,
                leadership360,
              })
            }
          />
        ) : (
          view
        )}
        {canUnshare && (
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button color="error" variant="outlined" onClick={() => setUnsharing(true)}>
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
      <Card variant="outlined" sx={{ p: 4, textAlign: "center", maxWidth: 1100 }}>
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
          {definition.sections.map((s) => s.title.toLowerCase()).join(", ")}. Everything saves as you write. Share it with your lead by {formatShortDate(cycle.parEmployeeDeadline)}.
        </Typography>
        <Button variant="contained" size="large" onClick={() => setStarted(true)}>
          Start
        </Button>
      </Card>
    );
  }

  return (
    <Stack spacing={2} sx={{ maxWidth: 1100 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Goes to {leadEmail ?? "your lead"} when you share · You can unshare until they start their review · Due{" "}
          {formatShortDate(cycle.parEmployeeDeadline)}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            {save.isPending
              ? "Saving…"
              : savedAt
                ? `Saved ${savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : ""}
          </Typography>
          <Chip size="small" label={`${answered} of ${definition.sections.length} sections`} />
          <Button variant="contained" disabled={share.isPending || deadlinePassed} onClick={askToShare}>
            Share with lead
          </Button>
        </Box>
      </Box>

      {blockers.length > 0 && <Alert severity="warning">Before you share: {blockers.join("; ")}.</Alert>}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 280px" },
          gap: 2,
          alignItems: "start",
        }}
      >
        <Stack spacing={2}>
          {definition.sections.map((section, i) => (
            <Card key={section.id} variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: "flex", gap: 1.5, mb: 1.5 }}>
                <Box
                  sx={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 600,
                    bgcolor: isSectionAnswered(section, answers) ? "primary.main" : "action.selected",
                    color: isSectionAnswered(section, answers) ? "primary.contrastText" : "text.secondary",
                  }}
                >
                  {i + 1}
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>
                    {section.title}
                    {section.questions.some((q) => q.required) ? "" : " (optional)"}
                  </Typography>
                  {section.hint && (
                    <Typography variant="body2" color="text.secondary">
                      {section.hint}
                    </Typography>
                  )}
                </Box>
              </Box>
              {section.questions.map((q) =>
                q.type === "GOALS" ? (
                  <GoalsEditor
                    key={q.id}
                    question={q}
                    goals={goalsOf(answers, q.id)}
                    onChange={(goals) => setAnswer(q.id, goals)}
                  />
                ) : (
                  <TextField
                    key={q.id}
                    fullWidth
                    multiline
                    minRows={4}
                    placeholder={q.placeholder}
                    value={typeof answers[q.id] === "string" ? (answers[q.id] as string) : ""}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    slotProps={{
                      htmlInput: {
                        maxLength: q.maxLength,
                        "aria-label": q.text,
                      },
                    }}
                  />
                ),
              )}
            </Card>
          ))}
        </Stack>

        <Stack spacing={2}>
          <ParOkrCard
            ownerEmail={workEmail}
            cycleEndDate={cycle.parCycleEndDate}
            onCite={citeOkr}
            citeLabel={`Add to section ${citeSection + 1}`}
          />
          <Card variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <LightbulbIcon size={16} />
              <Typography sx={{ fontWeight: 600 }}>Writing well</Typography>
            </Box>
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Lead with outcomes, not activity.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                One concrete example beats three adjectives.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Be honest about what didn't go to plan: it builds trust.
              </Typography>
            </Stack>
          </Card>
        </Stack>
      </Box>

      <Dialog open={confirming} onClose={() => setConfirming(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Share your self-review?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            <b>{leadEmail ?? "Your lead"}</b> will be able to read it. You can unshare it until they start their review.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirming(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void confirmShare()} disabled={share.isPending || save.isPending}>
            {share.isPending ? "Sharing…" : "Share"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

// Last cycle's goals: a title and how far the employee got with each.
function GoalsEditor({
  question,
  goals,
  onChange,
}: {
  question: FormQuestion;
  goals: SelfReviewGoal[];
  onChange: (goals: SelfReviewGoal[]) => void;
}) {
  const maxItems = question.maxItems ?? 10;
  const update = (index: number, change: Partial<SelfReviewGoal>) =>
    onChange(goals.map((g, i) => (i === index ? { ...g, ...change } : g)));

  return (
    <Stack spacing={1.25}>
      {goals.map((goal, i) => (
        <Box
          key={i}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            flexWrap: { xs: "wrap", sm: "nowrap" },
          }}
        >
          <TextField
            size="small"
            fullWidth
            placeholder="A goal you set last cycle"
            value={goal.title}
            onChange={(e) => update(i, { title: e.target.value })}
            slotProps={{
              htmlInput: {
                maxLength: GOAL_MAX_LENGTH,
                "aria-label": `Goal ${i + 1}`,
              },
            }}
          />
          <ToggleButtonGroup
            exclusive
            size="small"
            value={goal.status}
            onChange={(_, status: string | null) => update(i, { status })}
            aria-label={`Status of goal ${i + 1}`}
          >
            {(question.options ?? []).map((o) => (
              <ToggleButton key={o.value} value={o.value} sx={{ whiteSpace: "nowrap", px: 1.25 }}>
                {o.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <IconButton aria-label={`Remove goal ${i + 1}`} onClick={() => onChange(goals.filter((_, gi) => gi !== i))}>
            <Trash2Icon size={16} />
          </IconButton>
        </Box>
      ))}
      <Box>
        <Button
          size="small"
          startIcon={<PlusIcon size={14} />}
          disabled={goals.length >= maxItems}
          onClick={() => onChange([...goals, { title: "", status: null }])}
        >
          Add a goal
        </Button>
      </Box>
    </Stack>
  );
}
