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
import {
  Box,
  Card,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import { type JSX, useState } from "react";
import { useSearchParams } from "react-router";
import { useAccessToken } from "@hooks/useAccessToken";
import {
  getReleaseDownloads,
  productDownloadStatsBackendUrl,
  type ReleaseDownloadGrain,
} from "@features/engineering/api/productDownloadStats";
import { useTrackedRepositories } from "../api/useTrackedRepositories";
import ChartCard, { type ChartVariant } from "../components/ChartCard";
import DateHeaderFilter from "../components/DateHeaderFilter";
import DownloadStatsShell from "../components/DownloadStatsShell";
import ErrorState from "../components/ErrorState";
import FilterBar, { type FilterUpdate } from "../components/FilterBar";
import IntervalSelect from "../components/IntervalSelect";
import SeriesChart from "../components/SeriesChart";
import SkeletonRows from "../components/SkeletonRows";
import { StatCard } from "../components/StatCard";
import TablePager from "../components/TablePager";
import { INTERVAL_LABEL } from "../constants/intervalLabels";
import { usePagination } from "../hooks/usePagination";
import type { ChartSeries } from "../utils/chartTypes";
import {
  applyFilterChange,
  buildDateMatrix,
  parseFilters,
  periodSummary,
  productNameById,
  toChartSeries,
  type PeriodSummary,
} from "../utils/filters";
import { formatCompact, formatDate, formatMonthYear } from "../utils/format";

export default function EngineeringDownloadsPage(): JSX.Element {
  return (
    <DownloadStatsShell screen="downloads">
      <DownloadsScreen />
    </DownloadStatsShell>
  );
}

// Inside the shell, so it is mounted — and asks — only once the shell has let
// the reader through. Downloads: the filter bar,
// the chart card titled by interval, four period tiles, and the date × product
// table. Filters, Products and the chart type live in the address so a shared
// link reproduces the view.
function DownloadsScreen(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const getToken = useAccessToken();
  const base = productDownloadStatsBackendUrl();

  const filters = parseFilters(params);
  const { from, to, interval, repos } = filters;
  const rangeInverted = from > to;

  const downloads = useQuery({
    queryKey: ["product-download-stats", "downloads", base, from, to, interval, repos.join(",")],
    enabled: !rangeInverted,
    queryFn: async () => getReleaseDownloads(await getToken(), { from, to, interval, repos }),
  });
  // Names the chart's series and the table's columns; the picker shares the
  // same request.
  const repositories = useTrackedRepositories();
  const series = toChartSeries(
    downloads.data?.series ?? [],
    productNameById(repositories.data?.repositories ?? []),
  );
  const summary = periodSummary(series);

  // The chart type is kept in the address (spec: One's invisible behaviours
  // stay) and applies to Daily alone: Monthly draws bars and Cumulative lines,
  // whatever the address says.
  const variant: ChartVariant =
    interval === "day"
      ? params.get("chart") === "bar"
        ? "bar"
        : "line"
      : interval === "month"
        ? "bar"
        : "line";

  const onChange = (updates: FilterUpdate) =>
    setParams(applyFilterChange(params, { from, to }, updates), { replace: true });

  return (
    <Box>
      <FilterBar
        filters={filters}
        onChange={onChange}
        filterSlot={
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <IntervalSelect
              label="View"
              value={interval}
              // The interval's own default chart type takes over when View changes.
              onChange={(chosen) => onChange({ interval: chosen, chart: null })}
            />
          </Grid>
        }
      />

      {rangeInverted ? (
        <Typography>From is after To.</Typography>
      ) : (
        <>
          <ChartCard
            title={`${INTERVAL_LABEL[interval]} downloads by product`}
            subtitle="Downloads across the selected products and range"
            showTypeToggle={interval === "day"}
            defaultVariant={variant}
            onVariantChange={(chosen) => onChange({ chart: chosen === "line" ? null : chosen })}
          >
            {(chosen) => (
              <SeriesChart
                variant={chosen}
                series={series}
                isLoading={downloads.isPending}
                isError={downloads.isError}
                error={downloads.error}
                onRetry={() => void downloads.refetch()}
                xTickFormat="short"
              />
            )}
          </ChartCard>

          {interval !== "cumulative" && summary.pointCount > 0 && (
            <PeriodTiles summary={summary} interval={interval} from={from} to={to} />
          )}

          {/* Keyed by interval so a change of View remounts the table: the
              chosen date (a day's form is not a month's) and the page start
              over. */}
          <DownloadsTable
            key={interval}
            interval={interval}
            series={series}
            isLoading={downloads.isPending}
            isError={downloads.isError}
            error={downloads.error}
            onRetry={() => void downloads.refetch()}
          />
        </>
      )}
    </Box>
  );
}

// The four headline figures of the range, under the chart: the average per
// day or month, the highest and lowest with their dates, and the total with
// the range. Cumulative has none, as a running total has no "per point".
function PeriodTiles({
  summary,
  interval,
  from,
  to,
}: {
  summary: PeriodSummary;
  interval: Exclude<ReleaseDownloadGrain, "cumulative">;
  from: string;
  to: string;
}): JSX.Element {
  const unit = interval === "month" ? "Month" : "Day";
  const formatPoint = interval === "month" ? formatMonthYear : formatDate;
  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
        mt: 2,
      }}
    >
      <StatCard
        label="Average Downloads"
        value={formatCompact(summary.avgPerPoint)}
        tooltipText={`Average downloads per ${unit.toLowerCase()} across all selected products in the selected date range`}
      />
      <StatCard label={`Highest ${unit} (${formatPoint(summary.peakDate)})`} value={formatCompact(summary.peakValue)} />
      <StatCard label={`Lowest ${unit} (${formatPoint(summary.minDate)})`} value={formatCompact(summary.minValue)} />
      <StatCard
        label={`Period Total (${formatPoint(from)} – ${formatPoint(to)})`}
        value={formatCompact(summary.total)}
      />
    </Box>
  );
}

