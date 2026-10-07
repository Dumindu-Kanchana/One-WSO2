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

import { Box } from "@wso2/oxygen-ui";
import { Boxes, CalendarDays, Copy, Database, Download } from "@wso2/oxygen-ui-icons-react";
import { type JSX } from "react";
import { useNavigate } from "react-router";
import { downloadStatsPaths } from "@constants/downloadStatsApps";
import type { Summary } from "../api/productDownloadStats";
import { calendarDay, defaultRange } from "../utils/filters";
import { formatCompact, formatNumber } from "../utils/format";
import { StatCard } from "./StatCard";
import TrendIndicator from "./TrendIndicator";

interface KpiCardsProps {
  summary?: Summary;
  isLoading?: boolean;
  isError?: boolean;
}

// The five Overview tiles, in this order, with these icons, disc colours and
// tooltips. Yesterday's downloads is the headline, with its change
// against the day before as the trend chip. Three tiles open Downloads; the
// disc colours are palette tokens, so they take One's theme.
export default function KpiCards({ summary, isLoading, isError }: KpiCardsProps): JSX.Element {
  const navigate = useNavigate();
  const dayPath = dayDownloadsPath(summary?.asOfDate);

  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(5, 1fr)" },
        mb: 2,
      }}
    >
      <StatCard
        label="Yesterday's Downloads"
        value={formatCompact(summary?.todayDownloads)}
        icon={<Download size={20} />}
        iconColor="success"
        trend={<TrendIndicator pct={summary?.todayDeltaPct} />}
        tooltipText="New downloads on the latest sync day, across all products."
        // A link only once there is a day to open: the API's as-of date, when
        // it is a calendar day.
        onClick={dayPath ? () => void navigate(dayPath) : undefined}
        isLoading={isLoading}
        isError={isError}
      />
      <StatCard
        label="This Month's Downloads"
        value={formatCompact(summary?.monthDownloads)}
        icon={<CalendarDays size={20} />}
        iconColor="primary"
        tooltipText="Downloads so far this calendar month, across all products."
        onClick={() => void navigate(monthDownloadsPath(summary?.asOfDate))}
        isLoading={isLoading}
        isError={isError}
      />
      <StatCard
        label="Total Downloads"
        value={formatCompact(summary?.totalDownloads)}
        icon={<Database size={20} />}
        iconColor="info"
        tooltipText="Sum of the latest cumulative download count across all tracked products."
        onClick={() => void navigate(`${downloadStatsPaths.downloads}?interval=cumulative`)}
        isLoading={isLoading}
        isError={isError}
      />
      <StatCard
        label="Products Tracked"
        value={formatNumber(summary?.trackedRepositories)}
        icon={<Boxes size={20} />}
        iconColor="secondary"
        isLoading={isLoading}
        isError={isError}
      />
      <StatCard
        label="Clones (14d)"
        value={formatCompact(summary?.totalClonesLast14d)}
        icon={<Copy size={20} />}
        iconColor="warning"
        tooltipText="Total git clones across all products in the last 14 days."
        isLoading={isLoading}
        isError={isError}
      />
    </Box>
  );
}

// Downloads for the as-of day alone. Naming only the start would read as
// "from that day until today"; both ends are named so the screen opens on
// the one day the tile counts.
function dayDownloadsPath(asOfDate: string | null | undefined): string | undefined {
  const day = calendarDay(asOfDate);
  if (!day) return undefined;
  return `${downloadStatsPaths.downloads}?interval=day&from=${day}&to=${day}`;
}

// Downloads at the monthly interval for the calendar month the tile counts:
// the first of the as-of month through the as-of day, or through today (the
// UTC day, as the API counts days) when the API has not said which day it is
// at.
function monthDownloadsPath(asOfDate: string | null | undefined): string {
  const to = calendarDay(asOfDate) ?? defaultRange().to;
  const from = `${to.slice(0, 7)}-01`;
  return `${downloadStatsPaths.downloads}?interval=month&from=${from}&to=${to}`;
}
