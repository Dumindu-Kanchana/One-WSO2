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

// A shared self-review, read-only: each guided section with its answer. Used
// by the employee once shared and by their lead.
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
          <Typography sx={{ fontWeight: 600, mb: 0.5 }}>
            {i + 1}. {section.title}
          </Typography>
          {section.questions.map((q) => {
            const text = (answers[q.id] ?? "").trim();
            return (
              <Typography
                key={q.id}
                variant="body2"
                color={text ? "text.primary" : "text.secondary"}
                sx={{ whiteSpace: "pre-wrap" }}
              >
                {text || "Not answered."}
              </Typography>
            );
          })}
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
