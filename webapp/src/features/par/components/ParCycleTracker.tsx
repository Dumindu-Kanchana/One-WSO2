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
import { Box, ButtonBase, Card, Chip, Skeleton, Tooltip, Typography, type Theme } from "@wso2/oxygen-ui";
import {
  ArrowRightIcon,
  CheckIcon,
  CircleCheckIcon,
  CircleMinusIcon,
  ClockIcon,
  LockIcon,
  PencilIcon,
} from "@wso2/oxygen-ui-icons-react";
import { isPreviewEnabled } from "@config/previewFeatures";
import { useParRating } from "../api/useParData";
import { useParticipants, useReviewers, useReviewRequests } from "../api/usePar360";
import { useSelfReview } from "../api/useSelfReview";
import { cycleSurvey, useLeadership360Results, useLeadership360Surveys } from "../api/useLeadership360";
import type { ParCycle } from "../api/types";
import { formatShortDate } from "../util/parDate";
import { isSectionAnswered } from "../util/selfReviewForm";
import { homeSteps, nextUp, type HomeStep, type HomeStepKey, type NextUp } from "../util/parHome";
import ParDueChip from "./ParDueChip";

// Where each step opens in Active cycle. The lead review only shows where it stands: once the lead
// shares, their review is on the self-review page.
const STEP_SEGMENT: Partial<Record<HomeStepKey, string>> = {
  "self-review": "cycle/self-review",
  "360": "cycle/360",
  f2f: "cycle/f2f",
};

// PAR 2.0, at the top of Active cycle: where you are in the cycle and the one thing to do next.
// The steps are how you move around Active cycle: each opens its part below (all but the lead
// review), and the one open is outlined.
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
  // The lead's name for the steps that wait on them: the cycle's people include them.
  const participants = useParticipants(cycle.parCycleId);
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
    // First name only: the steps are narrow.
    leadName: participants.data
      ?.find((p) => p.workEmail.toLowerCase() === rating.data!.parLeadEmail?.toLowerCase())
      ?.employeeName.split(" ")[0],
  };
  const steps = homeSteps(input);
  const next = nextUp(input);
  const go = (segment: string) => navigate(`/me/performance/${segment}`);

  return (
    <Card variant="outlined" sx={{ p: 1.5 }}>
      <Chip label={cycle.parCycleName} size="small" color="primary" variant="outlined" sx={{ mb: 1.5, fontWeight: 600 }} />
      <Box
        component="ol"
        aria-label="Your PAR cycle"
        sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(4, 1fr)" }, gap: 1, m: 0, p: 0 }}
      >
        {steps.map((step, i) => {
          const segment = STEP_SEGMENT[step.key];
          return (
            <TrackerStep
              key={step.key}
              step={step}
              number={i + 1}
              selected={step.key === selected}
              onOpen={segment ? () => go(segment) : undefined}
            />
          );
        })}
      </Box>
      <NextCard next={next} />
    </Card>
  );
}

// One step: an outlined box, the same size as the others and clickable all over. Without
// `onOpen` it only shows where it stands.
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
  const green = step.status === "done" || step.status === "enough";
  const yours = step.status === "todo";
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
          // The number follows whose move it is: orange only when it's the employee's.
          bgcolor: green ? "success.main" : yours ? "primary.main" : "action.selected",
          color: green || yours ? "common.white" : "text.secondary",
        }}
      >
        {number}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        {/* The chip goes under the name when the step is too narrow for both. */}
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            columnGap: 1,
            rowGap: 0.5,
          }}
        >
          <Typography
            variant="body2"
            component="div"
            sx={{ fontWeight: current ? 700 : 600, color: done || current ? "text.primary" : "text.secondary" }}
          >
            {step.label}
          </Typography>
          <StepStatusChip step={step} />
        </Box>
        {step.detail && (
          <Typography variant="caption" color="text.secondary" component="div">
            {step.detail}
          </Typography>
        )}
        {step.due &&
          !done &&
          // The employee's own deadline says how long is left; someone else's is just a date.
          (step.dueLabel ? (
            <Chip
              size="small"
              variant="outlined"
              label={`${step.dueLabel} ${formatShortDate(step.due)}`}
              sx={{ mt: 0.5, height: 20, fontSize: 11 }}
            />
          ) : (
            <ParDueChip due={step.due} sx={{ mt: 0.5, height: 20, fontSize: 11 }} />
          ))}
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

