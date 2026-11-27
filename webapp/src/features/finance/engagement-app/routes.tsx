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

// Every Engagement App route, as two fragments for App.tsx: the Finance screens under /finance/engagement-app and the person's own under /me.

import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route } from "react-router";
import { Box } from "@wso2/oxygen-ui";
import { ENGAGEMENT_APP_PATH } from "./engagementPaths";
import EngagementShell, { EngagementLanding, EngagementRequires, type EngagementNeed } from "./components/EngagementShell";

const dashboardModule = () => import("./dashboard/DashboardPage");
const DashboardPage = lazy(dashboardModule);
const approvalsModule = () => import("./approvals/ApprovalsPage");
const ApprovalsPage = lazy(approvalsModule);
const ApprovalsIndex = lazy(() => approvalsModule().then((m) => ({ default: m.ApprovalsIndex })));
const engagementsModule = () => import("./engagements/EngagementsPage");
const EngagementsPage = lazy(engagementsModule);
const EngagementsIndex = lazy(() => engagementsModule().then((m) => ({ default: m.EngagementsIndex })));
const engagementModule = () => import("./engagements/EngagementPage");
const EngagementPage = lazy(engagementModule);
const formModule = () => import("./engagements/EngagementFormPage");
const CreateEngagementPage = lazy(() => formModule().then((m) => ({ default: m.CreateEngagementPage })));
const EditEngagementPage = lazy(() => formModule().then((m) => ({ default: m.EditEngagementPage })));
const AllocatePage = lazy(() => import("./allocations/AllocatePage"));
const allocationsModule = () => import("./allocations/AllocationsPage");
const AllocationsPage = lazy(allocationsModule);
const AllocationsIndex = lazy(() => allocationsModule().then((m) => ({ default: m.AllocationsIndex })));
const travelModule = () => import("./travel/TravelRequestsPage");
const TravelRequestsPage = lazy(travelModule);
const TravelRequestsIndex = lazy(() => travelModule().then((m) => ({ default: m.TravelRequestsIndex })));
const travelRequestModule = () => import("./travel/TravelRequestPage");
const TravelRequestPage = lazy(travelRequestModule);
const invoicesModule = () => import("./invoices/InvoicesPage");
const InvoicesPage = lazy(invoicesModule);
const InvoicesIndex = lazy(() => invoicesModule().then((m) => ({ default: m.InvoicesIndex })));
const reportsModule = () => import("./reports/ReportsPage");
const ReportsPage = lazy(reportsModule);
const ReportsIndex = lazy(() => reportsModule().then((m) => ({ default: m.ReportsIndex })));
const documentsModule = () => import("./documents/DocumentsPage");
const DocumentsPage = lazy(documentsModule);
const DocumentsIndex = lazy(() => documentsModule().then((m) => ({ default: m.DocumentsIndex })));
const settingsModule = () => import("./settings/SettingsPage");
const SettingsPage = lazy(settingsModule);
const SettingsIndex = lazy(() => settingsModule().then((m) => ({ default: m.SettingsIndex })));
const SearchPage = lazy(() => import("./search/SearchPage"));
const MyTravelRequestsPage = lazy(() => import("./me/MyTravelRequestsPage"));
const MyAllocationsPage = lazy(() => import("./me/MyAllocationsPage"));

// The page the address opens: fetch its code while sign-in and /user-info are still running, not after them. The first match wins.
const PRELOAD: readonly (readonly [RegExp, () => Promise<unknown>])[] = [
  [new RegExp(`${ENGAGEMENT_APP_PATH}(/dashboard)?/?$`), dashboardModule],
  [new RegExp(`${ENGAGEMENT_APP_PATH}/approvals/(internal|marketing)`), approvalsModule],
  [new RegExp(`${ENGAGEMENT_APP_PATH}/engagements/(customer|internal|marketing)$`), engagementsModule],
  [new RegExp(`${ENGAGEMENT_APP_PATH}/engagements/(new/|[^/]+/edit)`), formModule],
  [new RegExp(`(${ENGAGEMENT_APP_PATH}/engagements|/me/allocations)/[^/]+/(allocations|details)`), engagementModule],
  [new RegExp(`${ENGAGEMENT_APP_PATH}/allocations/`), allocationsModule],
  [new RegExp(`${ENGAGEMENT_APP_PATH}/travel-requests/(new|in-progress|completed|all)$`), travelModule],
  [new RegExp(`(${ENGAGEMENT_APP_PATH}|/me)/travel-requests/[^/]+/`), travelRequestModule],
  [new RegExp(`${ENGAGEMENT_APP_PATH}/invoices/`), invoicesModule],
  [new RegExp(`${ENGAGEMENT_APP_PATH}/reports/`), reportsModule],
  [new RegExp(`(${ENGAGEMENT_APP_PATH}/visas-documents|/me/passport-visas)/`), documentsModule],
  [new RegExp(`${ENGAGEMENT_APP_PATH}/settings/`), settingsModule],
];
if (typeof window !== "undefined") void PRELOAD.find(([path]) => path.test(window.location.pathname))?.[1]();

// Space only, no skeleton of its own: the page that loads draws the one skeleton for its body, so there is not a second one before it.
const loading = <Box sx={{ minHeight: 240 }} aria-busy="true" />;

/** A page behind the privilege it needs, loaded on first use. */
const gated = (need: EngagementNeed | readonly EngagementNeed[], page: ReactNode, area: "finance" | "me" = "finance") => (
  <EngagementRequires need={need} area={area}>
    <Suspense fallback={loading}>{page}</Suspense>
  </EngagementRequires>
);

