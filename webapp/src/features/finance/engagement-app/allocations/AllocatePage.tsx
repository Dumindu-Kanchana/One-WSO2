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

import { useState, type JSX } from "react";
import { Navigate, useParams } from "react-router";
import {
  Alert,
  Box,
  Button,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
} from "@wso2/oxygen-ui";
import { localIsoDate } from "@utils/localDate";
import type { Allocation, EmployeeOption, Engagement, Person } from "../api/engagementTypes";
import { useAllocationTimeline, useEngagement, useOrgStructure, useReferenceData } from "../api/useEngagementApi";
import { useEngagementAccess } from "../api/useEngagementUserInfo";
import EaPage from "../components/EaPage";
import { FactsCard } from "../components/Facts";
import { FactsSkeleton } from "../components/EaSkeletons";
import { Empty, Failed, ListCard, SectionTitle } from "../components/ListCard";
import PersonPicker from "../components/PersonPicker";
import SearchSelect from "../components/SearchSelect";
import RowActions from "../components/RowActions";
import { RequestStatusChip, Two, Mono } from "../components/StatusChips";
import { engagementPaths } from "../engagementPaths";
import { useEngagementActions } from "../engagements/useEngagementActions";
import { AllocationRecords } from "../engagements/EngagementPage";
import { canAllocateType, canEditAllocationStatus } from "../model/engagementAccess";
import { addDays, fmtRange, place, typeColor } from "../model/format";
import AllocationDialog from "./AllocationDialog";
import AllocationStatusDialog from "./AllocationStatusDialog";
import { FilterBar, FilterDate, FilterSelect } from "../components/FilterFields";
import { HttpError } from "@api/http";
import Timeline, { type TimelineRow } from "./Timeline";

type Mode = "email" | "team";

/** The legacy Allocate page (/allocations/:id): the engagement's facts; Search by Email and Search by Team; the timeline over the engagement's dates ± 28 days; and the allocation records. */
export default function AllocatePage(): JSX.Element {
  const { id = "" } = useParams();
  const engagement = useEngagement(id);
  const { p } = useEngagementAccess();
  const back = { to: engagementPaths.engagement(id), label: id };

  if (engagement.isPending) {
    return (
      <EaPage title={`Allocate ${id}`} back={back}>
        <FactsSkeleton labels={["Engagement ID", "Engagement Code", "Account", "Opportunity Name", "Dates", "Location"]} two={["Location"]} />
        <ListCard>
          <Skeleton variant="rounded" height={300} />
        </ListCard>
        <ListCard spaced>
          <SectionTitle>Allocation Records</SectionTitle>
          <AllocationRecords allocations={[]} loading canChangeStatus={false} onChangeStatus={() => undefined} empty={<></>} />
        </ListCard>
      </EaPage>
    );
  }
  if (engagement.isError) {
    return (
      <EaPage title={`Allocate ${id}`} back={back}>
        {engagement.error instanceof HttpError && (engagement.error.status === 404 || engagement.error.status === 403) ? (
          <Alert severity="info">This engagement isn&apos;t one you can open, or it doesn&apos;t exist.</Alert>
        ) : (
          <Failed what="the engagement" error={engagement.error} onRetry={() => void engagement.refetch()} retrying={engagement.isFetching} />
        )}
      </EaPage>
    );
  }
  if (!(engagement.data.actions?.allocate ?? canAllocateType(p, engagement.data.typeId))) return <Navigate to={engagementPaths.engagement(id)} replace />;
  return <Allocate key={id} e={engagement.data} />;
}

