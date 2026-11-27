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
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { PlusIcon } from "@wso2/oxygen-ui-icons-react";
import RoutedTabs from "@components/routed-tabs/RoutedTabs";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { AllocationTypeDef, EngagementTypeId } from "../api/engagementTypes";
import { useAllocationTypes, useEngagementTypes, useRoleSettings } from "../api/useEngagementApi";
import { useDeleteAllocationType, useIdempotencyKey, useSaveAllocationType, useSaveRolePrivileges } from "../api/useEngagementMutations";
import { useEngagementAccess } from "../api/useEngagementUserInfo";
import EaDialog, { ConfirmDialog } from "../components/EaDialog";
import EaPage from "../components/EaPage";
import EaTable, { type Column, tableState } from "../components/EaTable";
import { Empty, Failed, ListCard, SectionTitle } from "../components/ListCard";
import ListToolbar from "../components/ListToolbar";
import { Two, Mono } from "../components/StatusChips";
import { engagementPaths, type SettingsTab } from "../engagementPaths";
import type { EngagementAccess } from "../model/engagementAccess";
import { TABLE_HEAD_SX } from "../components/eaStyles";
import { columnAccessors, sortRows } from "../model/sorting";
import { useListView } from "../model/useListView";

const LABEL: Record<SettingsTab, string> = {
  "allocation-roles": "Allocation Roles",
  "travel-roles": "Travel Roles",
  "allocation-types": "Allocation Types",
};

const tabsOf = (a: EngagementAccess): SettingsTab[] => [
  ...(a.allocationTypes ? (["allocation-types"] as const) : []),
  ...(a.allocationRoles ? (["allocation-roles"] as const) : []),
  ...(a.travelRoles ? (["travel-roles"] as const) : []),
];

export function SettingsIndex(): JSX.Element {
  const access = useEngagementAccess();
  return <Navigate to={engagementPaths.settings(tabsOf(access)[0] ?? "allocation-types")} replace />;
}

/** Settings: both apps' Role Settings and Allocation Types, each tab behind its own privilege. */
export default function SettingsPage({ tab }: { tab: SettingsTab }): JSX.Element {
  const access = useEngagementAccess();
  const tabs = tabsOf(access);
  if (!tabs.includes(tab)) return <Navigate to={engagementPaths.settings()} replace />;
  return (
    <EaPage title="Preferences" subtitle={tabs.includes("allocation-types") ? "Role privileges and allocation types." : "Role privileges."}>
      <ListCard>
        {tabs.length > 1 ? <RoutedTabs basePath={engagementPaths.settings()} tabs={tabs.map((t) => ({ segment: t, label: LABEL[t] }))} ariaLabel="Preferences" /> : null}
        {tab === "allocation-roles" ? (
          <RoleSettings key="allocations" app="allocations" />
        ) : tab === "travel-roles" ? (
          <RoleSettings key="travel" app="travel" />
        ) : (
          <AllocationTypes />
        )}
      </ListCard>
    </EaPage>
  );
}

const ROLE_GRID_SX = { display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) minmax(0, 1.8fr)" }, gap: 2.5 } as const;

/** Role Settings while it loads: the role list and the privilege table, with their real headings. */
function RoleSettingsSkeleton(): JSX.Element {
  return (
    <Box sx={ROLE_GRID_SX} aria-busy="true">
      <Box>
        <SectionTitle>Select Role</SectionTitle>
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.5 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <Box key={i} sx={{ px: 2, py: 1, borderBottom: i < 5 ? 1 : 0, borderColor: "divider" }}>
              <Skeleton variant="text" width={`${50 + ((i * 13) % 30)}%`} sx={{ fontSize: 12.5 }} />
              <Skeleton variant="text" width={80} sx={{ fontSize: 12 }} />
            </Box>
          ))}
        </Box>
      </Box>
      <Box>
        <SectionTitle
          aside={
            <Button variant="contained" size="small" disabled>
              Save
            </Button>
          }
        >
          Privileges
        </SectionTitle>
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={TABLE_HEAD_SX}>
                <TableCell padding="checkbox" />
                <TableCell>Privilege</TableCell>
                <TableCell>Description</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Array.from({ length: 8 }, (_, i) => (
                <TableRow key={i}>
                  <TableCell padding="checkbox">
                    <Skeleton variant="rounded" width={18} height={18} sx={{ mx: "auto", my: 1 }} />
                  </TableCell>
                  <TableCell>
                    <Skeleton variant="text" width={`${50 + ((i * 17) % 40)}%`} sx={{ fontSize: 13 }} />
                  </TableCell>
                  <TableCell>
                    <Skeleton variant="text" width={`${60 + ((i * 11) % 35)}%`} sx={{ fontSize: 12.5 }} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Box>
    </Box>
  );
}

