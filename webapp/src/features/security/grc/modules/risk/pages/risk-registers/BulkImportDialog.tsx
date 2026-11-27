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

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import { Download, Upload } from "@wso2/oxygen-ui-icons-react";
import type { JSX } from "react";
import { useAuthApiClient } from "@features/security/grc/shim/useAuthApiClient";
import { downloadBulkImportTemplate, fetchSourceRegisterTeams, runBulkImport } from "../../api/riskApi";
import type {
  BulkImportFinding,
  BulkImportFiles,
  BulkImportMode,
  BulkImportProgress,
  BulkImportResult,
  RiskTeam,
} from "../../api/riskApi";
import { dialogPaperSx } from "../cardStyles";
import { downloadBlob } from "./utils";

// Findings shown in the table. The full list is in the errors.csv download.
const MAX_FINDINGS_SHOWN = 100;

const TEMPLATE_LABELS: Record<string, string> = {
  STANDARD: "Standard",
  AGGREGATED: "Aggregated (platforms)",
  MANAGED_SERVICES: "Managed Services",
};

const PHASE_LABELS: Record<string, string> = {
  preflight: "Checking reference data",
  parse: "Reading the file",
  resolve: "Looking up people",
  write: "Writing risks",
  verify: "Verifying what was written",
};

// The result's files: which field holds each, what it is called, and how it is saved.
const DOWNLOADS: { key: keyof BulkImportFiles; fileName: string; csv: boolean }[] = [
  { key: "errors_csv", fileName: "errors.csv", csv: true },
  { key: "report", fileName: "report.txt", csv: false },
  { key: "risk_codes_csv", fileName: "risk_codes.csv", csv: true },
];

// A run that is in flight: what it is and how far it has got.
interface RunningState {
  mode: BulkImportMode;
  progress: BulkImportProgress;
}

const SEVERITY_ORDER: Record<string, number> = { REJECT: 0, MISMATCH: 1, WARN: 2 };

interface BulkImportDialogProps {
  open: boolean;
  onClose: () => void;
  // Called once an import has finished, so the register list can refresh.
  onImported: () => void;
}

