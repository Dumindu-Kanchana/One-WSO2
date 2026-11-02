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
import { Navigate, Outlet } from "react-router";
import { Chip, Skeleton } from "@wso2/oxygen-ui";
import RoutedTabs, { type RoutedTabDef } from "@components/routed-tabs/RoutedTabs";
import { isPreviewEnabled } from "@config/previewFeatures";
import { useMeProfile } from "@features/my/api/useMeProfile";
import ParShell from "../components/ParShell";
import ParCycleTracker from "../components/ParCycleTracker";
import {
  useActiveParCycle,
  useParEmployeeItemVisible,
  useParHasActiveCycle,
  useParHasLead,
} from "../api/useParData";
import { useParShowsPar2 } from "../api/useReview360";
import { useReviewRequests } from "../api/usePar360";
import { useCurrentLeadership360Survey, useMyLeadership360Feedback } from "../api/useLeadership360";
import { localDraftLeaders } from "../util/leadership360LocalDraft";
import { openRequests } from "../util/parHome";

// Tab labels and order match par-app's own OngoingCycleView.tsx tab bar
// (Employee Feedback / Request 360° / Provide 360° / F2F). History is
// folded in as a fifth tab (a separate top-level route in the source) and,
// unlike the first four, isn't gated by lead presence below.
const FULL_TABS: RoutedTabDef[] = [
  { segment: "employee-feedback", label: "Employee Feedback" },
  { segment: "request-360", label: "Request 360° Feedback" },
  { segment: "provide-360", label: "Provide 360° Feedback" },
  { segment: "f2f", label: "F2F" },
  { segment: "history", label: "PAR History" },
];

// OngoingCycleView.tsx:66-112 — an employee with no lead (`leadEmail ===
// null`) gets exactly ONE tab, Provide 360° Feedback: no self-review, no
// requesting reviewers for themselves, no F2F. History still shows (see
// above).
const LEADLESS_TABS: RoutedTabDef[] = [
  { segment: "provide-360", label: "Provide 360° Feedback" },
  { segment: "history", label: "PAR History" },
];

// No OPEN cycle: every other tab only makes sense mid-cycle, so History is
// the only one left, regardless of lead presence.
const HISTORY_ONLY_TABS: RoutedTabDef[] = [{ segment: "history", label: "PAR History" }];

// A PAR 2.0 cycle (one with the structured 360° form, behind the `par2`
// preview flag): three tabs. Active cycle holds everything about your own PAR
// (self-review, asking for 360° feedback, F2F); Give feedback holds feedback
// for others, PAR and Leadership 360°; History holds past cycles. Without a
// lead there's no PAR of your own to work on, only feedback to give.
const ACTIVE_CYCLE_TAB: RoutedTabDef = { segment: "cycle", label: "Active cycle" };
const PAR2_HISTORY_TAB: RoutedTabDef = { segment: "history", label: "History" };
const giveFeedbackTab = (waiting: number): RoutedTabDef => ({
  segment: "give-feedback",
  label: waiting > 0 ? `Give feedback (${waiting})` : "Give feedback",
});

// One page frame for everything an employee does with their own PAR — the
// shell, the tab bar, and an <Outlet /> for whichever tab the URL names.
export default function ParGroupPage() {
  const profile = useMeProfile();
  const workEmail = profile.data?.userInfo.workEmail;
  const activeCycles = useActiveParCycle(workEmail);
  // Unset while there's no active cycle to name.
  const cycleName = activeCycles.data?.[0]?.parCycleName;
  const { hasLead, isLoading } = useParHasLead(workEmail, profile.isLoading);
  const { isActive, isLoading: isActiveLoading } = useParHasActiveCycle(workEmail, profile.isLoading);
  const { showsPar2, isLoading: isPar2Loading } = useParShowsPar2(activeCycles.data?.[0]?.parCycleId);
  const par2Cycle = isActive && showsPar2 ? activeCycles.data?.[0] : undefined;
  const waiting = useFeedbackWaiting(workEmail, par2Cycle?.parCycleId);

  const tabs = par2Cycle
    ? hasLead
      ? [ACTIVE_CYCLE_TAB, giveFeedbackTab(waiting), PAR2_HISTORY_TAB]
      : [giveFeedbackTab(waiting), PAR2_HISTORY_TAB]
    : !isActive
      ? HISTORY_ONLY_TABS
      : !hasLead
        ? LEADLESS_TABS
        : FULL_TABS;

  return (
    <ParShell
      title="Performance Appraisal Review"
      subtitle="Complete your own feedback, request and give 360° feedback and see your record from past cycles."
    >
      {/* The active cycle's own name/period, not the page's title — this
          page is "Performance Appraisal Review" regardless of which cycle is running. */}
      {cycleName && <Chip label={cycleName} size="small" color="primary" variant="outlined" sx={{ mb: 2, fontWeight: 600 }} />}
      {isLoading || isActiveLoading || isPar2Loading ? (
        <Skeleton variant="rectangular" height={36} sx={{ borderRadius: 1, mb: 2, maxWidth: 640 }} />
      ) : (
        <>
          {/* PAR 2.0: where you are in the cycle, pinned above every tab. */}
          {par2Cycle && hasLead && workEmail && <ParCycleTracker cycle={par2Cycle} workEmail={workEmail} />}
          <RoutedTabs basePath="/me/performance" tabs={tabs} ariaLabel="Performance sections" />
          <Outlet />
        </>
      )}
    </ParShell>
  );
}

