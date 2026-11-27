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
import type { Review360Responses } from "../api/review360Types";

let data: Review360Responses;
vi.mock("../api/useReview360", () => ({
  useReviewResponses: () => ({ data, isLoading: false, isError: false, refetch: vi.fn() }),
}));

const { default: ParLead360Evidence, ParLead360Guidance } = await import("./ParLead360Evidence");

const definition = {
  kind: "PEER_360",
  version: 1,
  title: "360° feedback",
  scales: { frequency: { min: 1, max: 5, minLabel: "Rarely", maxLabel: "Role model" } },
  sections: [
    {
      id: "behaviours",
      title: "Behaviours",
      questions: [{ id: "ownership", type: "RATING", text: "Ownership", scale: "frequency" }],
    },
  ],
} as Review360Responses["template"]["definition"];

const response = (n: number) => ({ reviewerEmail: `r${n}@example.com`, reviewerName: `Reviewer ${n}`, answers: { ownership: 4 } });

const responses = (count: number, withIndex: boolean): Review360Responses =>
  ({
    template: { formTemplateId: 1, formKind: "PEER_360", formVersion: 1, definition },
    responseCount: count,
    teamMembersWithResponses: 2,
    questionAverages: withIndex ? [{ questionId: "ownership", average: 4, ratingCount: count }] : [],
    responses: Array.from({ length: count }, (_, i) => response(i + 1)),
    ...(withIndex ? { index: 4, teamIndex: 3.7 } : {}),
  }) as Review360Responses;

const OPEN = "2999-12-31";
const PASSED = "2020-01-01";

beforeEach(() => {
  data = responses(2, false);
});

describe("ParLead360Evidence", () => {
  it("below 3, shows the responses but not the index or averages", () => {
    render(<ParLead360Evidence parCycleId={2} employeeEmail="gina@example.com" threeSixtyDeadline={OPEN} />);
    expect(screen.getByText("The 360° index shows after 3 or more submissions.")).toBeInTheDocument();
    expect(screen.getByText("Reviewer 1")).toBeInTheDocument();
    expect(screen.getByText("Reviewer 2")).toBeInTheDocument();
    expect(screen.queryByText("360° index")).not.toBeInTheDocument();
  });

  it("from 3, shows the index beside the team average", () => {
    data = responses(3, true);
    render(<ParLead360Evidence parCycleId={2} employeeEmail="gina@example.com" threeSixtyDeadline={OPEN} />);
    expect(screen.getAllByText("360° index").length).toBeGreaterThan(0);
    expect(screen.getByText("Reviewer 3")).toBeInTheDocument();
    expect(screen.queryByText(/shows after 3/)).not.toBeInTheDocument();
  });

  it("beside the rating, says when the index will show", () => {
    data = responses(1, false);
    render(<ParLead360Guidance parCycleId={2} employeeEmail="gina@example.com" threeSixtyDeadline={OPEN} />);
    expect(screen.getByText("The 360° index shows after 3 or more submissions.")).toBeInTheDocument();
  });

  it("once the 360° deadline has passed with fewer than 3, says there's no index this cycle, and keeps the responses", () => {
    render(<ParLead360Evidence parCycleId={2} employeeEmail="gina@example.com" threeSixtyDeadline={PASSED} />);
    expect(
      screen.getByText("Fewer than 3 people submitted by the 360° deadline, so there's no 360° index this cycle."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/shows after 3/)).not.toBeInTheDocument();
    expect(screen.getByText("Reviewer 1")).toBeInTheDocument();
  });

  it("says there's no 360° feedback when no one submitted by the 360° deadline", () => {
    data = responses(0, false);
    render(<ParLead360Evidence parCycleId={2} employeeEmail="gina@example.com" threeSixtyDeadline={PASSED} />);
    expect(
      screen.getByText("Fewer than 3 people submitted by the 360° deadline, so there's no 360° feedback this cycle."),
    ).toBeInTheDocument();
    expect(screen.queryByText("No one has submitted yet.")).not.toBeInTheDocument();
  });

  it("still shows the feedback from 3 once the deadline has passed", () => {
    data = responses(3, true);
    render(<ParLead360Evidence parCycleId={2} employeeEmail="gina@example.com" threeSixtyDeadline={PASSED} />);
    expect(screen.getByText("Reviewer 3")).toBeInTheDocument();
    expect(screen.queryByText(/^Fewer than 3/)).not.toBeInTheDocument();
  });

  it("beside the rating, shows nothing once the 360° deadline has passed with fewer than 3", () => {
    const { container } = render(
      <ParLead360Guidance parCycleId={2} employeeEmail="gina@example.com" threeSixtyDeadline={PASSED} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
