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
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Grid, TextField, Typography } from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { isPreviewEnabled } from "@config/previewFeatures";
import { useNotifications } from "@context/notifications/NotificationsContext";
import ParDateField from "./ParDateField";
import ParDepartmentSettingsFields from "./ParDepartmentSettingsFields";
import ConfirmationDialog, { type ConfirmationContent } from "@components/confirmation-dialog/ConfirmationDialog";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useUpdateParCycle } from "../api/useParMutations";
import { useParShowsPar2 } from "../api/useReview360";
import type { DepartmentDeadline, ParCycle } from "../api/types";
import { dayAfter } from "../util/parDate";
import { departmentDeadlinesProblem } from "../util/parDepartments";
import { dateOrderProblems } from "../util/parDateOrder";

function fieldsFromCycle(cycle: ParCycle) {
  return {
    parCycleStartDate: cycle.parCycleStartDate,
    parCycleEndDate: cycle.parCycleEndDate,
    parEvaluationEndDate: cycle.parEvaluationEndDate,
    parEmployeeDeadline: cycle.parEmployeeDeadline,
    parThreeSixtyRatingDeadline: cycle.parThreeSixtyRatingDeadline,
    parLeadDeadline: cycle.parLeadDeadline,
    parLeadHardDeadline: cycle.parLeadHardDeadline ?? "",
    parSpecialRatingDeadline: cycle.parSpecialRatingDeadline ?? "",
    parF2FDeadline: cycle.parF2FDeadline,
  };
}

