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
import { Navigate } from "react-router";
import { Button } from "@wso2/oxygen-ui";
import { PlusIcon } from "@wso2/oxygen-ui-icons-react";
import RoutedTabs from "@components/routed-tabs/RoutedTabs";
import { localIsoDate } from "@utils/localDate";
import type { TravelDocument, Visa } from "../api/engagementTypes";
import { useMyTravelDocuments, useMyVisas, useReferenceData, useTravelDocuments, useVisas } from "../api/useEngagementApi";
import { useEngagementAccess } from "../api/useEngagementUserInfo";
import EaPage from "../components/EaPage";
import EaTable, { tableState } from "../components/EaTable";
import { Empty, Failed, ListCard } from "../components/ListCard";
import ListToolbar, { type FilterDef } from "../components/ListToolbar";
import { engagementPaths, myEngagementPaths, type DocumentsTab } from "../engagementPaths";
import { TRAVEL, type EngagementAccess } from "../model/engagementAccess";
import { columnAccessors, sortRows } from "../model/sorting";
import { DOCUMENT_TYPES } from "../model/statuses";
import { useListView } from "../model/useListView";
import { documentColumns, documentStatus, visaColumns, visaStatus } from "./documentColumns";
import { DocumentDialog, DocumentDrawer, VisaDialog } from "./documentParts";

const tabsOf = (a: EngagementAccess, own: boolean): DocumentsTab[] =>
  own
    ? [...(a.myVisas ? (["visas"] as const) : []), ...(a.myDocuments ? (["documents"] as const) : [])]
    : [...(a.visas ? (["visas"] as const) : []), ...(a.documents ? (["documents"] as const) : [])];

/** The first tab this person may open. */
export function DocumentsIndex({ own }: { own: boolean }): JSX.Element {
  const access = useEngagementAccess();
  const tab = tabsOf(access, own)[0] ?? (own ? "documents" : "visas");
  return <Navigate to={own ? myEngagementPaths.documents(tab) : engagementPaths.documents(tab)} replace />;
}

/** Visas & Documents (Finance): employees' visas, passports and other travel documents, as the Travel Team needs them to book. */
export default function DocumentsPage({ own, tab }: { own: boolean; tab: DocumentsTab }): JSX.Element {
  const access = useEngagementAccess();
  const tabs = tabsOf(access, own);
  if (!tabs.includes(tab)) {
    const first = tabs[0];
    return <Navigate to={own ? myEngagementPaths.documents(first) : engagementPaths.documents(first)} replace />;
  }
  return own ? <OwnDocuments tab={tab} tabs={tabs} /> : <AllDocuments tab={tab} tabs={tabs} />;
}

function Tabs({ own, tabs }: { own: boolean; tabs: DocumentsTab[] }) {
  if (tabs.length < 2) return null;
  const label = (t: DocumentsTab) => (t === "visas" ? (own ? "Visa Details" : "Visas") : "Travel Documents");
  return (
    <RoutedTabs
      basePath={own ? myEngagementPaths.documents() : engagementPaths.documents()}
      tabs={tabs.map((t) => ({ segment: t, label: label(t) }))}
      ariaLabel="Visas and documents"
      keepSearchParams={["q", "country", "status"]}
    />
  );
}

