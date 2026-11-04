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
import { Navigate, Outlet, useLocation } from "react-router";
import { Stack } from "@wso2/oxygen-ui";
import { useMeProfile } from "@features/my/api/useMeProfile";
import { useActiveParCycle } from "../api/useParData";
import ParCycleTracker from "../components/ParCycleTracker";
import type { HomeStepKey } from "../util/parHome";

const BASE = "/me/performance/cycle";

const STEPS: HomeStepKey[] = ["self-review", "360", "lead-review", "f2f"];

// Me → Performance → Active cycle (PAR 2.0): everything about your own PAR in
// the open cycle. The phase tracker on top is the way around: each step opens
// its part below (the lead's review shows on the self-review page once the
// lead shares).
export default function ParActiveCycleTab() {
  const { pathname } = useLocation();
  const profile = useMeProfile();
  const workEmail = profile.data?.userInfo.workEmail;
  const cycle = useActiveParCycle(workEmail).data?.[0];
  const selected = STEPS.find((step) => pathname.startsWith(`${BASE}/${step}`)) ?? "self-review";

  return (
    <Stack spacing={2}>
      {cycle && workEmail && <ParCycleTracker cycle={cycle} workEmail={workEmail} selected={selected} />}
      <Outlet />
    </Stack>
  );
}

/** The tab's own URL opens the self-review. */
export function ParActiveCycleIndex() {
  return <Navigate to={`${BASE}/self-review`} replace />;
}
