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
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { CircleHelpIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { FormAnswers, FormDefinition, FormQuestion, FormSection } from "../api/leadership360Types";
import type { Review360Form } from "../api/review360Types";
import { useReviewForm, useSaveReviewForm, useSubmitReviewForm } from "../api/useReview360";
import { cleanAnswers, missingRequired } from "../util/leadership360Form";
import { formatShortDate } from "../util/parDate";
import { isDeadlinePassed } from "../util/parDeadline";
import { ratingLabels } from "../util/review360Form";
import { scaleTintSx } from "../util/scaleTint";

const AUTOSAVE_DELAY_MS = 1200;

type Answer = FormAnswers[string];

// Structured 360° feedback on one colleague in a PAR 2.0 cycle: five
// behaviours, then optional written feedback. How you work together comes from
// the request or the offer; the form asks it only when that wasn't given yet (a
// held draft moved into the cycle). Drafts save as you go; once submitted it
// can't change. Read-only for feedback already given.
export default function Par360FeedbackDialog({
  open,
  onClose,
  parCycleId,
  employeeEmail,
  employeeName,
  deadline,
  held = false,
  offered = false,
  relationship,
}: {
  open: boolean;
  onClose: () => void;
  parCycleId: number;
  employeeEmail: string;
  employeeName: string;
  deadline: string;
  /** No cycle is taking feedback: it's held for the employee's next cycle. */
  held?: boolean;
  /** Nobody asked you for it. */
  offered?: boolean;
  /** How you said you work with them, offering feedback the form doesn't have yet (held feedback). */
  relationship?: string;
}) {
  const form = useReviewForm(parCycleId, employeeEmail, open);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ pb: 0.5, fontWeight: 400, color: "text.secondary" }}>
        360° feedback for{" "}
        <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>
          {employeeName}
        </Box>
      </DialogTitle>
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
          held={held}
          offered={offered || held}
          relationship={relationship}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

/** Answers given when the feedback was asked for (or offered), which the form doesn't ask again. */
function givenAnswers(form: Review360Form, relationship: string | undefined): FormAnswers {
  const asked = form.template.definition.sections.flatMap((s) => s.questions).find((q) => q.askedOnRequest);
  return { ...(asked && relationship ? { [asked.id]: relationship } : {}), ...form.requestAnswers };
}

/** The sections and questions left to show once `given` ones are taken out. */
function withoutGiven(definition: FormDefinition, given: FormAnswers): FormSection[] {
  return definition.sections
    .map((s) => ({ ...s, questions: s.questions.filter((q) => given[q.id] === undefined) }))
    .filter((s) => s.questions.length > 0);
}

