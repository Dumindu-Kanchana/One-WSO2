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
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { PlusIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useMeProfile } from "@features/my/api/useMeProfile";
import { formatShortDate } from "../util/parDate";
import { useActiveParCycle } from "../api/useParData";
import { useReviewRequests } from "../api/usePar360";
import Par360ReviewDialog from "../components/Par360ReviewDialog";
import { Par360OfferPicker, Par360OfferConfirmDialog } from "../components/Par360OfferDialog";
import { Par360StatusChip } from "../components/ParChips";
import ParEmptyState from "../components/ParEmptyState";
import { isDeadlinePassed } from "../util/parDeadline";
import type { Par360ReviewRequest, ParParticipant } from "../api/types";

// People Ops → Performance → Provide 360° Feedback: par-app's own tab name
// (OngoingCycleView.tsx's ParCycleViewTabs.PROVIDETHREESIXTYREVIEWS) —
// respond to the requests other employees (or their leads) sent you as a
// reviewer, or offer feedback nobody asked for. par-app's
// ProvideFeedbackTab.tsx — the two sub-views are local UI state there too
// (its `filterValue`), not routes, so this stays a Tabs toggle rather than
// two more URL segments.
type Filter = "requested" | "voluntary";

export default function ParProvideFeedbackTab() {
  const profile = useMeProfile();
  const workEmail = profile.data?.userInfo.workEmail;
  const activeCycles = useActiveParCycle(workEmail);
  const cycle = activeCycles.data?.[0];

  const requests = useReviewRequests(cycle?.parCycleId, workEmail);
  const [filter, setFilter] = useState<Filter>("requested");
  const [reviewTarget, setReviewTarget] = useState<{ email: string; offered: boolean } | undefined>(undefined);
  const [offering, setOffering] = useState(false);
  const [offerTarget, setOfferTarget] = useState<ParParticipant | undefined>(undefined);
  // Bumped whenever the confirmation dialog closes without an offer being
  // recorded, so Par360OfferPicker remounts with a clean Autocomplete
  // instead of keeping the just-picked name showing in its search box.
  const [pickerResetKey, setPickerResetKey] = useState(0);

  if (profile.isLoading || activeCycles.isLoading) {
    return <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />;
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
        Couldn't load your PAR cycle.
      </ErrorNotice>
    );
  }
  if (!cycle) {
    return <Alert severity="info">There's no PAR cycle open for you right now.</Alert>;
  }

  const question = cycle.parCycleConfigurations?.threeSixtyReviewQuestion || "";
  const ratings = cycle.parCycleConfigurations?.threeSixtyReviewRatings ?? [];
  const allRequests = requests.data ?? [];
  const isVoluntary = (r: Par360ReviewRequest) => !r.isRequested;
  const filtered = allRequests.filter((r) => (filter === "voluntary" ? isVoluntary(r) : !isVoluntary(r)));
  const deadlinePassed = isDeadlinePassed(cycle.parThreeSixtyRatingDeadline);

  return (
    <Box>
      {/* ProvideFeedbackTab.tsx:217-227 — exact wording. */}
      <Alert severity={deadlinePassed ? "error" : "info"} sx={{ mb: 1.5 }}>
        {deadlinePassed
          ? `The 360° feedback submission deadline has now passed ${formatShortDate(cycle.parThreeSixtyRatingDeadline)}.`
          : `Please share feedback before the deadline: ${formatShortDate(cycle.parThreeSixtyRatingDeadline)}.`}
      </Alert>
      <Tabs value={filter} onChange={(_e, v) => setFilter(v)} sx={{ mb: 1.5, minHeight: 36 }}>
        <Tab
          value="requested"
          sx={{ minHeight: 36, textTransform: "none" }}
          label={
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              Requested Feedback
              <Chip size="small" label={allRequests.filter((r) => !isVoluntary(r)).length} />
            </Box>
          }
        />
        <Tab
          value="voluntary"
          sx={{ minHeight: 36, textTransform: "none" }}
          label={
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              Voluntary Feedback
              <Chip size="small" label={allRequests.filter(isVoluntary).length} />
            </Box>
          }
        />
      </Tabs>

      {/* ProvideFeedbackTab.tsx:490-523 used a fixed FAB opening a modal —
          not this app's convention (ParEmployeeFeedbackTab.tsx's own Start
          button instead swaps in an inline Card in place). Shown only on
          the Voluntary tab, disabled (not hidden) past the deadline. */}
      {filter === "voluntary" &&
        (offering ? (
          <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Provide Feedback</Typography>
            <Par360OfferPicker
              key={pickerResetKey}
              open={offering}
              parCycleId={cycle.parCycleId}
              selfEmail={workEmail}
              excludeEmails={allRequests.map((r) => r.employeeEmail)}
              onSelect={(participant) => setOfferTarget(participant)}
            />
            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
              <Button onClick={() => setOffering(false)}>Cancel</Button>
            </Box>
          </Card>
        ) : (
          <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
            <Tooltip title={deadlinePassed ? "Deadline passed" : ""} arrow>
              <span>
                <Button
                  variant="contained"
                  startIcon={<PlusIcon size={16} />}
                  disabled={deadlinePassed}
                  onClick={() => setOffering(true)}
                >
                  Provide Feedback
                </Button>
              </span>
            </Tooltip>
          </Box>
        ))}

      {requests.isLoading ? (
        <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />
      ) : requests.isError ? (
        <ErrorNotice error={requests.error} onRetry={() => requests.refetch()} retrying={requests.isFetching}>
          Couldn't load your review requests.
        </ErrorNotice>
      ) : filtered.length === 0 ? (
        // ProvideFeedbackTab.tsx's own noDataMessage + NoDataView — not a
        // generic Alert. Neutral, forward-looking copy rather than "no one
        // has requested feedback from you" — that reads as a comment on the
        // employee, not just an empty list.
        <ParEmptyState text={filter === "voluntary" ? "No voluntary feedback yet" : "No feedback requests yet"} />
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((r) => {
              const actionable = r.reviewStatus === "PENDING" || r.reviewStatus === "DRAFT";
              // ProvideFeedbackTab.tsx:399-416 — a voluntary request still
              // PENDING once the deadline passes shows "Abandoned" instead
              // of the normal status chip (nobody ever acted on it).
              const abandoned = isVoluntary(r) && r.reviewStatus === "PENDING" && deadlinePassed;
              return (
                <TableRow key={r.employeeEmail}>
                  <TableCell>{r.employeeEmail}</TableCell>
                  <TableCell>
                    {abandoned ? <Chip size="small" label="Abandoned" /> : <Par360StatusChip status={r.reviewStatus} />}
                  </TableCell>
                  <TableCell align="right">
                    {/* ProvideFeedbackTab.tsx:401-424 hides the action
                        entirely past the deadline, for every row. */}
                    {!deadlinePassed && (
                      <Button
                        size="small"
                        onClick={() => setReviewTarget({ email: r.employeeEmail, offered: isVoluntary(r) })}
                      >
                        {actionable ? "Provide feedback" : "View"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {reviewTarget && (
        <Par360ReviewDialog
          open
          onClose={() => setReviewTarget(undefined)}
          parCycleId={cycle.parCycleId}
          employeeEmail={reviewTarget.email}
          reviewQuestion={question}
          reviewRatings={ratings}
          reviewDeadline={cycle.parThreeSixtyRatingDeadline}
          isOfferedFeedback={reviewTarget.offered}
          reviewerEmail={workEmail}
        />
      )}

      <Par360OfferConfirmDialog
        open={Boolean(offerTarget)}
        employee={offerTarget}
        parCycleId={cycle.parCycleId}
        selfEmail={workEmail}
        onClose={() => {
          setOfferTarget(undefined);
          setPickerResetKey((k) => k + 1);
        }}
        onOffered={(email) => {
          setOffering(false);
          setReviewTarget({ email, offered: true });
        }}
      />
    </Box>
  );
}
