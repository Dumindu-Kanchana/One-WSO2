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
import { Box, Button, Chip, IconButton, TextField, Tooltip, Typography, type Theme } from "@wso2/oxygen-ui";
import { ArrowRightIcon, MinusIcon, PencilIcon, PlusIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { formatShortDate } from "@features/par/util/parDate";
import { OKR_MEASURE_MAX_LENGTH, type Okr, type OkrKeyResult } from "../api/okrTypes";
import { useUpdateKeyResultMeasure } from "../api/useOkrs";
import { KEY_RESULT_STATUS_COLOR, isKeyResultOverdue } from "../util/okr";
import OkrActionList from "./OkrActionList";
import OkrKeyResultStatus from "./OkrKeyResultStatus";
import OkrStatusChart from "./OkrStatusChart";

// From theme.vars, which follows the light/dark switch (theme.palette is the light scheme only).
const statusBar = (theme: Theme, status: OkrKeyResult["status"]) => {
  const color = KEY_RESULT_STATUS_COLOR[status];
  const palette = (theme.vars ?? theme).palette;
  return color === "default" ? palette.divider : palette[color].main;
};

// One key result of an objective: what it is, whose it is, its measure and
// due date, and where it stands, with a bar in its status's colour. Opening it
// shows the measure and the actions towards it; Status over time adds the
// weekly chart.
export default function OkrKeyResultRow({
  okr,
  keyResult,
  nameOf,
}: {
  okr: Okr;
  keyResult: OkrKeyResult;
  nameOf: (email: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [chart, setChart] = useState(false);
  const open = okr.status === "OPEN";
  const overdue = isKeyResultOverdue(keyResult, okr);
  const measure =
    keyResult.baseline || keyResult.target ? `${keyResult.baseline ?? "?"} → ${keyResult.target ?? "?"}` : "";
  const doneActions = keyResult.actions.filter((a) => a.done).length;

  return (
    <Box
      component="li"
      sx={{
        borderLeft: 4,
        borderLeftColor: (t) => statusBar(t, keyResult.status),
        borderTop: 1,
        borderTopColor: "divider",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, px: 2, py: 1.5 }}>
        <IconButton
          size="small"
          onClick={() => setExpanded((v) => !v)}
          aria-label={`${expanded ? "Hide" : "Show"} the details of ${keyResult.title}`}
          aria-expanded={expanded}
          sx={{ border: 1, borderColor: "divider", borderRadius: 1, mt: 0.25 }}
        >
          {expanded ? <MinusIcon size={14} /> : <PlusIcon size={14} />}
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{keyResult.title}</Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            component="div"
            sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}
          >
            <span>{keyResult.ownerName ?? keyResult.ownerEmail}</span>
            {measure && <span>{measure}</span>}
            <span>{formatShortDate(keyResult.dueDate)}</span>
            {keyResult.actions.length > 0 && (
              <span>
                {doneActions} of {keyResult.actions.length} {keyResult.actions.length === 1 ? "action" : "actions"} done
              </span>
            )}
          </Typography>
        </Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            flexShrink: 0,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          {overdue && <Chip size="small" color="error" label="Overdue" sx={{ height: 20, fontSize: 11 }} />}
          <OkrKeyResultStatus keyResult={keyResult} editable={keyResult.canUpdate && open} />
          <Button
            size="small"
            variant={chart ? "contained" : "outlined"}
            onClick={() => setChart((v) => !v)}
            aria-expanded={chart}
          >
            {chart ? "Hide chart" : "Status over time"}
          </Button>
        </Box>
      </Box>
      {(chart || expanded) && (
        <Box sx={{ px: 2, pb: 2, pl: { xs: 2, sm: 7 }, display: "grid", gap: 2 }}>
          {chart && <OkrStatusChart history={keyResult.statusHistory} />}
          {expanded && (
            <Box
              sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 1.5,
                p: 2,
                display: "grid",
                gap: 3,
                gridTemplateColumns: { xs: "1fr", md: "minmax(260px, 1fr) 2fr" },
              }}
            >
              <OkrMeasure okr={okr} keyResult={keyResult} editable={keyResult.canUpdate && open} />
              <OkrActionList keyResult={keyResult} open={open} nameOf={nameOf} />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

// Baseline → target. The key result's owner, and whoever manages the
// objective, change it here; a change someone made to the objective meanwhile
// isn't overwritten.
function OkrMeasure({ okr, keyResult, editable }: { okr: Okr; keyResult: OkrKeyResult; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const [baseline, setBaseline] = useState("");
  const [target, setTarget] = useState("");
  const update = useUpdateKeyResultMeasure();
  const { showError } = useNotifications();

  const startEditing = () => {
    setBaseline(keyResult.baseline ?? "");
    setTarget(keyResult.target ?? "");
    setEditing(true);
  };
  const save = () =>
    update.mutate(
      { keyResultId: keyResult.keyResultId, version: okr.version, baseline: baseline.trim(), target: target.trim() },
      {
        onSuccess: () => setEditing(false),
        onError: (err) => {
          showError(describeError(err));
          setEditing(false);
        },
      },
    );
  const box = (label: string, value: string | undefined, highlight = false) => (
    <Box
      sx={{
        flex: 1,
        border: 1,
        borderColor: highlight ? "primary.light" : "divider",
        bgcolor: highlight ? "action.hover" : undefined,
        borderRadius: 1.5,
        px: 1.5,
        py: 1,
        minWidth: 0,
      }}
    >
      <Typography
        variant="overline"
        color={highlight ? "primary" : "text.secondary"}
        component="div"
        sx={{ lineHeight: 1.5 }}
      >
        {label}
      </Typography>
      <Typography sx={{ overflowWrap: "anywhere" }}>{value || "—"}</Typography>
    </Box>
  );

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
        <Typography variant="overline" color="primary" component="div" sx={{ lineHeight: 1.5 }}>
          Measure
        </Typography>
        {editable && !editing && (
          <Tooltip title="Change the baseline and target">
            <IconButton size="small" aria-label="Change the baseline and target" onClick={startEditing}>
              <PencilIcon size={14} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      {editing ? (
        <Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField
              size="small"
              label="Baseline"
              value={baseline}
              onChange={(e) => setBaseline(e.target.value)}
              slotProps={{ htmlInput: { maxLength: OKR_MEASURE_MAX_LENGTH } }}
            />
            <TextField
              size="small"
              label="Target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              slotProps={{ htmlInput: { maxLength: OKR_MEASURE_MAX_LENGTH } }}
            />
          </Box>
          <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", mt: 1 }}>
            <Button size="small" onClick={() => setEditing(false)} disabled={update.isPending}>
              Cancel
            </Button>
            <Button size="small" variant="contained" onClick={save} disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {box("Baseline", keyResult.baseline)}
          <Box sx={{ color: "error.main", display: "flex" }}>
            <ArrowRightIcon size={16} />
          </Box>
          {box("Target", keyResult.target, true)}
        </Box>
      )}
    </Box>
  );
}
