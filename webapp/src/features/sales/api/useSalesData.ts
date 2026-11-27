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

// Reads from the Echo (meet-app) backend.
//
// Every key is scoped to the signed-in subject so switching accounts in one tab
// cannot serve the previous user's meetings from cache — the list is filtered
// by the caller's own access, so the rows themselves are user-specific.

import { useQueries, useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import {
  buildMeetingsUrl,
  salesServiceUrls,
  isSalesBackendConfigured,
} from "@config/apiConfig";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { echoRead, retryOnTimeout, salesRetry } from "../util/salesError";
import type {
  AttachmentList,
  SalesUserInfo,
  Meeting,
  MeetingList,
  PlaybackUrl,
  Regions,
  SmartNotes,
  Transcript,
} from "./salesTypes";

export { isSalesBackendConfigured };

/** Everything every query here needs, gathered once. */
function useSalesQueryBasis() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const ready = isSignedIn && isSalesBackendConfigured() && Boolean(userSub);
  return { getAccessToken, subState, retryIdentity, userSub, ready };
}

/**
 * The caller's profile and meet-app privileges.
 *
 * Also the query whose 403 tells us the caller is in no authorised group, since
 * the service refuses every endpoint in that case — so the page asks this one
 * question rather than showing four copies of the same refusal.
 */