function FeedbackForm({
  form,
  parCycleId,
  employeeName,
  deadline,
  held,
  offered,
  relationship,
  onClose,
}: {
  form: Review360Form;
  parCycleId: number;
  employeeName: string;
  deadline: string;
  held: boolean;
  offered: boolean;
  relationship: string | undefined;
  onClose: () => void;
}) {
  const definition = form.template.definition;
  const save = useSaveReviewForm(parCycleId, form.employeeEmail);
  const submit = useSubmitReviewForm(parCycleId, form.employeeEmail);
  const { showSuccess, showError } = useNotifications();

  // Given answers go with every save, but don't count as a change: opening the form starts no draft.
  const [given] = useState(() => givenAnswers(form, relationship));
  const sections = withoutGiven(definition, given);
  const [answers, setAnswers] = useState<FormAnswers>(() => ({ ...form.answers, ...given }));
  const lastSaved = useRef(JSON.stringify(cleanAnswers({ ...form.answers, ...given })));
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

  // Closing saves what the autosave hasn't got to yet; once submitted there's nothing left to save.
  const unsaved = useRef<FormAnswers | null>(null);
  unsaved.current = editable && dirty && !submit.isPending && !submit.isSuccess ? toSave : null;
  useEffect(
    () => () => {
      if (unsaved.current) save.mutate(unsaved.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const setAnswer = (id: string, value: Answer) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setMissing([]);
  };

  const askToSubmit = () => {
    const unanswered = missingRequired(definition, answers);
    setMissing(unanswered.map((q) => q.id));
    if (unanswered.length === 0) setConfirming(true);
  };
  const missingText = sections
    .flatMap((s) => s.questions)
    .filter((q) => missing.includes(q.id))
    .map((q) => q.text);

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
      <DialogContent dividers sx={{ py: 2 }}>
        <Stack spacing={2}>
          {submitted ? (
            <Alert severity="success">You submitted this feedback. It can't be changed.</Alert>
          ) : deadlinePassed ? (
            <Alert severity="error">The deadline for 360° feedback passed on {formatShortDate(deadline)}.</Alert>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {offered
                ? `${employeeName}'s lead sees your feedback with your name.`
                : `${employeeName} sees only anonymised scores; their lead sees your feedback with your name.`}
              {held && " It counts toward their next PAR cycle."}
            </Typography>
          )}
          {sections.map((section) => (
            <SectionFields
              key={section.id}
              section={section}
              definition={definition}
              answers={answers}
              readOnly={!editable}
              missing={missing}
              onChange={setAnswer}
            />
          ))}
          {missingText.length > 0 && (
            <Alert severity="warning">
              Still to answer: {missingText.join(", ")}
              {/[.?!]$/.test(missingText[missingText.length - 1]) ? "" : "."}
            </Alert>
          )}
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
              Submit
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

function RequiredMark() {
  return (
    <Box component="span" aria-hidden sx={{ color: "error.main", ml: 0.25 }}>
      *
    </Box>
  );
}

function OptionalMark() {
  return (
    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1, fontWeight: 400 }}>
      Optional
    </Typography>
  );
}

const isWrittenSection = (section: FormSection) => section.questions.every((q) => q.type === "TEXT");

// One section of the template. Choice and rating questions take a line each, the options on the
// right; written questions are text boxes.
function SectionFields({
  section,
  definition,
  answers,
  readOnly,
  missing,
  onChange,
}: {
  section: FormSection;
  definition: FormDefinition;
  answers: FormAnswers;
  readOnly: boolean;
  /** Required questions left unanswered on the last submit. */
  missing: string[];
  onChange: (id: string, value: Answer) => void;
}) {
  const single = section.questions.length === 1;
  if (isWrittenSection(section)) {
    return (
      <Box>
        <SectionHeading section={section} readOnly={readOnly} />
        <Stack spacing={1.5} sx={{ mt: 0.75 }}>
          {section.questions.map((q) => (
            <WrittenAnswer
              key={q.id}
              question={q}
              labelled={!single}
              value={answers[q.id]}
              readOnly={readOnly}
              onChange={(v) => onChange(q.id, v)}
            />
          ))}
        </Stack>
      </Box>
    );
  }
  return (
    <Box>
      {/* A section with a single question is just that question: its title would repeat it. */}
      {!single && <SectionHeading section={section} readOnly={readOnly} />}
      {section.questions.map((q, i) => (
        <Box
          key={q.id}
          sx={{
            display: "flex",
            flexWrap: { xs: "wrap", md: "nowrap" },
            alignItems: "center",
            justifyContent: "space-between",
            columnGap: 2,
            rowGap: 0.75,
            py: 0.75,
            borderTop: single ? 0 : 1,
            borderBottom: !single && i === section.questions.length - 1 ? 1 : 0,
            borderColor: "divider",
          }}
        >
          <QuestionName question={q} missing={missing.includes(q.id)} readOnly={readOnly} />
          <OptionToggles
            question={q}
            definition={definition}
            value={answers[q.id]}
            readOnly={readOnly}
            onChange={(v) => onChange(q.id, v)}
          />
        </Box>
      ))}
    </Box>
  );
}

function SectionHeading({ section, readOnly }: { section: FormSection; readOnly: boolean }) {
  // A one-question section is named by its title, so the title carries the question's mark.
  const required = section.questions.length === 1 && section.questions[0].required;
  const optional = section.questions.every((q) => !q.required);
  return (
    <Box sx={{ mb: 0.5 }}>
      <Typography variant="subtitle2" component="h3" sx={{ fontWeight: 700, lineHeight: 1.4 }}>
        {section.title}
        {!readOnly && required && <RequiredMark />}
        {!readOnly && optional && <OptionalMark />}
      </Typography>
      {section.hint && (
        <Typography variant="caption" color="text.secondary" component="div" sx={{ lineHeight: 1.35 }}>
          {section.hint}
        </Typography>
      )}
    </Box>
  );
}

/** The question's name, with what it means behind a help icon. */
function QuestionName({ question, missing, readOnly }: { question: FormQuestion; missing: boolean; readOnly: boolean }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, color: missing ? "error.main" : "text.primary" }}>
        {question.text}
        {question.required && !readOnly && <RequiredMark />}
      </Typography>
      {question.hint && (
        <Tooltip title={question.hint} arrow enterTouchDelay={0}>
          <Box
            component="span"
            role="img"
            tabIndex={0}
            aria-label={question.hint}
            sx={{ display: "flex", color: "text.secondary", cursor: "help" }}
          >
            <CircleHelpIcon size={15} />
          </Box>
        </Tooltip>
      )}
    </Box>
  );
}

