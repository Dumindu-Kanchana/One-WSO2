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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@wso2/oxygen-ui";
import ConfirmationDialog, { type ConfirmationContent } from "@components/confirmation-dialog/ConfirmationDialog";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useSaveLeadership360Draft, useSubmitLeadership360Feedback } from "../api/useLeadership360";
import type {
  FormAnswers,
  FormQuestion,
  FormScale,
  FormSection,
  Leadership360CurrentSurvey,
  Leadership360Draft,
  Leadership360Leader,
} from "../api/leadership360Types";
import {
  cleanAnswers,
  headerSections,
  missingRequired,
  sectionComplete,
  sectionProgress,
  stepSections,
} from "../util/leadership360Form";
import { readLocalDraft, removeLocalDraft, writeLocalDraft } from "../util/leadership360LocalDraft";
import { formatShortDate } from "../util/parDate";

const AUTOSAVE_DELAY_MS = 5000;
const DEFAULT_TEXT_MAX_LENGTH = 5000;

const MONTH_NAMES = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" });

/** "November" for "2026-11", and the first day of the next month ("1 December"). */
function monthNames(month: string): { name: string; next: string } {
  const [year, m] = month.split("-").map(Number);
  return {
    name: MONTH_NAMES.format(new Date(Date.UTC(year, m - 1, 1))),
    next: `1 ${MONTH_NAMES.format(new Date(Date.UTC(year, m, 1)))}`,
  };
}

/** A step's number, green once the step is done (like the cycle tracker's). */
function StepNumber({ number, done, current }: { number: number; done: boolean; current: boolean }) {
  return (
    <Box
      sx={{
        width: 24,
        height: 24,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 700,
        bgcolor: done ? "success.main" : current ? "primary.main" : "action.selected",
        color: done || current ? "common.white" : "text.secondary",
      }}
    >
      {number}
    </Box>
  );
}

/** A step that is just one comment box, such as the written feedback at the end. */
function isCommentOnly(section: FormSection): boolean {
  return section.questions.length === 1 && section.questions[0].type === "TEXT";
}

