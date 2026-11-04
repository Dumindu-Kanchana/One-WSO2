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
import {
  Button,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useLeadership360Results, useLeadership360Surveys } from "../api/useLeadership360";
import { useParCyclesByStatus } from "../api/useParAdmin";
import type { Leadership360Leader, Leadership360SurveyStatus } from "../api/leadership360Types";
import Leadership360SummaryDialog from "../components/Leadership360SummaryDialog";
import { formatShortDate } from "../util/parDate";
import { isDeadlinePassed } from "../util/parDeadline";

const STATUS_CHIP: Record<Leadership360SurveyStatus, { label: string; color: "default" | "success" | "info" }> = {
  UPCOMING: { label: "Upcoming", color: "info" },
  OPEN: { label: "Open", color: "success" },
  CLOSED: { label: "Closed", color: "default" },
};

// PAR Admin View → 360° feedback: both kinds in one list. PAR 360° runs
// inside each open cycle (followed up in Ongoing). Each PAR 2.0 cycle's
// Leadership 360° survey is created with the cycle and runs on its 360°
// dates; every leader's results are read here, live, including named
// responses and the relationship breakdown.
export default function ParAdminLeadership360Tab() {
  const navigate = useNavigate();
  const cycles = useParCyclesByStatus("OPEN");
  const surveys = useLeadership360Surveys();
  const [chosen, setChosen] = useState<number | undefined>(undefined);

  const list = surveys.data ?? [];
  const surveyId = chosen ?? (list.find((s) => s.status === "OPEN") ?? list[0])?.surveyId;

  if (surveys.isLoading) return <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />;
  if (surveys.isError) {
    return (
      <ErrorNotice error={surveys.error} onRetry={() => surveys.refetch()} retrying={surveys.isFetching}>
        Couldn't load the Leadership 360° surveys.
      </ErrorNotice>
    );
  }

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
            360° feedback
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            PAR 360° runs inside each cycle until its 360° deadline; follow it up in Ongoing. Leadership 360° runs with
            every PAR 2.0 cycle, on the same dates: anyone can give feedback on members of the leadership team, named
            any time or anonymously once a month. Results are live once 3 or more people have submitted.
          </Typography>
          {cycles.isError && (
            <ErrorNotice error={cycles.error} onRetry={() => cycles.refetch()} retrying={cycles.isFetching}>
              Couldn't load the open PAR cycles.
            </ErrorNotice>
          )}
          {list.length === 0 && (cycles.data ?? []).length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No 360° feedback yet.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Dates</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {(cycles.data ?? []).map((c) => {
                  const closed = isDeadlinePassed(c.parThreeSixtyRatingDeadline);
                  return (
                    <TableRow key={`par-${c.parCycleId}`}>
                      <TableCell>
                        <Chip size="small" variant="outlined" label="PAR" />
                      </TableCell>
                      <TableCell>{c.parCycleName}</TableCell>
                      <TableCell>
                        {formatShortDate(c.parCycleStartDate)} – {formatShortDate(c.parThreeSixtyRatingDeadline)}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={closed ? "Closed" : "Open"} color={closed ? "default" : "success"} />
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => navigate("/people-ops/performance/admin/ongoing")}>
                          Open in Ongoing
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {list.map((s) => (
                  <TableRow key={s.surveyId} selected={s.surveyId === surveyId} hover onClick={() => setChosen(s.surveyId)}>
                    <TableCell>
                      <Chip size="small" variant="outlined" label="Leadership" />
                    </TableCell>
                    <TableCell>{s.surveyName}</TableCell>
                    <TableCell>
                      {formatShortDate(s.startDate)} – {formatShortDate(s.endDate)}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={STATUS_CHIP[s.status].label} color={STATUS_CHIP[s.status].color} />
                    </TableCell>
                    <TableCell />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {surveyId !== undefined && <SurveyResponses surveyId={surveyId} />}
    </Stack>
  );
}

function SurveyResponses({ surveyId }: { surveyId: number }) {
  const results = useLeadership360Results(surveyId, "ALL");
  const [viewing, setViewing] = useState<Leadership360Leader | null>(null);

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
          Leadership 360° responses by leader
        </Typography>
        {results.isLoading ? (
          <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1 }} />
        ) : results.isError ? (
          <ErrorNotice error={results.error} onRetry={() => results.refetch()} retrying={results.isFetching}>
            Couldn't load the responses.
          </ErrorNotice>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Leader</TableCell>
                <TableCell>Role</TableCell>
                <TableCell align="right">Responses</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {(results.data ?? []).map((entry) => (
                <TableRow key={entry.leader.workEmail}>
                  <TableCell>{entry.leader.employeeName}</TableCell>
                  <TableCell>{entry.leader.jobRole ?? "—"}</TableCell>
                  <TableCell align="right">{entry.responseCount}</TableCell>
                  <TableCell align="right">
                    {entry.available ? (
                      <Button size="small" onClick={() => setViewing(entry.leader)}>
                        View results
                      </Button>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Not available yet
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {viewing && (
        <Leadership360SummaryDialog
          open
          onClose={() => setViewing(null)}
          surveyId={surveyId}
          view="ALL"
          leader={viewing}
        />
      )}
    </Card>
  );
}
