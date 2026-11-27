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


import { describe, expect, it } from "vitest";
import type { Meeting } from "../../api/salesTypes";
import type { StoredCallContext } from "../../echoCalls/types";
import {
  NO_CONTEXT,
  recordFor,
  contextRequestFor,
  opportunityCell,
  ownerCell,
  regionCell,
  storedContextView,
} from "./callContext";

const OPP = "006Hb00000Nordl001";
const ACC = "001Hb00000Nordl001";

const meeting = (overrides: Partial<Meeting> = {}): Meeting => ({
  meetingId: 1,
  title: "Call",
  googleEventId: "evt",
  host: "host@wso2.com",
  startTime: "2026-11-10 10:00:00",
  endTime: "2026-11-10 10:30:00",
  internalParticipants: "host@wso2.com",
  meetingStatus: "ACTIVE",
  isRecurring: false,
  ...overrides,
});

const stored = (overrides: Partial<StoredCallContext> = {}): StoredCallContext => ({
  opportunity: {
    id: OPP, name: "Nordlys – IAM renewal", ownerName: "Lars Holm", ownerEmail: "lars@wso2.com", salesRegion: "EU",
    stage: "Negotiate", accountId: ACC, accountName: "Nordlys Energi AS",
  },
  account: null,
  ownerEmail: "lars@wso2.com",
  ownerIsHost: false,
  region: "EU",
  readAt: null,
  ...overrides,
});

describe("contextRequestFor", () => {
  it("asks once for each valid id on the page, sorted, with the account a deal snapshot names", () => {
    const request = contextRequestFor([
      meeting({ meetingId: 1, opportunityId: OPP, opportunityDetails: JSON.stringify({ customerId: ACC }) }),
      meeting({ meetingId: 2, opportunityId: OPP }),
      meeting({ meetingId: 3, accountId: "001Hb00000Andes001" }),
      meeting({ meetingId: 4, opportunityId: "not-an-id" }),
      meeting({ meetingId: 5 }),
    ]);
    expect(request).toEqual({ opportunityIds: [OPP], accountIds: ["001Hb00000Andes001", ACC] });
  });
});

describe("a call with the Echo list's stored context", () => {
  it("takes its opportunity, owner and region from it", () => {
    const m = meeting({ opportunityId: OPP });
    const view = storedContextView([{ meeting: m, context: stored() }]);
    expect(opportunityCell(m, view)).toEqual({ kind: "live", id: OPP, name: "Nordlys – IAM renewal", stage: "Negotiate" });
    expect(ownerCell(m, view)).toEqual({ kind: "owner", name: "Lars Holm", email: "lars@wso2.com" });
    expect(regionCell(m, view)).toEqual({ kind: "value", value: "EU", title: "EU" });
  });

  it("marks the host when the stored owner is the host", () => {
    const m = meeting({ accountId: ACC });
    const view = storedContextView([{ meeting: m, context: stored({ opportunity: null, ownerEmail: m.host, ownerIsHost: true, region: null }) }]);
    expect(ownerCell(m, view)).toEqual({ kind: "host", email: "host@wso2.com", marked: true });
    expect(opportunityCell(m, view)).toEqual({ kind: "none" });
    expect(regionCell(m, view)).toEqual({ kind: "none" });
  });
});

describe("a call whose stored opportunity hasn't been read yet", () => {
  it("shows the meeting's own data rather than an empty name", () => {
    const m = meeting({ opportunityId: OPP, accountName: "Nordlys Energi AS" });
    const unread = stored({
      opportunity: { id: OPP, name: null, ownerName: null, ownerEmail: null, salesRegion: null, stage: null, accountId: null, accountName: null },
      ownerEmail: m.host,
      ownerIsHost: true,
      region: null,
    });
    const view = storedContextView([{ meeting: m, context: unread }]);
    expect(opportunityCell(m, view)).toEqual({ kind: "linked", id: OPP, label: "Nordlys Energi AS" });
    expect(ownerCell(m, view)).toEqual({ kind: "host", email: "host@wso2.com", marked: true });
    expect(regionCell(m, view)).toEqual({ kind: "none" });
  });
});

describe("an id that names an inherited property", () => {
  it("is not taken for a record", () => {
    expect(recordFor({}, "constructor")).toBeUndefined();
    expect(recordFor({ [OPP]: 1 }, OPP)).toBe(1);
    const m = meeting({ opportunityId: "constructor", accountId: "toString", accountName: "Nordlys Energi AS" });
    const live = { status: "ready" as const, opportunities: {}, accounts: {} };
    expect(opportunityCell(m, live)).toEqual({ kind: "linked", id: "constructor", label: "Nordlys Energi AS" });
    expect(ownerCell(m, live)).toEqual({ kind: "host", email: "host@wso2.com", marked: true });
    expect(regionCell(m, live)).toEqual({ kind: "none" });
  });
});

describe("without any context", () => {
  it("keeps a linked call on its own data, and an unlinked one blank", () => {
    const linked = meeting({ opportunityId: OPP, accountName: "Nordlys Energi AS" });
    expect(opportunityCell(linked, NO_CONTEXT)).toEqual({ kind: "linked", id: OPP, label: "Nordlys Energi AS" });
    expect(regionCell(linked, NO_CONTEXT)).toEqual({ kind: "none" });
    const unlinked = meeting();
    expect(opportunityCell(unlinked, NO_CONTEXT)).toEqual({ kind: "blank" });
    expect(regionCell(unlinked, NO_CONTEXT)).toEqual({ kind: "blank" });
    expect(ownerCell(unlinked, NO_CONTEXT)).toEqual({ kind: "host", email: "host@wso2.com", marked: true });
  });
});
