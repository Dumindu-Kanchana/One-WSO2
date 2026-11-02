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

import { useNavigate } from "react-router";
import { Box, Button, ButtonBase, Card, Chip, Skeleton, Typography } from "@wso2/oxygen-ui";
import { ArrowRightIcon, CircleCheckIcon } from "@wso2/oxygen-ui-icons-react";
import { useParRating } from "../api/useParData";
import { useReviewers, useReviewRequests } from "../api/usePar360";
import { useSelfReview } from "../api/useSelfReview";
import type { ParCycle } from "../api/types";
import { formatShortDate } from "../util/parDate";
import { isSectionAnswered } from "../util/selfReviewForm";
import { homeSteps, nextUp, type HomeStep, type HomeStepKey } from "../util/parHome";

// Where each step opens in Active cycle. The lead's review and the finished PAR show on the
// self-review page, once the lead shares.
const STEP_SEGMENT: Record<HomeStepKey, string> = {
  "self-review": "cycle/self-review",
  "360": "cycle/360",
  "lead-review": "cycle/self-review",
  f2f: "cycle/f2f",
  complete: "cycle/self-review",
};

// PAR 2.0: where you are in the cycle and the one thing to do next, pinned under the page title on
// every tab. Each step opens its part of Active cycle.
export default function ParCycleTracker({ cycle, workEmail }: { cycle: ParCycle; workEmail: string }) {
  const navigate = useNavigate();
  const rating = useParRating(cycle.parCycleId, workEmail);
  const selfReview = useSelfReview(cycle.parCycleId, workEmail);
  const reviewers = useReviewers(cycle.parCycleId, workEmail);
  const requests = useReviewRequests(cycle.parCycleId, workEmail);

  if (rating.isLoading) return <Skeleton variant="rectangular" height={132} sx={{ borderRadius: 1.5, mb: 2 }} />;
  // Without the PAR record there's nothing to track; the tabs say why.
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
  };
  const steps = homeSteps(input);
  const next = nextUp(input);
  const go = (segment: string) => navigate(`/me/performance/${segment}`);

  return (
    <Card variant="outlined" sx={{ p: 1.5, mb: 2 }}>
      <Box
        component="ol"
        aria-label="Your PAR cycle"
        sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(5, 1fr)" }, gap: 1, m: 0, p: 0 }}
      >
        {steps.map((step, i) => (
          <TrackerStep key={step.key} step={step} number={i + 1} onOpen={() => go(STEP_SEGMENT[step.key])} />
        ))}
      </Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
          mt: 1.5,
          pt: 1.5,
          borderTop: 1,
          borderColor: "divider",
        }}
      >
        <Typography variant="body2" sx={{ minWidth: 0 }}>
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
        {next.action && (
          <Button
            size="small"
            variant="contained"
            endIcon={<ArrowRightIcon size={14} />}
            onClick={() => go(next.action!.segment)}
          >
            {next.action.label}
          </Button>
        )}
      </Box>
    </Card>
  );
}

function TrackerStep({ step, number, onOpen }: { step: HomeStep; number: number; onOpen: () => void }) {
  const done = step.state === "done";
  const current = step.state === "current";
  return (
    <Box component="li" sx={{ listStyle: "none" }}>
      <ButtonBase
        onClick={onOpen}
        aria-current={current ? "step" : undefined}
        sx={{
          width: "100%",
          display: "flex",
          gap: 1.25,
          alignItems: "flex-start",
          justifyContent: "flex-start",
          textAlign: "left",
          p: 0.75,
          borderRadius: 1,
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
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
          <Typography
            variant="body2"
            component="div"
            sx={{ fontWeight: current ? 700 : 600, color: done || current ? "text.primary" : "text.secondary" }}
          >
            {step.label}
            <Box
              component="span"
              sx={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}
            >
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
      </ButtonBase>
    </Box>
  );
}
