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
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { UserRoundIcon, VenetianMaskIcon } from "@wso2/oxygen-ui-icons-react";
import ConfirmationDialog, { type ConfirmationContent } from "@components/confirmation-dialog/ConfirmationDialog";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useSaveLeadership360Draft, useSubmitLeadership360Feedback } from "../api/useLeadership360";
import type {
  FormAnswers,
  FormDefinition,
  FormQuestion,
  FormScale,
  FormSection,
  Leadership360CurrentSurvey,
  Leadership360Draft,
  Leadership360Leader,
} from "../api/leadership360Types";
import { cleanAnswers, headerSections, missingRequired, stepSections } from "../util/leadership360Form";
import { readLocalDraft, removeLocalDraft, writeLocalDraft } from "../util/leadership360LocalDraft";
import { formatShortDate } from "../util/parDate";
import { scaleTintSx } from "../util/scaleTint";
import { PICKED_FILLED_SX } from "../util/toggleSx";

const AUTOSAVE_DELAY_MS = 5000;
const DEFAULT_TEXT_MAX_LENGTH = 5000;
const RATING_WIDTH = 44;

type Answer = FormAnswers[string];

// Feedback on one member of the leadership group: how you work with them, then
// every statement on one page, saved as a draft as you go (or, with `submitted`,
// named feedback you gave, read-only). Named by default;
// anonymous once per leader per cycle. A named draft is saved on the
// server; an anonymous one only in this browser.
export default function Leadership360FeedbackDialog({
  open,
  onClose,
  survey,
  leader,
  workEmail,
  draft,
  anonymousGiven = false,
  submitted,
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
  /** Anonymous feedback on this leader was already given in this cycle. */
  anonymousGiven?: boolean;
  /** Named feedback you submitted, shown read-only. */
  submitted?: { answers: FormAnswers; on: string };
  onSubmitted: (leader: Leadership360Leader) => void;
}) {
  const { definition } = survey.template;
  const headers = headerSections(definition);
  const sections = stepSections(definition);
  const surveyId = survey.survey.surveyId;
  // Held for the next cycle (no cycle is taking feedback): named only.
  const held = survey.survey.held === true;
  const namedOnly = held || anonymousGiven;

  const readOnly = submitted !== undefined;
  const [initial] = useState(() => {
    if (submitted) return { answers: submitted.answers, anonymous: false };
    if (draft) return { answers: draft.answers, anonymous: false };
    // An anonymous draft in this browser opens as anonymous; anything else starts named.
    const local = namedOnly ? null : readLocalDraft(workEmail, surveyId, leader.workEmail);
    return { answers: local ?? {}, anonymous: local !== null };
  });
  const [answers, setAnswers] = useState<FormAnswers>(initial.answers);
  const [anonymous, setAnonymous] = useState(initial.anonymous);
  const [dirty, setDirty] = useState(false);
  const [savedLocally, setSavedLocally] = useState(false);
  const [missingIds, setMissingIds] = useState<string[]>([]);
  const missingCount = missingIds.length;
  const [confirmation, setConfirmation] = useState<ConfirmationContent | null>(null);

  const saveDraft = useSaveLeadership360Draft(surveyId);
  const submit = useSubmitLeadership360Feedback(surveyId);
  const latest = useRef({ answers, anonymous });
  latest.current = { answers, anonymous };
  // Whether the server holds a named draft that an anonymous one must replace.
  const serverDraft = useRef(Boolean(draft));
  const name = leader.employeeName;

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

  const setAnswer = (questionId: string, value: Answer) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setDirty(true);
    setMissingIds([]);
  };

  const close = () => {
    if (dirty) save();
    onClose();
  };

  const trySubmit = () => {
    const missing = missingRequired(definition, answers);
    if (missing.length > 0) {
      setMissingIds(missing.map((q) => q.id));
      return;
    }
    setConfirmation({
      title: `Submit ${anonymous ? "anonymous" : "named"} feedback on ${name}?`,
      text: "You can't change it after you submit.",
      confirmLabel: "Submit",
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

  const namedTip = `${name} and their lead see your response with your name.`;
  const anonymousTip = held
    ? "Anonymous feedback can only be given while a PAR cycle is open."
    : anonymousGiven
      ? `You gave anonymous feedback on ${name} in this cycle. You can still give named feedback.`
      : "Your name is not stored with this response.";

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="md">
      <DialogTitle
        sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 2, pb: 1.5 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ fontWeight: 400, color: "text.secondary" }}>
            Feedback on{" "}
            <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>
              {name}
            </Box>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {[leader.jobRole, held ? "Counts toward the next PAR cycle" : survey.survey.surveyName]
              .filter(Boolean)
              .join(" · ")}
          </Typography>
        </Box>
        {submitted ? (
          <Chip size="small" color="success" label={`Submitted with your name · ${formatShortDate(submitted.on)}`} />
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
            <Typography component="span" variant="body2" color="text.secondary">
              Submit as
            </Typography>
            {/* The picked side is filled, so it reads as a switch, not as two labels. */}
            <ToggleButtonGroup
              exclusive
              size="small"
              value={anonymous ? "anonymous" : "named"}
              onChange={(_, next: "named" | "anonymous" | null) => {
                if (!next) return;
                setAnonymous(next === "anonymous");
                setDirty(true);
              }}
              aria-label="Named or anonymous"
              sx={{
                "& .MuiToggleButton-root": {
                  px: 1.5,
                  py: 0.625,
                  gap: 0.75,
                  fontSize: 14,
                  fontWeight: 500,
                  textTransform: "none",
                },
                ...PICKED_FILLED_SX,
              }}
            >
              <Tooltip title={namedTip} arrow describeChild>
                <ToggleButton value="named">
                  <UserRoundIcon size={16} aria-hidden />
                  Named
                </ToggleButton>
              </Tooltip>
              {/* A disabled button gets no pointer events: the span carries the tooltip. */}
              <Tooltip title={anonymousTip} arrow describeChild>
                <Box component="span" sx={{ display: "inline-flex" }}>
                  <ToggleButton value="anonymous" disabled={namedOnly}>
                    <VenetianMaskIcon size={16} aria-hidden />
                    Anonymous
                  </ToggleButton>
                </Box>
              </Tooltip>
            </ToggleButtonGroup>
          </Box>
        )}
      </DialogTitle>
      <DialogContent dividers sx={{ py: 2 }}>
        <Stack spacing={2}>
          {headers
            .flatMap((s) => s.questions)
            .map((q) => (
              <RelationshipField
                key={q.id}
                question={q}
                value={answers[q.id]}
                missing={missingIds.includes(q.id)}
                readOnly={readOnly}
                onChange={(value) => setAnswer(q.id, value)}
              />
            ))}
          {sections.map((section) => (
            <SectionFields
              key={section.id}
              section={section}
              definition={definition}
              answers={answers}
              missing={missingIds}
              readOnly={readOnly}
              onChange={setAnswer}
            />
          ))}
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
      {readOnly ? (
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button size="small" onClick={onClose}>
            Done
          </Button>
        </DialogActions>
      ) : (
        <DialogActions sx={{ px: 3, py: 1.5, gap: 1 }}>
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
          <Button size="small" variant="contained" onClick={trySubmit} disabled={submit.isPending}>
            Submit
          </Button>
        </DialogActions>
      )}
      <ConfirmationDialog content={confirmation} onClose={() => setConfirmation(null)} />
    </Dialog>
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
    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75, fontWeight: 400 }}>
      Optional
    </Typography>
  );
}

