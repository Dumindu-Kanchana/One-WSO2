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

import {
  Box,
  Card,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import { type JSX } from "react";
import { useNavigate } from "react-router";
import { downloadStatsPaths } from "@constants/downloadStatsApps";
import type { TopProduct } from "../api/productDownloadStats";
import { activateOnEnterOrSpace } from "../utils/activation";
import { formatCompact, productLabel } from "../utils/format";
import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";

const TOP_N = 6;

interface TopProductsTableProps {
  products?: TopProduct[];
  isLoading?: boolean;
  isError?: boolean;
  /** The summary's error; its server message becomes the placeholder's detail line. */
  error?: unknown;
  onRetry?: () => void;
}

// The Overview's shortcut list: the six Products with the most release
// downloads, each row opening Downloads for that Product (ADR 0002). A
// whole-row click with keyboard support rather than a text button, so a
// Product's name renders in its own case.
export default function TopProductsTable({
  products,
  isLoading,
  isError,
  error,
  onRetry,
}: TopProductsTableProps): JSX.Element {
  const navigate = useNavigate();

  const top = [...(products ?? [])]
    .sort((a, b) => b.totalDownloads - a.totalDownloads)
    .slice(0, TOP_N);

  return (
    <Card sx={{ p: 2 }}>
      <Typography variant="h6" component="h3" sx={{ mb: 2 }}>
        Top Products (Downloads)
      </Typography>

      {isLoading ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {Array.from({ length: TOP_N }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={36} />
          ))}
        </Box>
      ) : isError ? (
        <ErrorState error={error} onRetry={onRetry} minHeight={160} />
      ) : top.length === 0 ? (
        <EmptyState title="No tracked products yet" minHeight={160} />
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Product</TableCell>
              <TableCell align="right">Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {top.map((product) => {
              const open = () =>
                void navigate(`${downloadStatsPaths.downloads}?repos=${product.repoId}`);
              return (
                <TableRow
                  key={product.repoId}
                  hover
                  role="button"
                  tabIndex={0}
                  sx={{ cursor: "pointer" }}
                  onClick={open}
                  onKeyDown={activateOnEnterOrSpace(open)}
                >
                  <TableCell>{productLabel(product.productName, product.repoName)}</TableCell>
                  <TableCell align="right">{formatCompact(product.totalDownloads)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
