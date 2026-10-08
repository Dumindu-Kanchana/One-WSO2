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

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { Pencil, Plus } from "@wso2/oxygen-ui-icons-react";
import { useId, useState, type JSX } from "react";
import { describeError } from "@api/errors";
import { useAccessToken } from "@hooks/useAccessToken";
import {
  createTrackedRepository,
  deactivateTrackedRepository,
  getAdminRepositories,
  getSyncLogs,
  productDownloadStatsBackendUrl,
  updateTrackedRepository,
  type AdminTrackedRepository,
  type NewTrackedRepository,
  type SyncJobLog,
  type TrackedRepositoryUpdate,
} from "@features/engineering/api/productDownloadStats";
import DateHeaderFilter from "../components/DateHeaderFilter";
import DownloadStatsShell from "../components/DownloadStatsShell";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import SkeletonRows from "../components/SkeletonRows";
import TablePager from "../components/TablePager";
import { usePagination } from "../hooks/usePagination";
import { formatDate, formatDateTime, jobStatusLabel, productLabel } from "../utils/format";

function refreshTrackedLists(queryClient: QueryClient): void {
  // Every Download Stats query except the Admin check. `refetchType: "all"`
  // reloads the Products the other screens read even while those screens are
  // not mounted: the app's QueryClient sets `refetchOnMount: false`, so merely
  // marking them stale would leave the next visit to Downloads on the list
  // from before this write.
  void queryClient.invalidateQueries({
    refetchType: "all",
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey[0] === "product-download-stats" &&
      query.queryKey[1] !== "user-info",
  });
}

