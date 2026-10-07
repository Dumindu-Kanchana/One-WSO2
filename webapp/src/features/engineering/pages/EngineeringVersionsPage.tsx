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
  getReleaseFiles,
  getRepositories,
  getVersionSeries,
  productDownloadStatsBackendUrl,
  type ReleaseDownloadGrain,
  type VersionSeriesItem,
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

function releaseName(item: VersionSeriesItem): string {
  return item.releaseName && item.releaseName.trim() !== "" ? item.releaseName : item.releaseTag;
}

function releaseTotal(item: VersionSeriesItem, interval: ReleaseDownloadGrain): number {
  if (item.points.length === 0) return 0;
  if (interval === "cumulative") {
    const latest = [...item.points].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
    return latest?.value ?? 0;
  }
  return item.points.reduce((sum, point) => sum + point.value, 0);
}

function shareLabel(part: number, whole: number): string {
  if (whole <= 0) return "0.0%";
  return `${((part / whole) * 100).toFixed(1)}%`;
}

function mostRecent(series: readonly VersionSeriesItem[], limit: number): VersionSeriesItem[] {
  return [...series]
    .sort((a, b) => b.releaseTag.localeCompare(a.releaseTag, undefined, { numeric: true }))
    .slice(0, limit);
}

export default function EngineeringVersionsPage(): JSX.Element {
  return (
    <DownloadStatsShell screen="versions">
      <VersionsScreen />
    </DownloadStatsShell>
  );
}

