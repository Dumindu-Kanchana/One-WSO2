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
import { Alert, Box, Card, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useParEmployeeInfo, useParRating } from "../api/useParData";
import { useRequestReviewers, useReviewers } from "../api/usePar360";
import { useReviewSummary } from "../api/useReview360";
import { MIN_360_RESPONSES, relationshipLabel } from "../api/review360Types";
import type { ParCycle } from "../api/types";
import { Par360RequestPicker } from "./Par360RequestDialog";
import Par360SummaryView from "./Par360SummaryView";
import ParEmptyState from "./ParEmptyState";
import { PersonRow, StatusChip } from "./Par360PeopleRows";
import { isDeadlinePassed } from "../util/parDeadline";
import { feedbackProgress } from "../util/parHome";
import ParDueChip from "./ParDueChip";

// Your own PAR 360° feedback in a PAR 2.0 cycle: your anonymised summary
// (averages only), shown only once your lead shares your PAR, and everyone
// asked for feedback on you, by you or your lead, without saying who asked
// (who submitted, never what they wrote). While feedback can still be asked
// for, the calendar suggestions and the people search are always open above
// that list. Feedback offered unasked goes to
// your lead alone. `afterSummary` goes between
// the two (a leader's Leadership 360° results, when there are any). A member of
// the leadership team has no PAR 360° summary: the people they ask answer in
// Leadership 360°, which can be anonymous, so only declines show.
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
  const leader = Boolean(rating.data?.parIsLeadershipEmployee);
  const summary = useReviewSummary(cycle.parCycleId, workEmail, leadShared && !leader);
  // A new picker, empty, once a request goes through.
  const [requestsSent, setRequestsSent] = useState(0);

  const list = reviewers.data ?? [];
  const { asked, responded, declined } = feedbackProgress(list);
  const deadlinePassed = isDeadlinePassed(cycle.parThreeSixtyRatingDeadline);
  const blocked = deadlinePassed || leadShared;

  return (
    <Stack spacing={2}>
      {/* Nothing to show before the lead shares the PAR, so no placeholder either. */}
      {leadShared && !leader && (
        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography sx={{ fontWeight: 600 }}>Your PAR 360° results</Typography>
          {summary.isLoading ? (
            <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 1, mt: 1 }} />
          ) : summary.data?.available ? (
            <Box sx={{ mt: 1.5 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Averages from everyone who submitted, without names. Written feedback goes to your lead.
              </Typography>
              <Par360SummaryView
                definition={summary.data.template.definition}
                index={summary.data.index}
                questionAverages={summary.data.questionAverages}
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
        <Box sx={{ display: "flex", alignItems: "center", columnGap: 1.5, rowGap: 0.5, flexWrap: "wrap" }}>
          <Typography sx={{ fontWeight: 600 }}>Feedback requests</Typography>
          <Typography variant="body2" color="text.secondary">
            {leader
              ? asked === 0
                ? "Request Leadership 360° feedback from people who work closely with you. Anyone can also give it unrequested."
                : `${asked} requested${declined ? `, ${declined} declined` : ""}. They can answer anonymously, so you don't see who submitted.`
              : asked === 0
                ? `Request feedback from at least ${MIN_360_RESPONSES} people who worked closely with you this cycle.`
                : `${responded} of ${asked} submitted${declined ? `, ${declined} declined` : ""}.`}
          </Typography>
          {!deadlinePassed && !leadShared && (
            <ParDueChip due={cycle.parThreeSixtyRatingDeadline} />
          )}
        </Box>
        {leadShared && (
          <Alert severity="info" sx={{ mt: 1.5 }}>
            Your lead has shared your PAR, so no more feedback can be requested.
          </Alert>
        )}
        {!blocked && (
          <Box sx={{ mt: 2 }}>
            <Par360RequestPicker
              key={requestsSent}
              open
              selfEmail={workEmail}
              leadEmail={leadEmail}
              existingEmails={list.map((r) => r.reviewerEmail)}
              onSubmit={(reviewerEmails, relationships) =>
                requestReviewers.mutate(
                  { reviewerEmails, relationships },
                  { onSuccess: () => setRequestsSent((n) => n + 1) },
                )
              }
              isSubmitting={requestReviewers.isPending}
              error={requestReviewers.error ?? undefined}
              parCycleId={cycle.parCycleId}
              askRelationship={!leader}
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
            <ParEmptyState text="You haven't requested feedback from anyone yet" />
          ) : (
            <Stack divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />}>
              {list.map((r) => (
                <PersonRow key={r.reviewerEmail} name={r.reviewerName} email={r.reviewerEmail} note={relationshipLabel(r.relationship)}>
                  <StatusChip status={r.reviewStatus} leadership={leader} />
                </PersonRow>
              ))}
            </Stack>
          )}
        </Box>
      </Card>
    </Stack>
  );
}