const OPTION_SX = { px: 1.5, py: 0.75, fontSize: 13, lineHeight: 1.3, textTransform: "none", whiteSpace: "nowrap" } as const;

/** A question's options. A picked rating takes its colour on the scale, red to green. */
function OptionToggles({
  question,
  definition,
  value,
  readOnly,
  onChange,
}: {
  question: FormQuestion;
  definition: FormDefinition;
  value: Answer | undefined;
  readOnly: boolean;
  onChange: (value: Answer) => void;
}) {
  const name = question.required ? `${question.text} (required)` : question.text;
  if (question.type === "CHOICE") {
    return (
      <OptionGroup label={name} options={question.options ?? []} value={value} readOnly={readOnly} onChange={onChange} />
    );
  }
  const scale = definition.scales[question.scale ?? ""];
  if (!scale) return null;
  return (
    <Box
      role="group"
      aria-label={name}
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        columnGap: 1.5,
        rowGap: 0.75,
        flexShrink: 0,
        maxWidth: "100%",
      }}
    >
      <OptionGroup options={ratingLabels(scale)} value={value} readOnly={readOnly} onChange={onChange} tinted />
    </Box>
  );
}

function OptionGroup({
  label,
  options,
  value,
  readOnly,
  onChange,
  tinted = false,
}: {
  label?: string;
  options: { value: number | string; label: string }[];
  value: Answer | undefined;
  readOnly: boolean;
  onChange: (value: Answer) => void;
  /** Colour the picked option by where it sits, red to green: for a rating scale, low to high. */
  tinted?: boolean;
}) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value ?? null}
      disabled={readOnly}
      onChange={(_, next: Answer) => onChange(next)}
      aria-label={label}
      sx={[
        (theme) => ({
          flexShrink: 0,
          flexWrap: "wrap",
          maxWidth: "100%",
          "& .MuiToggleButton-root": OPTION_SX,
          // Too narrow for one row: separate buttons that wrap, rather than a joined row cut off at the edge.
          [theme.breakpoints.down("md")]: {
            gap: 0.75,
            "& .MuiToggleButtonGroup-grouped": {
              m: 0,
              borderRadius: 1,
              borderLeft: `1px solid ${theme.palette.divider}`,
            },
          },
        }),
      ]}
    >
      {options.map((o, i) => (
        <ToggleButton
          key={o.value}
          value={o.value}
          sx={tinted ? scaleTintSx(i, options.length) : undefined}
        >
          {o.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

function WrittenAnswer({
  question,
  labelled,
  value,
  readOnly,
  onChange,
}: {
  question: FormQuestion;
  /** Off when the question is its section's only one, and the section title names it. */
  labelled: boolean;
  value: Answer | undefined;
  readOnly: boolean;
  onChange: (value: Answer) => void;
}) {
  const text = typeof value === "string" ? value : "";
  if (readOnly) {
    return (
      <Box>
        {labelled && (
          <Typography variant="caption" color="text.secondary" component="div" sx={{ fontWeight: 600 }}>
            {question.text}
          </Typography>
        )}
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", color: text ? "text.primary" : "text.secondary" }}>
          {text || "—"}
        </Typography>
      </Box>
    );
  }
  return (
    <TextField
      label={labelled ? question.text : undefined}
      required={labelled && question.required}
      multiline
      minRows={labelled ? 2 : 4}
      size="small"
      fullWidth
      value={text}
      placeholder={question.placeholder}
      onChange={(e) => onChange(e.target.value)}
      sx={{ "& .MuiFormLabel-asterisk": { color: "error.main" } }}
      slotProps={{
        inputLabel: { shrink: true },
        htmlInput: { maxLength: question.maxLength, "aria-label": labelled ? undefined : question.text },
      }}
    />
  );
}
