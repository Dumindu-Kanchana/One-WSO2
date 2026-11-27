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
import type { Allocation } from "../api/engagementTypes";
import { useMyAllocations } from "../api/useEngagementApi";
import { HourlyLabel, TravelCell } from "../allocations/allocationCells";
import EaPage from "../components/EaPage";
import EaTable, { type Column, tableState } from "../components/EaTable";
import { Empty, Failed, ListCard } from "../components/ListCard";
import ListToolbar, { type FilterDef } from "../components/ListToolbar";
import { AllocationStatusChip, codeSub, Two, Mono } from "../components/StatusChips";
import { myEngagementPaths } from "../engagementPaths";
import { AllocationsFocus } from "./FocusCards";
import { engagementName, fmtRange, place } from "../model/format";
import { ALLOCATION_STATUSES } from "../model/statuses";
import { useListView } from "../model/useListView";

/** My Allocations: the person's own allocations, read-only. */
export default function MyAllocationsPage(): JSX.Element {
  const navigate = useNavigate();
  const list = useListView("my-allocations");
  const pair = (v: string): readonly [string, string] => [v, v];
  const filters: FilterDef[] = [
    { key: "clearanceStatus", label: "Allocation Status", type: "multi", options: ALLOCATION_STATUSES.map(pair) },
    { key: "travelRequired", label: "Travel Required", type: "select", options: [["true", "Yes"], ["false", "No"]] },
    { key: "startFrom", label: "Start Date From", type: "date" },
    { key: "endTo", label: "End Date To", type: "date" },
  ];
  const allocations = useMyAllocations(list.paramsFor(filters));
  const filtered = Object.keys(list.filters).length > 0 || Boolean(list.search);
  const columns: Column<Allocation>[] = [
    {
      key: "eng",
      label: "Engagement",
      width: "28%",
      sortKey: "engagement",
      render: (a) => <Two main={<Mono>{a.engagement.id}</Mono>} sub={engagementName(a.engagement)} />,
    },
    { key: "type", label: "Allocation Type", sortKey: "type", render: (a) => <Two main={a.engagement.allocationType} sub={codeSub(a.engagement.kind, a.engagement.code)} /> },
    { key: "where", label: "Location", render: (a) => <Two main={place(a.engagement.country)} sub={a.engagement.address} /> },
    { key: "dates", label: "Dates", sortKey: "startDate", render: (a) => <Two main={<span style={{ whiteSpace: "nowrap" }}>{fmtRange(a.start, a.end)}</span>} sub={<HourlyLabel allocation={a} />} /> },
    { key: "travel", label: "Travel", render: (a) => <TravelCell allocation={a} travelBase={myEngagementPaths.travelRequest} /> },
    { key: "status", label: "Allocation Status", sortKey: "status", render: (a) => <AllocationStatusChip status={a.status} /> },
  ];
  return (
    <EaPage collapsedSearch title="Allocations" subtitle="Where you are allocated, and when. Allocation managers set your allocations, and the status follows the clearance process.">
      <AllocationsFocus canOpen={(id) => (allocations.data?.items ?? []).some((a) => a.engagement.id === id && a.engagement.canOpen)} />
      <ListCard>
        <ListToolbar
          search={list.search}
          placeholder="Search my allocations"
          onSearch={list.setSearch}
          filters={filters}
          applied={list.filters}
          onApply={list.setFilters}
          onRemove={list.removeFilter}
        />
        {allocations.isError ? (
          <Failed what="your allocations" error={allocations.error} onRetry={() => void allocations.refetch()} retrying={allocations.isFetching} />
        ) : (
          <EaTable
            ariaLabel="My allocations"
            columns={columns}
            rows={allocations.data?.items ?? []}
            rowKey={(a) => a.id}
            {...tableState(allocations)}
            sorting={list.sorting}
            canOpen={(a) => a.engagement.canOpen === true}
            onRowClick={(a) => navigate(myEngagementPaths.allocation(a.engagement.id))}
            pagination={list.pager(allocations.data?.total ?? 0, allocations.isPlaceholderData)}
            empty={
              filtered ? (
                <Empty title="No Allocations Match" body="Change the search or the filters to see more." />
              ) : (
                <Empty title="No Allocations Yet" body="When an allocation manager allocates you to an engagement, it shows here with its dates and status." />
              )
            }
          />
        )}
      </ListCard>
    </EaPage>
  );
}
