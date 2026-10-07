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
import type { JSX } from "react";
import { useSearchParams } from "react-router";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useAccessToken } from "@hooks/useAccessToken";
import {
  dailyRange,
  getReleaseDownloads,
  getRepositories,
  productDownloadStatsBackendUrl,
  type ReleaseDownloadGrain,
} from "@features/engineering/api/productDownloadStats";
import DownloadStatsShell from "../components/DownloadStatsShell";
import { dailyChartModel } from "./dailyChartModel";
import { formatCount, isIsolatedPoint, productLabel } from "./display";

function readGrain(value: string | null): ReleaseDownloadGrain {
  if (value === "month" || value === "cumulative") return value;
  return "day";
}

export default function EngineeringDownloadsPage(): JSX.Element {
  return (
    <DownloadStatsShell screen="downloads">
      <DownloadsScreen />
    </DownloadStatsShell>
  );
}

/** Inside the shell, so it is mounted — and asks — only once the shell has let the reader through. */
function DownloadsScreen(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const getToken = useAccessToken();
  const base = productDownloadStatsBackendUrl();
  const defaults = dailyRange();
  const from = params.get("from") || defaults.from;
  const to = params.get("to") || defaults.to;
  const interval = readGrain(params.get("interval"));
  const repos = (params.get("repos") ?? "")
    .split(",")
    .map((part) => Number(part))
    .filter((id) => Number.isInteger(id) && id > 0);
  const chart = params.get("chart") === "bar" ? "bar" : "line";

  const repositories = useQuery({
    queryKey: ["product-download-stats", "repositories", base],
    queryFn: async () => getRepositories(await getToken()),
  });
  const rangeInverted = from > to;
  const downloads = useQuery({
    queryKey: ["product-download-stats", "downloads", base, from, to, interval, repos.join(",")],
    enabled: !rangeInverted,
    queryFn: async () => getReleaseDownloads(await getToken(), { from, to, interval, repos }),
  });

  const active = (repositories.data?.repositories ?? []).filter(
    (repository) => repository.isActive !== false,
  );
  const names = new Map(
    active.map((repository) => [repository.id, productLabel(repository.productName, repository.repoName)]),
  );

  const replace = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    // The screen shows a default range before those dates are in the address.
    // Write them on the first change so a shared link does not drift to another day.
    if (!params.get("from")) next.set("from", from);
    if (!params.get("to")) next.set("to", to);
    for (const [key, value] of Object.entries(updates)) {
      if ((key === "from" || key === "to") && (value == null || value === "")) continue;
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  };

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
        {interval === "day" && (
          <ToggleButtonGroup
            exclusive
            size="small"
            aria-label="Chart type"
            value={chart}
            onChange={(_event, value: string | null) => {
              if (value) replace({ chart: value === "line" ? null : value });
            }}
          >
            <ToggleButton value="line">Line</ToggleButton>
            <ToggleButton value="bar">Bars</ToggleButton>
          </ToggleButtonGroup>
        )}
      </Stack>

      {rangeInverted ? (
        <Typography>From is after To.</Typography>
      ) : downloads.isPending ? (
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <CircularProgress size={16} />
          <Typography>Loading release downloads…</Typography>
        </Stack>
      ) : downloads.isError || downloads.data == null ? (
        <ErrorNotice onRetry={() => void downloads.refetch()} error={downloads.error}>
          Couldn't load release downloads.
        </ErrorNotice>
      ) : downloads.data.series.every((item) => item.points.length === 0) ? (
        <Typography>No data for the selected range</Typography>
      ) : (
        <>
          <DownloadChart
            series={downloads.data.series}
            names={names}
            interval={interval}
            chart={chart}
            from={from}
            to={to}
          />
          <Card sx={{ p: 2, mt: 2 }}>
            <ListingTable.Provider>
              <ListingTable.Container>
                <ListingTable bordered>
                  <ListingTable.Head>
                    <ListingTable.Row>
                      <ListingTable.Cell>Product</ListingTable.Cell>
                      <ListingTable.Cell>Date</ListingTable.Cell>
                      <ListingTable.Cell align="right">Downloads</ListingTable.Cell>
                    </ListingTable.Row>
                  </ListingTable.Head>
                  <ListingTable.Body>
                    {downloads.data.series.flatMap((item) =>
                      item.points.map((point) => (
                        <ListingTable.Row key={`${item.repoId}-${point.date}`}>
                          <ListingTable.Cell>
                            {names.get(item.repoId) ?? item.repoName}
                          </ListingTable.Cell>
                          <ListingTable.Cell>{point.date}</ListingTable.Cell>
                          <ListingTable.Cell align="right">{formatCount(point.value)}</ListingTable.Cell>
                        </ListingTable.Row>
                      )),
                    )}
                  </ListingTable.Body>
                </ListingTable>
              </ListingTable.Container>
            </ListingTable.Provider>
          </Card>
        </>
      )}
    </Box>
  );
}

function isolatedDot(
  data: Record<string, string | number | null>[],
  dataKey: string,
  stroke: string,
) {
  return (props: { cx?: number; cy?: number; index?: number }) => {
    const index = props.index ?? -1;
    const value = data[index]?.[dataKey];
    if (!isIsolatedPoint(data, dataKey, index) || typeof value !== "number") return null;
    if (props.cx == null || props.cy == null) return null;
    return <circle cx={props.cx} cy={props.cy} r={3} fill={stroke} />;
  };
}

function DownloadChart({
  series,
  names,
  interval,
  chart,
  from,
  to,
}: {
  series: Parameters<typeof dailyChartModel>[0];
  names: Map<number, string>;
  interval: ReleaseDownloadGrain;
  chart: "line" | "bar";
  from: string;
  to: string;
}): JSX.Element {
  // Monthly points are YYYY-MM. Expanding those through calendar days would
  // mix month buckets with empty days, so the chart keeps only returned labels.
  const range = interval === "month" ? { from: "", to: "" } : { from, to };
  const { data, lines } = dailyChartModel(series, names, range);
  const bars = interval === "month" || (interval === "day" && chart === "bar");
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
              <Bar key={line.repoId} name={line.name} dataKey={line.dataKey} fill={line.stroke} />
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
                key={line.repoId}
                name={line.name}
                type="monotone"
                dataKey={line.dataKey}
                stroke={line.stroke}
                dot={isolatedDot(data, line.dataKey, line.stroke)}
                connectNulls={false}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </Box>
  );
}
