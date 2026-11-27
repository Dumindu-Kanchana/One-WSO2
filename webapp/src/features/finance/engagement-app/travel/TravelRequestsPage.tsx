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

import type { JSX } from "react";
import { Navigate, useNavigate } from "react-router";
import { Box } from "@wso2/oxygen-ui";
import RoutedTabs from "@components/routed-tabs/RoutedTabs";
import type { TravelRequestSummary } from "../api/engagementTypes";
import { useReferenceData, useTravelRequests } from "../api/useEngagementApi";
import { useEngagementAccess } from "../api/useEngagementUserInfo";
import EaPage from "../components/EaPage";
import { countBadge } from "../components/tabBadge";
import EaTable, { tableState } from "../components/EaTable";
import { Empty, Failed, ListCard, SectionTitle } from "../components/ListCard";
import ListToolbar, { type FilterDef } from "../components/ListToolbar";
import { engagementPaths, type TravelSegment } from "../engagementPaths";
import type { EngagementAccess } from "../model/engagementAccess";
import { TRAVEL_STATUSES } from "../model/statuses";
import { useListView } from "../model/useListView";
import { useTravelRowActions } from "./useTravelRowActions";
import { travelColumns } from "./travelColumns";

const LABEL: Record<TravelSegment, string> = { new: "New", "in-progress": "In Progress", completed: "Completed", all: "All" };

const segmentsOf = (access: EngagementAccess): TravelSegment[] => [
  ...(access.newTravelRequests ? (["new"] as const) : []),
  "in-progress",
  "completed",
  "all",
];

/** `/travel-requests`: New for the Travel Team, In Progress for everyone else. */
export function TravelRequestsIndex(): JSX.Element {
  const access = useEngagementAccess();
  return <Navigate to={engagementPaths.travelRequests(access.newTravelRequests ? "new" : "in-progress")} replace />;
}

/** Travels: the travel requests in tabs; a travel agent sees only the agency's requests. */
export default function TravelRequestsPage({ segment }: { segment: TravelSegment }): JSX.Element {
  const access = useEngagementAccess();
  const segments = segmentsOf(access);
  const navigate = useNavigate();
  const list = useListView("travel");
  const ref = useReferenceData();
  // With one or two new requests, In Progress shows them as a short block above it.
  const wantFresh = access.newTravelRequests && segment === "in-progress" && !list.search;
  const fresh = useTravelRequests({ segment: "new", limit: 3 }, wantFresh);
  const { rowActions, dialogs } = useTravelRowActions();
  const agent = access.isAgent;
  const pair = (v: string): readonly [string, string] => [v, v];
  const filters: FilterDef[] = [
    { key: "country", label: "Country", type: "multi", options: (ref.data?.countries ?? []).map(pair) },
    ...(agent ? [] : [{ key: "agency", label: "Travel Agent", type: "multi" as const, options: (ref.data?.travelAgents ?? []).map(pair) }]),
    { key: "status", label: "Travel Status", type: "multi", options: TRAVEL_STATUSES.map(pair) },
    { key: "startFrom", label: "Start Date From", type: "date" },
    { key: "endTo", label: "End Date To", type: "date" },
  ];
  const trips = useTravelRequests({ segment, ...list.paramsFor(filters) }, segments.includes(segment));
  if (!segments.includes(segment)) return <Navigate to={engagementPaths.travelRequests(segments[0])} replace />;
  const counts = trips.data?.counts;
  const freshRows = fresh.data?.items ?? [];
  // Until the new requests arrive, the list's own count of them says whether the block is coming, so it holds its place from the start.
  const freshCount = fresh.data ? freshRows.length : (counts?.new ?? 0);
  const showFresh = wantFresh && !fresh.isError && freshCount > 0 && freshCount <= 2;
  const columns = travelColumns({ agent });
  const open = (t: TravelRequestSummary) => navigate(engagementPaths.travelRequest(t.jobNumber));

  return (
    <EaPage collapsedSearch
      title="Travels"
      subtitle={
        agent
          ? "Travels handled by your agency."
          : access.newTravelRequests
            ? "Travel requests from confirmed allocations. Assign the new ones and manage the rest."
            : "Every travel request with its travel agent, visa and status, and the costs booked against it."
      }
    >
      {showFresh ? (
        <Box sx={{ mb: 2 }}>
          <ListCard>
            <SectionTitle>New Travel Requests</SectionTitle>
            <EaTable ariaLabel="New travel requests" columns={columns} rows={freshRows} rowKey={(t) => t.jobNumber} onRowClick={open} actions={rowActions} empty={null} loading={fresh.isPending} loadingRows={freshCount} />
          </ListCard>
        </Box>
      ) : null}
      <ListCard>
        <RoutedTabs
          basePath={engagementPaths.travelRequests()}
          ariaLabel="Travel request status"
          keepSearchParams={["q", "sort", "country", "agency", "status", "startFrom", "endTo"]}
          tabs={segments.map((s) => ({
            segment: s,
            label: LABEL[s],
            ...(s === "all" ? {} : countBadge(counts?.[s], (n) => `${n} ${LABEL[s]}`, trips.isPending)),
          }))}
        />
        <ListToolbar
          search={list.search}
          placeholder="Search travels"
          onSearch={list.setSearch}
          filters={filters}
          applied={list.filters}
          onApply={list.setFilters}
          onRemove={list.removeFilter}
        />
        {trips.isError ? (
          <Failed what="travels" error={trips.error} onRetry={() => void trips.refetch()} retrying={trips.isFetching} />
        ) : (
          <EaTable
            ariaLabel="Travels"
            columns={columns}
            rows={trips.data?.items ?? []}
            rowKey={(t) => t.jobNumber}
            {...tableState(trips)}
            onRowClick={open}
            actions={rowActions}
            sorting={list.sorting}
            pagination={list.pager(trips.data?.total ?? 0, trips.isPlaceholderData)}
            empty={
              Object.keys(list.filters).length || list.search ? (
                <Empty title="No Travels Match" body="Change the search or the filters to see more." />
              ) : segment === "new" ? (
                <Empty title="No New Travel Requests" body="Every travel request has a travel agent. New ones arrive when an allocation that needs travel is confirmed." />
              ) : segment === "in-progress" ? (
                <Empty title="No Travels In Progress" body="Requests move here once a travel agent is assigned." />
              ) : (
                <Empty title="No Travels Yet" body="A travel request is created when an allocation that needs travel is confirmed." />
              )
            }
          />
        )}
      </ListCard>
      {dialogs}
    </EaPage>
  );
}