// Same fields as ParCycleCreationDialog.tsx minus the name, the (always
// disabled) PAR creation date and the ratings, prefilled from the current
// cycle instead of useParGlobalConfig. Unlike the ratings, the departments can
// change while the cycle runs (where `par2` is on).
export default function ParCycleSettingsDialog({
  open,
  onClose,
  cycle,
}: {
  open: boolean;
  onClose: () => void;
  cycle: ParCycle;
}) {
  const updateCycle = useUpdateParCycle(cycle.parCycleId);
  // A PAR 2.0 cycle's forms take the place of the two questions, which aren't
  // shown, checked or sent until it's known the cycle has none.
  const par2 = useParShowsPar2(cycle.parCycleId);
  const showsQuestions = !par2.showsPar2 && !par2.isLoading && par2.error === null;
  // Only a PAR 2.0 cycle holds leads to it. Elsewhere it isn't shown or sent, and moves with the lead deadline.
  const showsHardDeadline = par2.showsPar2 && cycle.parLeadHardDeadline !== undefined;
  const { showSuccess, showError } = useNotifications();

  const [form, setForm] = useState(fieldsFromCycle(cycle));
  const [employeeQuestion, setEmployeeQuestion] = useState(cycle.parCycleConfigurations?.employeeParQuestion ?? "");
  const [reviewQuestion, setReviewQuestion] = useState(cycle.parCycleConfigurations?.threeSixtyReviewQuestion ?? "");
  const showsDepartments = isPreviewEnabled("par2");
  const savedNoEvidence = cycle.parCycleConfigurations?.evidenceExemptDepartments ?? [];
  const savedDeadlines = cycle.parCycleConfigurations?.departmentEmployeeDeadlines ?? [];
  const [noEvidence, setNoEvidence] = useState<string[]>(savedNoEvidence);
  const [departmentDeadlines, setDepartmentDeadlines] = useState<DepartmentDeadline[]>(savedDeadlines);
  const [confirmContent, setConfirmContent] = useState<ConfirmationContent | null>(null);

  const set = (field: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [field]: value }));

  const evalStart = cycle.parEvaluationStartDate;

  const deadlinesProblem = showsDepartments
    ? departmentDeadlinesProblem(departmentDeadlines, {
        evaluationStart: evalStart,
        evaluationEnd: form.parEvaluationEndDate,
        leadDeadline: form.parLeadDeadline,
      })
    : null;

  // A PAR 2.0 cycle's dates follow one order, checked once a date changes, as the backend does: a cycle saved
  // before the order can still change its other settings, and the first date edit puts them all in order.
  const datesChanged = JSON.stringify(form) !== JSON.stringify(fieldsFromCycle(cycle));
  const order =
    par2.showsPar2 && datesChanged
      ? dateOrderProblems({ ...form, parLeadHardDeadline: showsHardDeadline ? form.parLeadHardDeadline : "" })
      : {};

  const isValid =
    form.parCycleStartDate &&
    form.parCycleEndDate &&
    form.parCycleEndDate > form.parCycleStartDate &&
    form.parEvaluationEndDate &&
    form.parEvaluationEndDate > evalStart &&
    form.parEmployeeDeadline &&
    form.parEmployeeDeadline > evalStart &&
    form.parThreeSixtyRatingDeadline &&
    form.parThreeSixtyRatingDeadline > evalStart &&
    form.parLeadDeadline &&
    form.parLeadDeadline > form.parEmployeeDeadline &&
    // A PAR 2.0 cycle's Top 5%/20% deadline is its lead deadline, so it isn't shown.
    (par2.showsPar2 || (form.parSpecialRatingDeadline && form.parSpecialRatingDeadline > evalStart)) &&
    form.parF2FDeadline &&
    form.parF2FDeadline > evalStart &&
    (!showsHardDeadline ||
      (form.parLeadHardDeadline > form.parLeadDeadline && form.parLeadHardDeadline <= form.parEvaluationEndDate)) &&
    (!showsQuestions || (employeeQuestion.trim() && reviewQuestion.trim())) &&
    Object.keys(order).length === 0 &&
    deadlinesProblem === null;

  const hasChanged =
    JSON.stringify(form) !== JSON.stringify(fieldsFromCycle(cycle)) ||
    employeeQuestion !== (cycle.parCycleConfigurations?.employeeParQuestion ?? "") ||
    reviewQuestion !== (cycle.parCycleConfigurations?.threeSixtyReviewQuestion ?? "") ||
    JSON.stringify(noEvidence) !== JSON.stringify(savedNoEvidence) ||
    JSON.stringify(departmentDeadlines) !== JSON.stringify(savedDeadlines);

  const handleClose = () => {
    setForm(fieldsFromCycle(cycle));
    setEmployeeQuestion(cycle.parCycleConfigurations?.employeeParQuestion ?? "");
    setReviewQuestion(cycle.parCycleConfigurations?.threeSixtyReviewQuestion ?? "");
    setNoEvidence(savedNoEvidence);
    setDepartmentDeadlines(savedDeadlines);
    onClose();
  };

  const handleSubmit = () => {
    setConfirmContent({
      title: "Update PAR Cycle Settings",
      text: "Are you sure you want to update the PAR cycle settings? This may affect active dashboards and notifications.",
      confirmAction: () => {
        const { parLeadHardDeadline, ...dates } = form;
        updateCycle.mutate(
          {
            ...dates,
            ...(showsHardDeadline ? { parLeadHardDeadline } : {}),
            // Sent as the lead deadline for a PAR 2.0 cycle, which the backend keeps it in step with anyway.
            ...(par2.showsPar2 ? { parSpecialRatingDeadline: form.parLeadDeadline } : {}),
            // Partial update — rating scales aren't edited by this dialog, so
            // only the two question fields and the departments go out.
            ...(showsQuestions || showsDepartments
              ? {
                  parCycleConfigurations: {
                    ...(showsQuestions
                      ? {
                          employeeParQuestion: employeeQuestion.trim(),
                          threeSixtyReviewQuestion: reviewQuestion.trim(),
                        }
                      : {}),
                    ...(showsDepartments
                      ? { evidenceExemptDepartments: noEvidence, departmentEmployeeDeadlines: departmentDeadlines }
                      : {}),
                  },
                }
              : {}),
          },
          {
            onSuccess: () => {
              showSuccess("Cycle settings updated");
              handleClose();
            },
            onError: (err) => showError(describeError(err)),
          },
        );
      },
    });
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>PAR Cycle Settings</DialogTitle>
        <Divider />
        <DialogContent sx={{ maxHeight: "70vh" }}>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
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
                error={
                  (Boolean(form.parCycleEndDate) && form.parCycleEndDate <= form.parCycleStartDate) ||
                  Boolean(order.parCycleEndDate)
                }
                helperText={
                  form.parCycleEndDate && form.parCycleEndDate <= form.parCycleStartDate
                    ? "Must be later than the cycle start date"
                    : order.parCycleEndDate
                }
                onChange={set("parCycleEndDate")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <ParDateField
                label="PAR creation date"
                fullWidth
                ariaLabel="PAR creation date"
                value={cycle.parEvaluationStartDate}
                disabled
                onChange={() => {}}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <ParDateField
                label="PAR evaluation closing date"
                fullWidth
                ariaLabel="PAR evaluation closing date"
                value={form.parEvaluationEndDate}
                min={evalStart}
                error={(Boolean(form.parEvaluationEndDate) && form.parEvaluationEndDate <= evalStart) || Boolean(order.parEvaluationEndDate)}
                helperText={
                  form.parEvaluationEndDate && form.parEvaluationEndDate <= evalStart
                    ? "Must be later than the PAR creation date"
                    : order.parEvaluationEndDate
                }
                onChange={set("parEvaluationEndDate")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <ParDateField
                label="Deadline for employee PAR"
                fullWidth
                ariaLabel="Deadline for employee PAR"
                value={form.parEmployeeDeadline}
                min={evalStart}
                max={form.parEvaluationEndDate || undefined}
                error={Boolean(form.parEmployeeDeadline) && form.parEmployeeDeadline <= evalStart}
                helperText={
                  form.parEmployeeDeadline && form.parEmployeeDeadline <= evalStart
                    ? "Must be later than the PAR creation date"
                    : undefined
                }
                onChange={set("parEmployeeDeadline")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <ParDateField
                label="Deadline for 360° feedback"
                fullWidth
                ariaLabel="Deadline for 360° feedback"
                value={form.parThreeSixtyRatingDeadline}
                min={evalStart}
                max={form.parEvaluationEndDate || undefined}
                error={(Boolean(form.parThreeSixtyRatingDeadline) && form.parThreeSixtyRatingDeadline <= evalStart) || Boolean(order.parThreeSixtyRatingDeadline)}
                helperText={
                  form.parThreeSixtyRatingDeadline && form.parThreeSixtyRatingDeadline <= evalStart
                    ? "Must be later than the PAR creation date"
                    : order.parThreeSixtyRatingDeadline
                }
                onChange={set("parThreeSixtyRatingDeadline")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <ParDateField
                label="Deadline for lead's feedback"
                fullWidth
                ariaLabel="Deadline for lead's feedback"
                value={form.parLeadDeadline}
                min={form.parEmployeeDeadline || cycle.parEvaluationStartDate}
                max={form.parEvaluationEndDate || undefined}
                error={
                  (Boolean(form.parLeadDeadline) && form.parLeadDeadline <= form.parEmployeeDeadline) ||
                  Boolean(order.parLeadDeadline)
                }
                helperText={
                  form.parLeadDeadline && form.parLeadDeadline <= form.parEmployeeDeadline
                    ? "Must be later than the employee PAR deadline"
                    : order.parLeadDeadline
                }
                onChange={set("parLeadDeadline")}
              />
            </Grid>
            {showsHardDeadline && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <ParDateField
                  label="Hard lead deadline"
                  fullWidth
                  ariaLabel="Hard lead deadline"
                  value={form.parLeadHardDeadline}
                  min={form.parLeadDeadline ? dayAfter(form.parLeadDeadline) : evalStart}
                  max={form.parEvaluationEndDate || undefined}
                  error={
                    (Boolean(form.parLeadHardDeadline) && form.parLeadHardDeadline <= form.parLeadDeadline) ||
                    Boolean(order.parLeadHardDeadline)
                  }
                  helperText={
                    form.parLeadHardDeadline && form.parLeadHardDeadline <= form.parLeadDeadline
                      ? "Must be later than the lead's feedback deadline"
                      : order.parLeadHardDeadline
                  }
                  onChange={set("parLeadHardDeadline")}
                />
              </Grid>
            )}
            {!par2.showsPar2 && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <ParDateField
                  label="Top 5%/20% rating submission"
                  fullWidth
                  ariaLabel="Top 5%/20% rating submission"
                  value={form.parSpecialRatingDeadline}
                  min={evalStart}
                  max={form.parEvaluationEndDate || undefined}
                  error={Boolean(form.parSpecialRatingDeadline) && form.parSpecialRatingDeadline <= evalStart}
                  helperText={
                    form.parSpecialRatingDeadline && form.parSpecialRatingDeadline <= evalStart
                      ? "Must be later than the PAR creation date"
                      : undefined
                  }
                  onChange={set("parSpecialRatingDeadline")}
                />
              </Grid>
            )}
            <Grid size={{ xs: 12, sm: 6 }}>
              <ParDateField
                label="PAR F2F deadline"
                fullWidth
                ariaLabel="PAR F2F deadline"
                value={form.parF2FDeadline}
                min={evalStart}
                max={form.parEvaluationEndDate || undefined}
                error={(Boolean(form.parF2FDeadline) && form.parF2FDeadline <= evalStart) || Boolean(order.parF2FDeadline)}
                helperText={
                  form.parF2FDeadline && form.parF2FDeadline <= evalStart
                    ? "Must be later than the PAR creation date"
                    : order.parF2FDeadline
                }
                onChange={set("parF2FDeadline")}
              />
            </Grid>

            {showsDepartments && (
              <>
                <Grid size={12} sx={{ mt: 1 }}>
                  <ParDepartmentSettingsFields
                    evidenceRating={cycle.parCycleConfigurations?.evidenceEnabledRating ?? ""}
                    noEvidence={noEvidence}
                    onNoEvidenceChange={setNoEvidence}
                    deadlines={departmentDeadlines}
                    onDeadlinesChange={setDepartmentDeadlines}
                    dates={{ min: evalStart, max: form.parEvaluationEndDate || undefined }}
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
            )}

            {par2.error && (
              <Grid size={12}>
                <ErrorNotice error={par2.error} onRetry={par2.retry} retrying={par2.retrying}>
                  Couldn't check whether this cycle uses the PAR 2.0 forms.
                </ErrorNotice>
              </Grid>
            )}
            {showsQuestions && (
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
              </>
            )}

            {updateCycle.isError && (
              <Grid size={12}>
                <Alert severity="error">{describeError(updateCycle.error)}</Alert>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!isValid || !hasChanged || par2.isLoading || updateCycle.isPending}
            onClick={handleSubmit}
          >
            {updateCycle.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
      <ConfirmationDialog content={confirmContent} onClose={() => setConfirmContent(null)} />
    </>
  );
}