export function useSalesUserInfo(enabled = true) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useSalesQueryBasis();
  const query = useQuery<SalesUserInfo>({
    queryKey: ["sales-user-info", userSub],
    // `enabled` lets the rail ask only while Sales is the open perspective, rather than
    // calling meet-app from every page. Same key, so the rail and the page share one request.
    enabled: ready && enabled,
    queryFn: async () => authedGet<SalesUserInfo>(salesServiceUrls.userInfo, await getAccessToken(), undefined, echoRead),
    staleTime: 5 * 60 * 1000,
    retry: salesRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/**
 * The regions the filter offers.
 *
 * Deployment-wide rather than per-user, but still keyed by subject: whether the
 * call succeeds at all depends on the caller's group, so a 403 cached under a
 * shared key would follow the next account into the tab.
 */
export function useSalesRegions() {
  const { getAccessToken, userSub, ready } = useSalesQueryBasis();
  return useQuery<Regions>({
    queryKey: ["sales-regions", userSub],
    enabled: ready,
    queryFn: async () => authedGet<Regions>(salesServiceUrls.regions, await getAccessToken(), undefined, echoRead),
    // Regions change about never; an hour keeps the filter from re-fetching on
    // every visit to the page.
    staleTime: 60 * 60 * 1000,
    retry: salesRetry,
  });
}

export interface MeetingsQueryParams {
  /** Title search. Sent as `searchString`; see buildMeetingsUrl for why. */
  search: string | null;
  /** Region name, or null for every region. */
  region: string | null;
  /** True for the Echo scope: only meetings the calendar add-on registered. */
  echoOnly: boolean;
  page: number;
  pageSize: number;
  /** False while another source serves the list (the Echo scope from the Echo backend). */
  enabled?: boolean;
}

/**
 * One page of meetings.
 *
 * Paging is server-side: the key carries every filter AND the page, so moving
 * between pages is a cache hit on the way back rather than a refetch, and
 * changing a filter is a different key rather than a mutation of this one.
 *
 * `refetchOnMount` is opted back in because the app-wide client disables it.
 * A meeting list that never refreshed on returning to the page would show a
 * cancelled meeting as active for as long as the tab stayed open.
 */
export function useMeetings(params: MeetingsQueryParams) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useSalesQueryBasis();
  const { search, region, echoOnly, page, pageSize, enabled = true } = params;

  const query = useQuery<MeetingList>({
    // Every scope lists only meetings that have already ended. The cutoff is "now", and
    // it is produced inside the fetch rather than passed in: a caller computing it once
    // would freeze the list at the moment the scope was chosen, and as part of the key it
    // would make every render a new key. Each fetch recomputes the cutoff below. There is
    // no polling: an open page refreshes on a filter, page or search change, or on remount.
    queryKey: ["sales-meetings", userSub, search, region, echoOnly, page, pageSize],
    enabled: ready && enabled,
    queryFn: async () =>
      authedGet<MeetingList>(
        buildMeetingsUrl({
          searchString: search,
          region,
          endTime: new Date().toISOString(),
          source: echoOnly ? "echo" : null,
          limit: pageSize,
          offset: page * pageSize,
        }),
        await getAccessToken(),
        undefined,
        echoRead,
      ),
    staleTime: 60 * 1000,
    refetchOnMount: true,

    // Keeps the previous page's rows on screen while the next one loads, so
    // paging doesn't collapse the table to a spinner and back — but only for the
    // same signed-in user. previousData is whatever the LAST key showed, even one
    // keyed to another account, so without this check a change of subject would
    // briefly show the previous user's meetings.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === userSub ? previous : undefined,
    
    retry: salesRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/**
 * One meeting's Drive attachments, fetched only once a row is opened.
 *
 * `enabled` on a non-null id rather than a separate imperative fetch, so the
 * dialog gets React Query's loading and error states for free and a second
 * open of the same row is instant.
 *
 * Worth knowing: this GET has a side effect on the server — it grants the host
 * editor permission on any video/mp4 attachment. That is why it is not
 * prefetched for every visible row.
 */
export function useMeetingAttachments(meetingId: number | null) {
  const { getAccessToken, userSub, ready } = useSalesQueryBasis();
  return useQuery<AttachmentList>({
    queryKey: ["sales-attachments", userSub, meetingId],
    enabled: ready && meetingId !== null,
    queryFn: async () =>
      authedGet<AttachmentList>(
        salesServiceUrls.attachments(meetingId as number),
        await getAccessToken(),
        undefined,
        echoRead,
      ),
    staleTime: 5 * 60 * 1000,
    retry: salesRetry,
  });
}

/**
 * A signed URL for streaming one meeting's recording.
 *
 * `enabled` on a non-null id, so nothing is requested until someone actually opens a
 * recording.
 *
 * `staleTime: 0` and no caching beyond the component's life: the URL expires, and a cached
 * one handed to a player an hour later is a token that fails on its first range request.
 
 * No retry on an answer: the failures here are 404 (playback not configured, or no
 * recording attached yet) and 403 (not your meeting), both final. A timeout is retried
 * once, since it says nothing about the answer.
 */
export function useRecordingPlayback(meetingId: number | null, recordingId?: number) {
  const { getAccessToken, userSub, ready } = useSalesQueryBasis();
  return useQuery<PlaybackUrl>({
    // The part is in the key: each recording of a call has its own file and its own URL.
    queryKey: ["sales-playback", userSub, meetingId, recordingId ?? null],
    enabled: ready && meetingId !== null,
    queryFn: async () =>
      authedGet<PlaybackUrl>(
        salesServiceUrls.playback(meetingId as number, recordingId),
        await getAccessToken(),
        undefined,
        echoRead,
      ),
    staleTime: 0,
    gcTime: 0,
    retry: retryOnTimeout,
  });
}

/**
 * One meeting, resolved from its id alone.
 *
 * What the detail page loads from. Deliberately not read out of the list's cache: a page
 * reached by a shared link or a refresh has no list behind it, and a page that only worked
 * when you arrived by clicking would be a page that breaks exactly when someone shares it.
 */
export function useMeeting(meetingId: number | null) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useSalesQueryBasis();
  const query = useQuery<Meeting>({
    queryKey: ["sales-meeting", userSub, meetingId],
    enabled: ready && meetingId !== null,
    queryFn: async () =>
      authedGet<Meeting>(
        salesServiceUrls.meetingById(meetingId as number),
        await getAccessToken(),
        undefined,
        echoRead,
      ),
    staleTime: 60 * 1000,
    retry: salesRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/**
 * The transcript, as timed lines.
 *
 * `enabled` on a non-null id so nothing is fetched until the tab is openedd.
 *
 * No retry on an answer: the failures are 404 (no timed transcript for this meeting) and
 * 403 (not yours), both final. A timeout is retried once.
 */
export function useTranscript(meetingId: number | null, transcriptId?: number) {
  const { getAccessToken, userSub, ready } = useSalesQueryBasis();
  return useQuery<Transcript>(transcriptQuery(getAccessToken, userSub, ready, meetingId, transcriptId));
}

/**
 * Every transcript of a call, one query each, in the order given.
 *
 * Shares its cache with useTranscript: the same part fetched by the timeline and the
 * Transcript tab is one request. An empty list asks for the backend's default transcript,
 * as a meeting from before parts were listed had only that one.
 */
export function useTranscripts(meetingId: number | null, transcriptIds: readonly number[]) {
  const { getAccessToken, userSub, ready } = useSalesQueryBasis();
  const ids: (number | undefined)[] = transcriptIds.length > 0 ? [...transcriptIds] : [undefined];
  return useQueries({
    queries: ids.map((id) => transcriptQuery(getAccessToken, userSub, ready, meetingId, id)),
  });
}

function transcriptQuery(
  getAccessToken: () => Promise<string>,
  userSub: string | undefined,
  ready: boolean,
  meetingId: number | null,
  transcriptId: number | undefined,
) {
  return {
    queryKey: ["sales-transcript", userSub, meetingId, transcriptId ?? null],
    enabled: ready && meetingId !== null,
    queryFn: async () =>
      authedGet<Transcript>(
        salesServiceUrls.transcript(meetingId as number, transcriptId),
        await getAccessToken(),
        undefined,
        echoRead,
      ),
    // A finished meeting's transcript never changes, so it is worth holding for the visit.
    staleTime: 30 * 60 * 1000,
    retry: retryOnTimeout,
  };
}

/** One smart notes of the call, as plain text. Same gating and reasoning as useTranscript. */
export function useSmartNotes(meetingId: number | null, smartNoteId?: number) {
  const { getAccessToken, userSub, ready } = useSalesQueryBasis();
  return useQuery<SmartNotes>({
    queryKey: ["sales-smart-notes", userSub, meetingId, smartNoteId ?? null],
    enabled: ready && meetingId !== null,
    queryFn: async () =>
      authedGet<SmartNotes>(
        salesServiceUrls.smartNotes(meetingId as number, smartNoteId),
        await getAccessToken(),
        undefined,
        echoRead,
      ),
    staleTime: 30 * 60 * 1000,
    retry: retryOnTimeout,
  });
}
