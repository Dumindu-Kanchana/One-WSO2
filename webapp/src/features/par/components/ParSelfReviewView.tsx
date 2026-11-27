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

import { Box, Card, Stack, Typography } from "@wso2/oxygen-ui";
import type { FormDefinition } from "../api/leadership360Types";
import type { SelfReviewAnswers } from "../api/selfReviewTypes";
import { answerViewHtml, isQuestionAnswered } from "../util/selfReviewForm";
import { ParCommentView } from "./ParContent";

// A shared self-review, read-only: each guided section with its hint and its
// answer. Used by the lead and in History.
export default function ParSelfReviewView({
  definition,
  answers,
  framed = true,
}: {
  definition: FormDefinition;
  answers: SelfReviewAnswers;
  // false when it sits inside a card of its own.
  framed?: boolean;
}) {
  const content = (
    <Stack spacing={2.25}>
      {definition.sections.map((section, i) => (
        <Box key={section.id}>
          <Typography sx={{ fontWeight: 600, mb: section.hint ? 0.25 : 0.5 }}>
            {i + 1}. {section.title}
          </Typography>
          {section.hint && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
              {section.hint}
            </Typography>
          )}
          {section.questions.map((q) =>
            isQuestionAnswered(q, answers) ? (
              <ParCommentView key={q.id} html={answerViewHtml(answers[q.id])} />
            ) : (
              <Typography key={q.id} variant="body2" color="text.secondary">
                Not answered.
              </Typography>
            ),
          )}
        </Box>
      ))}
    </Stack>
  );
  return framed ? (
    <Card variant="outlined" sx={{ p: 2 }}>
      {content}
    </Card>
  ) : (
    content
  );
}
