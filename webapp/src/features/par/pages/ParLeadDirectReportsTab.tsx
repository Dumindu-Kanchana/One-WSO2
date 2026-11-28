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

import { useState } from "react";
import { Alert, Skeleton } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useMeProfile } from "@features/my/api/useMeProfile";
import { useActiveParCycle } from "../api/useParData";
import { useParTeams } from "../api/useLeadTeams";
import ParEmptyState from "../components/ParEmptyState";
import ParLeadTeamRoster from "../components/ParLeadTeamRoster";
import ParLeadReviewTabs from "../components/ParLeadReviewTabs";

// Lead View → Direct Reports: every direct report in one list, across the lead's teams (a Team column tells them
// apart and filters by them), and a member's review in place.
export default function ParLeadDirectReportsTab() {
  const profile = useMeProfile();
  const workEmail = profile.data?.userInfo.workEmail;
  const activeCycles = useActiveParCycle(workEmail);
  const cycle = activeCycles.data?.[0];
  const teams = useParTeams(cycle?.parCycleId, workEmail);
  const [reviewEmployeeEmail, setReviewEmployeeEmail] = useState<string | undefined>(undefined);

  if (activeCycles.isLoading || profile.isLoading) {
    return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1.5 }} />;
  }
  if (profile.isError) {
    return (
      <ErrorNotice error={profile.error} onRetry={() => profile.refetch()} retrying={profile.isFetching}>
        Couldn't load your profile.
      </ErrorNotice>
    );
  }
  if (activeCycles.isError) {
    return (
      <ErrorNotice error={activeCycles.error} onRetry={() => activeCycles.refetch()} retrying={activeCycles.isFetching}>
        Couldn't load the current PAR cycle.
      </ErrorNotice>
    );
  }
  if (!cycle) {
    return <Alert severity="info">Currently there is no ongoing PAR cycle</Alert>;
  }
  if (teams.isLoading) {
    return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1.5 }} />;
  }
  if (teams.isError) {
    return (
      <ErrorNotice error={teams.error} onRetry={() => teams.refetch()} retrying={teams.isFetching}>
        Couldn't load your teams.
      </ErrorNotice>
    );
  }

  const rows = teams.data ?? [];
  if (rows.length === 0) {
    return <ParEmptyState text="No teams found under your lead" />;
  }

  if (reviewEmployeeEmail) {
    return (
      <ParLeadReviewTabs cycle={cycle} employeeEmail={reviewEmployeeEmail} onBack={() => setReviewEmployeeEmail(undefined)} />
    );
  }

  return <ParLeadTeamRoster cycle={cycle} teams={rows} onOpenReview={setReviewEmployeeEmail} />;
}
