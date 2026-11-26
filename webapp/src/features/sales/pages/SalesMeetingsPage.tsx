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

import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Alert, Box, Button } from "@wso2/oxygen-ui";
import SalesShell from "../components/SalesShell";
import MeetingFilters from "../components/MeetingFilters";
import MeetingsTable from "../components/MeetingsTable";
import AttachmentsDialog from "../components/AttachmentsDialog";
import type { Meeting, MeetingScope } from "../api/salesTypes";
import { isSalesBackendConfigured, useSalesRegions, useMeetings } from "../api/useSalesData";
import { describeError, isForbidden } from "../util/salesError";
import { meetingPath } from "../util/salesPaths";
import { isEchoBackendConfigured } from "@config/apiConfig";
import { useCallContext } from "../callContext/api/useCallContext";
import { contextRequestFor, storedContextView } from "../callContext/util/callContext";
import { useEchoCalls } from "../echoCalls/api/useEchoCalls";
import EchoCallFilters from "../echoCalls/components/EchoCallFilters";
import {
  NO_FILTERS,
  filtersFromSearch,
  filtersToSearch,
  hasEchoFilters,
  type CallFilters,
} from "../echoCalls/util/callFilters";

const DEFAULT_PAGE_SIZE = 10;

/**
 * Echo — the calls it recorded.
 *
 * Ported from meet-app's Meeting History tab. Create Meeting and the Dashboard
 * are deliberately not here: scheduling still happens in the calendar add-on,
 * and the analytics screen is not part of this one. Nothing of MEDDPICC either:
 * a call's analysis is on its own page, and a deal's is under Opportunities.
 *
 * TWO SOURCES. The Echo scope lists from the Echo backend (ONE_WSO2_ECHO_BACKEND_URL),
 * which keeps each call's Salesforce context and so can filter every call by owner,
 * region, account or opportunity, call type and date. The All scope lists from the Sales
 * backend as it always has, with its own region and search, and fetches the live context
 * of the page it shows. Without the Echo backend (not configured, or failing) the Echo
 * scope falls back to the Sales backend's Echo list and says so.
 *
 * The filters live in the URL, so a filtered view is a link that can be shared.
 */
