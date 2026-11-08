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

// Writes to til-backend.
//
// No `retry` on either mutation — React Query's mutation default (zero
// attempts) is what we want, same reasoning as menu: a 400 (What over the max
// chars) or a 403 (deleting without canModerate) is a final answer, not a
// transient failure worth retrying.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isNetworkFailure } from "@api/errors";
import { authedDelete, authedPost, authedPut } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { tilServiceUrls } from "@config/apiConfig";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { normalizeSubmission } from "./tilTypes";
import type { TilSubmission, TilSubmissionPayload, TilSubmissionUpdatePayload, TilSubmissionWire } from "./tilTypes";

function useTilSubmissionsKey(): unknown[] {
  const { state } = useAsgardeoSub();
  return ["til-submissions", state.status === "ready" ? state.sub : undefined];
}

/** POST /submissions. The backend derives the submitter's email from the id_token. */
export function useCreateTilSubmission() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const submissionsKey = useTilSubmissionsKey();
  return useMutation<void, Error, TilSubmissionPayload>({
    mutationFn: async (payload) => {
      await authedPost<unknown>(tilServiceUrls.submissions, await getAccessToken(), payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: submissionsKey });
    },
    // A connection lost after the server saved the entry fails like one that
    // never got there, and the dialog asks to check the feed before sharing
    // again, so the feed is fetched again for that check.
    onError: async (error) => {
      if (isNetworkFailure(error)) await qc.invalidateQueries({ queryKey: submissionsKey });
    },
  });
}

/** PUT /submissions/{id}. The backend re-checks author-or-canModerate — this is presentation-only gating. */
export function useUpdateTilSubmission() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const submissionsKey = useTilSubmissionsKey();
  return useMutation<TilSubmission | null, Error, { id: string; payload: TilSubmissionUpdatePayload }>({
    mutationFn: async ({ id, payload }) => {
      const wire = await authedPut<TilSubmissionWire>(tilServiceUrls.submission(id), await getAccessToken(), payload);
      return wire ? normalizeSubmission(wire) : null;
    },
    onSuccess: async (updated, { id }) => {
      // The entry's own page reads the detail query, not the feed list, so
      // both have to pick up the edit.
      const detailKey = ["til-submission", submissionsKey[1], id];
      if (updated) qc.setQueryData(detailKey, updated);
      else await qc.invalidateQueries({ queryKey: detailKey });
      await qc.invalidateQueries({ queryKey: submissionsKey });
    },
  });
}

/** POST /submissions/{id}/notify: sends an entry whose Google Chat
 * announcement failed. The backend re-checks canModerate and refuses an entry
 * that's already been sent (409), so a card never goes out twice. */
export function useNotifyTilSubmission() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const submissionsKey = useTilSubmissionsKey();
  return useMutation<TilSubmission | null, Error, string>({
    mutationFn: async (id) => {
      const wire = await authedPost<TilSubmissionWire>(tilServiceUrls.notify(id), await getAccessToken(), {});
      return wire ? normalizeSubmission(wire) : null;
    },
    onSuccess: (sent, id) => {
      if (sent) qc.setQueryData(["til-submission", submissionsKey[1], id], sent);
    },
    // Also after a failure: a 409 means someone else sent it, and the page
    // should stop offering to.
    onSettled: async (_data, _error, id) => {
      await qc.invalidateQueries({ queryKey: ["til-submission", submissionsKey[1], id] });
      await qc.invalidateQueries({ queryKey: submissionsKey });
    },
  });
}

/** DELETE /submissions/{id}. The backend re-checks canModerate — this is presentation-only gating. */
export function useDeleteTilSubmission() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const submissionsKey = useTilSubmissionsKey();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await authedDelete(tilServiceUrls.submission(id), await getAccessToken());
    },
    onSuccess: async (_data, id) => {
      // Without this, a cached ["til-submission", sub, id] detail entry
      // survives the delete -- a tab with that entry's page already open
      // (or a link to it clicked right after) can show the stale cached
      // entry before the backend's own 404 arrives.
      qc.removeQueries({ queryKey: ["til-submission", submissionsKey[1], id] });
      await qc.invalidateQueries({ queryKey: submissionsKey });
    },
  });
}
