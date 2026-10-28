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

import { useMemo, useState, type ReactNode } from "react";
import { Navigate } from "react-router";
import {
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import {
  CircleCheckIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  Trash2Icon,
} from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { Okr } from "../api/okrTypes";
import { useAllOkrs, useDeleteOkr, useParIsOkrManager, useUpdateOkr } from "../api/useOkrs";
import ParShell from "../components/ParShell";
import ParOkrDialog from "../components/ParOkrDialog";
import ParOkrList from "../components/ParOkrList";
import { groupOkrsByOwner, okrProgress, okrState } from "../util/okr";

type Filter = "all" | "open" | "overdue" | "completed";

// OKR managers (for example the Chief of Staff's office) set objectives for
// people with a due date, change them, and mark them completed. Everyone's
// OKRs, one card per person.
export default function ParOkrsPage() {
  const okrs = useAllOkrs();
  const update = useUpdateOkr();
  const remove = useDeleteOkr();
  const { showSuccess, showError } = useNotifications();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [dialog, setDialog] = useState<{
    okr?: Okr;
    ownerEmail?: string;
  } | null>(null);
  const [deleting, setDeleting] = useState<Okr | null>(null);

  const all = useMemo(() => okrs.data ?? [], [okrs.data]);
  const counts = useMemo(() => {
    const states = all.map((o) => okrState(o));
    return {
      people: new Set(all.map((o) => o.ownerEmail)).size,
      total: all.length,
      completed: states.filter((s) => s === "completed").length,
      overdue: states.filter((s) => s === "overdue").length,
    };
  }, [all]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const shown = all.filter((o) => {
      const state = okrState(o);
      if (filter === "completed" && state !== "completed") return false;
      if (filter === "overdue" && state !== "overdue") return false;
      if (filter === "open" && state === "completed") return false;
      if (!q) return true;
      return (
        o.ownerEmail.toLowerCase().includes(q) ||
        (o.ownerName ?? "").toLowerCase().includes(q) ||
        o.objective.toLowerCase().includes(q)
      );
    });
    return groupOkrsByOwner(shown);
  }, [all, search, filter]);

  const setStatus = (okr: Okr, status: Okr["status"]) =>
    update.mutate(
      { okrId: okr.okrId, update: { status } },
      {
        onSuccess: () => showSuccess(status === "COMPLETED" ? "Marked completed." : "Reopened."),
        onError: (err) => showError(describeError(err)),
      },
    );

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.okrId, {
      onSuccess: () => {
        showSuccess("OKR deleted.");
        setDeleting(null);
      },
      onError: (err) => showError(describeError(err)),
    });
  };

  return (
    <ParShell
      title="OKRs"
      subtitle="Set objectives with a due date for the leadership team. Each person sees theirs on Home and in their self-review, and their lead sees them when reviewing."
    >
      <Stack spacing={2} sx={{ maxWidth: 1100 }}>
        <Box
          sx={{
            display: "flex",
            gap: 1.5,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <TextField
            size="small"
            placeholder="Search people or objectives"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 260, flex: { xs: 1, sm: "0 1 320px" } }}
            slotProps={{
              htmlInput: { "aria-label": "Search people or objectives" },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon size={16} />
                  </InputAdornment>
                ),
              },
            }}
          />
          <ToggleButtonGroup
            size="small"
            exclusive
            value={filter}
            onChange={(_e, v: Filter | null) => v && setFilter(v)}
            aria-label="Show"
          >
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="open">Open</ToggleButton>
            <ToggleButton value="overdue">Overdue</ToggleButton>
            <ToggleButton value="completed">Completed</ToggleButton>
          </ToggleButtonGroup>
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" startIcon={<PlusIcon size={16} />} onClick={() => setDialog({})}>
            Set an OKR
          </Button>
        </Box>

        {okrs.isSuccess && (
          <Typography variant="body2" color="text.secondary">
            {counts.total} OKR{counts.total === 1 ? "" : "s"} for {counts.people}{" "}
            {counts.people === 1 ? "person" : "people"} · {counts.completed} completed · {counts.overdue} overdue
          </Typography>
        )}

        {okrs.isLoading ? (
          <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 1.5 }} />
        ) : okrs.isError ? (
          <ErrorNotice error={okrs.error} onRetry={() => okrs.refetch()} retrying={okrs.isFetching}>
            Couldn't load OKRs.
          </ErrorNotice>
        ) : groups.length === 0 ? (
          <Card variant="outlined" sx={{ p: 4, textAlign: "center" }}>
            <Typography sx={{ fontWeight: 600 }}>{all.length === 0 ? "No OKRs yet" : "Nothing matches"}</Typography>
            <Typography variant="body2" color="text.secondary">
              {all.length === 0
                ? "Set the first one: pick someone in the leadership team, write the objective and give it a due date."
                : "Try another search or filter."}
            </Typography>
          </Card>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: 2,
              alignItems: "start",
            }}
          >
            {groups.map((group) => {
              const { completed, total } = okrProgress(group.okrs);
              return (
                <Card key={group.ownerEmail} variant="outlined" sx={{ p: 2 }}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 1,
                      mb: 1.5,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600 }} noWrap>
                        {group.ownerName ?? group.ownerEmail}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" component="div" noWrap>
                        {group.ownerEmail}
                        {group.ownerLeadEmail ? ` · Lead: ${group.ownerLeadEmail}` : ""}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        flexShrink: 0,
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        {completed} of {total} completed
                      </Typography>
                      <Tooltip title="Add an OKR for this person">
                        <IconButton
                          size="small"
                          aria-label={`Add an OKR for ${group.ownerName ?? group.ownerEmail}`}
                          onClick={() => setDialog({ ownerEmail: group.ownerEmail })}
                        >
                          <PlusIcon size={16} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                  <ParOkrList
                    okrs={group.okrs}
                    actions={(okr) => (
                      <>
                        {okr.status === "OPEN" ? (
                          <ActionButton
                            label="Mark completed"
                            onClick={() => setStatus(okr, "COMPLETED")}
                            disabled={update.isPending}
                          >
                            <CircleCheckIcon size={16} />
                          </ActionButton>
                        ) : (
                          <ActionButton
                            label="Reopen"
                            onClick={() => setStatus(okr, "OPEN")}
                            disabled={update.isPending}
                          >
                            <RotateCcwIcon size={16} />
                          </ActionButton>
                        )}
                        <ActionButton label="Edit" onClick={() => setDialog({ okr })}>
                          <PencilIcon size={16} />
                        </ActionButton>
                        <ActionButton label="Delete" onClick={() => setDeleting(okr)}>
                          <Trash2Icon size={16} />
                        </ActionButton>
                      </>
                    )}
                  />
                </Card>
              );
            })}
          </Box>
        )}
      </Stack>

      {dialog && <ParOkrDialog open okr={dialog.okr} ownerEmail={dialog.ownerEmail} onClose={() => setDialog(null)} />}

      <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete this OKR?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            "{deleting?.objective}" will no longer show for {deleting?.ownerName ?? deleting?.ownerEmail} or their lead.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleting(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmDelete} disabled={remove.isPending}>
            {remove.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </ParShell>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip title={label}>
      <span>
        <IconButton size="small" aria-label={label} onClick={onClick} disabled={disabled}>
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );
}

/** Guards the OKRs page: OKR managers only. */
export function ParRequiresOkrManagerRoute({ children }: { children: ReactNode }) {
  const gate = useParIsOkrManager();
  if (gate.isLoading) return null;
  if (gate.isError) {
    return (
      <Box sx={{ p: 2 }}>
        <ErrorNotice error={gate.error} onRetry={gate.retry}>
          Couldn't check whether you can set OKRs.
        </ErrorNotice>
      </Box>
    );
  }
  if (!gate.isOkrManager) return <Navigate to="/me/performance" replace />;
  return <>{children}</>;
}
