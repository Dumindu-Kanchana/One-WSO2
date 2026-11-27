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

import type { JSX, ReactNode } from "react";
import { Link as RouterLink } from "react-router";
import { Box, Button, ButtonBase, Card, Skeleton, Typography } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { isEngagementAppBackendConfigured } from "@config/apiConfig";
import { localIsoDate } from "@utils/localDate";
import { useMyOverview } from "../api/useEngagementApi";
import { useEngagementUserInfo } from "../api/useEngagementUserInfo";
import { AllocationStatusChip, TravelStatusChip } from "../components/StatusChips";
import { myAllocationLink, myEngagementPaths } from "../engagementPaths";
import { engagementAccess } from "../model/engagementAccess";
import { EA_SCOPE_SX } from "../components/eaStyles";
import { fmtRange, place } from "../model/format";

const CAP = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "text.secondary", fontWeight: 600 } as const;

function Line({ title, sub, chip, to }: { title: string; sub: string; chip: ReactNode; to?: string }) {
  const body = (
    <>
      <Box sx={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <Typography sx={{ fontWeight: 500, fontSize: 13 }} noWrap title={title}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{sub}</Typography>
      </Box>
      {chip}
    </>
  );
  const sx = { display: "flex", alignItems: "center", gap: 1.25, py: 1.125, borderBottom: 1, borderColor: "divider", width: "100%", "&:last-of-type": { borderBottom: 0 } };
  return to ? (
    <ButtonBase component={RouterLink} to={to} sx={{ ...sx, "&:hover p:first-of-type": { color: "primary.main" } }}>
      {body}
    </ButtonBase>
  ) : (
    <Box sx={sx}>{body}</Box>
  );
}

/** The one card the Engagement App adds to the Me overview, at the end of More About You: the person's current and next allocations with their status, and upcoming trips with the travel agent. */
export default function UpcomingCard(): JSX.Element | null {
  const on = isEngagementAppBackendConfigured();
  const info = useEngagementUserInfo(on);
  const access = engagementAccess(info.data);
  const enabled = on && info.isSuccess && (access.myAllocations || access.myTravelRequests);
  const overview = useMyOverview(enabled);
  if (!enabled) return null;
  if (overview.isPending) {
    return (
      <Card variant="outlined" sx={{ ...EA_SCOPE_SX, p: 2 }} aria-busy="true">
        <Typography sx={{ ...CAP, mb: 1 }}>Allocations &amp; Travels</Typography>
        {[0, 1].map((i) => (
          <Box key={i} sx={{ py: 1.125 }}>
            <Skeleton variant="text" width={`${55 - i * 10}%`} sx={{ fontSize: 13 }} />
            <Skeleton variant="text" width="35%" sx={{ fontSize: 12 }} />
          </Box>
        ))}
      </Card>
    );
  }
  if (overview.isError) {
    return (
      <Card variant="outlined" sx={{ p: 2 }}>
        <Typography sx={{ ...CAP, mb: 1.5 }}>Allocations &amp; Travels</Typography>
        <ErrorNotice error={overview.error} onRetry={() => void overview.refetch()} retrying={overview.isFetching}>
          Couldn&apos;t load your upcoming allocations and travels.
        </ErrorNotice>
      </Card>
    );
  }
  const allocations = overview.data.allocations.slice(0, 3);
  const trips = overview.data.trips.slice(0, 3);
  if (!allocations.length && !trips.length) return null;
  const today = localIsoDate();
  const current = allocations.filter((a) => a.current ?? (a.start <= today && today <= a.end)).length;
  const allocationsHeading = current === 0 ? "Upcoming Allocations" : current === allocations.length ? "Current Allocations" : "Current and Upcoming Allocations";
  return (
    <Card variant="outlined" sx={{ ...EA_SCOPE_SX, p: 2, display: "flex", flexDirection: "column" }}>
      <Typography sx={{ ...CAP, mb: 1 }}>Allocations &amp; Travels</Typography>
      {allocations.length ? (
        <>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary", mt: 0.5 }}>{allocationsHeading}</Typography>
          {allocations.map((a) => (
            <Line
              key={a.id}
              title={a.title || a.engagementId}
              sub={fmtRange(a.start, a.end)}
              chip={a.status ? <AllocationStatusChip status={a.status} /> : undefined}
              to={myAllocationLink(a)}
            />
          ))}
        </>
      ) : null}
      {trips.length ? (
        <>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary", mt: 1.25 }}>Upcoming Travels</Typography>
          {trips.map((t) => (
            <Line
              key={t.jobNumber}
              title={place(t.country, t.city)}
              sub={`${fmtRange(t.start, t.end)}${t.travelAgent ? `, ${t.travelAgent}` : ""}`}
              chip={t.status ? <TravelStatusChip status={t.status} /> : undefined}
              to={myEngagementPaths.travelRequest(t.jobNumber)}
            />
          ))}
        </>
      ) : null}
      <Box sx={{ mt: 1.5 }}>
        <Button variant="outlined" size="small" component={RouterLink} to={trips.length ? myEngagementPaths.travelRequests : myEngagementPaths.allocations}>
          {trips.length ? "View Travels" : "View Allocations"}
        </Button>
      </Box>
    </Card>
  );
}
