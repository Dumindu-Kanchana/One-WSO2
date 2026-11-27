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

import type { JSX } from "react";
import { Link as RouterLink } from "react-router";
import { Box, ButtonBase, Card, Skeleton, Typography } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { isEngagementAppBackendConfigured } from "@config/apiConfig";
import { tripsWaiting } from "../api/dashboardMappers";
import type { TripVisa } from "../api/dashboardTypes";
import { useMyOverview } from "../api/useEngagementApi";
import { useEngagementUserInfo } from "../api/useEngagementUserInfo";
import { EA_SCOPE_SX } from "../components/eaStyles";
import { Status } from "../components/StatusChips";
import { myEngagementPaths } from "../engagementPaths";
import { engagementAccess } from "../model/engagementAccess";
import { fmtDate, fmtRange, n0, place } from "../model/format";

const CAP = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "text.secondary", fontWeight: 600 } as const;

function Row({ trip }: { trip: TripVisa }): JSX.Element {
  return (
    <ButtonBase
      component={RouterLink}
      to={myEngagementPaths.travelRequest(trip.jobNumber)}
      sx={{ display: "flex", alignItems: "center", gap: 1.25, py: 1.125, borderBottom: 1, borderColor: "divider", width: "100%", textAlign: "left", "&:last-of-type": { borderBottom: 0 } }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 500, fontSize: 13 }} noWrap>
          {place(trip.country, trip.city)}
        </Typography>
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{fmtRange(trip.start, trip.end)}</Typography>
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>Visa on the trip: {trip.tripVisa ?? "None picked yet"}</Typography>
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
          {trip.myVisa ? `Your visa: ${trip.myVisa.type}, ends ${fmtDate(trip.myVisa.endDate)}` : "No visa of yours covers this trip"}
        </Typography>
      </Box>
      {trip.waiting ? <Status label="Waiting for a visa" tone="warning" /> : trip.myVisa ? <Status label="Covered" tone="success" /> : null}
    </ButtonBase>
  );
}

/** The Me overview's visa card: upcoming trips with the visa each needs, and how many are waiting for one. Draws nothing when there are no upcoming trips. */
export default function VisaCard(): JSX.Element | null {
  const on = isEngagementAppBackendConfigured();
  const info = useEngagementUserInfo(on);
  const access = engagementAccess(info.data);
  const enabled = on && info.isSuccess && access.myTravelRequests;
  const overview = useMyOverview(enabled);
  if (!enabled) return null;
  if (overview.isPending) {
    return (
      <Card variant="outlined" sx={{ ...EA_SCOPE_SX, p: 2 }} aria-busy="true">
        <Typography sx={{ ...CAP, mb: 1 }}>Visas for Upcoming Travels</Typography>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 0.75 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 650, lineHeight: 1.15 }}>
            <Skeleton variant="text" width={24} />
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: "text.secondary", fontWeight: 500 }}>Travels Waiting for a Visa</Typography>
        </Box>
        <Skeleton variant="text" width="55%" sx={{ fontSize: 13 }} />
        <Skeleton variant="text" width="40%" sx={{ fontSize: 12 }} />
      </Card>
    );
  }
  if (overview.isError) {
    return (
      <Card variant="outlined" sx={{ ...EA_SCOPE_SX, p: 2 }}>
        <Typography sx={{ ...CAP, mb: 1.5 }}>Visas for Upcoming Travels</Typography>
        <ErrorNotice error={overview.error} onRetry={() => void overview.refetch()} retrying={overview.isFetching}>
          Couldn&apos;t load the visas for your upcoming travels.
        </ErrorNotice>
      </Card>
    );
  }
  const trips = overview.data.tripVisas ?? [];
  if (!trips.length) return null;
  const waiting = tripsWaiting(trips);
  return (
    <Card variant="outlined" sx={{ ...EA_SCOPE_SX, p: 2, display: "flex", flexDirection: "column" }}>
      <Typography sx={{ ...CAP, mb: 1 }}>Visas for Upcoming Travels</Typography>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 0.75 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 650, lineHeight: 1.15, color: waiting ? "text.primary" : "text.disabled" }}>{n0(waiting)}</Typography>
        <Typography sx={{ fontSize: 12.5, color: "text.secondary", fontWeight: 500 }}>Travels Waiting for a Visa</Typography>
      </Box>
      {trips.slice(0, 5).map((t) => (
        <Row key={t.jobNumber} trip={t} />
      ))}
    </Card>
  );
}
