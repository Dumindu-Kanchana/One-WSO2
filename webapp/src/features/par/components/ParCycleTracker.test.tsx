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
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import type { Par360Reviewer, ParCycle, ParRating } from "../api/types";
import type { HomeStepKey } from "../util/parHome";

const query = <T,>(data: T) => ({ data, isLoading: false, isError: false, refetch: vi.fn() });

let rating: Partial<ParRating>;
let reviewers: Partial<Par360Reviewer>[];
let countFails = false;
let countLoading = false;
let ratingLoading = false;
const retryCount = vi.fn();

vi.mock("../api/useParData", () => ({
  useParRating: () =>
    ratingLoading ? { data: undefined, isLoading: true, isError: false, refetch: vi.fn() } : query(rating),
}));
vi.mock("../api/usePar360", () => ({ useReviewers: () => query(reviewers) }));
vi.mock("../api/useReview360", () => ({
  useReviewCount: () =>
    countFails
      ? { data: undefined, isLoading: false, isError: true, error: new Error("Unavailable"), isFetching: false, refetch: retryCount }
      : countLoading
        ? { data: undefined, isLoading: true, isError: false, refetch: vi.fn() }
        : query(undefined),
}));
vi.mock("../api/useLeadership360", () => ({
  cycleSurvey: () => undefined,
  useLeadership360Surveys: () => query([]),
  useLeadership360Results: () => query([]),
}));

const { default: ParCycleTracker } = await import("./ParCycleTracker");