// The date × product table: one row per date, newest first, one column per
// Product and a bold Total. A Product with no point on a date reads 0. Daily
// and Cumulative dates are calendar days; Monthly keeps the API's own month
// label. The Date header's calendar narrows the rows to one date, and the
// table is paged.
//
// While the series loads the table shows skeleton rows, and when it fails an
// error with Retry. An empty range is the only case that says there is no data:
// a failed request is never presented as nothing to show
// (docs/conventions.md, "Data fetching").
function DownloadsTable({
  interval,
  series,
  isLoading,
  isError,
  error,
  onRetry,
}: {
  interval: ReleaseDownloadGrain;
  series: ChartSeries[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}): JSX.Element {
  const isMonthly = interval === "month";
  const [dateFilter, setDateFilter] = useState("");
  const matrix = buildDateMatrix(series);
  const dates = dateFilter ? matrix.dates.filter((date) => date === dateFilter) : matrix.dates;
  const pagination = usePagination(dates);
  const formatRowDate = (date: string) => (isMonthly ? date : formatDate(date));

  return (
    <Card sx={{ p: 2, mt: 2, overflowX: "auto" }}>
      <Typography variant="h6" component="h3" sx={{ mb: 2 }}>
        {INTERVAL_LABEL[interval]} downloads table
      </Typography>
      {isLoading ? (
        <SkeletonRows />
      ) : isError ? (
        <ErrorState error={error} onRetry={onRetry} minHeight={160} />
      ) : matrix.dates.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No data for the selected range.
        </Typography>
      ) : (
        <>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    Date
                    <DateHeaderFilter
                      type={isMonthly ? "month" : "date"}
                      value={dateFilter}
                      onChange={setDateFilter}
                      format={formatRowDate}
                    />
                  </Box>
                </TableCell>
                {matrix.columns.map((column) => (
                  <TableCell key={column.key} align="right">
                    {column.name}
                  </TableCell>
                ))}
                <TableCell align="right">
                  <strong>Total</strong>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pagination.paged.map((date) => (
                <TableRow key={date}>
                  <TableCell>{formatRowDate(date)}</TableCell>
                  {matrix.columns.map((column) => (
                    <TableCell key={column.key} align="right">
                      {formatCompact(matrix.cell(date, column.key) ?? 0)}
                    </TableCell>
                  ))}
                  <TableCell align="right">
                    <strong>{formatCompact(matrix.totalForDate(date))}</strong>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePager pagination={pagination} />
        </>
      )}
    </Card>
  );
}
