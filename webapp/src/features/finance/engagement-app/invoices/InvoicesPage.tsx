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

import { useState, type JSX, type ReactNode } from "react";
import { Navigate } from "react-router";
import { Button, Typography } from "@wso2/oxygen-ui";
import { RefreshCwIcon } from "@wso2/oxygen-ui-icons-react";
import RoutedTabs, { type RoutedTabDef } from "@components/routed-tabs/RoutedTabs";
import type { Invoice, PerDiemPayment, SyncFailure } from "../api/engagementTypes";
import { useCampaigns, useInvoices, usePerDiemPayments, useReferenceData, useSyncFailures } from "../api/useEngagementApi";
import { useInvoiceBatch, usePaymentBatch } from "../api/useEngagementMutations";
import { useEngagementAccess, useEngagementUserInfo } from "../api/useEngagementUserInfo";
import { ConfirmDialog } from "../components/EaDialog";
import EaPage from "../components/EaPage";
import { countBadge } from "../components/tabBadge";
import EaTable, { type Column, tableState } from "../components/EaTable";
import { Empty, Failed, ListCard } from "../components/ListCard";
import ListToolbar, { type FilterDef } from "../components/ListToolbar";
import { NsStatusChip, Two, Mono } from "../components/StatusChips";
import { engagementPaths, type InvoicesTab } from "../engagementPaths";
import { invoiceTabs } from "../model/landing";
import { MONTH_NAMES, money, plural } from "../model/format";
import { columnAccessors, sortRows } from "../model/sorting";
import { useListView } from "../model/useListView";
import { invoiceColumns, paymentColumns } from "./invoiceColumns";
import JobLink from "./JobLink";
import { InvoiceDrawer, PaymentDrawer } from "./RecordDrawer";
import { useBatchReport, useInvoiceWork, usePaymentWork } from "./useInvoiceWork";

const LABEL: Record<InvoicesTab, string> = {
  po: "Invoices to Approve (PO)",
  finance: "Invoices to Approve",
  push: "Invoices to Push",
  "payments-push": "Per Diem Payments to Push",
  "sync-failures": "NetSuite Sync Failures",
  "all-invoices": "All Invoices",
  "all-payments": "All Per Diem Payments",
};

/** The tabs `/user-info`'s work queues name (the privilege rules when it names none). */
function useInvoiceTabs(): InvoicesTab[] {
  const access = useEngagementAccess();
  const info = useEngagementUserInfo();
  return invoiceTabs(access, info.data?.workQueues);
}

/** How many records wait in each queue tab: the lists' tabCounts and the sync failures' total. */
function useQueueCounts(tabs: readonly InvoicesTab[]): { counts: Partial<Record<InvoicesTab, number>>; loading: Partial<Record<InvoicesTab, boolean>> } {
  // Ask with a tab the person holds; tabCounts covers the others they may see.
  const invTab = (["po", "finance", "push", "all-invoices"] as const).find((t) => tabs.includes(t));
  const payTab = (["payments-push", "all-payments"] as const).find((t) => tabs.includes(t));
  const API_TAB = { po: "approve-po", finance: "approve", push: "push", "all-invoices": "all", "payments-push": "push", "all-payments": "all" } as const;
  const inv = useInvoices({ tab: invTab ? API_TAB[invTab] : "all", limit: 1 }, Boolean(invTab));
  const pay = usePerDiemPayments({ tab: payTab ? API_TAB[payTab] : "all", limit: 1 }, Boolean(payTab));
  const failures = useSyncFailures({}, tabs.includes("sync-failures"));
  const ic = inv.data?.counts ?? {};
  const pc = pay.data?.counts ?? {};
  return {
    counts: { po: ic["approve-po"], finance: ic.approve, push: ic.push, "payments-push": pc.push, "sync-failures": failures.data?.total },
    loading: { po: inv.isPending, finance: inv.isPending, push: inv.isPending, "payments-push": pay.isPending, "sync-failures": failures.isPending },
  };
}

/** `/invoices`: the first work-queue tab. */
export function InvoicesIndex(): JSX.Element {
  const tabs = useInvoiceTabs();
  return <Navigate to={engagementPaths.invoices(tabs[0] ?? "all-invoices")} replace />;
}

