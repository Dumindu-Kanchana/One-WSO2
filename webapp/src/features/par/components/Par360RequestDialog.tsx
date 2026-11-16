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
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@wso2/oxygen-ui";
import { PlusIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import VirtualizedListbox from "@components/virtualized-listbox/VirtualizedListbox";
import { employeeDisplayName } from "@features/leave/util/employeeName";
import { useLeaveEmployees } from "@features/leave/api/useLeaveData";
import { useParticipants } from "../api/usePar360";
import { useReviewerSuggestions } from "../api/useReviewerSuggestions";
import { REVIEW_360_RELATIONSHIPS } from "../api/review360Types";
import { PICKED_FILLED_SX } from "../util/toggleSx";
import { describeError } from "@api/errors";

// Picks colleagues to add as 360° reviewers — par-app's ReviewRequestModal,
// with the picker itself reused from Leave's "Notify people" field rather
// than rebuilt (same shape: search-and-multi-select over the org).
//
// Split into a bare picker (no Dialog chrome, for inline use — the
// Employee Portal's Request 360° Feedback tab) and a thin Dialog wrapper
// around it (kept for ParLead360ReviewsTab.tsx, which still opens this from
// a Fab).
//
// In a PAR 2.0 cycle (`parCycleId`) the people come from the cycle itself,
// the same list Give feedback offers, rather than the whole org directory.
// With `askRelationship` (PAR 2.0, not for a member of the leadership team)
// the people picked are listed below the field instead of as chips, each with
// Peer or Cross-team to pick: the reviewer's form doesn't ask it again. A PAR
// 2.0 cycle also suggests people from the employee's calendar, above the field,
// 8 at a time with Suggest more for the rest; adding one adds them like any
// other pick, with Peer or Cross-team still to choose. Without `onCancel` it has
// no Cancel and doesn't take focus: the 360° tab shows it all the time.

/** Calendar suggestions shown at first, and added by each Suggest more. */
const SUGGESTIONS_PER_ROUND = 8;

/** Someone who can be asked, from either source. */
interface Colleague {
  workEmail: string;
  name: string;
  thumbnail?: string | null;
}

export function Par360RequestPicker({
  open,
  selfEmail,
  leadEmail,
  existingEmails,
  onSubmit,
  onCancel,
  isSubmitting,
  error,
  parCycleId,
  askRelationship = false,
  subjectName,
}: {
  /** Gates `useLeaveEmployees` the same way the Dialog's own `open` did. */
  open: boolean;
  /** The caller's own address — excluded, matching EmailAutocomplete.tsx's
   * `ownEmail` exclusion (this screen only ever requests for yourself). */
  selfEmail: string | undefined;
  /** Your own lead — ReviewRequestModal.tsx excludes this specifically
   * (rather than the employee being reviewed, which is the same person
   * here) when requesting for yourself: `emailsToSkip: [userInfo.leadEmail]`. */
  leadEmail: string | undefined;
  /** Already a reviewer — excluded from the options so it can't be re-added. */
  existingEmails: string[];
  /** `relationships` (by email) only with `askRelationship`. */
  onSubmit: (reviewerEmails: string[], relationships?: Record<string, string>) => void;
  /** Absent when the picker is always shown. */
  onCancel?: () => void;
  isSubmitting: boolean;
  error: unknown;
  /** A PAR 2.0 cycle: pick from its participants. */
  parCycleId?: number;
  /** Ask how each person works with the employee: Peer or Cross-team. */
  askRelationship?: boolean;
  /** The employee the feedback is about, when it isn't the caller. */
  subjectName?: string;
}) {
  const directory = useLeaveEmployees(open && parCycleId === undefined);
  const participants = useParticipants(parCycleId, open && parCycleId !== undefined);
  const employees = parCycleId === undefined ? directory : participants;
  const [selected, setSelected] = useState<string[]>([]);
  const [relationships, setRelationships] = useState<Record<string, string>>({});
  const [inputValue, setInputValue] = useState("");
  const [suggestionsShown, setSuggestionsShown] = useState(SUGGESTIONS_PER_ROUND);

  const people: Colleague[] = useMemo(
    () =>
      parCycleId === undefined
        ? (directory.data ?? [])
            .filter((e) => e.employeeStatus !== "Left" && e.workEmail)
            .map((e) => ({ workEmail: e.workEmail, name: employeeDisplayName(e), thumbnail: e.employeeThumbnail }))
        : (participants.data ?? []).map((p) => ({ workEmail: p.workEmail, name: p.employeeName })),
    [parCycleId, directory.data, participants.data],
  );
  const offerable = useMemo(
    () =>
      people.filter(
        (e) => e.workEmail !== selfEmail && e.workEmail !== leadEmail && !existingEmails.includes(e.workEmail),
      ),
    [people, selfEmail, leadEmail, existingEmails],
  );
  const options = useMemo(() => offerable.map((e) => e.workEmail), [offerable]);
  const suggestions = useReviewerSuggestions(parCycleId, selfEmail, open && parCycleId !== undefined);
  // A pick leaves the row without the next one sliding in; Suggest more adds the next round.
  const offered = (suggestions.data?.suggestions ?? []).filter((s) => options.includes(s.workEmail));
  const suggested = offered.slice(0, suggestionsShown).filter((s) => !selected.includes(s.workEmail));
  const moreSuggested = offered.slice(suggestionsShown).some((s) => !selected.includes(s.workEmail));
  const byEmail = useMemo(() => new Map(offerable.map((e) => [e.workEmail, e])), [offerable]);

  const handleCancel = () => {
    setSelected([]);
    setRelationships({});
    setInputValue("");
    setSuggestionsShown(SUGGESTIONS_PER_ROUND);
    onCancel?.();
  };
  const unpicked = askRelationship && selected.some((email) => !relationships[email]);
  const handleSubmit = () =>
    askRelationship
      ? onSubmit(selected, Object.fromEntries(selected.map((email) => [email, relationships[email]])))
      : onSubmit(selected);

  // EmailAutocomplete.tsx's own handlePaste: a comma/semicolon/newline
  // separated paste is split and matched against the available options,
  // rather than left for the field to reject wholesale.
  const handlePaste = (event: React.ClipboardEvent) => {
    const pastedText = event.clipboardData.getData("text");
    if (!/[,;\n]/.test(pastedText)) return;
    event.preventDefault();
    const pasted = pastedText
      .split(/[,;\n\s]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0 && options.includes(e));
    setSelected((prev) => Array.from(new Set([...prev, ...pasted])));
    setInputValue("");
  };

  // EmailAutocomplete.tsx's own handleKeyDown: typing a comma or semicolon
  // after a valid address adds it, the same as picking it from the list.
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      return;
    }
    if ((event.key === "," || event.key === ";") && inputValue.trim()) {
      const email = inputValue.trim().replace(/[,;]$/, "");
      if (options.includes(email) && !selected.includes(email)) {
        event.preventDefault();
        setSelected((prev) => [...prev, email]);
        setInputValue("");
      }
    }
  };

  return (
    <>
      {(suggested.length > 0 || moreSuggested) && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {/* A lead's view passes "them" when the name isn't known. */}
            Suggested from {subjectName === undefined ? "your" : subjectName === "them" ? "their" : `${subjectName}'s`}{" "}
            calendar:
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {suggested.map((s) => (
              <Chip
                key={s.workEmail}
                variant="outlined"
                icon={<PlusIcon size={14} />}
                label={s.employeeName}
                aria-label={`Add ${s.employeeName}`}
                onClick={() => setSelected((prev) => [...prev, s.workEmail])}
              />
            ))}
            {moreSuggested && (
              <Button size="small" onClick={() => setSuggestionsShown((n) => n + SUGGESTIONS_PER_ROUND)}>
                Suggest more
              </Button>
            )}
          </Box>
        </Box>
      )}
      <Typography sx={{ pb: 2 }}>From:</Typography>
      <Autocomplete
          multiple
          size="small"
          options={options}
          value={selected}
          onChange={(_e, v) => setSelected(v as string[])}
          inputValue={inputValue}
          onInputChange={(_e, v) => setInputValue(v)}
          loading={employees.isLoading}
          loadingText="Loading colleagues…"
          noOptionsText={employees.isError ? "Couldn't load colleagues" : "No colleagues found"}
          disableListWrap
          ListboxComponent={VirtualizedListbox}
          // Row is one line (~30px) inside VirtualizedListbox's fixed 52px
          // slot (sized for Leave's two-line rows) — the gap under each row
          // is that mismatch, not a bug here.
          // EmailAutocomplete.tsx's own row: a plain Avatar (no fallback
          // text, so a missing photo shows MUI's generic person icon, never
          // an initial letter) beside the name, then the raw address in grey.
          renderOption={(props, option) => {
            const employee = byEmail.get(option);
            return (
              <li {...props} key={option}>
                <Box sx={{ display: "flex", alignItems: "center", height: 30 }}>
                  <Avatar
                    src={employee?.thumbnail || undefined}
                    slotProps={{ img: { referrerPolicy: "no-referrer" } }}
                    sx={{ width: 24, height: 24, marginRight: "8px" }}
                  />
                  {employee?.name}
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                    {option}
                  </Typography>
                </Box>
              </li>
            );
          }}
          // EmailAutocomplete.tsx's own tag: the same plain avatar (shown
          // only when there's a thumbnail, per source) beside the raw
          // address — not the display name. Asking the relationship, the
          // people picked are listed below instead.
          renderTags={(value, getTagProps) =>
            askRelationship ? null : value.map((option, index) => {
              const employee = byEmail.get(option);
              const { key, ...tagProps } = getTagProps({ index });
              return (
                <Chip
                  key={key}
                  variant="outlined"
                  label={
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      {employee?.thumbnail && (
                        <Avatar
                          src={employee.thumbnail}
                          slotProps={{ img: { referrerPolicy: "no-referrer" } }}
                          sx={{ width: 24, height: 24, marginRight: "8px", marginLeft: "-8px" }}
                        />
                      )}
                      {option}
                    </Box>
                  }
                  {...tagProps}
                />
              );
            })
          }
          filterOptions={(opts, { inputValue }) => {
            const q = inputValue.trim().toLowerCase();
            if (!q) return opts;
            return opts.filter((o) => {
              const e = byEmail.get(o);
              return o.toLowerCase().includes(q) || (e ? e.name.toLowerCase().includes(q) : false);
            });
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search by email or paste comma-separated emails"
              autoFocus={onCancel !== undefined}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
            />
          )}
      />
      {askRelationship && selected.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            How does each person work with {subjectName ?? "you"}?
          </Typography>
          <Stack divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />}>
            {selected.map((email) => {
              const name = byEmail.get(email)?.name ?? email;
              return (
                <Box key={email} sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap>
                      {name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap component="div">
                      {email}
                    </Typography>
                  </Box>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={relationships[email] ?? null}
                    onChange={(_e, v: string | null) => {
                      if (v) setRelationships((prev) => ({ ...prev, [email]: v }));
                    }}
                    aria-label={`How ${name} works with ${subjectName ?? "you"}`}
                    sx={{ flexShrink: 0, ...PICKED_FILLED_SX }}
                  >
                    {REVIEW_360_RELATIONSHIPS.map((r) => (
                      <ToggleButton key={r.value} value={r.value} sx={{ textTransform: "none", px: 1.5, py: 0.5 }}>
                        {r.label}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                  <IconButton
                    size="small"
                    aria-label={`Remove ${name}`}
                    onClick={() => setSelected((prev) => prev.filter((e) => e !== email))}
                  >
                    <XIcon size={16} />
                  </IconButton>
                </Box>
              );
            })}
          </Stack>
        </Box>
      )}
      {error !== undefined && <Alert severity="error" sx={{ mt: 2 }}>{describeError(error)}</Alert>}
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, mt: 2 }}>
        {onCancel && <Button onClick={handleCancel}>Cancel</Button>}
        <Button
          variant="contained"
          disabled={selected.length === 0 || unpicked || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? "Requesting…" : "Request"}
        </Button>
      </Box>
    </>
  );
}

