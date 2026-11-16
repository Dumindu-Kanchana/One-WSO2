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
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Chip,
  ComplexSelect,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  Link,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import {
  ChevronDownIcon,
  CircleAlertIcon,
  ExternalLinkIcon,
  FileDownIcon,
  Google,
  InfoIcon,
  PencilIcon,
} from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { describeError } from "@api/errors";
import { HttpError } from "@api/http";
import {
  evidenceEnabledRating as defaultEvidenceEnabledRating,
  top5p20pEnabledRating as defaultTop5p20pEnabledRating,
} from "@config/apiConfig";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useParRating } from "../api/useParData";
import { useLeadRatingUpdate } from "../api/useLeadRatingUpdate";
import { useParEmployeeReviews } from "../api/useLeadHistory";
import { useGoogleDrivePicker } from "../hooks/useGoogleDrivePicker";
import { decodeParComment, encodeParComment, isEmptyHtml, paragraphsToHtml } from "../util/parComment";
import { deadlineEndsEverywhereAt, isDeadlinePassed } from "../util/parDeadline";
import { formatShortDate, formatShortDateTime } from "../util/parDate";
import { downloadParPdf } from "../util/parPdf";
import { parseSavedUrls, type DriveFile } from "../util/parDriveFile";
import { LEADERSHIP_ALLOWED_RATINGS, isEvidenceMissing, ratingOptions } from "../util/parLeadership";
import ParRichTextField, { type ParRichTextFieldHandle } from "./ParRichTextField";
import { ParCommentView } from "./ParContent";
import { ParAutoAssignedChip } from "./ParChips";
import ParDriveFileChip from "./ParDriveFileChip";
import ParEmptyState from "./ParEmptyState";
import Leadership360ResultsCard from "./Leadership360ResultsCard";
import ParSelfReviewView from "./ParSelfReviewView";
import ParHistoryReviewSection from "./ParHistoryReviewSection";
import type { ParCycle } from "../api/types";
import { useSelfReview } from "../api/useSelfReview";
import { useParShowsPar2, useReviewResponses } from "../api/useReview360";
import { useLead360SummarySuggestion, useSaveLead360Summary } from "../api/useLead360Summary";
import { MIN_360_RESPONSES } from "../api/review360Types";
import ParLead360Evidence, { ParLead360Guidance } from "./ParLead360Evidence";
import ParLead360Suggestion from "./ParLead360Suggestion";

type SpecialRatingUi = "NONE" | "TOP5P" | "TOP20P";

// The backend's wire vocabulary is TOP5P/TOP20P/NOT_ASSIGNED (or the field
// absent) — "NONE" is only this component's own UI sentinel for "no special
// rating", so anything else read back from the server normalizes to it.
const toSpecialRatingUi = (value: string | undefined): SpecialRatingUi =>
  value === "TOP5P" || value === "TOP20P" ? value : "NONE";

const SPECIAL_RATING_LABELS: Record<SpecialRatingUi, string> = { NONE: "N/A", TOP5P: "Top 5%", TOP20P: "Top 20%" };

