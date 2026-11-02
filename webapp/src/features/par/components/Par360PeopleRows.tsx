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
import { Avatar, Box, Chip, Typography } from "@wso2/oxygen-ui";
import type { Par360ReviewStatus } from "../api/types";
import type { FeedbackKind } from "../util/par360Feedback";

// Rows of people in the 360° feedback screens: who you asked, who asked you,
// and what you've given.
export function PersonRow({
  name,
  email,
  note,
  kind,
  children,
}: {
  name?: string | null;
  email: string;
  note?: string | null;
  /** Which kind of feedback the row is about, as a chip after the name. */
  kind?: FeedbackKind;
  children: ReactNode;
}) {
  const display = name ?? email;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.25 }}>
      <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>{display.charAt(0).toUpperCase()}</Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
            {display}
          </Typography>
          {kind && <KindChip kind={kind} />}
        </Box>
        <Typography variant="caption" color="text.secondary" noWrap component="div">
          {note ? `${note} · ${email}` : email}
        </Typography>
      </Box>
      {children}
    </Box>
  );
}

export function KindChip({ kind }: { kind: FeedbackKind }) {
  return <Chip size="small" variant="outlined" label={kind === "PAR" ? "PAR" : "Leadership"} sx={{ flexShrink: 0 }} />;
}

export function StatusChip({ status }: { status: Par360ReviewStatus }) {
  if (status === "SHARED") return <Chip size="small" color="success" label="Responded" />;
  if (status === "REJECTED") return <Chip size="small" label="Declined" />;
  return <Chip size="small" variant="outlined" label="Waiting" />;
}