// Imports a historical register from a CSV into one register — Compliance Admin
// only (the backend enforces it; the page only shows the button to holders).
//
// The flow is deliberately two-step: a dry run reads the whole file and reports
// every problem without writing anything, and the import is offered only for a
// file whose dry run found nothing to reject. The server does not rely on that:
// an import re-validates the whole file and writes nothing if any row is rejected.
// Choosing a different file or register clears the dry run, because its result
// says nothing about the new one.
//
// A run is one open request that streams its progress back. Closing the window
// is not offered while it runs; if the connection drops anyway the run stops, and
// running the same file again continues where an import got to.
export default function BulkImportDialog({ open, onClose, onImported }: BulkImportDialogProps): JSX.Element {
  const authFetch = useAuthApiClient();

  const [registers, setRegisters] = useState<RiskTeam[]>([]);
  const [registersError, setRegistersError] = useState("");
  const [registerId, setRegisterId] = useState<number | "">("");
  const [file, setFile] = useState<File | null>(null);

  // The run in flight, the latest finished result, and the last dry run's result
  // (kept while the import that follows replaces `result`).
  const [runningState, setRunning] = useState<RunningState | null>(null);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [dryRun, setDryRun] = useState<BulkImportResult | null>(null);
  // Which kind of run was started last, and why the last one stopped, if it did.
  const [lastMode, setLastMode] = useState<BulkImportMode | null>(null);
  const [runError, setRunError] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const onImportedRef = useRef(onImported);
  onImportedRef.current = onImported;

  // Leaving the page ends the request, which stops the run on the server.
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setRegistersError("");
    fetchSourceRegisterTeams(authFetch)
      .then((teams) => {
        if (!cancelled) setRegisters(teams.filter((t) => t.status === "ACTIVE" && t.code));
      })
      .catch((e: unknown) => {
        if (!cancelled) setRegistersError(e instanceof Error ? e.message : "Failed to load the registers.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, authFetch]);

  const reset = useCallback(() => {
    setResult(null);
    setDryRun(null);
    setLastMode(null);
    setRunError("");
    setAcknowledged(false);
    setDownloadError("");
  }, []);

  const running = runningState !== null;
  const selectedRegister = registers.find((r) => r.id === registerId) ?? null;

  const handleClose = () => {
    if (running) return;
    reset();
    setFile(null);
    setRegisterId("");
    onClose();
  };

  const start = async (mode: BulkImportMode) => {
    if (registerId === "" || !file) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning({ mode, progress: { phase: "preflight", done: 0, total: 0 } });
    setLastMode(mode);
    setResult(null);
    setRunError("");
    setDownloadError("");
    if (mode === "dry_run") {
      setDryRun(null);
      setAcknowledged(false);
    }
    try {
      const finished = await runBulkImport(authFetch, {
        registerId,
        mode,
        file,
        acknowledgeWarnings: mode === "import" && acknowledged,
        signal: controller.signal,
        onProgress: (progress) => {
          if (mountedRef.current) setRunning({ mode, progress });
        },
      });
      if (!mountedRef.current) return;
      setResult(finished);
      if (mode === "dry_run") setDryRun(finished);
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      setRunError(e instanceof Error ? e.message : "The run could not complete.");
    } finally {
      if (mountedRef.current) {
        setRunning(null);
        // An import that stopped part-way may still have written rows.
        if (mode === "import") onImportedRef.current();
      }
    }
  };

  const download = async (task: () => Promise<{ blob: Blob; fileName: string }>) => {
    setDownloadError("");
    try {
      const { blob, fileName } = await task();
      downloadBlob(blob, fileName);
    } catch (e: unknown) {
      setDownloadError(e instanceof Error ? e.message : "Failed to download the file.");
    }
  };

  // A result file is text held in the page. CSVs get the byte order mark Excel
  // needs to read non-ASCII text as UTF-8.
  const saveFile = (text: string, fileName: string, csv: boolean) =>
    downloadBlob(
      new Blob([csv ? `\uFEFF${text}` : text], { type: csv ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8" }),
      fileName,
    );

  // What the latest dry run allows. The server re-checks everything on an import;
  // this only avoids offering a button for a file that would be refused.
  const dryCounts = dryRun?.counts;
  const warnings = dryCounts?.warnings ?? 0;
  // When the dry run knows what the import would write, nothing to write means
  // nothing to import: every row is already in the register.
  const toWrite = dryCounts?.plan_known ? (dryCounts.to_write ?? 0) : (dryRun?.rows ?? 0);
  const canImport =
    !!dryRun &&
    dryCounts?.rejects === 0 &&
    dryCounts.mismatches === 0 &&
    toWrite > 0 &&
    (warnings === 0 || acknowledged) &&
    !running &&
    lastMode !== "import";
  const importDone = lastMode === "import" && result?.mode === "import";
  // A refused import wrote nothing, so the admin can run the dry run again.
  const importFinished = importDone && (result?.counts.rejects ?? 0) === 0;
  const downloads = DOWNLOADS.filter((d) => !!result?.files?.[d.key]);

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md" PaperProps={{ sx: dialogPaperSx }}>
      <DialogTitle>Import risks from CSV</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Alert severity="info">
            Use this to load a historical register. Imported risks enter as Approved or Closed, and each person named in the
            file is given the access their role needs. Do not raise risks in the register while an import runs, because risk
            numbers are assigned in order, and do not start two imports at once.
          </Alert>

          {registersError && <Alert severity="error">{registersError}</Alert>}

          <FormControl fullWidth size="small" disabled={running}>
            <InputLabel id="bulk-import-register">Register</InputLabel>
            <Select
              labelId="bulk-import-register"
              label="Register"
              value={registerId}
              onChange={(e) => {
                setRegisterId(Number(e.target.value) || "");
                reset();
              }}
            >
              {registers.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.name} — {TEMPLATE_LABELS[r.register_template] ?? r.register_template}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Download size={16} />}
              disabled={!selectedRegister || running}
              onClick={() => selectedRegister && void download(() => downloadBulkImportTemplate(authFetch, selectedRegister.id))}
            >
              Download template
            </Button>
            <Button
              component="label"
              variant="outlined"
              size="small"
              startIcon={<Upload size={16} />}
              disabled={!selectedRegister || running}
            >
              Choose CSV file
              <input
                hidden
                type="file"
                accept=".csv,text/csv"
                aria-label="CSV file"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  reset();
                  e.target.value = ""; // so choosing the same file again still fires
                }}
              />
            </Button>
            <Typography variant="body2" color="text.secondary" noWrap>
              {file ? file.name : "No file chosen"}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            The template has only the columns this register needs, in order. Save your sheet as CSV (UTF-8). At most 1000 rows.
          </Typography>

          {runError && <Alert severity="error">{runError}</Alert>}
          {downloadError && <Alert severity="error">{downloadError}</Alert>}

          {runningState && <Progress run={runningState} />}

          {dryRun && lastMode === "dry_run" && !runError && (
            <DryRunResult dryRun={dryRun} acknowledged={acknowledged} onAcknowledge={setAcknowledged} />
          )}

          {importDone && result && <ImportResult result={result} />}

          {!running && downloads.length > 0 && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
              <Typography variant="body2">Download:</Typography>
              {downloads.map((d) => (
                <Button
                  key={d.key}
                  size="small"
                  variant="text"
                  startIcon={<Download size={14} />}
                  onClick={() => saveFile(result?.files?.[d.key] ?? "", d.fileName, d.csv)}
                >
                  {d.fileName}
                </Button>
              ))}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={running}>
          {importFinished ? "Close" : "Cancel"}
        </Button>
        <Button
          variant="outlined"
          // Off while a run is going and after an import that finished, which a second
          // import of the same file would only repeat. Left on after a FAILED import:
          // its message says to run the file again, and a fresh dry run is how the
          // admin finds out which rows are still to write.
          disabled={registerId === "" || !file || running || importFinished}
          onClick={() => void start("dry_run")}
        >
          Run dry run
        </Button>
        <Button variant="contained" disabled={!canImport} onClick={() => void start("import")}>
          Import {toWrite > 0 ? `${toWrite} ${toWrite === 1 ? "row" : "rows"}` : ""}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Progress({ run }: { run: RunningState }): JSX.Element {
  const { mode, progress } = run;
  const label = PHASE_LABELS[progress.phase] ?? "Working";
  const determinate = progress.total > 0 && progress.phase === "write";
  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 0.5 }}>
        {mode === "dry_run" ? "Dry run" : "Import"}: {label}
        {determinate ? ` (${progress.done} of ${progress.total})` : "…"}
      </Typography>
      <LinearProgress
        variant={determinate ? "determinate" : "indeterminate"}
        value={determinate ? (progress.done / progress.total) * 100 : 0}
      />
      {mode === "import" && (
        <Typography variant="caption" color="text.secondary">
          Keep this window open. If the connection drops, the import stops; run the same file again to continue.
        </Typography>
      )}
    </Box>
  );
}

function DryRunResult({
  dryRun,
  acknowledged,
  onAcknowledge,
}: {
  dryRun: BulkImportResult;
  acknowledged: boolean;
  onAcknowledge: (v: boolean) => void;
}): JSX.Element {
  const counts = dryRun.counts;
  const rejects = counts.rejects;
  const warnings = counts.warnings;
  const planKnown = !!counts.plan_known;
  const toWrite = counts.to_write ?? 0;
  const alreadyDone = counts.already_done ?? 0;
  const nothingToImport = rejects === 0 && planKnown && toWrite === 0;
  const findings = sortFindings(dryRun.findings);

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip size="small" label={`${dryRun.rows} rows`} />
        <Chip size="small" color={rejects ? "error" : "success"} label={`${rejects} rejected`} />
        <Chip size="small" color={warnings ? "warning" : "default"} label={`${warnings} warnings`} />
        {planKnown && rejects === 0 && <Chip size="small" color="info" label={`${toWrite} to write`} />}
        {planKnown && alreadyDone > 0 && <Chip size="small" label={`${alreadyDone} already there`} />}
      </Stack>

      {rejects > 0 ? (
        <Alert severity="error">
          Nothing was written, and this file cannot be imported while any row is rejected. Fix the rows below in the
          sheet and run the dry run again.
        </Alert>
      ) : nothingToImport ? (
        <Alert severity="info">
          Every row in this file is already in the register from an earlier import, so there is nothing to import. Nothing
          was written.
        </Alert>
      ) : (
        <Alert severity="success">
          The dry run found nothing to reject. Nothing has been written yet.
          {planKnown
            ? ` The import would write ${toWrite} ${toWrite === 1 ? "row" : "rows"}${alreadyDone > 0 ? ` and skip ${alreadyDone} that ${alreadyDone === 1 ? "is" : "are"} already there` : ""}.`
            : ""}
        </Alert>
      )}

      {rejects === 0 && !nothingToImport && warnings > 0 && (
        <FormControlLabel
          control={<Checkbox checked={acknowledged} onChange={(e) => onAcknowledge(e.target.checked)} />}
          label="I have reviewed the warnings and accept them"
        />
      )}

      {findings.length > 0 && <FindingsTable findings={findings} truncated={!!dryRun.findings_truncated} />}
    </Stack>
  );
}

