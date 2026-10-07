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
  Button,
  Card,
  CircularProgress,
  ListingTable,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { Bar, BarChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useAccessToken } from "@hooks/useAccessToken";
import {
  getPackageBreakdown,
  getPackageProducts,
  getPackageSeries,
  getPackageVersions,
  productDownloadStatsBackendUrl,
  type PackageBreakdownItem,
  type PackageSeriesItem,
  type ReleaseDownloadGrain,
} from "@features/engineering/api/productDownloadStats";
import DownloadStatsShell from "../components/DownloadStatsShell";
import { defaultRange } from "../utils/filters";
import { formatCompact, productLabel } from "../utils/format";
import { seriesStroke } from "./dailyChartModel";

const CHART_LIMIT = 5;

function readGrain(value: string | null): ReleaseDownloadGrain {
  if (value === "month" || value === "cumulative") return value;
  return "day";
}

function downloadsOf(
  item: { periodDownloads: number; totalDownloads: number },
  interval: ReleaseDownloadGrain,
): number {
  return interval === "cumulative" ? item.totalDownloads : item.periodDownloads;
}

function byActivity(a: PackageBreakdownItem, b: PackageBreakdownItem): number {
  if (a.periodDownloads !== b.periodDownloads) return b.periodDownloads - a.periodDownloads;
  if (a.totalDownloads !== b.totalDownloads) return b.totalDownloads - a.totalDownloads;
  return a.packageName.localeCompare(b.packageName);
}

export default function EngineeringPackagesPage(): JSX.Element {
  return (
    <DownloadStatsShell screen="packages">
      <PackagesScreen />
    </DownloadStatsShell>
  );
}