export default function SalesMeetingsPage() {
  const configured = isSalesBackendConfigured();
  const echoConfigured = isEchoBackendConfigured();

  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromSearch(searchParams), [searchParams]);
  const filterKey = filtersToSearch(filters).toString();

  // Any filter change invalidates the current page number — page 4 of the old result set
  // is meaningless in the new one, and asking the server for it yields an empty table that
  // looks like "no meetings" rather than "you are past the end".
  //
  // The page is held against the filters it was chosen under, rather than reset by the
  // handlers: the filters arrive through the URL, so a Back, a pasted link or a handler all
  // reset it the same way, and no render ever pairs new filters with an old page.
  const [paging, setPaging] = useState({ key: filterKey, page: 0 });
  const page = paging.key === filterKey ? paging.page : 0;
  const setPage = (next: number) => setPaging({ key: filterKey, page: next });
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [attachmentsFor, setAttachmentsFor] = useState<Meeting | null>(null);

  const navigate = useNavigate();

  const update = (patch: Partial<CallFilters>) => {
    // Replaced rather than pushed, so Back leaves the list instead of stepping through filters.
    setSearchParams(filtersToSearch({ ...filters, ...patch }), { replace: true });
  };

  const regionsQuery = useSalesRegions();

  // ---- The Echo scope, from the Echo backend ----------------------------------------
  const echoWanted = filters.scope === "echo" && echoConfigured;
  const echoQuery = useEchoCalls(
    {
      page,
      pageSize,
      q: filters.q,
      owners: filters.owners,
      regions: filters.regions,
      types: filters.types,
      accounts: filters.accounts,
      opportunities: filters.opportunities,
      from: filters.from,
      to: filters.to,
    },
    echoWanted,
  );
  const echoFailed = echoWanted && echoQuery.isError;
  const fromEcho = echoWanted && !echoFailed;

  // ---- The All scope, and the Echo scope's fallback, from the Sales backend ----------
  // Both scopes list past meetings only; the "already ended" cutoff is computed per fetch
  // inside useMeetings, so any refetch picks up meetings that have ended since.
  const meetingsQuery = useMeetings({
    search: filters.q,
    // Its own region list, one at a time. Echo meetings carry none there, so the filter
    // is disabled for the Echo scope.
    region: filters.scope === "all" ? (filters.regions[0] ?? null) : null,
    echoOnly: filters.scope === "echo",
    page,
    pageSize,
    enabled: !fromEcho,
  });

  const calls = useMemo(() => (fromEcho ? (echoQuery.data?.calls ?? []) : []), [fromEcho, echoQuery.data]);
  const meetings = fromEcho ? calls.map((call) => call.meeting) : (meetingsQuery.data?.meetings ?? []);
  const totalCount = (fromEcho ? echoQuery.data?.count : meetingsQuery.data?.count) ?? 0;

  // The calls' opportunity and account details. The Echo list brings its own; a Sales
  // backend page asks the Echo backend for the live details of every call on it, in one
  // request. Neither blocks or breaks the list: until (or unless) they arrive, the rows
  // show the meeting's own data.
  const liveRequest = contextRequestFor(fromEcho ? [] : meetings);
  const liveContext = useCallContext(liveRequest.opportunityIds, liveRequest.accountIds);
  const context = useMemo(() => (fromEcho ? storedContextView(calls) : liveContext), [fromEcho, calls, liveContext]);

  // Picked accounts and opportunities, named from the calls listed under them.
  const knownNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const { context: c } of calls) {
      if (c.account) names[c.account.id] = c.account.name;
      if (c.opportunity?.name) names[c.opportunity.id] = c.opportunity.name;
      if (c.opportunity?.accountId && c.opportunity.accountName) names[c.opportunity.accountId] = c.opportunity.accountName;
    }
    return names;
  }, [calls]);

  const changeScope = (scope: MeetingScope) => {
    // The two scopes' filters mean different things (the Echo regions are Salesforce's
    // Sales Regions; the All scope's are the Sales backend's own), so only the search
    // text carries over.
    update({ ...NO_FILTERS, scope, q: filters.q });
  };
  const changePageSize = (next: number) => {
    setPageSize(next);
    setPage(0);
  };

  // One 403 anywhere means the caller is in no authorised group — the backend
  // refuses every endpoint in that case — so the page says so once instead of
  // repeating it per panel.
  const forbidden = isForbidden(meetingsQuery.error) || isForbidden(regionsQuery.error);
  const listError = fromEcho ? echoQuery.error : meetingsQuery.error;
  const loading = fromEcho
    ? echoQuery.isLoading || echoQuery.isFetching
    : meetingsQuery.isLoading || meetingsQuery.isFetching;

  return (
    <SalesShell
      title="Calls"
      subtitle="Recorded sales calls, with their recordings, transcripts and notes."
      configured={configured}
      configKey="ONE_WSO2_REVOPS_BACKEND_URL"
      forbidden={forbidden}
    >
      <Box>
        <MeetingFilters
          scope={filters.scope}
          onScopeChange={changeScope}
          region={filters.regions[0] ?? null}
          onRegionChange={(region) => update({ regions: region ? [region] : [] })}
          regions={regionsQuery.data?.regions ?? []}
          regionsLoading={regionsQuery.isLoading}
          regionDisabled={filters.scope === "echo"}
          // The Echo scope's regions are in its own filters, below.
          showRegion={!fromEcho}
          search={filters.q}
          onSearchChange={(q) => update({ q })}
          searchPlaceholder={fromEcho ? "Title, account or opportunity" : undefined}
        />

        {fromEcho && <EchoCallFilters filters={filters} onChange={update} knownNames={knownNames} />}

        {/* The Echo scope without its backend: today's list, and a word on what is missing. */}
        {filters.scope === "echo" && !echoConfigured && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Filtering by owner, region, account, call type and date isn't available: the Echo backend
            (ONE_WSO2_ECHO_BACKEND_URL) isn't configured.
          </Alert>
        )}
        {echoFailed && (
          <Alert
            severity="info"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={() => void echoQuery.refetch()}>
                Retry
              </Button>
            }
          >
            Filtering by owner, region, account, call type and date isn't available right now
            {hasEchoFilters(filters) ? ", so those filters aren't applied" : ""}.
          </Alert>
        )}

        {/* A failed list is shown here rather than swapping out the filters:
            the user's next move is almost always to change a filter, so taking
            them away would remove the fix along with the problem. */}
        {listError && !forbidden && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {describeError(listError)}
          </Alert>
        )}

        <MeetingsTable
          meetings={meetings}
          totalCount={totalCount}
          loading={loading}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={changePageSize}
          onOpenAttachments={setAttachmentsFor}
          onOpenMeeting={(meeting) => void navigate(meetingPath(meeting.meetingId))}
          context={context}
        />
      </Box>

      <AttachmentsDialog meeting={attachmentsFor} onClose={() => setAttachmentsFor(null)} />
    </SalesShell>
  );
}
