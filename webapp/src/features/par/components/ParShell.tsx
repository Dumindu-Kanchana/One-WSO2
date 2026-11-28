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
import { Alert, Box, Typography } from "@wso2/oxygen-ui";
import { isParBackendConfigured } from "../api/useParData";

// Shared page frame for the Employee and Lead Portals: a title + optional
// subtitle, and one place that renders the "backend not configured" state
// so both behave the same when ONE_WSO2_PAR_BACKEND_URL isn't set. Same
// shape as LeaveShell/FinanceShell — title/subtitle are the CALLER's own
// heading, not a shared app-name banner: each portal already names itself,
// so a generic "Performance Appraisal Review" label above that would say
// the same thing twice.
// Every PAR page is centred and capped, as other One App pages are, so it looks the same on a laptop and on a wide
// external monitor; each tab fills it.
const PAR_PAGE_MAX_WIDTH = 1440;

export default function ParShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  /** The page's own actions, at the end of the subtitle's line (below it when there isn't room). */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const configured = isParBackendConfigured();
  return (
    <Box sx={{ width: "100%", maxWidth: PAR_PAGE_MAX_WIDTH, mx: "auto" }}>
      <Typography component="h1" variant="h5" sx={{ mb: 0.5, fontWeight: 600 }}>
        {title}
      </Typography>
      {(subtitle || actions) && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            columnGap: 2,
            rowGap: 1,
            mb: 2.25,
          }}
        >
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
          {configured && actions}
        </Box>
      )}

      {configured ? (
        children
      ) : (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          PAR isn't connected yet. Set <code>ONE_WSO2_PAR_BACKEND_URL</code> in{" "}
          <code>public/config.js</code> (the par-app backend URL) and reload.
        </Alert>
      )}
    </Box>
  );
}
