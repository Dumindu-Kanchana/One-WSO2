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
import { Box, Button, Card, Typography, type SxProps, type Theme } from "@wso2/oxygen-ui";
import { cycleSurvey, useLeadership360Results, useLeadership360Surveys } from "../api/useLeadership360";
import Leadership360SummaryDialog from "./Leadership360SummaryDialog";

// One leader's Leadership 360° results in one PAR cycle's survey (live while
// it's open): your own (view SELF), or a report's in the lead's review (view
// REPORTS, which adds named responses). Renders `fallback` when there's
// nothing to show: the person isn't in the leadership team, or the cycle has
// no survey.
export default function Leadership360ResultsCard({
  view,
  leaderEmail,
  parCycleId,
  fallback = null,
  sx,
}: {
  view: "SELF" | "REPORTS";
  /** REPORTS only: the report whose results to show. */
  leaderEmail?: string;
  /** The PAR cycle whose survey to show. */
  parCycleId: number;
  fallback?: ReactNode;
  sx?: SxProps<Theme>;
}) {
  const surveys = useLeadership360Surveys();
  const survey = cycleSurvey(surveys.data, parCycleId);
  const results = useLeadership360Results(survey?.surveyId, view);
  const [viewing, setViewing] = useState(false);

  if (surveys.isLoading || results.isLoading) return null;
  const entry =
    view === "SELF"
      ? results.data?.[0]
      : results.data?.find((r) => r.leader.workEmail.toLowerCase() === leaderEmail?.toLowerCase());
  if (!entry || !survey) return <>{fallback}</>;
  const live = survey.status === "OPEN";
  const responses = `${entry.responseCount} ${entry.responseCount === 1 ? "response" : "responses"}`;

  return (
    <Card variant="outlined" sx={[{ p: 2 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
        <Typography sx={{ fontWeight: 600 }}>
          {view === "SELF" ? "Your Leadership 360° results" : "Leadership 360° results"}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {survey.surveyName}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
        {live
          ? "Updates as feedback comes in, once 3 or more people have responded."
          : "Results from a survey that has closed."}
        {view === "REPORTS" &&
          " As their manager you also see named responses in full; anonymous ones only count toward the averages."}
      </Typography>
      {entry.available ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="body2">{responses}</Typography>
          <Button size="small" variant="outlined" onClick={() => setViewing(true)}>
            View results
          </Button>
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {responses} so far{live ? "; results show from 3." : "; fewer than 3, so no results."}
        </Typography>
      )}
      {viewing && (
        <Leadership360SummaryDialog
          open
          onClose={() => setViewing(false)}
          surveyId={survey.surveyId}
          view={view}
          leader={entry.leader}
        />
      )}
    </Card>
  );
}
