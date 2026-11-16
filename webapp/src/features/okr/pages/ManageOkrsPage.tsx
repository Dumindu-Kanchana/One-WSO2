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

import { useMemo, useState, type ReactNode } from "react";
import { Navigate } from "react-router";
import {
  Box,
  Button,
  Card,
  IconButton,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { PlusIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import PerspectiveHeader from "@components/perspective-header/PerspectiveHeader";
import { useUserInfo } from "@api/useUserInfo";
import { capabilitiesFromPrivileges } from "@constants/appMenu";
import type { OkrScope } from "../api/okrTypes";
import { useOkrList } from "../api/useOkrs";
import OkrDialog from "../components/OkrDialog";
import OkrFilterBar from "../components/OkrFilterBar";
import OkrObjectiveCard from "../components/OkrObjectiveCard";
import { NO_OKR_FILTERS, filterOkrBoards, keyResultProgress, okrBoards, type OkrFilters } from "../util/okr";

// People Ops → Manage OKRs: your team's OKRs, one board per person, each with
// what they're accountable for: the objectives they own and their key results
// on others' objectives, yours included. Your own objectives are on My OKRs. A
// lead sets objectives for anyone below them in their reporting chain and gives
// key results to people in that person's team; a People Ops admin can do it for
// everyone.
export default function ManageOkrsPage() {
  const { admin: isAdmin, userInfo } = useOkrCapabilities();
  const [scope, setScope] = useState<OkrScope>("team");
  const shownScope: OkrScope = isAdmin ? scope : "team";
  const okrs = useOkrList(shownScope);
  const [filters, setFilters] = useState<OkrFilters>(NO_OKR_FILTERS);
  const [dialog, setDialog] = useState<{ owner?: { workEmail: string; name?: string } } | null>(null);
  const me = userInfo.data?.workEmail ?? "";

  const boards = useMemo(() => okrBoards(okrs.data ?? [], me, shownScope), [okrs.data, me, shownScope]);
  const counts = useMemo(() => {
    // Each objective and key result once, though one can sit on two boards (its
    // owner's, and the board of someone with a key result on it).
    const okrsShown = new Map(boards.flatMap((b) => b.okrs.map((o) => [o.okrId, o] as const)));
    const keyResults = new Map(
      boards.flatMap((b) => b.okrs.flatMap((o) => o.keyResults.map((k) => [k.keyResultId, { o, k }] as const))),
    );
    // Closed objectives are counted apart, as they show apart.
    const current = [...okrsShown.values()].filter((o) => o.status !== "CLOSED");
    return {
      people: boards.filter((b) => b.okrs.some((o) => o.status !== "CLOSED")).length,
      objectives: current.length,
      keyResults: keyResultProgress(
        [...keyResults.values()].map(({ o, k }) => ({ ...o, keyResults: [k] })),
      ),
      closed: okrsShown.size - current.length,
    };
  }, [boards]);
  const shown = useMemo(() => filterOkrBoards(boards, filters), [boards, filters]);

  return (
    <Box>
      <PerspectiveHeader
        title="Manage OKRs"
        subtitle="Your team's objectives and key results, and where each one stands. Your own are on My OKRs."
      />
      <Stack spacing={2} sx={{ maxWidth: 1200 }}>
        <OkrFilterBar
          filters={filters}
          onChange={setFilters}
          searchLabel="Search people, objectives or key results"
          extra={
            isAdmin && (
              <ToggleButtonGroup
                size="small"
                exclusive
                value={scope}
                onChange={(_e, v: OkrScope | null) => v && setScope(v)}
                aria-label="Whose OKRs"
              >
                <ToggleButton value="team">My team</ToggleButton>
                <ToggleButton value="all">Everyone</ToggleButton>
              </ToggleButtonGroup>
            )
          }
          actions={
            <Button variant="contained" startIcon={<PlusIcon size={16} />} onClick={() => setDialog({})}>
              Set an OKR
            </Button>
          }
        />

        {okrs.isSuccess && (
          <Typography variant="body2" color="text.secondary">
            {counts.objectives} {counts.objectives === 1 ? "objective" : "objectives"} for {counts.people}{" "}
            {counts.people === 1 ? "person" : "people"} · {counts.keyResults.completed} of {counts.keyResults.total} key
            results completed · {counts.keyResults.overdue} overdue
            {counts.closed > 0 && filters.status !== "closed" ? ` · ${counts.closed} closed, under Closed` : ""}
          </Typography>
        )}

        {okrs.isLoading ? (
          <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 1.5 }} />
        ) : okrs.isError ? (
          <ErrorNotice error={okrs.error} onRetry={() => okrs.refetch()} retrying={okrs.isFetching}>
            Couldn&apos;t load OKRs.
          </ErrorNotice>
        ) : shown.length === 0 ? (
          <Card variant="outlined" sx={{ p: 4, textAlign: "center" }}>
            <Typography sx={{ fontWeight: 600 }}>{boards.length === 0 ? "No OKRs yet" : "Nothing matches"}</Typography>
            <Typography variant="body2" color="text.secondary">
              {boards.length === 0
                ? "Set the first one for someone in your team: pick who, write the objective and its key results."
                : "Try another search or filter."}
            </Typography>
          </Card>
        ) : (
          shown.map((board) => {
            const keyResults = board.okrs.reduce((n, o) => n + o.keyResults.length, 0);
            const name = board.name ?? board.email;
            return (
              <Box component="section" key={board.email} aria-label={`${name}'s OKRs`}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 1.5,
                    borderBottom: 2,
                    borderColor: "text.primary",
                    pb: 0.75,
                    mb: 1.5,
                    flexWrap: "wrap",
                  }}
                >
                  <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
                    {name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 0 }} noWrap>
                    {board.email}
                    {board.leadEmail ? ` · Lead: ${board.leadEmail}` : ""}
                  </Typography>
                  <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                    {board.okrs.length} {board.okrs.length === 1 ? "objective" : "objectives"} · {keyResults} key{" "}
                    {keyResults === 1 ? "result" : "results"}
                  </Typography>
                  <Tooltip title={`Set an OKR for ${name}`}>
                    <IconButton
                      size="small"
                      aria-label={`Set an OKR for ${name}`}
                      onClick={() => setDialog({ owner: { workEmail: board.email, name: board.name } })}
                    >
                      <PlusIcon size={16} />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Stack spacing={1.5}>
                  {board.okrs.map((okr, i) => (
                    <OkrObjectiveCard
                      key={okr.okrId}
                      okr={okr}
                      index={i}
                      othersObjective={okr.ownerEmail.toLowerCase() !== board.email.toLowerCase()}
                    />
                  ))}
                </Stack>
              </Box>
            );
          })
        )}
      </Stack>

      {dialog && <OkrDialog open owner={dialog.owner} canPickAnyone={isAdmin} onClose={() => setDialog(null)} />}
    </Box>
  );
}

/** Whether the signed-in user leads anyone, and whether they're a People Ops
 * admin, from the people backend's /user-info (the same answer the side rail
 * reads). */
function useOkrCapabilities() {
  const userInfo = useUserInfo();
  const caps = capabilitiesFromPrivileges(userInfo.data?.privileges);
  return { lead: caps.has("lead"), admin: caps.has("admin"), userInfo };
}

/** Guards Manage OKRs: leads and People Ops admins. The backend decides who
 * each OKR is for either way; this keeps everyone else off a page with nothing
 * on it for them. */
export function RequiresOkrManagerRoute({ children }: { children: ReactNode }) {
  const { lead, admin, userInfo } = useOkrCapabilities();
  if (userInfo.isLoading) return null;
  if (userInfo.isError) {
    return (
      <Box sx={{ p: 2 }}>
        <ErrorNotice error={userInfo.error} onRetry={() => userInfo.refetch()}>
          Couldn&apos;t check whether you can set OKRs.
        </ErrorNotice>
      </Box>
    );
  }
  if (!lead && !admin) return <Navigate to="/me/okrs" replace />;
  return <>{children}</>;
}
