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
  getReleaseFiles,
  getVersionSeries,
  productDownloadStatsBackendUrl,
  type ReleaseFile,
  type VersionSeriesItem,
} from "@features/engineering/api/productDownloadStats";
import { activeRepositories, useTrackedRepositories } from "../api/useTrackedRepositories";
import ChartCard from "../components/ChartCard";
import DownloadStatsShell from "../components/DownloadStatsShell";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FilterBar, { type FilterUpdate } from "../components/FilterBar";
import IntervalSelect from "../components/IntervalSelect";
import SelectableRow from "../components/SelectableRow";
import SeriesChart from "../components/SeriesChart";
import SkeletonRows from "../components/SkeletonRows";
import TableHeaderSearch from "../components/TableHeaderSearch";
import TablePager from "../components/TablePager";
import { usePagination } from "../hooks/usePagination";
import type { ChartSeries } from "../utils/chartTypes";
import { mergeParams, parseFilters } from "../utils/filters";
import { formatBytes, formatCompact, productLabel } from "../utils/format";

// How many of the most recent Versions the chart starts with, so a Product
// with many releases does not dump every one of them onto it at once. Clearing
// the Version select shows every Version; the Versions table is never
// narrowed by that choice, as its job is the complete, comparable view.
const DEFAULT_VISIBLE_VERSIONS = 5;

// A Version as the table, the Version select and the chart read it.
interface VersionRow {
  tag: string;
  name: string;
  total: number;
  /** Of every Version's total in the range, in percent; 0 when there were no downloads. */
  share: number;
}

// A Version is shown by its release name, falling back to its Tag
// (CONTEXT.md, "Version"). Whitespace alone counts as no name.
function versionName(item: VersionSeriesItem): string {
  return item.releaseName && item.releaseName.trim() !== "" ? item.releaseName : item.releaseTag;
}

// A Version's total is the sum of its points at every Interval — including
// Cumulative, where the points are already running totals, so the figure
// over-counts. The standalone adds them up the same way, and the spec wants
// its figures reproduced oddity and all (spec: "Figures and states", story
// 71), so a disagreement always means a port error and never a silent fix.
function versionTotal(item: VersionSeriesItem): number {
  return item.points.reduce((sum, point) => sum + point.value, 0);
}

// Every Version by downloads, highest first, with its share of them all.
function toRows(series: readonly VersionSeriesItem[]): VersionRow[] {
  const totals = series
    .map((item) => ({ tag: item.releaseTag, name: versionName(item), total: versionTotal(item) }))
    .sort((a, b) => b.total - a.total);
  const grandTotal = totals.reduce((sum, row) => sum + row.total, 0);
  return totals.map((row) => ({
    ...row,
    share: grandTotal > 0 ? (row.total / grandTotal) * 100 : 0,
  }));
}

// The most recent Versions by Tag. Numeric-aware, so v1.10 is newer than
// v1.9 (kept from the first port; the standalone compares tags as plain text).
function mostRecentTags(series: readonly VersionSeriesItem[], limit: number): string[] {
  return [...series]
    .sort((a, b) => b.releaseTag.localeCompare(a.releaseTag, undefined, { numeric: true }))
    .slice(0, limit)
    .map((item) => item.releaseTag);
}

function toChart(series: readonly VersionSeriesItem[]): ChartSeries[] {
  return series.map((item) => ({
    key: item.releaseTag,
    name: versionName(item),
    points: item.points,
  }));
}

export default function EngineeringVersionsPage(): JSX.Element {
  return (
    <DownloadStatsShell screen="versions">
      <VersionsScreen />
    </DownloadStatsShell>
  );
}

