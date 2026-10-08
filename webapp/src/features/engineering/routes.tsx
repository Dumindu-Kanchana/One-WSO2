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

// Every Engineering route, as one fragment for App.tsx.
//
// Registered even while the `engineering` preview flag is off, which is this
// perspective's deliberate exception to hiding a preview feature's routes:
// each screen's shell says Engineering is not available, where omitting the
// routes would hand a direct visit to the catch-all and the person's landing
// with no answer. See the Engineering entry in perspectives.ts.
//
// Access is NOT enforced here: DownloadStatsShell walks the gate ladder in
// front of every screen, so typing an Admin address you may not use gives a
// legible refusal rather than a redirect that leaves the reader guessing.

import type { JSX } from "react";
import { Route } from "react-router";
import {
  DOWNLOAD_STATS_PATH,
  downloadStatsPaths,
  type DownloadStatsScreen,
} from "@constants/downloadStatsApps";
import ForwardKeepingQuery from "./components/ForwardKeepingQuery";
import EngineeringLanding from "./pages/EngineeringLanding";
import EngineeringOverviewPage from "./pages/EngineeringOverviewPage";
import EngineeringDownloadsPage from "./pages/EngineeringDownloadsPage";
import EngineeringVersionsPage from "./pages/EngineeringVersionsPage";
import EngineeringPackagesPage from "./pages/EngineeringPackagesPage";
import EngineeringRepositoryStatsPage from "./pages/EngineeringRepositoryStatsPage";
import EngineeringAdminPage from "./pages/EngineeringAdminPage";

// What each screen renders, keyed as the registry keys its paths, so the rail
// and the route table cannot name a screen two different ways.
const SCREEN_ELEMENTS: Readonly<Record<DownloadStatsScreen, JSX.Element>> = {
  overview: <EngineeringOverviewPage />,
  downloads: <EngineeringDownloadsPage />,
  versions: <EngineeringVersionsPage />,
  packages: <EngineeringPackagesPage />,
  repositoryStats: <EngineeringRepositoryStatsPage />,
  admin: <EngineeringAdminPage />,
};

// Earlier addresses that forward to each screen: perspective / screen, and
// the screen each one now lives at. Overview's earlier address was
// /engineering itself, which is the landing and already forwards.
const EARLIER_ADDRESSES: ReadonlyArray<readonly [string, DownloadStatsScreen]> = [
  ["/engineering/downloads", "downloads"],
  ["/engineering/versions", "versions"],
  ["/engineering/packages", "packages"],
  ["/engineering/repository-stats", "repositoryStats"],
  ["/engineering/admin", "admin"],
];

// App.tsx mounts its routes beneath pathless layout routes and writes them
// without the leading slash; the registry writes full paths for links.
const relative = (path: string): string => path.replace(/^\//, "");

export const engineeringRoutes = (
  <>
    <Route path="engineering" element={<EngineeringLanding />} />
    {/* The app's root is not a screen; a link to the app itself opens Overview. */}
    <Route
      path={relative(DOWNLOAD_STATS_PATH)}
      element={<ForwardKeepingQuery to={downloadStatsPaths.overview} />}
    />
    {(Object.keys(SCREEN_ELEMENTS) as DownloadStatsScreen[]).map((screen) => (
      <Route
        key={screen}
        path={relative(downloadStatsPaths[screen])}
        element={SCREEN_ELEMENTS[screen]}
      />
    ))}
    {EARLIER_ADDRESSES.map(([old, screen]) => (
      <Route
        key={old}
        path={relative(old)}
        element={<ForwardKeepingQuery to={downloadStatsPaths[screen]} />}
      />
    ))}
  </>
);
