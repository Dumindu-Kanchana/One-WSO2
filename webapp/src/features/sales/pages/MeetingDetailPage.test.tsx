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

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

// Everything around the tabs is stubbed: these tests are about which pane opens, and
// what the URL says about it.
type Part = { id: number; startTime: string | null; endTime: string | null; state: "ATTACHED" };
const state: {
  echoConfigured: boolean;
  recordings: Part[];
  smartNotes: Part[];
  links: Record<string, string | null>;
  callContext: unknown;
} = {
  echoConfigured: true,
  recordings: [],
  smartNotes: [],
  links: {},
  callContext: null,
};
// The call's live opportunity and account, as the Echo backend answers them.
const NO_LINKS = {
  opportunity: { id: null, status: "unavailable", live: null },
  account: { id: null, status: "unavailable", live: null },
};
vi.mock("../callContext/api/useCallContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../callContext/api/useCallContext")>()),
  useMeetingCallContext: () => state.callContext,
}));
vi.mock("../components/SalesShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("../api/useSalesData", () => ({
  isSalesBackendConfigured: () => true,
  useMeeting: () => ({
    data: {
      meetingId: 7, title: "Budget sign-off", googleEventId: "e", host: "ravi@wso2.com",
      startTime: "2026-09-24 07:30:00", endTime: "2026-09-24 08:30:00",
      internalParticipants: "ravi@wso2.com", externalParticipants: null,
      meetingStatus: "ACTIVE", isRecurring: false,
      recordings: state.recordings, transcripts: [], smartNotes: state.smartNotes,
      ...state.links,
    },
    isLoading: false,
    error: null,
  }),
  useTranscripts: () => [],
}));
vi.mock("../meddpicc/api/useCallMeddpicc", () => ({
  useCallMeddpicc: () => ({ configured: state.echoConfigured, opportunityId: "006X", insight: { markers: [] } }),
}));
// Who the caller is to the sales backend, and the re-analysis request, as the page wires them.
const caller = { isAdmin: false, workEmail: null as string | null, isPending: false };
const mutateAsync = vi.fn(async () => ({}));
const showSuccess = vi.fn();
const showError = vi.fn();
vi.mock("../meddpicc/api/useMeddpiccMutations", () => ({
  useReanalyseMeeting: () => ({ mutateAsync, isPending: caller.isPending }),
}));
vi.mock("../api/useSalesGate", () => ({
  useSalesGate: () => ({ isResolved: true, isAdmin: caller.isAdmin, workEmail: caller.workEmail }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess, showError }),
}));
vi.mock("../components/RecordingPlayer", () => ({
  default: ({ recordingId, startAt }: { recordingId?: number; startAt?: number }) => (
    <div>player {recordingId ?? "default"}{startAt ? ` at ${startAt}` : ""}</div>
  ),
}));
vi.mock("../components/SpeakerTimeline", () => ({ default: () => <div>timeline</div> }));
vi.mock("../components/SmartNotesPanel", () => ({
  default: ({ smartNoteId }: { smartNoteId?: number }) => <div>smart notes {smartNoteId ?? "default"}</div>,
}));
vi.mock("../components/TranscriptPanel", () => ({ default: () => <div>transcript pane</div> }));
vi.mock("../meddpicc/components/CallMeddpiccStrip", () => ({ default: () => <div>strip</div> }));
vi.mock("../meddpicc/components/CallMeddpiccTab", () => ({
  default: ({
    focusLetter,
    reanalysis,
  }: {
    focusLetter: string | null;
    reanalysis?: { allowed: boolean; inFlight: boolean; request: () => void };
  }) => (
    <div>
      meddpicc pane, letter {focusLetter ?? "none"}
      {reanalysis?.allowed && (
        <button type="button" onClick={reanalysis.request}>
          {reanalysis.inFlight ? "analysing" : "analyse again"}
        </button>
      )}
    </div>
  ),
}));

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import MeetingDetailPage from "./MeetingDetailPage";

function Where() {
  const { pathname, search } = useLocation();
  return <div data-testid="where">{pathname + search}</div>;
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>
        <Route path="/sales/meetings/:meetingId" element={<MeetingDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  state.echoConfigured = true;
  state.recordings = [];
  state.smartNotes = [];
  state.links = {};
  state.callContext = NO_LINKS;
  caller.isAdmin = false;
  caller.workEmail = null;
  caller.isPending = false;
  mutateAsync.mockClear();
  showSuccess.mockClear();
  showError.mockClear();
});

const part = (id: number): Part => ({ id, startTime: null, endTime: null, state: "ATTACHED" });

