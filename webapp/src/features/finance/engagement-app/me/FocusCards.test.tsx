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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { TravelRequestSummary } from "../api/engagementTypes";
import { TravelsFocus } from "./FocusCards";

const trip = (over: Partial<TravelRequestSummary>): TravelRequestSummary => ({
  jobNumber: "TRV-1",
  status: "New",
  traveller: { email: "a@wso2.com", name: "A" },
  country: "India",
  city: "Pune",
  start: "2020-01-01",
  end: "2020-01-05",
  ...over,
});

const draw = (trips: TravelRequestSummary[]) =>
  render(
    <MemoryRouter>
      <TravelsFocus trips={trips} />
    </MemoryRouter>,
  );

describe("TravelsFocus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 25, 12, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("holds its place with its title while the trips load", () => {
    render(
      <MemoryRouter>
        <TravelsFocus trips={[]} loading />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("focus-loading")).toBeInTheDocument();
    expect(screen.getByText("Under Way and Upcoming")).toBeInTheDocument();
  });

  it("leaves out an In Progress trip from 2018 that was never closed", () => {
    draw([trip({ jobNumber: "TRV-OLD", status: "In Progress", start: "2018-02-26", end: "2018-03-02" }), trip({ jobNumber: "TRV-NEW", status: "New", start: "2027-11-01", end: "2027-11-05" })]);
    expect(screen.queryByText("TRV-OLD")).toBeNull();
    expect(screen.getByText("TRV-NEW")).toBeInTheDocument();
  });

  it("keeps an In Progress or Extended trip that ended within the last 30 days", () => {
    draw([
      trip({ jobNumber: "TRV-A", status: "In Progress", start: "2026-11-10", end: "2026-11-15" }),
      trip({ jobNumber: "TRV-B", status: "Extended", start: "2026-10-30", end: "2026-10-27" }),
      trip({ jobNumber: "TRV-LATE", status: "Extended", start: "2026-09-01", end: "2026-10-20" }),
    ]);
    expect(screen.getByText("TRV-A")).toBeInTheDocument();
    expect(screen.getByText("TRV-B")).toBeInTheDocument();
    expect(screen.queryByText("TRV-LATE")).toBeNull();
  });

  it("drops a New or On Hold trip whose end date has passed, and a Completed one", () => {
    draw([trip({ jobNumber: "TRV-C", status: "New", end: "2026-11-15" }), trip({ jobNumber: "TRV-D", status: "On Hold", end: "2026-11-15" }), trip({ jobNumber: "TRV-E", status: "Completed", end: "2026-11-15" })]);
    expect(screen.queryByText("TRV-C")).toBeNull();
    expect(screen.queryByText("TRV-D")).toBeNull();
    expect(screen.queryByText("TRV-E")).toBeNull();
  });

  it("lists the current trip first, then upcoming ones by start date, at most three", () => {
    draw([
      trip({ jobNumber: "TRV-3", status: "New", start: "2027-03-01", end: "2027-03-05" }),
      trip({ jobNumber: "TRV-2", status: "New", start: "2026-12-01", end: "2026-12-05" }),
      trip({ jobNumber: "TRV-1", status: "In Progress", start: "2026-11-24", end: "2026-11-28" }),
      trip({ jobNumber: "TRV-4", status: "New", start: "2027-06-01", end: "2027-06-05" }),
    ]);
    const ids = screen.getAllByText(/^TRV-\d$/).map((e) => e.textContent);
    expect(ids).toEqual(["TRV-1", "TRV-2", "TRV-3"]);
  });
});
