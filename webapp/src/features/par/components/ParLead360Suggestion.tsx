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

import type { ReactNode } from "react";
import { Box, Skeleton, Typography } from "@wso2/oxygen-ui";
import { SparklesIcon } from "@wso2/oxygen-ui-icons-react";
import type { Lead360SummarySuggestion } from "../api/useLead360Summary";

// The suggested 360° summary, in grey: an AI summary of the submitted
// responses, not part of the lead's summary until they insert it. Lines of
// placeholder while it's being written.
export default function ParLead360Suggestion({
  suggestion,
  actions,
  onInsert,
}: {
  /** Absent while it's being written. */
  suggestion?: Lead360SummarySuggestion;
  /** Shown under it once it's there (Dismiss, Replace). */
  actions?: ReactNode;
  /** Clicking the text inserts it, as in Gmail. */
  onInsert?: () => void;
}) {
  return (
    <Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}
      >
        <SparklesIcon size={14} />
        {suggestion
          ? `Suggested from ${suggestion.responseCount} 360° responses`
          : "Writing a suggestion from the 360° feedback…"}
      </Typography>
      {suggestion ? (
        // The field's own font, line height and placeholder grey, so it reads
        // as text not yet typed.
        <Box
          onClick={onInsert}
          sx={{
            color: "text.primary",
            opacity: 0.6,
            lineHeight: 1.42,
            ...(onInsert && { cursor: "pointer", "&:hover": { opacity: 0.8 } }),
          }}
        >
          {suggestion.summary
            .split("\n")
            .filter((line) => line.trim())
            .map((line, i) => (
              <Box component="p" key={i} sx={{ m: 0 }}>
                {line}
              </Box>
            ))}
        </Box>
      ) : (
        <Box aria-hidden>
          <Skeleton variant="text" width="96%" />
          <Skeleton variant="text" width="90%" />
          <Skeleton variant="text" width="60%" />
        </Box>
      )}
      {suggestion && actions && (
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 1 }}>{actions}</Box>
      )}
    </Box>
  );
}
