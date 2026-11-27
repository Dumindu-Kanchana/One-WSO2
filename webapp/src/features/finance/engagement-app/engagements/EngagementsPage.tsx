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
import { Button } from "@wso2/oxygen-ui";
import { PlusIcon } from "@wso2/oxygen-ui-icons-react";
import RoutedTabs from "@components/routed-tabs/RoutedTabs";
import type { EngagementSummary } from "../api/engagementTypes";
import { useEngagements, useEngagementTypes, useReferenceData } from "../api/useEngagementApi";
import { useEngagementAccess } from "../api/useEngagementUserInfo";
import EaPage from "../components/EaPage";
import { countBadge } from "../components/tabBadge";
import EaTable, { type Column, tableState } from "../components/EaTable";
import { Empty, Failed, ListCard } from "../components/ListCard";
import ListToolbar, { type FilterDef } from "../components/ListToolbar";
import { codeSub, EngagementStatusChip, RequestStatusChip, Two, Mono } from "../components/StatusChips";
import { engagementPaths, type EngagementSegment } from "../engagementPaths";
import { ALLOC } from "../model/engagementAccess";
import { engagementSegments } from "../model/landing";
import { engagementName, fmtRange, place, plural } from "../model/format";
import { ENGAGEMENT_STATUSES } from "../model/statuses";
import { useListView } from "../model/useListView";
import { useEngagementActions } from "./useEngagementActions";

const SEGMENT_LABEL: Record<EngagementSegment, string> = {
  customer: "Customer",
  internal: "Internal",
  marketing: "Marketing Events",
};

/** `/engagements`: the first segment this person may open. */
export function EngagementsIndex(): JSX.Element {
  const access = useEngagementAccess();
  return <Navigate to={engagementPaths.engagements(engagementSegments(access)[0] ?? "customer")} replace />;
}

