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
import { Navigate, useParams } from "react-router";
import { Alert, Box, Card, Table, TableBody, TableCell, TableHead, TableRow } from "@wso2/oxygen-ui";
import RoutedTabs from "@components/routed-tabs/RoutedTabs";
import { HttpError } from "@api/http";
import type { Allocation, Engagement } from "../api/engagementTypes";
import { useEngagement } from "../api/useEngagementApi";
import { useEngagementAccess } from "../api/useEngagementUserInfo";
import AllocationStatusDialog from "../allocations/AllocationStatusDialog";
import { HourlyLabel, TravelCell } from "../allocations/allocationCells";
import EaPage from "../components/EaPage";
import EaTable, { type Column } from "../components/EaTable";
import { FactsCard, FactsGrid } from "../components/Facts";
import { Empty, Failed, ListCard } from "../components/ListCard";
import { PersonTwo } from "../components/PersonChip";
import { AllocationStatusChip, EngagementStatusChip, RequestStatusChip, Two, Mono } from "../components/StatusChips";
import { engagementPaths, myEngagementPaths, type EngagementTab } from "../engagementPaths";
import { canEditAllocationStatus } from "../model/engagementAccess";
import { lastVisitedList } from "../model/backTarget";
import { engagementSegments } from "../model/landing";
import { canSearch } from "../model/searchLinks";
import { useSortedRows } from "../model/useSortedRows";
import { engagementName, fmtDate, fmtRange, place } from "../model/format";
import { useEngagementActions } from "./useEngagementActions";
import RowActions from "../components/RowActions";
import { DetailSkeleton, FactsGridSkeleton } from "../components/EaSkeletons";

const TABS: readonly EngagementTab[] = ["allocations", "details"];

const kindLabel = (e: Engagement) => (e.kind === "marketing" ? "Marketing Event" : e.kind === "internal" ? "Internal Engagement" : e.typeName);

