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
import { useNavigate } from "react-router";
import { useMyTravelRequests } from "../api/useEngagementApi";
import EaPage from "../components/EaPage";
import EaTable, { tableState } from "../components/EaTable";
import { Empty, Failed, ListCard } from "../components/ListCard";
import ListToolbar from "../components/ListToolbar";
import { myEngagementPaths } from "../engagementPaths";
import { TRAVEL_STATUSES } from "../model/statuses";
import { columnAccessors, sortRows } from "../model/sorting";
import { useListView } from "../model/useListView";
import { travelColumns } from "../travel/travelColumns";
import { TravelsFocus } from "./FocusCards";

/** My Travels: the Travel app's My Travel Requests page. */
export default function MyTravelRequestsPage(): JSX.Element {
  const trips = useMyTravelRequests();
  const navigate = useNavigate();
  const list = useListView("my-travels");
  const all = trips.data ?? [];
  const q = list.search.toLowerCase();
  const f = list.filters;
  const rows = [...all]
    .filter((t) => !q || [t.jobNumber, t.city, t.country, t.engagement?.account, t.engagement?.title, t.travelAgent].some((x) => (x ?? "").toLowerCase().includes(q)))
    .filter((t) => (!f.status || f.status.split(",").includes(t.status)) && (!f.country || t.country === f.country))
    .filter((t) => (!f.startFrom || t.start >= f.startFrom) && (!f.endTo || t.end <= f.endTo))
    .sort((a, b) => (a.start < b.start ? 1 : -1));
  const columns = travelColumns({ traveller: false });
  const sorted = sortRows(rows, list.sort, columnAccessors(columns));
  const pair = (v: string): readonly [string, string] => [v, v];
  return (
    <EaPage collapsedSearch title="Travels" subtitle="Your travels, with the per diems, invoices and payments booked against them.">
      <TravelsFocus trips={all} loading={trips.isPending} />
      <ListCard>
        <ListToolbar
            search={list.search}
            placeholder="Search my travels"
            onSearch={list.setSearch}
            filters={[
              { key: "status", label: "Travel Status", type: "multi", options: TRAVEL_STATUSES.map(pair) },
              { key: "country", label: "Country", type: "select", options: [...new Set(all.map((t) => t.country))].sort().map(pair) },
              { key: "startFrom", label: "Start Date From", type: "date" },
              { key: "endTo", label: "End Date To", type: "date" },
            ]}
            applied={list.filters}
            onApply={list.setFilters}
            onRemove={list.removeFilter}
          />
        {trips.isError ? (
          <Failed what="your travels" error={trips.error} onRetry={() => void trips.refetch()} retrying={trips.isFetching} />
        ) : (
          <EaTable
            ariaLabel="My travels"
            columns={columns}
            rows={list.pageOf(sorted)}
            sorting={list.sorting}
            pagination={list.pager(sorted.length)}
            rowKey={(t) => t.jobNumber}
            {...tableState(trips)}
            onRowClick={(t) => navigate(myEngagementPaths.travelRequest(t.jobNumber))}
            empty={
              all.length ? (
                <Empty title="No Travels Match" body="Change the search or the filters to see more." />
              ) : (
                <Empty
                  title="No Travels Yet"
                  body="A travel request is created for you when an allocation that needs travel is confirmed. Its trip, per diems and payments show here."
                />
              )
            }
          />
        )}
      </ListCard>
    </EaPage>
  );
}
