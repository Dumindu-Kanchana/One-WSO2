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
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { ApprovalInboxItem } from "@features/sales/cado2/approvals/api/approvalTypes";
import MyApprovalsPage from "./MyApprovalsPage";

const inbox = { data: [] as ApprovalInboxItem[], isPending: false, error: null, isFetching: false, refetch: vi.fn() };
vi.mock("@features/sales/cado2/approvals/api/useApprovalApi", () => ({ useApprovalInbox: () => inbox }));
vi.mock("@features/sales/cado2/api/useCado2Me", () => ({
  useCado2Me: () => ({ data: { sub: "s", email: "dd@wso2.com", roles: [], approverRoles: ["DEAL_DESK"] } }),
}));

function renderPage() {
  render(
    <MemoryRouter>
      <MyApprovalsPage />
    </MemoryRouter>,
  );
}

describe("MyApprovalsPage", () => {
  it("says so when nothing is waiting", () => {
    inbox.data = [];
    renderPage();
    expect(screen.getByText("Nothing is waiting for you")).toBeInTheDocument();
    expect(screen.getByText("Deal Desk")).toBeInTheDocument(); // the roles held, beside the title
  });

  it("lists each step waiting for the caller, linking to its quote", () => {
    inbox.data = [
      {
        stepId: 11, role: "DEAL_DESK", roleLabel: "Deal Desk", requestedAt: new Date().toISOString(), quoteId: 5,
        quoteNumber: "Q-26-00005", versionNumber: 2, accountName: "Northwind Logistics", opportunityName: "API Platform 2027",
        currencyIsoCode: "USD", tcv: "19440.00", submittedByEmail: "rep@wso2.com", submittedAt: null, repCategorisedLines: 2,
      },
    ];
    renderPage();
    const row = screen.getByRole("link", { name: /Northwind Logistics/ });
    expect(row).toHaveAttribute("href", "/sales/cado2/quotes/5/quote?from=approvals");
    expect(row).toHaveTextContent("As Deal Desk");
    expect(row).toHaveTextContent("USD 19,440.00");
    expect(row).toHaveTextContent("from rep@wso2.com");
    expect(row).not.toHaveTextContent("chosen by rep"); // shown on the quote, not in the inbox
  });

  it("shows each step's deadline, red once overdue", () => {
    const base = {
      role: "DEAL_DESK" as const, roleLabel: "Deal Desk", quoteId: 5, quoteNumber: "Q-26-00005", versionNumber: 1,
      opportunityName: "API Platform 2027", currencyIsoCode: "USD", tcv: "19440.00", submittedByEmail: null, submittedAt: null,
    };
    const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
    inbox.data = [
      { ...base, stepId: 1, accountName: "Overdue Co", requestedAt: hoursFromNow(-30), dueAt: hoursFromNow(-6), slaState: "BREACHED" },
      { ...base, stepId: 2, accountName: "Soon Co", requestedAt: hoursFromNow(-20), dueAt: hoursFromNow(4), slaState: "AT_RISK" },
    ];
    renderPage();
    expect(screen.getByRole("link", { name: /Overdue Co/ })).toHaveTextContent("Overdue by 6 h");
    expect(screen.getByRole("link", { name: /Soon Co/ })).toHaveTextContent("Due in 4 h");
    // The backend's order is kept: most urgent first.
    expect(screen.getAllByRole("link").map((l) => l.textContent?.includes("Overdue Co"))).toEqual([true, false]);
  });
});