/** The relationship question above the statements, its options as radios in a row. */
function RelationshipField({
  question,
  value,
  missing,
  readOnly,
  onChange,
}: {
  question: FormQuestion;
  value: Answer | undefined;
  missing: boolean;
  readOnly: boolean;
  onChange: (value: Answer) => void;
}) {
  return (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 600, color: missing ? "error.main" : "text.primary" }}>
        {question.text}
        {question.required && <RequiredMark />}
      </Typography>
      <RadioGroup
        row
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        aria-label={question.text}
        sx={{ columnGap: 1 }}
      >
        {(question.options ?? []).map((o) => (
          <FormControlLabel
            key={o.value}
            value={o.value}
            control={<Radio size="small" sx={{ py: 0.5 }} />}
            label={o.label}
            disabled={readOnly}
            slotProps={{ typography: { variant: "body2" } }}
          />
        ))}
      </RadioGroup>
    </Box>
  );
}

function ratings(scale: FormScale): number[] {
  return Array.from({ length: scale.max - scale.min + 1 }, (_, i) => scale.min + i);
}

function SectionTitle({ section }: { section: FormSection }) {
  const optional = section.questions.every((q) => !q.required);
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="subtitle2" component="h3" sx={{ fontWeight: 700, lineHeight: 1.4 }}>
        {section.title}
        {optional && <OptionalMark />}
      </Typography>
      {section.hint && (
        <Typography variant="caption" color="text.secondary" component="div" sx={{ lineHeight: 1.35 }}>
          {section.hint}
        </Typography>
      )}
    </Box>
  );
}