/** Engagements: the legacy Customer Engagements and Internal Engagements hubs as one list with three segments. */
export default function EngagementsPage({ segment }: { segment: EngagementSegment }): JSX.Element {
  const access = useEngagementAccess();
  const segments = engagementSegments(access);
  const navigate = useNavigate();
  const list = useListView("engagements", { defaultSort: "-created" });
  const types = useEngagementTypes();
  const ref = useReferenceData();
  const { rowActionsFor, dialogs } = useEngagementActions();
  const cust = segment === "customer";
  const consultants = access.p.a.has(cust ? ALLOC.CUSTOMER_CONSULTANTS : ALLOC.INTERNAL_CONSULTANTS);
  const segTypes = (types.data ?? []).filter((t) => (cust ? t.kind === "Customer" : t.id === (segment === "marketing" ? 5 : 1)));
  const allocTypes = [...new Set(segTypes.flatMap((t) => t.allocationTypes.map((a) => a.name)))].sort();
  const pair = (v: string): readonly [string, string] => [v, v];

  const filters: FilterDef[] = [
    ...(cust
      ? [{ key: "engagementTypeId", label: "Engagement Type", type: "select" as const, options: segTypes.map((t) => [String(t.id), t.name] as const) }]
      : []),
    { key: "allocationType", label: segment === "marketing" ? "Event Type" : "Allocation Type", type: "select", options: allocTypes.map(pair) },
    {
      key: "requestStatus",
      label: "Request Status",
      type: "multi",
      options: (cust ? ["New", "Updated", "In Progress", "Completed", "Cancelled"] : ["Pending Approval", "Approved", "Updated", "In Progress", "Completed", "Cancelled"]).map(pair),
    },
    { key: "engagementStatus", label: "Engagement Status", type: "multi", options: ENGAGEMENT_STATUSES.map(pair) },
    { key: "businessUnit", label: "Business Unit", type: "select", options: (ref.data?.businessUnits ?? []).map(pair) },
    { key: "country", label: "Country", type: "select", options: (ref.data?.countries ?? []).map(pair) },
    { key: "consultants", label: "Consultants", type: "select", options: [["allocated", "Allocated"], ["none", "None Yet"]] },
    { key: "startFrom", label: "Start Date From", type: "date" },
    { key: "startTo", label: "Start Date To", type: "date" },
    { key: "endTo", label: "End Date To", type: "date" },
  ];
  const engagements = useEngagements(
    // includePending: what was just created, still waiting for approval, is in the list.
    { segment, includePending: true, ...list.paramsFor(filters) },
    segments.includes(segment),
  );

  if (!segments.includes(segment)) return <Navigate to={engagementPaths.engagements(segments[0])} replace />;

  const columns: Column<EngagementSummary>[] = [
    {
      key: "engagement",
      label: segment === "marketing" ? "Event" : "Engagement",
      width: "24%",
      sortKey: "id",
      render: (e) => <Two main={<Mono>{e.id}</Mono>} sub={cust ? engagementName(e) : e.title} />,
    },
    {
      key: "type",
      label: segment === "marketing" ? "Event Type" : "Allocation Type",
      sortKey: "type",
      render: (e) => <Two main={e.allocationType} sub={codeSub(e.kind, e.code)} />,
    },
    { key: "location", label: "Location", sortKey: "country", render: (e) => <Two main={place(e.country, e.city)} sub={e.nature} /> },
    { key: "dates", label: "Dates", sortKey: "startDate", render: (e) => <span style={{ whiteSpace: "nowrap" }}>{fmtRange(e.start, e.end)}</span> },
    ...(consultants
      ? [
          {
            key: "consultants",
            label: "Consultants",
            render: (e: EngagementSummary) => {
              const people = e.consultants ?? [];
              if (!people.length) return "—";
              const names = people.slice(0, 2).map((p) => p.name).join(", ");
              return <Two main={plural(people.length, "consultant")} sub={people.length > 2 ? `${names} +${people.length - 2}` : names} />;
            },
          },
        ]
      : []),
    { key: "request", label: "Request Status", sortKey: "requestStatus", render: (e) => <RequestStatusChip status={e.requestStatus} /> },
    { key: "status", label: "Engagement Status", sortKey: "engagementStatus", render: (e) => <EngagementStatusChip status={e.engagementStatus} /> },
  ];

  const create =
    segment === "customer" && access.createCustomer ? (
      <CreateButton label="Create Customer Engagement" onClick={() => navigate(engagementPaths.newEngagement("customer"))} />
    ) : segment === "internal" && access.createInternal ? (
      <CreateButton label="Create Internal Engagement" onClick={() => navigate(engagementPaths.newEngagement("internal", 1))} />
    ) : segment === "marketing" && access.createMarketing ? (
      <CreateButton label="Create Marketing Event" onClick={() => navigate(engagementPaths.newEngagement("internal", 5))} />
    ) : null;

  const counts = engagements.data?.counts;
  const filtered = Object.keys(list.filters).length > 0 || Boolean(list.search);
  const names = segments.map((s) => ({ customer: "customer engagements", internal: "internal engagements", marketing: "marketing events" })[s]);
  const what = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];

  return (
    <EaPage collapsedSearch
      title="Engagements"
      subtitle={`${what.charAt(0).toUpperCase()}${what.slice(1)}, and who is working on them.`}
    >
      <ListCard>
        {segments.length > 1 ? (
          <RoutedTabs
            basePath={engagementPaths.engagements()}
            ariaLabel="Engagement kinds"
            keepSearchParams={["q", "sort", "country", "businessUnit", "consultants", "startFrom", "startTo", "endTo"]}
            tabs={segments.map((s) => ({
              segment: s,
              label: SEGMENT_LABEL[s],
              ...countBadge(counts?.[s], (n) => `${n} ${SEGMENT_LABEL[s]}`, engagements.isPending),
            }))}
          />
        ) : null}
        <ListToolbar
          search={list.search}
          placeholder="Search engagements"
          onSearch={list.setSearch}
          filters={filters}
          applied={list.filters}
          onApply={list.setFilters}
          onRemove={list.removeFilter}
          right={create}
        />
        {engagements.isError ? (
          <Failed what="engagements" error={engagements.error} onRetry={() => void engagements.refetch()} retrying={engagements.isFetching} />
        ) : (
          <EaTable
            ariaLabel="Engagements"
            columns={columns}
            rows={engagements.data?.items ?? []}
            rowKey={(e) => e.id}
            {...tableState(engagements)}
            onRowClick={(e) => navigate(engagementPaths.engagement(e.id))}
            actions={rowActionsFor}
            sorting={list.sorting}
            pagination={list.pager(engagements.data?.total ?? 0, engagements.isPlaceholderData)}
            empty={
              filtered ? (
                <Empty title="No Engagements Match" body="Change the search or the filters to see more." />
              ) : (
                <Empty
                  title={segment === "marketing" ? "No Marketing Events Yet" : "No Engagements Yet"}
                  body="Engagements you can see appear here once they are created."
                  action={create}
                />
              )
            }
          />
        )}
      </ListCard>
      {dialogs}
    </EaPage>
  );
}

function CreateButton({ label, onClick }: { label: string; onClick: () => void }): JSX.Element {
  return (
    <Button size="small" variant="contained" startIcon={<PlusIcon size={14} />} onClick={onClick}>
      {label}
    </Button>
  );
}
