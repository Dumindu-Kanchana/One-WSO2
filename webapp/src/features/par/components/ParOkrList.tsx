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
import { Box, Button, Chip, Stack, Typography } from "@wso2/oxygen-ui";
import type { Okr } from "../api/okrTypes";
import { formatShortDate } from "../util/parDate";
import { OKR_STATE_COLOR, OKR_STATE_LABEL, okrState } from "../util/okr";

// A person's OKRs: objective, key results, due date and where each stands.
// Shared by Home, the self-review, the lead's review and the OKR managers' page.
export default function ParOkrList({
  okrs,
  showKeyResults = true,
  onCite,
  citeLabel = "Add to Impact",
  actions,
  emptyText = "No OKRs set.",
}: {
  okrs: Okr[];
  showKeyResults?: boolean;
  /** When set, each OKR gets a button that cites it (the self-review). */
  onCite?: (okr: Okr) => void;
  citeLabel?: string;
  /** Extra controls per OKR (the OKR managers' page). */
  actions?: (okr: Okr) => ReactNode;
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
    <Stack component="ul" spacing={1.5} sx={{ m: 0, p: 0, listStyle: "none" }}>
      {okrs.map((okr) => {
        const state = okrState(okr);
        return (
          <Box component="li" key={okr.okrId} sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 1,
                  justifyContent: "space-between",
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                  {okr.objective}
                </Typography>
                <Chip
                  size="small"
                  color={OKR_STATE_COLOR[state]}
                  variant={state === "open" ? "outlined" : "filled"}
                  label={OKR_STATE_LABEL[state]}
                  sx={{ height: 20, fontSize: 11, flexShrink: 0 }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary" component="div">
                Due {formatShortDate(okr.dueDate)}
                {okr.status === "COMPLETED" && okr.completedOn
                  ? ` · completed ${formatShortDate(okr.completedOn)}`
                  : ""}
              </Typography>
              {showKeyResults && okr.keyResults.length > 0 && (
                <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.25 }}>
                  {okr.keyResults.map((kr, i) => (
                    <Typography
                      key={i}
                      component="li"
                      variant="body2"
                      color="text.secondary"
                      sx={{ overflowWrap: "anywhere" }}
                    >
                      {kr}
                    </Typography>
                  ))}
                </Box>
              )}
              {onCite && (
                <Button size="small" sx={{ mt: 0.5, ml: -0.75 }} onClick={() => onCite(okr)}>
                  {citeLabel}
                </Button>
              )}
            </Box>
            {actions && <Box sx={{ flexShrink: 0, display: "flex", gap: 0.5 }}>{actions(okr)}</Box>}
          </Box>
        );
      })}
    </Stack>
  );
}
