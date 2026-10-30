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

import { useQueries, useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, defaultQueryRetry, HttpError } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { parBackendUrl, parServiceUrls } from "@config/apiConfig";
import { digiopsHeaders } from "@features/my/util/digiopsHeaders";
import type {
  ParCycle,
  ParCycleConfigurations,
  ParLegacyCycleSummary,
  ParLegacyHistory,
  ParParticipant,
  ParRating,
  ParRejectedReview,
  ParSpecialRatingAllocation,
  ParSpecialRatingGroupWithHeadCount,
  ParTeamSummary,
} from "./types";

function useParBaseline() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  return { isSignedIn, getAccessToken, backendConfigured: Boolean(parBackendUrl) };
}

// `refetchInterval` backs the one place this needs to poll instead of
// waiting for a normal invalidation: right after creating a cycle, the
// backend seeds its special-rating groups asynchronously, so PENDING
// doesn't become PENDING_QUOTA immediately.
export function useParCyclesByStatus(
  status: "PENDING_QUOTA" | "OPEN" | "PENDING" | "CLOSED",
  options: { enabled?: boolean; refetchInterval?: number | false } = {},
) {
  const { enabled = true, refetchInterval = false } = options;
  const { isSignedIn, getAccessToken, backendConfigured } = useParBaseline();
  return useQuery<ParCycle[]>({
    queryKey: ["par-admin-cycles", status],
    enabled: enabled && isSignedIn && backendConfigured,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ParCycle[]>(parServiceUrls.parCyclesByStatus(status), accessToken, digiopsHeaders());
    },
    staleTime: 60 * 1000,
    refetchInterval,
    retry: defaultQueryRetry,
  });
}

export function useParGlobalConfig(enabled = true) {
  const { isSignedIn, getAccessToken, backendConfigured } = useParBaseline();
  return useQuery<ParCycleConfigurations>({
    queryKey: ["par-admin-global-config"],
    enabled: enabled && isSignedIn && backendConfigured,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ParCycleConfigurations>(parServiceUrls.parGlobalConfig(), accessToken, digiopsHeaders());
    },
    staleTime: 5 * 60 * 1000,
    retry: defaultQueryRetry,
  });
}

export function useParAdminTeams(parCycleId: number | undefined, enabled = true) {
  const { isSignedIn, getAccessToken, backendConfigured } = useParBaseline();
  return useQuery<ParTeamSummary[]>({
    queryKey: ["par-admin-teams", parCycleId],
    enabled: enabled && isSignedIn && backendConfigured && Boolean(parCycleId),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ParTeamSummary[]>(parServiceUrls.parAdminTeams(parCycleId!), accessToken, digiopsHeaders());
    },
    staleTime: 60 * 1000,
    retry: defaultQueryRetry,
  });
}

// Same resource par360Participants already hits.
export function useParAdminParticipants(parCycleId: number | undefined, enabled = true) {
  const { isSignedIn, getAccessToken, backendConfigured } = useParBaseline();
  return useQuery<ParParticipant[]>({
    queryKey: ["par-admin-participants", parCycleId],
    enabled: enabled && isSignedIn && backendConfigured && Boolean(parCycleId),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ParParticipant[]>(parServiceUrls.par360Participants(parCycleId!), accessToken, digiopsHeaders());
    },
    staleTime: 60 * 1000,
    retry: defaultQueryRetry,
  });
}

export function useParRejectedReviews(parCycleId: number | undefined, enabled = true) {
  const { isSignedIn, getAccessToken, backendConfigured } = useParBaseline();
  return useQuery<ParRejectedReview[]>({
    queryKey: ["par-admin-rejected-reviews", parCycleId],
    enabled: enabled && isSignedIn && backendConfigured && Boolean(parCycleId),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ParRejectedReview[]>(
        parServiceUrls.parRejectedReviews(parCycleId!),
        accessToken,
        digiopsHeaders(),
      );
    },
    staleTime: 60 * 1000,
    retry: defaultQueryRetry,
  });
}

export function useParAdminSpecialRatingGroups(parCycleId: number | undefined, enabled = true) {
  const { isSignedIn, getAccessToken, backendConfigured } = useParBaseline();
  return useQuery<ParSpecialRatingGroupWithHeadCount[]>({
    queryKey: ["par-admin-special-rating-groups", parCycleId],
    enabled: enabled && isSignedIn && backendConfigured && Boolean(parCycleId),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ParSpecialRatingGroupWithHeadCount[]>(
        parServiceUrls.parAdminSpecialRatingGroups(parCycleId!),
        accessToken,
        digiopsHeaders(),
      );
    },
    staleTime: 30 * 1000,
    retry: defaultQueryRetry,
  });
}