// Feedback on one member of the leadership group: the relationship question,
// then one step per template section, saved as a draft as you go. Anonymous
// by default, once per leader per calendar month; named any number of times.
// A named draft is saved on the server; an anonymous one only in this browser.
export default function Leadership360FeedbackDialog({
  open,
  onClose,
  survey,
  leader,
  workEmail,
  draft,
  anonymousUsedThisMonth = false,
  currentMonth,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  survey: Leadership360CurrentSurvey;
  leader: Leadership360Leader;
  /** The person giving feedback, whose browser keeps their anonymous drafts. */
  workEmail: string;
  /** The named draft saved on the server, if any. */
  draft?: Leadership360Draft;
  /** Anonymous feedback on this leader was already given this calendar month. */
  anonymousUsedThisMonth?: boolean;
  /** This calendar month (YYYY-MM), from the server. */
  currentMonth?: string;
  onSubmitted: (leader: Leadership360Leader) => void;
}) {
  const { definition } = survey.template;
  const headers = headerSections(definition);
  const steps = stepSections(definition);
  const surveyId = survey.survey.surveyId;

  const [initial] = useState(() => {
    if (draft) return { answers: draft.answers, anonymous: false };
    const local = anonymousUsedThisMonth ? null : readLocalDraft(workEmail, surveyId, leader.workEmail);
    return { answers: local ?? {}, anonymous: !anonymousUsedThisMonth };
  });
  const [answers, setAnswers] = useState<FormAnswers>(initial.answers);
  const [anonymous, setAnonymous] = useState(initial.anonymous);
  const [step, setStep] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [savedLocally, setSavedLocally] = useState(false);
  const [missingCount, setMissingCount] = useState(0);
  const [confirmation, setConfirmation] = useState<ConfirmationContent | null>(null);

  const saveDraft = useSaveLeadership360Draft(surveyId);
  const submit = useSubmitLeadership360Feedback(surveyId);
  const latest = useRef({ answers, anonymous });
  latest.current = { answers, anonymous };
  // Whether the server holds a named draft that an anonymous one must replace.
  const serverDraft = useRef(Boolean(draft));
  const month = currentMonth ? monthNames(currentMonth) : undefined;

  const save = () => {
    setDirty(false);
    const { answers: current, anonymous: isAnonymous } = latest.current;
    if (isAnonymous) {
      setSavedLocally(writeLocalDraft(workEmail, surveyId, leader.workEmail, cleanAnswers(current)));
      // Saving as anonymous removes the named copy from the server (and stores nothing there).
      if (serverDraft.current) {
        serverDraft.current = false;
        saveDraft.mutate({ leaderEmail: leader.workEmail, answers: {}, anonymous: true });
      }
      return;
    }
    removeLocalDraft(workEmail, surveyId, leader.workEmail);
    setSavedLocally(false);
    serverDraft.current = true;
    saveDraft.mutate({ leaderEmail: leader.workEmail, answers: cleanAnswers(current), anonymous: false });
  };

  // Autosave a few seconds after the last change, so nothing is lost.
  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(save, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- save reads the latest values through the ref
  }, [dirty, answers, anonymous]);

  const setAnswer = (questionId: string, value: number | string | null) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setDirty(true);
    setMissingCount(0);
  };

  const close = () => {
    if (dirty) save();
    onClose();
  };

  const trySubmit = () => {
    const missing = missingRequired(definition, answers);
    if (missing.length > 0) {
      setMissingCount(missing.length);
      const firstStep = steps.findIndex((s) => s.questions.some((q) => q.id === missing[0].id));
      if (firstStep >= 0) setStep(firstStep);
      return;
    }
    setConfirmation({
      title: `Submit feedback on ${leader.employeeName}?`,
      text: anonymous
        ? `Your name isn't stored with this response, so it can't be edited or withdrawn after you submit. You can give anonymous feedback on ${leader.employeeName} again${month ? ` from ${month.next}` : " next month"}.`
        : `${leader.employeeName} sees your comments with your name; their manager and People Ops see your whole response. You can give named feedback again later, and your latest scores are the ones that count.`,
      confirmLabel: anonymous ? "Submit anonymously" : "Submit with my name",
      confirmColor: "primary",
      confirmAction: () =>
        submit.mutate(
          { leaderEmail: leader.workEmail, answers: cleanAnswers(answers), anonymous },
          {
            onSuccess: () => {
              setDirty(false);
              if (anonymous) removeLocalDraft(workEmail, surveyId, leader.workEmail);
              onSubmitted(leader);
              onClose();
            },
          },
        ),
    });
  };

  const isLastStep = step === steps.length - 1;
  const section = steps[step];

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="md">
      <DialogTitle>
        Feedback on {leader.employeeName}
        <Typography variant="body2" color="text.secondary">
          {[leader.jobRole, `${survey.survey.surveyName}, open until ${formatShortDate(survey.survey.endDate)}`]
            .filter(Boolean)
            .join(" · ")}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {headers.flatMap((s) => s.questions).map((q) => (
            <QuestionField
              key={q.id}
              question={q}
              scale={q.scale ? definition.scales[q.scale] : undefined}
              value={answers[q.id]}
              onChange={(value) => setAnswer(q.id, value)}
            />
          ))}

          <Stepper activeStep={step} alternativeLabel>
            {steps.map((s, i) => {
              const { answered, total } = sectionProgress(s, answers);
              const done = sectionComplete(s, answers);
              return (
                // Done means answered, not just passed: a step you skipped keeps its number.
                <Step key={s.id} completed={done}>
                  <StepLabel
                    icon={<StepNumber number={i + 1} done={done} current={i === step} />}
                    optional={
                      <Typography variant="caption" color="text.secondary">
                        {total > 0 ? `${answered} of ${total} answered` : "Written comments"}
                      </Typography>
                    }
                  >
                    {s.title}
                  </StepLabel>
                </Step>
              );
            })}
          </Stepper>

          {section && (
            <Box>
              {/* The written-feedback step (one comment box) needs no heading: the
                  question says what to write, and the stepper names the step. */}
              {!isCommentOnly(section) && (
                <Typography variant="h6" component="h2">
                  {section.title}
                </Typography>
              )}
              {!isCommentOnly(section) && section.hint && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {section.hint}
                </Typography>
              )}
              <Stack spacing={2.5}>
                {section.questions.map((q) => (
                  <QuestionField
                    key={q.id}
                    question={q}
                    scale={q.scale ? definition.scales[q.scale] : undefined}
                    value={answers[q.id]}
                    onChange={(value) => setAnswer(q.id, value)}
                  />
                ))}
              </Stack>
            </Box>
          )}

          <Box>
            {/* One fixed label, so the switch reads the same either way: off is
                anonymous, and it stays on (greyed out) once anonymous is used up. */}
            <FormControlLabel
              control={
                <Switch
                  checked={!anonymous}
                  disabled={anonymousUsedThisMonth}
                  onChange={(e) => {
                    setAnonymous(!e.target.checked);
                    setDirty(true);
                  }}
                />
              }
              label="Submit with my name"
            />
            {anonymousUsedThisMonth && (
              <Alert severity="info" sx={{ my: 1 }}>
                You gave anonymous feedback on {leader.employeeName} in {month?.name ?? "this month"}. You can give named
                feedback now, or anonymous feedback again from {month?.next ?? "next month"}.
              </Alert>
            )}
            <Typography variant="body2" color="text.secondary">
              {anonymous
                ? `Your name isn't stored with this response. Nobody — not the leader, their manager or People Ops — can see who you are. Anonymous feedback on a leader is once a month, and your draft is kept only in this browser.`
                : `${leader.employeeName} sees your comments with your name. Their manager and People Ops see your whole response.`}
            </Typography>
          </Box>

          {missingCount > 0 && (
            <Alert severity="warning">
              {missingCount === 1
                ? "1 required question still needs an answer."
                : `${missingCount} required questions still need an answer.`}
            </Alert>
          )}
          {submit.isError && <ErrorNotice error={submit.error}>Couldn't submit your feedback.</ErrorNotice>}
          {saveDraft.isError && <ErrorNotice error={saveDraft.error}>Couldn't save your draft.</ErrorNotice>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mr: "auto" }}>
          {saveDraft.isPending
            ? "Saving draft…"
            : dirty
              ? ""
              : anonymous && savedLocally
                ? "Draft saved in this browser"
                : !anonymous && saveDraft.isSuccess
                  ? "Draft saved"
                  : ""}
        </Typography>
        <Button size="small" onClick={close}>
          Close
        </Button>
        <Button size="small" onClick={save} disabled={!dirty || saveDraft.isPending}>
          Save draft
        </Button>
        <Button size="small" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          Back
        </Button>
        {isLastStep ? (
          <Button size="small" variant="contained" onClick={trySubmit} disabled={submit.isPending}>
            {anonymous ? "Submit anonymously" : "Submit with my name"}
          </Button>
        ) : (
          <Button size="small" variant="contained" onClick={() => setStep((s) => s + 1)}>
            Next
          </Button>
        )}
      </DialogActions>
      <ConfirmationDialog content={confirmation} onClose={() => setConfirmation(null)} />
    </Dialog>
  );
}