// Inside the shell, so it is mounted — and asks — only once the shell has let
// the reader through. The standalone's Versions (ADR 0002): the filter bar
// with the Product and Version selects, the chart card, and the Versions and
// Assets cards side by side. Product, dates and Interval live in the address
// so a shared link reproduces the view; the chart's Versions and the Assets
// panel's Version are the reader's, for this visit.
function VersionsScreen(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const getToken = useAccessToken();
  const base = productDownloadStatsBackendUrl();
  const productLabelId = useId();
  const versionLabelId = useId();

  const filters = parseFilters(params);
  const { from, to, interval } = filters;
  const rangeInverted = from > to;

  // The Product: the one the address names when it is active, else the first
  // active one (an inactive or missing one is written over, below).
  const repositories = useTrackedRepositories();
  const products = activeRepositories(repositories.data);
  const requested = Number(params.get("repo"));
  const requestedIsActive = products.some((product) => product.id === requested);
  const firstId = products[0]?.id ?? null;
  const repoId = requestedIsActive ? requested : firstId;

  useEffect(() => {
    if (!repositories.isSuccess || firstId == null || requestedIsActive) return;
    setParams(mergeParams(params, { repo: firstId }), { replace: true });
  }, [repositories.isSuccess, firstId, requestedIsActive, params, setParams]);

  // Not asked until the Product is known, nor while the range is inverted.
  const versions = useQuery({
    queryKey: ["product-download-stats", "versions", base, repoId, from, to, interval],
    queryFn:
      repoId == null || rangeInverted
        ? skipToken
        : async () => getVersionSeries(await getToken(), { repoId, from, to, interval }),
  });
  const series = useMemo(() => versions.data?.series ?? [], [versions.data]);
  const rows = useMemo(() => toRows(series), [series]);

  // The Version whose Assets are shown, and the Versions the chart is
  // narrowed to (empty means every one).
  const [version, setVersion] = useState<string | null>(null);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  // The Product those two were last chosen for. Read during render to hold
  // the Assets request back until they have been chosen for the current
  // Product; otherwise a Product change would ask once for the previous
  // Product's Version and again for the right one.
  const [defaultsFor, setDefaultsFor] = useState<number | null>(null);
  const repoSettled = repoId != null && defaultsFor === repoId;

  // When a Product's Versions arrive, the Assets panel opens on the Version
  // with the most downloads (the table's first row) and the chart on the most
  // recent Versions by Tag. Until they arrive, the previous Product's choices
  // are cleared. Adjusted during render, React's pattern for state that
  // follows another value, so the right Version is asked for in the same
  // render the series lands in.
  if (repoId != null && defaultsFor !== repoId) {
    if (versions.data) {
      setVersion(rows[0]?.tag ?? null);
      setSelectedVersions(mostRecentTags(series, DEFAULT_VISIBLE_VERSIONS));
      setDefaultsFor(repoId);
    } else if (version != null || selectedVersions.length > 0) {
      setVersion(null);
      setSelectedVersions([]);
    }
  }

  const assets = useQuery({
    queryKey: ["product-download-stats", "assets", base, repoId, from, to, version],
    queryFn:
      repoId == null || !repoSettled || rangeInverted
        ? skipToken
        : async () => getReleaseFiles(await getToken(), { repoId, from, to, version }),
  });

  // Memoized on the series and the selection alone, so a table-only change
  // (a search, a row click) hands the chart the same array and it is not
  // redrawn.
  const chartSeries = useMemo(
    () =>
      toChart(
        selectedVersions.length > 0
          ? series.filter((item) => selectedVersions.includes(item.releaseTag))
          : series,
      ),
    [series, selectedVersions],
  );

  const onChange = (updates: FilterUpdate) => {
    const next = new URLSearchParams(params);
    // The screen shows a default range and Product before they are in the
    // address. Write them on the first change so a shared link does not drift
    // to another day or another Product.
    if (!params.get("from")) next.set("from", from);
    if (!params.get("to")) next.set("to", to);
    if (repoId != null && !params.get("repo")) next.set("repo", String(repoId));
    // A cleared date field keeps its date: an empty From or To would otherwise
    // fall back to the default range behind the reader's back.
    const kept = Object.fromEntries(
      Object.entries(updates).filter(([key, value]) => !((key === "from" || key === "to") && !value)),
    );
    setParams(mergeParams(next, kept), { replace: true });
  };

  const toggleVersion = (tag: string) => setVersion((current) => (current === tag ? null : tag));

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
                {products.map((product) => (
                  <MenuItem key={product.id} value={product.id}>
                    {productLabel(product.productName, product.repoName)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id={versionLabelId} shrink>
                Version
              </InputLabel>
              <Select<string[]>
                labelId={versionLabelId}
                label="Version"
                multiple
                displayEmpty
                notched
                value={selectedVersions}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedVersions(typeof value === "string" ? value.split(",") : value);
                }}
                renderValue={(selected) =>
                  selected.length === 0
                    ? "All versions"
                    : selected.length === 1
                      ? selected[0]
                      : `${selected.length} versions`
                }
              >
                {rows.map((row) => (
                  <MenuItem key={row.tag} value={row.tag}>
                    <Checkbox size="small" checked={selectedVersions.includes(row.tag)} />
                    <ListItemText primary={row.name} />
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
      ) : repositories.isError ? (
        // The standalone draws its empty chart here; One never presents a
        // failed request as nothing to show (docs/conventions.md).
        <ErrorState error={repositories.error} onRetry={() => void repositories.refetch()} />
      ) : repositories.isSuccess && products.length === 0 ? (
        <EmptyState title="No products are tracked" />
      ) : (
        <>
          <ChartCard
            title="Downloads by version"
            showTypeToggle={interval !== "month"}
            defaultVariant={interval === "month" ? "bar" : "line"}
          >
            {(variant) => (
              <SeriesChart
                variant={interval === "month" ? "bar" : variant}
                series={chartSeries}
                isLoading={versions.isPending}
                isError={versions.isError}
                error={versions.error}
                onRetry={() => void versions.refetch()}
                emptyTitle="No release data for this product / range"
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
            {/* Both cards are keyed by Product, so a search from one Product
                does not carry over and hide another's rows, and both start on
                their first page. */}
            <VersionsCard
              key={`versions-${repoId}`}
              rows={rows}
              isLoading={versions.isPending}
              isError={versions.isError}
              error={versions.error}
              onRetry={() => void versions.refetch()}
              selectedTag={version}
              onToggle={toggleVersion}
            />
            <AssetsCard
              key={`assets-${repoId}`}
              version={version}
              onClear={() => setVersion(null)}
              assets={assets.data?.assets ?? []}
              isLoading={!repoSettled || assets.isPending}
              isError={assets.isError}
              error={assets.error}
              onRetry={() => void assets.refetch()}
            />
          </Box>
        </>
      )}
    </Box>
  );
}

// Every Version of the Product by downloads, highest first: Version (with the
// header search), Tag, Downloads and Share. A row is picked for the Assets
// panel; the picked row is picked again to clear it. The search narrows the
// rows and their pages, but Share stays what it is of every Version in the
// range, not of the rows that match.
function VersionsCard({
  rows,
  isLoading,
  isError,
  error,
  onRetry,
  selectedTag,
  onToggle,
}: {
  rows: VersionRow[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  selectedTag: string | null;
  onToggle: (tag: string) => void;
}): JSX.Element {
  const [search, setSearch] = useState("");
  const needle = search.toLowerCase();
  const displayed = needle
    ? rows.filter(
        (row) => row.name.toLowerCase().includes(needle) || row.tag.toLowerCase().includes(needle),
      )
    : rows;
  const pagination = usePagination(displayed);

  return (
    <Card sx={{ p: 2 }}>
      <Typography variant="h6" component="h3" sx={{ mb: 2 }}>
        Versions
      </Typography>
      {isLoading ? (
        <SkeletonRows />
      ) : isError ? (
        <ErrorState error={error} onRetry={onRetry} minHeight={160} />
      ) : rows.length === 0 ? (
        <EmptyState title="No versions found" minHeight={160} />
      ) : (
        <>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableHeaderSearch title="Version" noun="version" value={search} onChange={setSearch} />
                </TableCell>
                <TableCell>Tag</TableCell>
                <TableCell align="right">Downloads</TableCell>
                <TableCell align="right">
                  <Tooltip
                    title="Percentage of total downloads across all displayed versions in the selected date range"
                    placement="top"
                  >
                    <Box
                      component="span"
                      sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, cursor: "help" }}
                    >
                      Share
                      <Info size={13} style={{ opacity: 0.5 }} />
                    </Box>
                  </Tooltip>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayed.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} sx={{ border: 0 }}>
                    <EmptyState title="No versions match your search" minHeight={120} />
                  </TableCell>
                </TableRow>
              ) : (
                pagination.paged.map((row) => (
                  <SelectableRow
                    key={row.tag}
                    selected={selectedTag === row.tag}
                    onActivate={() => onToggle(row.tag)}
                  >
                    <TableCell>{row.name}</TableCell>
                    <TableCell>
                      <Box component="span" sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                        {row.tag}
                      </Box>
                    </TableCell>
                    <TableCell align="right">{formatCompact(row.total)}</TableCell>
                    <TableCell align="right">{row.share.toFixed(1)}%</TableCell>
                  </SelectableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePager pagination={pagination} />
        </>
      )}
    </Card>
  );
}

// The Assets of the picked Version — or of every Version when none is picked
// — with the picked Tag as a chip that clears it. Always present, so the
// screen has its shape before anything is clicked; skeleton rows while the
// Product is still being resolved as well as while the Assets load.
function AssetsCard({
  version,
  onClear,
  assets,
  isLoading,
  isError,
  error,
  onRetry,
}: {
  version: string | null;
  onClear: () => void;
  assets: ReleaseFile[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}): JSX.Element {
  const pagination = usePagination(assets);

  return (
    <Card sx={{ p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <Typography variant="h6" component="h3">
          Assets
        </Typography>
        {version ? (
          <Chip size="small" label={version} color="primary" onDelete={onClear} />
        ) : (
          <Tooltip title="Click a version row to see its assets" placement="right">
            <Info size={15} style={{ opacity: 0.45, cursor: "help" }} />
          </Tooltip>
        )}
      </Box>
      {isLoading ? (
        <SkeletonRows />
      ) : isError ? (
        <ErrorState error={error} onRetry={onRetry} minHeight={160} />
      ) : assets.length === 0 ? (
        <EmptyState title="No asset data" minHeight={160} />
      ) : (
        <>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Asset</TableCell>
                <TableCell align="right">Size</TableCell>
                <TableCell align="right">Downloads</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pagination.paged.map((asset) => (
                <TableRow key={`${asset.releaseTag}-${asset.assetName}`}>
                  <TableCell>{asset.assetName}</TableCell>
                  <TableCell align="right">{formatBytes(asset.assetSize)}</TableCell>
                  <TableCell align="right">{formatCompact(asset.downloadCount)}</TableCell>
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