function sortFindings(findings: BulkImportFinding[] | undefined): BulkImportFinding[] {
  return [...(findings ?? [])].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9) || a.csv_row - b.csv_row,
  );
}

function FindingsTable({ findings, truncated }: { findings: BulkImportFinding[]; truncated: boolean }): JSX.Element {
  const shown = findings.slice(0, MAX_FINDINGS_SHOWN);
  return (
    <Box>
      <TableContainer sx={{ maxHeight: 320 }}>
        <Table size="small" stickyHeader aria-label="Findings">
          <TableHead>
            <TableRow>
              <TableCell>Row</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Field</TableCell>
              <TableCell>Detail</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {shown.map((f, i) => (
              <TableRow key={`${f.csv_row}-${f.failure}-${i}`}>
                <TableCell>{f.csv_row > 0 ? f.csv_row : "—"}</TableCell>
                <TableCell>
                  <Chip size="small" color={f.severity === "WARN" ? "warning" : "error"} label={f.severity} />
                </TableCell>
                <TableCell>{f.failure}</TableCell>
                <TableCell>{f.detail}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {(findings.length > shown.length || truncated) && (
        <Typography variant="caption" color="text.secondary">
          Showing the first {shown.length}. Download errors.csv for the full list.
        </Typography>
      )}
    </Box>
  );
}

function ImportResult({ result }: { result: BulkImportResult }): JSX.Element {
  const c = result.counts;
  // The import checks the whole file again before it writes. A row rejected by
  // that check means nothing was written, which is not the same as an import that
  // finished and then found differences.
  if (c.rejects > 0) {
    const findings = sortFindings(result.findings);
    return (
      <Stack spacing={1.5}>
        <Alert severity="error">
          The import was refused and nothing was written, because the file no longer passes the check (for example, the
          directory answered differently after the dry run). Fix the rows below, run the dry run again, then import.
        </Alert>
        {findings.length > 0 && <FindingsTable findings={findings} truncated={!!result.findings_truncated} />}
      </Stack>
    );
  }
  const mismatched = c.mismatches > 0;
  return (
    <Alert severity={mismatched ? "warning" : "success"}>
      {mismatched
        ? "The import finished, but the check afterwards found differences. Download errors.csv and report.txt."
        : "The import finished and what was written matches the file."}{" "}
      {c.migrated} written, {c.skipped} already there. Download risk_codes.csv for the risk number of every row.
    </Alert>
  );
}
