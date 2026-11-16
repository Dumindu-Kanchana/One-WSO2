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

import type { SxProps, Theme } from "@wso2/oxygen-ui";
import { Box, Typography } from "@wso2/oxygen-ui";
import { decodeParComment, isEmptyHtml, sanitizeParHtml } from "../util/parComment";

// The two places par-app's rich-text HTML gets rendered read-only: a
// submitted comment (par-app's CommentPaper.tsx) and the admin-configured
// question text (employeeParQuestion, threeSixtyReviewQuestion — real HTML
// too, not plain strings).

/** The lead's 360° summary (a rating's base64 parLead360Summary), read-only
 * under their comment; nothing when there is none. */
export function ParLead360SummaryView({ summary }: { summary: string | undefined }) {
  const html = decodeParComment(summary);
  if (isEmptyHtml(html)) return null;
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        360° summary
      </Typography>
      <ParCommentView html={html} />
    </Box>
  );
}

/** A submitted comment, read-only — body-text weight. List/indent styling
 * mirrors Quill's own so a bulleted or indented answer looks the same read
 * back as it did while being written. */
export function ParCommentView({ html }: { html: string }) {
  if (!html) {
    return <Typography sx={{ fontSize: 14, color: "text.disabled" }}>No comment was recorded.</Typography>;
  }
  return (
    <Box
      sx={{
        fontSize: 14,
        lineHeight: 1.5,
        overflowWrap: "break-word",
        "& p": { margin: 0 },
        "& ul, & ol": { paddingLeft: "1.5em", marginTop: "0.5em", marginBottom: "0.5em" },
        "& li": { display: "list-item", padding: "0.2em 0" },
      }}
      dangerouslySetInnerHTML={{ __html: sanitizeParHtml(html) }}
    />
  );
}

/** A cycle's configured question, read-only — heading weight. */
export function ParQuestionText({
  html,
  fallback,
  sx,
}: {
  html: string | undefined;
  fallback: string;
  sx?: SxProps<Theme>;
}) {
  if (!html) {
    return <Typography sx={{ fontWeight: 600, ...sx }}>{fallback}</Typography>;
  }
  return (
    <Typography
      component="div"
      sx={{ fontWeight: 600, "& p": { margin: 0 }, ...sx }}
      dangerouslySetInnerHTML={{ __html: sanitizeParHtml(html) }}
    />
  );
}
