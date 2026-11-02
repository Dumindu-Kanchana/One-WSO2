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

import { useState, type ReactNode } from "react";
import { Alert, Box, Button, Card, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import { PlusIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useParEmployeeInfo, useParRating } from "../api/useParData";
import { useRequestReviewers, useReviewers } from "../api/usePar360";
import { useReviewSummary } from "../api/useReview360";
import { MAX_360_REVIEWERS, MIN_360_RESPONSES } from "../api/review360Types";
import type { ParCycle } from "../api/types";
import { Par360RequestPicker } from "./Par360RequestDialog";
import Par360SummaryView from "./Par360SummaryView";
import ParEmptyState from "./ParEmptyState";
import { PersonRow, StatusChip } from "./Par360PeopleRows";
import { formatShortDate } from "../util/parDate";
import { isDeadlinePassed } from "../util/parDeadline";
import { feedbackProgress } from "../util/parHome";

// Your own PAR 360° feedback in a PAR 2.0 cycle: your anonymised summary, shown
// only once your lead shares your PAR, and the people you asked (who responded,
// never what they wrote), with Ask for feedback. `afterSummary` goes between
// the two (a leader's Leadership 360° results, when there are any).
export default function Par360AboutMe({
  cycle,
  workEmail,
  afterSummary,
}: {
  cycle: ParCycle;
  workEmail: string;
  afterSummary?: ReactNode;
}) {
  const leadEmail = useParEmployeeInfo(workEmail).data?.leadEmail ?? undefined;
  const rating = useParRating(cycle.parCycleId, workEmail);
  const reviewers = useReviewers(cycle.parCycleId, workEmail);
  const requestReviewers = useRequestReviewers(cycle.parCycleId, workEmail);
  const leadShared = rating.data?.parLeadStatus === "SHARED";
  const summary = useReviewSummary(cycle.parCycleId, workEmail, leadShared);
  const [adding, setAdding] = useState(false);

  const list = reviewers.data ?? [];
  const { asked, responded, declined } = feedbackProgress(list);
  const deadlinePassed = isDeadlinePassed(cycle.parThreeSixtyRatingDeadline);
  const full = asked >= MAX_360_REVIEWERS;
  const blocked = deadlinePassed || leadShared || full;

  return (
    <Stack spacing={2}>
      {/* Nothing to show before the lead shares the PAR, so no placeholder either. */}
      {leadShared && (
        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography sx={{ fontWeight: 600 }}>Your 360° summary</Typography>
          {summary.isLoading ? (
            <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 1, mt: 1 }} />
          ) : summary.data?.available ? (
            <Box sx={{ mt: 1.5 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Averages and comments from everyone who responded. Names are left out and comments are sorted, so
                none of it points to one person.
              </Typography>
              <Par360SummaryView
                definition={summary.data.template.definition}
                responseCount={summary.data.responseCount}
                index={summary.data.index}
                questionAverages={summary.data.questionAverages}
                comments={summary.data.comments}
              />
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {summary.data?.reason ?? "There's no summary for this cycle."}
            </Typography>
          )}
        </Card>
      )}
      {afterSummary}

      <Card variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2, flexWrap: "wrap" }}>
          <Box>
            <Typography sx={{ fontWeight: 600 }}>People you asked</Typography>
            <Typography variant="body2" color="text.secondary">
              {asked === 0
                ? `Ask ${MIN_360_RESPONSES} to ${MAX_360_REVIEWERS} people who worked closely with you this cycle.`
                : `${responded} of ${asked} responded${declined ? `, ${declined} declined` : ""}. You see who responded, never what they wrote.`}{" "}
              {!deadlinePassed && !leadShared && `Due ${formatShortDate(cycle.parThreeSixtyRatingDeadline)}.`}
            </Typography>
          </Box>
          {!adding && (
            <Button
              variant="contained"
              startIcon={<PlusIcon size={16} />}
              disabled={blocked}
              onClick={() => setAdding(true)}
            >
              Ask for feedback
            </Button>
          )}
        </Box>
        {leadShared && (
          <Alert severity="info" sx={{ mt: 1.5 }}>
            Your lead has shared your PAR, so no more feedback can be requested.
          </Alert>
        )}
        {full && !leadShared && (
          <Typography variant="caption" color="text.secondary">
            You've asked {MAX_360_REVIEWERS} people, the most for one cycle.
          </Typography>
        )}
        {adding && (
          <Box sx={{ mt: 2 }}>
            <Par360RequestPicker
              open={adding}
              selfEmail={workEmail}
              leadEmail={leadEmail}
              existingEmails={list.map((r) => r.reviewerEmail)}
              onSubmit={(emails) => requestReviewers.mutate(emails, { onSuccess: () => setAdding(false) })}
              onCancel={() => setAdding(false)}
              isSubmitting={requestReviewers.isPending}
              error={requestReviewers.error ?? undefined}
            />
          </Box>
        )}
        <Box sx={{ mt: 2 }}>
          {reviewers.isLoading ? (
            <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />
          ) : reviewers.isError ? (
            <ErrorNotice error={reviewers.error} onRetry={() => reviewers.refetch()} retrying={reviewers.isFetching}>
              Couldn't load your reviewers.
            </ErrorNotice>
          ) : list.length === 0 ? (
            <ParEmptyState text="You haven't asked anyone yet" />
          ) : (
            <Stack divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />}>
              {list.map((r) => (
                <PersonRow key={r.reviewerEmail} name={r.reviewerName} email={r.reviewerEmail}>
                  <StatusChip status={r.reviewStatus} />
                </PersonRow>
              ))}
            </Stack>
          )}
        </Box>
      </Card>
    </Stack>
  );
}