// Ports LeadReviewPanel.tsx's lead-only path, plus (via `isAdminView`) its
// isAdminAuditViewOn branch used from the Admin Portal's Employee View/Team
// View "Review" action. Not ported even in admin mode: editing the
// employee's own comment on their behalf — the "Update Status" tab is a
// sibling tab (ParUpdateStatusPanel), not part of this panel.
export default function ParLeadReviewPanel({
  cycle,
  employeeEmail,
  isAdminView = false,
}: {
  cycle: ParCycle;
  employeeEmail: string;
  isAdminView?: boolean;
}) {
  const rating = useParRating(cycle.parCycleId, employeeEmail);
  const ratingUpdate = useLeadRatingUpdate(cycle.parCycleId);
  const reviews = useParEmployeeReviews(cycle.parCycleId, employeeEmail);
  // A PAR 2.0 cycle's guided self-review (null for a cycle that keeps the
  // single comment). Its answers arrive empty until the employee shares.
  const selfReview = useSelfReview(cycle.parCycleId, employeeEmail);
  // A PAR 2.0 cycle puts the evidence (self-review, 360° summary) beside the
  // assessment, with the 360° guidance under the rating.
  const { showsPar2 } = useParShowsPar2(cycle.parCycleId);
  const [evidenceTab, setEvidenceTab] = useState(0);
  const { showSuccess, showError } = useNotifications();

  // Cycle-scoped value first (not on the wire yet — always undefined until
  // the backend ships it, see the field's own comment in api/types.ts),
  // falling back to the deploy-wide window.config value.
  const top5p20pEnabledRating = cycle.parCycleConfigurations?.top5p20pEnabledRating ?? defaultTop5p20pEnabledRating;
  const evidenceEnabledRating = cycle.parCycleConfigurations?.evidenceEnabledRating ?? defaultEvidenceEnabledRating;
  const leadershipAllowedRatings = cycle.parCycleConfigurations?.leadershipAllowedRatings ?? LEADERSHIP_ALLOWED_RATINGS;

  const [leadComment, setLeadComment] = useState("");
  // The lead's 360° summary (PAR 2.0, not the leadership team): shared with
  // the comment, saved on its own. While it's empty, an AI suggestion shows in
  // grey for the lead to insert.
  const [lead360Summary, setLead360Summary] = useState("");
  // The suggestion written from newer responses, shown under the lead's own
  // words when they ask for it.
  const [showingUpdatedSuggestion, setShowingUpdatedSuggestion] = useState(false);
  const summaryField = useRef<ParRichTextFieldHandle>(null);
  const [summaryAutoSaved, setSummaryAutoSaved] = useState(false);
  const [adminComment, setAdminComment] = useState("");
  const [parRatingValue, setParRatingValue] = useState("");
  const [specialRating, setSpecialRating] = useState<SpecialRatingUi>("NONE");
  const [specialRatingConfirmed, setSpecialRatingConfirmed] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [evidenceConfirmed, setEvidenceConfirmed] = useState(false);
  const [seededForId, setSeededForId] = useState<number | undefined>(undefined);
  const [autoSaved, setAutoSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // An admin lands on this panel read-only by default — even for a
  // still-in-progress DRAFT/PENDING record — and must explicitly unlock
  // editing via the pencil icon below.
  const [adminForceEdit, setAdminForceEdit] = useState(false);
  const [adminEditConfirmOpen, setAdminEditConfirmOpen] = useState(false);
  const autoSaveTokenRef = useRef(0);

  const parRatingData = rating.data;
  // The backend refuses a non-admin change to a rating the system
  // auto-assigned after a missed deadline; an admin can still correct it.
  const ratingLocked = !isAdminView && parRatingData?.parRatingUpdatedBy === "SYSTEM";

  // Seed once per record, so a background refetch doesn't overwrite mid-typing.
  if (parRatingData && parRatingData.parRatingId !== seededForId) {
    setSeededForId(parRatingData.parRatingId);
    setLeadComment(decodeParComment(parRatingData.parLeadComment));
    setLead360Summary(decodeParComment(parRatingData.parLead360Summary));
    setAdminComment(decodeParComment(parRatingData.parAdminComment));
    setParRatingValue(parRatingData.parRating && parRatingData.parRating !== "NOT_ASSIGNED" ? parRatingData.parRating : "");
    setSpecialRating(toSpecialRatingUi(parRatingData.parSpecialRating));
    setSpecialRatingConfirmed(
      parRatingData.parRating === top5p20pEnabledRating &&
        toSpecialRatingUi(parRatingData.parSpecialRating) !== "NONE",
    );
    setDriveFiles(parseSavedUrls(parRatingData.parPerformanceNoticeAck ?? ""));
    // The checkbox itself is never saved, only its effect (the attached
    // files), so it always starts unchecked.
    setEvidenceConfirmed(false);
  }

  useEffect(() => {
    if (parRatingValue !== top5p20pEnabledRating) {
      setSpecialRating("NONE");
      setSpecialRatingConfirmed(false);
    }
    if (parRatingValue !== evidenceEnabledRating) {
      setDriveFiles([]);
      setEvidenceConfirmed(false);
    }
  }, [parRatingValue, top5p20pEnabledRating, evidenceEnabledRating]);

  const { openPicker, isLoading: isPickerLoading, error: pickerError } = useGoogleDrivePicker();

  const handleFilesSelected = (newFiles: DriveFile[]) => {
    setDriveFiles((prev) => {
      const existingIds = new Set(prev.map((f) => f.id));
      return [...prev, ...newFiles.filter((f) => !existingIds.has(f.id))];
    });
  };

  const handleRemoveFile = (fileId: string) => {
    setDriveFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  // Every value below is derived with parRatingData possibly still
  // undefined (loading/error/not-found are handled further down, but hooks
  // must stay unconditional), so the submit/autosave logic guards on it
  // itself rather than relying on an early return to have already happened.
  // Admin edits are gated by the cycle's own closing date rather than the
  // lead's feedback deadline.
  const deadlineDate = isAdminView ? cycle.parCycleEndDate : cycle.parLeadDeadline;
  const deadlinePassed = isDeadlinePassed(deadlineDate);
  const shared = parRatingData?.parLeadStatus === "SHARED";
  const readOnly = isAdminView ? !adminForceEdit : shared || deadlinePassed;
  const savedLeadComment = decodeParComment(parRatingData?.parLeadComment);
  const savedAdminComment = decodeParComment(parRatingData?.parAdminComment);

  const summaryShown = showsPar2 && Boolean(parRatingData) && !parRatingData?.parIsLeadershipEmployee;
  const responses = useReviewResponses(cycle.parCycleId, employeeEmail, summaryShown && !readOnly);
  const saveSummary = useSaveLead360Summary(cycle.parCycleId, employeeEmail);
  const savedLead360Summary = decodeParComment(parRatingData?.parLead360Summary);
  const summaryToSave = isEmptyHtml(lead360Summary) ? "" : lead360Summary;
  const summaryDirty = summaryShown && !readOnly && summaryToSave.trim() !== savedLead360Summary.trim();
  // Saved before the rest of the lead's feedback, so sharing right after an
  // edit doesn't leave the summary behind (once shared it can't change).
  const saveSummaryIfChanged = () =>
    summaryDirty ? saveSummary.mutateAsync(summaryToSave ? encodeParComment(summaryToSave) : "") : Promise.resolve();

  // The suggestion: in grey while the summary is empty, or under the lead's
  // own words once they ask for the one written from newer responses. The
  // backend keeps it, so it's written again only when more responses come in.
  // Not for a shared PAR, whose summary can't change.
  const responseCount = responses.data?.responseCount ?? 0;
  const summaryEmpty = isEmptyHtml(lead360Summary);
  const suggestionPossible = summaryShown && !readOnly && !shared && responseCount >= MIN_360_RESPONSES;
  const suggestion = useLead360SummarySuggestion(
    cycle.parCycleId,
    employeeEmail,
    responseCount,
    suggestionPossible && (summaryEmpty || showingUpdatedSuggestion),
  );
  // Past the cap the backend keeps the last suggestion and writes no more;
  // 429 when none was ever kept.
  const suggestionCapped =
    parRatingData?.parLead360SuggestionsLeft === 0 ||
    (suggestion.error instanceof HttpError && suggestion.error.status === 429);
  const suggestionFailed = suggestion.isError && !suggestionCapped;
  const suggestedFrom = parRatingData?.parLead360SuggestionResponses;
  // Offered under the lead's own words: more responses have come in since the
  // last suggestion, or none was written yet. Once seen and dismissed, it's
  // offered again only when more come in.
  const updateOffered =
    suggestionPossible &&
    !summaryEmpty &&
    !showingUpdatedSuggestion &&
    !suggestionCapped &&
    (suggestedFrom === undefined || responseCount > suggestedFrom);
  const newResponses = responseCount - (suggestedFrom ?? 0);
  // Into the field as one step the field's Undo takes back, so it needs no
  // confirming, even when it replaces the lead's own words.
  const takeSuggestion = () => {
    if (!suggestion.data) return;
    summaryField.current?.replaceContents(paragraphsToHtml(suggestion.data.summary));
    setShowingUpdatedSuggestion(false);
  };
  const greySuggestionShown = summaryEmpty && Boolean(suggestion.data || suggestion.isLoading);

  const submit = (
    status: "DRAFT" | "SHARED",
    opts?: { silent?: boolean; onSuccess?: () => void; commentOnly?: boolean },
  ) => {
    if (!parRatingData) return;
    saveSummaryIfChanged().then(
      () => sendRatingUpdate(status, opts),
      (err) => {
        if (!opts?.silent) showError(describeError(err));
      },
    );
  };

  const sendRatingUpdate = (
    status: "DRAFT" | "SHARED",
    opts?: { silent?: boolean; onSuccess?: () => void; commentOnly?: boolean },
  ) => {
    if (!parRatingData) return;
    ratingUpdate.mutate(
      {
        employeeEmail,
        parRatingId: parRatingData.parRatingId,
        payload: {
          parLeadStatus: status,
          parLeadComment: encodeParComment(leadComment),
          // The autosave fires purely off comment typing and must not also
          // commit whatever the rating dropdowns currently hold — sending
          // parSpecialRating with it would clobber a saved Top 5%/20%
          // allocation the moment someone types a character.
          ...(opts?.commentOnly
            ? {}
            : {
                ...(parRatingValue && !ratingLocked ? { parRating: parRatingValue } : {}),
                // The backend's wire vocabulary is TOP5P/TOP20P/NOT_ASSIGNED;
                // "NONE" is only this component's UI sentinel and 400s if sent.
                parSpecialRating: specialRating === "NONE" ? "NOT_ASSIGNED" : specialRating,
                // Omitted entirely rather than sent as "" when there's no
                // evidence — the backend requires a non-empty string whenever
                // this field is present, so an empty string 400s.
                //
                // One consequence: there is no way to CLEAR a saved attachment
                // through this endpoint. The backend also ignores an empty
                // value as an update, so removing every file and saving leaves
                // the old URLs on the record and they reappear on the next
                // fetch. Fixing that needs a backend change (a real clear
                // operation), not a frontend one.
                ...(driveFiles.length > 0 ? { parPerformanceNoticeAck: driveFiles.map((f) => f.url).join("\n") } : {}),
              }),
          // Only an admin caller may set this field — the backend rejects a
          // non-empty value from anyone else.
          ...(isAdminView ? { parAdminComment: encodeParComment(adminComment) } : {}),
        },
      },
      {
        onSuccess: () => {
          if (!opts?.silent) showSuccess(status === "SHARED" ? "Successfully shared" : "Draft saved");
          opts?.onSuccess?.();
        },
        onError: (err) => {
          if (!opts?.silent) showError(describeError(err));
        },
      },
    );
  };

  useEffect(() => {
    // No autosave in admin mode.
    if (!parRatingData || readOnly || isAdminView) return;
    if (isEmptyHtml(leadComment) || leadComment.trim() === savedLeadComment.trim()) return;
    if (ratingUpdate.isPending) return;
    const timer = window.setTimeout(() => {
      const token = ++autoSaveTokenRef.current;
      submit("DRAFT", {
        silent: true,
        commentOnly: true,
        onSuccess: () => {
          if (token !== autoSaveTokenRef.current) return;
          setAutoSaved(true);
          window.setTimeout(() => setAutoSaved(false), 2000);
        },
      });
    }, 5000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadComment, readOnly, ratingUpdate.isPending, parRatingData]);

  // The 360° summary autosaves on its own, like the comment.
  useEffect(() => {
    if (!parRatingData || readOnly || isAdminView || !summaryDirty || saveSummary.isPending) return;
    const timer = window.setTimeout(() => {
      saveSummary.mutate(summaryToSave ? encodeParComment(summaryToSave) : "", {
        onSuccess: () => {
          setSummaryAutoSaved(true);
          window.setTimeout(() => setSummaryAutoSaved(false), 2000);
        },
      });
    }, 5000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead360Summary, readOnly, saveSummary.isPending, parRatingData]);

  if (rating.isLoading) {
    return <Skeleton variant="rectangular" height={360} sx={{ borderRadius: 1.5 }} />;
  }
  if (rating.isError) {
    return (
      <ErrorNotice error={rating.error} onRetry={() => rating.refetch()} retrying={rating.isFetching}>
        Couldn't load this employee's PAR record.
      </ErrorNotice>
    );
  }
  if (!parRatingData) {
    return <Alert severity="info">This employee's record for this cycle isn't ready yet.</Alert>;
  }

  const employeeComment = decodeParComment(parRatingData.parEmployeeComment);
  const isLeadership = parRatingData.parIsLeadershipEmployee;

  const dirty =
    summaryDirty ||
    leadComment.trim() !== savedLeadComment.trim() ||
    (isAdminView && adminComment.trim() !== savedAdminComment.trim()) ||
    (parRatingValue !== (parRatingData.parRating ?? "") && parRatingValue !== "") ||
    specialRating !== toSpecialRatingUi(parRatingData.parSpecialRating) ||
    driveFiles.map((f) => f.url).join("\n") !== (parRatingData.parPerformanceNoticeAck ?? "");

  const statusAlert = readOnly ? (
    <Alert severity={shared ? "success" : "info"}>
      {shared ? "Lead's feedback is shared with the employee" : "Lead's feedback is not shared with the employee"}
    </Alert>
  ) : parRatingData.parLeadStatus === "DRAFT" ? (
    <Alert severity="warning">
      You have saved your PAR as a draft.{" "}
      {isAdminView
        ? `Please share before the cycle ends: ${formatShortDate(deadlineDate)}.`
        : `Please share on or before the deadline: ${formatShortDate(deadlineDate)}.`}
    </Alert>
  ) : (
    <Alert severity="info">
      {isAdminView
        ? `Please share the lead's feedback before the cycle ends: ${formatShortDate(deadlineDate)}.`
        : `Please share the lead's feedback before the deadline: ${formatShortDate(deadlineDate)}.`}
    </Alert>
  );

  // Save Draft only enables once something has actually changed. Share also
  // waits for a rating to be picked and the comment to be non-empty, and, as
  // the backend requires, for the employee: until they share their own side,
  // or until the self-review deadline has ended everywhere and they no longer
  // can. An admin can share regardless of where the employee's side is.
  const selfReviewClosesAt = deadlineEndsEverywhereAt(cycle.parEmployeeDeadline);
  const employeeShared =
    parRatingData.parEmployeeStatus === "SHARED" || parRatingData.parEmployeeStatus === "SHARED_BLOCKED";
  const employeeReady = isAdminView || employeeShared || new Date() > selfReviewClosesAt;
  const canSaveDraft = !readOnly && !deadlinePassed && !ratingUpdate.isPending && !saveSummary.isPending && dirty;
  const canShare =
    !readOnly &&
    !deadlinePassed &&
    !ratingUpdate.isPending &&
    !saveSummary.isPending &&
    employeeReady &&
    Boolean(parRatingValue) &&
    !isEmptyHtml(leadComment) &&
    !isEvidenceMissing({
      rating: parRatingValue,
      evidenceEnabledRating,
      ratingLocked,
      evidenceConfirmed,
      fileCount: driveFiles.length,
    });

  const selfReviewContent = selfReview.data ? (
    Object.keys(selfReview.data.answers).length > 0 ? (
      <ParSelfReviewView definition={selfReview.data.template.definition} answers={selfReview.data.answers} framed={false} />
    ) : (
      <ParEmptyState text="The employee hasn't shared their self-review yet" />
    )
  ) : employeeComment ? (
    <ParCommentView html={employeeComment} />
  ) : (
    <ParEmptyState text="Employee's Feedback hasn't been shared" />
  );

  return (
    <Grid container spacing={2}>
      <Grid size={12} sx={showsPar2 ? { order: 0 } : undefined}>
        <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
          <Box flex={1}>
            {statusAlert}
            {deadlinePassed && !shared && (
              <Alert severity="error" sx={{ mt: 1.5 }}>
                {isAdminView ? "The cycle ended on" : "Lead's feedback deadline is passed on"}:{" "}
                {formatShortDate(deadlineDate)}.
              </Alert>
            )}
          </Box>
          {isAdminView && readOnly && (
            <Tooltip title="Edit PAR details">
              <IconButton aria-label="edit" onClick={() => setAdminEditConfirmOpen(true)}>
                <PencilIcon size={18} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={reviews.isSuccess ? "Download PAR details" : "360° reviews are still loading"}>
            <span>
              <IconButton
                aria-label="download"
                disabled={!reviews.isSuccess}
                onClick={() => downloadParPdf(parRatingData, employeeComment, savedLeadComment, reviews.data)}
              >
                <FileDownIcon size={18} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Grid>

      {!showsPar2 && (
        <Grid size={12}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardHeader
              title={<Typography variant="h6">{selfReview.data ? "Employee's Self-review" : "Employee's Feedback"}</Typography>}
            />
            <CardContent>{selfReviewContent}</CardContent>
          </Card>
        </Grid>
      )}

      <Grid size={showsPar2 ? { xs: 12, md: 7 } : 12} sx={showsPar2 ? { order: { xs: 2, md: 1 } } : undefined}>
        <Card variant="outlined" sx={{ height: "100%" }}>
          <CardHeader title={<Typography variant="h6">Lead's Feedback</Typography>} />
          <CardContent>
            <Stack spacing={2.5}>
              <Box sx={{ position: "relative" }}>
                {readOnly ? (
                  shared ? (
                    <ParCommentView html={savedLeadComment} />
                  ) : (
                    <ParEmptyState
                      text={
                        parRatingData.parLeadStatus === "DRAFT"
                          ? "Lead's feedback has not been shared"
                          : "Lead's feedback is pending"
                      }
                    />
                  )
                ) : (
                  <ParRichTextField value={leadComment} onChange={setLeadComment} placeholder="Enter your comment here" />
                )}
                {autoSaved && (
                  <Typography variant="caption" color="text.secondary" sx={{ position: "absolute", bottom: -20, left: 0 }}>
                    Draft Saved
                  </Typography>
                )}
              </Box>

              {summaryShown &&
                (readOnly ? (
                  shared &&
                  savedLead360Summary && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                        360° summary
                      </Typography>
                      <ParCommentView html={savedLead360Summary} />
                    </Box>
                  )
                ) : (
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      360° summary
                    </Typography>
                    <ParRichTextField
                      ref={summaryField}
                      value={lead360Summary}
                      onChange={setLead360Summary}
                      placeholder={greySuggestionShown ? "" : "Summarise the 360° feedback"}
                      minHeight="10rem"
                      suggestion={
                        greySuggestionShown && (
                          <ParLead360Suggestion suggestion={suggestion.data} onInsert={takeSuggestion} />
                        )
                      }
                      onAcceptSuggestion={summaryEmpty && suggestion.data ? takeSuggestion : undefined}
                    />
                    {updateOffered && (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5, flexWrap: "wrap" }}>
                        <Typography variant="caption" color="text.secondary">
                          {suggestedFrom === undefined
                            ? "There's a suggested summary from the 360° feedback."
                            : `${newResponses} new 360° ${newResponses === 1 ? "response" : "responses"} since the last suggestion.`}
                        </Typography>
                        <Button size="small" onClick={() => setShowingUpdatedSuggestion(true)}>
                          {suggestedFrom === undefined ? "Show suggestion" : "Show updated suggestion"}
                        </Button>
                      </Box>
                    )}
                    {showingUpdatedSuggestion && !summaryEmpty && (suggestion.data || suggestion.isLoading) && (
                      <Box sx={{ mt: 1, p: 1.5, border: 1, borderColor: "divider", borderStyle: "dashed", borderRadius: 1 }}>
                        <ParLead360Suggestion
                          suggestion={suggestion.data}
                          actions={
                            <>
                              <Button size="small" onClick={() => setShowingUpdatedSuggestion(false)}>
                                Dismiss
                              </Button>
                              <Button size="small" variant="outlined" onClick={takeSuggestion}>
                                Replace
                              </Button>
                            </>
                          }
                        />
                      </Box>
                    )}
                    {(summaryAutoSaved || suggestionFailed) && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                        {summaryAutoSaved
                          ? "Draft Saved"
                          : "Couldn't write a suggestion just now. It's tried again next time you open this review."}
                      </Typography>
                    )}
                  </Box>
                ))}

              {/* Rating + special-rating + who-shared, grouped in one shaded
                  block rather than loose rows — these three are all "the
                  verdict", distinct from the comment above and the actions
                  below. */}
              <Stack spacing={1.5} sx={{ p: 1.75, borderRadius: 1.5, bgcolor: "action.hover" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Typography
                    id="lead-review-rating-label"
                    variant="body2"
                    sx={{ flexShrink: 0, minWidth: 96, display: "flex", alignItems: "center", gap: 0.75 }}
                    color="text.secondary"
                  >
                    Rating
                    {!readOnly && ratingLocked && (
                      <Tooltip title="This rating was automatically assigned after the PAR deadline was missed and can no longer be changed.">
                        <Box
                          component="span"
                          tabIndex={0}
                          aria-label="Rating auto-assigned and locked"
                          sx={{ display: "flex", cursor: "help", color: "warning.main" }}
                        >
                          <CircleAlertIcon size={16} />
                        </Box>
                      </Tooltip>
                    )}
                  </Typography>
                  {readOnly ? (
                    parRatingData.parRating ? (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Chip size="small" label={parRatingData.parRating} />
                        {parRatingData.parRatingUpdatedBy === "SYSTEM" && <ParAutoAssignedChip />}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        N/A
                      </Typography>
                    )
                  ) : (
                    <ComplexSelect
                      fullWidth
                      value={parRatingValue}
                      onChange={(e) => setParRatingValue(e.target.value as string)}
                      disabled={ratingUpdate.isPending || ratingLocked}
                      aria-labelledby="lead-review-rating-label"
                    >
                      {ratingOptions(cycle.parCycleConfigurations?.parRatings ?? [], {
                        isLeadership,
                        leadershipAllowedRatings,
                        currentRating: parRatingValue,
                      }).map((r) => (
                          <ComplexSelect.MenuItem key={r} value={r}>
                            {r}
                          </ComplexSelect.MenuItem>
                        ))}
                    </ComplexSelect>
                  )}
                </Box>

                {showsPar2 && !isLeadership && (
                  <ParLead360Guidance parCycleId={cycle.parCycleId} employeeEmail={employeeEmail} />
                )}

                {parRatingValue === top5p20pEnabledRating && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Typography
                      id="lead-review-special-rating-label"
                      variant="body2"
                      sx={{ flexShrink: 0, minWidth: 96, display: "flex", alignItems: "center", gap: 0.75 }}
                      color="text.secondary"
                    >
                      Top 5%/20%
                      {!readOnly && parRatingData.parSpecialRatingEligibility === false && (
                        <Tooltip title="This employee isn't eligible for a Top 5%/20% rating in this cycle.">
                          <Box
                            component="span"
                            tabIndex={0}
                            aria-label="Not eligible for a Top 5%/20% rating"
                            sx={{ display: "flex", cursor: "help" }}
                          >
                            <InfoIcon size={16} />
                          </Box>
                        </Tooltip>
                      )}
                    </Typography>
                    {readOnly ? (
                      <Chip size="small" label={SPECIAL_RATING_LABELS[specialRating]} />
                    ) : (
                      <ComplexSelect
                        fullWidth
                        value={specialRating}
                        onChange={(e) => setSpecialRating(e.target.value as typeof specialRating)}
                        disabled={
                          !specialRatingConfirmed || ratingUpdate.isPending || parRatingData.parSpecialRatingEligibility === false
                        }
                        aria-labelledby="lead-review-special-rating-label"
                      >
                        {(Object.keys(SPECIAL_RATING_LABELS) as SpecialRatingUi[]).map((value) => (
                          <ComplexSelect.MenuItem key={value} value={value}>
                            {SPECIAL_RATING_LABELS[value]}
                          </ComplexSelect.MenuItem>
                        ))}
                      </ComplexSelect>
                    )}
                  </Box>
                )}

                {!readOnly && parRatingValue === top5p20pEnabledRating && (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={specialRatingConfirmed}
                        onChange={(e) => setSpecialRatingConfirmed(e.target.checked)}
                        disabled={ratingUpdate.isPending || parRatingData.parSpecialRatingEligibility === false}
                      />
                    }
                    label="The Top 5% / 20% rating decision was discussed and finalized with the functional lead"
                    sx={{ "& .MuiFormControlLabel-label": { fontSize: "0.8rem" } }}
                  />
                )}

                {!readOnly && parRatingValue === evidenceEnabledRating && (
                  <Box>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={evidenceConfirmed}
                          onChange={(e) => setEvidenceConfirmed(e.target.checked)}
                          disabled={ratingUpdate.isPending || ratingLocked}
                        />
                      }
                      label={`Performance gaps were discussed, and the employee has been informed of the "${evidenceEnabledRating}" rating, and at least two discussions were held.`}
                      sx={{ "& .MuiFormControlLabel-label": { fontSize: "0.8rem" } }}
                    />

                    {pickerError === "ACCESS_DENIED" && (
                      <Alert severity="warning" sx={{ my: 1 }}>
                        Google Drive access was denied. Please try again and grant access when prompted.
                      </Alert>
                    )}
                    {pickerError && pickerError !== "ACCESS_DENIED" && (
                      <Alert severity="warning" sx={{ my: 1 }}>
                        Google sign-in popup was blocked, or the picker couldn't load. Please allow popups for this site and try again.
                      </Alert>
                    )}

                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Google size={16} />}
                      disabled={!evidenceConfirmed || ratingUpdate.isPending || isPickerLoading}
                      onClick={() => openPicker(handleFilesSelected)}
                      sx={{ mt: 1, mb: driveFiles.length > 0 ? 1 : 0 }}
                    >
                      {isPickerLoading ? "Opening…" : driveFiles.length > 0 ? "Attach more files" : "Attach from Google Drive"}
                    </Button>

                    {driveFiles.length > 0 && (
                      <Stack spacing={1}>
                        {driveFiles.map((file) => (
                          <ParDriveFileChip key={file.id} file={file} onRemove={() => handleRemoveFile(file.id)} disabled={ratingUpdate.isPending} />
                        ))}
                      </Stack>
                    )}

                    {evidenceConfirmed && driveFiles.length === 0 && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, display: "block" }}>
                        At least one attached file is required before sharing.
                      </Typography>
                    )}
                  </Box>
                )}

                {readOnly && parRatingData.parPerformanceNoticeAck && parRatingData.parRating === evidenceEnabledRating && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      Performance gaps were discussed, and the employee has been informed of the "{evidenceEnabledRating}" rating, and at least
                      two discussions were held.
                    </Typography>
                    <Stack spacing={0.5}>
                      {parRatingData.parPerformanceNoticeAck
                        .split(/\r?\n/)
                        .filter((line) => line.trim() !== "")
                        .map((line) => (
                          <Link
                            key={line}
                            component="button"
                            variant="body2"
                            onClick={() => window.open(line.trim(), "_blank", "noopener,noreferrer")}
                            sx={{ display: "flex", alignItems: "center", gap: 1, textAlign: "left" }}
                          >
                            <ExternalLinkIcon size={14} />
                            {line}
                          </Link>
                        ))}
                    </Stack>
                  </Box>
                )}

                {readOnly && parRatingData.parRatingSharedBy && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Typography variant="body2" sx={{ flexShrink: 0, minWidth: 96 }} color="text.secondary">
                      Shared by
                    </Typography>
                    <Chip size="small" label={parRatingData.parRatingSharedBy} />
                  </Box>
                )}
              </Stack>

              {!readOnly && (
                <>
                  {!employeeReady && (
                    <Alert severity="info" sx={{ py: 0.25 }}>
                      You can share once {parRatingData.parEmployeeName?.split(" ")[0] ?? "the employee"} shares their{" "}
                      {showsPar2 ? "self-review" : "PAR"}, or from {formatShortDateTime(selfReviewClosesAt)} if they
                      don't.
                    </Alert>
                  )}
                  <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, pt: 1, borderTop: 1, borderColor: "divider" }}>
                    <Button variant="outlined" disabled={!canSaveDraft} onClick={() => submit("DRAFT")}>
                      Save draft
                    </Button>
                    <Button variant="contained" disabled={!canShare} onClick={() => setConfirming(true)}>
                      {isAdminView ? "Save and Share" : "Share"}
                    </Button>
                  </Box>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {showsPar2 && (
        <Grid size={{ xs: 12, md: 5 }} sx={{ order: { xs: 1, md: 2 } }}>
          <Card variant="outlined">
            <Tabs
              value={evidenceTab}
              onChange={(_e, value) => setEvidenceTab(value)}
              aria-label="Evidence"
              sx={{ px: 1, borderBottom: 1, borderColor: "divider" }}
            >
              <Tab label="Self-review" />
              {/* A leader's 360° feedback is Leadership 360°. */}
              <Tab label={isLeadership ? "Leadership 360°" : "PAR 360°"} />
            </Tabs>
            <CardContent>
              {evidenceTab === 0 ? (
                selfReviewContent
              ) : isLeadership ? (
                <Leadership360ResultsCard
                  view={isAdminView ? "ALL" : "REPORTS"}
                  leaderEmail={employeeEmail}
                  parCycleId={cycle.parCycleId}
                  fallback={<ParEmptyState text="No Leadership 360° results for this cycle yet" />}
                />
              ) : (
                <ParLead360Evidence parCycleId={cycle.parCycleId} employeeEmail={employeeEmail} framed={false} />
              )}
            </CardContent>
          </Card>
        </Grid>
      )}

      {isAdminView && (
        <Grid size={12} sx={showsPar2 ? { order: 3 } : undefined}>
          <Accordion variant="outlined" defaultExpanded={Boolean(savedAdminComment)}>
            <AccordionSummary expandIcon={<ChevronDownIcon size={18} />}>
              <Typography variant="h6">Admin Comment</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {readOnly ? (
                savedAdminComment ? (
                  <ParCommentView html={savedAdminComment} />
                ) : (
                  <ParEmptyState text="Admin comment unavailable" />
                )
              ) : (
                <ParRichTextField value={adminComment} onChange={setAdminComment} placeholder="Enter your comment here" />
              )}
            </AccordionDetails>
          </Accordion>
        </Grid>
      )}

      {/* A PAR 2.0 cycle shows its 360° responses in the evidence column. */}
      {!showsPar2 && !(reviews.isSuccess && reviews.data.length === 0) && (
        <Grid size={12}>
          {reviews.isLoading ? (
            <Skeleton variant="rectangular" height={72} sx={{ borderRadius: 1.5 }} />
          ) : reviews.isError ? (
            <ErrorNotice error={reviews.error} onRetry={() => reviews.refetch()} retrying={reviews.isFetching}>
              Couldn't load 360° feedback.
            </ErrorNotice>
          ) : (
            <ParHistoryReviewSection reviews={reviews.data ?? []} />
          )}
        </Grid>
      )}

      <Dialog open={confirming} onClose={() => setConfirming(false)} maxWidth="md" fullWidth>
        <DialogTitle>Share Lead's Feedback?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This action will share your review with the employee. You can't undo this action.
          </Typography>
          {summaryShown && summaryEmpty && suggestion.data && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              The 360° summary is empty, so none is shared. The suggestion in grey is only included if you insert it.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirming(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={ratingUpdate.isPending || saveSummary.isPending}
            onClick={() => submit("SHARED", { onSuccess: () => setConfirming(false) })}
          >
            {ratingUpdate.isPending || saveSummary.isPending ? "Sharing…" : "Share"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Warns before an admin force-unlocks editing, worded differently
          when the record is already shared. */}
      <Dialog open={adminEditConfirmOpen} onClose={() => setAdminEditConfirmOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{shared ? "Edit a Shared Review?" : "Edit PAR Details?"}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {shared
              ? "This review has already been shared with the employee. Editing it will change what they see. Do you want to continue?"
              : "This will let you edit the lead's feedback and rating on this employee's behalf. Do you want to continue?"}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAdminEditConfirmOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color={shared ? "warning" : "primary"}
            onClick={() => {
              setAdminForceEdit(true);
              setAdminEditConfirmOpen(false);
            }}
          >
            Edit
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}
