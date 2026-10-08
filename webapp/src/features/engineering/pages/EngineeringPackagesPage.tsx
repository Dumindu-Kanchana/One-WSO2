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

import { skipToken, useQuery } from "@tanstack/react-query";
import {
  Box,
  Card,
  Checkbox,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { Info } from "@wso2/oxygen-ui-icons-react";
import { type JSX, useEffect, useId, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useAccessToken } from "@hooks/useAccessToken";
import {
  getPackageBreakdown,
  getPackageProducts,
  getPackageSeries,
  getPackageVersions,
  productDownloadStatsBackendUrl,
  type PackageBreakdownItem,
  type PackageSeriesItem,
  type PackageVersionItem,
  type ReleaseDownloadGrain,
} from "@features/engineering/api/productDownloadStats";
import ChartCard from "../components/ChartCard";
import DownloadStatsShell from "../components/DownloadStatsShell";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FilterBar, { type FilterUpdate } from "../components/FilterBar";
import IntervalSelect from "../components/IntervalSelect";
import SelectableRow from "../components/SelectableRow";
import SeriesChart from "../components/SeriesChart";
import SkeletonRows from "../components/SkeletonRows";
import TablePager from "../components/TablePager";
import { usePagination } from "../hooks/usePagination";
import type { ChartSeries } from "../utils/chartTypes";
import { applyFilterChange, mergeParams, parseFilters } from "../utils/filters";
import { formatCompact, productLabel } from "../utils/format";

// How many of the most active Packages the chart starts with, so a Product
// with many Packages does not dump every one of them onto it at once. Clearing
// the Chart packages select shows every Package; the Packages table is never
// narrowed by that choice, as its job is the complete, comparable view.
const DEFAULT_VISIBLE_PACKAGES = 5;

// Cumulative reads a different figure from Daily and Monthly: the all-time
// total (a running stock, as of the latest Scraper Sync) rather than the
// period downloads (a flow over the range). Day and month share the figure on
// purpose — summing a range's daily Package downloads equals summing its
// monthly ones — so only Cumulative switches the source field.
function downloadsOf(
  item: { periodDownloads: number; totalDownloads: number },
  interval: ReleaseDownloadGrain,
): number {
  return interval === "cumulative" ? item.totalDownloads : item.periodDownloads;
}

// Most active first: by period downloads, then all-time total, then name — the
// API's own order, applied again here so the table, the chart's starting
// Packages and the Versions panel's opening Package all agree on it. Cumulative
// keeps this order under its all-time figures.
function byActivity(a: PackageBreakdownItem, b: PackageBreakdownItem): number {
  if (a.periodDownloads !== b.periodDownloads) return b.periodDownloads - a.periodDownloads;
  if (a.totalDownloads !== b.totalDownloads) return b.totalDownloads - a.totalDownloads;
  return a.packageName.localeCompare(b.packageName);
}

function toChart(series: readonly PackageSeriesItem[]): ChartSeries[] {
  return series.map((item) => ({
    key: item.packageName,
    name: item.packageName,
    points: item.points,
  }));
}

// A Package version is shown by its Tags, falling back to its id when it was
// never tagged.
function versionTags(version: PackageVersionItem): string {
  return version.tags || `#${version.versionId}`;
}

export default function EngineeringPackagesPage(): JSX.Element {
  return (
    <DownloadStatsShell screen="packages">
      <PackagesScreen />
    </DownloadStatsShell>
  );
}

// Inside the shell, so it is mounted — and asks — only once the shell has let
// the reader through. Packages: the filter bar
// with the Product and Chart packages selects, the chart card, and the
// Packages and Versions cards side by side. Product, dates and Interval live
// in the address so a shared link reproduces the view; the chart's Packages
// and the Versions panel's Package are the reader's, for this visit.
function PackagesScreen(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const getToken = useAccessToken();
  const base = productDownloadStatsBackendUrl();
  const productLabelId = useId();
  const packagesLabelId = useId();

  const filters = parseFilters(params);
  const { from, to, interval } = filters;
  const rangeInverted = from > to;

  // The Product: the one the address names when the API offers it, else the
  // first offered (a missing or unoffered one is written over, below). Only
  // Products with Package downloads are offered, the API's own list.
  const products = useQuery({
    queryKey: ["product-download-stats", "package-products", base],
    queryFn: async () => getPackageProducts(await getToken()),
  });
  const offered = products.data?.repos ?? [];
  const requested = Number(params.get("repo"));
  const requestedIsOffered = offered.some((product) => product.repoId === requested);
  const firstId = offered[0]?.repoId ?? null;
  const repoId = requestedIsOffered ? requested : firstId;

  useEffect(() => {
    if (!products.isSuccess || firstId == null || requestedIsOffered) return;
    setParams(mergeParams(params, { repo: firstId }), { replace: true });
  }, [products.isSuccess, firstId, requestedIsOffered, params, setParams]);

  // Not asked until the Product is known, nor while the range is inverted.
  const breakdown = useQuery({
    queryKey: ["product-download-stats", "packages", base, repoId, from, to],
    queryFn:
      repoId == null || rangeInverted
        ? skipToken
        : async () => getPackageBreakdown(await getToken(), { repoId, from, to }),
  });
  const series = useQuery({
    queryKey: ["product-download-stats", "package-series", base, repoId, from, to, interval],
    queryFn:
      repoId == null || rangeInverted
        ? skipToken
        : async () => getPackageSeries(await getToken(), { repoId, from, to, interval }),
  });
  const rows = useMemo(
    () => [...(breakdown.data?.packages ?? [])].sort(byActivity),
    [breakdown.data],
  );
  const seriesItems = useMemo(() => series.data?.series ?? [], [series.data]);

  // The Package whose versions are shown, and the Packages the chart is
  // narrowed to (empty means every one).
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [chartPackages, setChartPackages] = useState<string[]>([]);
  // The Product those two were last chosen for. Read during render to hold
  // the versions request back until they have been chosen for the current
  // Product; otherwise a Product change would ask once for the previous
  // Product's Package and again for the right one.
  const [defaultsFor, setDefaultsFor] = useState<number | null>(null);
  const repoSettled = repoId != null && defaultsFor === repoId;

  // When a Product's breakdown arrives, the Versions panel opens on the most
  // active Package (the table's first row) and the chart on the most active
  // few. Until it arrives, the previous Product's choices are cleared.
  // Adjusted during render, React's pattern for state that follows another
  // value, so the right Package is asked for in the same render the
  // breakdown lands in.
  if (repoId != null && defaultsFor !== repoId) {
    if (breakdown.data) {
      setSelectedPackage(rows[0]?.packageName ?? null);
      setChartPackages(rows.slice(0, DEFAULT_VISIBLE_PACKAGES).map((row) => row.packageName));
      setDefaultsFor(repoId);
    } else if (selectedPackage != null || chartPackages.length > 0) {
      setSelectedPackage(null);
      setChartPackages([]);
    }
  }

  const versions = useQuery({
    queryKey: ["product-download-stats", "package-versions", base, repoId, from, to, selectedPackage],
    queryFn:
      repoId == null || !repoSettled || selectedPackage == null || rangeInverted
        ? skipToken
        : async () =>
            getPackageVersions(await getToken(), { repoId, from, to, packageName: selectedPackage }),
  });

  // Memoized on the series and the selection alone, so a table-only change (a
  // row click) hands the chart the same array and it is not redrawn.
  const chartSeries = useMemo(
    () =>
      toChart(
        chartPackages.length > 0
          ? seriesItems.filter((item) => chartPackages.includes(item.packageName))
          : seriesItems,
      ),
    [seriesItems, chartPackages],
  );

  const onChange = (updates: FilterUpdate) =>
    setParams(applyFilterChange(params, { from, to, repo: repoId }, updates), { replace: true });

  return (
    <Box>
      <FilterBar
        filters={filters}
        onChange={onChange}
        pickerSlot={
          <>
            <FormControl size="small" sx={{ flex: 1, minWidth: 200 }}>
              <InputLabel id={productLabelId} shrink>
                Product
              </InputLabel>
              <Select
                labelId={productLabelId}
                label="Product"
                notched
                value={repoId ?? ""}
                onChange={(event) => onChange({ repo: String(event.target.value) })}
              >
                {offered.map((product) => (
                  <MenuItem key={product.repoId} value={product.repoId}>
                    {productLabel(product.productName, product.repoName)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id={packagesLabelId} shrink>
                Chart packages
              </InputLabel>
              <Select<string[]>
                labelId={packagesLabelId}
                label="Chart packages"
                multiple
                displayEmpty
                notched
                value={chartPackages}
                onChange={(event) => {
                  const value = event.target.value;
                  setChartPackages(typeof value === "string" ? value.split(",") : value);
                }}
                renderValue={(selected) =>
                  selected.length === 0
                    ? "All packages"
                    : selected.length === 1
                      ? selected[0]
                      : `${selected.length} packages`
                }
              >
                {rows.map((row) => (
                  <MenuItem key={row.packageName} value={row.packageName}>
                    <Checkbox size="small" checked={chartPackages.includes(row.packageName)} />
                    <ListItemText primary={row.packageName} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </>
        }
        filterSlot={
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <IntervalSelect
              label="Interval"
              value={interval}
              onChange={(chosen) => onChange({ interval: chosen })}
            />
          </Grid>
        }
      />

      {rangeInverted ? (
        <Typography>From is after To.</Typography>
      ) : products.isError ? (
        // A failed request is never presented as nothing to show
        // (docs/conventions.md).
        <ErrorState error={products.error} onRetry={() => void products.refetch()} />
      ) : products.isSuccess && offered.length === 0 ? (
        <EmptyState title="No product has package downloads" />
      ) : (
        <>
          <ChartCard
            title="Downloads by package"
            subtitle="Package pulls over the selected range, from exact scraped totals"
            showTypeToggle={interval !== "month"}
            defaultVariant={interval === "month" ? "bar" : "line"}
          >
            {(variant) => (
              <SeriesChart
                variant={interval === "month" ? "bar" : variant}
                series={chartSeries}
                isLoading={series.isPending}
                isError={series.isError}
                error={series.error}
                onRetry={() => void series.refetch()}
                emptyTitle="No package data for this product / range yet"
                xTickFormat="short"
              />
            )}
          </ChartCard>

          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              mt: 2,
            }}
          >
            {/* Both cards are keyed by Product so each starts on its first
                page for a new Product; the Versions card by its Package too,
                so a newly picked Package's versions open on their first page
                rather than on a page index left over from another's. */}
            <PackagesCard
              key={`packages-${repoId}`}
              rows={rows}
              interval={interval}
              isLoading={breakdown.isPending}
              isError={breakdown.isError}
              error={breakdown.error}
              onRetry={() => void breakdown.refetch()}
              selectedPackage={selectedPackage}
              onSelect={setSelectedPackage}
            />
            <VersionsCard
              key={`versions-${repoId}-${selectedPackage ?? ""}`}
              packageName={selectedPackage}
              onClear={() => setSelectedPackage(null)}
              versions={versions.data?.versions ?? []}
              interval={interval}
              isLoading={!repoSettled || versions.isLoading}
              isError={versions.isError}
              error={versions.error}
              onRetry={() => void versions.refetch()}
            />
          </Box>
        </>
      )}
    </Box>
  );
}

// The Downloads header of both tables, saying which total the column holds:
// the selected range's, or all time when the Interval is Cumulative.
function DownloadsHeader({ interval }: { interval: ReleaseDownloadGrain }): JSX.Element {
  return (
    <Tooltip
      title={
        interval === "cumulative"
          ? "All-time downloads, as of the latest sync"
          : "Downloads within the selected date range"
      }
      placement="top"
    >
      <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, cursor: "help" }}>
        Downloads
      </Box>
    </Tooltip>
  );
}

// Every Package of the Product, most active first: Package and Downloads. A
// row is picked to open the Versions panel on it; the picked row stays picked
// until another is, or its chip is cleared.
function PackagesCard({
  rows,
  interval,
  isLoading,
  isError,
  error,
  onRetry,
  selectedPackage,
  onSelect,
}: {
  rows: PackageBreakdownItem[];
  interval: ReleaseDownloadGrain;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  selectedPackage: string | null;
  onSelect: (packageName: string) => void;
}): JSX.Element {
  const pagination = usePagination(rows);

  return (
    <Card sx={{ p: 2 }}>
      <Typography variant="h6" component="h3" sx={{ mb: 2 }}>
        Packages
      </Typography>
      {isLoading ? (
        <SkeletonRows />
      ) : isError ? (
        <ErrorState error={error} onRetry={onRetry} minHeight={160} />
      ) : rows.length === 0 ? (
        <EmptyState title="No packages found" minHeight={160} />
      ) : (
        <>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Package</TableCell>
                <TableCell align="right">
                  <DownloadsHeader interval={interval} />
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pagination.paged.map((row) => (
                <SelectableRow
                  key={row.packageName}
                  selected={selectedPackage === row.packageName}
                  onActivate={() => onSelect(row.packageName)}
                >
                  <TableCell>{row.packageName}</TableCell>
                  <TableCell align="right">{formatCompact(downloadsOf(row, interval))}</TableCell>
                </SelectableRow>
              ))}
            </TableBody>
          </Table>
          <TablePager pagination={pagination} />
        </>
      )}
    </Card>
  );
}

// The versions of the picked Package, with the Package as a chip that clears
// it, or a hint when none is picked. Always present, so the screen has its
// shape before anything is clicked; skeleton rows while the Product is still
// being resolved as well as while the versions load.
function VersionsCard({
  packageName,
  onClear,
  versions,
  interval,
  isLoading,
  isError,
  error,
  onRetry,
}: {
  packageName: string | null;
  onClear: () => void;
  versions: PackageVersionItem[];
  interval: ReleaseDownloadGrain;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}): JSX.Element {
  const pagination = usePagination(versions);

  return (
    <Card sx={{ p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <Typography variant="h6" component="h3">
          Versions
        </Typography>
        {packageName ? (
          <Chip size="small" label={packageName} color="primary" onDelete={onClear} />
        ) : (
          <Tooltip title="Click a package row to see its versions" placement="right">
            <Info size={15} style={{ opacity: 0.45, cursor: "help" }} />
          </Tooltip>
        )}
      </Box>
      {isLoading ? (
        <SkeletonRows />
      ) : isError ? (
        <ErrorState error={error} onRetry={onRetry} minHeight={160} />
      ) : !packageName ? (
        <EmptyState title="Select a package to see versions" minHeight={160} />
      ) : versions.length === 0 ? (
        <EmptyState title="No tagged version data yet" minHeight={160} />
      ) : (
        <>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tags</TableCell>
                <TableCell align="right">
                  <DownloadsHeader interval={interval} />
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pagination.paged.map((version) => (
                <TableRow key={version.versionId}>
                  <TableCell>
                    <Box component="span" sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                      {versionTags(version)}
                    </Box>
                  </TableCell>
                  <TableCell align="right">{formatCompact(downloadsOf(version, interval))}</TableCell>
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
