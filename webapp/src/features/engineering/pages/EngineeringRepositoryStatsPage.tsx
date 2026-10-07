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

import { skipToken, useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  Box,
  Card,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { Info } from "@wso2/oxygen-ui-icons-react";
import { type ChangeEvent, type JSX, useId, useState } from "react";
import { useSearchParams } from "react-router";
import { useAccessToken } from "@hooks/useAccessToken";
import {
  getCloneSeries,
  getMetricSeries,
  productDownloadStatsBackendUrl,
  type CloneSeriesItem,
  type CloneSeriesResponse,
  type DailySeries,
  type MetricSeriesResponse,
  type ReleaseDownloadGrain,
  type RepositoryMeasure,
  type RepositorySnapshot,
  type TrackedRepository,
} from "@features/engineering/api/productDownloadStats";
import { activeRepositories, useTrackedRepositories } from "../api/useTrackedRepositories";
import ChartCard from "../components/ChartCard";
import DownloadStatsShell from "../components/DownloadStatsShell";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import FilterBar, { type FilterUpdate } from "../components/FilterBar";
import IntervalSelect from "../components/IntervalSelect";
import SeriesChart from "../components/SeriesChart";
import SkeletonRows from "../components/SkeletonRows";
import TableHeaderSearch from "../components/TableHeaderSearch";
import TablePager from "../components/TablePager";
import { usePagination } from "../hooks/usePagination";
import {
  applyFilterChange,
  parseFilters,
  productNameById,
  toChartSeries,
  type StatsFilters,
} from "../utils/filters";
import { formatCompact, productLabel } from "../utils/format";

// The Stat the chart plots (CONTEXT.md, "Stat"): a GitHub measure the API
// serves as a series of its own, or one of the two clone figures, which are
// read from the clone history instead.
type StatKey = RepositoryMeasure | "clones" | "uniqueCloners";

const STAT_OPTIONS: ReadonlyArray<{ value: StatKey; label: string }> = [
  { value: "stars", label: "Stars" },
  { value: "forks", label: "Forks" },
  { value: "watchers", label: "Watchers" },
  { value: "openIssues", label: "Open Issues" },
  { value: "clones", label: "Total Clones" },
  { value: "uniqueCloners", label: "Unique Cloners" },
];

const MEASURES: readonly RepositoryMeasure[] = ["stars", "forks", "watchers", "openIssues"];

// Where a measure's latest count sits on a Tracked repository's snapshot.
const SNAPSHOT_FIELD: Record<RepositoryMeasure, keyof RepositorySnapshot> = {
  stars: "stargazersCount",
  forks: "forksCount",
  watchers: "watchersCount",
  openIssues: "openIssuesCount",
};

function readStat(value: string | null): StatKey {
  return STAT_OPTIONS.some((option) => option.value === value) ? (value as StatKey) : "stars";
}

function asMeasure(stat: StatKey): RepositoryMeasure | null {
  return (MEASURES as readonly string[]).includes(stat) ? (stat as RepositoryMeasure) : null;
}

// Clone history has no Interval of its own. Month sums the days, and
// cumulative is a running total of those daily counts.
function cloneChartSeries(
  series: readonly CloneSeriesItem[],
  field: "count" | "uniques",
  interval: ReleaseDownloadGrain,
): DailySeries[] {
  return series.map((item) => {
    const daily = item.points.map((point) => ({ date: point.date, value: point[field] }));
    if (interval === "month") {
      const byMonth = new Map<string, number>();
      for (const point of daily) {
        const month = point.date.slice(0, 7);
        byMonth.set(month, (byMonth.get(month) ?? 0) + point.value);
      }
      return {
        repoId: item.repoId,
        repoName: item.repoName,
        points: [...byMonth.entries()]
          .sort((left, right) => left[0].localeCompare(right[0]))
          .map(([date, value]) => ({ date, value })),
      };
    }
    if (interval === "cumulative") {
      let running = 0;
      return {
        repoId: item.repoId,
        repoName: item.repoName,
        points: daily.map((point) => {
          running += point.value;
          return { date: point.date, value: running };
        }),
      };
    }
    return { repoId: item.repoId, repoName: item.repoName, points: daily };
  });
}

// One GitHub measure's series at one Interval. Keyed by the request alone, so
// the chart and the table share one fetch when they ask the same question
// (Stars at Daily, say). Never asked for a clone Stat, which has no measure.
function useMetricSeries(
  query: { measure: RepositoryMeasure | null; interval: ReleaseDownloadGrain } & Pick<
    StatsFilters,
    "from" | "to" | "repos"
  >,
  enabled: boolean,
): UseQueryResult<MetricSeriesResponse> {
  const getToken = useAccessToken();
  const base = productDownloadStatsBackendUrl();
  const { measure, interval, from, to, repos } = query;
  return useQuery({
    queryKey: ["product-download-stats", "metric", base, measure, from, to, interval, repos.join(",")],
    enabled,
    // The chart and the table can ask the same series a moment apart (Stars at
    // Daily, once the table has already read the day). A fresh answer is not
    // stale, so the second reader does not ask again.
    staleTime: Infinity,
    queryFn:
      measure == null
        ? skipToken
        : async () => getMetricSeries(await getToken(), { metric: measure, from, to, interval, repos }),
  });
}

export default function EngineeringRepositoryStatsPage(): JSX.Element {
  return (
    <DownloadStatsShell screen="repositoryStats">
      <RepositoryStatsScreen />
    </DownloadStatsShell>
  );
}

// Inside the shell, so it is mounted — and asks — only once the shell has let
// the reader through. The standalone's Repository Stats (ADR 0002): the filter
// bar with the product picker and the Stat and Interval selects, the chart
// card titled by the Stat, and the "Current stats" card. Products, dates, Stat
// and Interval live in the address so a shared link reproduces the view; the
// chart type and the table's mode are the reader's, for this visit.
function RepositoryStatsScreen(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const getToken = useAccessToken();
  const base = productDownloadStatsBackendUrl();
  const statLabelId = useId();

  const filters = parseFilters(params);
  const { from, to, interval, repos } = filters;
  const stat = readStat(params.get("stat"));
  const rangeInverted = from > to;

  // The active Products name the chart's series and are the table's rows.
  const repositories = useTrackedRepositories();
  const products = activeRepositories(repositories.data);

  // One clone request serves the chart's two clone Stats at every Interval
  // and the table's Clones and Unique Cloners columns.
  const clones = useQuery({
    queryKey: ["product-download-stats", "clones", base, from, to, repos.join(",")],
    enabled: !rangeInverted,
    queryFn: async () => getCloneSeries(await getToken(), { from, to, repos }),
  });
  // A GitHub measure is a series of its own; a clone Stat reads the clone
  // history instead, reshaped to the Interval.
  const measure = asMeasure(stat);
  const metric = useMetricSeries({ measure, interval, from, to, repos }, !rangeInverted);
  const chartQuery = measure == null ? clones : metric;
  const chartSeries = toChartSeries(
    measure == null
      ? cloneChartSeries(clones.data?.series ?? [], stat === "uniqueCloners" ? "uniques" : "count", interval)
      : (metric.data?.series ?? []),
    productNameById(products),
  );
  const statLabel = STAT_OPTIONS.find((option) => option.value === stat)?.label ?? "Stars";

  const onChange = (updates: FilterUpdate) =>
    setParams(applyFilterChange(params, { from, to }, updates), { replace: true });

  return (
    <Box>
      <FilterBar
        filters={filters}
        onChange={onChange}
        filterSlot={
          <>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel id={statLabelId}>Stat</InputLabel>
                <Select
                  labelId={statLabelId}
                  label="Stat"
                  value={stat}
                  onChange={(event) => onChange({ stat: event.target.value })}
                >
                  {STAT_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <IntervalSelect
                label="Interval"
                value={interval}
                onChange={(chosen) => onChange({ interval: chosen })}
              />
            </Grid>
          </>
        }
      />

      {rangeInverted ? (
        <Typography>From is after To.</Typography>
      ) : repositories.isError ? (
        // The standalone draws its empty chart here; One never presents a
        // failed request as nothing to show (docs/conventions.md).
        <ErrorState error={repositories.error} onRetry={() => void repositories.refetch()} />
      ) : (
        <>
          <ChartCard
            title={`${statLabel} over time`}
            subtitle="Repository stats and clone traffic per product"
            showTypeToggle={interval !== "month"}
            defaultVariant={interval === "month" ? "bar" : "line"}
          >
            {(variant) => (
              <SeriesChart
                variant={interval === "month" ? "bar" : variant}
                series={chartSeries}
                isLoading={repositories.isPending || chartQuery.isPending}
                isError={chartQuery.isError}
                error={chartQuery.error}
                onRetry={() => void chartQuery.refetch()}
              />
            )}
          </ChartCard>

          <CurrentStatsCard
            products={products}
            productsPending={repositories.isPending}
            filters={filters}
            clones={clones}
          />
        </>
      )}
    </Box>
  );
}

// Total, Monthly or Daily, as the "Current stats" toggles read.
type TableMode = "total" | "month" | "day";

// The day or month the table reads in Daily or Monthly mode.
interface TableDate {
  mode: "day" | "month";
  value: string;
}

// Where the table opens when its mode changes: the end of the selected range,
// so Daily and Monthly start inside the range rather than on today.
function defaultDateFor(mode: TableMode, to: string): string {
  if (mode === "day") return to;
  if (mode === "month") return to.slice(0, 7);
  return "";
}

// The points on the chosen day or in the chosen month — or every point, for
// the whole range.
function pointsIn<P extends { date: string }>(points: readonly P[], date: TableDate | null): readonly P[] {
  if (date == null) return points;
  return points.filter((point) =>
    date.mode === "day" ? point.date === date.value : point.date.startsWith(date.value),
  );
}

// A Product's figure summed from its series over the chosen day or month (or
// the range). A Product with no point for the chosen day or month — or with
// no series at all — reads 0, not a dash: the standalone reads it so, and the
// spec wants its figures reproduced oddity and all (spec: "Figures and
// states", story 71), so a disagreement always means a port error and never
// a silent fix.
function sumOf<P extends { date: string }>(
  series: readonly { repoId: number; points: P[] }[] | undefined,
  repoId: number,
  date: TableDate | null,
  valueOf: (point: P) => number,
): number {
  const item = series?.find((candidate) => candidate.repoId === repoId);
  return pointsIn(item?.points ?? [], date).reduce((sum, point) => sum + valueOf(point), 0);
}

// The table under the chart: every listed Product's Stars, Forks, Watchers,
// Open Issues, Clones and Unique Cloners. Total reads the latest GitHub counts
// and the clones over the range; Monthly and Daily read the changes on the
// chosen month or day from the daily series, which are asked for only then.
// The search narrows the rows and their pages; a Product change through the
// picker narrows them too, without forgetting the search, as on the standalone.
function CurrentStatsCard({
  products,
  productsPending,
  filters,
  clones,
}: {
  products: TrackedRepository[];
  productsPending: boolean;
  filters: StatsFilters;
  clones: UseQueryResult<CloneSeriesResponse>;
}): JSX.Element {
  const { from, to, repos } = filters;
  const [mode, setMode] = useState<TableMode>("total");
  const [pickedDate, setPickedDate] = useState("");
  const [search, setSearch] = useState("");
  // A cleared picker reads as the whole range, as on the standalone.
  const date: TableDate | null =
    mode !== "total" && pickedDate !== "" ? { mode, value: pickedDate } : null;

  const daily = mode !== "total";
  const stars = useMetricSeries({ measure: "stars", interval: "day", from, to, repos }, daily);
  const forks = useMetricSeries({ measure: "forks", interval: "day", from, to, repos }, daily);
  const watchers = useMetricSeries({ measure: "watchers", interval: "day", from, to, repos }, daily);
  const openIssues = useMetricSeries({ measure: "openIssues", interval: "day", from, to, repos }, daily);
  const measures: Record<RepositoryMeasure, UseQueryResult<MetricSeriesResponse>> = {
    stars,
    forks,
    watchers,
    openIssues,
  };

  const read = [clones, ...(daily ? Object.values(measures) : [])];
  const isLoading = productsPending || read.some((query) => query.isPending);
  const failed = read.filter((query) => query.isError);
  const retry = () => {
    for (const query of failed) void query.refetch();
  };

  const needle = search.toLowerCase();
  const listed = products.filter(
    (product) =>
      (repos.length === 0 || repos.includes(product.id)) &&
      (needle === "" || productLabel(product.productName, product.repoName).toLowerCase().includes(needle)),
  );
  const pagination = usePagination(listed);

  const figure = (product: TrackedRepository, measure: RepositoryMeasure): number =>
    date == null
      ? (product.latestSnapshot?.[SNAPSHOT_FIELD[measure]] ?? 0)
      : sumOf(measures[measure].data?.series, product.id, date, (point) => point.value);
  const cloneFigure = (product: TrackedRepository, field: "count" | "uniques"): number =>
    sumOf(clones.data?.series, product.id, date, (point) => point[field]);

  const changeMode = (next: TableMode) => {
    setMode(next);
    setPickedDate(defaultDateFor(next, to));
  };

  return (
    <Card sx={{ p: 2, mt: 2, overflowX: "auto" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Typography variant="h6" component="h3">
          Current stats
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {mode !== "total" && (
            <Box
              component="input"
              type={mode === "month" ? "month" : "date"}
              aria-label={mode === "month" ? "Month" : "Day"}
              value={pickedDate}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setPickedDate(event.target.value)}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                px: 1,
                py: 0.5,
                fontSize: "0.8rem",
                color: "text.primary",
                bgcolor: "background.paper",
                cursor: "pointer",
                outline: "none",
                "&:focus": { borderColor: "primary.main" },
              }}
            />
          )}
          <ToggleButtonGroup
            size="small"
            color="primary"
            exclusive
            value={mode}
            onChange={(_event, next: TableMode | null) => {
              if (next) changeMode(next);
            }}
          >
            <ToggleButton value="total">Total</ToggleButton>
            <ToggleButton value="month">Monthly</ToggleButton>
            <ToggleButton value="day">Daily</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {isLoading ? (
        <SkeletonRows />
      ) : failed.length > 0 ? (
        <ErrorState error={failed[0].error} onRetry={retry} minHeight={160} />
      ) : products.length === 0 ? (
        <EmptyState title="No products are tracked" minHeight={160} />
      ) : (
        <>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableHeaderSearch title="Product" noun="product" value={search} onChange={setSearch} />
                </TableCell>
                <TableCell align="right">Stars</TableCell>
                <TableCell align="right">Forks</TableCell>
                <TableCell align="right">Watchers</TableCell>
                <TableCell align="right">Open Issues</TableCell>
                <TableCell align="right">Clones</TableCell>
                <TableCell align="right">
                  <Tooltip
                    title="Unique cloners summed per day. Same person on different days counts separately."
                    placement="top"
                  >
                    <Box
                      component="span"
                      sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, cursor: "help" }}
                    >
                      Unique Cloners
                      <Info size={13} style={{ opacity: 0.5 }} />
                    </Box>
                  </Tooltip>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {listed.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ border: 0 }}>
                    <EmptyState title="No products match your search" minHeight={120} />
                  </TableCell>
                </TableRow>
              ) : (
                pagination.paged.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>{productLabel(product.productName, product.repoName)}</TableCell>
                    {MEASURES.map((measure) => (
                      <TableCell key={measure} align="right">
                        {formatCompact(figure(product, measure))}
                      </TableCell>
                    ))}
                    <TableCell align="right">{formatCompact(cloneFigure(product, "count"))}</TableCell>
                    <TableCell align="right">{formatCompact(cloneFigure(product, "uniques"))}</TableCell>
                  </TableRow>
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
