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
import { Navigate, useParams } from "react-router";
import { Alert, Box, Button, Card, Stack, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from "@wso2/oxygen-ui";
import { PlusIcon } from "@wso2/oxygen-ui-icons-react";
import RoutedTabs, { type RoutedTabDef } from "@components/routed-tabs/RoutedTabs";
import { HttpError } from "@api/http";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { CardExpense, ExpenseClaim, Invoice, PerDiem, PerDiemPayment, TravelRequest, TripExpenses, TripPayments } from "../api/engagementTypes";
import { useJobCostSummary, useTravelRequest, useTripExpenses, useTripInvoices, useTripPayments, useTripPerDiems } from "../api/useEngagementApi";
import { useDeletePerDiem } from "../api/useEngagementMutations";
import { useEngagementAccess } from "../api/useEngagementUserInfo";
import { ConfirmDialog } from "../components/EaDialog";
import { countBadge } from "../components/tabBadge";
import EaPage from "../components/EaPage";
import RecordLink from "../components/RecordLink";
import { DetailSkeleton, FactsGridSkeleton, TableSkeleton } from "../components/EaSkeletons";
import EaTable, { type Column } from "../components/EaTable";
import { FactsCard, FactsGrid } from "../components/Facts";
import { Empty, Failed, ListCard, SectionTitle } from "../components/ListCard";
import { PersonTwo } from "../components/PersonChip";
import { ExpenseStatusChip, TravelStatusChip, Two, Mono } from "../components/StatusChips";
import { engagementPaths, myEngagementPaths, type TravelTab } from "../engagementPaths";
import { TRAVEL } from "../model/engagementAccess";
import { useSortedRows } from "../model/useSortedRows";
import { engagementName, fmtDate, fmtDateTime, fmtRange, money, place } from "../model/format";
import { canAddInvoiceTo, isOpenTrip } from "../model/statuses";
import { invoiceColumns, paymentColumns } from "../invoices/invoiceColumns";
import { InvoiceDrawer, PaymentDrawer } from "../invoices/RecordDrawer";
import { useInvoiceWork, usePaymentWork } from "../invoices/useInvoiceWork";
import { TABLE_HEAD_SX } from "../components/eaStyles";
import { Kpi } from "../dashboard/dashboardParts";
import TotalCostCard from "./TotalCostCard";
import { AssignDialog, InvoiceDialog, PaymentDialog, PerDiemDialog, UpdateTravelDialog } from "./travelDialogs";

const TABS: readonly TravelTab[] = ["info", "per-diems", "invoices", "payments", "card-expenses", "expense-claims"];

const TAB_LABEL: Readonly<Record<TravelTab, string>> = {
  info: "Travel Information",
  "per-diems": "Per Diems",
  invoices: "Travel Invoices",
  payments: "Per Diem Payments",
  "card-expenses": "Credit Card Expenses",
  "expense-claims": "Expense Claims",
};

const PAYMENT_TILES = ["Total Per Diem Amount", "Initial Currency Paid", "Total Travel Card Amount", "Total Payment Amount", "Remaining Balance"] as const;
const PAYMENT_TILES_SX = { display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, minmax(0, 1fr))" }, gap: 1.5, mb: 2 } as const;

const PER_DIEM_COLUMNS: readonly Column<PerDiem>[] = [
  { key: "s", label: "Start Date/Time", sortKey: "start", sortValue: (r) => r.start, render: (r) => fmtDateTime(r.start) },
  { key: "e", label: "End Date/Time", sortKey: "end", sortValue: (r) => r.end, render: (r) => fmtDateTime(r.end) },
  { key: "d", label: "No. of Days", align: "right", sortKey: "days", sortValue: (r) => r.days, render: (r) => r.days },
  { key: "r", label: "Per Diem Amount", align: "right", sortKey: "rate", sortValue: (r) => r.rate, render: (r) => money(r.rate, r.currency) },
  { key: "t", label: "Total Amount", align: "right", sortKey: "total", sortValue: (r) => r.total, render: (r) => money(r.total, r.currency) },
];

const CARD_COLUMNS: readonly Column<CardExpense>[] = [
  { key: "d", label: "Date", sortKey: "date", sortValue: (c) => c.date, render: (c) => (c.date ? fmtDate(c.date) : "—") },
  { key: "t", label: "Expense Type", sortKey: "type", sortValue: (c) => c.expenseType, render: (c) => <Two main={c.expenseType ?? "—"} sub={c.reference} /> },
  { key: "e", label: "Employee", sortKey: "employee", sortValue: (c) => c.employee, render: (c) => c.employee ?? "—" },
  { key: "s", label: "Status", sortKey: "status", sortValue: (c) => c.status, render: (c) => <ExpenseStatusChip status={c.status} /> },
  { key: "a", label: "Amount", align: "right", sortKey: "amount", sortValue: (c) => c.amount, render: (c) => money(c.amount, c.currency) },
];

const CLAIM_COLUMNS: readonly Column<ExpenseClaim>[] = [
  { key: "d", label: "Date", sortKey: "date", sortValue: (c) => c.date, render: (c) => (c.date ? fmtDate(c.date) : "—") },
  { key: "n", label: "Claim", sortKey: "claim", sortValue: (c) => c.claimNumber, render: (c) => <Two main={c.expenseType ?? "—"} sub={c.claimNumber ? `Claim ${c.claimNumber}` : undefined} /> },
  { key: "e", label: "Employee", sortKey: "employee", sortValue: (c) => c.employee, render: (c) => c.employee ?? "—" },
  { key: "s", label: "Status", sortKey: "status", sortValue: (c) => c.status, render: (c) => <ExpenseStatusChip status={c.status} /> },
  { key: "a", label: "Amount", align: "right", sortKey: "amount", sortValue: (c) => c.amount, render: (c) => money(c.amount, c.currency) },
  { key: "r", label: "Reimbursement", align: "right", sortKey: "reimbursement", sortValue: (c) => c.reimbursementAmount, render: (c) => money(c.reimbursementAmount, c.reimbursementCurrency) },
];

/** One travel request: the traveller, the engagement and the trip, then its detail and expense tabs — Travel Information, Per Diems, Travel Invoices, Per Diem Payments, Credit Card Expenses and Expense Claims. */
export default function TravelRequestPage({ area = "finance" }: { area?: "finance" | "me" }): JSX.Element {
  const { job = "", tab = "info" } = useParams();
  const trip = useTravelRequest(job);
  // Asked for alongside the request, not after it: it needs only the job number.
  const cost = useJobCostSummary(job, Boolean(job));
  const { isAgent } = useEngagementAccess();
  const pathOf = area === "me" ? myEngagementPaths.travelRequest : engagementPaths.travelRequest;
  const back = area === "me" ? { to: myEngagementPaths.travelRequests, label: "Travels" } : { to: engagementPaths.travelRequests(), label: "Travels" };

  if (!TABS.includes(tab as TravelTab)) return <Navigate to={pathOf(job)} replace />;
  if (trip.isPending) {
    return (
      <EaPage title={`Travel Request ${job}`} back={back}>
        <DetailSkeleton
          facts={["Traveller", ...(isAgent ? [] : ["Engagement"]), "Destination", "Dates", "Travel Agent", "Visa"]}
          two={["Traveller", "Engagement"]}
          tabs={tab === "info" ? [TAB_LABEL.info] : [TAB_LABEL.info, TAB_LABEL[tab as TravelTab]]}
          moreTabs={2}
          between={<TotalCostCard cost={cost} />}
        >
          <SectionLoading tab={tab as TravelTab} />
        </DetailSkeleton>
      </EaPage>
    );
  }
  if (trip.isError) {
    const gone = trip.error instanceof HttpError && (trip.error.status === 404 || trip.error.status === 403);
    return (
      <EaPage title={`Travel Request ${job}`} back={back}>
        {gone ? (
          <Alert severity="info">This travel request isn&apos;t one you can open, or it doesn&apos;t exist.</Alert>
        ) : (
          <Failed what="the travel request" error={trip.error} onRetry={() => void trip.refetch()} retrying={trip.isFetching} />
        )}
      </EaPage>
    );
  }
  return <TravelRequestView t={trip.data} cost={cost} tab={tab as TravelTab} area={area} back={back} />;
}

/** The sections of one travel request, each its own call, made only for the tabs the backend says the viewer may open. */
interface TripSections {
  readonly perDiems?: readonly PerDiem[];
  readonly invoices?: readonly Invoice[];
  readonly payments?: TripPayments;
  readonly expenses?: TripExpenses;
}

function TravelRequestView({ t, cost, tab, area, back }: { t: TravelRequest; cost: ReturnType<typeof useJobCostSummary>; tab: TravelTab; area: "finance" | "me"; back: { to: string; label: string } }): JSX.Element {
  const { p, newTravelRequests, agencyScope, agencyName } = useEngagementAccess();
  const [dialog, setDialog] = useState<"assign" | "update" | null>(null);
  const perDiems = useTripPerDiems(t.jobNumber, t.tabs.perDiems);
  const invoices = useTripInvoices(t.jobNumber, t.tabs.invoices);
  const payments = useTripPayments(t.jobNumber, t.tabs.payments);
  const expenses = useTripExpenses(t.jobNumber, t.tabs.expenses);
  const sections: TripSections = { perDiems: perDiems.data, invoices: invoices.data, payments: payments.data, expenses: expenses.data };
  const sectionQuery = { "per-diems": perDiems, invoices, payments, "card-expenses": expenses, "expense-claims": expenses, info: undefined }[tab];
  const has = (id: number) => p.t.has(id);
  const a = t.actions;
  const canEdit = area === "finance" && (a ? Boolean(a.update) : has(TRAVEL.EDIT_STATUS) || has(TRAVEL.EDIT_AGENT) || has(TRAVEL.EDIT_VISA));
  const canAssign = area === "finance" && (a ? Boolean(a.assign) : newTravelRequests);
  // The request's own counts fill the badges at once. A loaded list's length takes over, so a badge matches its rows after a change.
  const count = (list: { length: number } | undefined, known: number | undefined, loading: boolean) => countBadge(list?.length ?? known, (n) => `${n} rows`, loading);
  const tabs: RoutedTabDef[] = [
    { segment: "info", label: TAB_LABEL.info },
    ...(t.tabs.perDiems ? [{ segment: "per-diems", label: TAB_LABEL["per-diems"], ...count(perDiems.data, t.counts?.perDiems, perDiems.isPending) }] : []),
    ...(t.tabs.invoices ? [{ segment: "invoices", label: TAB_LABEL.invoices, ...count(invoices.data, t.counts?.invoices, invoices.isPending) }] : []),
    ...(t.tabs.payments ? [{ segment: "payments", label: TAB_LABEL.payments, ...count(payments.data?.items, t.counts?.payments, payments.isPending) }] : []),
    ...(t.tabs.expenses
      ? [
          { segment: "card-expenses", label: TAB_LABEL["card-expenses"], ...count(expenses.data?.cardExpenses, t.counts?.cardExpenses, expenses.isPending) },
          { segment: "expense-claims", label: TAB_LABEL["expense-claims"], ...count(expenses.data?.expenseClaims, t.counts?.expenseClaims, expenses.isPending) },
        ]
      : []),
  ];
  const pathOf = area === "me" ? myEngagementPaths.travelRequest : engagementPaths.travelRequest;
  if (!tabs.some((x) => x.segment === tab)) return <Navigate to={pathOf(t.jobNumber)} replace />;
  const basePath = pathOf(t.jobNumber, "info").replace(/\/info$/, "");

  const actions =
    area === "finance" ? (
      t.status === "New" && canAssign ? (
        <Button variant="contained" onClick={() => setDialog("assign")}>
          Assign Travel Agent
        </Button>
      ) : canEdit && t.status !== "New" ? (
        <Button variant="contained" onClick={() => setDialog("update")}>
          Update Travel Details
        </Button>
      ) : null
    ) : null;

  return (
    <EaPage
      title={`Travel Request ${t.jobNumber}`}
      documentTitle={t.jobNumber}
      chips={<TravelStatusChip status={t.status} />}
      back={back}
      actions={actions}
    >
      <FactsCard
        facts={[
          { label: "Traveller", value: <PersonTwo name={t.traveller.name} email={t.traveller.email} sub={[t.traveller.email, t.location].filter(Boolean).join("\n")} /> },
          t.engagement && {
            label: "Engagement",
            value:
              area === "finance" ? (
                <Two
                  main={
                    <RecordLink to={engagementPaths.engagement(t.engagement.id)} kind="engagement">
                      {t.engagement.id}
                    </RecordLink>
                  }
                  sub={engagementName(t.engagement)}
                />
              ) : (
                <Two main={t.engagement.id} sub={engagementName(t.engagement)} mono />
              ),
          },
          t.campaign && t.engagement && { label: "Campaign ID", value: <Mono>{t.campaign.id}</Mono> },
          { label: "Destination", value: place(t.country, t.city) },
          { label: "Dates", value: fmtRange(t.start, t.end) },
          { label: "Travel Agent", value: t.travelAgent || (agencyScope ? agencyName : undefined) || "Not Assigned" },
          { label: "Visa", value: t.visa || "—" },
        ]}
      />
      <TotalCostCard cost={cost} />
      <ListCard>
        <RoutedTabs basePath={basePath} tabs={tabs} ariaLabel="Travel request sections" scrollable />
        {sectionQuery?.isError ? (
          <Failed what="this section" error={sectionQuery.error} onRetry={() => void sectionQuery.refetch()} retrying={sectionQuery.isFetching} />
        ) : sectionQuery?.isPending ? (
          <SectionLoading tab={tab} />
        ) : tab === "per-diems" ? (
          <PerDiemsTab t={t} s={sections} />
        ) : tab === "invoices" ? (
          <InvoicesTab t={t} s={sections} area={area} />
        ) : tab === "card-expenses" ? (
          <CardExpensesTab rows={sections.expenses?.cardExpenses ?? []} />
        ) : tab === "expense-claims" ? (
          <ExpenseClaimsTab rows={sections.expenses?.expenseClaims ?? []} />
        ) : tab === "payments" ? (
          <PaymentsTab t={t} s={sections} area={area} />
        ) : (
          <InfoTab t={t} />
        )}
      </ListCard>
      {dialog === "assign" ? <AssignDialog trip={t} onClose={() => setDialog(null)} /> : null}
      {dialog === "update" ? <UpdateTravelDialog trip={t} onClose={() => setDialog(null)} /> : null}
    </EaPage>
  );
}

/** A tab while its rows load: its real headings and table headers over placeholder rows. */
function SectionLoading({ tab }: { tab: TravelTab }): JSX.Element {
  const { isAgent } = useEngagementAccess();
  switch (tab) {
    case "per-diems":
      return <TableSkeleton ariaLabel="Per diems" columns={PER_DIEM_COLUMNS} />;
    case "invoices":
      return <TableSkeleton ariaLabel="Travel invoices" columns={invoiceColumns({ job: false, agent: isAgent })} />;
    case "payments":
      return (
        <>
          <SectionTitle>Payment Summary</SectionTitle>
          <Box sx={PAYMENT_TILES_SX}>
            {PAYMENT_TILES.map((label) => (
              <Kpi key={label} label={label} value="" loading />
            ))}
          </Box>
          <TableSkeleton ariaLabel="Per diem payments" columns={paymentColumns({ traveller: false, job: false })} />
        </>
      );
    case "card-expenses":
      return <TableSkeleton ariaLabel="Credit card expenses" columns={CARD_COLUMNS} />;
    case "expense-claims":
      return <TableSkeleton ariaLabel="Expense claims" columns={CLAIM_COLUMNS} />;
    default:
      return (
        <Box sx={{ pt: 1 }}>
          <FactsGridSkeleton columns={3} labels={[...(isAgent ? [] : ["Engagement Code", "Engagement Type", "Customer"]), "Country", "Travel Location"]} />
        </Box>
      );
  }
}

function InfoTab({ t }: { t: TravelRequest }): JSX.Element {
  return (
    <Box sx={{ pt: 1 }}>
      <FactsGrid
        columns={3}
        facts={[
          t.engagementCode && { label: "Engagement Code", value: <Mono>{t.engagementCode}</Mono> },
          t.engagementType && { label: "Engagement Type", value: t.engagementType },
          t.engagement && { label: "Customer", value: t.engagement.kind === "customer" ? t.engagement.account : "—" },
          { label: "Country", value: t.country },
          { label: "Travel Location", value: t.travelLocation || t.city || "—" },
          t.funding?.length
            ? {
                label: "Funding Sources",
                full: true,
                value: (
                  <Card variant="outlined" sx={{ overflowX: "auto" }}>
                    <Table size="small" aria-label="Funding sources">
                      <TableHead>
                        <TableRow sx={TABLE_HEAD_SX}>
                          <TableCell>Business Unit</TableCell>
                          <TableCell>Product Unit</TableCell>
                          <TableCell>Region</TableCell>
                          <TableCell>Sub Region</TableCell>
                          <TableCell align="right">Percentage</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {t.funding.map((f, i) => (
                          <TableRow key={i}>
                            <TableCell>{f.businessUnit}</TableCell>
                            <TableCell>{f.productUnit}</TableCell>
                            <TableCell>{f.region}</TableCell>
                            <TableCell>{f.subRegion}</TableCell>
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

/** An Add button for a tab, disabled with the reason when the request's status does not allow it. */
function AddButton({ label, onClick, allowed, why }: { label: string; onClick: () => void; allowed: boolean; why?: string }): JSX.Element {
  return (
    <Tooltip title={allowed ? "" : (why ?? "")}>
      <span>
        <Button size="small" variant="contained" startIcon={<PlusIcon size={14} />} disabled={!allowed} onClick={onClick}>
          {label}
        </Button>
      </span>
    </Tooltip>
  );
}

function TabBar({ children }: { children: ReactNode }) {
  return <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", alignItems: "center", mb: 1.5, flexWrap: "wrap", rowGap: 1 }}>{children}</Stack>;
}

function PerDiemsTab({ t, s }: { t: TravelRequest; s: TripSections }): JSX.Element {
  const { p } = useEngagementAccess();
  const notify = useNotifications();
  const remove = useDeletePerDiem();
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<PerDiem | null>(null);
  const open = isOpenTrip(t.status);
  const canAdd = t.actions ? Boolean(t.actions.addPerDiem) || p.t.has(TRAVEL.ADD_PER_DIEMS) : p.t.has(TRAVEL.ADD_PER_DIEMS);
  const canDelete = p.t.has(TRAVEL.DELETE_PER_DIEMS) && open;
  const rows = s.perDiems ?? [];
  const add = canAdd ? <AddButton label="Add Per Diem" allowed={open} why={`Per diems cannot be added: the travel request is ${t.status}.`} onClick={() => setAdding(true)} /> : null;
  const sorted = useSortedRows(rows, PER_DIEM_COLUMNS);
  return (
    <>
      {rows.length && add ? <TabBar>{add}</TabBar> : null}
      <EaTable
        ariaLabel="Per diems"
        columns={PER_DIEM_COLUMNS}
        rows={sorted.rows}
        rowKey={(r) => r.id}
        sorting={sorted.sorting}
        actions={canDelete ? (r) => ((r.canDelete ?? true) ? [{ label: "Delete", danger: true, onClick: () => setDeleting(r) }] : []) : undefined}
        empty={
          <Empty
            title="No Per Diems"
            body={open ? "Add the traveller's per diem for the trip dates." : "Per diems can be added once the request is In Progress."}
            action={open ? add : undefined}
          />
        }
      />
      {adding ? <PerDiemDialog trip={t} perDiems={rows} onClose={() => setAdding(false)} /> : null}
      {deleting ? (
        <ConfirmDialog
          title="Delete Per Diem"
          confirmLabel="Delete"
          busyLabel="Deleting…"
          text={`Are you sure you want to delete the per diem from ${fmtDateTime(deleting.start)} to ${fmtDateTime(deleting.end)}?`}
          danger
          run={() => remove.mutateAsync({ jobNumber: t.jobNumber, id: deleting.id })}
          onDone={() => notify.showSuccess("Per diem deleted successfully")}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}

function InvoicesTab({ t, s, area }: { t: TravelRequest; s: TripSections; area: "finance" | "me" }): JSX.Element {
  const { p, isAgent } = useEngagementAccess();
  const rows = s.invoices ?? [];
  const work = useInvoiceWork(rows, { tripOpen: isOpenTrip(t.status) });
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<Invoice | null>(null);
  const finance = area === "finance";
  const canAdd = finance && p.t.has(TRAVEL.ADD_INVOICES);
  const allowed = canAddInvoiceTo(t.status);
  const add = canAdd ? <AddButton label="Add Invoice" allowed={allowed} why={`Invoices cannot be added: the travel request is ${t.status}.`} onClick={() => setAdding(true)} /> : null;
  const columns = invoiceColumns({ job: false, agent: isAgent });
  const sorted = useSortedRows(rows, columns);
  return (
    <>
      {rows.length && (add || (finance && work.any)) ? (
        <TabBar>
          {finance ? work.bulk : null}
          {add}
        </TabBar>
      ) : null}
      <EaTable
        ariaLabel="Travel invoices"
        columns={columns}
        rows={sorted.rows}
        rowKey={(i) => i.id}
        sorting={sorted.sorting}
        selection={finance ? work.selection : undefined}
        onRowClick={setOpen}
        empty={
          <Empty
            title="No Travel Invoices Yet"
            body={allowed ? "The travel agent adds invoices for this request." : "Invoices can be added once the request is In Progress."}
            action={allowed ? add : undefined}
          />
        }
      />
      {adding ? <InvoiceDialog trip={t} onClose={() => setAdding(false)} /> : null}
      {open ? <InvoiceDrawer invoice={open} agent={isAgent} actions={finance ? work.actionsFor(open) : undefined} onClose={() => setOpen(null)} /> : null}
      {work.dialogs}
    </>
  );
}

/** Credit card transactions tagged with this travel's job number (read only). */
function CardExpensesTab({ rows }: { rows: readonly CardExpense[] }): JSX.Element {
  const sorted = useSortedRows(rows, CARD_COLUMNS);
  return (
    <EaTable
      ariaLabel="Credit card expenses"
      columns={CARD_COLUMNS}
      rows={sorted.rows}
      rowKey={(c) => c.id}
      sorting={sorted.sorting}
      empty={<Empty title="No Credit Card Expenses" body="Card transactions tagged with this travel's job number appear here." />}
    />
  );
}

/** Expense claim lines tagged with this travel's job number (read only). */
function ExpenseClaimsTab({ rows }: { rows: readonly ExpenseClaim[] }): JSX.Element {
  const sorted = useSortedRows(rows, CLAIM_COLUMNS);
  return (
    <EaTable
      ariaLabel="Expense claims"
      columns={CLAIM_COLUMNS}
      rows={sorted.rows}
      rowKey={(c) => c.id}
      sorting={sorted.sorting}
      empty={<Empty title="No Expense Claims" body="Expense claims tagged with this travel's job number appear here." />}
    />
  );
}

function PaymentsTab({ t, s: sections, area }: { t: TravelRequest; s: TripSections; area: "finance" | "me" }): JSX.Element {
  const { p } = useEngagementAccess();
  const rows = sections.payments?.items ?? [];
  const work = usePaymentWork(rows);
  const [editing, setEditing] = useState<PerDiemPayment | "new" | null>(null);
  const [open, setOpen] = useState<PerDiemPayment | null>(null);
  const finance = area === "finance";
  const s = sections.payments?.summary;
  const openTrip = isOpenTrip(t.status);
  const canAdd = finance && p.t.has(TRAVEL.ADD_PAYMENTS);
  const canEdit = finance && p.t.has(TRAVEL.EDIT_PAYMENT) && openTrip;
  const addAllowed = Boolean(s) && openTrip && (s?.remaining ?? 0) > 0;
  const why = !s ? "No per diems available." : !openTrip ? "The travel request is not In Progress or Extended." : "No available balance for per diem payments. Please verify the details and try again.";
  const paymentCols = paymentColumns({ traveller: false, job: false });
  const sorted = useSortedRows(rows, paymentCols);
  const tile = (label: string, value: string, tip: string) => (
    <Tooltip title={tip} key={label}>
      <Box tabIndex={0} role="group" aria-label={`${label}. ${tip}`}>
        <Kpi label={label} value={value} />
      </Box>
    </Tooltip>
  );
  return (
    <>
      <SectionTitle>Payment Summary</SectionTitle>
      {s ? (
        <Box sx={PAYMENT_TILES_SX}>
          {tile("Total Per Diem Amount", money(s.totalPerDiem, s.currency), "The total per diem amount found for this job number and currency")}
          {tile("Initial Currency Paid", s.initialCurrencyPaid ? money(s.initialCurrencyPaid, s.currency) : "—", "The invoices that are paid as currency")}
          {tile("Total Travel Card Amount", s.travelCards ? money(s.travelCards, s.currency) : "—", "The total travel card amount found for this job number and currency")}
          {tile("Total Payment Amount", money(s.paid, s.currency), "The amount added to the payments so far")}
          {tile(
            "Remaining Balance",
            money(s.remaining, s.currency),
            "Total Per Diem Amount - Initial Currency Paid - Total Travel Card Amount - Total Payment Amount: the outstanding per diem amount available for further payments.",
          )}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Per Diem Summary is not applicable as no per diems are available for this job number.
        </Typography>
      )}
      {finance && (work.can || canAdd) ? (
        <TabBar>
          {work.bulk}
          {canAdd ? <AddButton label="Add Per Diem Payment" allowed={addAllowed} why={why} onClick={() => setEditing("new")} /> : null}
        </TabBar>
      ) : null}
      <EaTable
        ariaLabel="Per diem payments"
        columns={paymentCols}
        rows={sorted.rows}
        rowKey={(x) => x.id}
        sorting={sorted.sorting}
        selection={finance ? work.selection : undefined}
        onRowClick={setOpen}
        actions={canEdit ? (x) => (x.status === "Pending" && !x.nsError ? [{ label: "Edit Payment", onClick: () => setEditing(x) }] : []) : undefined}
        empty={
          <Empty
            title="No Per Diem Payments Yet"
            body={s ? "Finance adds payments against the remaining per diem balance." : "Payments can be added once the travel request has per diems."}
          />
        }
      />
      {editing ? <PaymentDialog trip={t} summary={s} payment={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} /> : null}
      {open ? <PaymentDrawer payment={open} actions={finance ? work.actionsFor(open) : undefined} onClose={() => setOpen(null)} /> : null}
      {work.dialogs}
    </>
  );
}