/** One engagement: its facts, its allocation records and its details; under Me (from Allocations) it is read-only, with no actions. */
export default function EngagementPage({ area = "finance" }: { area?: "finance" | "me" }): JSX.Element {
  const { id = "", tab = "allocations" } = useParams();
  const engagement = useEngagement(id);
  const access = useEngagementAccess();
  const { p } = access;
  const { actionsFor, dialogs } = useEngagementActions();
  const [statusOf, setStatusOf] = useState<Allocation | null>(null);

  const pathOf = area === "me" ? myEngagementPaths.allocation : engagementPaths.engagement;
  if (!TABS.includes(tab as EngagementTab)) return <Navigate to={pathOf(id)} replace />;
  // The back link names the list this record was opened from.
  const lists = [
    ...(engagementSegments(access).length ? [{ to: engagementPaths.engagements(), label: "Engagements" }] : []),
    ...(access.approvals ? [{ to: engagementPaths.approvals(), label: "Approvals" }] : []),
    ...(access.engagementAllocations ? [{ to: engagementPaths.allocations(), label: "Allocations" }] : []),
    ...(canSearch(access) ? [{ to: engagementPaths.search(), label: "Search" }] : []),
  ];
  const back =
    area === "me"
      ? { to: myEngagementPaths.allocations, label: "Allocations" }
      : (lastVisitedList(lists) ?? lists[0] ?? { to: engagementPaths.home, label: "Dashboard" });

  if (engagement.isPending) {
    return (
      <EaPage title={`Engagement ${id}`} back={back}>
        <DetailSkeleton
          facts={["Engagement ID", "Engagement Code", "Account", "Opportunity Name", "Allocation Type", "Dates", "Location"]}
          two={["Location"]}
          tabs={["Allocations", "Details"]}
        >
          {tab === "details" ? (
            <Box sx={{ pt: 1 }}>
              <FactsGridSkeleton columns={3} labels={["Engagement Type", "Customer Contact", "Business Domain", "Opportunity Owner", "Technical Owner", "Created By", "Created On"]} two={["Created By"]} />
            </Box>
          ) : (
            <AllocationRecords allocations={[]} loading canChangeStatus={false} onChangeStatus={() => undefined} empty={<></>} />
          )}
        </DetailSkeleton>
      </EaPage>
    );
  }
  if (engagement.isError) {
    const gone = engagement.error instanceof HttpError && (engagement.error.status === 404 || engagement.error.status === 403);
    return (
      <EaPage title={`Engagement ${id}`} back={back}>
        {gone ? (
          <Alert severity="info">This engagement isn&apos;t one you can open, or it doesn&apos;t exist.</Alert>
        ) : (
          <Failed what="the engagement" error={engagement.error} onRetry={() => void engagement.refetch()} retrying={engagement.isFetching} />
        )}
      </EaPage>
    );
  }

  const e = engagement.data;
  const pending = e.requestStatus === "Pending Approval";
  const { primary, menu } = actionsFor(e);
  const titleLabel = e.kind === "customer" ? "Opportunity Name" : e.kind === "marketing" ? "Event Name" : "Name / Purpose";

  return (
    <EaPage
      title={`${e.kind === "marketing" ? "Event" : "Engagement"} ${e.id}`}
      documentTitle={e.id}
      subtitle={`${kindLabel(e)}: ${e.kind === "customer" ? engagementName(e) : e.title}`}
      chips={
        <>
          <RequestStatusChip status={e.requestStatus} />
          <EngagementStatusChip status={e.engagementStatus} />
        </>
      }
      back={back}
      actions={area === "me" ? undefined : <RowActions primary={primary} menu={menu} label={e.id} />}
    >
      {pending ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This {e.kind === "marketing" ? "event" : "engagement"} is waiting for approval. People can be allocated once it is approved.
        </Alert>
      ) : null}
      <FactsCard
        facts={[
          { label: e.kind === "marketing" ? "Event ID" : "Engagement ID", value: <Mono>{e.id}</Mono> },
          { label: "Engagement Code", value: <Mono>{e.code}</Mono> },
          { label: "Account", value: e.account },
          { label: titleLabel, value: e.title },
          e.campaign && { label: "Campaign", value: <Two main={e.campaign.name} sub={<Mono>{e.campaign.id}</Mono>} /> },
          e.product && { label: "Product", value: e.product },
          { label: "Allocation Type", value: e.allocationType },
          { label: "Dates", value: fmtRange(e.start, e.end) },
          { label: "Location", value: <Two main={place(e.country, e.kind === "marketing" ? undefined : e.city)} sub={e.nature} /> },
        ]}
      />
      <ListCard>
        <RoutedTabs
          basePath={`${area === "me" ? myEngagementPaths.allocations : engagementPaths.engagements()}/${encodeURIComponent(e.id)}`}
          ariaLabel="Engagement sections"
          tabs={[
            {
              segment: "allocations",
              label: e.access === "consultants" ? "Consultants" : "Allocations",
              badge: { label: String(e.allocations.length), reason: `${e.allocations.length} allocations` },
            },
            { segment: "details", label: "Details" },
          ]}
        />
        {tab === "details" ? (
          <DetailsTab e={e} />
        ) : e.access === "consultants" ? (
          <ConsultantsTable e={e} />
        ) : (
          <AllocationRecords
            allocations={e.allocations}
            travelBase={area === "me" ? myEngagementPaths.travelRequest : engagementPaths.travelRequest}
            canChangeStatus={area !== "me" && canEditAllocationStatus(p, e.typeId)}
            onChangeStatus={setStatusOf}
            empty={
              <Empty
                title={e.requestStatus === "Cancelled" ? "No Active Allocations" : "No Consultants Allocated Yet"}
                body={`This ${e.kind === "marketing" ? "event" : "engagement"} runs ${fmtRange(e.start, e.end)}.${pending ? " People can be allocated once it is approved." : ""}`}
              />
            }
          />
        )}
      </ListCard>
      {statusOf ? <AllocationStatusDialog allocation={statusOf} onClose={() => setStatusOf(null)} /> : null}
      {dialogs}
    </EaPage>
  );
}

function ConsultantsTable({ e }: { e: Engagement }): JSX.Element {
  const columns: Column<Allocation>[] = [
    { key: "who", label: "Consultant", sortKey: "consultant", sortValue: (a) => a.consultant.email, render: (a) => <Two main={a.consultant.name} sub={a.consultant.email} /> },
    { key: "dates", label: "Allocation Dates", sortKey: "startDate", sortValue: (a) => a.start, render: (a) => fmtRange(a.start, a.end) },
  ];
  const sorted = useSortedRows(e.allocations, columns);
  return (
    <EaTable
      ariaLabel="Consultants"
      columns={columns}
      rows={sorted.rows}
      rowKey={(a) => a.id}
      sorting={sorted.sorting}
      empty={<Empty title="No Consultants Allocated Yet" body={`This engagement runs ${fmtRange(e.start, e.end)}.`} />}
    />
  );
}