/** Feedback waiting on you in a PAR 2.0 cycle, for the Give feedback tab's
 * label: PAR requests not yet answered and your Leadership 360° drafts (named
 * ones on the server, anonymous ones in this browser). */
function useFeedbackWaiting(workEmail: string | undefined, parCycleId: number | undefined): number {
  const requests = useReviewRequests(parCycleId, workEmail);
  const leadership = isPreviewEnabled("leadership360") && parCycleId !== undefined;
  const survey = useCurrentLeadership360Survey(leadership);
  const surveyId = leadership ? survey.data?.survey.surveyId : undefined;
  const mine = useMyLeadership360Feedback(surveyId);
  const local = workEmail && surveyId !== undefined ? localDraftLeaders(workEmail, surveyId).length : 0;
  return openRequests(requests.data ?? []).length + (mine.data?.drafts.length ?? 0) + local;
}

/** The index route of the group. In a PAR 2.0 cycle: Active cycle's
 * self-review, or Give feedback without a lead. Otherwise a leadless employee
 * goes straight to Provide 360° Feedback (their only tab), an employee with
 * no active cycle to History (their only tab), and everyone else to Employee
 * Feedback. Waits for both questions rather than guessing, same reasoning as
 * LeaveGroupIndex. */
export function ParGroupIndex() {
  const profile = useMeProfile();
  const workEmail = profile.data?.userInfo.workEmail;
  const { hasLead, isLoading } = useParHasLead(workEmail, profile.isLoading);
  const { isActive, isLoading: isActiveLoading } = useParHasActiveCycle(workEmail, profile.isLoading);
  const activeCycles = useActiveParCycle(workEmail);
  const { showsPar2, isLoading: isPar2Loading } = useParShowsPar2(activeCycles.data?.[0]?.parCycleId);
  if (isLoading || isActiveLoading || activeCycles.isLoading || isPar2Loading) return null; // ParGroupPage already holds the Outlet behind its own gate
  if (!isActive) return <Navigate to="/me/performance/history" replace />;
  if (showsPar2) return <Navigate to={`/me/performance/${hasLead ? "cycle/self-review" : "give-feedback"}`} replace />;
  return <Navigate to={`/me/performance/${hasLead ? "employee-feedback" : "provide-360"}`} replace />;
}

/** Guards a route only a leadless employee should never reach by typing its
 * URL — Employee Feedback and Request 360° Feedback, per OngoingCycleView.tsx.
 * Hiding a tab is not access control; the route is what actually enforces it. */
export function ParRequiresLeadRoute({ children }: { children: ReactNode }) {
  const profile = useMeProfile();
  const { hasLead, isLoading } = useParHasLead(profile.data?.userInfo.workEmail, profile.isLoading);
  if (isLoading) return null;
  if (!hasLead) return <Navigate to="/me/performance/provide-360" replace />;
  return <>{children}</>;
}

/** Guards every tab but History from being reached by URL once there's no
 * OPEN cycle — Employee Feedback, Request/Provide 360°, and F2F all act on
 * an in-progress cycle, so none of them has anything to show without one.
 * Hiding the tab is not access control; the route is what actually enforces
 * it, same reasoning as ParRequiresLeadRoute. */
export function ParRequiresActiveCycleRoute({ children }: { children: ReactNode }) {
  const profile = useMeProfile();
  const { isActive, isLoading } = useParHasActiveCycle(profile.data?.userInfo.workEmail, profile.isLoading);
  if (isLoading) return null;
  if (!isActive) return <Navigate to="/me/performance/history" replace />;
  return <>{children}</>;
}

/** Guards the whole /me/performance subtree — an intern (who has nothing to
 * show here, full stop — see useParEmployeeItemVisible) is redirected to
 * /me instead of reaching a page the Me menu is already hiding. Same shape
 * as ParRequiresAdminRoute (App.tsx's own /people-ops/performance/admin
 * guard): the eligibility check wraps the page element from the outside,
 * so hiding the menu row is not the only thing enforcing this — same
 * reasoning as ParRequiresLeadRoute above. */
export function ParRequiresSomethingToShowRoute({ children }: { children: ReactNode }) {
  const profile = useMeProfile();
  const { canSee, isLoading } = useParEmployeeItemVisible(profile.data?.employee?.employmentType, profile.isPending);
  if (isLoading) return null;
  if (!canSee) return <Navigate to="/me" replace />;
  return <>{children}</>;
}
