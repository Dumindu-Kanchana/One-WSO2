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
import type { MyOverview, UserInfo } from "../api/engagementTypes";

const state = {
  info: { data: { email: "jane@wso2.com", allocations: { privileges: [] }, travel: { privileges: [49] } } as UserInfo | undefined, isSuccess: true, isError: false, isFetching: false, error: null as unknown, refetch: vi.fn() },
  overview: { data: undefined as MyOverview | undefined, isPending: false, isError: false, isFetching: false, error: null as unknown },
};

vi.mock("@config/apiConfig", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@config/apiConfig")>()),
  isEngagementAppBackendConfigured: () => true,
}));
vi.mock("../api/useEngagementUserInfo", () => ({ useEngagementUserInfo: () => state.info }));
vi.mock("../api/useEngagementApi", () => ({ useMyOverview: () => ({ ...state.overview, refetch: vi.fn() }) }));

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { tripsWaiting } from "../api/dashboardMappers";
import VisaCard from "./VisaCard";

const original = window.config;
const draw = () =>
  render(
    <MemoryRouter>
      <VisaCard />
    </MemoryRouter>,
  );

const trip = { jobNumber: "TRV-1", country: "India", start: "2027-01-10", end: "2027-01-20", waiting: false };

beforeEach(() => {
  window.config = { ...(original ?? {}), ONE_WSO2_PREVIEW_FEATURES: { engagementApp: true } } as Window["config"];
  state.info = { data: { email: "jane@wso2.com", allocations: { privileges: [] }, travel: { privileges: [49] } } as UserInfo, isSuccess: true, isError: false, isFetching: false, error: null, refetch: vi.fn() };
  state.overview = { data: { allocations: [], trips: [], tripVisas: [] }, isPending: false, isError: false, isFetching: false, error: null };
});
afterEach(() => {
  window.config = original;
});

describe("tripsWaiting", () => {
  it("counts the trips waiting for a visa", () => {
    expect(tripsWaiting([trip, { ...trip, waiting: true }, { ...trip, waiting: true }])).toBe(2);
    expect(tripsWaiting([])).toBe(0);
  });
});

describe("the visa card on the Me overview", () => {
  it("stays silent when the access check fails, like the Upcoming card", () => {
    state.info = { data: undefined, isSuccess: false, isError: true, isFetching: false, error: new Error("boom"), refetch: vi.fn() };
    const { container } = draw();
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps its title and count label while the trips load", () => {
    state.overview = { data: undefined, isPending: true, isError: false, isFetching: true, error: null };
    draw();
    expect(screen.getByText("Visas for Upcoming Travels")).toBeInTheDocument();
    expect(screen.getByText("Travels Waiting for a Visa")).toBeInTheDocument();
  });

  it("is not drawn when there are no upcoming trips", () => {
    const { container } = draw();
    expect(container).toBeEmptyDOMElement();
  });

  it("is not drawn for an older backend that sends no visas", () => {
    state.overview.data = { allocations: [], trips: [] };
    const { container } = draw();
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the waiting count on top and each trip's visa", () => {
    state.overview.data = {
      allocations: [],
      trips: [],
      tripVisas: [
        { ...trip, waiting: true, tripVisa: "No Valid Visa Available" },
        { ...trip, jobNumber: "TRV-2", country: "Japan", tripVisa: "B1/B2, ends 2027-03-01", myVisa: { type: "B1/B2", endDate: "2027-03-01" } },
      ],
    };
    draw();
    expect(screen.getByText("Travels Waiting for a Visa")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("Waiting for a visa")).toBeTruthy();
    expect(screen.getByText("Covered")).toBeTruthy();
    expect(screen.getByText(/Your visa: B1\/B2, ends/)).toBeTruthy();
    expect(screen.getByText("No visa of yours covers this trip")).toBeTruthy();
  });
});