function AllDocuments({ tab, tabs }: { tab: DocumentsTab; tabs: DocumentsTab[] }): JSX.Element {
  const { p } = useEngagementAccess();
  const today = localIsoDate();
  const list = useListView("documents");
  const ref = useReferenceData();
  const [open, setOpen] = useState<Visa | TravelDocument | null>(null);
  const [editing, setEditing] = useState<Visa | TravelDocument | "new" | null>(null);
  const isVisas = tab === "visas";
  const canAdd = p.t.has(isVisas ? TRAVEL.ADD_VISA : TRAVEL.ADD_DOCUMENT);
  const canInfo = p.t.has(isVisas ? TRAVEL.VIEW_VISA_INFO : TRAVEL.VIEW_DOCUMENT_INFO);
  const canEdit = p.t.has(isVisas ? TRAVEL.EDIT_VISA_RECORD : TRAVEL.EDIT_DOCUMENT);
  const pair = (v: string): readonly [string, string] => [v, v];
  const filters: FilterDef[] = [
    { key: "country", label: "Country", type: "multi", options: (ref.data?.countries ?? []).map(pair) },
    ...(isVisas ? [] : [{ key: "documentType", label: "Document Type", type: "multi" as const, options: DOCUMENT_TYPES.map(pair) }]),
    { key: "status", label: "Status", type: "select", options: [pair("Active"), pair("Expired")] },
  ];
  const visas = useVisas(list.paramsFor(filters), isVisas);
  const docs = useTravelDocuments(list.paramsFor(filters), !isVisas);
  const add = canAdd ? (
    <Button size="small" variant="contained" startIcon={<PlusIcon size={14} />} onClick={() => setEditing("new")}>
      {isVisas ? "Add Visa" : "Add Travel Document"}
    </Button>
  ) : null;
  const filtered = Object.keys(list.filters).length > 0 || Boolean(list.search);
  const q = isVisas ? visas : docs;
  const title = tabs.length > 1 ? "Visas & Documents" : isVisas ? "Visas" : "Travel Documents";

  return (
    <EaPage collapsedSearch
      title={title}
      subtitle={
        p.t.has(TRAVEL.ADD_VISA)
          ? "Employees' visas, passports and other travel documents, as the Travel Team needs them to book."
          : "Employees' visas and whether they are still valid, as recorded by the Travel Team."
      }
    >
      <ListCard>
        <Tabs own={false} tabs={tabs} />
        <ListToolbar
          search={list.search}
          placeholder={isVisas ? "Search visas" : "Search travel documents"}
          onSearch={list.setSearch}
          filters={filters}
          applied={list.filters}
          onApply={list.setFilters}
          onRemove={list.removeFilter}
          right={add}
        />
        {q.isError ? (
          <Failed what={isVisas ? "visas" : "travel documents"} error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />
        ) : isVisas ? (
          <EaTable
            ariaLabel="Visas"
            columns={visaColumns(false, today)}
            rows={visas.data?.items ?? []}
            rowKey={(v) => v.id}
            {...tableState(visas)}
            onRowClick={canInfo ? setOpen : undefined}
            actions={canEdit ? (v) => [{ label: "Edit Visa", onClick: () => setEditing(v) }] : undefined}
            sorting={list.sorting}
            pagination={list.pager(visas.data?.total ?? 0, visas.isPlaceholderData)}
            empty={
              filtered ? (
                <Empty title="No Visas Match" body="Change the search or the filters to see more." />
              ) : (
                <Empty title="No Visas Yet" body="Visas appear here once the Travel Team or the traveller adds them." />
              )
            }
          />
        ) : (
          <EaTable
            ariaLabel="Travel documents"
            columns={documentColumns(false, today)}
            rows={docs.data?.items ?? []}
            rowKey={(d) => d.id}
            {...tableState(docs)}
            onRowClick={canInfo ? setOpen : undefined}
            actions={canEdit ? (d) => [{ label: "Edit Travel Document", onClick: () => setEditing(d) }] : undefined}
            sorting={list.sorting}
            pagination={list.pager(docs.data?.total ?? 0, docs.isPlaceholderData)}
            empty={
              filtered ? (
                <Empty title="No Travel Documents Match" body="Change the search or the filters to see more." />
              ) : (
                <Empty title="No Travel Documents Yet" body="Passports and other travel documents appear here once they are added." />
              )
            }
          />
        )}
      </ListCard>
      {open ? (
        <DocumentDrawer
          record={open}
          own={false}
          canEdit={canEdit}
          onEdit={() => {
            setEditing(open);
            setOpen(null);
          }}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {editing && isVisas ? (
        <VisaDialog own={false} visa={editing === "new" ? undefined : (editing as Visa)} existing={visas.data?.items ?? []} onClose={() => setEditing(null)} />
      ) : null}
      {editing && !isVisas ? (
        <DocumentDialog own={false} doc={editing === "new" ? undefined : (editing as TravelDocument)} existing={docs.data?.items ?? []} onClose={() => setEditing(null)} />
      ) : null}
    </EaPage>
  );
}

function OwnDocuments({ tab, tabs }: { tab: DocumentsTab; tabs: DocumentsTab[] }): JSX.Element {
  const { p } = useEngagementAccess();
  const today = localIsoDate();
  const list = useListView("my-documents");
  const visas = useMyVisas(tab === "visas");
  const docs = useMyTravelDocuments(tab === "documents");
  const [open, setOpen] = useState<Visa | TravelDocument | null>(null);
  const [adding, setAdding] = useState(false);
  const isVisas = tab === "visas";
  const canAdd = p.t.has(isVisas ? TRAVEL.ADD_OWN_VISA : TRAVEL.ADD_OWN_DOCUMENT);
  const q = list.search.toLowerCase();
  const visaRows = (visas.data ?? []).filter((v) => v.status === "Active" && (!q || [v.country, v.visaType].some((x) => x.toLowerCase().includes(q))));
  const docRows = (docs.data ?? []).filter((d) => d.status === "Active" && (!q || [d.country, d.type, d.number].some((x) => x.toLowerCase().includes(q))));
  const filterStatus = list.filters.status;
  const visaCols = visaColumns(true, today);
  const docCols = documentColumns(true, today);
  const allVisas = sortRows(filterStatus ? visaRows.filter((v) => visaStatus(v, today) === filterStatus) : visaRows, list.sort, columnAccessors(visaCols));
  const allDocs = sortRows(filterStatus ? docRows.filter((d) => documentStatus(d, today) === filterStatus) : docRows, list.sort, columnAccessors(docCols));
  const mine = isVisas ? (visas.data ?? []).filter((v) => v.status === "Active").length : (docs.data ?? []).filter((d) => d.status === "Active").length;
  const addButton = canAdd ? (
    <Button variant="contained" size="small" startIcon={<PlusIcon size={14} />} onClick={() => setAdding(true)}>
      {isVisas ? "Add Visa" : "Add Travel Document"}
    </Button>
  ) : null;
  const none = isVisas ? (
    <Empty title="No Visas Yet" body="Add your visas so the Travel Team can pick the right one when it books your trips." />
  ) : (
    <Empty title="No Travel Documents Yet" body="Add your passport so the Travel Team can book for you." />
  );
  const query = isVisas ? visas : docs;

  return (
    <EaPage collapsedSearch
      title="Passport & Visas"
      subtitle="Your passport, other travel documents and visas, as the Travel Team sees them when it books your trips."
    >
      <ListCard>
        <Tabs own tabs={tabs} />
        <ListToolbar
            search={list.search}
            placeholder={isVisas ? "Search my visas" : "Search my travel documents"}
            onSearch={list.setSearch}
            filters={[{ key: "status", label: "Status", type: "select", options: [["Active", "Active"], ["Expired", "Expired"]] }]}
            applied={list.filters}
            onApply={list.setFilters}
            onRemove={list.removeFilter}
            right={addButton}
          />
        {query.isError ? (
          <Failed what={isVisas ? "your visas" : "your travel documents"} error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
        ) : isVisas ? (
          <EaTable
            ariaLabel="My visas"
            columns={visaCols}
            rows={allVisas}
            sorting={list.sorting}
            rowKey={(v) => v.id}
            {...tableState(visas)}
            onRowClick={p.t.has(TRAVEL.VIEW_OWN_VISA) ? setOpen : undefined}
            empty={mine ? <Empty title="No Visas Match" body="Change the search or the filters to see more." /> : none}
          />
        ) : (
          <EaTable
            ariaLabel="My travel documents"
            columns={docCols}
            rows={allDocs}
            sorting={list.sorting}
            rowKey={(d) => d.id}
            {...tableState(docs)}
            onRowClick={p.t.has(TRAVEL.VIEW_OWN_DOCUMENT) ? setOpen : undefined}
            empty={mine ? <Empty title="No Travel Documents Match" body="Change the search or the filters to see more." /> : none}
          />
        )}
      </ListCard>
      {open ? <DocumentDrawer record={open} own canEdit={false} onEdit={() => undefined} onClose={() => setOpen(null)} /> : null}
      {adding && isVisas ? <VisaDialog own existing={visas.data ?? []} onClose={() => setAdding(false)} /> : null}
      {adding && !isVisas ? <DocumentDialog own existing={docs.data ?? []} onClose={() => setAdding(false)} /> : null}
    </EaPage>
  );
}
