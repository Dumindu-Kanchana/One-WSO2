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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, authedPost, authedPut, defaultQueryRetry, HttpError } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { parBackendUrl, parServiceUrls } from "@config/apiConfig";
import { digiopsHeaders } from "@features/my/util/digiopsHeaders";
import type {
  Leadership360CurrentSurvey,
  Leadership360FeedbackInput,
  Leadership360Leader,
  Leadership360MyFeedback,
  Leadership360ResultsEntry,
  Leadership360Summary,
  Leadership360Survey,
  Leadership360View,
} from "./leadership360Types";

function useLeadership360Enabled() {
  const { isSignedIn } = useAsgardeo();
  return isSignedIn && Boolean(parBackendUrl);
}

// The survey open today. Resolves to null (not an error) when none is open —
// the backend's 404 means "nothing to fill in right now", a normal state.
export function useCurrentLeadership360Survey(enabled = true) {
  const backendEnabled = useLeadership360Enabled();
  const getAccessToken = useAccessToken();
  return useQuery<Leadership360CurrentSurvey | null>({
    queryKey: ["leadership360-current-survey"],
    enabled: enabled && backendEnabled,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      try {
        return await authedGet<Leadership360CurrentSurvey>(
          parServiceUrls.leadership360CurrentSurvey(),
          accessToken,
          digiopsHeaders(),
        );
      } catch (err) {
        if (err instanceof HttpError && err.status === 404) return null;
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: defaultQueryRetry,
  });
}

export function useLeadership360Leaders(enabled = true) {
  const backendEnabled = useLeadership360Enabled();
  const getAccessToken = useAccessToken();
  return useQuery<Leadership360Leader[]>({
    queryKey: ["leadership360-leaders"],
    enabled: enabled && backendEnabled,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<Leadership360Leader[]>(parServiceUrls.leadership360Leaders(), accessToken, digiopsHeaders());
    },
    staleTime: 30 * 60 * 1000,
    retry: defaultQueryRetry,
  });
}

export function useMyLeadership360Feedback(surveyId: number | undefined) {
  const enabled = useLeadership360Enabled();
  const getAccessToken = useAccessToken();
  return useQuery<Leadership360MyFeedback>({
    queryKey: ["leadership360-my-feedback", surveyId],
    enabled: enabled && surveyId !== undefined,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<Leadership360MyFeedback>(
        parServiceUrls.leadership360MyFeedback(surveyId!),
        accessToken,
        digiopsHeaders(),
      );
    },
    retry: defaultQueryRetry,
  });
}

export function useSaveLeadership360Draft(surveyId: number | undefined) {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<void, Error, Leadership360FeedbackInput>({
    mutationFn: async (input) => {
      if (surveyId === undefined) throw new Error("Missing survey");
      const accessToken = await getAccessToken();
      await authedPut<void>(parServiceUrls.leadership360Drafts(surveyId), accessToken, input, digiopsHeaders());
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["leadership360-my-feedback", surveyId] });
    },
  });
}

export function useSubmitLeadership360Feedback(surveyId: number | undefined) {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<void, Error, Leadership360FeedbackInput>({
    mutationFn: async (input) => {
      if (surveyId === undefined) throw new Error("Missing survey");
      const accessToken = await getAccessToken();
      await authedPost<void>(parServiceUrls.leadership360Submissions(surveyId), accessToken, input, digiopsHeaders());
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["leadership360-my-feedback", surveyId] });
    },
  });
}

export function useLeadership360Results(surveyId: number | undefined, view: Leadership360View) {
  const enabled = useLeadership360Enabled();
  const getAccessToken = useAccessToken();
  return useQuery<Leadership360ResultsEntry[]>({
    queryKey: ["leadership360-results", surveyId, view],
    enabled: enabled && surveyId !== undefined,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<Leadership360ResultsEntry[]>(
        parServiceUrls.leadership360Results(surveyId!, view),
        accessToken,
        digiopsHeaders(),
      );
    },
    retry: defaultQueryRetry,
  });
}

