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
import { Alert, Autocomplete, Button, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import { DownloadIcon } from "@wso2/oxygen-ui-icons-react";
import RoutedTabs from "@components/routed-tabs/RoutedTabs";
import { describeError } from "@api/errors";
import { engagementServiceUrls, type EngagementQueryParams } from "@config/apiConfig";
import { localIsoDate } from "@utils/localDate";
import { saveBlob } from "@utils/saveFile";
import type { ConsultantAllocationRow, EmployeeOption, Invoice, PerDiemPayment } from "../api/engagementTypes";
import { useEngagementBasis } from "../api/engagementBasis";
import { engagementCsv, eaError } from "../api/engagementHttp";
import { useConsultantReport, useEngagementTypes, useInvoiceReport, useOrgStructure, usePaymentReport, useReferenceData } from "../api/useEngagementApi";
import { useEngagementAccess } from "../api/useEngagementUserInfo";
import EaPage from "../components/EaPage";
import EaTable, { type Column, tableState } from "../components/EaTable";
import { Empty, Failed, ListCard } from "../components/ListCard";
import PersonPicker from "../components/PersonPicker";
import { Two, Mono } from "../components/StatusChips";
import { engagementPaths, type ReportsTab } from "../engagementPaths";
import { fmtRange, yearStart } from "../model/format";
import { columnAccessors, sortRows } from "../model/sorting";
import { useListView } from "../model/useListView";
import { invoiceColumns, paymentColumns } from "../invoices/invoiceColumns";
import { FilterBar, FilterDateRange, FilterInput, FilterSelect } from "../components/FilterFields";
import { FILTER_WIDE_SX } from "../components/eaStyles";
import type { EngagementAccess } from "../model/engagementAccess";

const LABEL: Record<ReportsTab, string> = {
  "consultant-allocations": "Consultant Allocations",
  invoices: "Travel Invoices",
  "per-diem-payments": "Per Diem Payments",
};

const tabsOf = (a: EngagementAccess): ReportsTab[] => [
  ...(a.consultantReport ? (["consultant-allocations"] as const) : []),
  ...(a.allInvoices ? (["invoices"] as const) : []),
  ...(a.allPayments ? (["per-diem-payments"] as const) : []),
];

/** `/reports`: the first report this person may open. */
export function ReportsIndex(): JSX.Element {
  const access = useEngagementAccess();
  return <Navigate to={engagementPaths.reports(tabsOf(access)[0] ?? "invoices")} replace />;
}

/** Reports: the Allocations app's Consultant Allocations report and the Travel app's Reports (invoices and per diem payments added in a date range), each with Export CSV. */
export default function ReportsPage({ tab }: { tab: ReportsTab }): JSX.Element {
  const access = useEngagementAccess();
  const tabs = tabsOf(access);
  if (!tabs.includes(tab)) return <Navigate to={engagementPaths.reports()} replace />;
  const names = tabs.map((t) => ({ "consultant-allocations": "consultant allocations", invoices: "travel invoices", "per-diem-payments": "per diem payments" })[t]);
  const what = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  return (
    <EaPage title="Reports" subtitle={`${what.charAt(0).toUpperCase()}${what.slice(1)} for a date range, with Export CSV.`}>
      <ListCard>
        {tabs.length > 1 ? <RoutedTabs basePath={engagementPaths.reports()} tabs={tabs.map((t) => ({ segment: t, label: LABEL[t] }))} ariaLabel="Reports" /> : null}
        {tab === "consultant-allocations" ? <ConsultantReport key={tab} /> : tab === "invoices" ? <TravelReport key={tab} kind="invoices" /> : <TravelReport key={tab} kind="per-diem-payments" />}
      </ListCard>
    </EaPage>
  );
}

/** Export CSV: the same report and filters from the backend, as text/csv. */
function ExportButton({
  report,
  params,
  filename,
  disabled,
}: {
  report: "consultant-allocations" | "invoices" | "per-diem-payments";
  params: EngagementQueryParams; filename: string; disabled: boolean }): JSX.Element {
  const { getToken } = useEngagementBasis();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      {error ? (
        <Typography variant="caption" color="error">
          {error}
        </Typography>
      ) : null}
      <Button
        size="small"
        variant="outlined"
        startIcon={<DownloadIcon size={14} />}
        disabled={disabled || busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            saveBlob(await engagementCsv(engagementServiceUrls.report(report, { ...params, format: "csv" }), await getToken()), filename);
          } catch (e) {
            setError(`Couldn't export. ${describeError(eaError(e))}`);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Exporting…" : "Export CSV"}
      </Button>
    </Stack>
  );
}

function RangeBar({
  from,
  to,
  onSearch,
  onReset,
  children,
  start,
  end,
}: {
  from: string;
  to: string;
  onSearch: (from: string, to: string) => void;
  onReset: () => void;
  children?: ReactNode;
  start?: ReactNode;
  end?: ReactNode;
}) {
  const [draft, setDraft] = useState({ from, to });
  const [error, setError] = useState("");
  return (
    <FilterBar
      onSearch={() => {
        if (!draft.from || !draft.to || draft.from > draft.to) return setError("Start Date must be on or before End Date");
        setError("");
        onSearch(draft.from, draft.to);
      }}
      onReset={onReset}
      start={start}
      end={end}
      error={error ? <Alert severity="warning">{error}</Alert> : null}
    >
      {children}
      <FilterDateRange from={draft.from} to={draft.to} onChange={setDraft} />
    </FilterBar>
  );
}

/** Rows and period of the shown report: the left side of the filter actions row. */
function ResultLine({ count, loading, from, to }: { count: number | undefined; loading: boolean; from: string; to: string }) {
  return (
    <>
      <Typography variant="body2" color="text.secondary">
        Rows <b>{loading ? <Skeleton variant="text" width={24} sx={{ display: "inline-block" }} /> : (count ?? "—")}</b>
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Period <b>{fmtRange(from, to)}</b>
      </Typography>
    </>
  );
}

function TravelReport({ kind }: { kind: "invoices" | "per-diem-payments" }): JSX.Element {
  const today = localIsoDate();
  const list = useListView(kind);
  const from = list.filters.from || yearStart(today);
  const to = list.filters.to || today;
  const params = { from, to };
  const invoices = useInvoiceReport(params, kind === "invoices");
  const payments = usePaymentReport(params, kind === "per-diem-payments");
  const q = kind === "invoices" ? invoices : payments;
  const rows = (q.data ?? []) as readonly (Invoice | PerDiemPayment)[];
  const invoiceCols = invoiceColumns({ approvals: false, status: true, added: true });
  const paymentCols = paymentColumns();
  const sortedInvoices = sortRows(invoices.data ?? [], list.sort, columnAccessors(invoiceCols));
  const sortedPayments = sortRows(payments.data ?? [], list.sort, columnAccessors(paymentCols));
  const filename = kind === "invoices" ? `${from}_to_${to}_invoices.csv` : `${from}_to_${to}_perdiem.csv`;
  return (
    <>
      <RangeBar
        key={`${from}${to}`}
        from={from}
        to={to}
        onSearch={(f, t) => list.setFilters({ from: f, to: t })}
        onReset={() => list.setFilters({})}
        start={<ResultLine count={q.isPlaceholderData ? undefined : q.data?.length} loading={q.isPending || q.isPlaceholderData} from={from} to={to} />}
        end={<ExportButton report={kind} params={params} filename={filename} disabled={!rows.length} />}
      />
      {q.isError ? (
        <Failed what="the report" error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />
      ) : kind === "invoices" ? (
        <EaTable
          ariaLabel="Invoices report"
          columns={invoiceCols}
          rows={list.pageOf(sortedInvoices)}
          sorting={list.sorting}
          pagination={list.pager(sortedInvoices.length)}
          rowKey={(i) => i.id}
          {...tableState(invoices)}
          empty={<Empty title="No Invoices in This Range" body="Change the dates and search again." />}
        />
      ) : (
        <EaTable
          ariaLabel="Per diem payments report"
          columns={paymentCols}
          rows={list.pageOf(sortedPayments)}
          sorting={list.sorting}
          pagination={list.pager(sortedPayments.length)}
          rowKey={(x) => x.id}
          {...tableState(payments)}
          empty={<Empty title="No Per Diem Payments in This Range" body="Change the dates and search again." />}
        />
      )}
    </>
  );
}

/** Consultant Allocations: days per consultant, allocation type and engagement code for a period, with the GL mapping finance uses. */
function ConsultantReport(): JSX.Element {
  const today = localIsoDate();
  const list = useListView("consultant-report");
  const ref = useReferenceData();
  const org = useOrgStructure();
  const types = useEngagementTypes();
  const f = list.filters;
  const from = f.from || yearStart(today);
  const to = f.to || today;
  const params: EngagementQueryParams = {
    from,
    to,
    consultant: f.consultant || undefined,
    allocationTypeId: f.allocationTypeId ? f.allocationTypeId.split(",") : undefined,
    businessUnit: f.businessUnit || undefined,
    department: f.department || undefined,
    team: f.team || undefined,
  };
  // Runs on load for the viewer's own scope over the default range (1 January to today), as in the
  // prototype; the filters then narrow it.
  const report = useConsultantReport(params, true);
  const [draft, setDraft] = useState({
    person: f.consultant ? ({ email: f.consultant, name: f.consultant } as EmployeeOption) : null,
    types: f.allocationTypeId ? f.allocationTypeId.split(",") : [],
    businessUnit: f.businessUnit ?? "",
    department: f.department ?? "",
    team: f.team ?? "",
  });
  const rows = report.data ?? [];
  const hours = rows.some((r) => (r.workingHours ?? 0) > 0);
  const typeOptions = (types.data ?? []).flatMap((t) => t.allocationTypes.map((a) => ({ id: a.id, name: a.name, group: t.name })));
  const na = (x: string) => (!x || x === "NOT AVAILABLE" || x === "N/A" || x === "NOT_DEFINED" ? "—" : x);

  const columns: Column<ConsultantAllocationRow>[] = [
    { key: "email", label: "Email", sortKey: "email", sortValue: (r) => r.email, render: (r) => <Two main={r.email} sub={[r.department, r.company].filter(Boolean).join("\n")} /> },
    { key: "code", label: "Engagement Code", sortKey: "code", sortValue: (r) => r.engagementCode, render: (r) => <Two main={na(r.engagementCode) === "—" ? "—" : <Mono>{r.engagementCode}</Mono>} sub={[na(r.engagementTypeName) !== "—" ? r.engagementTypeName : "", r.country].filter(Boolean).join("\n")} /> },
    { key: "type", label: "Allocation Type", sortKey: "type", sortValue: (r) => r.allocationTypeName, render: (r) => <Two main={na(r.allocationTypeName)} sub={r.dailyHourly} /> },
    { key: "cal", label: "Calendar Days", align: "right", sortKey: "calendarDays", sortValue: (r) => r.calendarDays, render: (r) => r.calendarDays },
    { key: "work", label: "Working Days", align: "right", sortKey: "workingDays", sortValue: (r) => r.workingDays, render: (r) => r.workingDays },
    ...(hours ? [{ key: "hours", label: "Working Hours", align: "right" as const, render: (r: ConsultantAllocationRow) => r.workingHours ?? "—" }] : []),
    {
      key: "ebu",
      label: "Engagement Business Unit",
      sortKey: "businessUnit",
      sortValue: (r) => r.engagementBusinessUnit,
      render: (r) => <Two main={na(r.engagementBusinessUnit)} sub={na(r.engagementSalesPOD) !== "—" ? `Sales POD ${r.engagementSalesPOD}` : undefined} />,
    },
    {
      key: "acct",
      label: "Account Name",
      sortKey: "account",
      sortValue: (r) => r.accountName,
      render: (r) => <Two main={na(r.accountName)} sub={[na(r.engagementGroup) !== "—" ? r.engagementGroup : "", na(r.glCode) !== "—" ? `GL ${r.glCode}` : ""].filter(Boolean).join("\n") || undefined} />,
    },
  ];
  const sortedRows = sortRows(rows, list.sort, columnAccessors(columns));

  const filters = (
    <>
      <PersonPicker label="Consultant" value={draft.person} onChange={(person) => setDraft((d) => ({ ...d, person }))} placeholder="All Consultants" />
      <Autocomplete
        multiple
        size="small"
        options={typeOptions}
        groupBy={(o) => o.group}
        getOptionLabel={(o) => o.name}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        value={typeOptions.filter((o) => draft.types.includes(o.id))}
        onChange={(_, v) => setDraft((d) => ({ ...d, types: [...new Set(v.map((o) => o.id))] }))}
        renderInput={(params) => <FilterInput params={params} label="By Allocation Types" />}
        sx={FILTER_WIDE_SX}
      />
      <FilterSelect
        label="Business Unit"
        value={draft.businessUnit}
        options={org.data?.businessUnits ?? ref.data?.businessUnits ?? []}
        onChange={(v) => setDraft((d) => ({ ...d, businessUnit: v, department: "", team: "" }))}
      />
      <FilterSelect
        label="Department"
        value={draft.department}
        options={(org.data?.departments ?? []).filter((x) => !draft.businessUnit || x.businessUnit === draft.businessUnit).map((x) => x.name)}
        onChange={(v) => setDraft((d) => ({ ...d, department: v, team: "" }))}
      />
      <FilterSelect
        label="Team"
        value={draft.team}
        options={(org.data?.teams ?? []).filter((t) => (!draft.businessUnit || t.businessUnit === draft.businessUnit) && (!draft.department || t.department === draft.department)).map((t) => t.name)}
        onChange={(v) => setDraft((d) => ({ ...d, team: v }))}
      />
    </>
  );

  return (
    <>
      <RangeBar
        key={`${from}${to}`}
        from={from}
        to={to}
        onSearch={(fromDate, toDate) =>
          list.setFilters({
            from: fromDate,
            to: toDate,
            consultant: draft.person?.email ?? "",
            allocationTypeId: draft.types.join(","),
            businessUnit: draft.businessUnit,
            department: draft.department,
            team: draft.team,
          })
        }
        onReset={() => {
          setDraft({ person: null, types: [], businessUnit: "", department: "", team: "" });
          list.setFilters({});
        }}
        start={<ResultLine count={report.isPlaceholderData ? undefined : report.data?.length} loading={report.isPending || report.isPlaceholderData} from={from} to={to} />}
        end={<ExportButton report="consultant-allocations" params={params} filename={`consultant-allocations-${from}-to-${to}.csv`} disabled={!rows.length} />}
      >
        {filters}
      </RangeBar>
      {report.isError ? (
        <Failed what="the report" error={report.error} onRetry={() => void report.refetch()} retrying={report.isFetching} />
      ) : (
        <EaTable
          ariaLabel="Consultant allocations"
          columns={columns}
          rows={list.pageOf(sortedRows)}
          sorting={list.sorting}
          pagination={list.pager(rows.length)}
          rowKey={(r) => `${r.email}|${r.engagementCode}|${r.allocationTypeName}|${r.dailyHourly}|${r.engagementTypeName}`}
          {...tableState(report)}
          empty={<Empty title="No Allocations in This Period" body="Change the dates or filters and search again." />}
        />
      )}
    </>
  );
}
