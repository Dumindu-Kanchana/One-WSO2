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

import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { Box, ButtonBase, Card, Chip, Skeleton, Typography, type Theme } from "@wso2/oxygen-ui";
import { isPreviewEnabled } from "@config/previewFeatures";
import { useParRating } from "../api/useParData";
import { useReviewers, useReviewRequests } from "../api/usePar360";
import { useSelfReview } from "../api/useSelfReview";
import { cycleSurvey, useLeadership360Results, useLeadership360Surveys } from "../api/useLeadership360";
import type { ParCycle } from "../api/types";
import { formatShortDate } from "../util/parDate";
import { isSectionAnswered } from "../util/selfReviewForm";
import { homeSteps, nextUp, type HomeStep, type HomeStepKey } from "../util/parHome";

// Where each step opens in Active cycle. The lead's review shows on the self-review page once the
// lead shares; until then that step has nothing to open.
const STEP_SEGMENT: Record<HomeStepKey, string> = {
  "self-review": "cycle/self-review",
  "360": "cycle/360",
  "lead-review": "cycle/lead-review",
  f2f: "cycle/f2f",
};

// PAR 2.0, at the top of Active cycle: where you are in the cycle and the one thing to do next.
// The steps are how you move around Active cycle: each opens its part below, and the one open is
// outlined.
export default function ParCycleTracker({
  cycle,
  workEmail,
  selected,
}: {
  cycle: ParCycle;
  workEmail: string;
  /** The step whose part is open below. */
  selected?: HomeStepKey;
}) {
  const navigate = useNavigate();
  const rating = useParRating(cycle.parCycleId, workEmail);
  const selfReview = useSelfReview(cycle.parCycleId, workEmail);
  const reviewers = useReviewers(cycle.parCycleId, workEmail);
  const requests = useReviewRequests(cycle.parCycleId, workEmail);
  // A leader's 360° feedback is Leadership 360°: what counts is how many responded to the cycle's survey.
  const leader = Boolean(rating.data?.parIsLeadershipEmployee) && isPreviewEnabled("leadership360");
  const surveys = useLeadership360Surveys(leader);
  const leadershipResults = useLeadership360Results(
    leader ? cycleSurvey(surveys.data, cycle.parCycleId)?.surveyId : undefined,
    "SELF",
  );

  if (rating.isLoading) return <Skeleton variant="rectangular" height={132} sx={{ borderRadius: 1.5 }} />;
  // Without the PAR record there's nothing to track; the page says why.
  if (!rating.data) return null;

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
    leadership: leader ? { responseCount: leadershipResults.data?.[0]?.responseCount ?? 0 } : undefined,
  };
  const steps = homeSteps(input);
  const next = nextUp(input);
  const go = (segment: string) => navigate(`/me/performance/${segment}`);
  const leadShared = rating.data.parLeadStatus === "SHARED";

  return (
    <Card variant="outlined" sx={{ p: 1.5 }}>
      <Chip label={cycle.parCycleName} size="small" color="primary" variant="outlined" sx={{ mb: 1.5, fontWeight: 600 }} />
      <Box
        component="ol"
        aria-label="Your PAR cycle"
        sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(4, 1fr)" }, gap: 1, m: 0, p: 0 }}
      >
        {steps.map((step, i) => (
          <TrackerStep
            key={step.key}
            step={step}
            number={i + 1}
            selected={step.key === selected}
            onOpen={
              step.key === "lead-review"
                ? leadShared
                  ? () => go(STEP_SEGMENT[step.key])
                  : undefined
                : () => go(STEP_SEGMENT[step.key])
            }
          />
        ))}
      </Box>
      <Typography variant="body2" sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: "divider" }}>
        <Box component="span" sx={{ fontWeight: 700, color: "primary.main" }}>
          Next:
        </Box>{" "}
        <Box component="span" sx={{ fontWeight: 600 }}>
          {next.title}.
        </Box>{" "}
        <Box component="span" sx={{ color: "text.secondary" }}>
          {next.body}
        </Box>
      </Typography>
    </Card>
  );
}

// One step: an outlined box, the same size as the others and clickable all over. Without
// `onOpen` it has nothing to open yet.
function TrackerStep({
  step,
  number,
  selected,
  onOpen,
}: {
  step: HomeStep;
  number: number;
  selected: boolean;
  onOpen?: () => void;
}) {
  const done = step.state === "done";
  const current = step.state === "current";
  const box = {
    flex: 1,
    display: "flex",
    gap: 1.25,
    alignItems: "flex-start",
    justifyContent: "flex-start",
    textAlign: "left",
    p: 1.25,
    border: 1,
    borderColor: selected ? "primary.main" : "divider",
    borderRadius: 1.5,
    // A second pixel of outline for the open step, without moving its content.
    boxShadow: (theme: Theme) => (selected ? `inset 0 0 0 1px ${theme.palette.primary.main}` : "none"),
  } as const;
  const content: ReactNode = (
    <>
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
        {number}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
          <Typography
            variant="body2"
            component="div"
            sx={{ fontWeight: current ? 700 : 600, color: done || current ? "text.primary" : "text.secondary" }}
          >
            {step.label}
          </Typography>
          {done ? (
            <Chip size="small" color="success" label="Completed" sx={{ height: 20, fontSize: 11 }} />
          ) : (
            <Chip size="small" color="warning" label="Pending" sx={{ height: 20, fontSize: 11 }} />
          )}
        </Box>
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
    </>
  );
  return (
    <Box component="li" sx={{ listStyle: "none", display: "flex" }}>
      {onOpen ? (
        <ButtonBase
          onClick={onOpen}
          aria-current={selected ? "page" : current ? "step" : undefined}
          sx={{ ...box, "&:hover": { bgcolor: "action.hover" } }}
        >
          {content}
        </ButtonBase>
      ) : (
        <Box aria-current={current ? "step" : undefined} sx={box}>
          {content}
        </Box>
      )}
    </Box>
  );
}
