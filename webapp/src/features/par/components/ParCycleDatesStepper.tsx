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

import { Avatar, Box, Typography } from "@wso2/oxygen-ui";
import { CheckIcon } from "@wso2/oxygen-ui-icons-react";
import { formatShortDate } from "../util/parDate";
import { isDeadlinePassed } from "../util/parDeadline";
import { useParShowsPar2 } from "../api/useReview360";
import type { ParCycle } from "../api/types";

// Source's icons (MUI's CheckCircle/Circle) are solid filled shapes;
// Lucide's equivalents are stroke-only outlines. An Avatar reproduces the
// filled look, the same way ParStatusChip.tsx does for its own status dots.
function StepIcon({ isDone }: { isDone: boolean }) {
  return isDone ? (
    <Avatar sx={{ width: 24, height: 24, bgcolor: "primary.main", color: "primary.contrastText" }}>
      <CheckIcon size={16} />
    </Avatar>
  ) : (
    <Box sx={{ width: 24, height: 24, borderRadius: "50%", bgcolor: "action.disabled" }} />
  );
}

// Ports CycleDatesStepper.tsx. `activeStep` defaults to 0 — MultiTeamSummary.tsx
// opens this at 0 and never moves it; TeamSummary.tsx's own roster instead
// advances it based on which deadlines have passed (calculateCycleActiveStep)
// — the same component, two different callers, genuinely different behaviour
// in source.
//
// Built with plain flex columns rather than MUI's Stepper/StepConnector:
// their connector is absolutely positioned assuming the icon is the first
// thing in each step, which breaks once a title sits above it.
export default function ParCycleDatesStepper({
  cycle,
  activeStep = 0,
}: {
  cycle: Pick<
    ParCycle,
    | "parCycleId"
    | "parEvaluationStartDate"
    | "parEmployeeDeadline"
    | "parLeadDeadline"
    | "parLeadHardDeadline"
    | "parSpecialRatingDeadline"
    | "parEvaluationEndDate"
  >;
  /** Which of the five steps without the hard lead deadline is reached (calculateCycleActiveStep). */
  activeStep?: number;
}) {
  // A PAR 2.0 cycle also shows its hard lead deadline, right after the lead deadline.
  const { showsPar2 } = useParShowsPar2(cycle.parCycleId);
  const hardDeadline = showsPar2 ? cycle.parLeadHardDeadline : undefined;
  const steps = [
    { date: cycle.parEvaluationStartDate, label: "Start Date" },
    { date: cycle.parEmployeeDeadline, label: "Employee PAR Deadline" },
    { date: cycle.parLeadDeadline, label: "Lead's PAR Deadline" },
    ...(hardDeadline ? [{ date: hardDeadline, label: "Hard Lead Deadline" }] : []),
    { date: cycle.parSpecialRatingDeadline, label: "Top 5%/20% Rating Submission" },
    { date: cycle.parEvaluationEndDate, label: "End Date" },
  ];
  // The steps after the lead deadline move one along; the hard lead deadline's is reached once it has passed.
  const reached =
    hardDeadline === undefined || activeStep < 2
      ? activeStep
      : activeStep > 2
        ? activeStep + 1
        : isDeadlinePassed(hardDeadline)
          ? 3
          : 2;

  return (
    <Box sx={{ display: "flex" }}>
      {steps.map((step, index) => {
        const isDone = index <= reached;
        return (
          <Box key={step.label} sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", px: 1 }}>
            {/* Two lines tall, text at the bottom, so a label that wraps doesn't push its dot out of line. */}
            <Typography
              variant="caption"
              color="text.secondary"
              align="center"
              sx={{ mb: 1, minHeight: "3.32em", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
            >
              {step.label}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", width: "100%" }}>
              <Box sx={{ flex: 1, height: 2, bgcolor: index === 0 ? "transparent" : isDone ? "primary.main" : "divider" }} />
              <StepIcon isDone={isDone} />
              <Box
                sx={{
                  flex: 1,
                  height: 2,
                  bgcolor: index === steps.length - 1 ? "transparent" : index < reached ? "primary.main" : "divider",
                }}
              />
            </Box>
            <Typography variant="body2" align="center" sx={{ fontWeight: 600, mt: 1 }}>
              {step.date ? formatShortDate(step.date) : "—"}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
