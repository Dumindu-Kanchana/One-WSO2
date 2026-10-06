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

import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@wso2/oxygen-ui";
import type { JSX, ReactNode } from "react";
import { dialogPaperSx } from "../cardStyles";

interface CrudFormDialogProps {
  open: boolean;
  title: string;
  error: string | null;
  saving: boolean;
  minHeight: number;
  onClose: () => void;
  onClearError: () => void;
  onSave: () => void;
  children: ReactNode;
}

// The Add/Edit dialog shell shared by the admin CRUD pages: title, error
// alert, Cancel/Save. The fields are the page's own.
export function CrudFormDialog({
  open,
  title,
  error,
  saving,
  minHeight,
  onClose,
  onClearError,
  onSave,
  children,
}: CrudFormDialogProps): JSX.Element {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: dialogPaperSx }}>
      <DialogTitle>{title}</DialogTitle>
      {/* pt needs !important: MUI zeroes the top padding of a DialogContent that
          directly follows the DialogTitle, and that rule outranks a plain pt, so
          the first field's floating label was cut off at the top edge. */}
      <DialogContent sx={{ minHeight, pt: "24px !important" }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={onClearError}>
            {error}
          </Alert>
        )}
        {children}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={saving} onClick={onSave}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface ConfirmDeleteDialogProps {
  open: boolean;
  itemLabel: string;
  error: string | null;
  deleting: boolean;
  onClose: () => void;
  onClearError: () => void;
  onConfirm: () => void;
  // The page's own explanation of what can be deleted.
  children: ReactNode;
}

export function ConfirmDeleteDialog({
  open,
  itemLabel,
  error,
  deleting,
  onClose,
  onClearError,
  onConfirm,
  children,
}: ConfirmDeleteDialogProps): JSX.Element {
  return (
    <Dialog
      open={open}
      onClose={() => (deleting ? undefined : onClose())}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: dialogPaperSx }}
    >
      <DialogTitle>Delete {itemLabel}?</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={onClearError}>
            {error}
          </Alert>
        )}
        <Typography variant="body2">{children}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={deleting}>
          Cancel
        </Button>
        <Button variant="contained" color="error" disabled={deleting} onClick={onConfirm}>
          {deleting ? "Deleting…" : "Delete"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
