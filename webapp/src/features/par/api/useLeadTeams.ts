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

import { useMemo } from "react";
import { queryOptions, useQueries, useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, defaultQueryRetry } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { parBackendUrl, parServiceUrls } from "@config/apiConfig";
import { digiopsHeaders } from "@features/my/util/digiopsHeaders";
import type { ParTeamDetails, ParTeamSummary } from "./types";
import { useParIsTeamLead } from "./useParData";
import { useParLeadEmployees } from "./useLeadHistory";

// GET the teams this lead owns for one cycle — LeadOngoingPanel.tsx's own
// first fetch (fetchTeams). A lead with exactly one team skips straight to
// it; more than one shows the team-picker grid first — see LeadPortalPage.
export function useParTeams(parCycleId: number | undefined, leadEmail: string | undefined) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const backendConfigured = Boolean(parBackendUrl);
  return useQuery<ParTeamSummary[]>({
    queryKey: ["par-teams", parCycleId, leadEmail],
    enabled: isSignedIn && backendConfigured && Boolean(parCycleId) && Boolean(leadEmail),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ParTeamSummary[]>(
        parServiceUrls.parTeams(parCycleId!, leadEmail!),
        accessToken,
        digiopsHeaders(),
      );
    },
    staleTime: 60 * 1000,
    retry: defaultQueryRetry,
  });
}

function teamDetailsQuery(
  parCycleId: number | undefined,
  parTeamId: number | undefined,
  getAccessToken: () => Promise<string>,
  enabled: boolean,
) {
  return queryOptions<ParTeamDetails>({
    queryKey: ["par-team-details", parCycleId, parTeamId],
    enabled: enabled && Boolean(parBackendUrl) && Boolean(parCycleId) && Boolean(parTeamId),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ParTeamDetails>(
        parServiceUrls.parTeamDetails(parCycleId!, parTeamId!),
        accessToken,
        digiopsHeaders(),
      );
    },
    staleTime: 60 * 1000,
    retry: defaultQueryRetry,
  });
}

// GET one team's roster. Only fires once a team is actually picked (or the
// lead's only team is known).
export function useParTeamDetails(parCycleId: number | undefined, parTeamId: number | undefined) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  return useQuery(teamDetailsQuery(parCycleId, parTeamId, getAccessToken, isSignedIn));
}

// Who a lead can't offer 360° feedback to, by lowercased email, as the backend
// decides it: the members of their teams in the cycle, or, with feedback held
// for the next cycle, their direct reports in the org chart. Their feedback
// goes in the lead's review instead. Empty for anyone who doesn't lead.
export function useOwnReports(workEmail: string | undefined, parCycleId: number | undefined, held: boolean) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const lead = useParIsTeamLead(workEmail, !held);
  const teams = useParTeams(!held && lead.isTeamLead ? parCycleId : undefined, workEmail);
  const rosters = useQueries({
    queries: (teams.data ?? []).map((t) => teamDetailsQuery(parCycleId, t.parTeamId, getAccessToken, isSignedIn)),
  });
  const orgChart = useParLeadEmployees(held ? workEmail : undefined);
  const listed = held
    ? (orgChart.data ?? []).map((e) => e.workEmail)
    : rosters.flatMap((r) => (r.data?.details ?? []).map((d) => d.parEmployeeEmail));
  const key = [...new Set(listed.map((e) => e.toLowerCase()))].sort().join(" ");
  const emails = useMemo(() => new Set(key ? key.split(" ") : []), [key]);
  return {
    emails,
    isLoading: held ? orgChart.isLoading : lead.isLoading || teams.isLoading || rosters.some((r) => r.isLoading),
  };
}
