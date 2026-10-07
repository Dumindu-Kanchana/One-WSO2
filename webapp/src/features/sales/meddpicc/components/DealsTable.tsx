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

import { Box, Chip, Link, ListingTable, Skeleton, Typography } from "@wso2/oxygen-ui";
import { SparklesIcon } from "@wso2/oxygen-ui-icons-react";
import { formatDateTime } from "../../util/salesTime";
import type { DealSummary, LetterKey } from "../types";
import { formatAmount, formatSalesforceDate } from "../util/meddpiccFormat";
import MeddpiccCircles from "./MeddpiccCircles";
import StageChip from "./StageChip";

const COLUMNS = [
  { key: "deal", label: "Deal", width: "auto" },
  { key: "stage", label: "Stage", width: 140 },
  { key: "amount", label: "Amount", width: 130, right: true },
  { key: "close", label: "Close date", width: 110 },
  { key: "lastCall", label: "Last call", width: 150 },
  { key: "meddpicc", label: "MEDDPICC", width: 220 },
  { key: "pending", label: "Pending", width: 90, center: true },
] as const;

/**
 * The deal list: one row per Opportunity with at least one analysed call.
 *
 * Not paged. The backend scopes the list to deals with recorded calls and
 * returns it whole, and a sales team's open deals of that kind fit on a page.
 *
 * The deal name is the way in, as a meeting's title is in MeetingsTable; the
 * row is clickable too, for the wide target a board wants. The circles open the
 * panel already filtered to the Letter clicked.
 */
export default function DealsTable({
  deals,
  loading,
  onOpenDeal,
}: {
  deals: DealSummary[];
  loading: boolean;
  onOpenDeal: (opportunityId: string, letter?: LetterKey) => void;
}) {
  return (
    <ListingTable.Provider loading={loading}>
      <ListingTable.Container>
        <ListingTable bordered>
          <ListingTable.Head>
            <ListingTable.Row>
              {COLUMNS.map((column) => (
                <ListingTable.Cell
                  key={column.key}
                  align={"center" in column ? "center" : "right" in column ? "right" : "left"}
                  sx={{ width: column.width, whiteSpace: "nowrap" }}
                >
                  {column.label}
                </ListingTable.Cell>
              ))}
            </ListingTable.Row>
          </ListingTable.Head>

          <ListingTable.Body>
            {loading && deals.length === 0
              ? Array.from({ length: 4 }).map((_, rowIndex) => (
                  <ListingTable.Row key={`skeleton-${rowIndex}`}>
                    {COLUMNS.map((column) => (
                      <ListingTable.Cell key={column.key}>
                        <Skeleton variant="text" />
                      </ListingTable.Cell>
                    ))}
                  </ListingTable.Row>
                ))
              : deals.map((deal) => (
                  <ListingTable.Row
                    key={deal.opportunityId}
                    clickable
                    hover
                    onClick={() => onOpenDeal(deal.opportunityId)}
                    sx={{ cursor: "pointer" }}
                  >
                    <ListingTable.Cell>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        {deal.accountName}
                      </Typography>
                      <Link
                        component="button"
                        type="button"
                        variant="body2"
                        underline="hover"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenDeal(deal.opportunityId);
                        }}
                        sx={{ textAlign: "left", color: "text.primary", fontWeight: 600 }}
                      >
                        {deal.name}
                      </Link>
                    </ListingTable.Cell>
                    <ListingTable.Cell>
                      <StageChip stage={deal.stage} />
                    </ListingTable.Cell>
                    <ListingTable.Cell align="right" sx={{ whiteSpace: "nowrap" }}>
                      <Typography variant="body2" color="text.secondary">
                        {formatAmount(deal.amount, deal.currencyIsoCode)}
                      </Typography>
                    </ListingTable.Cell>
                    <ListingTable.Cell sx={{ whiteSpace: "nowrap" }}>
                      <Typography variant="body2" color="text.secondary">
                        {formatSalesforceDate(deal.closeDate)}
                      </Typography>
                    </ListingTable.Cell>
                    <ListingTable.Cell sx={{ whiteSpace: "nowrap" }}>
                      <Typography variant="body2" color="text.secondary">
                        {formatDateTime(deal.lastCallAt)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {deal.callCount} {deal.callCount === 1 ? "call" : "calls"}
                      </Typography>
                    </ListingTable.Cell>
                    <ListingTable.Cell>
                      <MeddpiccCircles
                        variant="dealState"
                        values={deal.dealState}
                        onLetterClick={(letter) => onOpenDeal(deal.opportunityId, letter)}
                        label={`MEDDPICC for ${deal.name}`}
                      />
                    </ListingTable.Cell>
                    <ListingTable.Cell align="center">
                      {deal.pendingCount > 0 ? (
                        <Chip
                          icon={<SparklesIcon size={12} />}
                          label={deal.pendingCount}
                          size="small"
                          color="warning"
                          variant="outlined"
                          aria-label={`${deal.pendingCount} AI proposals waiting for approval`}
                          sx={{ height: 20, fontWeight: 700 }}
                        />
                      ) : (
                        <Box component="span" sx={{ color: "text.disabled" }} aria-label="Nothing pending">
                          —
                        </Box>
                      )}
                    </ListingTable.Cell>
                  </ListingTable.Row>
                ))}
          </ListingTable.Body>
        </ListingTable>

        {!loading && deals.length === 0 && (
          <ListingTable.EmptyState
            title="No deals found"
            description="Deals appear here once one of their calls has been analysed. Try a different filter."
          />
        )}
      </ListingTable.Container>
    </ListingTable.Provider>
  );
}