/** Role Settings: pick a role (an Asgardeo group), tick its privileges; Save replaces them after a Yes / No. */
function RoleSettings({ app }: { app: "allocations" | "travel" }): JSX.Element {
  const settings = useRoleSettings(app);
  const save = useSaveRolePrivileges();
  const notify = useNotifications();
  const [role, setRole] = useState<string>("");
  const [ticks, setTicks] = useState<Record<string, ReadonlySet<number>>>({});
  const [confirm, setConfirm] = useState(false);
  if (settings.isError) return <Failed what="the role settings" error={settings.error} onRetry={() => void settings.refetch()} retrying={settings.isFetching} />;
  if (settings.isPending) return <RoleSettingsSkeleton />;
  const roles = settings.data.roles;
  if (!roles.length) return <Empty title="No Roles Yet" body="Roles appear here once they are set up for this app." />;
  const current = roles.find((r) => r.role === role) ?? roles[0];
  const ticked = ticks[current.role] ?? new Set(current.privileges);
  const changed = JSON.stringify([...ticked].sort()) !== JSON.stringify([...current.privileges].sort());
  return (
    <Box sx={ROLE_GRID_SX}>
      <Box>
        <SectionTitle>Select Role</SectionTitle>
        <List dense sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, py: 0 }}>
          {roles.map((r) => (
            <ListItemButton key={r.role} selected={r.role === current.role} onClick={() => setRole(r.role)} divider>
              <ListItemText
                primary={r.role}
                secondary={`${r.privileges.length} privilege${r.privileges.length === 1 ? "" : "s"}`}
                slotProps={{ primary: { sx: { fontFamily: "monospace", fontSize: 12.5 } } }}
              />
            </ListItemButton>
          ))}
        </List>
      </Box>
      <Box>
        <SectionTitle
          aside={
            <Button variant="contained" size="small" disabled={!changed} onClick={() => setConfirm(true)}>
              Save
            </Button>
          }
        >
          Privileges of {current.role}
        </SectionTitle>
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={TABLE_HEAD_SX}>
                <TableCell padding="checkbox" />
                <TableCell>Privilege</TableCell>
                <TableCell>Description</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {settings.data.privileges.map((pr) => (
                <TableRow key={pr.id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={ticked.has(pr.id)}
                      inputProps={{ "aria-label": pr.name }}
                      onChange={() =>
                        setTicks((all) => {
                          const next = new Set(all[current.role] ?? current.privileges);
                          if (next.has(pr.id)) next.delete(pr.id);
                          else next.add(pr.id);
                          return { ...all, [current.role]: next };
                        })
                      }
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: 13 }}>{pr.name}</TableCell>
                  <TableCell sx={{ fontSize: 12.5, color: "text.secondary" }}>{pr.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Box>
      {confirm ? (
        <ConfirmDialog
          title="Update Role Privileges"
          confirmLabel="Update Privileges"
          busyLabel="Updating…"
          text={`Are you sure you want to update the privileges of ${current.role}?`}
          run={() => save.mutateAsync({ app, roleId: current.id, privileges: [...ticked].sort((a, b) => a - b) })}
          onDone={() => {
            notify.showSuccess("Role privileges updated successfully");
            setTicks((all) => {
              const next = { ...all };
              delete next[current.role];
              return next;
            });
          }}
          onClose={() => setConfirm(false)}
        />
      ) : null}
    </Box>
  );
}

/** Department names are stored in capitals; they are shown in Title Case. */
const titleCase = (x: string) => x.toLowerCase().replace(/(^|[\s\-&/(])([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());

/** Allocation Types (privilege 25): the types per engagement type, their codes and colours. */
function AllocationTypes(): JSX.Element {
  const types = useAllocationTypes();
  const engagementTypes = useEngagementTypes();
  const remove = useDeleteAllocationType();
  const notify = useNotifications();
  const list = useListView("allocation-types");
  const [editing, setEditing] = useState<AllocationTypeDef | "new" | null>(null);
  const [deleting, setDeleting] = useState<AllocationTypeDef | null>(null);
  const typeFilter = list.filters.engagementType ?? "";
  const q = list.search.toLowerCase();
  const typeName = (id: number) => engagementTypes.data?.find((t) => t.id === id)?.name ?? String(id);
  const rows = (types.data ?? []).filter(
    (x) => (!typeFilter || String(x.engagementTypeId) === typeFilter) && (!q || [x.name, x.department, x.code].some((v) => (v ?? "").toLowerCase().includes(q))),
  );
  const columns: Column<AllocationTypeDef>[] = [
    { key: "name", label: "Allocation Type", sortKey: "name", sortValue: (x) => x.name, render: (x) => x.name },
    { key: "et", label: "Engagement Type", sortKey: "engagementType", sortValue: (x) => typeName(x.engagementTypeId), render: (x) => typeName(x.engagementTypeId) },
    { key: "dept", label: "Department", sortKey: "department", sortValue: (x) => x.department, render: (x) => (x.department ? titleCase(x.department) : "—") },
    {
      key: "color",
      label: "Color Code",
      render: (x) =>
        x.color ? (
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
            <Box sx={{ width: 14, height: 14, borderRadius: 0.5, bgcolor: x.color, border: 1, borderColor: "divider" }} />
            <Mono>{x.color}</Mono>
          </Stack>
        ) : (
          "—"
        ),
    },
    { key: "code", label: "Engagement Code", sortKey: "code", sortValue: (x) => x.code, render: (x) => <Two main={<Mono>{x.code || "—"}</Mono>} sub={x.suffix ? `Suffix ${x.suffix}` : undefined} /> },
    { key: "notify", label: "Notify To Allocations", sortKey: "notify", sortValue: (x) => x.notifyToAllocations, render: (x) => x.notifyToAllocations ?? "—" },
  ];
  return (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          If Notify To Allocations is set to No and a Department is available for the Allocation Type, the engagement email notifications are sent to the leads of that
          Department, except for Marketing Events. For Marketing Events, the notifications are sent only to the lead of the engagement creator / updater. If Notify To
          Allocations is Yes or not selected, the notifications are sent to the Allocations group email.
      </Typography>
      <ListToolbar
        search={list.search}
        placeholder="Search allocation types"
        onSearch={list.setSearch}
        filters={[{ key: "engagementType", label: "Engagement Type", type: "select", options: (engagementTypes.data ?? []).map((t) => [String(t.id), t.name] as const) }]}
        applied={list.filters}
        onApply={list.setFilters}
        onRemove={list.removeFilter}
        right={
          <Button variant="contained" size="small" startIcon={<PlusIcon size={14} />} onClick={() => setEditing("new")}>
            Add Allocation Type
          </Button>
        }
      />
      {types.isError ? (
        <Failed what="the allocation types" error={types.error} onRetry={() => void types.refetch()} retrying={types.isFetching} />
      ) : (
        <EaTable
          ariaLabel="Allocation types"
          columns={columns}
          rows={list.pageOf(sortRows(rows, list.sort, columnAccessors(columns)))}
          sorting={list.sorting}
          pagination={list.pager(rows.length)}
          rowKey={(x) => x.id}
          {...tableState(types)}
          actions={(x) => [
            { label: "Edit", onClick: () => setEditing(x) },
            { label: "Delete", danger: true, onClick: () => setDeleting(x) },
          ]}
          empty={q || typeFilter ? <Empty title="No Allocation Types Match" body="Change the search or the filter to see more." /> : <Empty title="No Allocation Types Yet" body="Add an allocation type to offer it on the engagement forms." />}
        />
      )}
      {editing ? (
        <AllocationTypeDialog
          type={editing === "new" ? undefined : editing}
          defaultTypeId={typeFilter ? (Number(typeFilter) as EngagementTypeId) : 1}
          departments={[...new Set((types.data ?? []).map((x) => x.department).filter((d): d is string => Boolean(d)))].sort()}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title="Delete Allocation Type"
          confirmLabel="Delete"
          busyLabel="Deleting…"
          text={`Are you sure you want to delete ${deleting.name} (${typeName(deleting.engagementTypeId)})?`}
          danger
          run={() => remove.mutateAsync({ id: deleting.id })}
          onDone={() => notify.showSuccess("Allocation type deleted successfully")}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}

function AllocationTypeDialog({
  type,
  defaultTypeId,
  departments,
  onClose,
}: {
  type?: AllocationTypeDef;
  defaultTypeId: EngagementTypeId;
  departments: readonly string[];
  onClose: () => void;
}): JSX.Element {
  const engagementTypes = useEngagementTypes();
  const save = useSaveAllocationType();
  const idem = useIdempotencyKey();
  const notify = useNotifications();
  const [f, setF] = useState({
    engagementTypeId: String(type?.engagementTypeId ?? defaultTypeId),
    name: type?.name ?? "",
    code: type?.code ?? "",
    suffix: type?.suffix ?? "",
    department: type?.department ?? "",
    notifyToAllocations: type?.notifyToAllocations ?? "",
    color: type?.color ?? "#00aabb",
  });
  const [error, setError] = useState<unknown>();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <EaDialog
      title={type ? "Edit Allocation Type" : "Add Allocation Type"}
      confirmLabel={type ? "Save Changes" : "Add Allocation Type"}
      busy={save.isPending}
      error={error}
      onClose={onClose}
      onConfirm={() => {
        if (!f.engagementTypeId || !f.name.trim() || !f.code.trim()) return setError("Engagement Type, Allocation Type and Default Engagement Code are required.");
        setError(undefined);
        save.mutate(
          {
            id: type?.id,
            idempotencyKey: type ? undefined : idem.key,
            engagementTypeId: Number(f.engagementTypeId) as EngagementTypeId,
            name: f.name.trim(),
            code: f.code.trim(),
            suffix: f.suffix.trim() || undefined,
            department: f.department.trim().toUpperCase() || undefined,
            notifyToAllocations: (f.notifyToAllocations || undefined) as AllocationTypeDef["notifyToAllocations"],
            color: f.color,
          },
          {
            onSuccess: () => {
              notify.showSuccess(`Allocation type ${type ? "updated" : "added"} successfully`);
              onClose();
            },
            onError: setError,
          },
        );
      }}
    >
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, pt: 1 }}>
        <TextField select size="small" required label="Engagement Type" value={f.engagementTypeId} onChange={set("engagementTypeId")}>
          {(engagementTypes.data ?? []).map((t) => (
            <MenuItem key={t.id} value={String(t.id)}>
              {t.name}
              {t.active ? "" : " (Inactive)"}
            </MenuItem>
          ))}
        </TextField>
        <TextField size="small" required label="Allocation Type" value={f.name} onChange={set("name")} slotProps={{ htmlInput: { maxLength: 90 } }} />
        <TextField size="small" required label="Default Engagement Code" value={f.code} onChange={set("code")} slotProps={{ htmlInput: { maxLength: 90, style: { fontFamily: "monospace" } } }} />
        <TextField size="small" label="Engagement Code Suffix" value={f.suffix} onChange={set("suffix")} slotProps={{ htmlInput: { maxLength: 90, style: { fontFamily: "monospace" } } }} />
        <Autocomplete
          freeSolo
          size="small"
          options={departments}
          value={f.department}
          onInputChange={(_, v) => setF((x) => ({ ...x, department: v }))}
          renderInput={(params) => <TextField {...params} label="Department" />}
        />
        <TextField
          select
          size="small"
          label="Notify To Allocations"
          value={f.notifyToAllocations}
          onChange={set("notifyToAllocations")}
          helperText="Yes: the Allocations group is copied. No: the requester's reporting lead is copied instead."
        >
          <MenuItem value="">
            <em>Select</em>
          </MenuItem>
          <MenuItem value="No">No</MenuItem>
          <MenuItem value="Yes">Yes</MenuItem>
        </TextField>
        <TextField size="small" type="color" label="Color" value={f.color} onChange={set("color")} sx={{ "& input": { height: 28, p: 0.5 } }} />
      </Box>
    </EaDialog>
  );
}
