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
import { Box, Button, Skeleton, Stack, TextField, Typography } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { describeError } from "@api/errors";
import { formatShortDate } from "@features/par/util/parDate";
import { OKR_COMMENT_MAX_LENGTH } from "../api/okrTypes";
import { useAddOkrComment, useOkrComments } from "../api/useOkrs";

// The comments on an action, oldest first, and a box to add one. Anyone who
// can see the OKR can comment while it's open.
export default function OkrComments({ actionId, canComment }: { actionId: number; canComment: boolean }) {
  const comments = useOkrComments(actionId);
  const add = useAddOkrComment(actionId);
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim()) return;
    add.mutate(text.trim(), { onSuccess: () => setText("") });
  };

  return (
    <Box sx={{ pl: 1.5, borderLeft: 2, borderColor: "divider", my: 0.5 }}>
      {comments.isLoading ? (
        <Skeleton variant="text" width="60%" />
      ) : comments.isError ? (
        <ErrorNotice error={comments.error} onRetry={() => comments.refetch()} retrying={comments.isFetching}>
          Couldn&apos;t load the comments.
        </ErrorNotice>
      ) : (comments.data ?? []).length === 0 ? (
        <Typography variant="caption" color="text.secondary" component="div">
          No comments yet.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {(comments.data ?? []).map((c) => (
            <Box key={c.commentId}>
              <Typography variant="caption" color="text.secondary" component="div">
                <Box component="span" sx={{ fontWeight: 600, color: "text.primary" }}>
                  {c.authorName ?? c.createdBy}
                </Box>{" "}
                · {formatShortDate(c.createdOn)}
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {c.comment}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
      {canComment && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", mt: 1 }}>
          <TextField
            size="small"
            fullWidth
            multiline
            maxRows={6}
            placeholder="Add a comment"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            error={add.isError}
            helperText={add.isError ? describeError(add.error) : undefined}
            slotProps={{ htmlInput: { maxLength: OKR_COMMENT_MAX_LENGTH, "aria-label": "Add a comment" } }}
          />
          <Button variant="outlined" onClick={submit} disabled={!text.trim() || add.isPending} sx={{ flexShrink: 0 }}>
            {add.isPending ? "Posting…" : "Comment"}
          </Button>
        </Box>
      )}
    </Box>
  );
}
