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

import { useState, type ReactNode } from "react";
import { Button, Typography } from "@wso2/oxygen-ui";
import { CheckIcon, RefreshCwIcon, SendIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { BatchOutcome, Invoice, PerDiemPayment } from "../api/engagementTypes";
import { useIdempotencyKey, useInvoiceBatch, usePaymentBatch } from "../api/useEngagementMutations";
import { useEngagementAccess } from "../api/useEngagementUserInfo";
import { ConfirmDialog } from "../components/EaDialog";
import RejectDialog from "./RejectDialog";
import type { RowSelection } from "../components/EaTable";
import { invoiceSteps } from "../model/engagementAccess";
import { plural } from "../model/format";
import { invoiceStage, type InvoiceStage } from "../model/statuses";

/** Reports a bulk action's outcome: what succeeded, and the first refusal in the server's words. */
export function useBatchReport() {
  const notify = useNotifications();
  return (result: BatchOutcome, verb: string, noun: string) => {
    if (result.done.length) notify.showSuccess(`${plural(result.done.length, noun)} ${verb}`);
    if (result.failed.length) {
      notify.showError(`${plural(result.failed.length, noun)} could not be ${verb}: ${result.failed[0].message}`);
    }
  };
}

type InvoiceDialog = { kind: "approve" | "reject" | "push" | "resync"; ids: string[]; stage: InvoiceStage };

/** Invoice approval: PO approval, finance approval, Push to NetSuite and Re-sync. */
export function useInvoiceWork(rows: readonly Invoice[], { tripOpen, resetKey }: { tripOpen?: boolean; resetKey?: string } = {}) {
  const { p } = useEngagementAccess();
  const steps = invoiceSteps(p);
  const batch = useInvoiceBatch();
  // One key per push the person confirms, reused if they retry it.
  const pushKey = useIdempotencyKey();
  const report = useBatchReport();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [dialog, setDialog] = useState<InvoiceDialog | null>(null);
  // A confirmation names the invoices of one queue, so it does not outlive a move to another.
  const [dialogQueue, setDialogQueue] = useState(resetKey);
  if (dialogQueue !== resetKey) {
    setDialogQueue(resetKey);
    setDialog(null);
  }

  const stepActs = (stage: InvoiceStage): boolean =>
    (stage === "po" && steps.po) || (stage === "finance" && steps.finance) || ((stage === "push" || stage === "failed") && steps.push);
  // The backend's per-invoice `actions` decide where it sends them; the legacy step rules otherwise.
  const actsOn = (stage: InvoiceStage, i?: Invoice): boolean => {
    const a = i?.actions;
    if (!a) return stepActs(stage);
    if (stage === "po") return Boolean(a.approvePo || a.reject);
    if (stage === "finance") return Boolean(a.approve || a.reject);
    if (stage === "push") return Boolean(a.push);
    if (stage === "failed") return Boolean(a.resync);
    return false;
  };
  const any = steps.po || steps.finance || steps.push;
  const byId = new Map(rows.map((i) => [i.id, i]));
  // A refresh can move a selected invoice to another step or out of the user's reach, so only the selected rows
  // that are still actionable count, and only those at the first one's step.
  const live = [...selected].map((id) => byId.get(id)).filter((i): i is Invoice => i !== undefined && tripOpen !== false && actsOn(invoiceStage(i), i));
  const stageOfSelection = live.length ? invoiceStage(live[0]) : null;
  const selectedIds = live.filter((i) => invoiceStage(i) === stageOfSelection).map((i) => i.id);

  const canSelect = (i: Invoice): true | string => {
    if (tripOpen === false) return "The travel request is not In Progress or Extended";
    const stage = invoiceStage(i);
    if (!actsOn(stage, i)) return "Not at an approval step you act on";
    if (stageOfSelection && stageOfSelection !== stage) return "Select invoices at one approval step at a time";
    return true;
  };

  const selection: RowSelection<Invoice> | undefined = any
    ? {
        selected,
        canSelect,
        rowLabel: (i) => `Select invoice ${i.number}`,
        onToggle: (id) =>
          setSelected((s) => {
            const next = new Set(s);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          }),
        onToggleAll: (ids) =>
          setSelected((s) => {
            if (ids.every((id) => s.has(id))) return new Set();
            const first = ids.map((id) => byId.get(id)).find(Boolean);
            const stage = stageOfSelection ?? (first ? invoiceStage(first) : null);
            return new Set(ids.filter((id) => {
              const i = byId.get(id);
              return i !== undefined && invoiceStage(i) === stage;
            }));
          }),
      }
    : undefined;

  const open = (kind: InvoiceDialog["kind"], ids: string[], stage: InvoiceStage) => setDialog({ kind, ids, stage });

  /** The buttons for the current selection, in the order Reject, Approve, then the push. */
  const bulkFor = (ids: string[], stage: InvoiceStage | null): ReactNode => {
    if (!stage || !ids.length) return null;
    const po = stage === "po";
    if (po || stage === "finance") {
      return (
        <>
          <Button size="small" variant="outlined" color="error" startIcon={<XIcon size={14} />} onClick={() => open("reject", ids, stage)}>
            {po ? "Reject (PO)" : "Reject"}
          </Button>
          <Button size="small" variant="contained" startIcon={<CheckIcon size={14} />} onClick={() => open("approve", ids, stage)}>
            {po ? "Approve (PO)" : "Approve"}
          </Button>
        </>
      );
    }
    if (stage === "push") {
      return (
        <Button size="small" variant="contained" startIcon={<SendIcon size={14} />} onClick={() => open("push", ids, stage)}>
          Push Invoices to NetSuite
        </Button>
      );
    }
    if (stage === "failed") {
      return (
        <Button size="small" variant="contained" startIcon={<RefreshCwIcon size={14} />} onClick={() => open("resync", ids, stage)}>
          Re-sync with NetSuite
        </Button>
      );
    }
    return null;
  };

  const bulk: ReactNode = selectedIds.length ? (
    <>
      <Typography variant="body2" color="text.secondary">
        {selectedIds.length} selected
      </Typography>
      {bulkFor(selectedIds, stageOfSelection)}
    </>
  ) : null;

  const done = () => {
    setSelected(new Set());
    setDialog(null);
    pushKey.renew();
  };
  const act = (action: "approve" | "reject" | "push" | "resync", list: string[], reason?: string) =>
    batch.mutateAsync({ action, ids: list, reason, idempotencyKey: action === "push" ? pushKey.keyFor([...list].sort().join(",")) : undefined });

  let dialogs: ReactNode = null;
  if (dialog?.kind === "reject") {
    dialogs = <RejectDialog count={dialog.ids.length} onClose={() => setDialog(null)} run={async (reason) => report(await act("reject", dialog.ids, reason), "rejected", "invoice")} onDone={done} />;
  } else if (dialog?.kind === "approve") {
    dialogs = (
      <ConfirmDialog
        title={dialog.stage === "po" ? "Approve Invoices (PO)" : "Approve Invoices"}
        confirmLabel="Approve"
        busyLabel="Approving…"
        text={`Approve ${plural(dialog.ids.length, "invoice")}? ${dialog.stage === "po" ? "They go to finance for approval next." : "They can then be pushed to NetSuite."}`}
        run={async () => report(await act("approve", dialog.ids), "approved", "invoice")}
        onDone={done}
        onClose={() => setDialog(null)}
      />
    );
  } else if (dialog?.kind === "push") {
    dialogs = (
      <ConfirmDialog
        title="Push Invoices to NetSuite"
        confirmLabel="Push to NetSuite"
        busyLabel="Pushing…"
        text={`Push ${plural(dialog.ids.length, "invoice")} to NetSuite as purchase orders? Each one is looked up in NetSuite first, so nothing is pushed twice.`}
        run={async () => report(await act("push", dialog.ids), "pushed", "invoice")}
        onDone={done}
        onClose={() => setDialog(null)}
      />
    );
  } else if (dialog?.kind === "resync") {
    dialogs = (
      <ConfirmDialog
        title="Re-sync with NetSuite"
        confirmLabel="Re-sync"
        busyLabel="Re-syncing…"
        text={`Look up ${plural(dialog.ids.length, "record")} in NetSuite and update their NetSuite status here. Nothing is pushed again.`}
        run={async () => report(await act("resync", dialog.ids), "re-synced", "invoice")}
        onDone={done}
        onClose={() => setDialog(null)}
      />
    );
  }

  /** The drawer footer's actions for one invoice: the same rules and requests as the bulk ones. */
  const actionsFor = (i: Invoice): ReactNode => {
    const stage = invoiceStage(i);
    if (!actsOn(stage, i) || tripOpen === false) return null;
    return bulkFor([i.id], stage);
  };

  return { selection, bulk, dialogs, actionsFor, any };
}

/** Per diem payments: Push Payments to NetSuite while the trip is open, and Re-sync with NetSuite. */
export function usePaymentWork(rows: readonly PerDiemPayment[]) {
  const { p } = useEngagementAccess();
  const can = invoiceSteps(p).pushPayments;
  const batch = usePaymentBatch();
  const pushKey = useIdempotencyKey();
  const report = useBatchReport();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [dialog, setDialog] = useState<{ kind: "push" | "resync"; ids: string[] } | null>(null);

  const failed = (x: PerDiemPayment) => x.status === "Pending" && Boolean(x.nsError);
  const canSelect = (x: PerDiemPayment): true | string => {
    if (x.status === "Complete") return "Already pushed to NetSuite";
    if (failed(x)) return true;
    if (x.actions && !x.actions.push) return "The travel request is not In Progress or Extended";
    return true;
  };
  const byId = new Map(rows.map((x) => [x.id, x]));
  const ids = [...selected].filter((id) => byId.has(id));
  const anyFailed = ids.some((id) => failed(byId.get(id)!));

  const selection: RowSelection<PerDiemPayment> | undefined = can
    ? {
        selected,
        canSelect,
        rowLabel: (x) => `Select per diem payment ${x.id}`,
        onToggle: (id) =>
          setSelected((s) => {
            const next = new Set(s);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          }),
        onToggleAll: (all) => setSelected((s) => (all.every((id) => s.has(id)) ? new Set() : new Set(all))),
      }
    : undefined;

  const buttonFor = (list: string[], resyncing: boolean): ReactNode =>
    resyncing ? (
      <Button size="small" variant="contained" startIcon={<RefreshCwIcon size={14} />} onClick={() => setDialog({ kind: "resync", ids: list })}>
        Re-sync with NetSuite
      </Button>
    ) : (
      <Button size="small" variant="contained" startIcon={<SendIcon size={14} />} onClick={() => setDialog({ kind: "push", ids: list })}>
        Push Payments to NetSuite
      </Button>
    );

  const bulk: ReactNode = ids.length ? (
    <>
      <Typography variant="body2" color="text.secondary">
        {ids.length} selected
      </Typography>
      {buttonFor(ids, anyFailed)}
    </>
  ) : null;

  const done = () => {
    setSelected(new Set());
    setDialog(null);
    pushKey.renew();
  };
  let dialogs: ReactNode = null;
  if (dialog?.kind === "push") {
    dialogs = (
      <ConfirmDialog
        title="Push Payments to NetSuite"
        confirmLabel="Push to NetSuite"
        busyLabel="Pushing…"
        text={`Push ${plural(dialog.ids.length, "per diem payment")} to NetSuite as vendor bills? Each one is looked up in NetSuite first, so nothing is pushed twice.`}
        run={async () => report(await batch.mutateAsync({ action: "push", ids: dialog.ids, idempotencyKey: pushKey.keyFor([...dialog.ids].sort().join(",")) }), "pushed", "per diem payment")}
        onDone={done}
        onClose={() => setDialog(null)}
      />
    );
  } else if (dialog?.kind === "resync") {
    dialogs = (
      <ConfirmDialog
        title="Re-sync with NetSuite"
        confirmLabel="Re-sync"
        busyLabel="Re-syncing…"
        text={`Look up ${plural(dialog.ids.length, "per diem payment")} in NetSuite and update their NetSuite status here. Nothing is pushed again.`}
        run={async () => report(await batch.mutateAsync({ action: "resync", ids: dialog.ids }), "re-synced", "per diem payment")}
        onDone={done}
        onClose={() => setDialog(null)}
      />
    );
  }

  const actionsFor = (x: PerDiemPayment): ReactNode => (can && canSelect(x) === true ? buttonFor([x.id], failed(x)) : null);

  return { selection, bulk, dialogs, actionsFor, can };
}
