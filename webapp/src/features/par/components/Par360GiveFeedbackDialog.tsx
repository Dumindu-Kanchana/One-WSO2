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

import { useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardActionArea,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { useOfferToReview, useParticipants } from "../api/usePar360";
import { useLeadership360Leaders } from "../api/useLeadership360";
import type { ParCycle, Par360ReviewRequest } from "../api/types";
import type {
  Leadership360CurrentSurvey,
  Leadership360Leader,
  Leadership360MyFeedback,
} from "../api/leadership360Types";
import {
  canStart,
  leadershipFeedbackState,
  parFeedbackState,
  pickerPeople,
  type FeedbackKind,
  type FeedbackState,
  type PickerPerson,
} from "../util/par360Feedback";
import { formatShortDate } from "../util/parDate";
import { isDeadlinePassed } from "../util/parDeadline";

export type FeedbackStart =
  | { kind: "PAR"; email: string; name: string }
  | { kind: "LEADERSHIP"; leader: Leadership360Leader };

const STATE_LABEL: Partial<Record<FeedbackState, string>> = {
  asked: "Asked you",
  draft: "Draft",
  given: "Given",
  declined: "Declined",
  closed: "Closed",
};

// Give feedback: first the kind (asked only when both a PAR 2.0 cycle and a
// Leadership 360° survey are open), then the person, from a list of just the
// people that kind applies to. PAR feedback nobody asked for is an offer,
// confirmed first, since it adds you to their reviewers.
export default function Par360GiveFeedbackDialog({
  onClose,
  workEmail,
  cycle,
  requests,
  workedWith,
  survey,
  myLeadership,
  localDraftLeaders = [],
  onStart,
}: {
  onClose: () => void;
  workEmail: string;
  /** The PAR 2.0 cycle, when PAR feedback can be given at all. */
  cycle?: ParCycle;
  /** PAR feedback requests to you. */
  requests: Par360ReviewRequest[];
  /** Your lead, who asked you and who you asked: leaders among them are listed first. */
  workedWith: (string | null | undefined)[];
  /** The open Leadership 360° survey, if any. */
  survey?: Leadership360CurrentSurvey;
  myLeadership?: Leadership360MyFeedback;
  /** Leaders with an anonymous draft in this browser (lower-case emails). */
  localDraftLeaders?: string[];
  onStart: (start: FeedbackStart) => void;
}) {
  const askKind = Boolean(cycle) && Boolean(survey);
  const [kind, setKind] = useState<FeedbackKind | null>(askKind ? null : cycle ? "PAR" : "LEADERSHIP");
  const [person, setPerson] = useState<PickerPerson | null>(null);
  const [confirming, setConfirming] = useState(false);
  const participants = useParticipants(cycle?.parCycleId, kind === "PAR");
  const leaders = useLeadership360Leaders(kind === "LEADERSHIP");
  const offer = useOfferToReview(cycle?.parCycleId, workEmail);
  const parClosed = cycle ? isDeadlinePassed(cycle.parThreeSixtyRatingDeadline) : true;
  const cycleName = cycle?.parCycleName ?? "";

  const people = useMemo(
    () =>
      kind === "PAR"
        ? pickerPeople({
            selfEmail: workEmail,
            people: (participants.data ?? []).map((p) => ({ email: p.workEmail, name: p.employeeName })),
            workedWith: [],
          })
        : pickerPeople({
            selfEmail: workEmail,
            people: (leaders.data ?? []).map((l) => ({ email: l.workEmail, name: l.employeeName, jobRole: l.jobRole })),
            workedWith,
          }),
    [kind, workEmail, participants.data, leaders.data, workedWith],
  );

  const stateOf = (p: PickerPerson): FeedbackState => {
    const key = p.email.toLowerCase();
    if (kind === "PAR") {
      return parFeedbackState(
        requests.find((r) => r.employeeEmail.toLowerCase() === key),
        parClosed,
      );
    }
    return leadershipFeedbackState(
      (myLeadership?.drafts ?? []).some((d) => d.leaderEmail.toLowerCase() === key) || localDraftLeaders.includes(key),
    );
  };

  // What to say next to a person in the list. Leaders stay pickable after feedback (named any time).
  const labelOf = (p: PickerPerson): string | undefined => {
    const state = stateOf(p);
    if (kind === "LEADERSHIP" && state === "open") {
      const key = p.email.toLowerCase();
      const given =
        (myLeadership?.named ?? []).some((g) => g.leaderEmail.toLowerCase() === key) ||
        (myLeadership?.anonymous ?? []).some((g) => g.leaderEmail.toLowerCase() === key);
      return given ? "Given before" : undefined;
    }
    return STATE_LABEL[state];
  };

  const choose = (p: PickerPerson | null) => {
    offer.reset();
    setPerson(p);
    if (!p) return;
    if (kind === "PAR") {
      if (stateOf(p) === "offer") setConfirming(true);
      else onStart({ kind: "PAR", email: p.email, name: p.name });
      return;
    }
    const leader = (leaders.data ?? []).find((l) => l.workEmail.toLowerCase() === p.email.toLowerCase());
    if (leader) onStart({ kind: "LEADERSHIP", leader });
  };

  const loading = kind === "PAR" ? participants.isLoading : leaders.isLoading;
  const loadError = kind === "PAR" ? participants.error : leaders.error;
  const title =
    kind === "PAR"
      ? "Give feedback for a PAR"
      : kind === "LEADERSHIP"
        ? "Give Leadership 360° feedback"
        : "Give feedback";

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {kind === null ? (
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              What kind of feedback?
            </Typography>
            <KindOption
              title="For a PAR"
              text={
                parClosed
                  ? `The ${cycleName} 360° deadline has passed.`
                  : `On a colleague's work, for their ${cycleName} PAR. Their lead sees your name. Due ${formatShortDate(cycle?.parThreeSixtyRatingDeadline)}.`
              }
              disabled={parClosed}
              onClick={() => setKind("PAR")}
            />
            <KindOption
              title="Leadership 360°"
              text={`On a member of the leadership team. You can stay anonymous. Open until ${formatShortDate(survey?.survey.endDate)}.`}
              onClick={() => setKind("LEADERSHIP")}
            />
          </Stack>
        ) : confirming && person ? (
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Typography variant="body2">
              Offer feedback for {person.name}'s {cycleName} PAR? They didn't ask you, so you'll be added to their
              reviewers. They'll see that you gave feedback, and their lead reads your answers with your name.
            </Typography>
            {offer.isError && <Alert severity="error">{describeError(offer.error)}</Alert>}
          </Stack>
        ) : kind === "PAR" && parClosed ? (
          <Alert severity="info">The {cycleName} 360° deadline has passed.</Alert>
        ) : (
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              {kind === "PAR"
                ? `Anyone in your ${cycleName} PAR cycle. Their lead sees your name.`
                : `Any member of the leadership team you've worked with. You can stay anonymous.`}
            </Typography>
            {loadError ? (
              <Alert severity="error">Couldn't load people to choose from. {describeError(loadError)}</Alert>
            ) : (
              <Autocomplete
                options={people}
                loading={loading}
                value={person}
                onChange={(_e, p) => choose(p)}
                groupBy={
                  kind === "LEADERSHIP" ? (p) => (p.suggested ? "Leaders you work with" : "All leaders") : undefined
                }
                getOptionLabel={(p) => p.name}
                getOptionDisabled={(p) => !canStart(stateOf(p))}
                isOptionEqualToValue={(a, b) => a.email === b.email}
                renderOption={(props, p) => {
                  const label = labelOf(p);
                  return (
                    <li {...props} key={p.email}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2">{p.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {p.jobRole ?? p.email}
                          </Typography>
                        </Box>
                        {label && (
                          <Typography variant="caption" color="text.secondary">
                            {label}
                          </Typography>
                        )}
                      </Box>
                    </li>
                  );
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Who is it for?" placeholder="Search by name" autoFocus />
                )}
                noOptionsText="No one found"
              />
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {confirming && person ? (
          <>
            <Button
              onClick={() => {
                setConfirming(false);
                setPerson(null);
              }}
              disabled={offer.isPending}
            >
              Back
            </Button>
            <Button
              variant="contained"
              disabled={offer.isPending}
              onClick={() =>
                offer.mutate(person.email, {
                  onSuccess: () => onStart({ kind: "PAR", email: person.email, name: person.name }),
                })
              }
            >
              {offer.isPending ? "Offering…" : "Offer feedback"}
            </Button>
          </>
        ) : (
          <>
            {askKind && kind !== null && (
              <Button
                onClick={() => {
                  setKind(null);
                  setPerson(null);
                }}
              >
                Back
              </Button>
            )}
            <Button onClick={onClose}>Cancel</Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

function KindOption({
  title,
  text,
  disabled = false,
  onClick,
}: {
  title: string;
  text: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Card variant="outlined">
      <CardActionArea onClick={onClick} disabled={disabled} sx={{ p: 2, opacity: disabled ? 0.6 : 1 }}>
        <Typography sx={{ fontWeight: 600 }}>{title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {text}
        </Typography>
      </CardActionArea>
    </Card>
  );
}
