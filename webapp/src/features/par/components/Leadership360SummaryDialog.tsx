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

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Skeleton,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useLeadership360Summary, useLeadership360SurveyWithTemplate } from "../api/useLeadership360";
import type {
  FormDefinition,
  Leadership360Leader,
  Leadership360Summary,
  Leadership360View,
} from "../api/leadership360Types";
import { allQuestions, stepSections } from "../util/leadership360Form";
import { formatShortDate } from "../util/parDate";
import { formatIndex } from "../util/review360Form";
import { SummaryMetric } from "./Par360SummaryView";

// One leader's results in one survey, live while it's open, in a dialog: for
// lists of leaders (Lead View and Admin View → Leadership 360°). A single
// leader's card shows the same results in place (Leadership360Results).
export default function Leadership360SummaryDialog({
  open,
  onClose,
  surveyId,
  view,
  leader,
}: {
  open: boolean;
  onClose: () => void;
  surveyId: number;
  view: Leadership360View;
  leader: Leadership360Leader;
}) {
  const survey = useLeadership360SurveyWithTemplate(surveyId);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        Leadership 360° results: {leader.employeeName}
        {survey.data && (
          <Typography variant="body2" color="text.secondary">
            {survey.data.survey.surveyName}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers>
        <Leadership360Results surveyId={surveyId} view={view} leaderEmail={leader.workEmail} />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button size="small" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// One leader's results in one survey. What they contain depends on the view
// they're read from — the backend decides: the leader (SELF) gets averages and
// comments, with names on named comments; their manager (REPORTS) and PAR
// admins (ALL) also get named responses in full; admins also get the
// relationship breakdown. Laid out like a PAR 360° summary.
export function Leadership360Results({
  surveyId,
  view,
  leaderEmail,
}: {
  surveyId: number;
  view: Leadership360View;
  leaderEmail: string;
}) {
  const survey = useLeadership360SurveyWithTemplate(surveyId);
  const summary = useLeadership360Summary(surveyId, view, leaderEmail);
  const definition = survey.data?.template.definition;

  if (survey.isLoading || summary.isLoading) {
    return <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 1 }} />;
  }
  if (survey.isError || summary.isError) {
    return (
      <ErrorNotice
        error={summary.error ?? survey.error}
        onRetry={() => {
          void survey.refetch();
          void summary.refetch();
        }}
      >
        Couldn't load the results.
      </ErrorNotice>
    );
  }
  return summary.data && definition ? <SummaryContent summary={summary.data} definition={definition} /> : null;
}

function SummaryContent({ summary, definition }: { summary: Leadership360Summary; definition: FormDefinition }) {
  if (!summary.available) {
    return (
      <Alert severity="info">
        {summary.reason} {summary.responseCount} {summary.responseCount === 1 ? "response" : "responses"} so far.
      </Alert>
    );
  }

  const averages = new Map(summary.questionAverages.map((a) => [a.questionId, a]));
  const questionText = new Map(allQuestions(definition).map((q) => [q.id, q.text]));
  const max = Math.max(...Object.values(definition.scales).map((s) => s.max), 5);
  const choiceLabels = new Map(
    allQuestions(definition).flatMap((q) => (q.options ?? []).map((o) => [o.value, o.label] as const)),
  );
  const heading = (text: string) => (
    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
      {text}
    </Typography>
  );

  return (
    <Stack spacing={2.5}>
      <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <SummaryMetric label="Overall" value={formatIndex(summary.overallAverage)} hint={`out of ${max}`} />
        <SummaryMetric label="Responses" value={String(summary.responseCount)} />
      </Box>

      {stepSections(definition)
        .filter((s) => s.questions.some((q) => q.type === "RATING"))
        .map((section) => (
          <Box key={section.id}>
            {heading(section.title)}
            <Stack spacing={1.25}>
              {section.questions
                .filter((q) => q.type === "RATING")
                .map((q) => {
                  const average = averages.get(q.id);
                  return (
                    <Box key={q.id}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {q.text}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                          {formatIndex(average?.average)}
                          {average && (
                            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75 }}>
                              {`${average.ratingCount} rating${average.ratingCount === 1 ? "" : "s"}`}
                            </Typography>
                          )}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={average ? (average.average / max) * 100 : 0}
                        aria-label={q.text}
                        sx={{ height: 6, borderRadius: 3, mt: 0.5 }}
                      />
                    </Box>
                  );
                })}
            </Stack>
          </Box>
        ))}

      <Box>
        {heading("Comments")}
        {summary.comments.length === 0 && summary.namedComments.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No written comments.
          </Typography>
        ) : (
          <Stack spacing={0.75}>
            {summary.namedComments.map((c, i) => (
              <Comment key={`named-${i}`} text={c.comment} by={c.respondentName ?? c.respondentEmail} />
            ))}
            {summary.comments.map((comment, i) => (
              <Comment key={`anonymous-${i}`} text={comment} by="Anonymous" />
            ))}
          </Stack>
        )}
      </Box>

      {summary.relationshipCounts && (
        <Box>
          {heading("How respondents work with them")}
          {Object.entries(summary.relationshipCounts).map(([value, count]) => (
            <Typography key={value} variant="body2">
              {choiceLabels.get(value) ?? value}: {count}
            </Typography>
          ))}
        </Box>
      )}

      {summary.namedResponses && (
        <Box>
          {heading(`Named responses (${summary.namedResponses.length})`)}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Only respondents who chose to submit with their name. The leader sees their comments with their name, not
            the whole response. When someone responded more than once, only their latest scores count.
          </Typography>
          {summary.namedResponses.map((response, i) => (
            <Accordion key={`${response.respondentEmail}-${i}`} disableGutters>
              <AccordionSummary>
                {response.respondentName ?? response.respondentEmail}
                {response.submittedOn && ` · ${formatShortDate(response.submittedOn)}`}
                {!response.latest && " · earlier response"}
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={0.5}>
                  {Object.entries(response.answers).map(([questionId, answer]) => (
                    <Typography key={questionId} variant="body2">
                      <strong>{questionText.get(questionId) ?? questionId}:</strong> {String(answer)}
                    </Typography>
                  ))}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}
    </Stack>
  );
}

// A comment in a shaded box, as in a PAR 360° summary, with who wrote it (or Anonymous).
function Comment({ text, by }: { text: string; by: string }) {
  return (
    <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: "action.hover" }}>
      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
        {text}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {by}
      </Typography>
    </Box>
  );
}
