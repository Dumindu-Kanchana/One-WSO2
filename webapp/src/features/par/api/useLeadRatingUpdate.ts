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

import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import { authedPatch } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { parServiceUrls } from "@config/apiConfig";
import { digiopsHeaders } from "@features/my/util/digiopsHeaders";
import type { ParRatingModify } from "./types";

// PATCH .../par-ratings/{id} on a REPORT's record (not the caller's own) —
// the same endpoint useSaveParRating uses, just parameterised by whichever
// employee the lead is acting on. checkForModifiableFieldsForLead is what
// actually restricts which fields go through for this caller.
//
// employeeSlice's own bulkUpdateParRatingOfEmployee thunk (TeamSummary.tsx's
// "Share" button) is not a real bulk endpoint — it's a client-side loop of
// this same per-record PATCH, one call per selected row. Ported the same
// way: call this mutation once per employee, not a batch request.
// What a rating update makes stale: the employee's PAR, the team rosters and the teams' completion counts.
function refreshAfterRatingUpdates(qc: QueryClient, parCycleId: number | undefined, employeeEmails: string[]) {
  return Promise.all([
    ...employeeEmails.map((employeeEmail) =>
      qc.invalidateQueries({ queryKey: ["par-rating", parCycleId, employeeEmail] }),
    ),
    qc.invalidateQueries({ queryKey: ["par-team-details"] }),
    // A lead status / special-rating change also moves ParTeamSummary's
    // own completion counts, shown back on the team-picker page.
    qc.invalidateQueries({ queryKey: ["par-teams"] }),
  ]);
}

// `refreshLater` leaves the refresh to the caller, for a run of updates (bulk Share) that refreshes once at the end
// with useRefreshAfterRatingUpdates, instead of reloading every team's roster after each one.
export function useLeadRatingUpdate(parCycleId: number | undefined) {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<
    void,
    Error,
    { employeeEmail: string; parRatingId: number; payload: ParRatingModify; refreshLater?: boolean }
  >({
    mutationFn: async ({ employeeEmail, parRatingId, payload }) => {
      if (!parCycleId) throw new Error("Missing cycle");
      const accessToken = await getAccessToken();
      await authedPatch<void>(
        parServiceUrls.parRatingUpdate(parCycleId, employeeEmail, parRatingId),
        accessToken,
        payload,
        digiopsHeaders(),
      );
    },
    onSuccess: async (_data, { employeeEmail, refreshLater }) => {
      if (!refreshLater) await refreshAfterRatingUpdates(qc, parCycleId, [employeeEmail]);
    },
  });
}

// The refresh a run of `refreshLater` updates does once, for the employees it updated.
export function useRefreshAfterRatingUpdates(parCycleId: number | undefined) {
  const qc = useQueryClient();
  return (employeeEmails: string[]) => refreshAfterRatingUpdates(qc, parCycleId, employeeEmails);
}