// One section: written questions as text boxes, statements one per line with 1–5 on the right.
function SectionFields({
  section,
  definition,
  answers,
  missing,
  readOnly,
  onChange,
}: {
  section: FormSection;
  definition: FormDefinition;
  answers: FormAnswers;
  /** Required questions left unanswered on the last submit. */
  missing: string[];
  readOnly: boolean;
  onChange: (id: string, value: Answer) => void;
}) {
  if (section.questions.every((q) => q.type === "TEXT")) {
    return (
      <Box>
        <SectionTitle section={section} />
        <Stack spacing={1.5} sx={{ mt: 0.75 }}>
          {section.questions.map((q) => (
            <WrittenAnswer
              key={q.id}
              question={q}
              labelled={section.questions.length > 1}
              value={answers[q.id]}
              readOnly={readOnly}
              onChange={(v) => onChange(q.id, v)}
            />
          ))}
        </Stack>
      </Box>
    );
  }
  const scale = definition.scales[section.questions.find((q) => q.scale)?.scale ?? ""];
  const points = scale ? ratings(scale) : [];
  return (
    <Box>
      {/* The scale's ends sit over the buttons, once per section. */}
      <Box sx={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 2, pb: 0.5 }}>
        <SectionTitle section={section} />
        {scale && (
          <Box
            sx={{
              // As wide as the buttons, which share their borders.
              width: RATING_WIDTH * points.length - (points.length - 1),
              flexShrink: 0,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
            }}
          >
            <ScaleEnd label={scale.minLabel} />
            <ScaleEnd label={scale.maxLabel} />
          </Box>
        )}
      </Box>
      {section.questions.map((q) => (
        <Box
          key={q.id}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            py: 0.5,
            borderTop: 1,
            borderColor: "divider",
          }}
        >
          <Statement question={q} missing={missing.includes(q.id)} />
          {scale && (
            <ToggleButtonGroup
              exclusive
              size="small"
              value={typeof answers[q.id] === "number" ? answers[q.id] : null}
              onChange={(_, next: number | null) => onChange(q.id, next)}
              disabled={readOnly}
              aria-label={q.text}
              sx={{ flexShrink: 0 }}
            >
              {points.map((r, i) => (
                <ToggleButton
                  key={r}
                  value={r}
                  aria-label={`${r} of ${scale.max}`}
                  sx={[
                    { width: RATING_WIDTH, py: 0.625, fontSize: 14, fontWeight: 500 },
                    scaleTintSx(i, points.length),
                  ]}
                >
                  {r}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}
        </Box>
      ))}
    </Box>
  );
}

/** A scale end's label, centred over its end button, a word a line. */
function ScaleEnd({ label }: { label?: string }) {
  return (
    <Box sx={{ width: RATING_WIDTH, display: "flex", justifyContent: "center" }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ width: "min-content", textAlign: "center", lineHeight: 1.2 }}
      >
        {label}
      </Typography>
    </Box>
  );
}

function Statement({ question, missing }: { question: FormQuestion; missing: boolean }) {
  return (
    <Typography
      variant="body2"
      sx={{ minWidth: 0, fontSize: 13, lineHeight: 1.4, color: missing ? "error.main" : "text.primary" }}
    >
      {question.text}
      {question.required ? <RequiredMark /> : <OptionalMark />}
    </Typography>
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
      minRows={4}
      size="small"
      fullWidth
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={
        question.placeholder ?? "What would help them sustain or improve their effectiveness. A specific example helps."
      }
      sx={{ "& .MuiFormLabel-asterisk": { color: "error.main" } }}
      slotProps={{
        inputLabel: { shrink: true },
        htmlInput: {
          maxLength: question.maxLength ?? DEFAULT_TEXT_MAX_LENGTH,
          "aria-label": labelled ? undefined : question.text,
        },
      }}
    />
  );
}