/** Invoices & Payments: invoices from the travel agents and per diem payments to travellers, with their approval and NetSuite status. */
export default function InvoicesPage({ tab }: { tab: InvoicesTab }): JSX.Element {
  const tabs = useInvoiceTabs();
  const { counts, loading } = useQueueCounts(tabs);
  if (!tabs.includes(tab)) return <Navigate to={engagementPaths.invoices()} replace />;
  const defs: RoutedTabDef[] = tabs.map((t) => ({
    segment: t,
    label: LABEL[t],
    ...(t.startsWith("all") ? {} : countBadge(counts[t], (n) => `${n} waiting`, Boolean(loading[t]))),
  }));
  return (
    <EaPage collapsedSearch title="Invoices & Payments" subtitle="Invoices from the travel agents and per diem payments to travellers, with their approval and NetSuite status.">
      <ListCard>
        {tabs.length > 1 ? <RoutedTabs basePath={engagementPaths.invoices()} tabs={defs} ariaLabel="Invoices and payments" scrollable keepSearchParams={["q"]} /> : null}
        {tab === "payments-push" ? (
          <PaymentsQueue />
        ) : tab === "all-payments" ? (
          <AllPayments />
        ) : tab === "sync-failures" ? (
          <SyncFailures />
        ) : tab === "all-invoices" ? (
          <AllInvoices />
        ) : (
          <InvoiceQueue queue={tab} />
        )}
      </ListCard>
    </EaPage>
  );
}

/** Before anything is selected, a queue shows its actions greyed out, so the tab says what it is for. */
function QueueHint({ labels }: { labels: readonly string[] }): JSX.Element {
  return (
    <>
      <Typography variant="body2" color="text.secondary">
        Select rows to
      </Typography>
      {labels.map((l, i) => (
        <Button key={l} size="small" variant={i === labels.length - 1 ? "contained" : "outlined"} disabled>
          {l}
        </Button>
      ))}
    </>
  );
}

function InvoiceQueue({ queue }: { queue: "po" | "finance" | "push" }): JSX.Element {
  const list = useListView("invoice-queue");
  const invoices = useInvoices({ tab: queue === "po" ? "approve-po" : queue === "finance" ? "approve" : "push", ...list.paramsFor() });
  const rows = invoices.data?.items ?? [];
  const work = useInvoiceWork(invoices.isPending || invoices.isPlaceholderData ? [] : rows, { resetKey: queue });
  const [open, setOpen] = useState<Invoice | null>(null);
  const hint = queue === "po" ? ["Reject (PO)", "Approve (PO)"] : queue === "finance" ? ["Reject", "Approve"] : ["Push Invoices to NetSuite"];
  return (
    <>
      <ListToolbar search={list.search} placeholder="Search invoices" onSearch={list.setSearch} right={work.bulk ?? <QueueHint labels={hint} />} />
      {invoices.isError ? (
        <Failed what="the invoices" error={invoices.error} onRetry={() => void invoices.refetch()} retrying={invoices.isFetching} />
      ) : (
        <EaTable
          ariaLabel={LABEL[queue]}
          columns={invoiceColumns({ traveller: true, approvals: false, added: true })}
          rows={rows}
          rowKey={(i) => i.id}
          {...tableState(invoices)}
          selection={work.selection}
          onRowClick={setOpen}
          sorting={list.sorting}
          pagination={list.pager(invoices.data?.total ?? 0, invoices.isPlaceholderData)}
          empty={<Empty title="No Invoices Waiting" body="Invoices at this step appear here as soon as they arrive." />}
        />
      )}
      {open ? <InvoiceDrawer invoice={open} actions={work.actionsFor(open)} onClose={() => setOpen(null)} /> : null}
      {work.dialogs}
    </>
  );
}

