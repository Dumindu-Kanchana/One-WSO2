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

import { useState, type JSX } from "react";
import { Navigate, useNavigate } from "react-router";
import RoutedTabs from "@components/routed-tabs/RoutedTabs";
import type { Allocation } from "../api/engagementTypes";
import { useAllocations, useEngagementTypes } from "../api/useEngagementApi";
import { useEngagementAccess } from "../api/useEngagementUserInfo";
import EaPage from "../components/EaPage";
import EaTable, { type Column, tableState } from "../components/EaTable";
import { Empty, Failed, ListCard } from "../components/ListCard";
import ListToolbar, { type FilterDef } from "../components/ListToolbar";
import { AllocationStatusChip, codeSub, Two, Mono } from "../components/StatusChips";
import { engagementPaths, type AllocationsSegment } from "../engagementPaths";
import { canEditAllocationStatus } from "../model/engagementAccess";
import { engagementName, fmtRange } from "../model/format";
import { ALLOCATION_STATUSES } from "../model/statuses";
import { useListView } from "../model/useListView";
import { HourlyLabel, TravelCell } from "./allocationCells";
import AllocationStatusDialog from "./AllocationStatusDialog";
import TeamAllocationsPanel from "./TeamAllocationsPanel";

/** `/allocations`: the first tab this person may open. */
export function AllocationsIndex(): JSX.Element {
  const access = useEngagementAccess();
  return <Navigate to={engagementPaths.allocations(access.engagementAllocations ? "engagement" : "team")} replace />;
}

/** Allocations: the legacy Engagement Allocations / Internal Allocations tabs as one list, and the Team Allocations page as the second tab. */
export default function AllocationsPage({ segment }: { segment: AllocationsSegment }): JSX.Element {
  const access = useEngagementAccess();
  const allowed = segment === "engagement" ? access.engagementAllocations : access.teamAllocations;
  if (!allowed) return <Navigate to={engagementPaths.allocations(access.engagementAllocations ? "engagement" : "team")} replace />;
  const both = access.engagementAllocations && access.teamAllocations;
  return (
    <EaPage collapsedSearch
      title="Allocations"
      subtitle={
        access.teamAllocations
          ? "Who is allocated where, and the default allocations each team falls back to."
          : "Who is allocated where, and where each allocation stands."
      }
    >
      <ListCard>
        {both ? (
          <RoutedTabs
            basePath={engagementPaths.allocations()}
            ariaLabel="Allocation views"
            tabs={[
              { segment: "engagement", label: "Engagement Allocations" },
              { segment: "team", label: "Team Allocations" },
            ]}
          />
        ) : null}
        {segment === "engagement" ? <EngagementAllocations /> : <TeamAllocationsPanel />}
      </ListCard>
    </EaPage>
  );
}

function EngagementAllocations(): JSX.Element {
  const { p } = useEngagementAccess();
  const navigate = useNavigate();
  const list = useListView("allocations", { defaultSort: "-created" });
  const types = useEngagementTypes();
  const [statusOf, setStatusOf] = useState<Allocation | null>(null);
  const pair = (v: string): readonly [string, string] => [v, v];

  const filters: FilterDef[] = [
    { key: "kind", label: "Engagement", type: "multi", options: [["customer", "Customer"], ["internal", "Internal"], ["marketing", "Marketing Events"]] },
    { key: "engagementTypeId", label: "Engagement Type", type: "multi", options: (types.data ?? []).filter((t) => t.active).map((t) => [String(t.id), t.name] as const) },
    { key: "clearanceStatus", label: "Allocation Status", type: "multi", options: ALLOCATION_STATUSES.map(pair) },
    {
      key: "allocationType",
      label: "Allocation Type",
      type: "multi",
      options: [...new Set((types.data ?? []).flatMap((t) => t.allocationTypes.map((a) => a.name)))].sort().map(pair),
    },
    { key: "travelRequired", label: "Travel Required", type: "select", options: [["true", "Yes"], ["false", "No"]] },
    { key: "startFrom", label: "Start Date From", type: "date" },
    { key: "endTo", label: "End Date To", type: "date" },
  ];
  const allocations = useAllocations(list.paramsFor(filters));

  const columns: Column<Allocation>[] = [
    { key: "id", label: "Allocation", sortKey: "id", render: (a) => <Mono>{a.id}</Mono> },
    { key: "who", label: "Consultant", sortKey: "consultant", render: (a) => <Two main={a.consultant.name} sub={a.consultant.email} /> },
    {
      key: "eng",
      label: "Engagement",
      width: "22%",
      sortKey: "engagement",
      render: (a) => <Two main={<Mono>{a.engagement.id}</Mono>} sub={engagementName(a.engagement)} />,
    },
    { key: "type", label: "Allocation Type", sortKey: "type", render: (a) => <Two main={a.engagement.allocationType} sub={codeSub(a.engagement.kind, a.engagement.code)} /> },
    { key: "dates", label: "Dates", sortKey: "startDate", render: (a) => <Two main={<span style={{ whiteSpace: "nowrap" }}>{fmtRange(a.start, a.end)}</span>} sub={<HourlyLabel allocation={a} />} /> },
    { key: "travel", label: "Travel", render: (a) => <TravelCell allocation={a} /> },
    { key: "status", label: "Allocation Status", sortKey: "status", render: (a) => <AllocationStatusChip status={a.status} /> },
  ];

  const filtered = Object.keys(list.filters).length > 0 || Boolean(list.search);
  return (
    <>
      <ListToolbar
        search={list.search}
        placeholder="Search allocations"
        onSearch={list.setSearch}
        filters={filters}
        applied={list.filters}
        onApply={list.setFilters}
        onRemove={list.removeFilter}
      />
      {allocations.isError ? (
        <Failed what="allocations" error={allocations.error} onRetry={() => void allocations.refetch()} retrying={allocations.isFetching} />
      ) : (
        <EaTable
          ariaLabel="Allocations"
          columns={columns}
          rows={allocations.data?.items ?? []}
          rowKey={(a) => a.id}
          {...tableState(allocations)}
          onRowClick={(a) => navigate(engagementPaths.engagement(a.engagement.id))}
          actions={(a) =>
            (a.canChangeStatus ?? canEditAllocationStatus(p, a.engagement.typeId)) && !/Cancelled/.test(a.status) ? [{ label: "Update Allocation Status", onClick: () => setStatusOf(a) }] : []
          }
          sorting={list.sorting}
          pagination={list.pager(allocations.data?.total ?? 0, allocations.isPlaceholderData)}
          empty={
            filtered ? (
              <Empty title="No Allocations Match" body="Change the search or the filters to see more." />
            ) : (
              <Empty title="No Allocations Yet" body="Allocations appear here once consultants are allocated to the engagements you can see." />
            )
          }
        />
      )}
      {statusOf ? <AllocationStatusDialog allocation={statusOf} onClose={() => setStatusOf(null)} /> : null}
    </>
  );
}