// Dialog wrapper around the bare picker above — still used by
// ParLead360ReviewsTab.tsx, whose own Fab isn't part of this change.
export default function Par360RequestDialog({
  open,
  onClose,
  selfEmail,
  leadEmail,
  existingEmails,
  onSubmit,
  isSubmitting,
  error,
  parCycleId,
  askRelationship = false,
  subjectName,
}: {
  open: boolean;
  onClose: () => void;
  selfEmail: string | undefined;
  leadEmail: string | undefined;
  existingEmails: string[];
  onSubmit: (reviewerEmails: string[], relationships?: Record<string, string>) => void;
  isSubmitting: boolean;
  error: unknown;
  /** A PAR 2.0 cycle: pick from its participants. */
  parCycleId?: number;
  /** Ask how each person works with the employee: Peer or Cross-team. */
  askRelationship?: boolean;
  /** The employee the feedback is about. */
  subjectName?: string;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth={askRelationship ? "sm" : "xs"} fullWidth>
      {/* ReviewRequestModal.tsx: title, a divider under it, then "From:"
          labelling the picker — not just the field on its own. */}
      <DialogTitle sx={{ pb: 2 }}>Request 360° Feedback</DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        <Par360RequestPicker
          open={open}
          selfEmail={selfEmail}
          leadEmail={leadEmail}
          existingEmails={existingEmails}
          onSubmit={onSubmit}
          onCancel={onClose}
          isSubmitting={isSubmitting}
          error={error}
          parCycleId={parCycleId}
          askRelationship={askRelationship}
          subjectName={subjectName}
        />
      </DialogContent>
    </Dialog>
  );
}