describe("MeetingDetailPage tabs", () => {
  it("opens on Summary by default", () => {
    renderAt("/sales/meetings/7");
    expect(screen.getByRole("tab", { name: "Summary" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("smart notes default")).toBeInTheDocument();
  });

  // The meetings table sends a row here: the call's analysis, at a Letter from a circle.
  it("opens on the MEDDPICC analysis at the Letter the URL names", () => {
    renderAt("/sales/meetings/7?tab=meddpicc&letter=E");
    expect(screen.getByRole("tab", { name: "MEDDPICC" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("meddpicc pane, letter E")).toBeInTheDocument();
  });

  // A quote on a deal links here: the transcript, with the recording at the second it was said.
  it("opens the recording at the second the URL names", () => {
    renderAt("/sales/meetings/7?tab=transcript&t=760");
    expect(screen.getByRole("tab", { name: "Transcript" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("player default at 760")).toBeInTheDocument();
  });

  // Recorded in two parts: the second it names falls in the second part, timed from that part's start.
  it("opens the part the second falls in, for a call recorded in parts", () => {
    state.recordings = [
      { id: 11, startTime: "2026-09-24 07:30:00", endTime: "2026-09-24 07:40:00", state: "ATTACHED" },
      { id: 12, startTime: "2026-09-24 07:45:00", endTime: "2026-09-24 08:30:00", state: "ATTACHED" },
    ];
    renderAt("/sales/meetings/7?tab=transcript&t=1200");
    expect(screen.getByRole("tab", { name: /^Part 2/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("player 12 at 300")).toBeInTheDocument();
  });

  it("ignores a second it cannot read", () => {
    renderAt("/sales/meetings/7?t=12:40");
    expect(screen.getByText("player default")).toBeInTheDocument();
  });

  it("writes a tab chosen from the bar back to the URL, without the Letter", async () => {
    renderAt("/sales/meetings/7?tab=meddpicc&letter=E");
    await userEvent.click(screen.getByRole("tab", { name: "Transcript" }));
    expect(screen.getByText("transcript pane")).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent(/^\/sales\/meetings\/7\?tab=transcript$/);
  });

  it("falls back to Summary when MEDDPICC isn't configured, or the tab is unknown", () => {
    state.echoConfigured = false;
    const { unmount } = renderAt("/sales/meetings/7?tab=meddpicc");
    expect(screen.queryByRole("tab", { name: "MEDDPICC" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Summary" })).toHaveAttribute("aria-selected", "true");
    unmount();

    state.echoConfigured = true;
    renderAt("/sales/meetings/7?tab=nonsense");
    expect(screen.getByRole("tab", { name: "Summary" })).toHaveAttribute("aria-selected", "true");
  });
});

// A call stopped and started again has a recording and notes for each part.
describe("MeetingDetailPage parts", () => {
  it("shows no part choice for a call recorded in one go", () => {
    state.recordings = [part(11)];
    renderAt("/sales/meetings/7");
    expect(screen.queryByRole("tab", { name: /^Part / })).not.toBeInTheDocument();
    expect(screen.getByText("player 11")).toBeInTheDocument();
  });

  it("offers every recording and plays the one picked", async () => {
    state.recordings = [part(11), part(12)];
    renderAt("/sales/meetings/7");
    expect(screen.getByRole("tab", { name: "Part 1" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("player 11")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Part 2" }));
    expect(screen.getByText("player 12")).toBeInTheDocument();
  });

  it("shows every smart notes of the call", () => {
    state.smartNotes = [part(21), part(22)];
    renderAt("/sales/meetings/7");
    expect(screen.getByText("Notes 1")).toBeInTheDocument();
    expect(screen.getByText("smart notes 21")).toBeInTheDocument();
    expect(screen.getByText("smart notes 22")).toBeInTheDocument();
  });
});

// The MEDDPICC tab's Analyse again is the page's to wire: who may ask, which meeting, and
// what is said when the request is taken or refused.
describe("MeetingDetailPage's Analyse again", () => {
  const at = () => renderAt("/sales/meetings/7?tab=meddpicc");

  it("is offered to the call's host and to an admin, not to anyone else", () => {
    let view = at();
    expect(screen.queryByRole("button", { name: "analyse again" })).not.toBeInTheDocument();
    view.unmount();

    caller.workEmail = "ravi@wso2.com"; // the host
    view = at();
    expect(screen.getByRole("button", { name: "analyse again" })).toBeInTheDocument();
    view.unmount();

    caller.workEmail = "someone@wso2.com";
    caller.isAdmin = true;
    at();
    expect(screen.getByRole("button", { name: "analyse again" })).toBeInTheDocument();
  });

  it("asks for this meeting and says it will be analysed again, or says what went wrong", async () => {
    caller.workEmail = "ravi@wso2.com";
    const view = at();
    await userEvent.click(screen.getByRole("button", { name: "analyse again" }));
    expect(mutateAsync).toHaveBeenCalledWith(7);
    await waitFor(() => expect(showSuccess).toHaveBeenCalledWith('"Budget sign-off" will be analysed again.'));
    expect(showError).not.toHaveBeenCalled();
    view.unmount();

    mutateAsync.mockRejectedValueOnce(new Error("refused"));
    at();
    await userEvent.click(screen.getByRole("button", { name: "analyse again" }));
    await waitFor(() => expect(showError).toHaveBeenCalledTimes(1));
    expect(showSuccess).toHaveBeenCalledTimes(1);
  });

  it("shows the request in flight", () => {
    caller.workEmail = "ravi@wso2.com";
    caller.isPending = true;
    at();
    expect(screen.getByRole("button", { name: "analysing" })).toBeInTheDocument();
  });
});

// The call's opportunity and account: live from Salesforce, else the snapshot taken when it was linked.
describe("MeetingDetailPage's opportunity and account", () => {
  const OPP = "006AA000001aBcDEF1";
  const ACC = "001AA000001aBcDEF1";
  const liveOpportunity = {
    id: OPP, name: "Harbourline – API platform", ownerName: "Nadia Perera", ownerEmail: "nadia@wso2.com",
    salesRegion: "APAC", stage: "Qualify", recordType: "First Sale", amount: 120000, currency: "USD",
    closeDate: "2026-12-15", isClosed: false, accountId: ACC, accountName: "Harbourline",
  };
  const liveAccount = {
    id: ACC, name: "Harbourline", region: "Asia Pacific", salesRegion: "APAC",
    ownerName: "Ola Berg", ownerEmail: "ola@wso2.com",
    technicalOwnerName: "Tharindu Silva", technicalOwnerEmail: "tharindu@wso2.com",
  };
  const linkedToTheDeal = () => {
    state.links = {
      opportunityId: OPP,
      opportunityDetails: JSON.stringify({
        customerId: ACC, customerName: "Harbourline", stage: "Discovery", amount: 90000, currency: "USD",
        closeDate: "2026-10-01",
      }),
    };
  };
  const card = (name: string) => screen.getByRole("region", { name });

  it("shows the live opportunity and account", () => {
    linkedToTheDeal();
    state.callContext = {
      opportunity: { id: OPP, status: "ready", live: liveOpportunity },
      account: { id: ACC, status: "ready", live: liveAccount },
    };
    renderAt("/sales/meetings/7");

    const opportunity = card("Opportunity");
    expect(within(opportunity).getByRole("link", { name: "Harbourline – API platform" })).toHaveAttribute(
      "href",
      `/sales/deals/${OPP}`,
    );
    expect(opportunity).toHaveTextContent("Nadia Perera");
    expect(opportunity).toHaveTextContent("nadia@wso2.com");
    expect(opportunity).toHaveTextContent("APAC");
    expect(opportunity).toHaveTextContent("Qualify");
    expect(opportunity).toHaveTextContent("120,000 USD");
    expect(opportunity).toHaveTextContent("15/12/2026");
    expect(within(opportunity).queryByText("as linked")).not.toBeInTheDocument();

    const account = card("Account");
    expect(account).toHaveTextContent("Harbourline");
    // The Sales Region, as the list shows it, not the broader Region.
    expect(within(account).getByText("APAC")).toBeInTheDocument();
    expect(account).not.toHaveTextContent("Asia Pacific");
    expect(account).toHaveTextContent("Ola Berg");
    expect(account).toHaveTextContent("Tharindu Silva");
    expect(within(account).queryByText("as linked")).not.toBeInTheDocument();

    // The host is labelled as the host now: the owner is the opportunity's.
    expect(screen.getByText("Host")).toBeInTheDocument();
    expect(within(account).getByText("Account owner")).toBeInTheDocument();
  });

  it("falls back to the snapshot taken when the call was linked, labelled as such", () => {
    linkedToTheDeal();
    state.callContext = {
      opportunity: { id: OPP, status: "unavailable", live: null },
      account: { id: ACC, status: "unavailable", live: null },
    };
    renderAt("/sales/meetings/7");

    const opportunity = card("Opportunity");
    expect(within(opportunity).getByText("as linked")).toBeInTheDocument();
    expect(opportunity).toHaveTextContent("Discovery");
    expect(opportunity).toHaveTextContent("90,000 USD");
    expect(opportunity).toHaveTextContent("01/10/2026");
    expect(within(opportunity).getByRole("link", { name: "Open deal" })).toHaveAttribute(
      "href",
      `/sales/deals/${OPP}`,
    );

    const account = card("Account");
    expect(within(account).getByText("as linked")).toBeInTheDocument();
    expect(account).toHaveTextContent("Harbourline");
  });

  it("shows skeletons, not the snapshot, while the live details load", () => {
    linkedToTheDeal();
    state.callContext = {
      opportunity: { id: OPP, status: "loading", live: null },
      account: { id: ACC, status: "loading", live: null },
    };
    renderAt("/sales/meetings/7");
    expect(within(card("Opportunity")).queryByText("as linked")).not.toBeInTheDocument();
    expect(card("Opportunity")).not.toHaveTextContent("Discovery");
  });

  it("names a lead's company, with no cards, for a call linked to a lead only", () => {
    state.links = { leadId: "00QAA000001aBcDEF1", leadCompany: "Kestrel Labs" };
    renderAt("/sales/meetings/7");
    expect(screen.queryByRole("region", { name: "Opportunity" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Account" })).not.toBeInTheDocument();
    expect(screen.getByText("Lead")).toBeInTheDocument();
    expect(screen.getByText("Kestrel Labs")).toBeInTheDocument();
  });
});