/** Inside the shell, so it is mounted — and asks — only once the shell has let the reader through. */
function VersionsScreen(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const getToken = useAccessToken();
  const base = productDownloadStatsBackendUrl();
  const defaults = defaultRange();
  const from = params.get("from") || defaults.from;
  const to = params.get("to") || defaults.to;
  const interval = readGrain(params.get("interval"));
  const [release, setRelease] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string[] | null>(null);
  const [search, setSearch] = useState("");

  const repositories = useQuery({
    queryKey: ["product-download-stats", "repositories", base],
    queryFn: async () => getRepositories(await getToken()),
  });
  const active = (repositories.data?.repositories ?? []).filter(
    (repository) => repository.isActive !== false,
  );
  const requested = Number(params.get("repo"));
  const requestedIsActive = active.some((repository) => repository.id === requested);
  const firstId = active[0]?.id;
  const repoId = requestedIsActive ? requested : (firstId ?? 0);
  const rangeInverted = from > to;

  const versions = useQuery({
    queryKey: ["product-download-stats", "versions", base, repoId, from, to, interval],
    enabled: repoId > 0 && !rangeInverted,
    queryFn: async () => getVersionSeries(await getToken(), { repoId, from, to, interval }),
  });
  const files = useQuery({
    queryKey: ["product-download-stats", "assets", base, repoId, from, to, release],
    enabled: repoId > 0 && release != null && !rangeInverted,
    queryFn: async () =>
      getReleaseFiles(await getToken(), { repoId, from, to, version: release ?? "" }),
  });

  const firstReady = repositories.isSuccess;
  useEffect(() => {
    if (!firstReady || firstId == null || requestedIsActive) return;
    const next = new URLSearchParams(params);
    next.set("repo", String(firstId));
    setParams(next, { replace: true });
  }, [firstReady, params, firstId, requestedIsActive, setParams]);

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

  const series = versions.data?.series ?? [];
  const matched =
    chosen == null || chosen.length === 0
      ? []
      : series.filter((item) => chosen.includes(item.releaseTag));
  const chartSeries =
    chosen == null || (chosen.length > 0 && matched.length === 0)
      ? mostRecent(series, CHART_LIMIT)
      : chosen.length === 0
        ? series
        : matched;
  const rows = [...series].sort((a, b) => releaseTotal(b, interval) - releaseTotal(a, interval));
  const whole = rows.reduce((sum, item) => sum + releaseTotal(item, interval), 0);
  const needle = search.trim().toLowerCase();
  const visibleRows = needle
    ? rows.filter((item) => releaseName(item).toLowerCase().includes(needle) || item.releaseTag.toLowerCase().includes(needle))
    : rows;

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
            setRelease(null);
            setChosen(null);
            setSearch("");
            replace({ repo: event.target.value });
          }}
        >
          {active.map((repository) => (
            <MenuItem key={repository.id} value={String(repository.id)}>
              {productLabel(repository.productName, repository.repoName)}
            </MenuItem>
          ))}
        </Select>
        <Select
          size="small"
          multiple
          displayEmpty
          inputProps={{ "aria-label": "Chart releases" }}
          value={chosen ?? chartSeries.map((item) => item.releaseTag)}
          onChange={(event) => {
            const value = event.target.value;
            const selected = typeof value === "string" ? value.split(",") : value;
            setChosen(selected);
          }}
          renderValue={(selected) =>
            chosen == null
              ? "5 most recent"
              : selected.length === 0
                ? "All releases"
                : `${selected.length} selected`
          }
        >
          {mostRecent(series, series.length).map((item) => (
            <MenuItem key={item.releaseTag} value={item.releaseTag}>
              {releaseName(item)}
            </MenuItem>
          ))}
        </Select>
        <Button size="small" onClick={() => setChosen([])}>
          Every release
        </Button>
        <TextField
          label="Search releases"
          size="small"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </Stack>

      {rangeInverted ? (
        <Typography>From is after To.</Typography>
      ) : repositories.isError ? (
        <ErrorNotice onRetry={() => void repositories.refetch()} error={repositories.error}>
          Couldn't load products.
        </ErrorNotice>
      ) : repositories.isSuccess && repoId === 0 ? (
        <Typography>No products are tracked</Typography>
      ) : versions.isPending ? (
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <CircularProgress size={16} />
          <Typography>Loading releases…</Typography>
        </Stack>
      ) : versions.isError || versions.data == null ? (
        <ErrorNotice onRetry={() => void versions.refetch()} error={versions.error}>
          Couldn't load releases.
        </ErrorNotice>
      ) : series.length === 0 ? (
        <Typography>No releases in the selected range</Typography>
      ) : (
        <>
          <VersionChart series={chartSeries} bars={interval === "month"} />
          <Card sx={{ p: 2, mt: 2 }}>
            <ListingTable.Provider>
              <ListingTable.Container>
                <ListingTable bordered>
                  <ListingTable.Head>
                    <ListingTable.Row>
                      <ListingTable.Cell>Release</ListingTable.Cell>
                      <ListingTable.Cell align="right">Downloads</ListingTable.Cell>
                      <ListingTable.Cell align="right">Share</ListingTable.Cell>
                    </ListingTable.Row>
                  </ListingTable.Head>
                  <ListingTable.Body>
                    {visibleRows.map((item) => (
                      <ListingTable.Row key={item.releaseTag}>
                        <ListingTable.Cell>
                          <Button size="small" onClick={() => setRelease(item.releaseTag)}>
                            {releaseName(item)}
                          </Button>
                        </ListingTable.Cell>
                        <ListingTable.Cell align="right">{formatCompact(releaseTotal(item, interval))}</ListingTable.Cell>
                        <ListingTable.Cell align="right">
                          {shareLabel(releaseTotal(item, interval), whole)}
                        </ListingTable.Cell>
                      </ListingTable.Row>
                    ))}
                  </ListingTable.Body>
                </ListingTable>
              </ListingTable.Container>
            </ListingTable.Provider>
          </Card>
          {release != null && (
            <Card sx={{ p: 2, mt: 2 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
                <Typography component="h2" variant="h6">
                  Files in {release}
                </Typography>
                <Button size="small" onClick={() => setRelease(null)}>
                  Clear release
                </Button>
              </Stack>
              {files.isPending ? (
                <Typography>Loading release files…</Typography>
              ) : files.isError ? (
                <ErrorNotice onRetry={() => void files.refetch()} error={files.error}>
                  Couldn't load release files.
                </ErrorNotice>
              ) : (files.data?.assets.length ?? 0) === 0 ? (
                <Typography>No files in the selected range</Typography>
              ) : (
                <ListingTable.Provider>
                  <ListingTable.Container>
                    <ListingTable bordered>
                      <ListingTable.Head>
                        <ListingTable.Row>
                          <ListingTable.Cell>File</ListingTable.Cell>
                          <ListingTable.Cell align="right">Downloads</ListingTable.Cell>
                        </ListingTable.Row>
                      </ListingTable.Head>
                      <ListingTable.Body>
                        {files.data?.assets.map((file) => (
                          <ListingTable.Row key={`${file.releaseTag}-${file.assetName}`}>
                            <ListingTable.Cell>{file.assetName}</ListingTable.Cell>
                            <ListingTable.Cell align="right">
                              {formatCompact(file.downloadCount)}
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

function VersionChart({
  series,
  bars,
}: {
  series: readonly VersionSeriesItem[];
  bars: boolean;
}): JSX.Element {
  const dates = [...new Set(series.flatMap((item) => item.points.map((point) => point.date)))].sort();
  const data = dates.map((date) => {
    const row: Record<string, string | number | null> = { date };
    series.forEach((item, index) => {
      row[`rel-${index}`] = item.points.find((point) => point.date === date)?.value ?? null;
    });
    return row;
  });
  const lines = series.map((item, index) => ({
    key: `rel-${index}`,
    name: releaseName(item),
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
