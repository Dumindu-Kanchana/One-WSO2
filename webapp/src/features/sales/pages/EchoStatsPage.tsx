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
import { Alert, Box, CircularProgress, Stack, Typography } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import SalesShell from "../components/SalesShell";
import ScopeSwitch from "../components/ScopeSwitch";
import { isSalesBackendConfigured } from "../api/useSalesData";
import { useSalesGate } from "../api/useSalesGate";
import { isEchoBackendConfigured } from "../meddpicc/api/useMeddpiccData";
import { isForbidden } from "../util/salesError";
import { useEchoAdminStats } from "../echoStats/api/useEchoAdminStats";
import { DEFAULT_STATS_DAYS, STATS_DAYS, type StatsDays } from "../echoStats/types";
import { formatRange } from "../echoStats/util/statsFormat";
import UsageSection from "../echoStats/components/UsageSection";
import RecordingSection from "../echoStats/components/RecordingSection";
import DecisionsSection from "../echoStats/components/DecisionsSection";
import SalesforceSection from "../echoStats/components/SalesforceSection";
import ModelSection from "../echoStats/components/ModelSection";

const RANGE_OPTIONS = STATS_DAYS.map((days) => ({ value: String(days), label: `${days} days` }));

/** The range in the URL, or the default for anything the endpoint would refuse. */
function daysFrom(params: URLSearchParams): StatsDays {
  const raw = Number(params.get("days"));
  return (STATS_DAYS as readonly number[]).includes(raw) ? (raw as StatsDays) : DEFAULT_STATS_DAYS;
}

/**
 * Sales → Echo → Stats: how Echo is used and what account managers do with its suggestions.
 * Sales admins only.
 *
 * Three answers to "may I see this", from the outside in. SalesShell asks meet-app whether
 * the caller is in Sales at all, as every Sales page does. A caller who is, but is not a
 * Sales admin there, is told so here and nothing is requested. And echo-backend decides for
 * itself, from its own admin groups: its 403 is met with the same explanation rather than an
 * error, since the two lists of admins are kept separately and can disagree.
 *
 * The range lives in the URL (?days=), so a link to the 90-day view opens on it.
 */
export default function EchoStatsPage() {
  const meetAppConfigured = isSalesBackendConfigured();
  const echoConfigured = isEchoBackendConfigured();
  const { isAdmin } = useSalesGate();
  const [params, setParams] = useSearchParams();
  const days = daysFrom(params);
  const query = useEchoAdminStats(days, isAdmin);

  const showDays = (next: StatsDays) => {
    const nextParams = new URLSearchParams(params);
    if (next === DEFAULT_STATS_DAYS) nextParams.delete("days");
    else nextParams.set("days", String(next));
    setParams(nextParams, { replace: true });
  };

  const stats = query.data;
  const forbidden = isForbidden(query.error);

  return (
    <SalesShell
      title="Echo stats"
      subtitle="How Echo is used, the calls it recorded, and what account managers did with its suggestions."
      configured={meetAppConfigured && echoConfigured}
      configKey={meetAppConfigured ? "ONE_WSO2_ECHO_BACKEND_URL" : "ONE_WSO2_REVOPS_BACKEND_URL"}
      configLabel={meetAppConfigured ? "the MEDDPICC backend URL" : undefined}
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
              onChange={(value) => showDays(Number(value) as StatsDays)}
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
            <Stack spacing={3} sx={{ opacity: query.isPlaceholderData ? 0.6 : 1, transition: "opacity 120ms" }}>
              <UsageSection usage={stats.usage} range={stats.range} />
              <RecordingSection recording={stats.recording} days={stats.range.days} />
              <DecisionsSection decisions={stats.decisions} />
              <SalesforceSection salesforce={stats.salesforce} />
              <ModelSection model={stats.model} />
            </Stack>
          )}
        </Box>
      )}
    </SalesShell>
  );
}
