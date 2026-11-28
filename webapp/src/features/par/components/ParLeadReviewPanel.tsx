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
  CircleHelpIcon,
  ExternalLinkIcon,
  FileDownIcon,
  Google,
  InfoIcon,
  PencilIcon,
} from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import ConfirmationDialog from "@components/confirmation-dialog/ConfirmationDialog";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useParRating } from "../api/useParData";
import { useLeadRatingUpdate } from "../api/useLeadRatingUpdate";
import { useParEmployeeReviews } from "../api/useLeadHistory";
import { useGoogleDrivePicker } from "../hooks/useGoogleDrivePicker";
import { decodeParComment, encodeParComment, isEmptyHtml, paragraphsToHtml } from "../util/parComment";
import { isPreviewEnabled } from "@config/previewFeatures";
import { deadlinePassedEverywhereAt, isDeadlinePassed } from "../util/parDeadline";
import { formatShortDate, formatShortDateTime } from "../util/parDate";
import { downloadParPdf } from "../util/parPdf";
import { isOpenableUrl, parseSavedUrls, type DriveFile } from "../util/parDriveFile";
import { isEvidenceMissing, missedDeadlineRatingFor, ratingOptions, ratingRulesFor } from "../util/parLeadership";
import { employeeDeadlineFor, needsNoEvidence, shareOpensAfter } from "../util/parDepartments";
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
import { useRedrawAt } from "../hooks/useRedrawAt";
import ParLead360Suggestion from "./ParLead360Suggestion";

type SpecialRatingUi = "NONE" | "TOP5P" | "TOP20P";

// The backend's wire vocabulary is TOP5P/TOP20P/NOT_ASSIGNED (or the field
// absent) — "NONE" is only this component's own UI sentinel for "no special
// rating", so anything else read back from the server normalizes to it.
const toSpecialRatingUi = (value: string | undefined): SpecialRatingUi =>
  value === "TOP5P" || value === "TOP20P" ? value : "NONE";

const SPECIAL_RATING_LABELS: Record<SpecialRatingUi, string> = { NONE: "N/A", TOP5P: "Top 5%", TOP20P: "Top 20%" };

