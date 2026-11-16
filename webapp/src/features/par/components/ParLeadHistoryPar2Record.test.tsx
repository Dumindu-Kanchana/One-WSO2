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
import { render, screen } from "@testing-library/react";
import type { ParRating } from "../api/types";
import type { SelfReview } from "../api/selfReviewTypes";
import { encodeParComment } from "../util/parComment";

const selfReview: { isLoading: boolean; isError: boolean; data: SelfReview | null } = {
  isLoading: false,
  isError: false,
  data: null,
};

vi.mock("../api/useSelfReview", () => ({ useSelfReview: () => selfReview }));
vi.mock("./ParLead360Evidence", () => ({ default: () => <div>PAR 360° evidence</div> }));
vi.mock("./Leadership360ResultsCard", () => ({
  default: ({ leaderEmail }: { leaderEmail: string }) => <div>Leadership 360° results for {leaderEmail}</div>,
}));

const { default: ParLeadHistoryPar2Record } = await import("./ParLeadHistoryPar2Record");

const cycle = { parCycleId: 1 };
const template = {
  formTemplateId: 2,
  formKind: "SELF_REVIEW",
  formVersion: 2,
  definition: {
    kind: "SELF_REVIEW",
    version: 2,
    title: "Self-review",
    scales: {},
    sections: [{ id: "impact", title: "Impact this cycle", questions: [{ id: "impact", type: "TEXT", text: "Impact" }] }],
  },
} as SelfReview["template"];

function show(leader: boolean, leadComment = "Great half.") {
  const rating = {
    parLeadComment: leadComment ? encodeParComment(leadComment) : "",
    parIsLeadershipEmployee: leader,
  } as unknown as ParRating;
  render(<ParLeadHistoryPar2Record cycle={cycle} rating={rating} employeeEmail="alex@example.com" />);
}

beforeEach(() => {
  selfReview.data = null;
});

describe("ParLeadHistoryPar2Record", () => {
  it("shows the lead's feedback, the shared self-review and the PAR 360° responses", () => {
    selfReview.data = { employeeStatus: "SHARED", answers: { impact: "Shipped the sandbox" }, template };
    show(false);
    expect(screen.getByText("Great half.")).toBeInTheDocument();
    expect(screen.getByText("Shipped the sandbox")).toBeInTheDocument();
    expect(screen.getByText("PAR 360° evidence")).toBeInTheDocument();
    expect(screen.queryByText(/Leadership 360° results/)).not.toBeInTheDocument();
  });

  it("says so when nothing was shared", () => {
    selfReview.data = { employeeStatus: "PENDING", answers: {}, template };
    show(false, "");
    expect(screen.getByText("No feedback was shared.")).toBeInTheDocument();
    expect(screen.getByText("No self-review was shared.")).toBeInTheDocument();
  });

  it("shows a leader's Leadership 360° results instead of PAR 360°", () => {
    show(true);
    expect(screen.getByText("Leadership 360° results for alex@example.com")).toBeInTheDocument();
    expect(screen.queryByText("PAR 360° evidence")).not.toBeInTheDocument();
  });
});
