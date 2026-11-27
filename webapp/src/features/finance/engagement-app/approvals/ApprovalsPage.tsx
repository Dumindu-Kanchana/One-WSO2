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
import RoutedTabs from "@components/routed-tabs/RoutedTabs";
import type { EngagementSummary } from "../api/engagementTypes";
import { useApprovals } from "../api/useEngagementApi";
import { useEngagementAccess } from "../api/useEngagementUserInfo";
import EaPage from "../components/EaPage";
import { countBadge } from "../components/tabBadge";
import EaTable, { type Column, tableState } from "../components/EaTable";
import { Empty, Failed, ListCard } from "../components/ListCard";
import ListToolbar from "../components/ListToolbar";
import { codeSub, Two, Mono } from "../components/StatusChips";
import { engagementPaths, type ApprovalSegment } from "../engagementPaths";
import { ALLOC, type EngagementAccess } from "../model/engagementAccess";
import { fmtDate, fmtRange, place } from "../model/format";
import { useListView } from "../model/useListView";
import { useEngagementActions } from "../engagements/useEngagementActions";

const segmentsOf = (access: EngagementAccess): ApprovalSegment[] => [
  ...(access.p.a.has(ALLOC.APPROVE_INTERNAL_VIEW) ? (["internal"] as const) : []),
  ...(access.p.a.has(ALLOC.APPROVE_MARKETING_VIEW) ? (["marketing"] as const) : []),
];

/** `/approvals`: the first tab this person may open. */
export function ApprovalsIndex(): JSX.Element {
  const access = useEngagementAccess();
  return <Navigate to={engagementPaths.approvals(segmentsOf(access)[0] ?? "internal")} replace />;
}

/** The legacy Approve page with its two tabs: the internal engagements and marketing events still in Pending Approval, oldest first. */
export default function ApprovalsPage({ segment }: { segment: ApprovalSegment }): JSX.Element {
  const access = useEngagementAccess();
  const segments = segmentsOf(access);
  const navigate = useNavigate();
  const list = useListView("approvals");
  const mkt = segment === "marketing";
  const query = useApprovals(mkt ? "events" : "internal", list.paramsFor(), segments.includes(segment));
  const { rowActionsFor, dialogs } = useEngagementActions();
  const counts = query.data?.counts;
  // A backend that sends no counts: each tab's is asked for on its own, so neither badge depends on the tab that is open.
  const needCounts = segments.length > 1 && Boolean(query.data) && !counts;
  const tabTotal = { internal: useApprovals("internal", { limit: 1 }, needCounts), events: useApprovals("events", { limit: 1 }, needCounts) };

  if (!segments.includes(segment)) return <Navigate to={engagementPaths.approvals(segments[0])} replace />;

  // The backend searches, pages and keeps the legacy oldest-first order.
  const rows = query.data?.items ?? [];

  const columns: Column<EngagementSummary>[] = [
    { key: "e", label: mkt ? "Event" : "Engagement", width: "24%", sortKey: "id", render: (e) => <Two main={<Mono>{e.id}</Mono>} sub={e.title} /> },
    { key: "type", label: mkt ? "Event Type" : "Allocation Type", sortKey: "type", render: (e) => <Two main={e.allocationType} sub={codeSub(e.kind, e.code)} /> },
    { key: "loc", label: "Location", sortKey: "country", render: (e) => <Two main={place(e.country, e.city)} sub={e.nature} /> },
    { key: "dates", label: "Dates", sortKey: "startDate", render: (e) => <span style={{ whiteSpace: "nowrap" }}>{fmtRange(e.start, e.end)}</span> },
    mkt
      ? {
          key: "funding",
          label: "Funding",
          render: (e) => (
            <>
              {(e.funding ?? []).map((f, i) => (
                <div key={i}>{`${f.businessUnit} ${f.percentage}%`}</div>
              ))}
            </>
          ),
        }
      : { key: "bu", label: "Business Unit", sortKey: "businessUnit", render: (e) => e.businessUnit || "—" },
    { key: "by", label: "Created By", sortKey: "created", render: (e) => <Two main={<span style={{ whiteSpace: "nowrap" }}>{e.createdBy?.name ?? "—"}</span>} sub={e.createdOn ? fmtDate(e.createdOn) : undefined} /> },
  ];

  const what = segments.length > 1 ? "Internal engagements and marketing events" : mkt ? "Marketing events" : "Internal engagements";
  const count = (key: "internal" | "events") =>
    countBadge(counts?.[key] ?? tabTotal[key].data?.total, (n) => `${n} waiting for approval`, query.isPending || (needCounts && tabTotal[key].isPending));

  return (
    <EaPage collapsedSearch title="Approvals" subtitle={`${what} waiting for approval. People can be allocated once they are approved.`}>
      <ListCard>
        {segments.length > 1 ? (
          <RoutedTabs
            basePath={engagementPaths.approvals()}
            ariaLabel="Approval kinds"
            keepSearchParams={["q", "sort"]}
            tabs={[
              { segment: "internal", label: "Internal Engagements", ...count("internal") },
              { segment: "marketing", label: "Marketing Events", ...count("events") },
            ]}
          />
        ) : null}
        <ListToolbar search={list.search} placeholder={mkt ? "Search events" : "Search engagements"} onSearch={list.setSearch} />
        {query.isError ? (
          <Failed what="the approvals" error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
        ) : (
          <EaTable
            ariaLabel="Waiting for approval"
            columns={columns}
            rows={rows}
            rowKey={(e) => e.id}
            {...tableState(query)}
            pagination={list.pager(query.data?.total ?? 0, query.isPlaceholderData)}
            // Everything here is waiting for approval, so a row opens on Details, where the approver reads what is being approved.
            onRowClick={(e) => navigate(engagementPaths.engagement(e.id, "details"))}
            actions={rowActionsFor}
            sorting={list.sorting}
            empty={
              <Empty
                title={list.search ? (mkt ? "No Marketing Events Match" : "No Internal Engagements Match") : mkt ? "No Marketing Events Waiting" : "No Internal Engagements Waiting"}
                body={list.search ? "Change the search to see more." : "New ones appear here as soon as they are created."}
              />
            }
          />
        )}
      </ListCard>
      {dialogs}
    </EaPage>
  );
}
