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
  Box,
  Button,
  Card,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  ListingTable,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { useState, type JSX } from "react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
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
  type TrackedRepositoryUpdate,
} from "@features/engineering/api/productDownloadStats";
import DownloadStatsShell from "../components/DownloadStatsShell";
import { formatDateTime, productLabel } from "../utils/format";
import { jobStatusLabel } from "./display";

function refreshTrackedLists(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({
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
          <Button variant="contained" onClick={() => setDialog("add")}>
            Add tracked repository
          </Button>
        }
      >
        <AdminScreen onEdit={setDialog} />
      </DownloadStatsShell>
      {dialog != null && (
        <RepositoryDialog
          key={dialog === "add" ? "add" : dialog.id}
          repository={dialog === "add" ? null : dialog}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

/** Inside the shell, so it is mounted — and asks — only once the API has said the reader is an Admin. */
function AdminScreen({
  onEdit,
}: {
  onEdit: (repository: AdminTrackedRepository) => void;
}): JSX.Element {
  const base = productDownloadStatsBackendUrl();
  const getToken = useAccessToken();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<AdminTrackedRepository | null>(null);

  const repositories = useQuery({
    queryKey: ["product-download-stats", "admin-repositories", base],
    queryFn: async () => getAdminRepositories(await getToken()),
  });
  const logs = useQuery({
    queryKey: ["product-download-stats", "sync-logs", base],
    queryFn: async () => getSyncLogs(await getToken()),
  });
  const deactivate = useMutation({
    mutationFn: async (id: number) => deactivateTrackedRepository(await getToken(), id),
    onSuccess: () => {
      refreshTrackedLists(queryClient);
      deactivate.reset();
      setConfirm(null);
    },
  });

  return (
    <Box>
      <Stack spacing={2}>
          <Card sx={{ p: 2 }}>
            {repositories.isPending ? (
              <Loading label="Loading tracked repositories…" />
            ) : repositories.isError || repositories.data == null ? (
              <ErrorNotice onRetry={() => void repositories.refetch()} error={repositories.error}>
                Couldn't load tracked repositories.
              </ErrorNotice>
            ) : (
            <ListingTable.Provider>
              <ListingTable.Container>
                <ListingTable bordered>
                  <ListingTable.Head>
                    <ListingTable.Row>
                      <ListingTable.Cell>Product</ListingTable.Cell>
                      <ListingTable.Cell>Organisation</ListingTable.Cell>
                      <ListingTable.Cell>Repository</ListingTable.Cell>
                      <ListingTable.Cell>Collection</ListingTable.Cell>
                      <ListingTable.Cell>Package downloads</ListingTable.Cell>
                      <ListingTable.Cell> </ListingTable.Cell>
                    </ListingTable.Row>
                  </ListingTable.Head>
                  <ListingTable.Body>
                    {repositories.data.repositories.map((repository) => {
                      const label = productLabel(repository.productName, repository.repoName);
                      return (
                        <ListingTable.Row key={repository.id}>
                          <ListingTable.Cell>{label}</ListingTable.Cell>
                          <ListingTable.Cell>{repository.orgName}</ListingTable.Cell>
                          <ListingTable.Cell>{repository.repoName}</ListingTable.Cell>
                          <ListingTable.Cell>{repository.isActive ? "On" : "Off"}</ListingTable.Cell>
                          <ListingTable.Cell>{repository.trackPackages ? "On" : "Off"}</ListingTable.Cell>
                          <ListingTable.Cell>
                            <Button size="small" onClick={() => onEdit(repository)}>
                              Edit {label}
                            </Button>
                            {repository.isActive && (
                              <Button
                                size="small"
                                onClick={() => {
                                  deactivate.reset();
                                  setConfirm(repository);
                                }}
                              >
                                Deactivate {label}
                              </Button>
                            )}
                          </ListingTable.Cell>
                        </ListingTable.Row>
                      );
                    })}
                  </ListingTable.Body>
                </ListingTable>
              </ListingTable.Container>
            </ListingTable.Provider>
            )}
          </Card>
          <Card sx={{ p: 2 }}>
            {logs.isPending ? (
              <Loading label="Loading collection jobs…" />
            ) : logs.isError || logs.data == null ? (
              <ErrorNotice onRetry={() => void logs.refetch()} error={logs.error}>
                Couldn't load collection jobs.
              </ErrorNotice>
            ) : (
            <>
            <Typography component="h2" variant="h6" sx={{ mb: 1 }}>
              Collection jobs
            </Typography>
            <ListingTable.Provider>
              <ListingTable.Container>
                <ListingTable bordered>
                  <ListingTable.Head>
                    <ListingTable.Row>
                      <ListingTable.Cell>Status</ListingTable.Cell>
                      <ListingTable.Cell align="right">Synced</ListingTable.Cell>
                      <ListingTable.Cell align="right">Failed</ListingTable.Cell>
                      <ListingTable.Cell>Started</ListingTable.Cell>
                      <ListingTable.Cell>Error</ListingTable.Cell>
                    </ListingTable.Row>
                  </ListingTable.Head>
                  <ListingTable.Body>
                    {logs.data.logs.map((log) => (
                      <ListingTable.Row key={`${log.source}-${log.id}`}>
                        <ListingTable.Cell>{jobStatusLabel(log.status)}</ListingTable.Cell>
                        <ListingTable.Cell align="right">{log.reposSynced}</ListingTable.Cell>
                        <ListingTable.Cell align="right">{log.reposFailed}</ListingTable.Cell>
                        <ListingTable.Cell>{formatDateTime(log.startedAt)}</ListingTable.Cell>
                        <ListingTable.Cell>{log.errorMessage ?? ""}</ListingTable.Cell>
                      </ListingTable.Row>
                    ))}
                  </ListingTable.Body>
                </ListingTable>
              </ListingTable.Container>
              </ListingTable.Provider>
            </>
            )}
          </Card>
        </Stack>
      <Dialog
        open={confirm != null}
        onClose={() => {
          deactivate.reset();
          setConfirm(null);
        }}
      >
        <DialogTitle>Deactivate tracked repository</DialogTitle>
        <DialogContent>
          {deactivate.isError && (
            <ErrorNotice
              onRetry={() => {
                if (confirm) deactivate.mutate(confirm.id);
              }}
              error={deactivate.error}
            >
              Couldn't deactivate the tracked repository.
            </ErrorNotice>
          )}
          <Typography>
            Deactivate {confirm ? productLabel(confirm.productName, confirm.repoName) : ""}? Collection
            stops. Its history stays.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              deactivate.reset();
              setConfirm(null);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (confirm) deactivate.mutate(confirm.id);
            }}
            disabled={deactivate.isPending}
          >
            Deactivate
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function RepositoryDialog({
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
      const update: TrackedRepositoryUpdate = {
        productName: productName.trim() === "" ? null : productName.trim(),
        assetPrefixes: parsePrefixes(prefixes),
        isActive,
        trackPackages,
      };
      if (editing && repository) {
        await updateTrackedRepository(token, repository.id, update);
        return;
      }
      const body: NewTrackedRepository = {
        orgName: orgName.trim(),
        repoName: repoName.trim(),
        ...update,
      };
      await createTrackedRepository(token, body);
    },
    onSuccess: () => {
      refreshTrackedLists(queryClient);
      onClose();
    },
  });
  const canSave = editing || (orgName.trim() !== "" && repoName.trim() !== "");

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? "Edit tracked repository" : "Add tracked repository"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {save.isError && (
            <ErrorNotice onRetry={() => void save.mutate()} error={save.error}>
              Couldn't save the tracked repository.
            </ErrorNotice>
          )}
          <TextField
            label="Organisation"
            value={orgName}
            onChange={(event) => setOrgName(event.target.value)}
            disabled={editing}
            required={!editing}
            fullWidth
          />
          <TextField
            label="Repository"
            value={repoName}
            onChange={(event) => setRepoName(event.target.value)}
            disabled={editing}
            required={!editing}
            fullWidth
          />
          <TextField
            label="Product name"
            value={productName}
            onChange={(event) => setProductName(event.target.value)}
            fullWidth
          />
          <TextField
            label="Release-file prefixes"
            value={prefixes}
            onChange={(event) => setPrefixes(event.target.value)}
            helperText="Leave empty to count every release file."
            fullWidth
          />
          <FormControlLabel
            control={<Switch checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />}
            label="Collection is on"
          />
          <FormControlLabel
            control={
              <Switch checked={trackPackages} onChange={(event) => setTrackPackages(event.target.checked)} />
            }
            label="Package downloads are collected"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={() => void save.mutate()} disabled={!canSave || save.isPending}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Loading({ label }: { label: string }): JSX.Element {
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
      <CircularProgress size={16} />
      <Typography>{label}</Typography>
    </Stack>
  );
}
