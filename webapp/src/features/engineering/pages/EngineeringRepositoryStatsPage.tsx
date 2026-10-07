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

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  Box,
  Card,
  CircularProgress,
  ListingTable,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@wso2/oxygen-ui";
import { Bar, BarChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useState, type JSX } from "react";
import { useSearchParams } from "react-router";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useAccessToken } from "@hooks/useAccessToken";
import {
  dailyRange,
  getCloneSeries,
  getMetricSeries,
  getRepositories,
  productDownloadStatsBackendUrl,
  type CloneSeriesItem,
  type DailySeries,
  type ReleaseDownloadGrain,
  type RepositoryMeasure,
  type RepositorySnapshot,
} from "@features/engineering/api/productDownloadStats";
import DownloadStatsShell from "../components/DownloadStatsShell";
import { dailyChartModel } from "./dailyChartModel";
import { formatCount, productLabel } from "./display";

type StatKey = RepositoryMeasure | "clones" | "uniqueCloners";
type TableMode = "total" | "month" | "day";

const STAT_OPTIONS: ReadonlyArray<{ value: StatKey; label: string }> = [
  { value: "stars", label: "Stars" },
  { value: "forks", label: "Forks" },
  { value: "watchers", label: "Watchers" },
  { value: "openIssues", label: "Open Issues" },
  { value: "clones", label: "Total Clones" },
  { value: "uniqueCloners", label: "Unique Cloners" },
];

const GITHUB_MEASURES: readonly RepositoryMeasure[] = ["stars", "forks", "watchers", "openIssues"];

function readGrain(value: string | null): ReleaseDownloadGrain {
  if (value === "month" || value === "cumulative") return value;
  return "day";
}

function readStat(value: string | null): StatKey {
  return STAT_OPTIONS.some((option) => option.value === value) ? (value as StatKey) : "stars";
}

function readRepos(value: string | null): number[] {
  return (value ?? "")
    .split(",")
    .map((part) => Number(part))
    .filter((id) => Number.isInteger(id) && id > 0);
}

const MISSING = "—";

function tableCaption(mode: TableMode, date: string): string {
  if (mode === "day" && date !== "") return `Change on ${date}`;
  if (mode === "month" && date !== "") return `Change in ${date}`;
  if (mode === "day") return "Change on the selected day";
  if (mode === "month") return "Change in the selected month";
  return "Latest counts; clones over the range";
}

function latestActivityDate(
  metricSeries: readonly (readonly DailySeries[] | undefined)[],
  clones: readonly CloneSeriesItem[] | undefined,
): string | null {
  let latest: string | null = null;
  for (const series of metricSeries) {
    for (const item of series ?? []) {
      for (const point of item.points) {
        if (latest == null || point.date > latest) latest = point.date;
      }
    }
  }
  for (const item of clones ?? []) {
    for (const point of item.points) {
      if (latest == null || point.date > latest) latest = point.date;
    }
  }
  return latest;
}

function isGithubMeasure(stat: StatKey): stat is RepositoryMeasure {
  return (GITHUB_MEASURES as readonly string[]).includes(stat);
}

// Total uses the latest snapshot. Day and month read the daily change series:
// a month is the sum of that month's changes, not the last day's change.
function changeAt(
  series: readonly DailySeries[] | undefined,
  repoId: number,
  mode: TableMode,
  date: string,
): number | null {
  if (mode === "total" || series == null || date === "") return null;
  const item = series.find((candidate) => candidate.repoId === repoId);
  if (!item) return null;
  if (mode === "day") {
    return item.points.find((point) => point.date === date)?.value ?? null;
  }
  const points = item.points.filter((point) => point.date.startsWith(date));
  if (points.length === 0) return null;
  return points.reduce((sum, point) => sum + point.value, 0);
}

function snapshotCount(
  snapshot: RepositorySnapshot | null | undefined,
  field: keyof RepositorySnapshot,
): number {
  return snapshot?.[field] ?? 0;
}