/** The allocation records: also the Allocate page's lower half. */
export function AllocationRecords({
  allocations,
  canChangeStatus,
  onChangeStatus,
  empty,
  travelBase,
  loading = false,
}: {
  allocations: readonly Allocation[];
  canChangeStatus: boolean;
  onChangeStatus: (a: Allocation) => void;
  empty: JSX.Element;
  travelBase?: (job: string) => string;
  /** The engagement is still loading: the real headers over placeholder rows. */
  loading?: boolean;
}): JSX.Element {
  const columns: Column<Allocation>[] = [
    { key: "id", label: "Allocation", sortKey: "id", sortValue: (a) => a.id, render: (a) => <Mono>{a.id}</Mono> },
    { key: "who", label: "Consultant", sortKey: "consultant", sortValue: (a) => a.consultant.email, render: (a) => <Two main={a.consultant.name} sub={a.consultant.email} /> },
    { key: "dates", label: "Dates", sortKey: "startDate", sortValue: (a) => a.start, render: (a) => <Two main={fmtRange(a.start, a.end)} sub={<HourlyLabel allocation={a} />} /> },
    { key: "travel", label: "Travel", render: (a) => <TravelCell allocation={a} travelBase={travelBase} /> },
    { key: "comment", label: "Comment", width: "22%", render: (a) => <Box sx={{ color: "text.secondary", fontSize: 12.5 }}>{a.comment || "—"}</Box> },
    { key: "status", label: "Allocation Status", sortKey: "status", sortValue: (a) => a.status, render: (a) => <AllocationStatusChip status={a.status} /> },
  ];
  const sorted = useSortedRows(allocations, columns);
  return (
    <EaTable
      ariaLabel="Allocation records"
      columns={columns}
      rows={sorted.rows}
      rowKey={(a) => a.id}
      sorting={sorted.sorting}
      loading={loading}
      actions={canChangeStatus ? (a) => (/Cancelled/.test(a.status) ? [] : [{ label: "Update Allocation Status", onClick: () => onChangeStatus(a) }]) : undefined}
      empty={empty}
    />
  );
}

function DetailsTab({ e }: { e: Engagement }): JSX.Element {
  return (
    <Box sx={{ pt: 1 }}>
      <FactsGrid
        columns={3}
        facts={[
          { label: "Engagement Type", value: e.typeName },
          e.kind !== "marketing" && { label: "Business Unit", value: e.businessUnit },
          e.kind !== "marketing" && { label: "Product Unit", value: e.productUnit },
          e.kind !== "marketing" && { label: "Sales Sub Region", value: e.subRegion },
          { label: "Customer Contact", value: e.contact },
          { label: "Business Domain", value: e.domain },
          { label: "Opportunity Owner", value: e.opportunityOwner },
          { label: "Technical Owner", value: e.technicalOwner },
          e.kind === "customer" && { label: "Contracts Signed", value: e.contractsSigned ? "Yes" : "No" },
          e.kind === "customer" && { label: "Tentative Dates", value: e.tentativeDates ? "Yes" : "No" },
          { label: "Created By", value: e.createdBy && <PersonTwo name={e.createdBy.name} email={e.createdBy.email} /> },
          { label: "Created On", value: e.createdOn ? fmtDate(e.createdOn) : undefined },
          { label: "Location Address", value: e.address ? <span style={{ whiteSpace: "pre-line" }}>{e.address}</span> : undefined, full: true },
          { label: "Description", value: e.description, full: true },
          { label: "Engagement Scope", value: e.scope, full: true },
          { label: "Comments", value: e.comment, full: true },
          e.kind === "marketing" && e.funding?.length
            ? {
                label: "Funding Sources",
                full: true,
                value: (
                  <Card variant="outlined" sx={{ overflowX: "auto" }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Region</TableCell>
                          <TableCell>Sub Region</TableCell>
                          <TableCell>Business Unit</TableCell>
                          <TableCell>Product Unit</TableCell>
                          <TableCell align="right">Percentage</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {e.funding.map((f, i) => (
                          <TableRow key={i}>
                            <TableCell>{f.region}</TableCell>
                            <TableCell>{f.subRegion}</TableCell>
                            <TableCell>{f.businessUnit}</TableCell>
                            <TableCell>{f.productUnit}</TableCell>
                            <TableCell align="right">{f.percentage}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                ),
              }
            : null,
        ]}
      />
    </Box>
  );
}

