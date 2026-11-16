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

import { Box, Button, Chip, Stack, Typography } from "@wso2/oxygen-ui";
import type { Okr, OkrKeyResult } from "../api/okrTypes";
import { formatShortDate } from "@features/par/util/parDate";
import {
  KEY_RESULT_STATUS_COLOR,
  KEY_RESULT_STATUS_LABEL,
  OKR_STATE_COLOR,
  OKR_STATE_LABEL,
  isKeyResultOverdue,
  okrState,
} from "../util/okr";

// A person's OKRs, compact and read-only: their own objectives with where each stands, and under
// any objective the key results that are theirs, with where each stands and when it's due. PAR's
// self-review side panel and the lead's evidence tab; the OKR pages show the full cards.
export default function OkrList({
  okrs,
  personEmail,
  onCite,
  citeLabel = "Add to Impact",
  emptyText = "No OKRs set.",
}: {
  /** Already narrowed to what's the person's (okrsForCycle). */
  okrs: Okr[];
  /** Whose they are: someone else's objective says so. */
  personEmail?: string;
  /** When set, the person's objectives and key results each get a button that cites it (the self-review). */
  onCite?: (okr: Okr, keyResult?: OkrKeyResult) => void;
  citeLabel?: string;
  emptyText?: string;
}) {
  if (okrs.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyText}
      </Typography>
    );
  }
  return (
    <Stack component="ul" spacing={1.75} sx={{ m: 0, p: 0, listStyle: "none" }}>
      {okrs.map((okr) => {
        const others = personEmail && okr.ownerEmail.toLowerCase() !== personEmail.toLowerCase();
        const state = okrState(okr);
        return (
          <Box component="li" key={okr.okrId}>
            <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
              {okr.objective}
            </Typography>
            {others ? (
              <Typography variant="caption" color="text.secondary" component="div">
                {okr.ownerName ?? okr.ownerEmail}&apos;s objective
              </Typography>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                <Chip
                  size="small"
                  variant="outlined"
                  color={OKR_STATE_COLOR[state]}
                  label={OKR_STATE_LABEL[state]}
                  sx={{ height: 18, fontSize: 10.5 }}
                />
                {onCite && (
                  <Button size="small" sx={{ ml: -0.5, py: 0 }} onClick={() => onCite(okr)}>
                    {citeLabel}
                  </Button>
                )}
              </Box>
            )}
            {okr.keyResults.length > 0 && (
              <Stack component="ul" spacing={0.75} sx={{ m: 0, mt: 0.75, pl: 1.5, listStyle: "none" }}>
                {okr.keyResults.map((kr) => (
                  <Box component="li" key={kr.keyResultId} sx={{ borderLeft: 2, borderColor: "divider", pl: 1 }}>
                    <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                      {kr.title}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={KEY_RESULT_STATUS_COLOR[kr.status]}
                        label={KEY_RESULT_STATUS_LABEL[kr.status]}
                        sx={{ height: 18, fontSize: 10.5 }}
                      />
                      <Typography
                        variant="caption"
                        color={isKeyResultOverdue(kr, okr) ? "error" : "text.secondary"}
                      >
                        {kr.baseline || kr.target ? `${kr.baseline ?? "?"} → ${kr.target ?? "?"} · ` : ""}
                        {isKeyResultOverdue(kr, okr) ? "Overdue, was due" : "Due"} {formatShortDate(kr.dueDate)}
                      </Typography>
                      {onCite && (
                        <Button size="small" sx={{ ml: -0.5, py: 0 }} onClick={() => onCite(okr, kr)}>
                          {citeLabel}
                        </Button>
                      )}
                    </Box>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        );
      })}
    </Stack>
  );
}
