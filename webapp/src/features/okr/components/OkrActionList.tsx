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
import { Box, Button, Checkbox, IconButton, Stack, TextField, Tooltip, Typography } from "@wso2/oxygen-ui";
import { MessageSquareIcon, Trash2Icon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { formatShortDate } from "@features/par/util/parDate";
import { OKR_ACTION_MAX_LENGTH, type OkrKeyResult } from "../api/okrTypes";
import { useAddOkrAction, useRemoveOkrAction, useUpdateOkrAction } from "../api/useOkrs";
import OkrComments from "./OkrComments";

// The initiatives and actions towards a key result. Its owner, and whoever
// manages the objective, add, tick off and remove them while the objective is
// open; anyone who can see it opens an action's comments and adds to them.
export default function OkrActionList({
  keyResult,
  open,
  nameOf,
}: {
  keyResult: OkrKeyResult;
  open: boolean;
  nameOf: (email: string) => string;
}) {
  const editable = keyResult.canUpdate && open;
  const add = useAddOkrAction();
  const update = useUpdateOkrAction();
  const remove = useRemoveOkrAction();
  const { showError } = useNotifications();
  const [title, setTitle] = useState("");
  const [commentsFor, setCommentsFor] = useState<number | null>(null);
  const onError = (err: Error) => showError(describeError(err));

  const submit = () => {
    if (!title.trim()) return;
    add.mutate({ keyResultId: keyResult.keyResultId, title: title.trim() }, { onSuccess: () => setTitle(""), onError });
  };

  return (
    <Box>
      <Typography variant="overline" color="error.main" component="div" sx={{ lineHeight: 1.5, mb: 0.5 }}>
        Initiatives / actions
      </Typography>
      {keyResult.actions.length === 0 && !editable && (
        <Typography variant="body2" color="text.secondary">
          None yet.
        </Typography>
      )}
      <Stack component="ul" spacing={0.25} sx={{ m: 0, p: 0, listStyle: "none" }}>
        {keyResult.actions.map((action) => (
          <Box component="li" key={action.actionId}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Checkbox
                size="small"
                checked={action.done}
                disabled={!editable || update.isPending}
                onChange={(e) => update.mutate({ actionId: action.actionId, done: e.target.checked }, { onError })}
                slotProps={{ input: { "aria-label": `${action.title}: ${action.done ? "done" : "not done"}` } }}
                sx={{ p: 0.5 }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body2"
                  sx={{
                    overflowWrap: "anywhere",
                    textDecoration: action.done ? "line-through" : undefined,
                    color: action.done ? "text.secondary" : undefined,
                  }}
                >
                  {action.title}
                </Typography>
                {action.done && action.doneOn && (
                  <Typography variant="caption" color="text.secondary" component="div">
                    Done{action.doneBy ? ` by ${nameOf(action.doneBy)}` : ""} · {formatShortDate(action.doneOn)}
                  </Typography>
                )}
              </Box>
              <Tooltip title={commentsFor === action.actionId ? "Hide comments" : "Comments"}>
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<MessageSquareIcon size={14} />}
                  onClick={() => setCommentsFor((id) => (id === action.actionId ? null : action.actionId))}
                  aria-label={`${action.commentCount} ${action.commentCount === 1 ? "comment" : "comments"} on ${action.title}`}
                  aria-expanded={commentsFor === action.actionId}
                  sx={{ minWidth: 0, color: "text.secondary", flexShrink: 0 }}
                >
                  {action.commentCount}
                </Button>
              </Tooltip>
              {editable && (
                <Tooltip title="Remove">
                  <IconButton
                    size="small"
                    aria-label={`Remove ${action.title}`}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(action.actionId, { onError })}
                  >
                    <Trash2Icon size={14} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
            {commentsFor === action.actionId && (
              <Box sx={{ ml: 4, mb: 1 }}>
                <OkrComments actionId={action.actionId} canComment={open} />
              </Box>
            )}
          </Box>
        ))}
      </Stack>
      {editable && (
        <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Add an action"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            slotProps={{ htmlInput: { maxLength: OKR_ACTION_MAX_LENGTH, "aria-label": "Add an action" } }}
          />
          <Button variant="outlined" onClick={submit} disabled={!title.trim() || add.isPending} sx={{ flexShrink: 0 }}>
            Add
          </Button>
        </Box>
      )}
    </Box>
  );
}
