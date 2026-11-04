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

import { Box, LinearProgress, Stack, Typography } from "@wso2/oxygen-ui";
import type { FormDefinition } from "../api/leadership360Types";
import type { QuestionAverage } from "../api/review360Types";
import { behaviourAverages, formatIndex, textQuestions } from "../util/review360Form";

// A 360° summary: the index, each behaviour's average, and (when given) the
// written comments grouped by question. Shows no names; callers that may see
// names list the responses separately.
export default function Par360SummaryView({
  definition,
  responseCount,
  index,
  questionAverages,
  comments,
  teamIndex,
}: {
  definition: FormDefinition;
  responseCount: number;
  index?: number;
  questionAverages: QuestionAverage[];
  comments?: Record<string, string[]>;
  teamIndex?: number;
}) {
  const scaleMax = Object.values(definition.scales)[0]?.max ?? 5;
  return (
    <Stack spacing={2.5}>
      <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <SummaryMetric label="360° index" value={formatIndex(index)} hint={`out of ${scaleMax}`} />
        {teamIndex !== undefined && <SummaryMetric label="Team average" value={formatIndex(teamIndex)} hint="for context" />}
        <SummaryMetric label="Responses" value={String(responseCount)} />
      </Box>

      <Stack spacing={1.25}>
        {behaviourAverages(definition, questionAverages).map(({ question, average, ratingCount }) => (
          <Box key={question.id}>
            <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {question.text}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {formatIndex(average)}
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75 }}>
                  {ratingCount === 0 ? "not observed" : `${ratingCount} rating${ratingCount === 1 ? "" : "s"}`}
                </Typography>
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={average === undefined ? 0 : (average / scaleMax) * 100}
              aria-label={`${question.text}: ${formatIndex(average)} out of ${scaleMax}`}
              sx={{ height: 6, borderRadius: 3, mt: 0.5 }}
            />
          </Box>
        ))}
      </Stack>

      {comments &&
        textQuestions(definition).map((q) => {
          const list = comments[q.id] ?? [];
          if (list.length === 0) return null;
          return (
            <Box key={q.id}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
                {q.text}
              </Typography>
              <Stack spacing={0.75}>
                {list.map((c, i) => (
                  <Typography
                    key={i}
                    variant="body2"
                    sx={{ p: 1.25, borderRadius: 1, bgcolor: "action.hover", whiteSpace: "pre-wrap" }}
                  >
                    {c}
                  </Typography>
                ))}
              </Stack>
            </Box>
          );
        })}
    </Stack>
  );
}

/** One headline number of a summary, with its label above it. */
export function SummaryMetric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
        {value}
        {hint && (
          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75, fontWeight: 400 }}>
            {hint}
          </Typography>
        )}
      </Typography>
    </Box>
  );
}
