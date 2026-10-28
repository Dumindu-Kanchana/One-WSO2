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
  Divider,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { FormAnswers, FormDefinition, FormQuestion } from "../api/leadership360Types";
import { NOT_OBSERVED } from "../api/review360Types";
import type { Review360Form } from "../api/review360Types";
import { useReviewForm, useSaveReviewForm, useSubmitReviewForm } from "../api/useReview360";
import { cleanAnswers, missingRequired } from "../util/leadership360Form";
import { formatShortDate } from "../util/parDate";
import { isDeadlinePassed } from "../util/parDeadline";
import { ratingLabels } from "../util/review360Form";

const AUTOSAVE_DELAY_MS = 1200;

// Structured 360° feedback on one colleague in a PAR 2.0 cycle: how you work
// together, five behaviours, then keep / start / stop. Drafts save as you go;
// once submitted it can't change. Read-only for feedback already given.
export default function Par360FeedbackDialog({
  open,
  onClose,
  parCycleId,
  employeeEmail,
  employeeName,
  deadline,
}: {
  open: boolean;
  onClose: () => void;
  parCycleId: number;
  employeeEmail: string;
  employeeName: string;
  deadline: string;
}) {
  const form = useReviewForm(parCycleId, employeeEmail, open);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ pb: 0.5 }}>360° feedback for {employeeName}</DialogTitle>
      {form.isLoading ? (
        <DialogContent>
          <Skeleton variant="rectangular" height={420} sx={{ borderRadius: 1.5 }} />
        </DialogContent>
      ) : form.isError ? (
        <DialogContent>
          <ErrorNotice error={form.error} onRetry={() => form.refetch()} retrying={form.isFetching}>
            Couldn't load this feedback form.
          </ErrorNotice>
        </DialogContent>
      ) : !form.data ? (
        <DialogContent>
          <Alert severity="info">You haven't been asked for feedback on {employeeName}.</Alert>
        </DialogContent>
      ) : (
        <FeedbackForm
          key={employeeEmail}
          form={form.data}
          parCycleId={parCycleId}
          employeeName={employeeName}
          deadline={deadline}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

function FeedbackForm({
  form,
  parCycleId,
  employeeName,
  deadline,
  onClose,
}: {
  form: Review360Form;
  parCycleId: number;
  employeeName: string;
  deadline: string;
  onClose: () => void;
}) {
  const definition = form.template.definition;
  const save = useSaveReviewForm(parCycleId, form.employeeEmail);
  const submit = useSubmitReviewForm(parCycleId, form.employeeEmail);
  const { showSuccess, showError } = useNotifications();

  const [answers, setAnswers] = useState<FormAnswers>(form.answers);
  const lastSaved = useRef(JSON.stringify(cleanAnswers(form.answers)));
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);

  const submitted = form.reviewStatus === "SHARED";
  const deadlinePassed = isDeadlinePassed(deadline);
  const editable = !submitted && form.reviewStatus !== "REJECTED" && !deadlinePassed;
  const toSave = cleanAnswers(answers);
  const dirty = JSON.stringify(toSave) !== lastSaved.current;

  useEffect(() => {
    if (!editable || !dirty || save.isPending || confirming) return;
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
  }, [answers, editable, save.isPending, confirming]);

  const setAnswer = (id: string, value: number | string | null) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setMissing([]);
  };

  const askToSubmit = () => {
    const unanswered = missingRequired(definition, answers).map((q) => q.text);
    setMissing(unanswered);
    if (unanswered.length === 0) setConfirming(true);
  };

  const confirmSubmit = () =>
    submit.mutate(toSave, {
      onSuccess: () => {
        setConfirming(false);
        showSuccess(`Your feedback for ${employeeName} has been submitted.`);
        onClose();
      },
      onError: (err) => showError(describeError(err)),
    });

  return (
    <>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {submitted ? (
            <Alert severity="success">You submitted this feedback. It can't be changed.</Alert>
          ) : deadlinePassed ? (
            <Alert severity="error">The deadline for 360° feedback passed on {formatShortDate(deadline)}.</Alert>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {employeeName} sees that you responded, never what you wrote. Their lead reads it with your name, and{" "}
              {employeeName} gets an anonymised summary once at least three people have responded. Due{" "}
              {formatShortDate(deadline)}.
            </Typography>
          )}
          {definition.sections.map((section) => (
            <Box key={section.id}>
              <Typography sx={{ fontWeight: 600 }}>{section.title}</Typography>
              {section.hint && (
                <Typography variant="body2" color="text.secondary">
                  {section.hint}
                </Typography>
              )}
              <Stack spacing={2} sx={{ mt: 1.5 }} divider={<Divider flexItem />}>
                {section.questions.map((q) => (
                  <QuestionField
                    key={q.id}
                    question={q}
                    definition={definition}
                    value={answers[q.id]}
                    readOnly={!editable}
                    onChange={(value) => setAnswer(q.id, value)}
                  />
                ))}
              </Stack>
            </Box>
          ))}
          {missing.length > 0 && <Alert severity="warning">Still to answer: {missing.join(", ")}.</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5, justifyContent: "space-between" }}>
        <Typography variant="caption" color="text.secondary">
          {editable &&
            (save.isPending
              ? "Saving…"
              : savedAt
                ? `Draft saved ${savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "Saves as you go")}
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button onClick={onClose}>{editable ? "Close" : "Done"}</Button>
          {editable && (
            <Button variant="contained" onClick={askToSubmit} disabled={submit.isPending}>
              Submit feedback
            </Button>
          )}
        </Box>
      </DialogActions>

      <Dialog open={confirming} onClose={() => setConfirming(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Submit your feedback?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            You can't change it after you submit.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirming(false)}>Cancel</Button>
          <Button variant="contained" onClick={confirmSubmit} disabled={submit.isPending || save.isPending}>
            {submit.isPending ? "Submitting…" : "Submit"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function QuestionField({
  question,
  definition,
  value,
  readOnly,
  onChange,
}: {
  question: FormQuestion;
  definition: FormDefinition;
  value: number | string | null | undefined;
  readOnly: boolean;
  onChange: (value: number | string | null) => void;
}) {
  const label = (
    <Box sx={{ mb: 1 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {question.text}
        {!question.required && (
          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            Optional
          </Typography>
        )}
      </Typography>
      {question.hint && (
        <Typography variant="caption" color="text.secondary">
          {question.hint}
        </Typography>
      )}
    </Box>
  );

  if (question.type === "RATING") {
    const scale = definition.scales[question.scale ?? ""];
    if (!scale) return null;
    const labels = ratingLabels(scale);
    return (
      <Box>
        {label}
        <ToggleButtonGroup
          exclusive
          size="small"
          value={value ?? null}
          disabled={readOnly}
          onChange={(_, next: number | string | null) => onChange(next)}
          aria-label={question.text}
          sx={{ flexWrap: "wrap" }}
        >
          {labels.map(({ value: v, label: text }) => (
            <ToggleButton key={v} value={v} sx={{ px: 1.5, textTransform: "none" }}>
              {v} · {text}
            </ToggleButton>
          ))}
          {scale.allowNotObserved && (
            <ToggleButton value={NOT_OBSERVED} sx={{ px: 1.5, textTransform: "none", fontStyle: "italic" }}>
              Not observed
            </ToggleButton>
          )}
        </ToggleButtonGroup>
      </Box>
    );
  }

  if (question.type === "CHOICE") {
    return (
      <Box>
        {label}
        <ToggleButtonGroup
          exclusive
          size="small"
          value={value ?? null}
          disabled={readOnly}
          onChange={(_, next: string | null) => onChange(next)}
          aria-label={question.text}
          sx={{ flexWrap: "wrap" }}
        >
          {(question.options ?? []).map((o) => (
            <ToggleButton key={o.value} value={o.value} sx={{ px: 1.5, textTransform: "none" }}>
              {o.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
    );
  }

  const text = typeof value === "string" ? value : "";
  return (
    <Box>
      {label}
      {readOnly ? (
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", color: text ? "text.primary" : "text.secondary" }}>
          {text || "—"}
        </Typography>
      ) : (
        <TextField
          multiline
          minRows={3}
          fullWidth
          value={text}
          placeholder={question.placeholder}
          onChange={(e) => onChange(e.target.value)}
          slotProps={{ htmlInput: { maxLength: question.maxLength, "aria-label": question.text } }}
        />
      )}
    </Box>
  );
}
