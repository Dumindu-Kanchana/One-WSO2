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
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { Pencil, Plus, Trash2 } from "@wso2/oxygen-ui-icons-react";
import { type JSX, useState } from "react";
import { useAuthApiClient } from "@features/security/grc/shim/useAuthApiClient";
import { createLookup, deleteLookup, fetchLookups, type Lookup, type LookupPath, updateLookup } from "../api/adminApi";
import { ConfirmDeleteDialog, CrudFormDialog } from "./CrudDialogs";
import { useCrudList } from "./useCrudList";
import { CUSTOMER_CODE_MAX, LOOKUP_NAME_MAX, customerCodeError } from "./lookupValidation";

interface LookupCrudPageProps {
  path: LookupPath;
  addLabel: string;
  itemLabel: string;
  emptyLabel: string;
  nameHint: string;
  // Customers only: the code that goes into Managed Services risk codes.
  hasCode?: boolean;
}

// List + dialog CRUD for one register-template lookup (Platforms, Customers,
// Products, Deployment Types). Values are deactivated rather than deleted once
// a risk uses them: an inactive value drops out of pickers but still shows on
// the risks that already carry it. Delete is only offered for a value nothing
// has ever used, e.g. a typo caught straight away.
export default function LookupCrudPage({
  path,
  addLabel,
  itemLabel,
  emptyLabel,
  nameHint,
  hasCode = false,
}: LookupCrudPageProps): JSX.Element {
  const authFetch = useAuthApiClient();
  const { rows, loading, error, setError, reload } = useCrudList(() => fetchLookups(authFetch, path), [path]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Lookup | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lookup | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openAdd = () => {
    setEditing(null);
    setName("");
    setCode("");
    setStatus("ACTIVE");
    setDialogError(null);
    setDialogOpen(true);
  };

  const openEdit = (row: Lookup) => {
    setEditing(row);
    setName(row.name);
    setCode(row.code ?? "");
    setStatus(row.status);
    setDialogError(null);
    setDialogOpen(true);
  };

  // A customer's code is part of every risk code issued under it, so it is
  // frozen once the customer is in use (the backend refuses a change too).
  const codeLocked = hasCode && !!editing?.in_use;

  const handleSave = async () => {
    if (!name.trim()) {
      setDialogError("Name is required.");
      return;
    }
    if (hasCode && !codeLocked) {
      const problem = customerCodeError(code);
      if (problem) {
        setDialogError(problem);
        return;
      }
    }
    setSaving(true);
    setDialogError(null);
    try {
      if (editing) {
        // Only what changed: an omitted field is left alone server-side.
        await updateLookup(authFetch, path, editing.id, {
          name: name.trim(),
          status,
          ...(hasCode && !codeLocked && code !== editing.code ? { code } : {}),
        });
      } else {
        await createLookup(authFetch, path, { name: name.trim(), ...(hasCode ? { code } : {}) });
      }
      setDialogOpen(false);
      reload();
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteLookup(authFetch, path, deleteTarget.id);
      setDeleteTarget(null);
      reload();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const columnCount = hasCode ? 5 : 4;

  return (
    <Box>
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
        <Button variant="contained" startIcon={<Plus size={14} />} onClick={openAdd}>
          {addLabel}
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
              {hasCode && <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>}
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Used by risks</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={columnCount} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={22} />
                </TableCell>
              </TableRow>
            )}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columnCount} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    {emptyLabel}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              rows.map((row) => (
                <TableRow key={row.id} sx={row.status !== "ACTIVE" ? { opacity: 0.55 } : undefined}>
                  <TableCell sx={{ fontWeight: 600 }}>{row.name}</TableCell>
                  {hasCode && (
                    <TableCell>
                      <Chip size="small" label={row.code} variant="outlined" sx={{ fontFamily: "monospace" }} />
                    </TableCell>
                  )}
                  <TableCell>
                    <Chip
                      size="small"
                      label={row.status === "ACTIVE" ? "Active" : "Inactive"}
                      color={row.status === "ACTIVE" ? "success" : "default"}
                    />
                  </TableCell>
                  <TableCell>{row.in_use ? "Yes" : "No"}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEdit(row)} aria-label="Edit">
                      <Pencil size={15} />
                    </IconButton>
                    <Tooltip title={row.in_use ? "In use by risks — deactivate it instead" : "Delete"}>
                      {/* span: a disabled button doesn't fire the tooltip's hover events. */}
                      <span>
                        <IconButton
                          size="small"
                          disabled={row.in_use}
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(row);
                          }}
                          aria-label="Delete"
                        >
                          <Trash2 size={15} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>

      <CrudFormDialog
        open={dialogOpen}
        title={editing ? `Edit ${itemLabel}` : addLabel}
        error={dialogError}
        saving={saving}
        minHeight={hasCode ? 300 : 240}
        onClose={() => setDialogOpen(false)}
        onClearError={() => setDialogError(null)}
        onSave={handleSave}
      >
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            slotProps={{ htmlInput: { maxLength: LOOKUP_NAME_MAX } }}
            helperText={nameHint}
            sx={{ mb: 2.5 }}
          />
          {hasCode && (
            <TextField
              fullWidth
              size="small"
              label="Code *"
              value={code}
              disabled={codeLocked}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              slotProps={{ htmlInput: { maxLength: CUSTOMER_CODE_MAX, style: { textTransform: "uppercase" } } }}
              helperText={
                codeLocked
                  ? "Locked: this customer's code is already part of issued risk codes."
                  : "Goes into risk codes, e.g. 2026-MS-BANKONESUB-Q2-0001. Capital letters and digits only; it can't be changed once a risk uses it."
              }
              sx={{ mb: 2.5 }}
            />
          )}
          {editing && (
            <>
              <FormControl fullWidth size="small">
                <InputLabel id="lookup-status-label">Status</InputLabel>
                <Select
                  labelId="lookup-status-label"
                  label="Status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "ACTIVE" | "INACTIVE")}
                >
                  <MenuItem value="ACTIVE">Active</MenuItem>
                  <MenuItem value="INACTIVE">Inactive</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                An inactive {itemLabel} stops appearing in the risk form's picker, but risks that already carry it keep
                showing it.
              </Typography>
            </>
          )}
      </CrudFormDialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        itemLabel={itemLabel}
        error={deleteError}
        deleting={deleting}
        onClose={() => setDeleteTarget(null)}
        onClearError={() => setDeleteError(null)}
        onConfirm={handleDelete}
      >
        This permanently removes <b>{deleteTarget?.name}</b>. It can't be undone. Only a {itemLabel} that no risk has
        ever used can be deleted; otherwise deactivate it.
      </ConfirmDeleteDialog>
    </Box>
  );
}