// Why a step closed. The lead review never does: its deadline is the lead's.
const CLOSED_NOTE: Partial<Record<HomeStepKey, string>> = {
  "self-review": "The deadline passed before it was shared, so it's locked.",
  "360": "The 360° window closed without enough feedback for results.",
  f2f: "The deadline passed before it was marked done, so it's locked.",
};

// Whose move the step is, with a colour and icon each: yours in the main colour, done in green,
// someone else's or not open yet in grey. All outlined, so the colour stays in the border.
function StepStatusChip({ step }: { step: HomeStep }) {
  const sx = { height: 20, fontSize: 11, flexShrink: 0, "& .MuiChip-icon": { ml: 0.75, mr: -0.25 } } as const;
  switch (step.status) {
    case "done":
      return <Chip size="small" color="success" variant="outlined" icon={<CheckIcon size={12} />} label="Done" sx={sx} />;
    case "enough":
      return (
        <Tooltip title={step.due ? `Enough for results. More can still come in until ${formatShortDate(step.due)}.` : ""}>
          <Chip size="small" color="success" variant="outlined" icon={<CheckIcon size={12} />} label="Minimum met" sx={sx} />
        </Tooltip>
      );
    case "todo":
      return <Chip size="small" color="primary" variant="outlined" icon={<PencilIcon size={12} />} label="To do" sx={sx} />;
    case "waiting":
      return (
        <Tooltip title={step.waitingOn ? `Waiting on ${step.waitingOn}` : ""}>
          <Chip size="small" variant="outlined" icon={<ClockIcon size={12} />} label="Waiting" sx={sx} />
        </Tooltip>
      );
    case "closed":
      return (
        <Tooltip title={CLOSED_NOTE[step.key] ?? ""}>
          <Chip
            size="small"
            variant="outlined"
            icon={<CircleMinusIcon size={12} />}
            label="Closed"
            sx={{ ...sx, color: "text.secondary" }}
          />
        </Tooltip>
      );
    case "locked":
      return <Chip size="small" variant="outlined" icon={<LockIcon size={12} />} label="Not yet" sx={{ ...sx, color: "text.secondary" }} />;
  }
}

// The one thing to do next, set apart under the steps: tinted in the main colour when it's the
// employee's move, grey while it's someone else's, green when everything's done. A thing to do
// with a deadline says how long is left, amber in the last three days.
// No button: the steps above open each part.
function NextCard({ next }: { next: NextUp }) {
  const tint = next.tone === "todo" ? "primary.main" : next.tone === "done" ? "success.main" : "text.secondary";
  const Icon = next.tone === "todo" ? ArrowRightIcon : next.tone === "done" ? CircleCheckIcon : ClockIcon;
  return (
    <Box
      sx={{
        mt: 1.5,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 1.5,
        py: 1.25,
        borderRadius: 1.5,
        borderLeft: 3,
        borderColor: tint,
        bgcolor: (theme: Theme) =>
          next.tone === "waiting"
            ? theme.palette.action.hover
            : `color-mix(in srgb, ${next.tone === "todo" ? theme.palette.primary.main : theme.palette.success.main} 8%, transparent)`,
      }}
    >
      <Box aria-hidden sx={{ color: tint, display: "flex", flexShrink: 0 }}>
        <Icon size={18} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {next.title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {next.body}
        </Typography>
      </Box>
      {next.tone === "todo" && next.due && <ParDueChip due={next.due} daysOnly sx={{ flexShrink: 0 }} />}
    </Box>
  );
}