function cloneFigure(
  series: readonly CloneSeriesItem[] | null,
  repoId: number,
  mode: TableMode,
  date: string,
  field: "count" | "uniques",
): number | null {
  if (series == null) return null;
  const item = series.find((candidate) => candidate.repoId === repoId);
  if (mode === "total") {
    return (item?.points ?? []).reduce((sum, point) => sum + point[field], 0);
  }
  if (item == null || date === "") return null;
  const points =
    mode === "day"
      ? item.points.filter((point) => point.date === date)
      : item.points.filter((point) => point.date.startsWith(date));
  if (points.length === 0) return null;
  return points.reduce((sum, point) => sum + point[field], 0);
}

function showCount(value: number | null): string {
  return value == null ? MISSING : formatCount(value);
}

// Clone history has no grain of its own. Month sums the days, and cumulative
// is a running total of those daily counts.
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

export default function EngineeringRepositoryStatsPage(): JSX.Element {
  return (
    <DownloadStatsShell screen="repositoryStats">
      <RepositoryStatsScreen />
    </DownloadStatsShell>
  );
}

/** Inside the shell, so it is mounted — and asks — only once the shell has let the reader through. */
function RepositoryStatsScreen(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const getToken = useAccessToken();
  const base = productDownloadStatsBackendUrl();
  const defaults = dailyRange();
  const from = params.get("from") || defaults.from;
  const to = params.get("to") || defaults.to;
  const interval = readGrain(params.get("interval"));
  const stat = readStat(params.get("stat"));
  const repos = readRepos(params.get("repos"));
  const rangeInverted = from > to;
  const queryEnabled = !rangeInverted;
  const repoKey = repos.join(",");
  const [tableMode, setTableMode] = useState<TableMode>("total");
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [chart, setChart] = useState<"line" | "bar">("line");

  const repositories = useQuery({
    queryKey: ["product-download-stats", "repositories", base],
    queryFn: async () => getRepositories(await getToken()),
  });
  const clones = useQuery({
    queryKey: ["product-download-stats", "clones", base, from, to, repoKey],
    enabled: queryEnabled,
    queryFn: async () => getCloneSeries(await getToken(), { from, to, repos }),
  });
  const chartMeasure = isGithubMeasure(stat) ? stat : null;
  const metric = useQuery({
    queryKey: ["product-download-stats", "metric", base, chartMeasure, from, to, interval, repoKey],
    enabled: queryEnabled && chartMeasure != null,
    queryFn: async () => {
      if (chartMeasure == null) throw new Error("Repository stats has no GitHub measure");
      return getMetricSeries(await getToken(), { metric: chartMeasure, from, to, interval, repos });
    },
  });
  const dailyTable = tableMode !== "total";
  const dayEnabled = (measure: RepositoryMeasure) =>
    queryEnabled && dailyTable && !(interval === "day" && chartMeasure === measure);
  const starsTable = useDayMetric("stars", { base, from, to, repoKey, repos, enabled: dayEnabled("stars"), getToken });
  const forksTable = useDayMetric("forks", { base, from, to, repoKey, repos, enabled: dayEnabled("forks"), getToken });
  const watchersTable = useDayMetric("watchers", { base, from, to, repoKey, repos, enabled: dayEnabled("watchers"), getToken });
  const issuesTable = useDayMetric("openIssues", { base, from, to, repoKey, repos, enabled: dayEnabled("openIssues"), getToken });

  const replace = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    if (!params.get("from")) next.set("from", from);
    if (!params.get("to")) next.set("to", to);
    for (const [key, value] of Object.entries(updates)) {
      if ((key === "from" || key === "to") && (value == null || value === "")) continue;
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  };

  const active = (repositories.data?.repositories ?? []).filter(
    (repository) => repository.isActive !== false,
  );
  const names = new Map(
    active.map((repository) => [repository.id, productLabel(repository.productName, repository.repoName)]),
  );
  const listed = active.filter((repository) => {
    if (repos.length > 0 && !repos.includes(repository.id)) return false;
    const label = productLabel(repository.productName, repository.repoName);
    return productSearch === "" || label.toLowerCase().includes(productSearch.toLowerCase());
  });

  const daySeries = (measure: RepositoryMeasure, query: UseQueryResult<{ series: DailySeries[] }, Error>) =>
    interval === "day" && chartMeasure === measure ? metric.data?.series : query.data?.series;
  const starsSeries = daySeries("stars", starsTable);
  const forksSeries = daySeries("forks", forksTable);
  const watchersSeries = daySeries("watchers", watchersTable);
  const issuesSeries = daySeries("openIssues", issuesTable);
  const latest = latestActivityDate(
    [starsSeries, forksSeries, watchersSeries, issuesSeries],
    clones.data?.series,
  );
  const tableDate =
    tableMode === "total"
      ? ""
      : pickedDate !== null
        ? pickedDate
        : latest == null
          ? ""
          : tableMode === "month"
            ? latest.slice(0, 7)
            : latest;

  const chartPending = chartMeasure == null ? clones.isPending : metric.isPending;
  const chartFailed =
    chartMeasure == null ? clones.isError || clones.data == null : metric.isError || metric.data == null;
  const tableQueries = [starsTable, forksTable, watchersTable, issuesTable];
  const tableLoading = clones.isLoading || tableQueries.some((query) => query.isLoading);
  const dailyError =
    tableMode === "total" ? undefined : tableQueries.find((query) => query.error != null)?.error;
  const tableError = chartMeasure != null && clones.error != null ? clones.error : dailyError;
  const chartError = chartMeasure == null ? clones.error : metric.error;

  const refetchIfFetched = (query: { isFetched: boolean; isFetching: boolean; refetch: () => Promise<unknown> }) => {
    if (query.isFetched || query.isFetching) void query.refetch();
  };
  const retryChart = () => {
    void repositories.refetch();
    if (chartMeasure == null) void clones.refetch();
    else void metric.refetch();
  };
  const retryTable = () => {
    void clones.refetch();
    for (const query of tableQueries) refetchIfFetched(query);
  };

  const chartSeries =
    chartMeasure == null
      ? cloneChartSeries(clones.data?.series ?? [], stat === "uniqueCloners" ? "uniques" : "count", interval)
      : (metric.data?.series ?? []);
  const label = STAT_OPTIONS.find((option) => option.value === stat)?.label ?? "Stars";
  const cloneSeries = clones.data == null ? null : clones.data.series;

  return (
    <Box>
      <Typography>
        Unique cloners are summed per day and the same person on different days counts separately.
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ my: 2, flexWrap: "wrap" }}>
        <TextField
          label="From"
          type="date"
          size="small"
          value={from}
          onChange={(event) => replace({ from: event.target.value })}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="To"
          type="date"
          size="small"
          value={to}
          onChange={(event) => replace({ to: event.target.value })}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Select
          size="small"
          inputProps={{ "aria-label": "Measure" }}
          value={stat}
          onChange={(event) => replace({ stat: event.target.value })}
        >
          {STAT_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
        <Select
          size="small"
          inputProps={{ "aria-label": "Grain" }}
          value={interval}
          onChange={(event) => replace({ interval: event.target.value })}
        >
          <MenuItem value="day">Daily</MenuItem>
          <MenuItem value="month">Monthly</MenuItem>
          <MenuItem value="cumulative">Cumulative</MenuItem>
        </Select>
        <Select
          size="small"
          multiple
          displayEmpty
          inputProps={{ "aria-label": "Products" }}
          value={repos.map(String)}
          onChange={(event) => {
            const value = event.target.value;
            const selected = (typeof value === "string" ? value.split(",") : value).filter(Boolean);
            replace({ repos: selected.length > 0 ? selected.join(",") : null });
          }}
          renderValue={(selected) =>
            selected.length === 0 ? "All products" : `${selected.length} selected`
          }
        >
          {active.map((repository) => (
            <MenuItem key={repository.id} value={String(repository.id)}>
              {productLabel(repository.productName, repository.repoName)}
            </MenuItem>
          ))}
        </Select>
        {interval !== "month" && (
          <ToggleButtonGroup
            exclusive
            size="small"
            aria-label="Chart type"
            value={chart}
            onChange={(_event, value: "line" | "bar" | null) => {
              if (value) setChart(value);
            }}
          >
            <ToggleButton value="line">Line</ToggleButton>
            <ToggleButton value="bar">Bars</ToggleButton>
          </ToggleButtonGroup>
        )}
      </Stack>

      {rangeInverted ? (
        <Typography>From is after To.</Typography>
      ) : repositories.isPending ? (
        <Loading label="Loading products…" />
      ) : repositories.isError || repositories.data == null ? (
        <ErrorNotice onRetry={() => void repositories.refetch()} error={repositories.error}>
          Couldn't load products.
        </ErrorNotice>
      ) : (
        <>
          {chartPending ? (
            <Loading label="Loading repository stats…" />
          ) : chartFailed ? (
            <ErrorNotice onRetry={retryChart} error={chartError}>
              Couldn't load repository stats.
            </ErrorNotice>
          ) : chartSeries.every((item) => item.points.length === 0) ? (
            <Typography>No data for the selected range</Typography>
          ) : (
            <StatsChart
              series={chartSeries}
              names={names}
              interval={interval}
              chart={chart}
              title={`${label} over time`}
            />
          )}
          <Card sx={{ p: 2, mt: 2 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{ mb: 2, justifyContent: "space-between", alignItems: { sm: "center" } }}
            >
              <Typography component="h2" variant="h6">
                {tableCaption(tableMode, tableDate)}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                {tableMode !== "total" && (
                  <TextField
                    label={tableMode === "month" ? "Month" : "Day"}
                    type={tableMode === "month" ? "month" : "date"}
                    size="small"
                    value={tableDate}
                    onChange={(event) => setPickedDate(event.target.value)}
                    slotProps={{
                      inputLabel: { shrink: true },
                      htmlInput: {
                        min: tableMode === "month" ? from.slice(0, 7) : from,
                        max: tableMode === "month" ? to.slice(0, 7) : to,
                      },
                    }}
                  />
                )}
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  aria-label="Table range"
                  value={tableMode}
                  onChange={(_event, value: TableMode | null) => {
                    if (!value) return;
                    setTableMode(value);
                    setPickedDate(null);
                  }}
                >
                  <ToggleButton value="total">Total</ToggleButton>
                  <ToggleButton value="month">Monthly</ToggleButton>
                  <ToggleButton value="day">Daily</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            </Stack>
            {tableLoading ? (
              <Loading label="Loading repository stats…" />
            ) : !chartFailed && tableError != null ? (
              <ErrorNotice onRetry={retryTable} error={tableError}>
                Couldn't load repository stats.
              </ErrorNotice>
            ) : active.length === 0 ? null : (
              <ListingTable.Provider searchValue={productSearch} onSearchChange={setProductSearch}>
                <ListingTable.Container>
                  <ListingTable.Toolbar showSearch searchPlaceholder="Search products" />
                  {listed.length === 0 ? (
                    <Typography>No products match your search</Typography>
                  ) : (
                  <ListingTable bordered>
                    <ListingTable.Head>
                      <ListingTable.Row>
                        <ListingTable.Cell>Product</ListingTable.Cell>
                        <ListingTable.Cell align="right">Stars</ListingTable.Cell>
                        <ListingTable.Cell align="right">Forks</ListingTable.Cell>
                        <ListingTable.Cell align="right">Watchers</ListingTable.Cell>
                        <ListingTable.Cell align="right">Open Issues</ListingTable.Cell>
                        <ListingTable.Cell align="right">Clones</ListingTable.Cell>
                        <ListingTable.Cell align="right">Unique Cloners</ListingTable.Cell>
                      </ListingTable.Row>
                    </ListingTable.Head>
                    <ListingTable.Body>
                      {listed.map((repository) => {
                        const snapshot = repository.latestSnapshot;
                        const stars =
                          tableMode === "total"
                            ? snapshotCount(snapshot, "stargazersCount")
                            : changeAt(starsSeries, repository.id, tableMode, tableDate);
                        const forks =
                          tableMode === "total"
                            ? snapshotCount(snapshot, "forksCount")
                            : changeAt(forksSeries, repository.id, tableMode, tableDate);
                        const watchers =
                          tableMode === "total"
                            ? snapshotCount(snapshot, "watchersCount")
                            : changeAt(watchersSeries, repository.id, tableMode, tableDate);
                        const issues =
                          tableMode === "total"
                            ? snapshotCount(snapshot, "openIssuesCount")
                            : changeAt(issuesSeries, repository.id, tableMode, tableDate);
                        return (
                          <ListingTable.Row key={repository.id}>
                            <ListingTable.Cell>
                              {productLabel(repository.productName, repository.repoName)}
                            </ListingTable.Cell>
                            <ListingTable.Cell align="right">{showCount(stars)}</ListingTable.Cell>
                            <ListingTable.Cell align="right">{showCount(forks)}</ListingTable.Cell>
                            <ListingTable.Cell align="right">{showCount(watchers)}</ListingTable.Cell>
                            <ListingTable.Cell align="right">{showCount(issues)}</ListingTable.Cell>
                            <ListingTable.Cell align="right">
                              {showCount(cloneFigure(cloneSeries, repository.id, tableMode, tableDate, "count"))}
                            </ListingTable.Cell>
                            <ListingTable.Cell align="right">
                              {showCount(cloneFigure(cloneSeries, repository.id, tableMode, tableDate, "uniques"))}
                            </ListingTable.Cell>
                          </ListingTable.Row>
                        );
                      })}
                    </ListingTable.Body>
                  </ListingTable>
                  )}
                </ListingTable.Container>
              </ListingTable.Provider>
            )}
          </Card>
        </>
      )}
    </Box>
  );
}