export const engagementRoutes = (
  <Route path="finance/engagement-app" element={<EngagementShell area="finance" />}>
    <Route index element={<EngagementLanding />} />
    <Route path="dashboard" element={gated("dashboard", <DashboardPage />)} />

    <Route path="approvals" element={gated("approvals", <ApprovalsIndex />)} />
    <Route path="approvals/internal" element={gated("approvals", <ApprovalsPage segment="internal" />)} />
    <Route path="approvals/marketing" element={gated("approvals", <ApprovalsPage segment="marketing" />)} />
    <Route path="approvals/edit/:id" element={gated(["engagements", "approvals"], <EditEngagementPage pending />)} />

    <Route path="engagements" element={gated("engagements", <EngagementsIndex />)} />
    <Route path="engagements/customer" element={gated("engagements", <EngagementsPage segment="customer" />)} />
    <Route path="engagements/internal" element={gated("engagements", <EngagementsPage segment="internal" />)} />
    <Route path="engagements/marketing" element={gated("engagements", <EngagementsPage segment="marketing" />)} />
    <Route path="engagements/new/:kind" element={gated(["createCustomer", "createInternal", "createMarketing"], <CreateEngagementPage />)} />
    {/* An engagement is open to the engagement, approval and allocation roles;
        the backend decides per record how much. Each tab is a route. */}
    <Route path="engagements/:id" element={<Navigate to="allocations" replace />} />
    <Route path="engagements/:id/edit" element={gated(["engagements", "approvals"], <EditEngagementPage />)} />
    <Route path="engagements/:id/allocate" element={gated(["engagements", "allocations"], <AllocatePage />)} />
    <Route path="engagements/:id/:tab" element={gated(["engagements", "approvals", "allocations"], <EngagementPage />)} />

    <Route path="allocations" element={gated("allocations", <AllocationsIndex />)} />
    <Route path="allocations/engagement" element={gated("allocations", <AllocationsPage segment="engagement" />)} />
    <Route path="allocations/team" element={gated("allocations", <AllocationsPage segment="team" />)} />

    <Route path="travel-requests" element={gated("travelRequests", <TravelRequestsIndex />)} />
    <Route path="travel-requests/new" element={gated("travelRequests", <TravelRequestsPage segment="new" />)} />
    <Route path="travel-requests/in-progress" element={gated("travelRequests", <TravelRequestsPage segment="in-progress" />)} />
    <Route path="travel-requests/completed" element={gated("travelRequests", <TravelRequestsPage segment="completed" />)} />
    <Route path="travel-requests/all" element={gated("travelRequests", <TravelRequestsPage segment="all" />)} />
    <Route path="travel-requests/:job" element={<Navigate to="info" replace />} />
    <Route path="travel-requests/:job/:tab" element={gated(["travelRequests", "invoices"], <TravelRequestPage />)} />

    <Route path="invoices" element={gated("invoices", <InvoicesIndex />)} />
    {(["po", "finance", "push", "payments-push", "sync-failures", "all-invoices", "all-payments"] as const).map((tab) => (
      <Route key={tab} path={`invoices/${tab}`} element={gated("invoices", <InvoicesPage tab={tab} />)} />
    ))}

    <Route path="search" element={gated("anyFinance", <SearchPage />)} />

    <Route path="reports" element={gated("reports", <ReportsIndex />)} />
    {(["consultant-allocations", "invoices", "per-diem-payments"] as const).map((tab) => (
      <Route key={tab} path={`reports/${tab}`} element={gated("reports", <ReportsPage tab={tab} />)} />
    ))}

    <Route path="visas-documents" element={gated("visasDocuments", <DocumentsIndex own={false} />)} />
    <Route path="visas-documents/visas" element={gated("visasDocuments", <DocumentsPage own={false} tab="visas" />)} />
    <Route path="visas-documents/documents" element={gated("visasDocuments", <DocumentsPage own={false} tab="documents" />)} />

    <Route path="settings" element={gated("settings", <SettingsIndex />)} />
    {(["allocation-roles", "travel-roles", "allocation-types"] as const).map((tab) => (
      <Route key={tab} path={`settings/${tab}`} element={gated("settings", <SettingsPage tab={tab} />)} />
    ))}

    <Route path="*" element={<Navigate to="/finance/engagement-app" replace />} />
  </Route>
);

/** The person's own screens under Me; a pathless frame, so /me itself stays the profile page. */
export const myEngagementRoutes = (
  <Route element={<EngagementShell area="me" />}>
    <Route path="me/travel-requests" element={gated("myTravelRequests", <MyTravelRequestsPage />, "me")} />
    <Route path="me/travel-requests/:job" element={<Navigate to="info" replace />} />
    <Route path="me/travel-requests/:job/:tab" element={gated("myTravelRequests", <TravelRequestPage area="me" />, "me")} />
    <Route path="me/passport-visas" element={gated(["myDocuments", "myVisas"], <DocumentsIndex own />, "me")} />
    <Route path="me/passport-visas/documents" element={gated(["myDocuments", "myVisas"], <DocumentsPage own tab="documents" />, "me")} />
    <Route path="me/passport-visas/visas" element={gated(["myDocuments", "myVisas"], <DocumentsPage own tab="visas" />, "me")} />
    <Route path="me/allocations" element={gated("myAllocations", <MyAllocationsPage />, "me")} />
    <Route path="me/allocations/:id" element={<Navigate to="allocations" replace />} />
    <Route path="me/allocations/:id/:tab" element={gated("myAllocations", <EngagementPage area="me" />, "me")} />
  </Route>
);
