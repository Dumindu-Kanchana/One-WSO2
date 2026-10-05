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

import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import type { JSX } from "react";
import { useAuthApiClient } from "@features/security/grc/shim/useAuthApiClient";
import { requestCustomer } from "../../api/riskApi";
import { dialogPaperSx } from "../cardStyles";

// Mirrors the backend's rule for a customer code, so a bad suggestion is caught
// here rather than by a 400.
const CODE_PATTERN = /^[A-Z0-9]{1,12}$/;

interface RequestCustomerDialogProps {
  open: boolean;
  onClose: () => void;
}

// Asks the platform admins to add a customer missing from the Customer Name
// list. It sends an email — nothing is stored — and the admin replies to it
// once the customer exists, so the dialog only has to say the request went out.
// The risk cannot be saved until the customer is added.
export default function RequestCustomerDialog({ open, onClose }: RequestCustomerDialogProps): JSX.Element {
  const authFetch = useAuthApiClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const close = () => {
    if (sending) return;
    setName("");
    setCode("");
    setNote("");
    setError(null);
    setSent(false);
    onClose();
  };

  const submit = async () => {
    if (!name.trim()) {
      setError("Customer name is required.");
      return;
    }
    if (code && !CODE_PATTERN.test(code)) {
      setError("A suggested code must be 1–12 capital letters or digits.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await requestCustomer(authFetch, {
        customer_name: name.trim(),
        suggested_code: code || undefined,
        note: note.trim() || undefined,
      });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send the request.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth PaperProps={{ sx: dialogPaperSx }}>
      <DialogTitle>Request a customer</DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        {sent ? (
          <Alert severity="success">
            Your request has been sent to the platform admins, and you are copied on the email. You can raise this risk
            once they have added the customer — they will reply to the email.
          </Alert>
        ) : (
          <Stack gap={2.5} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              If the customer you need isn't in the list, ask a platform admin to add it. A risk can't be saved against
              a customer that doesn't exist yet.
            </Typography>
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
            <TextField
              autoFocus
              required
              fullWidth
              size="small"
              label="Customer name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={sending}
            />
            <TextField
              fullWidth
              size="small"
              label="Suggested code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              slotProps={{ htmlInput: { maxLength: 12 } }}
              helperText="Optional. Goes into risk codes, e.g. BANKONESUB. The admin makes the final choice."
              disabled={sending}
            />
            <TextField
              fullWidth
              multiline
              minRows={2}
              size="small"
              label="Note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              helperText="Optional. Anything that helps the admin, e.g. which contract it is for."
              disabled={sending}
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={sending}>
          {sent ? "Close" : "Cancel"}
        </Button>
        {!sent && (
          <Button variant="contained" onClick={submit} disabled={sending}>
            {sending ? "Sending…" : "Send request"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
