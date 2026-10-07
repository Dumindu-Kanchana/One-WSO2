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

import { Box, Stack, Typography } from "@wso2/oxygen-ui";
import { formatOffset } from "../../api/salesTypes";
import { formatDateTime } from "../../util/salesTime";
import type { EvidenceQuote } from "../types";

/**
 * The quotes behind a Proposal, each with where it was said.
 *
 * Verbatim and attributed: the AM is being asked to put this in Salesforce
 * under their name, so what they check it against is what the customer said,
 * not a summary of it.
 */
export default function EvidenceList({ evidence }: { evidence: EvidenceQuote[] }) {
  if (evidence.length === 0) return null;
  return (
    <Stack component="ul" spacing={0.75} sx={{ listStyle: "none", p: 0, m: 0 }} aria-label="Evidence">
      {evidence.map((q, i) => (
        <Box
          component="li"
          key={`${q.meetingId}-${q.offsetSeconds}-${i}`}
          sx={{ borderLeft: 2, borderColor: "divider", pl: 1.25 }}
        >
          <Typography variant="body2" sx={{ fontStyle: "italic", overflowWrap: "anywhere" }}>
            “{q.quote}”
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {q.speaker} · {q.meetingTitle} · {formatDateTime(q.callStart)} · {formatOffset(q.offsetSeconds)}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}