function parsePrefixes(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

// The name a confirm and a tooltip use. The Product column does not: that
// column is the product name alone, and "—" when there is none.
function trackedName(repository: Pick<AdminTrackedRepository, "productName" | "repoName">): string {
  return productLabel(repository.productName, repository.repoName);
}

function productCell(productName: string | null): string {
  const name = productName?.trim() ?? "";
  return name === "" ? "—" : name;
}

function prefixesCell(prefixes: readonly string[]): string {
  return prefixes.length > 0 ? prefixes.join(", ") : "All";
}

export default function EngineeringAdminPage(): JSX.Element {
  // The add/edit form is opened from beside the title, which is the shell's
  // to render, so the choice of what is open lives here rather than in the
  // screen. The shell shows the button only once the API has said Admin.
  const [dialog, setDialog] = useState<"add" | AdminTrackedRepository | null>(null);

  return (
    <>
      <DownloadStatsShell
        screen="admin"
        actions={
          <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setDialog("add")}>
            Add repository
          </Button>
        }
      >
        <AdminScreen onEdit={setDialog} />
      </DownloadStatsShell>
      {dialog != null && (
        <RepositoryFormDialog
          key={dialog === "add" ? "add" : dialog.id}
          repository={dialog === "add" ? null : dialog}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

/** Inside the shell, so it is mounted — and asks — only once the API has said the reader is an Admin. */
function AdminScreen({ onEdit }: { onEdit: (repository: AdminTrackedRepository) => void }): JSX.Element {
  const base = productDownloadStatsBackendUrl();
  const getToken = useAccessToken();
  const repositories = useQuery({
    queryKey: ["product-download-stats", "admin-repositories", base],
    queryFn: async () => getAdminRepositories(await getToken()),
  });
  const logs = useQuery({
    queryKey: ["product-download-stats", "sync-logs", base],
    queryFn: async () => getSyncLogs(await getToken()),
  });

  return (
    <Stack spacing={2}>
      <RepositoriesTable
        repositories={repositories.data?.repositories ?? []}
        isPending={repositories.isPending}
        isError={repositories.isError}
        error={repositories.error}
        onRetry={() => void repositories.refetch()}
        onEdit={onEdit}
      />
      <SyncHistoryCard
        logs={logs.data?.logs ?? []}
        isPending={logs.isPending}
        isError={logs.isError}
        error={logs.error}
        onRetry={() => void logs.refetch()}
      />
    </Stack>
  );
}

interface PendingToggle {
  repository: AdminTrackedRepository;
  kind: "isActive" | "trackPackages";
  nextValue: boolean;
}

function confirmCopy(pending: PendingToggle): { title: string; body: string; action: string } {
  const name = trackedName(pending.repository);
  if (pending.kind === "trackPackages") {
    return pending.nextValue
      ? {
          title: "Enable package tracking?",
          body: `Start tracking packages for "${name}"? The web scraper will include it from the next scheduled run.`,
          action: "Enable",
        }
      : {
          title: "Disable package tracking?",
          body: `Stop tracking packages for "${name}"? The web scraper will skip it from the next scheduled run.`,
          action: "Disable",
        };
  }
  return pending.nextValue
    ? {
        title: "Activate repository?",
        body: `Activate "${name}"? It will start appearing in charts, stats, and tables.`,
        action: "Activate",
      }
    : {
        title: "Deactivate repository?",
        body: `Deactivate "${name}"? It will be hidden from all charts, stats, and tables.`,
        action: "Deactivate",
      };
}

function RepositoriesTable({
  repositories,
  isPending,
  isError,
  error,
  onRetry,
  onEdit,
}: {
  repositories: AdminTrackedRepository[];
  isPending: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  onEdit: (repository: AdminTrackedRepository) => void;
}): JSX.Element {
  const getToken = useAccessToken();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<PendingToggle | null>(null);
  const pagination = usePagination(repositories);

  const settle = (id: number): void => {
    refreshTrackedLists(queryClient);
    // A second row can be asked about while this request is still out. Only
    // the dialog that belongs to the row that just succeeded should close.
    setConfirm((current) => (current?.repository.id === id ? null : current));
  };
  const update = useMutation({
    mutationFn: async (variables: { id: number; update: TrackedRepositoryUpdate }) => {
      await updateTrackedRepository(await getToken(), variables.id, variables.update);
    },
    onSuccess: (_data, variables) => settle(variables.id),
  });
  const deactivate = useMutation({
    mutationFn: async (id: number) => deactivateTrackedRepository(await getToken(), id),
    onSuccess: (_data, id) => settle(id),
  });
  const busy = update.isPending || deactivate.isPending;
  const pendingId = deactivate.isPending
    ? (deactivate.variables ?? null)
    : update.isPending
      ? (update.variables?.id ?? null)
      : null;

  const openConfirm = (repository: AdminTrackedRepository, kind: PendingToggle["kind"]): void => {
    // Another row stays enabled, but a second confirm must not reset the
    // request already in flight: that would drop its result.
    if (update.isPending || deactivate.isPending) return;
    update.reset();
    deactivate.reset();
    setConfirm({
      repository,
      kind,
      nextValue: kind === "trackPackages" ? !repository.trackPackages : !repository.isActive,
    });
  };
  const closeConfirm = (): void => {
    if (busy) return;
    update.reset();
    deactivate.reset();
    setConfirm(null);
  };
  const applyConfirm = (): void => {
    if (!confirm || busy) return;
    // The button stays disabled for as long as the request takes, so a slow
    // confirm cannot fire twice.
    const snapshot = confirm;
    if (snapshot.kind === "trackPackages") {
      update.mutate({ id: snapshot.repository.id, update: { trackPackages: snapshot.nextValue } });
    } else if (snapshot.nextValue) {
      update.mutate({ id: snapshot.repository.id, update: { isActive: true } });
    } else {
      deactivate.mutate(snapshot.repository.id);
    }
  };

  if (isPending) {
    return (
      <Card sx={{ p: 2 }}>
        <SkeletonRows />
      </Card>
    );
  }
  if (isError) {
    return (
      <Card sx={{ p: 2 }}>
        <ErrorState error={error} onRetry={onRetry} minHeight={160} />
      </Card>
    );
  }
  if (repositories.length === 0) {
    return (
      <Card sx={{ p: 2 }}>
        <EmptyState
          title="No tracked repositories"
          description="Add a repository to start collecting daily stats."
          minHeight={160}
        />
      </Card>
    );
  }

  const copy = confirm ? confirmCopy(confirm) : null;
  const toggleError = update.error ?? deactivate.error;

  return (
    <>
      <Card sx={{ p: 2, overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Product</TableCell>
              <TableCell>Repository</TableCell>
              <TableCell>Organization</TableCell>
              <TableCell>Prefixes</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Packages</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pagination.paged.map((repository) => {
              const name = trackedName(repository);
              const packagesTitle = repository.trackPackages
                ? `Stop tracking packages for ${name}`
                : `Start tracking packages for ${name}`;
              const activeTitle = repository.isActive ? `Deactivate ${name}` : `Activate ${name}`;
              const rowBusy = pendingId === repository.id;
              return (
                <TableRow key={repository.id} sx={repository.isActive ? undefined : { opacity: 0.5 }}>
                  <TableCell>{productCell(repository.productName)}</TableCell>
                  <TableCell>{repository.repoName}</TableCell>
                  <TableCell>{repository.orgName}</TableCell>
                  <TableCell>{prefixesCell(repository.assetPrefixes)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={repository.isActive ? "Active" : "Inactive"}
                      color={repository.isActive ? "success" : "default"}
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title={packagesTitle}>
                      <Switch
                        size="small"
                        color="success"
                        checked={repository.trackPackages}
                        disabled={rowBusy}
                        onChange={() => openConfirm(repository, "trackPackages")}
                        slotProps={{ input: { role: "switch", "aria-label": packagesTitle } }}
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end", alignItems: "center" }}>
                      <Tooltip title={activeTitle}>
                        <Switch
                          size="small"
                          color="success"
                          checked={repository.isActive}
                          disabled={rowBusy}
                          onChange={() => openConfirm(repository, "isActive")}
                          slotProps={{ input: { role: "switch", "aria-label": activeTitle } }}
                        />
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" aria-label="Edit" onClick={() => onEdit(repository)}>
                          <Pencil size={16} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <TablePager pagination={pagination} />
      </Card>
      <Dialog open={confirm !== null} onClose={closeConfirm} maxWidth="xs" fullWidth>
        <DialogTitle>{copy?.title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            {toggleError && <Alert severity="error">{describeError(toggleError)}</Alert>}
            <Typography color="text.secondary">{copy?.body}</Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={closeConfirm} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={confirm?.nextValue ? "success" : "error"}
            onClick={applyConfirm}
            disabled={busy}
            startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}
          >
            {copy?.action}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function RepositoryFormDialog({
  repository,
  onClose,
}: {
  repository: AdminTrackedRepository | null;
  onClose: () => void;
}): JSX.Element {
  const getToken = useAccessToken();
  const queryClient = useQueryClient();
  const editing = repository != null;
  const [orgName, setOrgName] = useState(repository?.orgName ?? "");
  const [repoName, setRepoName] = useState(repository?.repoName ?? "");
  const [productName, setProductName] = useState(repository?.productName ?? "");
  const [prefixes, setPrefixes] = useState((repository?.assetPrefixes ?? []).join(", "));
  const [isActive, setIsActive] = useState(repository?.isActive ?? true);
  const [trackPackages, setTrackPackages] = useState(repository?.trackPackages ?? false);
  const save = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      const update = {
        productName: productName.trim() === "" ? null : productName.trim(),
        assetPrefixes: parsePrefixes(prefixes),
        isActive,
        trackPackages,
      };
      if (editing && repository) {
        await updateTrackedRepository(token, repository.id, update);
        return;
      }
      const body: NewTrackedRepository = { orgName: orgName.trim(), repoName: repoName.trim(), ...update };
      await createTrackedRepository(token, body);
    },
    onSuccess: () => {
      refreshTrackedLists(queryClient);
      onClose();
    },
  });
  const canSave = editing || (orgName.trim() !== "" && repoName.trim() !== "");
  const close = (): void => {
    if (!save.isPending) onClose();
  };

  return (
    <Dialog open onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? "Edit repository" : "Add tracked repository"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {save.isError && <Alert severity="error">{describeError(save.error)}</Alert>}
          <TextField
            label="Org name"
            value={orgName}
            onChange={(event) => setOrgName(event.target.value)}
            disabled={editing || save.isPending}
            required={!editing}
            fullWidth
            helperText="GitHub org, also used as the owner path segment (e.g. wso2)."
          />
          <TextField
            label="Repo name"
            value={repoName}
            onChange={(event) => setRepoName(event.target.value)}
            disabled={editing || save.isPending}
            required={!editing}
            fullWidth
          />
          <TextField
            label="Product name"
            value={productName}
            onChange={(event) => setProductName(event.target.value)}
            disabled={save.isPending}
            fullWidth
            helperText="Display name shown on the dashboard (optional)."
          />
          <TextField
            label="Asset prefixes"
            value={prefixes}
            onChange={(event) => setPrefixes(event.target.value)}
            disabled={save.isPending}
            fullWidth
            helperText="Comma-separated release-asset name prefixes to track. Leave empty for all assets."
          />
          <FormControlLabel
            control={
              <Switch
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                disabled={save.isPending}
              />
            }
            label="Active (synced daily)"
          />
          <FormControlLabel
            control={
              <Switch
                checked={trackPackages}
                onChange={(event) => setTrackPackages(event.target.checked)}
                disabled={save.isPending}
              />
            }
            label="Track packages (GitHub container packages, scraped nightly)"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={save.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void save.mutate()}
          disabled={!canSave || save.isPending}
          startIcon={save.isPending ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {editing ? "Save" : "Add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const SOURCE_OPTIONS = [
  { value: "DB_SYNC", label: "DB Sync" },
  { value: "PACKAGE_SCRAPE", label: "Scraper Sync" },
] as const;

const STATUS_OPTIONS = ["SUCCESS", "PARTIAL_FAILURE", "FAILED", "STARTED"] as const;

const SOURCE_LABEL: Record<string, string> = {
  DB_SYNC: "DB Sync",
  PACKAGE_SCRAPE: "Scraper Sync",
};

function sourceLabel(source: string): string {
  return SOURCE_LABEL[source] ?? source;
}

function statusColor(status: string): "success" | "warning" | "error" | "info" | "default" {
  switch (status) {
    case "SUCCESS":
      return "success";
    case "PARTIAL_FAILURE":
      return "warning";
    case "FAILED":
      return "error";
    case "STARTED":
      return "info";
    default:
      return "default";
  }
}

// The picker yields a calendar day; the stored value is an RFC3339 instant.
// A row matches when that instant's UTC day starts with the picked day, not
// when the local time falls on it. A reader west of UTC can see the previous
// evening in the cell and still match the UTC day.
function matchesDay(instant: string | null, day: string): boolean {
  if (day === "") return true;
  return instant?.startsWith(day) ?? false;
}

const headerSelectSx = {
  fontSize: "0.75rem",
  height: 24,
  ml: 0.5,
  "& .MuiSelect-select": { py: "2px", px: "8px" },
} as const;

function HeaderSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
}): JSX.Element {
  const labelId = useId();
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <Box component="span" id={labelId}>
        {label}
      </Box>
      <Select
        labelId={labelId}
        size="small"
        displayEmpty
        value={value}
        onChange={(event) => onChange(event.target.value)}
        sx={headerSelectSx}
        SelectDisplayProps={{ "aria-labelledby": labelId }}
      >
        <MenuItem value="">All</MenuItem>
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value} sx={{ fontSize: "0.8rem" }}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </Box>
  );
}

function SyncHistoryCard({
  logs,
  isPending,
  isError,
  error,
  onRetry,
}: {
  logs: SyncJobLog[];
  isPending: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}): JSX.Element {
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startedFilter, setStartedFilter] = useState("");
  const [completedFilter, setCompletedFilter] = useState("");
  const filtered = logs.filter(
    (log) =>
      (sourceFilter === "" || log.source === sourceFilter) &&
      (statusFilter === "" || log.status === statusFilter) &&
      matchesDay(log.startedAt, startedFilter) &&
      matchesDay(log.completedAt, completedFilter),
  );
  const pagination = usePagination(filtered);

  let body: JSX.Element;
  if (isPending) {
    body = <SkeletonRows count={4} />;
  } else if (isError) {
    body = <ErrorState error={error} onRetry={onRetry} minHeight={140} />;
  } else if (logs.length === 0) {
    body = <EmptyState title="No sync or scrape runs yet" minHeight={140} />;
  } else {
    body = (
      <>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>
                <HeaderSelect
                  label="Source"
                  value={sourceFilter}
                  onChange={setSourceFilter}
                  options={SOURCE_OPTIONS}
                />
              </TableCell>
              <TableCell>
                <HeaderSelect
                  label="Status"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={STATUS_OPTIONS.map((status) => ({ value: status, label: jobStatusLabel(status) }))}
                />
              </TableCell>
              <TableCell align="right">Synced</TableCell>
              <TableCell align="right">Failed</TableCell>
              <TableCell>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  Started
                  <DateHeaderFilter type="date" value={startedFilter} onChange={setStartedFilter} format={formatDate} />
                </Box>
              </TableCell>
              <TableCell>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  Completed
                  <DateHeaderFilter
                    type="date"
                    value={completedFilter}
                    onChange={setCompletedFilter}
                    format={formatDate}
                  />
                </Box>
              </TableCell>
              <TableCell>Error</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 3, color: "text.secondary" }}>
                  No results match the selected filters
                </TableCell>
              </TableRow>
            ) : (
              pagination.paged.map((log) => (
                <TableRow key={`${log.source}-${log.id}`}>
                  <TableCell>{sourceLabel(log.source)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={jobStatusLabel(log.status)}
                      color={statusColor(log.status)}
                      sx={{ fontSize: "0.7rem", fontWeight: 500 }}
                    />
                  </TableCell>
                  <TableCell align="right">{log.reposSynced}</TableCell>
                  <TableCell align="right">{log.reposFailed}</TableCell>
                  <TableCell>{formatDateTime(log.startedAt)}</TableCell>
                  <TableCell>{formatDateTime(log.completedAt)}</TableCell>
                  <TableCell
                    title={log.errorMessage || undefined}
                    sx={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {log.errorMessage || "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePager pagination={pagination} />
      </>
    );
  }

  return (
    <Card sx={{ p: 2, overflowX: "auto" }}>
      <Typography variant="h6" component="h3" sx={{ mb: 2 }}>
        Sync & scrape history
      </Typography>
      {body}
    </Card>
  );
}