function AllInvoices(): JSX.Element {
  const list = useListView("all-invoices");
  const ref = useReferenceData();
  const campaigns = useCampaigns("");
  const [open, setOpen] = useState<Invoice | null>(null);
  const pair = (v: string): readonly [string, string] => [v, v];
  const filters: FilterDef[] = [
    { key: "poApproval", label: "PO Approval", type: "multi", options: ["Pending", "Approved", "Rejected"].map(pair) },
    { key: "financeApproval", label: "Finance Approval", type: "multi", options: ["Pending", "Approved", "Rejected"].map(pair) },
    { key: "netsuiteStatus", label: "NetSuite Status", type: "select", options: ["Pushed", "Pending"].map(pair) },
    { key: "costType", label: "Cost Type", type: "multi", options: (ref.data?.costTypes ?? []).map(pair) },
    { key: "agency", label: "Travel Agent", type: "multi", options: (ref.data?.travelAgents ?? []).map(pair) },
    { key: "month", label: "Month", type: "multi", options: MONTH_NAMES.map(pair) },
    ...(campaigns.data?.length
      ? [{ key: "campaignId", label: "Campaign", type: "multi" as const, options: campaigns.data.map((c) => [c.id, c.name] as const) }]
      : []),
  ];
  const invoices = useInvoices({ tab: "all", ...list.paramsFor(filters) });
  const rows = invoices.data?.items ?? [];
  const work = useInvoiceWork(invoices.isPending || invoices.isPlaceholderData ? [] : rows);
  return (
    <>
      <ListToolbar
        search={list.search}
        placeholder="Search invoices"
        onSearch={list.setSearch}
        filters={filters}
        applied={list.filters}
        onApply={list.setFilters}
        onRemove={list.removeFilter}
        right={work.bulk}
      />
      {invoices.isError ? (
        <Failed what="the invoices" error={invoices.error} onRetry={() => void invoices.refetch()} retrying={invoices.isFetching} />
      ) : (
        <EaTable
          ariaLabel="All Invoices"
          columns={invoiceColumns()}
          rows={rows}
          rowKey={(i) => i.id}
          {...tableState(invoices)}
          selection={work.selection}
          onRowClick={setOpen}
          sorting={list.sorting}
          pagination={list.pager(invoices.data?.total ?? 0, invoices.isPlaceholderData)}
          empty={
            Object.keys(list.filters).length || list.search ? (
              <Empty title="No Invoices Match" body="Change the search or the filters to see more." />
            ) : (
              <Empty title="No Invoices Yet" body="Invoices appear here once the travel agents add them to travel requests." />
            )
          }
        />
      )}
      {open ? <InvoiceDrawer invoice={open} actions={work.actionsFor(open)} onClose={() => setOpen(null)} /> : null}
      {work.dialogs}
    </>
  );
}

function PaymentsQueue(): JSX.Element {
  return <PaymentsList queue />;
}

function AllPayments(): JSX.Element {
  return <PaymentsList queue={false} />;
}

function PaymentsList({ queue }: { queue: boolean }): JSX.Element {
  const list = useListView("payments");
  const ref = useReferenceData();
  const [open, setOpen] = useState<PerDiemPayment | null>(null);
  const pair = (v: string): readonly [string, string] => [v, v];
  const filters: FilterDef[] = [
    { key: "netsuiteStatus", label: "NetSuite Status", type: "select", options: ["Pushed", "Pending"].map(pair) },
    { key: "convertedCurrency", label: "Converted Currency", type: "multi", options: (ref.data?.currencies ?? []).map(pair) },
  ];
  const payments = usePerDiemPayments(queue ? { tab: "push", ...list.paramsFor() } : { tab: "all", ...list.paramsFor(filters) });
  const rows = payments.data?.items ?? [];
  const work = usePaymentWork(payments.isPending || payments.isPlaceholderData ? [] : rows);
  return (
    <>
      <ListToolbar
        search={list.search}
        placeholder="Search per diem payments"
        onSearch={list.setSearch}
        filters={queue ? undefined : filters}
        applied={list.filters}
        onApply={list.setFilters}
        onRemove={list.removeFilter}
        right={work.bulk ?? (queue && work.can ? <QueueHint labels={["Push Payments to NetSuite"]} /> : null)}
      />
      {payments.isError ? (
        <Failed what="the per diem payments" error={payments.error} onRetry={() => void payments.refetch()} retrying={payments.isFetching} />
      ) : (
        <EaTable
          ariaLabel={queue ? "Per Diem Payments to Push" : "All Per Diem Payments"}
          columns={paymentColumns({ ns: !queue })}
          rows={rows}
          rowKey={(x) => x.id}
          {...tableState(payments)}
          selection={work.selection}
          onRowClick={setOpen}
          sorting={list.sorting}
          pagination={list.pager(payments.data?.total ?? 0, payments.isPlaceholderData)}
          empty={
            queue ? (
              <Empty title="No Per Diem Payments Waiting" body="Per diem payments to push appear here once finance adds them." />
            ) : (
              Object.keys(list.filters).length || list.search ? (
                <Empty title="No Per Diem Payments Match" body="Change the search or the filters to see more." />
              ) : (
                <Empty title="No Per Diem Payments Yet" body="Per diem payments appear here once finance adds them to a travel request." />
              )
            )
          }
        />
      )}
      {open ? <PaymentDrawer payment={open} actions={work.actionsFor(open)} onClose={() => setOpen(null)} /> : null}
      {work.dialogs}
    </>
  );
}

