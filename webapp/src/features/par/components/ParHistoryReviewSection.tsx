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

import { Accordion, AccordionDetails, AccordionSummary, Chip, IconButton, Stack, Tooltip, Typography } from "@wso2/oxygen-ui";
import { ChevronDownIcon, CopyIcon } from "@wso2/oxygen-ui-icons-react";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { decodeParComment } from "../util/parComment";
import { ParCommentView } from "./ParContent";
import ParEmptyState from "./ParEmptyState";
import type { Par360Review } from "../api/types";

// Ports FeedbackComponent.tsx's own ThreeSixtyFeedbackSection — the
// isAdminsSelfProfile branch is Admin Portal only and left out. Shows the
// reviewer's email rather than name (no employee directory available, same
// deviation as everywhere else in this port).
export default function ParHistoryReviewSection({ reviews }: { reviews: Par360Review[] }) {
  const { showSuccess, showError } = useNotifications();
  const completed = reviews.filter((r) => r.reviewStatus === "SHARED");

  const copyReview = (review: Par360Review) => {
    const comment = decodeParComment(review.reviewComment) || "No comment provided";
    const text = `${review.reviewerEmail}:\nRating: ${review.reviewRating ?? ""}\nFeedback: ${comment}`;
    navigator.clipboard.writeText(text).then(
      () => showSuccess("Review copied to clipboard"),
      () => showError("Unable to copy review to clipboard"),
    );
  };

  if (reviews.length === 0) return null;

  return (
    <Accordion variant="outlined">
      <AccordionSummary expandIcon={<ChevronDownIcon size={18} />}>
        <Typography variant="h6">360° Feedback</Typography>
      </AccordionSummary>
      <AccordionDetails>
        {completed.length === 0 ? (
          <ParEmptyState text="All 360° feedback was rejected" />
        ) : (
          <Stack spacing={1.5}>
            {completed.map((review) => (
              <Accordion key={review.reviewerEmail} variant="outlined">
                <AccordionSummary expandIcon={<ChevronDownIcon size={16} />}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ width: "100%" }}>
                    <Typography sx={{ mr: "auto", fontWeight: 500 }}>{review.reviewerEmail}</Typography>
                    <Chip size="small" label={`Rating: ${review.reviewRating ?? ""}`} />
                    <Tooltip title="Copy review">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyReview(review);
                        }}
                      >
                        <CopyIcon size={14} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <ParCommentView html={decodeParComment(review.reviewComment)} />
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        )}
      </AccordionDetails>
    </Accordion>
  );
}
