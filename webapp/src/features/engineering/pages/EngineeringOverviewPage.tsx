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

import { useQuery } from "@tanstack/react-query";
import { Box } from "@wso2/oxygen-ui";
import type { JSX } from "react";
import { useAccessToken } from "@hooks/useAccessToken";
import {
  getDaily,
  getSummary,
  productDownloadStatsBackendUrl,
} from "@features/engineering/api/productDownloadStats";
import { useTrackedRepositories } from "../api/useTrackedRepositories";
import ChartCard from "../components/ChartCard";
import DownloadStatsShell from "../components/DownloadStatsShell";
import KpiCards from "../components/KpiCards";
import SeriesChart from "../components/SeriesChart";
import TopProductsTable from "../components/TopProductsTable";
import { productNameById, toChartSeries } from "../utils/filters";

export default function EngineeringOverviewPage(): JSX.Element {
  return (
    <DownloadStatsShell screen="overview">
      <OverviewScreen />
    </DownloadStatsShell>
  );
}

// Inside the shell, so it is mounted — and asks — only once the shell has let
// the reader through. Overview: the five tiles,
// then the daily chart beside the top products, two thirds to one third on a
// wide window and stacked on a narrow one. Each part shows its own skeleton,
// empty sentence or error, so a slow or failed request blanks only itself
// (docs/conventions.md, "Data fetching").
function OverviewScreen(): JSX.Element {
  const base = productDownloadStatsBackendUrl();
  const getToken = useAccessToken();

  const summary = useQuery({
    queryKey: ["product-download-stats", "summary", base],
    queryFn: async () => getSummary(await getToken()),
  });
  // The hero chart: every Product's daily release downloads, last 30 days.
  const daily = useQuery({
    queryKey: ["product-download-stats", "daily", base],
    queryFn: async () => getDaily(await getToken()),
  });
  // Names the chart's series; the chart draws by repository name until the
  // Products arrive, rather than waiting for them.
  const repositories = useTrackedRepositories();
  const names = productNameById(repositories.data?.repositories ?? []);

  return (
    <Box>
      <KpiCards summary={summary.data} isLoading={summary.isPending} isError={summary.isError} />

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" },
          alignItems: "start",
        }}
      >
        <ChartCard title="Daily Downloads (last 30 days)">
          <SeriesChart
            series={toChartSeries(daily.data?.series ?? [], names)}
            isLoading={daily.isPending}
            isError={daily.isError}
            error={daily.error}
            onRetry={() => void daily.refetch()}
            xTickFormat="short"
          />
        </ChartCard>

        <TopProductsTable
          products={summary.data?.topProducts}
          isLoading={summary.isPending}
          isError={summary.isError}
          error={summary.error}
          onRetry={() => void summary.refetch()}
        />
      </Box>
    </Box>
  );
}
