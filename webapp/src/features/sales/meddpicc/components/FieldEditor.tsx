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
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from "@wso2/oxygen-ui";
import type { DealField, FieldValue } from "../types";

const NONE = "__none__";

function asText(value: FieldValue): string {
  return typeof value === "string" ? value : "";
}

function asList(value: FieldValue): string[] {
  if (Array.isArray(value)) return value;
  return typeof value === "string" && value ? [value] : [];
}

/**
 * The inline editor for one non-role Gate field, by kind: a text area for
 * text, a text box for a URL, a single select for a picklist and a multi
 * select for a multi-select picklist.
 *
 * Saving an empty value, or pressing Clear, answers null: "clear this field",
 * which is how an AM says the call got it wrong and nothing should be there.
 */
export default function FieldEditor({
  field,
  initial,
  onSave,
  onCancel,
}: {
  field: DealField;
  initial: FieldValue;
  onSave: (value: FieldValue) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(asText(initial));
  const [list, setList] = useState<string[]>(asList(initial));
  const labelId = `meddpicc-edit-${field.key}`;

  // Options come from the backend (the live describe). A current value outside
  // them is kept selectable rather than silently dropped by the Select.
  const options = [...new Set([...field.options, ...list])];

  const save = () => {
    if (field.kind === "multiPicklist") onSave(list.length ? list : null);
    else {
      const trimmed = text.trim();
      onSave(trimmed ? trimmed : null);
    }
  };

  let control;
  if (field.kind === "multiPicklist") {
    control = (
      <FormControl size="small" fullWidth>
        <InputLabel id={labelId}>{field.label}</InputLabel>
        <Select
          labelId={labelId}
          label={field.label}
          multiple
          value={list}
          onChange={(event) => {
            const value = event.target.value;
            setList(typeof value === "string" ? value.split(",") : (value as string[]));
          }}
          renderValue={(selected) => (selected as string[]).join(", ")}
        >
          {options.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  } else if (field.kind === "picklist") {
    const pickOptions = [...new Set([...field.options, ...(text ? [text] : [])])];
    control = (
      <FormControl size="small" fullWidth>
        <InputLabel id={labelId}>{field.label}</InputLabel>
        <Select
          labelId={labelId}
          label={field.label}
          value={text || NONE}
          onChange={(event) => {
            const value = event.target.value as string;
            setText(value === NONE ? "" : value);
          }}
        >
          <MenuItem value={NONE}>
            <em>None</em>
          </MenuItem>
          {pickOptions.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  } else {
    control = (
      <TextField
        size="small"
        fullWidth
        label={field.label}
        value={text}
        onChange={(event) => setText(event.target.value)}
        multiline={field.kind === "text"}
        minRows={field.kind === "text" ? 3 : undefined}
        type={field.kind === "url" ? "url" : "text"}
      />
    );
  }

  return (
    <Stack spacing={1} sx={{ mt: 1 }}>
      {control}
      <Stack direction="row" spacing={1}>
        <Button size="small" variant="contained" onClick={save}>
          Use this value
        </Button>
        <Button size="small" color="error" onClick={() => onSave(null)}>
          Clear
        </Button>
        <Button size="small" onClick={onCancel}>
          Cancel
        </Button>
      </Stack>
    </Stack>
  );
}
