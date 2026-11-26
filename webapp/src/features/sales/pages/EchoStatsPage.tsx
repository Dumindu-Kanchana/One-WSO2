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

import { useSearchParams } from "react-router";
import { Alert, Box, CircularProgress, Stack, Tab, Tabs, Typography } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import SalesShell from "../components/SalesShell";
import ScopeSwitch from "../components/ScopeSwitch";
import { isSalesBackendConfigured } from "../api/useSalesData";
import { useSalesGate } from "../api/useSalesGate";
import { isEchoBackendConfigured } from "../meddpicc/api/useMeddpiccData";
import { isForbidden } from "../util/salesError";
import { useEchoAdminStats } from "../echoStats/api/useEchoAdminStats";
import { DEFAULT_STATS_DAYS, STATS_DAYS, type EchoAdminStats, type StatsDays } from "../echoStats/types";
import { formatRange } from "../echoStats/util/statsFormat";
import UsageSection from "../echoStats/components/UsageSection";
import RecordingSection from "../echoStats/components/RecordingSection";
import ProgressSection from "../echoStats/components/ProgressSection";
import QuietDealsSection from "../echoStats/components/QuietDealsSection";
import DecisionsSection from "../echoStats/components/DecisionsSection";
import AnalysisSection from "../echoStats/components/AnalysisSection";
import SalesforceSection from "../echoStats/components/SalesforceSection";

const RANGE_OPTIONS = STATS_DAYS.map((days) => ({ value: String(days), label: `${days} days` }));

/**
 * Two readers, two tabs. Adoption is for AM leadership: who uses Echo, who records calls, how
 * deals move and which have gone quiet. Quality is for the team building Echo: what AMs do
 * with its suggestions, how analysis went, and what is still missing in Salesforce.
 */
type StatsTab = "adoption" | "quality";
const STATS_TABS: readonly { value: StatsTab; label: string }[] = [
  { value: "adoption", label: "Adoption" },
  { value: "quality", label: "Quality" },
];
const DEFAULT_TAB: StatsTab = "adoption";

/** The range in the URL, or the default for anything the endpoint would refuse. */
function daysFrom(params: URLSearchParams): StatsDays {
  const raw = Number(params.get("days"));
  return (STATS_DAYS as readonly number[]).includes(raw) ? (raw as StatsDays) : DEFAULT_STATS_DAYS;
}

/** The tab in the URL, or Adoption for anything else. */
function tabFrom(params: URLSearchParams): StatsTab {
  const raw = params.get("tab");
  return STATS_TABS.some((tab) => tab.value === raw) ? (raw as StatsTab) : DEFAULT_TAB;
}

function AdoptionTab({ stats }: { stats: EchoAdminStats }) {
  const days = stats.range.days;
  return (
    <>
      <UsageSection usage={stats.usage} range={stats.range} />
      <RecordingSection recording={stats.recording} days={days} />
      <ProgressSection progress={stats.progress} days={days} />
      <QuietDealsSection quietDeals={stats.quietDeals} days={days} />
    </>
  );
}

function QualityTab({ stats }: { stats: EchoAdminStats }) {
  return (
    <>
      <DecisionsSection decisions={stats.decisions} />
      <AnalysisSection recording={stats.recording} />
      <SalesforceSection salesforce={stats.salesforce} />
    </>
  );
}

/**
 * Sales → Echo → Stats: how Echo is used and what account managers do with its suggestions.
 * Sales admins only.
 *
 * A caller who is not a Sales admin is told the page is for admins, and nothing is requested.
 * The Echo backend also decides for itself: its 403 is met with the same explanation rather
 * than an error.
 *
 * The tab and the range live in the URL (?tab=, ?days=), so a link to the 90-day Quality view
 * opens on it. Both tabs read the one response, so switching tabs asks for nothing.
 */
export default function EchoStatsPage() {
  const salesConfigured = isSalesBackendConfigured();
  const echoConfigured = isEchoBackendConfigured();
  const { isAdmin } = useSalesGate();
  const [params, setParams] = useSearchParams();
  const days = daysFrom(params);
  const tab = tabFrom(params);
  const query = useEchoAdminStats(days, isAdmin);

  // Replaced rather than pushed, as on the deal page: Back leaves the page instead of stepping
  // through every tab and range looked at. The defaults stay out of the address.
  const setParam = (key: string, value: string, fallback: string) => {
    const nextParams = new URLSearchParams(params);
    if (value === fallback) nextParams.delete(key);
    else nextParams.set(key, value);
    setParams(nextParams, { replace: true });
  };

  const stats = query.data;
  const forbidden = isForbidden(query.error);

  return (
    <SalesShell
      title="Echo stats"
      subtitle="How Echo is used and how deals move, by account manager and region; and how good its suggestions are."
      configured={salesConfigured && echoConfigured}
      configKey={salesConfigured ? "ONE_WSO2_ECHO_BACKEND_URL" : "ONE_WSO2_REVOPS_BACKEND_URL"}
      configLabel={salesConfigured ? "the MEDDPICC backend URL" : undefined}
    >
      {!isAdmin ? (
        <Alert severity="warning">Echo stats are for Sales admins only.</Alert>
      ) : forbidden ? (
        <Alert severity="warning">
          Echo stats are for Sales admins only, and Echo doesn&apos;t list you as one. If you need
          them, ask to be added to the Sales admin group.
        </Alert>
      ) : (
        <Box>
          <Tabs
            value={tab}
            onChange={(_, next: StatsTab) => setParam("tab", next, DEFAULT_TAB)}
            aria-label="Echo stats views"
            sx={{
              mb: 2,
              minHeight: 40,
              borderBottom: 1,
              borderColor: "divider",
              "& .MuiTab-root": { minHeight: 40, textTransform: "none" },
            }}
          >
            {STATS_TABS.map((option) => (
              <Tab
                key={option.value}
                value={option.value}
                label={option.label}
                id={`echo-stats-tab-${option.value}`}
                aria-controls={`echo-stats-panel-${option.value}`}
              />
            ))}
          </Tabs>
          <Stack
            direction="row"
            spacing={1.5}
            useFlexGap
            sx={{ alignItems: "center", flexWrap: "wrap", mb: 2.5 }}
          >
            <ScopeSwitch
              label="Range"
              value={String(days)}
              options={RANGE_OPTIONS}
              onChange={(value) => setParam("days", value, String(DEFAULT_STATS_DAYS))}
            />
            {stats && (
              <Typography variant="body2" color="text.secondary">
                {formatRange(stats.range)}
              </Typography>
            )}
            {query.isFetching && stats && <CircularProgress size={14} aria-label="Updating" />}
          </Stack>

          {query.isError ? (
            <ErrorNotice onRetry={() => void query.refetch()} error={query.error}>
              Couldn&apos;t load Echo stats.
            </ErrorNotice>
          ) : !stats ? (
            <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", py: 2 }}>
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                Loading Echo stats…
              </Typography>
            </Stack>
          ) : (
            // The previous range stays on screen, dimmed, while the new one loads.
            <Stack
              spacing={3}
              role="tabpanel"
              id={`echo-stats-panel-${tab}`}
              aria-labelledby={`echo-stats-tab-${tab}`}
              sx={{ opacity: query.isPlaceholderData ? 0.6 : 1, transition: "opacity 120ms" }}
            >
              {tab === "adoption" ? <AdoptionTab stats={stats} /> : <QualityTab stats={stats} />}
            </Stack>
          )}
        </Box>
      )}
    </SalesShell>
  );
}