function QuestionField({
  question,
  scale,
  value,
  onChange,
}: {
  question: FormQuestion;
  scale?: FormScale;
  value: number | string | null | undefined;
  onChange: (value: number | string | null) => void;
}) {
  const label = (
    <Typography variant="body1" sx={{ fontWeight: 500 }}>
      {question.text}
      {question.required ? (
        <Box component="span" aria-hidden sx={{ color: "error.main", ml: 0.5 }}>
          *
        </Box>
      ) : (
        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
          Optional
        </Typography>
      )}
    </Typography>
  );

  if (question.type === "RATING" && scale) {
    const ratings = Array.from({ length: scale.max - scale.min + 1 }, (_, i) => scale.min + i);
    return (
      <Box>
        {label}
        <ToggleButtonGroup
          exclusive
          size="small"
          value={typeof value === "number" ? value : null}
          onChange={(_, next: number | null) => onChange(next)}
          aria-label={question.text}
          sx={{ mt: 1 }}
        >
          {ratings.map((r) => (
            <ToggleButton key={r} value={r} aria-label={`${r} of ${scale.max}`} sx={{ minWidth: 48 }}>
              {r}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {(scale.minLabel || scale.maxLabel) && (
          <Box sx={{ display: "flex", justifyContent: "space-between", maxWidth: 48 * ratings.length, mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              {scale.minLabel}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {scale.maxLabel}
            </Typography>
          </Box>
        )}
      </Box>
    );
  }

  if (question.type === "CHOICE") {
    return (
      <Box>
        {label}
        <RadioGroup
          row
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          aria-label={question.text}
        >
          {(question.options ?? []).map((o) => (
            <FormControlLabel key={o.value} value={o.value} control={<Radio size="small" />} label={o.label} />
          ))}
        </RadioGroup>
      </Box>
    );
  }

  const maxLength = question.maxLength ?? DEFAULT_TEXT_MAX_LENGTH;
  const text = typeof value === "string" ? value : "";
  return (
    <Box>
      {label}
      <TextField
        multiline
        minRows={4}
        fullWidth
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="A specific situation, what they did, and the effect it had"
        helperText={`${text.length} / ${maxLength}`}
        slotProps={{ htmlInput: { maxLength, "aria-label": question.text } }}
        sx={{ mt: 1 }}
      />
    </Box>
  );
}