function Allocate({ e }: { e: Engagement }): JSX.Element {
  const { p } = useEngagementAccess();
  const ref = useReferenceData();
  const org = useOrgStructure();
  const { actionsFor, dialogs } = useEngagementActions();
  const today = localIsoDate();
  const closed = e.requestStatus === "Pending Approval" || e.requestStatus === "Cancelled";
  const [mode, setMode] = useState<Mode>("email");
  const [people, setPeople] = useState<EmployeeOption[]>([]);
  const [team, setTeam] = useState({ businessUnit: "", department: "", team: "" });
  const [range, setRange] = useState({ start: addDays(e.start, -28), end: addDays(e.end, 28) });
  const [draftRange, setDraftRange] = useState(range);
  const [timeZone, setTimeZone] = useState("");
  const zones = ref.data?.timeZones ?? [];
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zone = timeZone || (zones.includes(browserZone) ? browserZone : (zones[0] ?? ""));
  const [allocating, setAllocating] = useState<Person | null>(null);
  const [notice, setNotice] = useState("");
  const [statusOf, setStatusOf] = useState<Allocation | null>(null);

  const teamChosen = Boolean(team.businessUnit || team.department || team.team);
  const asked = mode === "email" ? people.map((x) => x.email) : [];
  const win = { from: range.start, to: range.end };
  const timeline = useAllocationTimeline(
    mode === "team"
      ? { ...win, businessUnit: team.businessUnit || undefined, department: team.department || undefined, team: team.team || undefined }
      : { ...win, email: asked },
    mode === "team" ? teamChosen : asked.length > 0,
  );
  const byEmail = new Map((timeline.data ?? []).map((r) => [r.person.email.toLowerCase(), r]));
  // Search by Email keeps the picking order; Search by Team is the backend's list.
  const shown: EmployeeOption[] = mode === "email" ? people : (timeline.data ?? []).map((r) => r.person);
  const itemsOf = (email: string) => byEmail.get(email.toLowerCase())?.items ?? [];

  const allocate = (who: EmployeeOption) => {
    if (e.end < today) return setNotice("You cannot allocate for past engagements");
    // The legacy pre-check: a non-hourly allocation already covering the whole engagement.
    const covering = itemsOf(who.email).some((a) => a.kind === "engagement" && !a.hourly && a.start <= e.start && a.end >= e.end);
    if (covering) {
      return setNotice(
        "This person is already allocated for the whole engagement period. If the timeline does not show it, refresh the timeline and try again.",
      );
    }
    setNotice("");
    setAllocating(who);
  };

  const rows: TimelineRow[] = shown.map((who) => ({
        key: who.email,
        label: who.name || who.email,
        sub: who.jobBand ?? who.title,
        bars: itemsOf(who.email).map((a) => ({
          key: a.id,
          start: a.start,
          end: a.end,
          label: a.label || `${a.code}: ${a.allocationType}`,
          title:
            a.kind === "default"
              ? `${a.id}: ${a.allocationType} (team allocation), ${fmtRange(a.start, a.end)}`
              : `${a.id}: ${a.label}, ${fmtRange(a.start, a.end)}${a.status ? ` (${a.status})` : ""}`,
          color: a.color || typeColor(a.allocationType),
          type: a.allocationType,
          thin: Boolean(a.hourly),
        })),
        action: (
          <Stack direction="row" spacing={0.5}>
            <Button size="small" variant="contained" disabled={closed} onClick={() => allocate(who)}>
              Allocate
            </Button>
          </Stack>
        ),
      }));

  const { menu } = actionsFor(e);
  // Only the request status actions belong here (Mark as Completed / Reopen); Edit and Allocate live on the engagement.
  const statusMenu = menu.filter((m) => m.label === "Mark as Completed" || m.label === "Reopen");
  const departments = (org.data?.departments ?? []).filter((d) => !team.businessUnit || d.businessUnit === team.businessUnit).map((d) => d.name);
  const teams = (org.data?.teams ?? []).filter(
    (t) => (!team.businessUnit || t.businessUnit === team.businessUnit) && (!team.department || t.department === team.department),
  );

  return (
    <EaPage
      title={`Allocate ${e.id}`}
      chips={<RequestStatusChip status={e.requestStatus} />}
      subtitle={e.title}
      back={{ to: engagementPaths.engagement(e.id), label: e.id }}
      actions={<RowActions menu={statusMenu} label={e.id} />}
    >
      {closed ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {e.requestStatus === "Pending Approval"
            ? "This engagement is waiting for approval. People can be allocated once it is approved."
            : "This engagement is cancelled."}
        </Alert>
      ) : null}
      <FactsCard
        facts={[
          { label: e.kind === "marketing" ? "Event ID" : "Engagement ID", value: <Mono>{e.id}</Mono> },
          { label: "Engagement Code", value: <Mono>{e.code}</Mono> },
          { label: "Account", value: e.account },
          { label: e.kind === "customer" ? "Opportunity Name" : e.kind === "marketing" ? "Event Name" : "Name / Purpose", value: e.title },
          e.product && { label: "Product", value: e.product },
          { label: "Dates", value: fmtRange(e.start, e.end) },
          { label: "Location", value: <Two main={place(e.country, e.city)} sub={e.nature} /> },
        ]}
      />
      <ListCard>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={mode}
          onChange={(_, v: Mode | null) => v && setMode(v)}
          aria-label="How to find consultants"
          sx={{ mb: 2, "& .MuiToggleButton-root": { fontWeight: 600, px: 2 } }}
        >
          <ToggleButton value="email">Search by Email</ToggleButton>
          <ToggleButton value="team">Search by Team</ToggleButton>
        </ToggleButtonGroup>

        {mode === "email" ? (
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} sx={{ alignItems: { md: "flex-start" }, mb: 2 }}>
            <Box sx={{ flex: 1, maxWidth: 520 }}>
              <PersonPicker
                label="Search by Email"
                value={null}
                onChange={(who) => who && !people.some((x) => x.email === who.email) && setPeople((list) => [...list, who])}
              />
            </Box>
            {people.length ? (
              <Button onClick={() => setPeople([])} sx={{ height: 40 }}>
                Clear Consultants
              </Button>
            ) : null}
          </Stack>
        ) : null}

        <FilterBar
          searchLabel="Refresh"
          onSearch={() => {
            if (draftRange.start && draftRange.end && draftRange.start <= draftRange.end) setRange(draftRange);
            void timeline.refetch();
          }}
        >
          {mode === "team" ? (
            <>
              <FilterSelect
                label="Business Unit"
                value={team.businessUnit}
                options={org.data?.businessUnits ?? ref.data?.businessUnits ?? []}
                onChange={(v) => setTeam({ businessUnit: v, department: "", team: "" })}
              />
              <FilterSelect label="Department" value={team.department} options={departments} onChange={(v) => setTeam((t) => ({ ...t, department: v, team: "" }))} />
              <FilterSelect label="Team" value={team.team} options={teams.map((t) => t.name)} onChange={(v) => setTeam((t) => ({ ...t, team: v }))} />
            </>
          ) : null}
          <FilterDate label="Start Date" value={draftRange.start} onChange={(v) => setDraftRange((r) => ({ ...r, start: v }))} />
          <FilterDate label="End Date" value={draftRange.end} onChange={(v) => setDraftRange((r) => ({ ...r, end: v }))} />
          <SearchSelect label="Select Time Zone" value={zone} options={ref.data?.timeZones ?? []} onChange={(v) => v && setTimeZone(v)} />
        </FilterBar>
        {notice ? (
          <Alert severity="info" sx={{ mb: 1.5 }} onClose={() => setNotice("")}>
            {notice}
          </Alert>
        ) : null}
        {timeline.isError ? <Failed what="their allocations" error={timeline.error} onRetry={() => void timeline.refetch()} retrying={timeline.isFetching} /> : null}
        {timeline.isPending && timeline.fetchStatus !== "idle" ? (
          <Skeleton variant="rounded" height={220} />
        ) : (
        <Timeline
          start={range.start}
          end={range.end}
          rows={rows}
          marks={[
            { date: today, label: "Today", tone: "today" },
            { date: e.start, label: "Engagement Start", tone: "engagement" },
            { date: e.end, label: "Engagement End", tone: "engagement" },
          ]}
          empty={`${mode === "email" ? "Pick a consultant to see their allocations" : "Pick a Business Unit, Department or Team"} around the engagement dates, ${fmtRange(e.start, e.end)}.`}
        />
        )}
      </ListCard>

      <ListCard spaced>
        <SectionTitle>Allocation Records</SectionTitle>
        <AllocationRecords
          allocations={e.allocations}
          canChangeStatus={e.actions?.changeAllocationStatus ?? canEditAllocationStatus(p, e.typeId)}
          onChangeStatus={setStatusOf}
          empty={<Empty title="No Allocations Yet" body="Pick a consultant above and allocate them to this engagement." />}
        />
      </ListCard>

      {allocating ? (
        <AllocationDialog
          engagement={e}
          consultant={allocating}
          timeZones={ref.data?.timeZones ?? []}
          defaultTimeZone={zone || undefined}
          onClose={() => setAllocating(null)}
        />
      ) : null}
      {statusOf ? <AllocationStatusDialog allocation={statusOf} onClose={() => setStatusOf(null)} /> : null}
      {dialogs}
    </EaPage>
  );
}
