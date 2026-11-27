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

import { useState } from "react";
import {
  Alert,
  Autocomplete,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { isPreviewEnabled } from "@config/previewFeatures";
import ParDateField from "./ParDateField";
import { dayAfter } from "../util/parDate";
import ParRatingSettingsFields from "./ParRatingSettingsFields";
import ParDepartmentSettingsFields from "./ParDepartmentSettingsFields";
import ConfirmationDialog, { type ConfirmationContent } from "@components/confirmation-dialog/ConfirmationDialog";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useParGlobalConfig } from "../api/useParAdmin";
import { useCreateParCycle } from "../api/useParMutations";
import type { DepartmentDeadline, ParCycleCreate } from "../api/types";
import { departmentDeadlinesProblem } from "../util/parDepartments";
import {
  allRatings,
  ratingSettingsFrom,
  ratingSettingsProblem,
  type RatingSettings,
} from "../util/parRatingSettings";

function todayDateOnly(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ParCreationForm.tsx's own DatePickers all floor at tomorrow
// (`minDate={dayjs().add(1, "day")}`) for every deadline field — one day
// stricter than the yup schema's own `>= today` rule, which only bounds
// parEvaluationStartDate itself.
function tomorrowDateOnly(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const EMPTY_FORM = {
  parCycleName: "",
  parCycleStartDate: "",
  parCycleEndDate: "",
  parEvaluationEndDate: "",
  parEmployeeDeadline: "",
  parThreeSixtyRatingDeadline: "",
  parLeadDeadline: "",
  parLeadHardDeadline: "",
  parSpecialRatingDeadline: "",
  parF2FDeadline: "",
};

// The date chain is validated via `min`/`max` props on ParDateField, plus one
// submit-time check for the lead-after-employee rule (that one depends on
// another field's value, so min/max alone can't express it).
//
// parEvaluationStartDate is always today, but still goes out on the wire since
// ParCycleCreate requires it.
//
// Where `par2` is on, every cycle is a PAR 2.0 cycle: People Ops set its
// ratings and their rules, the departments that need no evidence, and any
// department's own self-review deadline; the two questions and the 360° rating
// list (cycles without the PAR 2.0 forms) aren't asked.
export default function ParCycleCreationDialog({
  open,
  onClose,
}: {
  open: boolean;
  /** `created` is true only when the cycle was actually saved — lets the
   * caller start polling for the async quota-group seed without also
   * triggering it on a plain Cancel. */
  onClose: (created: boolean) => void;
}) {
  const globalConfig = useParGlobalConfig(open);
  const createCycle = useCreateParCycle();
  const [form, setForm] = useState(EMPTY_FORM);
  const [ratings, setRatings] = useState<string[]>([]);
  const [reviewRatings, setReviewRatings] = useState<string[]>([]);
  const [employeeQuestion, setEmployeeQuestion] = useState("");
  const [reviewQuestion, setReviewQuestion] = useState("");
  const [ratingSettings, setRatingSettings] = useState<RatingSettings>(ratingSettingsFrom(undefined));
  const [noEvidence, setNoEvidence] = useState<string[]>([]);
  const [departmentDeadlines, setDepartmentDeadlines] = useState<DepartmentDeadline[]>([]);
  const [ratingsSeeded, setRatingsSeeded] = useState(false);
  const par2 = isPreviewEnabled("par2");
  const [confirmContent, setConfirmContent] = useState<ConfirmationContent | null>(null);

  // globalConfig only resolves once the dialog is open and the request
  // lands — seed the editable fields from it exactly once per open rather
  // than on every render (which would stomp anything the admin already typed).
  if (globalConfig.isSuccess && !ratingsSeeded) {
    setRatingsSeeded(true);
    setRatings(globalConfig.data.parRatings);
    setReviewRatings(globalConfig.data.threeSixtyReviewRatings);
    setEmployeeQuestion(globalConfig.data.employeeParQuestion);
    setReviewQuestion(globalConfig.data.threeSixtyReviewQuestion);
    setRatingSettings(ratingSettingsFrom(globalConfig.data));
    setNoEvidence(globalConfig.data.evidenceExemptDepartments ?? []);
  }

  const today = todayDateOnly();
  const tomorrow = tomorrowDateOnly();
  const evalStart = today;

  const resetAndClose = (created: boolean) => {
    setForm(EMPTY_FORM);
    setRatings([]);
    setReviewRatings([]);
    setEmployeeQuestion("");
    setReviewQuestion("");
    setRatingSettings(ratingSettingsFrom(undefined));
    setNoEvidence([]);
    setDepartmentDeadlines([]);
    setRatingsSeeded(false);
    onClose(created);
  };

  const set = (field: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [field]: value }));

  const deadlinesProblem = departmentDeadlinesProblem(departmentDeadlines, {
    evaluationStart: evalStart,
    evaluationEnd: form.parEvaluationEndDate,
    leadDeadline: form.parLeadDeadline,
  });

  const isValid =
    form.parCycleName.trim() &&
    form.parCycleStartDate &&
    form.parCycleEndDate &&
    form.parCycleEndDate > form.parCycleStartDate &&
    form.parEvaluationEndDate &&
    form.parEmployeeDeadline &&
    form.parThreeSixtyRatingDeadline &&
    form.parLeadDeadline &&
    form.parLeadDeadline > form.parEmployeeDeadline &&
    form.parSpecialRatingDeadline &&
    form.parF2FDeadline &&
    (par2
      ? ratingsSeeded &&
        ratingSettingsProblem(ratingSettings) === null &&
        deadlinesProblem === null &&
        form.parLeadHardDeadline > form.parLeadDeadline &&
        form.parLeadHardDeadline <= form.parEvaluationEndDate
      : employeeQuestion.trim() && reviewQuestion.trim() && ratings.length > 0 && reviewRatings.length > 0);

  const buildPayload = (): ParCycleCreate => ({
    parCycleName: form.parCycleName.trim(),
    parCycleStartDate: form.parCycleStartDate,
    parCycleEndDate: form.parCycleEndDate,
    parEvaluationStartDate: evalStart,
    parEvaluationEndDate: form.parEvaluationEndDate,
    parEmployeeDeadline: form.parEmployeeDeadline,
    parThreeSixtyRatingDeadline: form.parThreeSixtyRatingDeadline,
    parLeadDeadline: form.parLeadDeadline,
    ...(par2 ? { parLeadHardDeadline: form.parLeadHardDeadline } : {}),
    parSpecialRatingDeadline: form.parSpecialRatingDeadline,
    parF2FDeadline: form.parF2FDeadline,
    parCycleConfigurations: par2
      ? { ...ratingSettings, evidenceExemptDepartments: noEvidence, departmentEmployeeDeadlines: departmentDeadlines }
      : {
          employeeParQuestion: employeeQuestion.trim(),
          threeSixtyReviewQuestion: reviewQuestion.trim(),
          parRatings: ratings,
          threeSixtyReviewRatings: reviewRatings,
        },
    ...(par2 ? { par2Forms: true } : {}),
  });

  const handleSubmit = () => {
    setConfirmContent({
      title: "Start PAR Cycle",
      text: `Create "${form.parCycleName.trim()}"? Once created, teams must be grouped into special-rating quotas before the cycle can open.`,
      confirmAction: () => {
        createCycle.mutate(buildPayload(), { onSuccess: () => resetAndClose(true) });
      },
    });
  };

  const ratingsField = (label: string, value: string[], setValue: (v: string[]) => void, ariaLabel: string) => (
    <Autocomplete
      multiple
      freeSolo
      options={[]}
      value={value}
      onChange={(_e, newValue) => setValue(newValue as string[])}
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => {
          const { key, ...tagProps } = getTagProps({ index });
          return (
            <Chip key={key} variant="outlined" label={option} {...tagProps} />
          );
        })
      }
      renderInput={(params) => <TextField {...params} label={label} size="small" aria-label={ariaLabel} />}
    />
  );

  return (
    <>
      <Dialog open={open} onClose={() => resetAndClose(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create PAR Cycle</DialogTitle>
        <Divider />
        <DialogContent sx={{ maxHeight: "70vh" }}>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={12}>
              <TextField
                label="Name"
                size="small"
                fullWidth
                aria-label="PAR cycle name"
                value={form.parCycleName}
                onChange={(e) => set("parCycleName")(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <ParDateField
                label="Cycle starts"
                fullWidth
                ariaLabel="PAR cycle start date"
                value={form.parCycleStartDate}
                onChange={set("parCycleStartDate")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <ParDateField
                label="Cycle ends"
                fullWidth
                ariaLabel="PAR cycle end date"
                value={form.parCycleEndDate}
                min={form.parCycleStartDate || undefined}
                disabled={!form.parCycleStartDate}
                error={Boolean(form.parCycleEndDate) && form.parCycleEndDate <= form.parCycleStartDate}
                helperText={
                  form.parCycleEndDate && form.parCycleEndDate <= form.parCycleStartDate
                    ? "Must be later than the cycle start date"
                    : undefined
                }
                onChange={set("parCycleEndDate")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <ParDateField
                label="PAR evaluation closing date"
                fullWidth
                ariaLabel="PAR evaluation closing date"
                value={form.parEvaluationEndDate}
                min={tomorrow}
                onChange={set("parEvaluationEndDate")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <ParDateField
                label="Deadline for employee PAR"
                fullWidth
                ariaLabel="Deadline for employee PAR"
                value={form.parEmployeeDeadline}
                min={tomorrow}
                max={form.parEvaluationEndDate || undefined}
                disabled={!form.parEvaluationEndDate}
                onChange={set("parEmployeeDeadline")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <ParDateField
                label="Deadline for 360° feedback"
                fullWidth
                ariaLabel="Deadline for 360° feedback"
                value={form.parThreeSixtyRatingDeadline}
                min={tomorrow}
                max={form.parEvaluationEndDate || undefined}
                disabled={!form.parEvaluationEndDate}
                onChange={set("parThreeSixtyRatingDeadline")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <ParDateField
                label="Deadline for lead's feedback"
                fullWidth
                ariaLabel="Deadline for lead's feedback"
                value={form.parLeadDeadline}
                min={form.parEmployeeDeadline || tomorrow}
                max={form.parEvaluationEndDate || undefined}
                disabled={!form.parEvaluationEndDate}
                error={Boolean(form.parLeadDeadline) && Boolean(form.parEmployeeDeadline) && form.parLeadDeadline <= form.parEmployeeDeadline}
                helperText={
                  form.parLeadDeadline && form.parEmployeeDeadline && form.parLeadDeadline <= form.parEmployeeDeadline
                    ? "Must be later than the employee PAR deadline"
                    : undefined
                }
                onChange={set("parLeadDeadline")}
              />
            </Grid>
            {par2 && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <ParDateField
                  label="Hard lead deadline"
                  fullWidth
                  ariaLabel="Hard lead deadline"
                  value={form.parLeadHardDeadline}
                  min={form.parLeadDeadline ? dayAfter(form.parLeadDeadline) : tomorrow}
                  max={form.parEvaluationEndDate || undefined}
                  disabled={!form.parLeadDeadline}
                  error={Boolean(form.parLeadHardDeadline) && form.parLeadHardDeadline <= form.parLeadDeadline}
                  helperText={
                    form.parLeadHardDeadline && form.parLeadHardDeadline <= form.parLeadDeadline
                      ? "Must be later than the lead's feedback deadline"
                      : undefined
                  }
                  onChange={set("parLeadHardDeadline")}
                />
              </Grid>
            )}
            <Grid size={{ xs: 12, sm: 6 }}>
              <ParDateField
                label="Top 5%/20% rating submission"
                fullWidth
                ariaLabel="Top 5%/20% rating submission"
                value={form.parSpecialRatingDeadline}
                min={tomorrow}
                max={form.parEvaluationEndDate || undefined}
                disabled={!form.parEvaluationEndDate}
                onChange={set("parSpecialRatingDeadline")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <ParDateField
                label="PAR F2F deadline"
                fullWidth
                ariaLabel="PAR F2F deadline"
                value={form.parF2FDeadline}
                min={tomorrow}
                max={form.parEvaluationEndDate || undefined}
                disabled={!form.parEvaluationEndDate}
                onChange={set("parF2FDeadline")}
              />
            </Grid>

            {par2 ? (
              <>
                {isPreviewEnabled("leadership360") && (
                  <Grid size={12}>
                    <Typography variant="body2" color="text.secondary">
                      Leadership 360° runs with this cycle, from when you open it until its 360° deadline.
                    </Typography>
                  </Grid>
                )}
                {ratingsSeeded ? (
                  <>
                    <Grid size={12} sx={{ mt: 1 }}>
                      <ParRatingSettingsFields
                        value={ratingSettings}
                        onChange={setRatingSettings}
                        suggestions={globalConfig.data ? allRatings(ratingSettingsFrom(globalConfig.data)) : []}
                      />
                    </Grid>
                    <Grid size={12} sx={{ mt: 1 }}>
                      <ParDepartmentSettingsFields
                        evidenceRating={ratingSettings.evidenceEnabledRating}
                        noEvidence={noEvidence}
                        onNoEvidenceChange={setNoEvidence}
                        deadlines={departmentDeadlines}
                        onDeadlinesChange={setDepartmentDeadlines}
                        dates={{ min: tomorrow, max: form.parEvaluationEndDate || undefined }}
                      />
                    </Grid>
                    {deadlinesProblem && (
                      <Grid size={12}>
                        <Typography variant="caption" color="error">
                          {deadlinesProblem}
                        </Typography>
                      </Grid>
                    )}
                  </>
                ) : (
                  globalConfig.isError && (
                    <Grid size={12}>
                      <ErrorNotice
                        error={globalConfig.error}
                        onRetry={() => globalConfig.refetch()}
                        retrying={globalConfig.isFetching}
                      >
                        Couldn't load the global PAR configurations.
                      </ErrorNotice>
                    </Grid>
                  )
                )}
              </>
            ) : (
              <>
                <Grid size={12}>
                  <Typography variant="subtitle2" sx={{ mt: 1 }}>
                    Cycle configuration
                  </Typography>
                </Grid>
                <Grid size={12}>
                  <TextField
                    label="Employee PAR question"
                    size="small"
                    fullWidth
                    multiline
                    minRows={3}
                    aria-label="Employee PAR question"
                    value={employeeQuestion}
                    onChange={(e) => setEmployeeQuestion(e.target.value)}
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    label="360° feedback question"
                    size="small"
                    fullWidth
                    multiline
                    minRows={3}
                    aria-label="360 feedback question"
                    value={reviewQuestion}
                    onChange={(e) => setReviewQuestion(e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  {ratingsField("PAR ratings", ratings, setRatings, "PAR ratings")}
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  {ratingsField("360° feedback ratings", reviewRatings, setReviewRatings, "360 feedback ratings")}
                </Grid>
              </>
            )}

            {createCycle.isError && (
              <Grid size={12}>
                <Alert severity="error">{describeError(createCycle.error)}</Alert>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => resetAndClose(false)}>Cancel</Button>
          <Button variant="contained" disabled={!isValid || createCycle.isPending} onClick={handleSubmit}>
            {createCycle.isPending ? "Starting…" : "Start Cycle"}
          </Button>
        </DialogActions>
      </Dialog>
      <ConfirmationDialog content={confirmContent} onClose={() => setConfirmContent(null)} />
    </>
  );
}