function useDayMetric(
  metric: RepositoryMeasure,
  args: {
    base: string;
    from: string;
    to: string;
    repoKey: string;
    repos: number[];
    enabled: boolean;
    getToken: () => Promise<string>;
  },
): UseQueryResult<{ series: DailySeries[] }, Error> {
  return useQuery({
    queryKey: ["product-download-stats", "metric", "day", args.base, metric, args.from, args.to, args.repoKey],
    enabled: args.enabled,
    queryFn: async () =>
      getMetricSeries(await args.getToken(), {
        metric,
        from: args.from,
        to: args.to,
        interval: "day",
        repos: args.repos,
      }),
  });
}

function Loading({ label }: { label: string }): JSX.Element {
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
      <CircularProgress size={16} />
      <Typography>{label}</Typography>
    </Stack>
  );
}

function StatsChart({
  series,
  names,
  interval,
  chart,
  title,
}: {
  series: DailySeries[];
  names: Map<number, string>;
  interval: ReleaseDownloadGrain;
  chart: "line" | "bar";
  title: string;
}): JSX.Element {
  // Plot only the dates the API returned. Filling the calendar would add days
  // the series never had and break the line between real points.
  const { data, lines } = dailyChartModel(series, names, { from: "", to: "" });
  const bars = interval === "month" || chart === "bar";
  return (
    <Box>
      <Typography component="h2" variant="h6">
        {title}
      </Typography>
      <Box sx={{ width: "100%", height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          {bars ? (
            <BarChart data={data}>
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value: number) => formatCount(value)} />
              <Tooltip />
              <Legend />
              {lines.map((line) => (
                <Bar key={line.repoId} name={line.name} dataKey={line.dataKey} fill={line.stroke} />
              ))}
            </BarChart>
          ) : (
            <LineChart data={data}>
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value: number) => formatCount(value)} />
              <Tooltip />
              <Legend />
              {lines.map((line) => (
                <Line
                  key={line.repoId}
                  name={line.name}
                  type="monotone"
                  dataKey={line.dataKey}
                  stroke={line.stroke}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}
