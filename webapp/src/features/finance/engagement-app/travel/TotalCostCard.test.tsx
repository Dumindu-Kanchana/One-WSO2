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

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HttpError } from "@api/http";
import type { JobCostSummary } from "../api/dashboardTypes";
import { TotalCostCardView } from "./TotalCostCard";
import { totalCostState } from "./totalCostState";

const summary: JobCostSummary = {
  totalUsd: 1234.5,
  bySource: [
    { source: "invoice", usd: 1000, lines: 2 },
    { source: "perDiem", usd: 234.5, lines: 1 },
    { source: "card", usd: 0, lines: 0 },
    { source: "claim", usd: 0, lines: 0 },
  ],
  notConverted: [],
  hasUnconvertedHidden: false,
  incomplete: false,
  failedSources: [],
  dataAsOf: "2026-11-25T08:15:00Z",
};

describe("TotalCostCardView", () => {
  it("shows the total, the split of the sources with cost, and the rate hint", () => {
    const { getByText, getByRole, queryByText } = render(<TotalCostCardView state={{ kind: "ready", data: summary }} />);
    expect(getByText("Total Cost So Far")).toBeTruthy();
    expect(getByText("USD 1,234.50")).toBeTruthy();
    expect(getByText("Travel Invoices USD 1,000.00, Per Diems USD 234.50")).toBeTruthy();
    expect(queryByText(/Credit Card Expenses/)).toBeNull();
    expect(getByRole("button", { name: "How USD is calculated" })).toBeTruthy();
  });

  it("shows the total alone for a travel agent, who gets no split", () => {
    const agent: JobCostSummary = { totalUsd: summary.totalUsd, notConverted: [], hasUnconvertedHidden: false, incomplete: false, failedSources: [], dataAsOf: summary.dataAsOf };
    const { getByText, queryByText } = render(<TotalCostCardView state={{ kind: "ready", data: agent }} />);
    expect(getByText("USD 1,234.50")).toBeTruthy();
    expect(queryByText(/Per Diems/)).toBeNull();
  });

  it("says what could not be converted, without a semicolon", () => {
    const data = { ...summary, notConverted: [{ source: "card" as const, currency: "EUR", amount: 80 }] };
    const { getByText } = render(<TotalCostCardView state={{ kind: "ready", data }} />);
    const line = getByText(/^Not converted, left out of the totals/);
    expect(line.textContent).toContain("EUR 80.00 (Credit Card Expenses)");
    expect(line.textContent).not.toContain(";");
  });

  it("shows a partial split, only the sources the viewer may open", () => {
    const data = { ...summary, bySource: [{ source: "invoice" as const, usd: 1000, lines: 2 }] };
    const { getByText, queryByText } = render(<TotalCostCardView state={{ kind: "ready", data }} />);
    expect(getByText("Travel Invoices USD 1,000.00")).toBeTruthy();
    expect(queryByText(/Per Diems/)).toBeNull();
  });

  it("says some amounts could not be converted when they are in a hidden section", () => {
    const data = { ...summary, hasUnconvertedHidden: true };
    const { getByText } = render(<TotalCostCardView state={{ kind: "ready", data }} />);
    expect(getByText("Some amounts could not be converted and are left out of the total.")).toBeTruthy();
  });

  it("warns that the total may be too low when a source failed", () => {
    const data = { ...summary, incomplete: true, failedSources: ["card" as const] };
    const { getByText } = render(<TotalCostCardView state={{ kind: "ready", data }} />);
    expect(getByText("Credit Card Expenses could not be read, so this total may be too low.")).toBeTruthy();
  });

  it("keeps the title and the rate hint while loading, with placeholders only where the figures will be", () => {
    const { getByTestId, getByText, getByRole, queryByText } = render(<TotalCostCardView state={{ kind: "loading" }} />);
    const card = getByTestId("total-cost-loading");
    expect(getByText("Total Cost So Far")).toBeTruthy();
    expect(getByRole("button", { name: "How USD is calculated" })).toBeTruthy();
    expect(card.querySelectorAll(".MuiSkeleton-root")).toHaveLength(3);
    expect(queryByText(/USD \d/)).toBeNull();
  });

  it("holds no place for the split line while loading for a viewer who gets none", () => {
    const { getByTestId } = render(<TotalCostCardView state={{ kind: "loading" }} split={false} />);
    expect(getByTestId("total-cost-loading").querySelectorAll(".MuiSkeleton-root")).toHaveLength(2);
  });

  it("renders nothing when hidden", () => {
    const { container } = render(<TotalCostCardView state={{ kind: "hidden" }} />);
    expect(container.textContent).toBe("");
  });

  it("shows a quiet message on error", () => {
    const { getByRole } = render(<TotalCostCardView state={{ kind: "error" }} />);
    expect(getByRole("status").textContent).toBe("The total cost so far isn't available right now.");
  });
});

describe("totalCostState", () => {
  const base = { isPending: false, isError: false, error: null, data: undefined };
  it("is loading while pending", () => {
    expect(totalCostState({ ...base, isPending: true }).kind).toBe("loading");
  });
  it("hides the card on 403 and 404", () => {
    expect(totalCostState({ ...base, isError: true, error: new HttpError("/x", 403, "") }).kind).toBe("hidden");
    expect(totalCostState({ ...base, isError: true, error: new HttpError("/x", 404, "") }).kind).toBe("hidden");
  });
  it("is a quiet error for any other failure", () => {
    expect(totalCostState({ ...base, isError: true, error: new HttpError("/x", 500, "") }).kind).toBe("error");
    expect(totalCostState({ ...base, isError: true, error: new Error("offline") }).kind).toBe("error");
  });
  it("is ready with data", () => {
    expect(totalCostState({ ...base, data: summary }).kind).toBe("ready");
  });
});
