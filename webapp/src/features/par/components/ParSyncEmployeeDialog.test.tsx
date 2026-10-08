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


import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ParCycle } from "../api/types";

const enabledSeen = { leave: [] as boolean[], lead: [] as (string | undefined)[] };

vi.mock("@features/leave/api/useLeaveData", () => ({
  useLeaveEmployees: (enabled = true) => {
    enabledSeen.leave.push(enabled);
    return {
      data: enabled ? [{ workEmail: "ada@wso2.com", firstName: "Ada", lastName: "Lovelace" }] : undefined,
      isLoading: false,
    };
  },
}));

vi.mock("../api/useLeadHistory", () => ({
  useParLeadEmployees: (leadEmail: string | undefined) => {
    enabledSeen.lead.push(leadEmail);
    return {
      data: leadEmail
        ? [
            { employeeName: "Lead Self", workEmail: "lead@wso2.com" },
            { employeeName: "Grace Hopper", workEmail: "grace@wso2.com" },
          ]
        : undefined,
      isLoading: false,
    };
  },
}));

vi.mock("../api/useParMutations", () => ({
  useSyncEmployee: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));

const { default: ParSyncEmployeeDialog } = await import("./ParSyncEmployeeDialog");

const cycle = { parCycleId: 1 } as ParCycle;

function openOptions() {
  const input = screen.getByRole("combobox");
  fireEvent.mouseDown(input);
  return within(screen.getByRole("listbox"))
    .getAllByRole("option")
    .map((option) => option.textContent);
}

describe("ParSyncEmployeeDialog", () => {
  it("lists only the lead's own reports, without the lead", () => {
    enabledSeen.leave.length = 0;
    render(<ParSyncEmployeeDialog open onClose={() => {}} cycle={cycle} leadEmail="lead@wso2.com" />);
    const options = openOptions();
    expect(options).toHaveLength(1);
    expect(options[0]).toContain("grace@wso2.com");
    expect(enabledSeen.leave.every((enabled) => !enabled)).toBe(true);
  });

  it("lists every employee when no lead is given", () => {
    render(<ParSyncEmployeeDialog open onClose={() => {}} cycle={cycle} />);
    const options = openOptions();
    expect(options).toHaveLength(1);
    expect(options[0]).toContain("ada@wso2.com");
  });
});
