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
import {
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import {
  ArchiveIcon,
  CircleCheckIcon,
  EllipsisIcon,
  PencilIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { formatShortDate } from "@features/par/util/parDate";
import { OKR_CLOSE_REASON_MAX_LENGTH, type Okr, type OkrStatus } from "../api/okrTypes";
import { useDeleteOkr, useSetOkrStatus } from "../api/useOkrs";
import { OKR_STATE_COLOR, OKR_STATE_LABEL, keyResultProgress, okrNameOf, okrState } from "../util/okr";
import OkrDialog from "./OkrDialog";
import OkrKeyResultRow from "./OkrKeyResultRow";

// One objective as the OKR pages show it: its number, the objective, where it
// stands and its key results, each of which opens to its measure, actions and
// status over time. Whoever manages it edits, completes, closes, reopens and
// (until someone has worked on it) deletes it from the menu, on its owner's
// page or board.
export default function OkrObjectiveCard({
  okr,
  index,
  othersObjective = false,
  nameOf,
}: {
  okr: Okr;
  /** Its place in the list, from 0, shown as 01, 02… */
  index: number;
  /** Someone else's objective, shown for the key results it holds for the
   * person the page or board is about: it says whose, and is managed from its
   * owner's page, not here. */
  othersObjective?: boolean;
  /** A person's name from their email, where the page knows it. */
  nameOf?: (email: string) => string;
}) {
  const state = okrState(okr);
  const manageable = okr.canManage && !othersObjective;
  const { completed, total } = keyResultProgress([{ ...okr, status: "OPEN" }]);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reason, setReason] = useState("");
  const setStatus = useSetOkrStatus();
  const remove = useDeleteOkr();
  const { showSuccess, showError } = useNotifications();
  const name = nameOf ?? okrNameOf(okr);

  const changeStatus = (status: OkrStatus, done: string, closeReason?: string) =>
    setStatus.mutate(
      { okrId: okr.okrId, status, reason: closeReason },
      {
        onSuccess: () => {
          showSuccess(done);
          setClosing(false);
        },
        onError: (err) => showError(describeError(err)),
      },
    );
  const confirmDelete = () =>
    remove.mutate(okr.okrId, {
      onSuccess: () => {
        showSuccess("OKR deleted.");
        setDeleting(false);
      },
      onError: (err) => {
        showError(describeError(err));
        setDeleting(false);
      },
    });
  const menuItem = (label: string, icon: ReactNode, onClick: () => void) => (
    <MenuItem
      onClick={() => {
        setMenu(null);
        onClick();
      }}
    >
      <ListItemIcon>{icon}</ListItemIcon>
      <ListItemText>{label}</ListItemText>
    </MenuItem>
  );

  return (
    <Card variant="outlined" sx={{ overflow: "hidden", opacity: state === "closed" ? 0.75 : 1 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, px: 2, py: 1.5, bgcolor: "action.hover" }}>
        <Box
          sx={{
            bgcolor: "primary.main",
            color: "primary.contrastText",
            borderRadius: 1,
            px: 1,
            py: 0.25,
            fontWeight: 700,
            fontSize: 13,
            mt: 0.25,
            flexShrink: 0,
          }}
          aria-hidden
        >
          {String(index + 1).padStart(2, "0")}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" component="h3" sx={{ fontWeight: 600, fontSize: 17, overflowWrap: "anywhere" }}>
            {okr.objective}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            component="div"
            sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}
          >
            {othersObjective && <span>{okr.ownerName ?? okr.ownerEmail}&apos;s objective</span>}
            {total > 0 && (
              <span>
                {completed} of {total} key {total === 1 ? "result" : "results"} completed
              </span>
            )}
            {okr.status !== "OPEN" && okr.statusChangedBy && (
              <span>
                {okr.status === "COMPLETED" ? "Completed" : "Closed"} by {name(okr.statusChangedBy)}
                {okr.statusChangedOn ? ` · ${formatShortDate(okr.statusChangedOn)}` : ""}
              </span>
            )}
          </Typography>
          {okr.status === "CLOSED" && okr.closeReason && (
            <Typography variant="body2" sx={{ mt: 0.5, fontStyle: "italic" }}>
              {okr.closeReason}
            </Typography>
          )}
        </Box>
        <Chip
          size="small"
          color={OKR_STATE_COLOR[state]}
          label={OKR_STATE_LABEL[state]}
          sx={{ mt: 0.25, flexShrink: 0 }}
        />
        {manageable && (
          <>
            <IconButton
              size="small"
              aria-label={`Change ${okr.objective}`}
              aria-haspopup="menu"
              onClick={(e) => setMenu(e.currentTarget)}
              disabled={setStatus.isPending || remove.isPending}
            >
              <EllipsisIcon size={18} />
            </IconButton>
            <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}>
              {okr.status === "OPEN" && menuItem("Edit", <PencilIcon size={16} />, () => setEditing(true))}
              {okr.status === "OPEN" &&
                menuItem("Mark completed", <CircleCheckIcon size={16} />, () =>
                  changeStatus("COMPLETED", "Marked completed."),
                )}
              {okr.status === "OPEN" &&
                menuItem("Close", <ArchiveIcon size={16} />, () => {
                  setReason("");
                  setClosing(true);
                })}
              {okr.status !== "OPEN" &&
                menuItem("Reopen", <RotateCcwIcon size={16} />, () => changeStatus("OPEN", "Reopened."))}
              {menuItem("Delete", <Trash2Icon size={16} />, () => setDeleting(true))}
            </Menu>
          </>
        )}
      </Box>

      {okr.keyResults.length === 0 ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ px: 2, py: 1.5, borderTop: 1, borderColor: "divider" }}
        >
          No key results yet.{manageable && okr.status === "OPEN" ? " Edit the objective to add them." : ""}
        </Typography>
      ) : (
        <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none" }}>
          {okr.keyResults.map((kr) => (
            <OkrKeyResultRow key={kr.keyResultId} okr={okr} keyResult={kr} nameOf={name} />
          ))}
        </Box>
      )}

      {editing && <OkrDialog open okr={okr} onClose={() => setEditing(false)} />}

      <Dialog open={closing} onClose={() => setClosing(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Close this OKR?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            &quot;{okr.objective}&quot; is no longer being pursued. It stays readable under Closed, and can be reopened.
          </Typography>
          <TextField
            label="Why (optional)"
            fullWidth
            multiline
            minRows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            slotProps={{ htmlInput: { maxLength: OKR_CLOSE_REASON_MAX_LENGTH } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setClosing(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => changeStatus("CLOSED", "OKR closed.", reason.trim() || undefined)}
            disabled={setStatus.isPending}
          >
            {setStatus.isPending ? "Closing…" : "Close OKR"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleting} onClose={() => setDeleting(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete this OKR?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            &quot;{okr.objective}&quot; will be gone for everyone. Only an OKR nobody has worked on can be deleted; once
            someone has, close it instead.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleting(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmDelete} disabled={remove.isPending}>
            {remove.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