// Same wire shape as the lead-scoped useSpecialRatingAllocation.ts call.
export function useParAdminQuotaGroups(parCycleId: number | undefined, enabled = true) {
  const { isSignedIn, getAccessToken, backendConfigured } = useParBaseline();
  return useQuery<ParSpecialRatingAllocation[]>({
    queryKey: ["par-admin-quota-groups", parCycleId],
    enabled: enabled && isSignedIn && backendConfigured && Boolean(parCycleId),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ParSpecialRatingAllocation[]>(
        parServiceUrls.parAdminQuotaGroups(parCycleId!),
        accessToken,
        digiopsHeaders(),
      );
    },
    staleTime: 60 * 1000,
    retry: defaultQueryRetry,
  });
}

export function useParAllRatings(parCycleId: number | undefined, enabled = true) {
  const { isSignedIn, getAccessToken, backendConfigured } = useParBaseline();
  return useQuery<ParRating[]>({
    queryKey: ["par-admin-all-ratings", parCycleId],
    enabled: enabled && isSignedIn && backendConfigured && Boolean(parCycleId),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<ParRating[]>(parServiceUrls.parAllRatings(parCycleId!), accessToken, digiopsHeaders());
    },
    staleTime: 60 * 1000,
    retry: defaultQueryRetry,
  });
}

// GET every distinct legacy cycle org-wide — HistoryPanel.tsx's own
// fetchDistinctLegacyParCycles, for the History tab's merged cycle list.
//
// Same 404-means-"feature off" signal as useParLegacyHistory (see its own
// comment) -- this endpoint has the identical enableLegacyParDataView gate,
// checked before auth, in service.bal. `null` (vs `[]`) carries that here
// too, so admin callers get the same "disabled" distinction self-view does.
export function useDistinctLegacyParCycles(enabled = true) {
  const { isSignedIn, getAccessToken, backendConfigured } = useParBaseline();
  return useQuery<ParLegacyCycleSummary[] | null>({
    queryKey: ["par-admin-legacy-cycles"],
    enabled: enabled && isSignedIn && backendConfigured,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      try {
        return await authedGet<ParLegacyCycleSummary[]>(parServiceUrls.legacyParHistoryCycles(), accessToken, digiopsHeaders());
      } catch (e) {
        if (e instanceof HttpError && e.status === 404) return null;
        throw e;
      }
    },
    staleTime: 10 * 60 * 1000,
    retry: defaultQueryRetry,
  });
}

// GET every employee's legacy row for one cycle name — HistoryPanel.tsx's own
// fetchLegacyParHistoryByCycle, for the History tab's legacy drill-down.
// Always summary-mode (names/scores only, no full submitted answers) --
// hundreds to low thousands of participants org-wide is the confirmed real
// scale, and computing every one of those rows' two JSON-aggregated fields
// (questionAnswers, feedback360) just to render a roster/grouping list
// is real per-row backend work (and payload size) spent on data this view
// never displays. Summary mode still returns overallCommentEmployee/
// overallCommentManager and employeeHasQuestionAnswer, which the
// Employee PAR / Lead's Feedback completion checks rely on.
// ParAdminLegacyCycleView.tsx fetches one record's full detail
// separately, via useParLegacyHistory below, only once it's actually opened.
async function fetchLegacyCycleParticipants(cycleName: string, accessToken: string): Promise<ParLegacyHistory[]> {
  try {
    return await authedGet<ParLegacyHistory[]>(
      parServiceUrls.legacyParHistoryCyclesParticipants(cycleName, true),
      accessToken,
      digiopsHeaders(),
    );
  } catch (e) {
    // A backend without the query-parameter route yet answers 404
    // (through the gateway) or 405 (directly). Fall back to the path
    // form so this works whichever of the two is deployed first.
    if (e instanceof HttpError && (e.status === 404 || e.status === 405)) {
      return authedGet<ParLegacyHistory[]>(
        parServiceUrls.legacyParHistoryCyclesParticipantsByPath(cycleName, true),
        accessToken,
        digiopsHeaders(),
      );
    }
    throw e;
  }
}

// The same cycle can be stored under more than one spelling (e.g. a raw and
// the canonical 2015 name). Fetches every stored spelling -- one query each,
// under the same per-name cache key -- and combines them as one
// roster: data only once every spelling has loaded, an error if any fails.
export function useLegacyParHistoryByCycles(cycleNames: string[]) {
  const { isSignedIn, getAccessToken, backendConfigured } = useParBaseline();
  return useQueries({
    queries: cycleNames.map((cycleName) => ({
      queryKey: ["par-admin-legacy-cycle-participants", cycleName],
      enabled: isSignedIn && backendConfigured && Boolean(cycleName),
      queryFn: async () => fetchLegacyCycleParticipants(cycleName, await getAccessToken()),
      staleTime: 60 * 1000,
      retry: defaultQueryRetry,
    })),
    combine: (results) => ({
      data: results.every((r) => r.data) ? results.flatMap((r) => r.data!) : undefined,
      isLoading: results.some((r) => r.isLoading),
      isError: results.some((r) => r.isError),
      error: results.find((r) => r.error)?.error ?? null,
      isFetching: results.some((r) => r.isFetching),
      refetch: () => results.forEach((r) => void r.refetch()),
    }),
  });
}
