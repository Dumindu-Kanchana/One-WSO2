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
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import type { ParCycle, ParRating } from "../api/types";

const query = <T,>(data: T) => ({ data, isLoading: false, isError: false, refetch: vi.fn() });

let rating: Partial<ParRating>;

vi.mock("../api/useParData", () => ({ useParRating: () => query(rating) }));
vi.mock("../api/usePar360", () => ({ useReviewers: () => query([]), useReviewRequests: () => query([]) }));
vi.mock("../api/useSelfReview", () => ({ useSelfReview: () => query(undefined) }));
vi.mock("../api/useLeadership360", () => ({
  cycleSurvey: () => undefined,
  useLeadership360Surveys: () => query([]),
  useLeadership360Results: () => query([]),
}));

const { default: ParCycleTracker } = await import("./ParCycleTracker");

const FUTURE = "2999-12-31";
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

function show() {
  render(
    <MemoryRouter initialEntries={["/me/performance/cycle/self-review"]}>
      <ParCycleTracker cycle={cycle} workEmail="me@example.com" selected="self-review" />
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

const step = (label: string) => screen.getByText(label).closest("li")!;

beforeEach(() => {
  rating = { parEmployeeStatus: "DRAFT", parLeadStatus: "PENDING", parF2fStatus: "PENDING" };
});

describe("ParCycleTracker", () => {
  it("outlines the open step, and the whole box of a step opens its part", async () => {
    const user = userEvent.setup();
    show();
    expect(step("Self-review").querySelector("[aria-current='page']")).not.toBeNull();
    await user.click(step("360° feedback").querySelector("button")!);
    expect(screen.getByTestId("where")).toHaveTextContent("/me/performance/cycle/360");
  });

  it("has nothing to open for the lead's review until the lead shares", async () => {
    show();
    expect(step("Lead review").querySelector("button")).toBeNull();
  });

  it("opens the lead's review once shared", async () => {
    const user = userEvent.setup();
    rating = { ...rating, parEmployeeStatus: "SHARED", parLeadStatus: "SHARED" };
    show();
    await user.click(step("Lead review").querySelector("button")!);
    expect(screen.getByTestId("where")).toHaveTextContent("/me/performance/cycle/lead-review");
  });
});
