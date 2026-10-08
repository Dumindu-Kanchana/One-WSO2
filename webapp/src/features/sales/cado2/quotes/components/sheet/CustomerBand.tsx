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

import type { JSX, ReactNode } from "react";
import { Avatar, Box, Paper, Stack, Typography } from "@wso2/oxygen-ui";
import { BriefcaseIcon, HandshakeIcon } from "@wso2/oxygen-ui-icons-react";
import type { QuoteSheet } from "@features/sales/cado2/quotes/sheet/sheetModel";
import { initialsOfName as initialsFor } from "@features/sales/cado2/utils/initials";

/**
 * The quote page's record header: the band, with the quote number above the
 * account, the status, and the page's actions (2026-10-07; frontend.md, "Page
 * titles": a record page's header carries the record's identity).
 */
interface HeaderParts {
  /** Above the account name, e.g. "Q-26-00012 · Version 2". */
  readonly eyebrow: ReactNode;
  /** Status chips, top right. */
  readonly status: ReactNode;
  /** The page's buttons (Recall, Revise, Your approval, …), top right. */
  readonly actions: ReactNode;
}

/**
 * Who the quote is for: account, opportunity and partner, up front (the deal
 * type, region and currency are facts in the Deal section). The
 * contacts sit with the addresses. With `header`, it is the quote page's
 * header (the account is the page's title); without, a box at the top of the
 * Review step.
 */
export default function CustomerBand({ sheet, header }: { sheet: QuoteSheet; header?: HeaderParts }): JSX.Element {
  const partner = sheet.dealType === "PARTNER" ? sheet.partner : null;
  return (
    <Paper
      component={header ? "header" : "section"}
      aria-label={header ? "About this quote" : "Customer"}
      variant="outlined"
      sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, borderLeft: 4, borderLeftColor: "primary.main", minWidth: 0 }}
    >
      <Stack direction={{ xs: "column", md: "row" }} spacing={3} justifyContent="space-between">
        <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0 }}>
          <Avatar sx={{ width: 56, height: 56, bgcolor: "primary.main", color: "primary.contrastText", fontSize: 22, fontWeight: 600 }}>
            {initialsFor(sheet.accountName || "?")}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            {header ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.25 }}>
                {header.eyebrow}
              </Typography>
            ) : null}
            <Typography
              variant={header ? "h4" : "h5"}
              component={header ? "h1" : "p"}
              sx={{ fontWeight: 700, lineHeight: 1.2 }}
            >
              {sheet.accountName || "No account yet"}
            </Typography>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5, color: "text.secondary" }}>
              <BriefcaseIcon size={14} />
              <Typography variant="body2">{sheet.opportunityName || "No opportunity yet"}</Typography>
            </Stack>
          </Box>
        </Stack>
        <Stack spacing={2} alignItems={{ xs: "flex-start", md: "flex-end" }} sx={{ minWidth: 0, flexShrink: 0 }}>
        {header ? (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 1, justifyContent: { md: "flex-end" } }}>
            {header.status}
            {header.actions}
          </Stack>
        ) : null}
        {partner ? (
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
            <Avatar sx={{ width: 44, height: 44, bgcolor: "secondary.main", color: "secondary.contrastText" }}>
              <HandshakeIcon size={20} />
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4, display: "block" }}>
                Sold through
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {partner.name}
              </Typography>
              {partner.role ? (
                <Typography variant="caption" color="text.secondary">
                  {partner.role}
                </Typography>
              ) : null}
            </Box>
          </Stack>
        ) : null}
        </Stack>
      </Stack>
    </Paper>
  );
}
