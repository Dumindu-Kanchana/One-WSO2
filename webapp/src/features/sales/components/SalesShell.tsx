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

import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { Alert, Box, CircularProgress, Stack, Typography } from "@wso2/oxygen-ui";
import PerspectiveHeader from "@components/perspective-header/PerspectiveHeader";
import { NothingHere, PageTitle } from "@components/perspective-landing/PerspectiveLanding";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useActivePerspective } from "@context/perspective/PerspectiveContext";
import { useSalesUserInfo } from "../api/useSalesData";
import { isForbidden } from "../util/salesError";

/**
 * Page frame for Sales: the heading, and the whole-page states that must pre-empt the content
 * rather than sit inside it.
 *
 * A ladder of guards, in the same order as MarketingOpsShell and PerspectiveLanding, and the
 * order is the point:
 *
 *   not configured -> say which key to set; there is nothing to ask.
 *   checking       -> hold the page. Rendering the content while meet-app's answer is still in
 *                     flight is what made the meetings grid flash up and then be replaced by
 *                     "Nothing here for you yet" for someone with no access.
 *   refused (403)  -> the same no-access screen every other perspective shows.
 *   check failed   -> say so, with a Retry. Checked after the 403 so an outage is never
 *                     reported as a missing permission.
 *   allowed        -> the page.

 */
export default function SalesShell({
  title,
  subtitle,
  configured,
  configKey,
  configLabel = "the meet-app backend URL",
  forbidden,
  children,
}: {
  title: string;
  subtitle?: string;
  configured: boolean;
  configKey: string;
  /** What configKey points at, for the not-connected message. */
  configLabel?: string;
  /** True when the backend has refused this caller outright (403). */
  forbidden?: boolean;
  children: ReactNode;
}) {
  const active = useActivePerspective();
  const access = useSalesUserInfo();
  const { pathname } = useLocation();

  if (!configured) {
    return (
      <Box>
        <PerspectiveHeader title={title} subtitle={subtitle} />
        <Alert severity="info" sx={{ mt: 1.5 }}>
          Sales isn&apos;t connected yet. Set <code>{configKey}</code> in{" "}
          <code>public/config.js</code> ({configLabel}) and reload.
        </Alert>
      </Box>
    );
  }

  const refused = forbidden || isForbidden(access.error);

  // isPending as well as isLoading: while the caller's identity is still resolving the query is
  // disabled, which React Query reports as pending but not loading -- see useSalesRailGate.
  if (!refused && (access.isPending || access.isLoading)) {
    return (
      <Box>
        <PageTitle label={active.label} />
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mt: 2 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            Checking your {active.label} access…
          </Typography>
        </Stack>
      </Box>
    );
  }

  // No access
  if (refused) {
    // An inner page (a meeting, say) leaves for the perspective's own page first, which then
    // shows the card -- the way MarketingOpsShell sends a locked caller back to /marketing-ops,
    // rather than showing a "whole app is closed to you" card under a single meeting's URL.
    if (active.path && pathname !== active.path) return <Navigate to={active.path} replace />;
    return (
      <Box>
        <PageTitle label={active.label} />
        <NothingHere label={active.label} icon={active.icon} />
      </Box>
    );
  }

  if (access.isError) {
    return (
      <Box>
        <PageTitle label={active.label} />
        <ErrorNotice onRetry={() => void access.refetch()} error={access.error} sx={{ mt: 1.5 }}>
          Couldn&apos;t check your {active.label} access.
        </ErrorNotice>
      </Box>
    );
  }

  return (
    <Box>
      <PerspectiveHeader title={title} subtitle={subtitle} />
      {children}
    </Box>
  );
}
