/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useEffect, useState } from "react";
import { AdapterDateFns, Box, DatePickers, Typography } from "@wso2/oxygen-ui";
import { dialogPaperSx } from "@components/confirmation-dialog/dialogPaperSx";
import { localIsoDate } from "@utils/localDate";

const { DatePicker, LocalizationProvider } = DatePickers;

/** `YYYY-MM-DD` to a local Date, or null for empty, malformed or impossible input. */
function fromIso(iso: string | undefined): Date | null {
  if (!iso) return null;
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  // Reject dates that roll over, e.g. 2025-02-31 → 2025-03-03.
  return localIsoDate(date) === day ? date : null;
}

/** A local Date to `YYYY-MM-DD`, or "" when there is no complete date. */
function toIso(d: Date | null): string {
  return d && !Number.isNaN(d.getTime()) ? localIsoDate(d) : "";
}

// One date input, shared by every leave form and report.
//
// MUI X's DatePicker rather than a native `type="date"`: the browser's own
// popup lists years outside `min`/`max` and only greys them out, and a typed
// date goes straight past both bounds. Here the year list stops at the bounds,
// and a typed date outside them is reported as "" — no date — so the caller
// never holds one the picker would have refused.
//
// Values stay `YYYY-MM-DD` strings in and out, so callers are unchanged.
//
// Also PAR's date field (ParDateField), which keeps its forms' look: the label
// inside the field's border like their other fields, or no visible label at
// all, and a message saying why a typed date was refused.
export default function LeaveDateField({
  label,
  ariaLabel = label,
  floatingLabel = false,
  explainRange = false,
  value,
  min,
  max,
  disabled = false,
  error = false,
  helperText,
  onChange,
}: {
  /** Shown above the field, or inside its border with `floatingLabel`; leave
   * it out for a field labelled by what's around it. */
  label?: string;
  /** The field's accessible name, when it isn't `label`. */
  ariaLabel?: string;
  floatingLabel?: boolean;
  /** Says under the field why a typed date outside min/max was refused. */
  explainRange?: boolean;
  value: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  onChange?: (v: string) => void;
}) {
  // A complete date outside min/max is reported to the caller as "" (no date),
  // but the field keeps showing it — in its error state — while the caller
  // still holds that "". Handing MUI back an empty value instead would wipe
  // what the user typed and drop the error, leaving no hint why it vanished.
  const [outOfRange, setOutOfRange] = useState<Date | null>(null);
  // Once the caller holds a date again, the remembered one is spent.
  if (outOfRange && value !== "") setOutOfRange(null);
  const shown = value === "" && outOfRange ? outOfRange : fromIso(value);
  const outOfRangeIso = value === "" && outOfRange ? toIso(outOfRange) : "";
  const rangeMessage = !explainRange || !outOfRangeIso
    ? undefined
    : min && outOfRangeIso < min
      ? `Must be on or after ${min}`
      : `Must be on or before ${max}`;

  // The bounds can move without this field changing — a To whose min follows
  // From. Once the date on screen is allowed again, hand it to the caller, or
  // the field shows a valid date while the form still holds none.
  useEffect(() => {
    if (!outOfRange || value !== "") return;
    const lo = fromIso(min);
    const hi = fromIso(max);
    if ((lo && outOfRange < lo) || (hi && outOfRange > hi)) return;
    onChange?.(toIso(outOfRange));
  }, [min, max, outOfRange, value, onChange]);

  return (
    <Box>
      {label && !floatingLabel && (
        <Typography sx={{ fontSize: 11, color: "text.secondary", mb: 0.375 }}>{label}</Typography>
      )}
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <DatePicker
          label={floatingLabel ? label : undefined}
          value={shown}
          minDate={fromIso(min) ?? undefined}
          maxDate={fromIso(max) ?? undefined}
          disabled={disabled}
          readOnly={!onChange}
          format="yyyy-MM-dd"
          onChange={(
            d: Date | null,
            context: DatePickers.PickerChangeHandlerContext<DatePickers.DateValidationError>,
          ) => {
            const complete = d !== null && !Number.isNaN(d.getTime());
            setOutOfRange(context.validationError && complete ? d : null);
            onChange?.(context.validationError ? "" : toIso(d));
          }}
          slotProps={{
            textField: {
              size: "small",
              fullWidth: true,
              // undefined, not false: false would switch off the picker's own
              // min/max error state.
              error: error || undefined,
              helperText: rangeMessage ?? helperText,
              // The visible text above is a plain Typography, so the field
              // carries its accessible name itself.
              inputProps: { "aria-label": ariaLabel },
            },
            // The theme's Paper is translucent, which lets the form show through
            // the calendar. Give the popup (and its small-screen dialog) the
            // same opaque surface as the app's other floating dialogs.
            desktopPaper: { sx: dialogPaperSx },
            mobilePaper: { sx: dialogPaperSx },
            // The popup is a dialog with no visible title, so name it after its
            // field; several date fields sit side by side.
            popper: { "aria-label": `${ariaLabel} calendar` },
            dialog: { "aria-label": `${ariaLabel} calendar` },
          }}
        />
      </LocalizationProvider>
    </Box>
  );
}