/** Beside the 360° summary's heading, while the lead can write it. */
const SUGGESTION_HINT = "A suggested summary is available after the 360° deadline if 3 or more people respond.";

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
  const selfReview = useSelfReview(cycle.parCycleId, employeeEmail, isPreviewEnabled("par2"));
  // A PAR 2.0 cycle puts the evidence (self-review, 360° summary) beside the
  // assessment, with the 360° guidance under the rating.
  const { showsPar2 } = useParShowsPar2(cycle.parCycleId);
  const [evidenceTab, setEvidenceTab] = useState(0);
  const { showSuccess, showError } = useNotifications();

  // The cycle's ratings and the rules that depend on them.
  const ratingRules = ratingRulesFor(cycle.parCycleConfigurations);
  const { top5p20pEnabledRating, evidenceEnabledRating } = ratingRules;

  const [leadComment, setLeadComment] = useState("");
  // The lead's 360° summary (PAR 2.0, not the leadership team): a draft like
  // the comment, shared with it and saved on its own, at any number of
  // responses. Once all 360° feedback is in, an AI suggestion shows in grey
  // while it's empty, for the lead to insert.
  const [lead360Summary, setLead360Summary] = useState("");
  // The suggestion, shown under the lead's own words when they ask for it.
  const [showingSuggestion, setShowingSuggestion] = useState(false);
  const summaryField = useRef<ParRichTextFieldHandle>(null);
  const [summaryAutoSaved, setSummaryAutoSaved] = useState(false);
  const [adminComment, setAdminComment] = useState("");
  const [parRatingValue, setParRatingValue] = useState("");
  const [specialRating, setSpecialRating] = useState<SpecialRatingUi>("NONE");
  // A Top 5%/20% pick waiting for the lead to confirm it was agreed with the functional lead.
  const [specialRatingToConfirm, setSpecialRatingToConfirm] = useState<SpecialRatingUi | null>(null);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [evidenceConfirmed, setEvidenceConfirmed] = useState(false);
  const [seededForId, setSeededForId] = useState<number | undefined>(undefined);
  // How many edits the PAR admin has made to each since the record loaded or a save took them. Their save sends the
  // lead's comment and rating only when they did, so a newer value the lead saved meanwhile (seen in a refetch) stays.
  // A save clears only the edits it carried: one made while it was on its way is still sent next time.
  const [adminEdited, setAdminEdited] = useState({ leadComment: 0, rating: 0 });
  const [autoSaved, setAutoSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // An admin lands on this panel read-only by default — even for a
  // still-in-progress DRAFT/PENDING record — and must explicitly unlock
  // editing via the pencil icon below.
  const [adminForceEdit, setAdminForceEdit] = useState(false);
  const [adminEditConfirmOpen, setAdminEditConfirmOpen] = useState(false);
  const autoSaveTokenRef = useRef(0);

  const parRatingData = rating.data;
  // When the employee's self-review deadline has passed everywhere (their department's
  // own deadline, or the cycle's): from then they can no longer share it.
  const selfReviewClosesAt = deadlinePassedEverywhereAt(employeeDeadlineFor(cycle, parRatingData?.parDepartment));
  const selfReviewClosesAtMs = selfReviewClosesAt.getTime();
  const selfReviewClosed = new Date() >= selfReviewClosesAt;
  // A PAR the employee didn't share by then gets the cycle's missed-deadline
  // rating (the leadership team's own for them), and the lead has nothing to
  // submit: the backend refuses the lead's saves and shares. People Ops can
  // still change it.
  const missedDeadlineRating = missedDeadlineRatingFor(ratingRules, Boolean(parRatingData?.parIsLeadershipEmployee));
  const selfReviewMissed =
    !isAdminView &&
    selfReviewClosed &&
    (parRatingData?.parEmployeeStatus === "PENDING" || parRatingData?.parEmployeeStatus === "DRAFT") &&
    missedDeadlineRating !== undefined;
  // The backend also refuses a non-admin change to a rating the system
  // auto-assigned after a missed deadline; an admin can still correct it.
  const ratingLocked = !isAdminView && (parRatingData?.parRatingUpdatedBy === "SYSTEM" || selfReviewMissed);
  const shownRating = selfReviewMissed ? missedDeadlineRating : parRatingValue;
  // The rating that needs evidence, unless the employee's department shares it without.
  const evidenceRating = needsNoEvidence(cycle.parCycleConfigurations, parRatingData?.parDepartment)
    ? undefined
    : evidenceEnabledRating;

  // Seed once per record, so a background refetch doesn't overwrite mid-typing.
  if (parRatingData && parRatingData.parRatingId !== seededForId) {
    setSeededForId(parRatingData.parRatingId);
    setAdminEdited({ leadComment: 0, rating: 0 });
    setLeadComment(decodeParComment(parRatingData.parLeadComment));
    setLead360Summary(decodeParComment(parRatingData.parLead360Summary));
    setAdminComment(decodeParComment(parRatingData.parAdminComment));
    setParRatingValue(parRatingData.parRating && parRatingData.parRating !== "NOT_ASSIGNED" ? parRatingData.parRating : "");
    setSpecialRating(toSpecialRatingUi(parRatingData.parSpecialRating));
    setDriveFiles(parseSavedUrls(parRatingData.parPerformanceNoticeAck ?? ""));
    // The checkbox itself is never saved, only its effect (the attached
    // files), so it always starts unchecked.
    setEvidenceConfirmed(false);
  }

  useEffect(() => {
    if (shownRating !== top5p20pEnabledRating) {
      setSpecialRating("NONE");
    }
    if (shownRating !== evidenceEnabledRating) {
      setDriveFiles([]);
      setEvidenceConfirmed(false);
    }
  }, [shownRating, top5p20pEnabledRating, evidenceEnabledRating]);

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

  // The attached links as they're saved: one per line.
  const evidenceLinks = driveFiles.map((f) => f.url).join("\n");
  const savedEvidenceLinks = parRatingData?.parPerformanceNoticeAck ?? "";

  // Every value below is derived with parRatingData possibly still
  // undefined (loading/error/not-found are handled further down, but hooks
  // must stay unconditional), so the submit/autosave logic guards on it
  // itself rather than relying on an early return to have already happened.
  // Admin edits are gated by the cycle's own closing date rather than the
  // lead's feedback deadline.
  const deadlineDate = isAdminView ? cycle.parCycleEndDate : cycle.parLeadDeadline;
  const deadlinePassed = isDeadlinePassed(deadlineDate);
  const shared = parRatingData?.parLeadStatus === "SHARED";
  // A lead can still save and share after the lead deadline, shown as late, until the hard lead deadline in a
  // PAR 2.0 cycle (until the cycle closes in a PAR 1.0 one). After it, only PAR admins can. PAR admins' edits stop
  // at the cycle's end date.
  const hardDeadline = showsPar2 ? cycle.parLeadHardDeadline : undefined;
  const hardDeadlinePassed = !isAdminView && hardDeadline !== undefined && isDeadlinePassed(hardDeadline);
  const editingClosed = cycle.parCycleStatus === "CLOSED" || (isAdminView ? deadlinePassed : hardDeadlinePassed);
  const leadLate = !isAdminView && !shared && deadlinePassed && !hardDeadlinePassed;
  const specialRatingClosed =
    !isAdminView && Boolean(cycle.parSpecialRatingDeadline) && isDeadlinePassed(cycle.parSpecialRatingDeadline!);
  const readOnly = isAdminView ? !adminForceEdit : shared || editingClosed;
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

  // The suggestion is written once all the 360° feedback is in: after the 360°
  // deadline has passed everywhere, as for sharing, from 3 or more responses.
  // The backend keeps it, so it's written once. It shows in grey while the
  // summary is empty, or under the lead's own words when they ask for it. Not
  // for a shared PAR, whose summary can't change. The panel redraws when the
  // deadline passes.
  const allFeedbackInAtMs = deadlinePassedEverywhereAt(cycle.parThreeSixtyRatingDeadline).getTime();
  const allFeedbackIn = Date.now() >= allFeedbackInAtMs;
  useRedrawAt(allFeedbackInAtMs, summaryShown && !readOnly && !allFeedbackIn);
  const responseCount = responses.data?.responseCount ?? 0;
  const summaryEmpty = isEmptyHtml(lead360Summary);
  const suggestionPossible =
    summaryShown &&
    !readOnly &&
    !shared &&
    !selfReviewMissed &&
    allFeedbackIn &&
    responseCount >= MIN_360_RESPONSES;
  // Whether the last try at a suggestion failed. Until one succeeds it stays asked for, so it's tried again an hour
  // later as the panel says, even once the lead has started writing.
  const [suggestionFailedBefore, setSuggestionFailedBefore] = useState(false);
  const suggestion = useLead360SummarySuggestion(
    cycle.parCycleId,
    employeeEmail,
    responseCount,
    suggestionPossible && (summaryEmpty || showingSuggestion || suggestionFailedBefore),
  );
  const suggestionLastFailed = suggestion.isError ? true : suggestion.isSuccess ? false : suggestionFailedBefore;
  if (suggestionLastFailed !== suggestionFailedBefore) setSuggestionFailedBefore(suggestionLastFailed);
  const suggestionFailed = suggestion.isError;
  // Offered under the lead's own words whenever it isn't open, so one that was
  // dismissed can be looked at again: it's kept, so nothing new is written.
  const suggestionOffered = suggestionPossible && !summaryEmpty && !showingSuggestion;
  // Into the field as one step the field's Undo takes back, so it needs no
  // confirming, even when it replaces the lead's own words.
  const takeSuggestion = () => {
    if (!suggestion.data) return;
    summaryField.current?.replaceContents(paragraphsToHtml(suggestion.data.summary));
    setShowingSuggestion(false);
  };
  const greySuggestionShown = summaryEmpty && Boolean(suggestion.data || suggestion.isLoading);

  const sharing = ratingUpdate.isPending || saveSummary.isPending;

  const submit = (
    status: "DRAFT" | "SHARED",
    opts?: { silent?: boolean; onSuccess?: () => void; commentOnly?: boolean },
  ) => {
    if (!parRatingData) return;
    // Past the hard lead deadline nothing is sent, even from a confirmation opened before it: the panel locks.
    if (!isAdminView && hardDeadline !== undefined && isDeadlinePassed(hardDeadline)) {
      setConfirming(false);
      return;
    }
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
    // A PAR admin's save sends only what they changed, so it never overwrites the lead's newer words or rating, and
    // their Save draft keeps the lead status as it is: a shared PAR stays shared, and a PAR the lead hasn't started
    // isn't turned into the lead's draft.
    const adminChanged = (edits: number) => !isAdminView || edits > 0;
    const sentEdits = adminEdited;
    ratingUpdate.mutate(
      {
        employeeEmail,
        parRatingId: parRatingData.parRatingId,
        payload: {
          ...(isAdminView && status === "DRAFT" ? {} : { parLeadStatus: status }),
          // A comment never written is left out: the backend refuses an empty one. (A comment the lead
          // clears still holds the editor's empty paragraph, so it's sent and saved empty.)
          ...(leadComment && adminChanged(adminEdited.leadComment)
            ? { parLeadComment: encodeParComment(leadComment) }
            : {}),
          // The autosave fires purely off comment typing and must not also
          // commit whatever the rating dropdowns currently hold — sending
          // parSpecialRating with it would clobber a saved Top 5%/20%
          // allocation the moment someone types a character.
          ...(opts?.commentOnly
            ? {}
            : {
                ...(parRatingValue && !ratingLocked && adminChanged(adminEdited.rating)
                  ? { parRating: parRatingValue }
                  : {}),
                // The backend's wire vocabulary is TOP5P/TOP20P/NOT_ASSIGNED;
                // "NONE" is only this component's UI sentinel and 400s if sent.
                // Sent only when changed: after the Top 5%/20% deadline the backend refuses any
                // value, so sending the unchanged one blocked Save draft and Share.
                ...(specialRating !== toSpecialRatingUi(parRatingData.parSpecialRating)
                  ? { parSpecialRating: specialRating === "NONE" ? "NOT_ASSIGNED" : specialRating }
                  : {}),
                // Sent only when the links changed. With none left it's "",
                // which takes the saved ones away.
                ...(evidenceLinks !== savedEvidenceLinks ? { parPerformanceNoticeAck: evidenceLinks } : {}),
              }),
        },
      },
      {
        onSuccess: () => {
          if (isAdminView) {
            setAdminEdited((now) => ({
              leadComment: now.leadComment === sentEdits.leadComment ? 0 : now.leadComment,
              rating: now.rating === sentEdits.rating ? 0 : now.rating,
            }));
          }
          if (!opts?.silent) showSuccess(status === "SHARED" ? "Successfully shared" : "Draft saved");
          opts?.onSuccess?.();
        },
        onError: (err) => {
          if (!opts?.silent) showError(describeError(err));
        },
      },
    );
  };

  // The admin comment is the PAR admin's own note: it saves on its own, sending nothing else, and an emptied one
  // clears it. It needs no unlocking, since it doesn't change the lead's review.
  const adminCommentToSave = isEmptyHtml(adminComment) ? "" : adminComment;
  const adminCommentDirty = isAdminView && adminCommentToSave.trim() !== savedAdminComment.trim();
  const saveAdminComment = () => {
    if (!parRatingData) return;
    ratingUpdate.mutate(
      {
        employeeEmail,
        parRatingId: parRatingData.parRatingId,
        payload: { parAdminComment: adminCommentToSave ? encodeParComment(adminCommentToSave) : "" },
      },
      {
        onSuccess: () => showSuccess(adminCommentToSave ? "Admin comment saved" : "Admin comment cleared"),
        onError: (err) => showError(describeError(err)),
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

  // If the self-review closes while the panel is open (even between a render and the timer), the panel
  // redraws, so it shows what the lead can do now without a reload.
  useRedrawAt(selfReviewClosesAtMs, !selfReviewClosed);

  // In a PAR 2.0 cycle a PAR is shared once all its 360° feedback is in, by PAR admins too (the backend's
  // checkShareOpen): once the 360° deadline (or the employee's later self-review deadline) has passed everywhere,
  // as the missed-deadline job judges deadlines. The panel redraws then, as for the self-review closing.
  const shareOpens = shareOpensAfter(cycle, parRatingData?.parDepartment);
  const shareOpensAtMs = deadlinePassedEverywhereAt(shareOpens.date).getTime();
  const shareWaits = showsPar2 && Date.now() < shareOpensAtMs;
  useRedrawAt(shareOpensAtMs, shareWaits);

  // The lead's review closes after the hard lead deadline, by their own day as isDeadlinePassed judges it: the panel
  // redraws then too.
  const hardDeadlineEndsAtMs = hardDeadline ? new Date(`${hardDeadline}T23:59:59.999`).getTime() : NaN;
  useRedrawAt(hardDeadlineEndsAtMs, !isAdminView && !hardDeadlinePassed);

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
    (parRatingValue !== (parRatingData.parRating ?? "") && parRatingValue !== "") ||
    specialRating !== toSpecialRatingUi(parRatingData.parSpecialRating) ||
    evidenceLinks !== savedEvidenceLinks;

  const statusAlert = readOnly || shared ? (
    <Alert severity={shared ? "success" : "info"}>
      {shared ? "Lead's feedback is shared with the employee" : "Lead's feedback is not shared with the employee"}
    </Alert>
  ) : selfReviewMissed ? (
    <Alert severity="warning">
      {parRatingData.parEmployeeName?.split(" ")[0] ?? "The employee"} didn't share their{" "}
      {showsPar2 ? "self-review" : "PAR"} by the deadline, so their rating is {missedDeadlineRating}. There's
      nothing for you to submit.
    </Alert>
  ) : parRatingData.parLeadStatus === "DRAFT" ? (
    <Alert severity="warning">
      You have saved your PAR as a draft.
      {/* Once late, the late note below says until when. */}
      {isAdminView
        ? ` Please share before the cycle ends: ${formatShortDate(deadlineDate)}.`
        : leadLate
          ? ""
          : ` Please share on or before the deadline: ${formatShortDate(deadlineDate)}.`}
    </Alert>
  ) : leadLate ? null : (
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
  const employeeShared =
    parRatingData.parEmployeeStatus === "SHARED" || parRatingData.parEmployeeStatus === "SHARED_BLOCKED";
  // Sharing once the self-review has closed comes with PAR 2.0 (par2); until then, once the employee shares.
  const employeeReady =
    isAdminView || employeeShared || (isPreviewEnabled("par2") && selfReviewClosed);
  const canSaveDraft = !readOnly && !editingClosed && !ratingUpdate.isPending && !saveSummary.isPending && dirty;
  const canShare =
    !readOnly &&
    !editingClosed &&
    !ratingUpdate.isPending &&
    !saveSummary.isPending &&
    employeeReady &&
    !shareWaits &&
    Boolean(shownRating) &&
    !isEmptyHtml(leadComment) &&
    !isEvidenceMissing({
      rating: shownRating,
      evidenceEnabledRating: evidenceRating,
      ratingLocked,
      evidenceConfirmed,
      fileCount: driveFiles.length,
    });

  // A failed lookup says so rather than reading as "not shared"; a 404 is none (the single comment).
  const selfReviewContent = selfReview.isLoading ? (
    <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1.5 }} />
  ) : selfReview.isError ? (
    <ErrorNotice error={selfReview.error} onRetry={() => selfReview.refetch()} retrying={selfReview.isFetching}>
      Couldn't load the employee's self-review.
    </ErrorNotice>
  ) : selfReview.data ? (
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
            {isAdminView && deadlinePassed && !shared && (
              <Alert severity="error" sx={{ mt: 1.5 }}>
                The cycle ended on: {formatShortDate(deadlineDate)}.
              </Alert>
            )}
            {leadLate && (
              <Alert severity="error" sx={{ mt: 1.5 }}>
                The lead review deadline passed on {formatShortDate(deadlineDate)}.{" "}
                {hardDeadline
                  ? `You can still share until ${formatShortDate(hardDeadline)}, but it's late.`
                  : "You can still share, but it's late."}
              </Alert>
            )}
            {hardDeadlinePassed && !shared && hardDeadline && (
              <Alert severity="error" sx={{ mt: 1.5 }}>
                The hard lead deadline passed on {formatShortDate(hardDeadline)}. Only PAR admins can rate and share
                this PAR now.
              </Alert>
            )}
          </Box>
          {isAdminView && readOnly && !editingClosed && (
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
                onClick={() =>
                  downloadParPdf(
                    parRatingData,
                    employeeComment,
                    savedLeadComment,
                    reviews.data,
                    isAdminView ? savedAdminComment : undefined,
                  )
                }
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
                  <ParRichTextField
                    value={leadComment}
                    onChange={(value) => {
                      // An editor that only tidies the value it was given hasn't been edited.
                      if (value.trim() !== leadComment.trim()) {
                        setAdminEdited((e) => ({ ...e, leadComment: e.leadComment + 1 }));
                      }
                      setLeadComment(value);
                    }}
                    placeholder="Enter your comment here"
                    disabled={selfReviewMissed}
                  />
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
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1 }}>
                      <Typography variant="subtitle2">360° summary</Typography>
                      <Tooltip title={SUGGESTION_HINT} arrow enterTouchDelay={0}>
                        <Box
                          component="span"
                          role="img"
                          tabIndex={0}
                          aria-label={SUGGESTION_HINT}
                          sx={{ display: "flex", color: "text.secondary", cursor: "help" }}
                        >
                          <CircleHelpIcon size={15} />
                        </Box>
                      </Tooltip>
                    </Box>
                    <ParRichTextField
                      ref={summaryField}
                      value={lead360Summary}
                      onChange={setLead360Summary}
                      placeholder={greySuggestionShown ? "" : "Summarise the 360° feedback"}
                      minHeight="10rem"
                      disabled={selfReviewMissed}
                      suggestion={
                        greySuggestionShown && (
                          <ParLead360Suggestion suggestion={suggestion.data} onInsert={takeSuggestion} />
                        )
                      }
                      onAcceptSuggestion={summaryEmpty && suggestion.data ? takeSuggestion : undefined}
                    />
                    {allFeedbackIn && responses.isError && !responses.data && (
                      // Without the count, nothing says whether there's a suggestion.
                      <Box sx={{ mt: 1 }}>
                        <ErrorNotice error={responses.error} onRetry={() => responses.refetch()} retrying={responses.isFetching}>
                          Couldn't load the 360° responses.
                        </ErrorNotice>
                      </Box>
                    )}
                    {suggestionOffered && (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5, flexWrap: "wrap" }}>
                        <Typography variant="caption" color="text.secondary">
                          There's a suggested summary from the 360° feedback.
                        </Typography>
                        <Button size="small" onClick={() => setShowingSuggestion(true)}>
                          Show suggestion
                        </Button>
                      </Box>
                    )}
                    {showingSuggestion && !summaryEmpty && (suggestion.data || suggestion.isLoading) && (
                      <Box sx={{ mt: 1, p: 1.5, border: 1, borderColor: "divider", borderStyle: "dashed", borderRadius: 1 }}>
                        <ParLead360Suggestion
                          suggestion={suggestion.data}
                          actions={
                            <>
                              <Button size="small" onClick={() => setShowingSuggestion(false)}>
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
                          : "Couldn't write a suggestion just now. It's tried again after an hour."}
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
                      <Tooltip
                        title={
                          selfReviewMissed
                            ? `This PAR wasn't shared by its deadline, so its rating is ${missedDeadlineRating}.`
                            : "This rating was automatically assigned after the PAR deadline was missed and can no longer be changed."
                        }
                      >
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
                    parRatingData.parRating && parRatingData.parRating !== "NOT_ASSIGNED" ? (
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
                      value={shownRating}
                      onChange={(e) => {
                        setAdminEdited((edited) => ({ ...edited, rating: edited.rating + 1 }));
                        setParRatingValue(e.target.value as string);
                      }}
                      disabled={ratingUpdate.isPending || ratingLocked}
                      // MUI names the combobox from labelId; aria-labelledby alone didn't reach it.
                      labelId="lead-review-rating-label"
                      aria-labelledby="lead-review-rating-label"
                    >
                      {ratingOptions(ratingRules, { isLeadership, currentRating: shownRating }).map((r) => (
                          <ComplexSelect.MenuItem key={r} value={r}>
                            {r}
                          </ComplexSelect.MenuItem>
                        ))}
                    </ComplexSelect>
                  )}
                </Box>

                {showsPar2 && !isLeadership && (
                  <ParLead360Guidance
                    parCycleId={cycle.parCycleId}
                    employeeEmail={employeeEmail}
                    threeSixtyDeadline={cycle.parThreeSixtyRatingDeadline}
                  />
                )}

                {/* The leadership team can't get Top 5%/20%, so it isn't offered. */}
                {shownRating === top5p20pEnabledRating && !isLeadership && (
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
                        onChange={(e) => {
                          const picked = e.target.value as SpecialRatingUi;
                          if (picked === "NONE") setSpecialRating(picked);
                          else setSpecialRatingToConfirm(picked);
                        }}
                        disabled={
                          ratingUpdate.isPending ||
                          parRatingData.parSpecialRatingEligibility === false ||
                          selfReviewMissed ||
                          specialRatingClosed
                        }
                        labelId="lead-review-special-rating-label"
                        aria-labelledby="lead-review-special-rating-label"
                      >
                        {(Object.keys(SPECIAL_RATING_LABELS) as SpecialRatingUi[]).map((value) => (
                          <ComplexSelect.MenuItem key={value} value={value}>
                            {SPECIAL_RATING_LABELS[value]}
                          </ComplexSelect.MenuItem>
                        ))}
                      </ComplexSelect>
                    )}
                    {!readOnly && specialRatingClosed && (
                      <Typography variant="caption" color="text.secondary">
                        {/* A PAR 2.0 cycle's Top 5%/20% deadline is its lead deadline. */}
                        {showsPar2
                          ? `Top 5%/20% can't be given after the lead deadline, ${formatShortDate(cycle.parSpecialRatingDeadline!)}.`
                          : `The Top 5%/20% deadline passed on ${formatShortDate(cycle.parSpecialRatingDeadline!)}`}
                      </Typography>
                    )}
                  </Box>
                )}

                {!readOnly && !selfReviewMissed && evidenceRating !== undefined && shownRating === evidenceRating && (
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
                        .map((line) =>
                          isOpenableUrl(line) ? (
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
                          ) : (
                            <Typography key={line} variant="body2" sx={{ wordBreak: "break-all" }}>
                              {line}
                            </Typography>
                          ),
                        )}
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

              {!readOnly && !selfReviewMissed && (
                <>
                  {!employeeReady && isPreviewEnabled("par2") && (
                    <Alert severity="info" sx={{ py: 0.25 }}>
                      You can share once {parRatingData.parEmployeeName?.split(" ")[0] ?? "the employee"} shares their{" "}
                      {showsPar2 ? "self-review" : "PAR"}
                      {missedDeadlineRating ? "." : `, or from ${formatShortDateTime(selfReviewClosesAt)} if they don't.`}
                    </Alert>
                  )}
                  {employeeReady && shareWaits && (
                    <Alert severity="info" sx={{ py: 0.25 }}>
                      {shareOpens.after === "360"
                        ? `You can share from ${formatShortDateTime(new Date(shareOpensAtMs))}, when the 360° deadline has passed everywhere and all 360° feedback is in.`
                        : `You can share from ${formatShortDateTime(new Date(shareOpensAtMs))}, when ${parRatingData.parEmployeeName?.split(" ")[0] ?? "the employee"}'s self-review deadline has passed everywhere.`}
                      {" "}You can save a draft until then.
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
                <ParLead360Evidence
                  parCycleId={cycle.parCycleId}
                  employeeEmail={employeeEmail}
                  threeSixtyDeadline={cycle.parThreeSixtyRatingDeadline}
                  framed={false}
                />
              )}
            </CardContent>
          </Card>
        </Grid>
      )}

      {isAdminView && (
        <Grid size={12} sx={showsPar2 ? { order: 3 } : undefined}>
          <Accordion variant="outlined" defaultExpanded={!isEmptyHtml(savedAdminComment)}>
            <AccordionSummary expandIcon={<ChevronDownIcon size={18} />}>
              <Typography variant="h6">Admin Comment</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {editingClosed ? (
                !isEmptyHtml(savedAdminComment) ? (
                  <ParCommentView html={savedAdminComment} />
                ) : (
                  <ParEmptyState text="Admin comment unavailable" />
                )
              ) : (
                <Stack spacing={1.5}>
                  <ParRichTextField value={adminComment} onChange={setAdminComment} placeholder="Enter your comment here" />
                  <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button
                      variant="outlined"
                      disabled={!adminCommentDirty || ratingUpdate.isPending}
                      onClick={saveAdminComment}
                    >
                      Save comment
                    </Button>
                  </Box>
                </Stack>
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

      {/* Stays open while sharing, so nothing can be edited behind it and then lost once it's shared. Closes when
          the review locks, as at the hard lead deadline. */}
      <Dialog open={confirming && !readOnly} onClose={() => !sharing && setConfirming(false)} maxWidth="md" fullWidth>
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
          <Button onClick={() => setConfirming(false)} disabled={sharing}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={sharing}
            onClick={() => submit("SHARED", { onSuccess: () => setConfirming(false) })}
          >
            {sharing ? "Sharing…" : "Share"}
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

      <ConfirmationDialog
        content={
          specialRatingToConfirm && {
            title: `Give a ${SPECIAL_RATING_LABELS[specialRatingToConfirm]} rating?`,
            text: "The Top 5% / 20% rating decision was discussed and finalized with the functional lead.",
            confirmColor: "primary",
            confirmAction: () => setSpecialRating(specialRatingToConfirm),
          }
        }
        onClose={() => setSpecialRatingToConfirm(null)}
      />
    </Grid>
  );
}
