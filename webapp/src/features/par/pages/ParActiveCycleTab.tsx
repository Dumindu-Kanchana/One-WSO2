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
import { Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { Stack, ToggleButton, ToggleButtonGroup } from "@wso2/oxygen-ui";

const BASE = "/me/performance/cycle";

// Active cycle sections. Lead review and the finished PAR show on the
// self-review page, once the lead shares.
const SECTIONS = [
  { segment: "self-review", label: "Self-review" },
  { segment: "360", label: "360° feedback" },
  { segment: "f2f", label: "F2F" },
] as const;

// Me → Performance → Active cycle (PAR 2.0): everything about your own PAR in
// the open cycle, one section at a time. The pinned tracker above the tabs
// opens the same sections.
export default function ParActiveCycleTab() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const current = SECTIONS.find((s) => pathname.startsWith(`${BASE}/${s.segment}`))?.segment ?? "self-review";

  return (
    <Stack spacing={2}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={current}
        onChange={(_, next: string | null) => next && navigate(`${BASE}/${next}`)}
        aria-label="Active cycle sections"
        sx={{ alignSelf: "flex-start" }}
      >
        {SECTIONS.map((s) => (
          <ToggleButton key={s.segment} value={s.segment} sx={{ textTransform: "none", px: 2 }}>
            {s.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Outlet />
    </Stack>
  );
}

/** The tab's own URL opens the self-review. */
export function ParActiveCycleIndex() {
  return <Navigate to={`${BASE}/self-review`} replace />;
}
