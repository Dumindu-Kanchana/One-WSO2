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

import { useState, type HTMLAttributes, type Key } from "react";
import {
  Autocomplete,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useLeaveEmployees } from "@features/leave/api/useLeaveData";
import { useSyncEmployee } from "../api/useParMutations";
import { useParLeadEmployees } from "../api/useLeadHistory";
import type { ParCycle } from "../api/types";

type SyncOption = { name: string; workEmail: string; thumbnail?: string };

// This app has no org-wide employee directory of its own, so the admin
// picker reuses Leave's employee list — the same deviation other PAR views
// make. With `leadEmail` set (EmployeeSyncModal's `leadonly`), it lists only
// that lead's own reports instead.
export default function ParSyncEmployeeDialog({
  open,
  onClose,
  cycle,
  leadEmail,
}: {
  open: boolean;
  onClose: () => void;
  cycle: ParCycle;
  leadEmail?: string;
}) {
  const allEmployees = useLeaveEmployees(open && !leadEmail);
  const leadEmployees = useParLeadEmployees(open ? leadEmail : undefined);
  const syncEmployee = useSyncEmployee(cycle.parCycleId);
  const { showSuccess, showError } = useNotifications();

  const options: SyncOption[] = leadEmail
    ? (leadEmployees.data ?? [])
        .filter((e) => e.workEmail !== leadEmail)
        .map((e) => ({ name: e.employeeName, workEmail: e.workEmail, thumbnail: e.employeeThumbnail }))
    : (allEmployees.data ?? []).map((e) => ({
        name: `${e.firstName} ${e.lastName}`,
        workEmail: e.workEmail,
        thumbnail: e.employeeThumbnail,
      }));
  const optionsLoading = leadEmail ? leadEmployees.isLoading : allEmployees.isLoading;

  const [selected, setSelected] = useState<SyncOption | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleClose = () => {
    setSelected(null);
    setConfirmOpen(false);
    onClose();
  };

  const handleSync = () => {
    if (!selected) return;
    syncEmployee.mutate(selected.workEmail, {
      onSuccess: () => {
        showSuccess("Employee information synced");
        handleClose();
      },
      onError: (err) => {
        showError(describeError(err));
        setConfirmOpen(false);
      },
    });
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 2 }}>Sync an Employee</DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3 }}>
          <Autocomplete
            options={options}
            loading={optionsLoading}
            getOptionLabel={(option) => `${option.name} (${option.workEmail})`}
            value={selected}
            onChange={(_e, value) => {
              if (value) setConfirmOpen(true);
              setSelected(value);
            }}
            isOptionEqualToValue={(option, value) => option.workEmail === value.workEmail}
            renderInput={(params) => (
              <TextField {...params} label="Search by name or email" placeholder="Search by name or email" fullWidth />
            )}
            renderOption={(props, option) => {
              // `props` already carries its own `key` — pull it out before
              // spreading, or React won't get a real key prop here.
              const { key, ...rest } = props as HTMLAttributes<HTMLLIElement> & { key?: Key };
              return (
                <Box component="li" key={key} {...rest} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Avatar src={option.thumbnail} sx={{ height: "2.2rem", width: "2.2rem" }} />
                  <Box>
                    <Typography variant="body2">{option.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.workEmail}
                    </Typography>
                  </Box>
                </Box>
              );
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Synchronize Employee Information</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {selected && `Are you sure you want to sync the details of ${selected.workEmail}? This action cannot be undone.`}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" color="warning" disabled={syncEmployee.isPending} onClick={handleSync}>
            {syncEmployee.isPending ? "Syncing…" : "Yes"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