export function useLeadership360Summary(
  surveyId: number | undefined,
  view: Leadership360View,
  leaderEmail: string | undefined,
) {
  const enabled = useLeadership360Enabled();
  const getAccessToken = useAccessToken();
  return useQuery<Leadership360Summary>({
    queryKey: ["leadership360-summary", surveyId, view, leaderEmail],
    enabled: enabled && surveyId !== undefined && Boolean(leaderEmail),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<Leadership360Summary>(
        parServiceUrls.leadership360Summary(surveyId!, view, leaderEmail!),
        accessToken,
        digiopsHeaders(),
      );
    },
    retry: defaultQueryRetry,
  });
}

// One survey with its template — what a results screen needs to name each
// question, including for a survey that has already closed.
export function useLeadership360SurveyWithTemplate(surveyId: number | undefined) {
  const enabled = useLeadership360Enabled();
  const getAccessToken = useAccessToken();
  return useQuery<Leadership360CurrentSurvey>({
    queryKey: ["leadership360-survey", surveyId],
    enabled: enabled && surveyId !== undefined,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<Leadership360CurrentSurvey>(
        parServiceUrls.leadership360Survey(surveyId!),
        accessToken,
        digiopsHeaders(),
      );
    },
    staleTime: 30 * 60 * 1000,
    retry: defaultQueryRetry,
  });
}

// Every survey, newest first. Readable by anyone (names and dates only), so
// leaders and managers can pick a closed survey to read its results.
export function useLeadership360Surveys(enabled = true) {
  const backendEnabled = useLeadership360Enabled();
  const getAccessToken = useAccessToken();
  return useQuery<Leadership360Survey[]>({
    queryKey: ["leadership360-surveys"],
    enabled: enabled && backendEnabled,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<Leadership360Survey[]>(parServiceUrls.leadership360Surveys(), accessToken, digiopsHeaders());
    },
    retry: defaultQueryRetry,
  });
}

// The surveys a results screen can show (any that has started), and the one
// it opens on: the open one (results are live), else the latest closed one.
export function resultsSurveys(surveys: Leadership360Survey[] | undefined) {
  const started = (surveys ?? []).filter((s) => s.status !== "UPCOMING");
  return { started, defaultSurveyId: (started.find((s) => s.status === "OPEN") ?? started[0])?.surveyId };
}

// The Leadership 360° survey that runs with a PAR cycle, if it has one.
export function cycleSurvey(surveys: Leadership360Survey[] | undefined, parCycleId: number | undefined) {
  return parCycleId === undefined ? undefined : (surveys ?? []).find((s) => s.parCycleId === parCycleId);
}

// Your own Leadership 360° results in a PAR cycle, for the PAR's PDF: the
// summary and the questions it answers, once there are results, with the
// date they're as of while the survey is still open. Nothing for anyone
// outside the leadership team (the results list comes back empty, so no
// summary is asked for).
export function useCycleLeadership360ForPdf(parCycleId: number, workEmail: string | undefined, enabled: boolean) {
  const surveys = useLeadership360Surveys(enabled);
  const survey = enabled ? cycleSurvey(surveys.data, parCycleId) : undefined;
  const results = useLeadership360Results(survey?.surveyId, "SELF");
  const available = Boolean(results.data?.[0]?.available);
  const summary = useLeadership360Summary(available ? survey?.surveyId : undefined, "SELF", workEmail);
  const withTemplate = useLeadership360SurveyWithTemplate(available ? survey?.surveyId : undefined);
  if (!survey || !summary.data?.available || !withTemplate.data) return undefined;
  return {
    definition: withTemplate.data.template.definition,
    summary: summary.data,
    asOf: survey.status === "OPEN" ? new Date().toLocaleDateString("en-CA") : undefined,
  };
}

// Whether any member of the leadership group reports to the signed-in user.
// The Lead View shows its Leadership 360° tab only then. Who reports to whom
// comes from HR today, not from the survey, so any started survey answers it.
export function useLeadsALeader(enabled: boolean) {
  const surveys = useLeadership360Surveys(enabled);
  const { defaultSurveyId } = resultsSurveys(surveys.data);
  const reports = useLeadership360Results(enabled ? defaultSurveyId : undefined, "REPORTS");
  return enabled && (reports.data?.length ?? 0) > 0;
}