const FUTURE = "2999-12-31";
const PAST = "2000-01-01";
const cycle = {
  parCycleId: 2,
  parEmployeeDeadline: FUTURE,
  parThreeSixtyRatingDeadline: FUTURE,
  parLeadDeadline: FUTURE,
  parF2FDeadline: FUTURE,
} as ParCycle;

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function show(selected: HomeStepKey = "self-review", forCycle: ParCycle = cycle) {
  render(
    <MemoryRouter initialEntries={[`/me/performance/cycle/${selected}`]}>
      <ParCycleTracker cycle={forCycle} workEmail="me@example.com" selected={selected}>
        <div>The step's page</div>
      </ParCycleTracker>
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

const step = (label: string) => screen.getByText(label).closest("li")!;

beforeEach(() => {
  rating = { parEmployeeStatus: "DRAFT", parLeadStatus: "PENDING", parF2fStatus: "PENDING" };
  reviewers = [];
  countFails = false;
  countLoading = false;
  ratingLoading = false;
  retryCount.mockReset();
});

describe("ParCycleTracker", () => {
  it("shows each step's number, name and state, and nothing else", () => {
    show();
    expect(step("Self-review")).toHaveTextContent(/^1Self-reviewIn progress$/);
    expect(step("360° feedback")).toHaveTextContent(/^2360° feedbackNot started$/);
    expect(step("Lead review")).toHaveTextContent(/^3Lead reviewNot available yet$/);
    expect(step("Face-to-face")).toHaveTextContent(/^4Face-to-faceNot available yet$/);
  });

  it("puts the open step's page in the panel, under its heading and its date with the days left", () => {
    show();
    expect(screen.getByRole("heading", { name: "Write your self-review" })).toBeInTheDocument();
    expect(screen.getByText("Due 31 Dec '99")).toBeInTheDocument();
    expect(screen.getByText(/days left/)).toBeInTheDocument();
    expect(screen.getByText("The step's page")).toBeInTheDocument();
  });

  it("gives the lead's date as Expected by, without days left", () => {
    show("lead-review");
    expect(screen.getByRole("heading", { name: "Lead review" })).toBeInTheDocument();
    expect(screen.getByText("Expected by 31 Dec '99")).toBeInTheDocument();
    expect(screen.queryByText(/days left/)).not.toBeInTheDocument();
  });

  it("says when an Incomplete step's deadline passed, with no date on the right", () => {
    show("self-review", { ...cycle, parEmployeeDeadline: PAST });
    expect(step("Self-review")).toHaveTextContent("Incomplete");
    expect(screen.getByRole("heading", { name: "Self-review not shared" })).toBeInTheDocument();
    expect(screen.getByText("The self-review deadline passed on 1 Jan '00.")).toBeInTheDocument();
    expect(screen.queryByText(/^Due /)).not.toBeInTheDocument();
  });

  it("opens every step, the ones with nothing to do yet too", async () => {
    const user = userEvent.setup();
    show();
    expect(step("Self-review").querySelector("[aria-current='page']")).not.toBeNull();
    await user.click(step("Lead review").querySelector("button")!);
    expect(screen.getByTestId("where")).toHaveTextContent("/me/performance/cycle/lead-review");
    await user.click(step("Face-to-face").querySelector("button")!);
    expect(screen.getByTestId("where")).toHaveTextContent("/me/performance/cycle/f2f");
  });

  it("says 360° feedback is Completed at 3 submitted", () => {
    reviewers = ["SHARED", "SHARED", "SHARED", "PENDING"].map((reviewStatus, n) => ({
      reviewerEmail: `r${n}@example.com`,
      reviewStatus: reviewStatus as Par360Reviewer["reviewStatus"],
      isEmployeeRequested: true,
    }));
    show();
    expect(step("360° feedback")).toHaveTextContent("Completed");
  });

  it("says when how many responded couldn't be loaded, with Retry, and still shows the step's page", async () => {
    countFails = true;
    show();
    expect(screen.getByText(/Couldn't load your PAR cycle's progress/)).toBeInTheDocument();
    expect(screen.getByText("The step's page")).toBeVisible();
    expect(screen.queryByText("360° feedback")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retryCount).toHaveBeenCalled();
  });

  it("loads the step's page out of sight until the PAR record and how many responded are in", () => {
    for (const loading of ["rating", "count"]) {
      ratingLoading = loading === "rating";
      countLoading = loading === "count";
      const view = render(
        <MemoryRouter initialEntries={["/me/performance/cycle/self-review"]}>
          <ParCycleTracker cycle={cycle} workEmail="me@example.com" selected="self-review">
            <div>The step's page</div>
          </ParCycleTracker>
        </MemoryRouter>,
      );
      expect(screen.getByText("The step's page")).not.toBeVisible();
      expect(screen.queryByText("360° feedback")).not.toBeInTheDocument();
      expect(screen.queryByRole("heading")).not.toBeInTheDocument();
      view.unmount();
    }
  });

  it("shows the steps and the step's page together once both are in", () => {
    countLoading = true;
    const tree = () => (
      <MemoryRouter initialEntries={["/me/performance/cycle/self-review"]}>
        <ParCycleTracker cycle={cycle} workEmail="me@example.com" selected="self-review">
          <div>The step's page</div>
        </ParCycleTracker>
      </MemoryRouter>
    );
    const view = render(tree());
    countLoading = false;
    view.rerender(tree());
    expect(screen.getByText("360° feedback")).toBeInTheDocument();
    expect(screen.getByText("The step's page")).toBeVisible();
  });

  it("keeps what was picked on the step's page when the count loads after a retry", async () => {
    function Picker() {
      const [picked, setPicked] = useState("");
      return <button onClick={() => setPicked("Maya")}>{picked || "Pick someone"}</button>;
    }
    const tree = () => (
      <MemoryRouter initialEntries={["/me/performance/cycle/360"]}>
        <ParCycleTracker cycle={cycle} workEmail="me@example.com" selected="360">
          <Picker />
        </ParCycleTracker>
      </MemoryRouter>
    );
    countFails = true;
    const view = render(tree());
    await userEvent.click(screen.getByRole("button", { name: "Pick someone" }));
    countFails = false;
    view.rerender(tree());
    expect(screen.getByText("360° feedback")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Maya" })).toBeInTheDocument();
  });
});
