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
  LinearProgress,
  Skeleton,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useLeadership360Summary, useLeadership360SurveyWithTemplate } from "../api/useLeadership360";
import type {
  FormAnswers,
  FormDefinition,
  FormQuestion,
  Leadership360Summary,
  Leadership360View,
} from "../api/leadership360Types";
import { allQuestions, stepSections } from "../util/leadership360Form";
import { formatShortDate } from "../util/parDate";
import { formatIndex } from "../util/review360Form";
import { MIN_360_RESPONSES } from "../api/review360Types";
import { SummaryMetric } from "./Par360SummaryView";

// One leader's results in one survey. What they contain depends on the view
// they're read from — the backend decides: the leader (SELF) gets averages and
// comments, with names on named comments, from 3 responses; their leads
// (REPORTS) and PAR admins (ALL) get every response in full from the first,
// every answer included (anonymous ones without a name or date), and the
// summary from 3: averages, comments and, for admins, the relationship
// breakdown. Laid out like a PAR 360° summary.
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
        {summary.reason}
        {summary.responseCount > 0 &&
          ` ${summary.responseCount} ${summary.responseCount === 1 ? "response" : "responses"} so far.`}
      </Alert>
    );
  }

  const averages = new Map(summary.questionAverages.map((a) => [a.questionId, a]));
  const questions = allQuestions(definition);
  const max = Math.max(...Object.values(definition.scales).map((s) => s.max), 5);
  // The relationship breakdown counts the answers to the aggregate-only questions, so its labels come from those.
  const choiceLabels = new Map(
    questions.filter((q) => q.aggregateOnly).flatMap((q) => (q.options ?? []).map((o) => [o.value, o.label] as const)),
  );
  const heading = (text: string) => (
    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
      {text}
    </Typography>
  );

  // Like PAR 360°'s index, the summary (averages and comments) shows only from 3 responses. Below that, a leader's
  // leads and PAR admins read the responses themselves.
  const averagesShown = summary.responseCount >= MIN_360_RESPONSES;

  return (
    <Stack spacing={2.5}>
      <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {averagesShown && (
          <SummaryMetric label="Overall" value={formatIndex(summary.overallAverage)} hint={`out of ${max}`} />
        )}
        <SummaryMetric label="Responses" value={String(summary.responseCount)} />
      </Box>

      {!averagesShown && (
        <Typography variant="body2" color="text.secondary">
          The averages and comments show after {MIN_360_RESPONSES} or more responses.
        </Typography>
      )}

      {averagesShown &&
        stepSections(definition)
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

      {averagesShown && (
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
      )}

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

      {(summary.namedResponses || summary.anonymousResponses) && (
        <Box>
          {heading(`Responses (${(summary.namedResponses?.length ?? 0) + (summary.anonymousResponses?.length ?? 0)})`)}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Each response in full. Anonymous ones show no name or date, and aren't in the order they came in. The
            leader sees the averages and comments, not whole responses. When someone responded more than once, only
            their latest scores count.
          </Typography>
          {summary.namedResponses?.map((response, i) => (
            <Accordion key={`${response.respondentEmail}-${i}`} disableGutters>
              <AccordionSummary>
                {response.respondentName ?? response.respondentEmail}
                {response.submittedOn && ` · ${formatShortDate(response.submittedOn)}`}
                {!response.latest && " · earlier response"}
              </AccordionSummary>
              <AccordionDetails>
                <Answers answers={response.answers} questions={questions} />
              </AccordionDetails>
            </Accordion>
          ))}
          {summary.anonymousResponses?.map((response, i) => (
            <Accordion key={`anonymous-${i}`} disableGutters>
              <AccordionSummary>Anonymous</AccordionSummary>
              <AccordionDetails>
                <Answers answers={response.answers} questions={questions} />
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}
    </Stack>
  );
}

// One response's answers, every one, in the form's order, a choice by its label (from its own question, since two
// questions may use the same value for different labels).
function Answers({ answers, questions }: { answers: FormAnswers; questions: FormQuestion[] }) {
  const answered = questions.filter((q) => {
    const answer = answers[q.id];
    return answer !== undefined && answer !== null && answer !== "";
  });
  return (
    <Stack spacing={0.5}>
      {answered.map((q) => {
        const answer = String(answers[q.id]);
        return (
          <Typography key={q.id} variant="body2">
            <strong>{q.text}:</strong>{" "}
            {q.type === "CHOICE" ? (q.options?.find((o) => o.value === answer)?.label ?? answer) : answer}
          </Typography>
        );
      })}
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
