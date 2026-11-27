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
import { Box, Stack, ToggleButton, ToggleButtonGroup } from "@wso2/oxygen-ui";
import { useReferenceData } from "../../../api/useEngagementApi";
import { FilterDate, FilterSelect } from "../../../components/FilterFields";
import { DelayedSkeleton } from "../../../components/EaSkeletons";
import { Failed } from "../../../components/ListCard";
import { Bars, Tiles } from "../WidgetSkeletons";
import { addDays, n0 } from "../../../model/format";
import { Calm, HBars, Kpi, KpiRow } from "../../dashboardParts";
import { Block } from "../parts";
import type { WidgetCtx } from "../types";



/** The legacy Allocations dashboard (privilege 1), with its Business Unit and Today / Past Date choices. */
export default function AllocationsTodayWidget({ ctx }: { ctx: WidgetCtx }): JSX.Element {
  const ref = useReferenceData();
  const { businessUnit: bu, date, query, change } = ctx.allocationsToday;
  const a = query.data;
  const past = Boolean(date);
  return (
    <>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1.5, mb: 2 }}>
        <Box sx={{ minWidth: 240 }}>
          <FilterSelect label="Select Business Unit" anyLabel="All" value={bu} options={ref.data?.businessUnits ?? []} onChange={(v) => change({ businessUnit: v })} />
        </Box>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={past ? "past" : "today"}
          onChange={(_, v: "today" | "past" | null) => v && change({ date: v === "past" ? addDays(ctx.businessDate, -1) : "" })}
          aria-label="Date"
          sx={{ "& .MuiToggleButton-root": { px: 2 } }}
        >
          <ToggleButton value="today">Today</ToggleButton>
          <ToggleButton value="past">Past Date</ToggleButton>
        </ToggleButtonGroup>
        {past ? (
          <Box sx={{ minWidth: 180 }}>
            <FilterDate label="Select Date" value={date} max={addDays(ctx.businessDate, -1)} onChange={(v) => v && v < ctx.businessDate && change({ date: v })} />
          </Box>
        ) : null}
      </Stack>
      {query.isError ? <Failed what="the allocations on this date" error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} /> : null}
      {!a ? (
        query.isError ? null : (
          <DelayedSkeleton minHeight={260}>
            <KpiRow>
              <Tiles tiles={[["Allocations", true], "Consultants Allocated", ["Paid Allocations", true], "Non Paid Allocations"]} />
            </KpiRow>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(3, minmax(0, 1fr))" }, gap: 3, mt: 2.5 }}>
              {["Allocations by Engagement Type", "Paid Allocations by Allocation Type", "Non Paid Allocations by Allocation Type"].map((title) => (
                <Block key={title} title={title}>
                  <Bars rows={4} />
                </Block>
              ))}
            </Box>
          </DelayedSkeleton>
        )
      ) : (
        <Box sx={{ opacity: query.isPlaceholderData ? 0.55 : 1, transition: "opacity 120ms" }} aria-busy={query.isPlaceholderData || undefined}>
          <KpiRow>
            <Kpi label="Allocations" value={n0(a.total)} note="Engagement allocations only" />
            <Kpi label="Consultants Allocated" value={n0(a.consultants)} />
            <Kpi label="Paid Allocations" value={n0(a.paid)} note={a.total ? `${Math.round((a.paid / a.total) * 100)}% of allocations` : undefined} />
            <Kpi label="Non Paid Allocations" value={n0(a.nonPaid)} />
          </KpiRow>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(3, minmax(0, 1fr))" }, gap: 3, mt: 2.5 }}>
            <Block title="Allocations by Engagement Type">{a.byEngagementType.length ? <HBars rows={a.byEngagementType} percent /> : <Calm>Nobody is allocated on this date.</Calm>}</Block>
            <Block title="Paid Allocations by Allocation Type">
              {a.paidByAllocationType.length ? <HBars rows={a.paidByAllocationType} percent /> : <Calm>No paid allocations on this date.</Calm>}
            </Block>
            <Block title="Non Paid Allocations by Allocation Type">
              {a.nonPaidByAllocationType.length ? <HBars rows={a.nonPaidByAllocationType} percent /> : <Calm>No non paid allocations on this date.</Calm>}
            </Block>
          </Box>
        </Box>
      )}
    </>
  );
}
