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
  Box,
  Card,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { ChevronDownIcon, InfoIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import type { FormDefinition } from "../api/leadership360Types";
import { NOT_OBSERVED } from "../api/review360Types";
import type { Review360Response, Review360Responses } from "../api/review360Types";
import { useReviewResponses } from "../api/useReview360";
import { formatIndex, indexComparison, ratedQuestions, ratingLabels, textQuestions } from "../util/review360Form";
import Par360SummaryView from "./Par360SummaryView";

// The lead's 360° evidence for one employee in a PAR 2.0 cycle: the summary
// with the team average for context, then every response with its reviewer.
export default function ParLead360Evidence({
  parCycleId,
  employeeEmail,
  framed = true,
}: {
  parCycleId: number;
  employeeEmail: string;
  /** False inside a card that already frames it. */
  framed?: boolean;
}) {
  const responses = useReviewResponses(parCycleId, employeeEmail);
  if (responses.isLoading) return <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />;
  if (responses.isError) {
    return (
      <ErrorNotice error={responses.error} onRetry={() => responses.refetch()} retrying={responses.isFetching}>
        Couldn't load the 360° feedback.
      </ErrorNotice>
    );
  }
  const data = responses.data;
  if (!data) return null;
  const definition = data.template.definition;
  return (
    <Stack spacing={2}>
      <Box component={framed ? Card : "div"} {...(framed ? { variant: "outlined", sx: { p: 2 } } : {})}>
        {framed && <Typography sx={{ fontWeight: 600, mb: 1.5 }}>360° summary</Typography>}
        {data.responseCount === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No one has responded yet.
          </Typography>
        ) : (
          <>
            <Par360SummaryView
              definition={definition}
              responseCount={data.responseCount}
              index={data.index}
              questionAverages={data.questionAverages}
              teamIndex={data.teamIndex}
            />
            <Par360GuidanceText data={data} sx={{ mt: 2 }} />
          </>
        )}
      </Box>
      {data.responses.length > 0 && (
        <Box>
          <Typography sx={{ fontWeight: 600, mb: 1 }}>Responses</Typography>
          {data.responses.map((r) => (
            <ResponseAccordion key={r.reviewerEmail} response={r} definition={definition} />
          ))}
        </Box>
      )}
    </Stack>
  );
}

/** The rating guidance line: the index beside the team average, and what it's for. */
export function Par360GuidanceText({ data, sx }: { data: Review360Responses; sx?: object }) {
  if (data.index === undefined) return null;
  const comparison = indexComparison(data.index, data.teamIndex);
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", color: "text.secondary", ...sx }}>
      <Box sx={{ mt: "2px", flexShrink: 0 }}>
        <InfoIcon size={14} />
      </Box>
      <Typography variant="body2" color="text.secondary">
        360° index <b>{formatIndex(data.index)}</b> from {data.responseCount} response
        {data.responseCount === 1 ? "" : "s"}
        {comparison && data.teamIndex !== undefined && (
          <>
            , {comparison} ({formatIndex(data.teamIndex)} across {data.teamMembersWithResponses} member
            {data.teamMembersWithResponses === 1 ? "" : "s"})
          </>
        )}
        . It informs your rating; it isn't the rating.
      </Typography>
    </Box>
  );
}

/** Compact 360° evidence beside the rating: the guidance line, or why there's none yet. */
export function ParLead360Guidance({ parCycleId, employeeEmail }: { parCycleId: number; employeeEmail: string }) {
  const responses = useReviewResponses(parCycleId, employeeEmail);
  if (!responses.data) return null;
  if (responses.data.responseCount === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No 360° responses yet.
      </Typography>
    );
  }
  return <Par360GuidanceText data={responses.data} />;
}

function ResponseAccordion({ response, definition }: { response: Review360Response; definition: FormDefinition }) {
  const relationship = definition.sections
    .flatMap((s) => s.questions)
    .find((q) => q.type === "CHOICE")
    ?.options?.find((o) => o.value === response.answers.relationship)?.label;
  const ratings = ratedQuestions(definition).map((q) => response.answers[q.id]).filter((v): v is number => typeof v === "number");
  const average = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined;
  return (
    <Accordion disableGutters variant="outlined" sx={{ "&:before": { display: "none" }, mb: 1 }}>
      <AccordionSummary expandIcon={<ChevronDownIcon size={16} />}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1, minWidth: 0, pr: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {response.reviewerName ?? response.reviewerEmail}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {response.reviewerEmail}
            </Typography>
          </Box>
          {relationship && <Chip size="small" variant="outlined" label={relationship} />}
          <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 28, textAlign: "right" }}>
            {formatIndex(average)}
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1.5}>
          <Box sx={{ display: "grid", gridTemplateColumns: "minmax(140px, 220px) 1fr", rowGap: 0.5, columnGap: 2 }}>
            {ratedQuestions(definition).map((q) => {
              const value = response.answers[q.id];
              const scale = definition.scales[q.scale ?? ""];
              const label =
                value === NOT_OBSERVED
                  ? "Not observed"
                  : typeof value === "number" && scale
                    ? `${value} · ${ratingLabels(scale).find((l) => l.value === value)?.label ?? ""}`
                    : "–";
              return (
                <Box key={q.id} sx={{ display: "contents" }}>
                  <Typography variant="body2" color="text.secondary">
                    {q.text}
                  </Typography>
                  <Typography variant="body2" sx={{ fontStyle: value === NOT_OBSERVED ? "italic" : undefined }}>
                    {label}
                  </Typography>
                </Box>
              );
            })}
          </Box>
          {textQuestions(definition).map((q) => {
            const text = response.answers[q.id];
            if (typeof text !== "string" || !text.trim()) return null;
            return (
              <Box key={q.id}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {q.text}
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                  {text}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