/** NetSuite Sync Failures: invoices and per diem payments that reached NetSuite but whose status did not come back. */
function SyncFailures(): JSX.Element {
  const list = useListView("sync-failures");
  const failures = useSyncFailures({ search: list.search || undefined });
  const invoices = useInvoiceBatch();
  const payments = usePaymentBatch();
  const report = useBatchReport();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const keyOf = (r: SyncFailure) => `${r.record}:${r.id}`;
  const columns: Column<SyncFailure>[] = [
    { key: "kind", label: "Record", sortKey: "record", sortValue: (r) => r.record, render: (r) => (r.record === "invoice" ? "Travel Invoice" : "Per Diem Payment") },
    {
      key: "no",
      label: "Number",
      sortKey: "number",
      sortValue: (r) => r.number || r.id,
      render: (r) => (r.record === "invoice" ? <Two main={<Mono bold>{r.number}</Mono>} sub={r.travelAgent} /> : <Mono>{r.number || r.id}</Mono>),
    },
    { key: "job", label: "Job Number", sortKey: "jobNumber", sortValue: (r) => r.jobNumber, render: (r) => <Two main={<JobLink job={r.jobNumber} />} sub={r.traveller?.email} /> },
    { key: "amount", label: "Amount", align: "right", sortKey: "amount", sortValue: (r) => r.amount, render: (r) => money(r.amount, r.currency) },
    { key: "ns", label: "NetSuite Status", render: (r) => <NsStatusChip record={r} /> },
  ];

  const all = sortRows(failures.data?.items ?? [], list.sort, columnAccessors(columns));
  const rows = list.pageOf(all);
  const chosen = failures.isPending || failures.isPlaceholderData ? [] : all.filter((r) => selected.has(keyOf(r)));
  const right: ReactNode = chosen.length ? (
    <>
      <Typography variant="body2" color="text.secondary">
        {chosen.length} selected
      </Typography>
      <Button size="small" variant="contained" startIcon={<RefreshCwIcon size={14} />} onClick={() => setConfirm(true)}>
        Re-sync with NetSuite
      </Button>
    </>
  ) : (
    <QueueHint labels={["Re-sync with NetSuite"]} />
  );

  return (
    <>
      <ListToolbar search={list.search} placeholder="Search sync failures" onSearch={list.setSearch} right={right} />
      {failures.isError ? (
        <Failed what="the NetSuite sync failures" error={failures.error} onRetry={() => void failures.refetch()} retrying={failures.isFetching} />
      ) : (
        <EaTable
          ariaLabel="NetSuite Sync Failures"
          columns={columns}
          rows={rows}
          rowKey={keyOf}
          sorting={list.sorting}
          pagination={list.pager(all.length)}
          {...tableState(failures)}
          selection={{
            selected,
            canSelect: () => true,
            rowLabel: (r) => `Select ${r.record === "invoice" ? "invoice" : "per diem payment"} ${r.number || r.id}`,
            onToggle: (id) =>
              setSelected((s) => {
                const next = new Set(s);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              }),
            onToggleAll: (ids) =>
              setSelected((s) => {
                const next = new Set(s);
                const all = ids.every((id) => s.has(id));
                for (const id of ids) {
                  if (all) next.delete(id);
                  else next.add(id);
                }
                return next;
              }),
          }}
          empty={<Empty title="No NetSuite Sync Failures" body="Every pushed invoice and payment has its NetSuite status." />}
        />
      )}
      {confirm ? (
        <ConfirmDialog
          title="Re-sync with NetSuite"
          confirmLabel="Re-sync"
          busyLabel="Re-syncing…"
          text={`Look up ${plural(chosen.length, "record")} in NetSuite and update their NetSuite status here. Nothing is pushed again.`}
          run={async () => {
            const inv = chosen.filter((r) => r.record === "invoice").map((r) => r.id);
            const pay = chosen.filter((r) => r.record === "payment").map((r) => r.id);
            if (inv.length) report(await invoices.mutateAsync({ action: "resync", ids: inv }), "re-synced", "invoice");
            if (pay.length) report(await payments.mutateAsync({ action: "resync", ids: pay }), "re-synced", "per diem payment");
          }}
          onDone={() => setSelected(new Set())}
          onClose={() => setConfirm(false)}
        />
      ) : null}
    </>
  );
}
