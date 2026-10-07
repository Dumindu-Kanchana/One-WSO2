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

import type { JSX } from "react";
import { Avatar, Box, Chip, Paper, Stack, Typography } from "@wso2/oxygen-ui";
import { BriefcaseIcon, GlobeIcon, HandshakeIcon, RepeatIcon } from "@wso2/oxygen-ui-icons-react";
import type { QuoteSheet } from "@features/sales/cado2/quotes/sheet/sheetModel";
import { initialsOfName as initialsFor } from "@features/sales/cado2/utils/initials";

/** Who the quote is for: account, opportunity and partner, up front. The contacts sit with the addresses. */
export default function CustomerBand({ sheet }: { sheet: QuoteSheet }): JSX.Element {
  const partner = sheet.dealType === "PARTNER" ? sheet.partner : null;
  return (
    <Paper
      component="section"
      aria-label="Customer"
      variant="outlined"
      sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, borderLeft: 4, borderLeftColor: "primary.main", minWidth: 0 }}
    >
      <Stack direction={{ xs: "column", md: "row" }} spacing={3} justifyContent="space-between">
        <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0 }}>
          <Avatar sx={{ width: 56, height: 56, bgcolor: "primary.main", color: "primary.contrastText", fontSize: 22, fontWeight: 600 }}>
            {initialsFor(sheet.accountName || "?")}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" component="p" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {sheet.accountName || "No account yet"}
            </Typography>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5, color: "text.secondary" }}>
              <BriefcaseIcon size={14} />
              <Typography variant="body2">{sheet.opportunityName || "No opportunity yet"}</Typography>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", rowGap: 1 }}>
              {sheet.dealType ? (
                <Chip size="small" color="primary" label={sheet.dealType === "PARTNER" ? "Partner deal" : "Direct deal"} />
              ) : (
                <Chip size="small" color="warning" variant="outlined" label="Deal type unknown" />
              )}
              <Chip
                size="small"
                variant="outlined"
                icon={sheet.isRenewal ? <RepeatIcon size={12} /> : undefined}
                label={
                  sheet.isRenewal
                    ? `Renewal of ${sheet.previousOpportunityCount} opportunit${sheet.previousOpportunityCount === 1 ? "y" : "ies"}`
                    : "New business"
                }
              />
              {sheet.salesRegion ? (
                <Chip size="small" variant="outlined" icon={<GlobeIcon size={12} />} label={sheet.salesRegion} title="Sales region" />
              ) : null}
              {sheet.subRegion ? <Chip size="small" variant="outlined" label={sheet.subRegion} title="Sub-region" /> : null}
              {sheet.currency ? <Chip size="small" variant="outlined" label={sheet.currency} /> : null}
            </Stack>
          </Box>
        </Stack>
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
    </Paper>
  );
}