/** Inside the shell, so it is mounted — and asks — only once the shell has let the reader through. */
function PackagesScreen(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const getToken = useAccessToken();
  const base = productDownloadStatsBackendUrl();
  const defaults = defaultRange();
  const from = params.get("from") || defaults.from;
  const to = params.get("to") || defaults.to;
  const interval = readGrain(params.get("interval"));
  const [selection, setSelection] = useState<{
    repoId: number;
    packageName: string | null;
    chart: string[] | null;
  }>({ repoId: -1, packageName: null, chart: null });

  const products = useQuery({
    queryKey: ["product-download-stats", "package-products", base],
    queryFn: async () => getPackageProducts(await getToken()),
  });
  const offered = products.data?.repos ?? [];
  const requested = Number(params.get("repo"));
  const requestedIsOffered = offered.some((product) => product.repoId === requested);
  const firstId = offered[0]?.repoId;
  const repoId = requestedIsOffered ? requested : (firstId ?? 0);
  const rangeInverted = from > to;
  const selectionReady = selection.repoId === repoId;
  if (!selectionReady) {
    setSelection({ repoId, packageName: null, chart: null });
  }
  const packageForRepo = selectionReady ? selection.packageName : null;
  const chartForRepo = selectionReady ? selection.chart : null;

  const breakdown = useQuery({
    queryKey: ["product-download-stats", "packages", base, repoId, from, to],
    enabled: repoId > 0 && !rangeInverted,
    queryFn: async () => getPackageBreakdown(await getToken(), { repoId, from, to }),
  });
  const series = useQuery({
    queryKey: ["product-download-stats", "package-series", base, repoId, from, to, interval],
    enabled: repoId > 0 && !rangeInverted,
    queryFn: async () => getPackageSeries(await getToken(), { repoId, from, to, interval }),
  });
  const versions = useQuery({
    queryKey: ["product-download-stats", "package-versions", base, repoId, from, to, packageForRepo],
    enabled: selectionReady && repoId > 0 && packageForRepo != null && !rangeInverted,
    queryFn: async () =>
      getPackageVersions(await getToken(), {
        repoId,
        from,
        to,
        packageName: packageForRepo ?? "",
      }),
  });

  useEffect(() => {
    if (!products.isSuccess || firstId == null || requestedIsOffered) return;
    const next = new URLSearchParams(params);
    next.set("repo", String(firstId));
    setParams(next, { replace: true });
  }, [products.isSuccess, params, firstId, requestedIsOffered, setParams]);

  const replace = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    if (!params.get("from")) next.set("from", from);
    if (!params.get("to")) next.set("to", to);
    if (repoId > 0 && !params.get("repo")) next.set("repo", String(repoId));
    for (const [key, value] of Object.entries(updates)) {
      if ((key === "from" || key === "to") && (value == null || value === "")) continue;
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  };

  const rows = [...(breakdown.data?.packages ?? [])].sort(byActivity);
  const matched =
    chartForRepo == null || chartForRepo.length === 0
      ? []
      : rows.filter((item) => chartForRepo.includes(item.packageName));
  const chartRows =
    chartForRepo == null || (chartForRepo.length > 0 && matched.length === 0)
      ? rows.slice(0, CHART_LIMIT)
      : chartForRepo.length === 0
        ? rows
        : matched;
  const chartNames = new Set(chartRows.map((item) => item.packageName));
  const chartSeries = (series.data?.series ?? []).filter((item) => chartNames.has(item.packageName));

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2, flexWrap: "wrap" }}>
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
          inputProps={{ "aria-label": "Product" }}
          value={repoId > 0 ? String(repoId) : ""}
          onChange={(event) => {
            replace({ repo: event.target.value });
          }}
        >
          {offered.map((product) => (
            <MenuItem key={product.repoId} value={String(product.repoId)}>
              {productLabel(product.productName, product.repoName)}
            </MenuItem>
          ))}
        </Select>
        <Select
          size="small"
          multiple
          displayEmpty
          inputProps={{ "aria-label": "Chart packages" }}
          value={chartForRepo ?? chartRows.map((item) => item.packageName)}
          onChange={(event) => {
            const value = event.target.value;
            setSelection((current) => ({
              ...current,
              chart: typeof value === "string" ? value.split(",") : value,
            }));
          }}
          renderValue={(selected) =>
            chartForRepo == null
              ? "5 most active"
              : selected.length === 0
                ? "All packages"
                : `${selected.length} selected`
          }
        >
          {rows.map((item) => (
            <MenuItem key={item.packageName} value={item.packageName}>
              {item.packageName}
            </MenuItem>
          ))}
        </Select>
        <Button size="small" onClick={() => setSelection((current) => ({ ...current, chart: [] }))}>
          Every package
        </Button>
      </Stack>

      {products.isError ? (
        <ErrorNotice onRetry={() => void products.refetch()} error={products.error}>
          Couldn't load products.
        </ErrorNotice>
      ) : products.isSuccess && offered.length === 0 ? (
        <Typography>No products have package downloads</Typography>
      ) : rangeInverted ? (
        <Typography>From is after To.</Typography>
      ) : breakdown.isPending || series.isPending ? (
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <CircularProgress size={16} />
          <Typography>Loading package downloads…</Typography>
        </Stack>
      ) : breakdown.isError || series.isError ? (
        <ErrorNotice
          onRetry={() => {
            void breakdown.refetch();
            void series.refetch();
          }}
          error={breakdown.error ?? series.error}
        >
          Couldn't load package downloads.
        </ErrorNotice>
      ) : rows.length === 0 ? (
        <Typography>No packages in the selected range</Typography>
      ) : (
        <>
          <PackageChart series={chartSeries} bars={interval === "month"} />
          <Card sx={{ p: 2, mt: 2 }}>
            <ListingTable.Provider>
              <ListingTable.Container>
                <ListingTable bordered>
                  <ListingTable.Head>
                    <ListingTable.Row>
                      <ListingTable.Cell>Package</ListingTable.Cell>
                      <ListingTable.Cell align="right">Downloads</ListingTable.Cell>
                    </ListingTable.Row>
                  </ListingTable.Head>
                  <ListingTable.Body>
                    {rows.map((item) => (
                      <ListingTable.Row key={item.packageName}>
                        <ListingTable.Cell>
                          <Button
                            size="small"
                            onClick={() =>
                              setSelection((current) => ({ ...current, packageName: item.packageName }))
                            }
                          >
                            {item.packageName}
                          </Button>
                        </ListingTable.Cell>
                        <ListingTable.Cell align="right">
                          {formatCompact(downloadsOf(item, interval))}
                        </ListingTable.Cell>
                      </ListingTable.Row>
                    ))}
                  </ListingTable.Body>
                </ListingTable>
              </ListingTable.Container>
            </ListingTable.Provider>
          </Card>
          {selectionReady && packageForRepo != null && (
            <Card sx={{ p: 2, mt: 2 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
                <Typography component="h2" variant="h6">
                  Versions of {packageForRepo}
                </Typography>
                <Button
                  size="small"
                  onClick={() => setSelection((current) => ({ ...current, packageName: null }))}
                >
                  Clear package
                </Button>
              </Stack>
              {versions.isPending ? (
                <Typography>Loading package versions…</Typography>
              ) : versions.isError ? (
                <ErrorNotice onRetry={() => void versions.refetch()} error={versions.error}>
                  Couldn't load package versions.
                </ErrorNotice>
              ) : (versions.data?.versions.length ?? 0) === 0 ? (
                <Typography>No versions in the selected range</Typography>
              ) : (
                <ListingTable.Provider>
                  <ListingTable.Container>
                    <ListingTable bordered>
                      <ListingTable.Head>
                        <ListingTable.Row>
                          <ListingTable.Cell>Version</ListingTable.Cell>
                          <ListingTable.Cell align="right">Downloads</ListingTable.Cell>
                        </ListingTable.Row>
                      </ListingTable.Head>
                      <ListingTable.Body>
                        {versions.data?.versions.map((version) => (
                          <ListingTable.Row key={version.versionId}>
                            <ListingTable.Cell>{version.tags ?? String(version.versionId)}</ListingTable.Cell>
                            <ListingTable.Cell align="right">
                              {formatCompact(downloadsOf(version, interval))}
                            </ListingTable.Cell>
                          </ListingTable.Row>
                        ))}
                      </ListingTable.Body>
                    </ListingTable>
                  </ListingTable.Container>
                </ListingTable.Provider>
              )}
            </Card>
          )}
        </>
      )}
    </Box>
  );
}

function PackageChart({
  series,
  bars,
}: {
  series: readonly PackageSeriesItem[];
  bars: boolean;
}): JSX.Element {
  const dates = [...new Set(series.flatMap((item) => item.points.map((point) => point.date)))].sort();
  const data = dates.map((date) => {
    const row: Record<string, string | number | null> = { date };
    series.forEach((item, index) => {
      row[`pkg-${index}`] = item.points.find((point) => point.date === date)?.value ?? null;
    });
    return row;
  });
  const lines = series.map((item, index) => ({
    key: `pkg-${index}`,
    name: item.packageName,
    stroke: seriesStroke(index),
  }));
  return (
    <Box sx={{ width: "100%", height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        {bars ? (
          <BarChart data={data}>
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            {lines.map((line) => (
              <Bar key={line.key} name={line.name} dataKey={line.key} fill={line.stroke} />
            ))}
          </BarChart>
        ) : (
          <LineChart data={data}>
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            {lines.map((line) => (
              <Line
                key={line.key}
                name={line.name}
                dataKey={line.key}
                type="monotone"
                stroke={line.stroke}
                dot={{ r: 3 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </Box>
  );
}
