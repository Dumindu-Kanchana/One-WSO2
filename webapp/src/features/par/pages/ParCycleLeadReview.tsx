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

import { useMemo } from "react";
import { Alert, Box, Button, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import { FileDownIcon, FileTextIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { isPreviewEnabled } from "@config/previewFeatures";
import { useMeProfile } from "@features/my/api/useMeProfile";
import { useActiveParCycle, useParRating } from "../api/useParData";
import type { ParRating } from "../api/types";
import { useSelfReview } from "../api/useSelfReview";
import { useCycleLeadership360ForPdf } from "../api/useLeadership360";
import { useLeaveEmployees } from "@features/leave/api/useLeaveData";
import { ParAutoAssignedChip } from "../components/ParChips";
import { ParCommentView, ParLead360SummaryView } from "../components/ParContent";
import ParStepNote from "../components/ParStepNote";
import { decodeParComment } from "../util/parComment";
import { employeeChipLabel } from "../util/parLabels";
import { downloadPar2Pdf } from "../util/parPdf";

// Active cycle → Lead review: the lead's review of your PAR once they share it (the rating, and their
// feedback with their 360° summary), and the finished PAR's PDF. Your self-review stays on its own page.
export default function ParCycleLeadReview() {
  const profile = useMeProfile();
  const workEmail = profile.data?.userInfo.workEmail;
  const activeCycles = useActiveParCycle(workEmail);
  const cycle = activeCycles.data?.[0];
  const rating = useParRating(cycle?.parCycleId, workEmail);
  // Until the lead shares, the backend leaves their comment and rating out.
  const leadShared = Boolean(rating.data?.parLeadComment || rating.data?.parRating);
  // The PDF carries the self-review and a leader's Leadership 360° results.
  const selfReview = useSelfReview(cycle?.parCycleId, workEmail, leadShared);
  const leadership360 = useCycleLeadership360ForPdf(
    cycle?.parCycleId ?? 0,
    workEmail,
    leadShared && cycle !== undefined && isPreviewEnabled("leadership360"),
  );

  if (profile.isLoading || activeCycles.isLoading || rating.isLoading) {
    return <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />;
  }
  if (profile.isError) {
    return (
      <ErrorNotice error={profile.error} onRetry={() => profile.refetch()} retrying={profile.isFetching}>
        Couldn't load your profile.
      </ErrorNotice>
    );
  }
  if (activeCycles.isError) {
    return (
      <ErrorNotice error={activeCycles.error} onRetry={() => activeCycles.refetch()} retrying={activeCycles.isFetching}>
        Couldn't load your PAR cycle.
      </ErrorNotice>
    );
  }
  if (rating.isError) {
    return (
      <ErrorNotice error={rating.error} onRetry={() => rating.refetch()} retrying={rating.isFetching}>
        Couldn't load your PAR record for this cycle.
      </ErrorNotice>
    );
  }
  if (!cycle || !rating.data) {
    return <Alert severity="info">There's no PAR cycle open for you right now.</Alert>;
  }
  if (!leadShared) {
    return <ParStepNote icon={FileTextIcon}>Available once your lead shares their review.</ParStepNote>;
  }
  const parRating = rating.data;
  const review = selfReview.data;
  // What the PDF needs that couldn't be loaded is offered again, rather than the PDF going without it.
  // A self-review still loaded from before a failed refetch is used as it is.
  const pdfFailed: PdfFailure | undefined =
    selfReview.isError && !review
      ? {
          what: "your self-review",
          error: selfReview.error,
          retry: () => void selfReview.refetch(),
          retrying: selfReview.isFetching,
        }
      : leadership360.failed && { what: "your Leadership 360° results", ...leadership360.failed };
  return (
    <SharedReview
      rating={parRating}
      pdfFailed={pdfFailed}
      // A leader's PDF waits for their Leadership 360° lookup to settle.
      pdfPending={leadership360.isLoading}
      onDownloadPdf={
        review
          ? () =>
              downloadPar2Pdf({
                rating: parRating,
                leadComment: decodeParComment(parRating.parLeadComment),
                selfReview: { definition: review.template.definition, answers: review.answers },
                leadership360: leadership360.data,
              })
          : undefined
      }
    />
  );
}

interface PdfFailure {
  /** What couldn't be loaded, in the reader's terms. */
  what: string;
  error: unknown;
  retry: () => void;
  retrying: boolean;
}

// The shared review: the rating (and a Top 5% or Top 20%) in a shaded box, the lead's feedback with
// their 360° summary in a box of its own, then the PDF.
function SharedReview({
  rating,
  onDownloadPdf,
  pdfPending = false,
  pdfFailed,
}: {
  rating: ParRating;
  onDownloadPdf?: () => void;
  pdfPending?: boolean;
  pdfFailed?: PdfFailure;
}) {
  const employees = useLeaveEmployees();
  const leadName = useMemo(() => {
    const lead = employees.data?.find((e) => e.workEmail.toLowerCase() === rating.parLeadEmail?.toLowerCase());
    return lead?.firstName;
  }, [employees.data, rating.parLeadEmail]);
  const specialRating =
    rating.parSpecialRating && rating.parSpecialRating !== "NOT_ASSIGNED" ? rating.parSpecialRating : undefined;
  return (
    <Stack spacing={1.75}>
      {(rating.parRating || specialRating) && (
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            columnGap: 4,
            rowGap: 1,
            px: 2.25,
            py: 2,
            borderRadius: "12px",
            bgcolor: "action.hover",
          }}
        >
          {rating.parRating && <RatingItem label="Rating" value={employeeChipLabel(rating.parRating).label} />}
          {specialRating && <RatingItem label="Top 5%/20%" value={employeeChipLabel(specialRating).label} />}
          {rating.parRatingUpdatedBy === "SYSTEM" && <ParAutoAssignedChip />}
        </Box>
      )}
      <Box sx={{ border: 1, borderColor: "divider", borderRadius: "10px", px: 2, py: 1.75 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          {leadName ? `${leadName}'s feedback` : "Your lead's feedback"}
        </Typography>
        <ParCommentView html={decodeParComment(rating.parLeadComment)} />
        <ParLead360SummaryView summary={rating.parLead360Summary} />
      </Box>
      {pdfFailed ? (
        <ErrorNotice error={pdfFailed.error} onRetry={pdfFailed.retry} retrying={pdfFailed.retrying}>
          Couldn't load {pdfFailed.what} for the PDF.
        </ErrorNotice>
      ) : (
        onDownloadPdf && (
          <Box>
            <Button
              variant="outlined"
              startIcon={<FileDownIcon size={14} />}
              onClick={onDownloadPdf}
              disabled={pdfPending}
            >
              Download PDF
            </Button>
          </Box>
        )
      )}
    </Stack>
  );
}

function RatingItem({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography
        variant="caption"
        component="div"
        sx={{ color: "text.secondary", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}
      >
        {label}
      </Typography>
      <Typography sx={{ fontSize: 17, fontWeight: 700 }}>{value}</Typography>
    </Box>
  );
}
