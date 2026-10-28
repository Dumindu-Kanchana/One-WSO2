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

import { useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { PlusIcon, Trash2Icon } from "@wso2/oxygen-ui-icons-react";
import VirtualizedListbox from "@components/virtualized-listbox/VirtualizedListbox";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { OKR_KEY_RESULT_MAX_LENGTH, OKR_MAX_KEY_RESULTS, OKR_OBJECTIVE_MAX_LENGTH, type Okr } from "../api/okrTypes";
import { useCreateOkr, useOkrEligibleOwners, useUpdateOkr } from "../api/useOkrs";
import ParDateField from "./ParDateField";

// Set an OKR for a member of the leadership team, or change one: the
// objective, up to five key results and a due date. The person can't be
// changed once it's set.
export default function ParOkrDialog({
  open,
  onClose,
  okr,
  ownerEmail: presetOwner,
}: {
  open: boolean;
  onClose: () => void;
  /** The OKR to change; leave out to set a new one. */
  okr?: Okr;
  /** Pre-picks the person for a new OKR. */
  ownerEmail?: string;
}) {
  const editing = Boolean(okr);
  const leaders = useOkrEligibleOwners(open && !editing);
  const create = useCreateOkr();
  const update = useUpdateOkr();
  const { showSuccess } = useNotifications();

  const [owner, setOwner] = useState(okr?.ownerEmail ?? presetOwner ?? "");
  const [objective, setObjective] = useState(okr?.objective ?? "");
  const [keyResults, setKeyResults] = useState<string[]>(okr?.keyResults.length ? okr.keyResults : [""]);
  const [dueDate, setDueDate] = useState(okr?.dueDate ?? "");
  const [tried, setTried] = useState(false);

  const byEmail = useMemo(() => new Map((leaders.data ?? []).map((l) => [l.workEmail, l])), [leaders.data]);
  const options = useMemo(() => (leaders.data ?? []).map((l) => l.workEmail), [leaders.data]);

  const ownerValid = byEmail.has(owner);
  const objectiveValid = objective.trim().length > 0;
  const dueValid = /^\d{4}-\d{2}-\d{2}$/.test(dueDate);
  const valid = ownerValid && objectiveValid && dueValid;
  const saving = create.isPending || update.isPending;
  const error = create.error ?? update.error;

  const setKeyResult = (i: number, value: string) =>
    setKeyResults((prev) => prev.map((kr, j) => (j === i ? value : kr)));

  const submit = async () => {
    setTried(true);
    if (!valid) return;
    const cleanKeyResults = keyResults.map((kr) => kr.trim()).filter(Boolean);
    try {
      if (okr) {
        await update.mutateAsync({
          okrId: okr.okrId,
          update: {
            objective: objective.trim(),
            keyResults: cleanKeyResults,
            dueDate,
          },
        });
        showSuccess("OKR updated.");
      } else {
        await create.mutateAsync({
          ownerEmail: owner.trim().toLowerCase(),
          objective: objective.trim(),
          keyResults: cleanKeyResults,
          dueDate,
        });
        showSuccess("OKR set.");
      }
      onClose();
    } catch {
      // Shown below from the mutation's error.
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editing ? "Edit OKR" : "Set an OKR"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.25} sx={{ pt: 1 }}>
          {editing ? (
            <Box>
              <Typography variant="caption" color="text.secondary">
                For
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {okr?.ownerName ?? okr?.ownerEmail}
              </Typography>
            </Box>
          ) : (
            <Autocomplete
              size="small"
              options={options}
              value={owner || null}
              onChange={(_e, v) => setOwner(v ?? "")}
              loading={leaders.isLoading}
              loadingText="Loading the leadership team…"
              noOptionsText={
                leaders.isError ? "Couldn't load the leadership team" : "No one in the leadership team matches"
              }
              disableListWrap
              ListboxComponent={VirtualizedListbox}
              getOptionLabel={(o) => byEmail.get(o)?.employeeName ?? o}
              filterOptions={(opts, { inputValue }) => {
                const q = inputValue.trim().toLowerCase();
                if (!q) return opts;
                return opts.filter(
                  (o) => o.toLowerCase().includes(q) || (byEmail.get(o)?.employeeName ?? "").toLowerCase().includes(q),
                );
              }}
              renderOption={(props, option) => {
                const l = byEmail.get(option);
                return (
                  <li {...props} key={option}>
                    <Box sx={{ display: "flex", alignItems: "center", height: 30, minWidth: 0 }}>
                      <Avatar
                        src={l?.employeeThumbnail || undefined}
                        slotProps={{ img: { referrerPolicy: "no-referrer" } }}
                        sx={{ width: 24, height: 24, mr: 1 }}
                      />
                      {l?.employeeName}
                      <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }} noWrap>
                        {l?.jobRole ? `${l.jobRole} · ` : ""}
                        {option}
                      </Typography>
                    </Box>
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="For"
                  placeholder="Search the leadership team"
                  error={tried && !ownerValid}
                  helperText={
                    tried && !ownerValid ? "Pick someone in the leadership team." : "OKRs are for the leadership team."
                  }
                />
              )}
            />
          )}

          <TextField
            label="Objective"
            placeholder="What should they achieve?"
            fullWidth
            multiline
            minRows={2}
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            error={tried && !objectiveValid}
            helperText={tried && !objectiveValid ? "Write the objective." : undefined}
            slotProps={{ htmlInput: { maxLength: OKR_OBJECTIVE_MAX_LENGTH } }}
          />

          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.25 }}>
              Key results (optional)
            </Typography>
            <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1 }}>
              How you'll know it's done. Up to {OKR_MAX_KEY_RESULTS}.
            </Typography>
            <Stack spacing={1}>
              {keyResults.map((kr, i) => (
                <Box key={i} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder={i === 0 ? "e.g. Gross retention for enterprise at 92%" : ""}
                    value={kr}
                    onChange={(e) => setKeyResult(i, e.target.value)}
                    slotProps={{
                      htmlInput: {
                        maxLength: OKR_KEY_RESULT_MAX_LENGTH,
                        "aria-label": `Key result ${i + 1}`,
                      },
                    }}
                  />
                  <IconButton
                    size="small"
                    aria-label={`Remove key result ${i + 1}`}
                    disabled={keyResults.length === 1 && !kr}
                    onClick={() => setKeyResults((prev) => (prev.length === 1 ? [""] : prev.filter((_, j) => j !== i)))}
                  >
                    <Trash2Icon size={16} />
                  </IconButton>
                </Box>
              ))}
            </Stack>
            {keyResults.length < OKR_MAX_KEY_RESULTS && (
              <Button
                size="small"
                startIcon={<PlusIcon size={16} />}
                sx={{ mt: 1 }}
                onClick={() => setKeyResults((prev) => [...prev, ""])}
              >
                Add a key result
              </Button>
            )}
          </Box>

          <ParDateField
            label="Due date"
            ariaLabel="Due date"
            value={dueDate}
            onChange={setDueDate}
            error={tried && !dueValid}
            helperText={tried && !dueValid ? "Pick a due date." : undefined}
            sx={{ maxWidth: 220 }}
          />

          {error && <Alert severity="error">{describeError(error)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void submit()} disabled={saving}>
          {saving ? "Saving…" : editing ? "Save" : "Set OKR"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
