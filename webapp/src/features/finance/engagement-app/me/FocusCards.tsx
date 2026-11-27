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
import { Box, Skeleton } from "@wso2/oxygen-ui";
import { localIsoDate, localIsoDateOffset } from "@utils/localDate";
import type { TravelRequestSummary } from "../api/engagementTypes";
import { useMyOverview } from "../api/useEngagementApi";
import { AllocationStatusChip, Mono, TravelStatusChip } from "../components/StatusChips";
import { DateRow, Mini } from "../dashboard/dashboardParts";
import { myEngagementPaths } from "../engagementPaths";
import { fmtRange, place } from "../model/format";

const MAX = 3;

/** A focus card while its rows load: the title over one placeholder row, so the list below is not pushed down when they arrive. */
function FocusSkeleton({ title }: { title: string }): JSX.Element {
  return (
    <Box sx={{ mb: 2 }} aria-busy="true" data-testid="focus-loading">
      <Mini title={title}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.25 }}>
          <Skeleton variant="rounded" width={46} height={50} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="40%" sx={{ fontSize: 13.5 }} />
            <Skeleton variant="text" width="25%" sx={{ fontSize: 12.5 }} />
          </Box>
          <Skeleton variant="rounded" width={84} height={22} />
        </Box>
      </Mini>
    </Box>
  );
}

/**
 * The current and next allocations (at most three), above the Allocations list; a placeholder while they load, nothing when there are none. A row
 * opens its engagement when the overview or the list (`canOpen`) says the person may open it, and is plain otherwise.
 */
export function AllocationsFocus({ canOpen }: { canOpen: (engagementId: string) => boolean }): JSX.Element | null {
  const overview = useMyOverview();
  const allocations = (overview.data?.allocations ?? []).slice(0, MAX);
  if (overview.isPending) return <FocusSkeleton title="Current and Upcoming" />;
  if (!allocations.length) return null;
  const today = localIsoDate();
  const current = allocations.filter((a) => a.current ?? (a.start <= today && today <= a.end)).length;
  return (
    <Box sx={{ mb: 2 }}>
      <Mini title={current === 0 ? "Upcoming" : current === allocations.length ? "Current" : "Current and Upcoming"}>
        {allocations.map((a) => (
          <DateRow
            key={a.id}
            date={a.start}
            title={a.title || a.engagementId}
            lines={[fmtRange(a.start, a.end)]}
            right={a.status ? <AllocationStatusChip status={a.status} /> : undefined}
            // `canOpen(id)` only knows the rows of the loaded list page, so it is a fallback for a backend that sends no `canOpen` on the overview.
            to={(a.canOpen ?? canOpen(a.engagementId)) ? myEngagementPaths.allocation(a.engagementId) : undefined}
          />
        ))}
      </Mini>
    </Box>
  );
}

/** A trip in one of these stays listed for a while after its planned end date until someone marks it Completed. */
const UNDER_WAY: ReadonlySet<string> = new Set(["In Progress", "Extended"]);

/** Days an unclosed In Progress or Extended trip stays listed after its planned end date. */
const GRACE_DAYS = 30;

/**
 * Trips under way or still to come (at most three), above the Travels list; a placeholder while they load, nothing when there are none. A trip counts
 * while its end date is today or later, and an In Progress or Extended one also for 30 days after it. Current trips
 * come first, then upcoming ones by start date. Older trips nobody closed stay out.
 */
export function TravelsFocus({ trips, loading = false }: { trips: readonly TravelRequestSummary[]; loading?: boolean }): JSX.Element | null {
  const today = localIsoDate();
  const graceStart = localIsoDateOffset(-GRACE_DAYS);
  const current = (t: TravelRequestSummary) => t.start <= today;
  const focus = trips
    .filter(
      (t) =>
        t.status !== "Cancelled" &&
        t.status !== "Completed" &&
        (t.end >= today || (UNDER_WAY.has(t.status) && t.end >= graceStart)),
    )
    .sort((a, b) => Number(!current(a)) - Number(!current(b)) || (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
    .slice(0, MAX);
  if (loading) return <FocusSkeleton title="Under Way and Upcoming" />;
  if (!focus.length) return null;
  const ongoing = focus.filter((t) => t.start <= today).length;
  return (
    <Box sx={{ mb: 2 }}>
      <Mini title={ongoing === 0 ? "Upcoming" : ongoing === focus.length ? "Under Way" : "Under Way and Upcoming"}>
        {focus.map((t) => (
          <DateRow
            key={t.jobNumber}
            date={t.start}
            title={place(t.country, t.city)}
            lines={[fmtRange(t.start, t.end), t.travelAgent || "No travel agent yet"]}
            right={
              <>
                <TravelStatusChip status={t.status} />
                <Mono>{t.jobNumber}</Mono>
              </>
            }
            to={myEngagementPaths.travelRequest(t.jobNumber)}
          />
        ))}
      </Mini>
    </Box>
  );
}
