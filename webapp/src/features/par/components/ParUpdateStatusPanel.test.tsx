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
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ParCycle, ParRating } from "../api/types";

let rating: Partial<ParRating>;
const mutate = vi.fn();
vi.mock("../api/useParData", () => ({
  useParRating: () => ({ data: rating, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock("../api/useLeadRatingUpdate", () => ({ useLeadRatingUpdate: () => ({ mutate, isPending: false }) }));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));

const { default: ParUpdateStatusPanel } = await import("./ParUpdateStatusPanel");

const cycle = { parCycleId: 2, parCycleStartDate: "2026-11-01" } as ParCycle;
const panel = () => <ParUpdateStatusPanel cycle={cycle} employeeEmail="alex@example.com" />;
const pick = (field: string, option: string) => {
  fireEvent.mouseDown(screen.getByRole("combobox", { name: field }));
  fireEvent.click(screen.getByRole("option", { name: option }));
};

beforeEach(() => {
  mutate.mockReset();
  rating = { parRatingId: 7, parEmployeeStatus: "SHARED", parLeadStatus: "PENDING", parF2fStatus: "PENDING" };
});

describe("ParUpdateStatusPanel", () => {
  it("sends only the fields that changed", () => {
    render(panel());
    pick("Lead's Feedback Status", "Draft");
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(mutate.mock.calls[0][0].payload).toEqual({ parLeadStatus: "DRAFT" });
  });

  it("keeps an edit in progress when something else changes what's saved", () => {
    rating = { ...rating, parEmployeeStatus: "DRAFT" };
    const view = render(panel());
    pick("Lead's Feedback Status", "Draft");
    // The employee shares meanwhile, and a refetch brings it in.
    rating = { ...rating, parEmployeeStatus: "SHARED" };
    view.rerender(panel());
    expect(screen.getByRole("combobox", { name: "Lead's Feedback Status" })).toHaveTextContent("Draft");
    expect(screen.getByRole("combobox", { name: "Employee PAR Status" })).toHaveTextContent("Shared");
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(mutate.mock.calls[0][0].payload).toEqual({ parLeadStatus: "DRAFT" });
  });

  it("keeps an edit through a refresh that comes while saving, when the save fails", () => {
    rating = { ...rating, parEmployeeStatus: "DRAFT" };
    const view = render(panel());
    pick("Lead's Feedback Status", "Draft");
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    // The employee shares while the save is on its way, then the save fails.
    rating = { ...rating, parEmployeeStatus: "SHARED" };
    view.rerender(panel());
    act(() => mutate.mock.calls[0][1].onError(new Error("HTTP 500")));
    expect(screen.getByRole("combobox", { name: "Lead's Feedback Status" })).toHaveTextContent("Draft");
  });

  it("shows what's saved after a save changes more than was picked", () => {
    const view = render(panel());
    pick("Lead's Feedback Status", "Draft");
    // As the backend does: the employee's side locks once the lead's is a draft.
    rating = { ...rating, parLeadStatus: "DRAFT", parEmployeeStatus: "SHARED_BLOCKED" };
    view.rerender(panel());
    expect(screen.getByRole("combobox", { name: "Employee PAR Status" })).toHaveTextContent("Shared Blocked");
    expect(screen.getByRole("button", { name: "Update" })).toBeDisabled();
  });
});
