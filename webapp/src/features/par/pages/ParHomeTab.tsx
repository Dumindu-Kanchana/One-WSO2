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
import { useNavigate } from "react-router";
import { Alert, Box, Button, Card, Chip, LinearProgress, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import { ArrowRightIcon, CircleCheckIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { isPreviewEnabled } from "@config/previewFeatures";
import { useMeProfile } from "@features/my/api/useMeProfile";
import { useActiveParCycle, useParRating } from "../api/useParData";
import { useReviewers, useReviewRequests } from "../api/usePar360";
import { useSelfReview } from "../api/useSelfReview";
import { useCurrentLeadership360Survey } from "../api/useLeadership360";
import { MIN_360_RESPONSES } from "../api/review360Types";
import type { Par360ReviewRequest } from "../api/types";
import Par360FeedbackDialog from "../components/Par360FeedbackDialog";
import { ParOkrCard } from "../components/ParOkrPanel";
import { formatShortDate } from "../util/parDate";
import { isSectionAnswered } from "../util/selfReviewForm";
import { feedbackProgress, homeSteps, nextUp, openRequests, type HomeStep } from "../util/parHome";

// PAR 2.0 Home: one place to start. Where you are in the cycle, the one thing
// to do next, and below it the feedback others are waiting on from you and
// how your own 360° is going.
export default function ParHomeTab() {
  const navigate = useNavigate();
  const profile = useMeProfile();
  const workEmail = profile.data?.userInfo.workEmail;
  const activeCycles = useActiveParCycle(workEmail);
  const cycle = activeCycles.data?.[0];
  const rating = useParRating(cycle?.parCycleId, workEmail);
  const selfReview = useSelfReview(cycle?.parCycleId, workEmail);
  const reviewers = useReviewers(cycle?.parCycleId, workEmail);
  const requests = useReviewRequests(cycle?.parCycleId, workEmail);
  const survey = useCurrentLeadership360Survey();
  const [giving, setGiving] = useState<Par360ReviewRequest | null>(null);

  if (profile.isLoading || activeCycles.isLoading || rating.isLoading) {
    return <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 1.5, maxWidth: 1100 }} />;
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

  const definition = selfReview.data?.template.definition;
  const selfReviewProgress = definition && {
    answered: definition.sections.filter((s) => isSectionAnswered(s, selfReview.data!.answers)).length,
    total: definition.sections.length,
  };
  const input = {
    cycle,
    rating: rating.data,
    selfReviewProgress,
    reviewers: reviewers.data ?? [],
    requests: requests.data ?? [],
  };
  const steps = homeSteps(input);
  const next = nextUp(input);
  const waiting = openRequests(requests.data ?? []);
  const { asked, responded, declined } = feedbackProgress(reviewers.data ?? []);
  const go = (segment: string) => navigate(`/me/performance/${segment}`);

  return (
    <Stack spacing={2} sx={{ maxWidth: 1100, pt: 0.5 }}>
      <Card variant="outlined" sx={{ p: 2 }}>
        <Box
          component="ol"
          aria-label="Your PAR cycle"
          sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(5, 1fr)" }, gap: 1.5, m: 0, p: 0 }}
        >
          {steps.map((step, i) => (
            <TrackerStep key={step.key} step={step} number={i + 1} />
          ))}
        </Box>
      </Card>

      <Card variant="outlined" sx={{ p: 2.5, borderColor: "primary.main", borderWidth: 1.5 }}>
        <Typography variant="overline" color="primary" sx={{ fontWeight: 700, letterSpacing: 1 }}>
          Next up
        </Typography>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {next.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {next.body}
            </Typography>
          </Box>
          {next.action && (
            <Button variant="contained" endIcon={<ArrowRightIcon size={16} />} onClick={() => go(next.action!.segment)}>
              {next.action.label}
            </Button>
          )}
        </Box>
      </Card>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2, alignItems: "start" }}>
        <Card variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 1 }}>
            <Typography sx={{ fontWeight: 600 }}>Feedback requested from you</Typography>
            <Button size="small" onClick={() => go("360?view=requests")}>
              All requests
            </Button>
          </Box>
          {requests.isLoading ? (
            <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 1 }} />
          ) : waiting.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No one is waiting on your feedback.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {waiting.slice(0, 4).map((r) => (
                <Box key={r.employeeEmail} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                      {r.employeeName ?? r.employeeEmail}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {r.reviewStatus === "DRAFT" ? "Draft saved" : "Not started"} · due{" "}
                      {formatShortDate(cycle.parThreeSixtyRatingDeadline)}
                    </Typography>
                  </Box>
                  <Button size="small" variant="outlined" onClick={() => setGiving(r)}>
                    {r.reviewStatus === "DRAFT" ? "Continue" : "Give feedback"}
                  </Button>
                </Box>
              ))}
              {waiting.length > 4 && (
                <Typography variant="caption" color="text.secondary">
                  and {waiting.length - 4} more
                </Typography>
              )}
            </Stack>
          )}
        </Card>

        <Card variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 1 }}>
            <Typography sx={{ fontWeight: 600 }}>Your 360° feedback</Typography>
            <Button size="small" onClick={() => go("360")}>
              Open
            </Button>
          </Box>
          {reviewers.isLoading ? (
            <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 1 }} />
          ) : (
            <>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {responded}
                <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.75 }}>
                  of {asked} responded{declined ? ` · ${declined} declined` : ""}
                </Typography>
              </Typography>
              <LinearProgress
                variant="determinate"
                value={asked === 0 ? 0 : Math.min(100, (responded / Math.max(asked, MIN_360_RESPONSES)) * 100)}
                aria-label={`${responded} of ${asked} responded`}
                sx={{ height: 6, borderRadius: 3, my: 1 }}
              />
              <Typography variant="body2" color="text.secondary">
                {responded < MIN_360_RESPONSES
                  ? `A summary needs at least ${MIN_360_RESPONSES} responses, so no one can be singled out.`
                  : rating.data.parLeadStatus === "SHARED"
                    ? "Your anonymised summary is ready."
                    : "Enough responses for an anonymised summary once your lead shares your PAR."}
              </Typography>
            </>
          )}
        </Card>
      </Box>

      <ParOkrCard ownerEmail={workEmail} cycleEndDate={cycle.parCycleEndDate} showKeyResults={false} />

      {isPreviewEnabled("leadership360") && survey.data && (
        <Card variant="outlined" sx={{ p: 2, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600 }}>Leadership 360° is open</Typography>
            <Typography variant="body2" color="text.secondary">
              Give feedback on leaders you've worked with, until {formatShortDate(survey.data.survey.endDate)}. You
              can stay anonymous.
            </Typography>
          </Box>
          <Button size="small" onClick={() => go("leadership-360")}>
            Give feedback
          </Button>
        </Card>
      )}

      {giving && (
        <Par360FeedbackDialog
          open
          onClose={() => setGiving(null)}
          parCycleId={cycle.parCycleId}
          employeeEmail={giving.employeeEmail}
          employeeName={giving.employeeName ?? giving.employeeEmail}
          deadline={cycle.parThreeSixtyRatingDeadline}
        />
      )}
    </Stack>
  );
}

function TrackerStep({ step, number }: { step: HomeStep; number: number }) {
  const done = step.state === "done";
  const current = step.state === "current";
  return (
    <Box component="li" sx={{ listStyle: "none", display: "flex", gap: 1.25, alignItems: "flex-start" }}>
      <Box
        aria-hidden
        sx={{
          width: 28,
          height: 28,
          flexShrink: 0,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 700,
          bgcolor: done ? "success.main" : current ? "primary.main" : "action.selected",
          color: done || current ? "common.white" : "text.secondary",
        }}
      >
        {done ? <CircleCheckIcon size={16} /> : number}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: current ? 700 : 600, color: done || current ? "text.primary" : "text.secondary" }}>
          {step.label}
          <Box component="span" sx={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
            {done ? " (done)" : current ? " (current step)" : ""}
          </Box>
        </Typography>
        {step.detail && (
          <Typography variant="caption" color="text.secondary" component="div">
            {step.detail}
          </Typography>
        )}
        {step.due && !done && (
          <Chip
            size="small"
            variant="outlined"
            label={`Due ${formatShortDate(step.due)}`}
            sx={{ mt: 0.5, height: 20, fontSize: 11 }}
          />
        )}
      </Box>
    </Box>
  );
}
