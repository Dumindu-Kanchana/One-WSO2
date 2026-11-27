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

import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bytesOf, captureDownloads } from "@/test/downloads";
import type { RiskListItem } from "../api/riskApi";
import RiskRegisters from "./RiskRegisters";

// The page talks to the backend only through the shim's fetch, so a fake of it
// stands in for the whole backend and records every request.
const authFetch = vi.fn();
vi.mock("@features/security/grc/shim/useAuthApiClient", () => ({
  useAuthApiClient: () => authFetch,
}));
vi.mock("@features/security/grc/shim/apiConfig", () => ({ BACKEND_BASE_URL: "http://backend.test" }));

const registers = [
  { id: 1, name: "Asgardeo", code: "ASG", register_template: "STANDARD" },
  { id: 2, name: "Managed Services", code: "MS", register_template: "MANAGED_SERVICES" },
  { id: 3, name: "WSO2 Cloud", code: "WSO2CLOUD", register_template: "AGGREGATED" },
].map((t) => ({ ...t, description: null, team_type: "BOTH", status: "ACTIVE" }));

function item(over: Partial<RiskListItem>): RiskListItem {
  return {
    id: 1,
    risk_code: "R-1",
    risk_title: "A risk",
    source_register_name: "Asgardeo",
    risk_level: "LOW",
    risk_level_color: "#00B050",
    owner_name: "Owner",
    assigner_name: "Assigner",
    workflow_status: "APPROVED",
    risk_type: "NEW",
    implementation_date: null,
    rejection_comment: null,
    rejection_stage: null,
    created_at: "2026-05-02T00:00:00Z",
    register_template: "STANDARD",
    customer_name: null,
    environments: [],
    platform_names: [],
    ...over,
  };
}

const msItem = item({
  id: 2,
  risk_code: "2026-MS-BANKONESUB-Q2-0001",
  source_register_name: "Managed Services",
  register_template: "MANAGED_SERVICES",
  customer_name: "Bank One Sub",
  environments: ["PRODUCTION", "DR"],
});
const cloudItem = item({
  id: 3,
  risk_code: "2026-WSO2CLOUD-Q2-0001",
  source_register_name: "WSO2 Cloud",
  register_template: "AGGREGATED",
  platform_names: ["Asgardeo", "Choreo"],
});
const standardItem = item({ id: 1, risk_code: "2026-ASG-Q2-0001" });

const lookups: Record<string, unknown> = {
  "/risks/customers": [
    { id: 1, name: "Bank One Sub", code: "BANKONESUB", status: "ACTIVE" },
    { id: 2, name: "Old Customer", code: "OLDCUST", status: "INACTIVE" },
  ],
  "/risks/platforms": [{ id: 1, name: "Choreo", status: "ACTIVE" }],
};

// What /me/privileges answers; a test narrows it to act as another role.
let privileges: string[] = ["RISK_VIEW_RISKS", "RISK_VIEW_ALL_RISKS"];

const listRequests = (): URLSearchParams[] =>
  authFetch.mock.calls
    .map(([u]) => String(u))
    .filter((u) => u.includes("/api/v1/risks?"))
    .map((u) => new URL(u).searchParams);
const lastList = (): URLSearchParams => listRequests().at(-1)!;
const requested = (): string[] =>
  authFetch.mock.calls.map(([u]) => String(u).replace("http://backend.test/api/v1", ""));

beforeEach(() => {
  privileges = ["RISK_VIEW_RISKS", "RISK_VIEW_ALL_RISKS"]; // Compliance
  authFetch.mockReset();
  authFetch.mockImplementation(async (input: string) => {
    const url = new URL(String(input));
    const path = url.pathname.replace("/api/v1", "");
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    if (path === "/me/privileges") return json({ privileges });
    if (path === "/risks/me/involvement") return json({ namedOnRisk: false });
    if (path === "/risks/teams") return json(registers);
    if (path === "/risks") {
      const teams = url.searchParams.get("team_id") ?? "";
      const items =
        teams === "2"
          ? [msItem]
          : teams === "3"
            ? [cloudItem]
            : teams === "1"
              ? [standardItem]
              : [standardItem, msItem, cloudItem];
      return json({ items, total: items.length, offset: 0, limit: 50 });
    }
    return json(path in lookups ? lookups[path] : []);
  });
});

const renderAt = (search: string) =>
  render(
    <MemoryRouter initialEntries={[`/risk/registers${search}`]}>
      <RiskRegisters />
    </MemoryRouter>,
  );

const headers = (): string[] => screen.getAllByRole("columnheader").map((h) => h.textContent ?? "");

describe("Risk Registers — register-template columns", () => {
  it("looks as it always did when no register is selected", async () => {
    renderAt("");
    await screen.findByText("2026-ASG-Q2-0001");
    expect(headers()).not.toContain("Customer");
    expect(headers()).not.toContain("Environment");
    expect(headers()).not.toContain("Platform");
    expect(requested()).not.toContain("/risks/customers");
  });

  it("adds Customer and Environment columns for a Managed Services register", async () => {
    renderAt("?team=2");
    const row = (await screen.findByText("2026-MS-BANKONESUB-Q2-0001")).closest("tr")!;
    expect(headers()).toEqual(expect.arrayContaining(["Customer", "Environment"]));
    expect(headers()).not.toContain("Platform");
    expect(within(row).getByText("Bank One Sub")).toBeInTheDocument();
    expect(within(row).getByText("Production, DR")).toBeInTheDocument();
  });

  it("adds a Platform column for an Aggregated register", async () => {
    renderAt("?team=3");
    const row = (await screen.findByText("2026-WSO2CLOUD-Q2-0001")).closest("tr")!;
    expect(headers()).toContain("Platform");
    expect(headers()).not.toContain("Customer");
    expect(within(row).getByText("Asgardeo, Choreo")).toBeInTheDocument();
  });

  it("adds nothing for a Standard register", async () => {
    renderAt("?team=1");
    await screen.findByText("2026-ASG-Q2-0001");
    expect(headers()).not.toContain("Customer");
    expect(headers()).not.toContain("Platform");
  });

  it("loads every customer, inactive ones too, so older risks stay filterable", async () => {
    const user = userEvent.setup();
    renderAt("?team=2");
    await screen.findByText("2026-MS-BANKONESUB-Q2-0001");
    await waitFor(() => expect(requested()).toContain("/risks/customers"));
    await user.click(screen.getByRole("button", { name: "Filter by Customer" }));
    expect(await screen.findByLabelText("Bank One Sub")).toBeInTheDocument();
    expect(screen.getByLabelText("Old Customer")).toBeInTheDocument();
  });

  it("filters by customer and by environment", async () => {
    const user = userEvent.setup();
    renderAt("?team=2");
    await screen.findByText("2026-MS-BANKONESUB-Q2-0001");
    await waitFor(() => expect(requested()).toContain("/risks/customers"));

    await user.click(screen.getByRole("button", { name: "Filter by Customer" }));
    await user.click(await screen.findByLabelText("Bank One Sub"));
    await waitFor(() => expect(lastList().get("customer_id")).toBe("1"));
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Filter by Environment" }));
    await user.click(await screen.findByLabelText("DR"));
    await waitFor(() => expect(lastList().get("environment")).toBe("DR"));
    expect(lastList().get("customer_id")).toBe("1");
  });

  it("filters by platform", async () => {
    const user = userEvent.setup();
    renderAt("?team=3");
    await screen.findByText("2026-WSO2CLOUD-Q2-0001");
    await waitFor(() => expect(requested()).toContain("/risks/platforms"));
    await user.click(screen.getByRole("button", { name: "Filter by Platform" }));
    await user.click(await screen.findByLabelText("Choreo"));
    await waitFor(() => expect(lastList().get("platform_id")).toBe("1"));
  });

  it("drops a template filter, and its column, when the register filter widens to a mix", async () => {
    const user = userEvent.setup();
    renderAt("?team=2");
    await screen.findByText("2026-MS-BANKONESUB-Q2-0001");
    await waitFor(() => expect(requested()).toContain("/risks/customers"));
    await user.click(screen.getByRole("button", { name: "Filter by Customer" }));
    await user.click(await screen.findByLabelText("Bank One Sub"));
    await waitFor(() => expect(lastList().get("customer_id")).toBe("1"));
    await user.keyboard("{Escape}");

    // Add Asgardeo to the Register filter: registers on two templates, so the
    // Customer column has no meaning and must not keep filtering unseen.
    await user.click(screen.getByRole("button", { name: "Filter by Register" }));
    await user.click(await screen.findByLabelText("Asgardeo"));
    // The open popover hides the table from the accessibility tree.
    await user.keyboard("{Escape}");
    await waitFor(() => expect(headers()).not.toContain("Customer"));
    await waitFor(() => expect(lastList().get("customer_id")).toBeNull());
    expect(lastList().get("team_id")).toBe("2,1");
  });
});

describe("Risk Registers — dashboard deep links", () => {
  it("filters by the valid team and category ids and drops the rest", async () => {
    renderAt("?team=2,abc,0,1&category=5,-1,x,6");
    await waitFor(() => expect(lastList().get("team_id")).toBe("2,1"));
    expect(lastList().get("category_id")).toBe("5,6");
    expect(await screen.findByText("#5, #6")).toBeInTheDocument();
  });

  it("sends no filter when every id in the link is invalid", async () => {
    renderAt("?team=abc,0&category=-3,x");
    await screen.findByText("2026-ASG-Q2-0001");
    expect(listRequests().every((p) => p.get("team_id") === null && p.get("category_id") === null)).toBe(true);
    expect(screen.queryByText("Risk Category:")).not.toBeInTheDocument();
  });

  it("stops filtering by category when its chip is removed", async () => {
    const user = userEvent.setup();
    renderAt("?category=5,6");
    await waitFor(() => expect(lastList().get("category_id")).toBe("5,6"));

    await user.click(within(screen.getByText("Risk Category:").parentElement!).getByTestId("CancelIcon"));

    await waitFor(() => expect(lastList().get("category_id")).toBeNull());
    expect(screen.queryByText("Risk Category:")).not.toBeInTheDocument();
  });
});

describe("Risk Registers — Report Download", () => {
  const exportRequests = (): URLSearchParams[] =>
    authFetch.mock.calls
      .map(([u]) => String(u))
      .filter((u) => u.includes("/api/v1/risks/export?"))
      .map((u) => new URL(u).searchParams);

  // Answers the export endpoint with a CSV, and everything else as the page's
  // default fake does.
  const answerExport = (response: () => Response) => {
    const base = authFetch.getMockImplementation()!;
    authFetch.mockImplementation(async (input: string) =>
      String(input).includes("/api/v1/risks/export") ? response() : base(input),
    );
  };

  it("downloads the CSV for the filters in force, with no paging", async () => {
    const csv = "\uFEFFRisk Code\n2026-MS-BANKONESUB-Q2-0001\n";
    answerExport(
      () =>
        new Response(csv, {
          status: 200,
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": 'attachment; filename="risk-report-2026-10-27.csv"',
          },
        }),
    );
    const downloads = captureDownloads();
    const user = userEvent.setup();
    renderAt("?team=2");
    await screen.findByText("2026-MS-BANKONESUB-Q2-0001");

    await user.click(screen.getByRole("button", { name: "Report Download" }));

    await waitFor(() => expect(downloads.filenames).toEqual(["risk-report-2026-10-27.csv"]));
    expect(Array.from(new Uint8Array(await bytesOf(downloads.blobs[0])))).toEqual(
      Array.from(new TextEncoder().encode(csv)),
    );
    const sent = exportRequests();
    expect(sent).toHaveLength(1);
    expect(sent[0].get("team_id")).toBe("2");
    expect(sent[0].get("statuses")).not.toBeNull(); // the tab's scope travels too
    expect(sent[0].get("limit")).toBeNull();
    expect(sent[0].get("offset")).toBeNull();
  });

  it("disables Report Download when the filters return no risks", async () => {
    const base = authFetch.getMockImplementation()!;
    authFetch.mockImplementation(async (input: string) =>
      new URL(String(input)).pathname === "/api/v1/risks"
        ? new Response(JSON.stringify({ items: [], total: 0, offset: 0, limit: 50 }), { status: 200 })
        : base(input),
    );
    renderAt("");

    expect(await screen.findByText("No risks found.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Report Download" })).toBeDisabled();
  });

  it("shows the server's message when the export fails", async () => {
    answerExport(() => new Response(JSON.stringify({ message: "too many risks" }), { status: 422 }));
    const downloads = captureDownloads();
    const user = userEvent.setup();
    renderAt("");
    await screen.findByText("2026-ASG-Q2-0001");

    await user.click(screen.getByRole("button", { name: "Report Download" }));

    expect(await screen.findByText("too many risks")).toBeInTheDocument();
    expect(downloads.blobs).toHaveLength(0);
  });
  // Report Download is for Compliance Admin and Compliance Team only; they hold
  // RISK_VIEW_ALL_RISKS and nobody else does.
  it.each([
    ["a risk owner", ["RISK_VIEW_RISKS", "RISK_OWNER_APPROVE"]],
    ["a risk assigner", ["RISK_VIEW_RISKS", "RISK_CREATE", "RISK_UPDATE"]],
    ["someone with no risk role", []],
  ])("hides Report Download from %s", async (_who, granted) => {
    privileges = granted;
    renderAt("");
    await screen.findByText("2026-ASG-Q2-0001");
    await waitFor(() => expect(requested()).toContain("/risks/me/involvement"));
    // The button is hidden until the privileges arrive anyway, so let them land
    // before asserting it is still hidden.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(screen.queryByRole("button", { name: "Report Download" })).not.toBeInTheDocument();
  });

  it("shows Report Download to Compliance", async () => {
    renderAt("");
    await screen.findByText("2026-ASG-Q2-0001");

    expect(await screen.findByRole("button", { name: "Report Download" })).toBeEnabled();
  });
});

describe("Risk Registers — Import risks", () => {
  // Import risks is the Compliance Admin's alone: RISK_BULK_UPLOAD. Compliance
  // Team, who can download the report, must not see it.
  it.each([
    ["Compliance Team", ["RISK_VIEW_RISKS", "RISK_VIEW_ALL_RISKS"]],
    ["a risk assigner", ["RISK_VIEW_RISKS", "RISK_CREATE", "RISK_UPDATE"]],
    ["someone with no risk role", []],
  ])("hides Import risks from %s", async (_who, granted) => {
    privileges = granted;
    renderAt("");
    await screen.findByText("2026-ASG-Q2-0001");
    await waitFor(() => expect(requested()).toContain("/risks/me/involvement"));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(screen.queryByRole("button", { name: "Import risks" })).not.toBeInTheDocument();
  });

  it("shows Import risks to the Compliance Admin and opens the import dialog", async () => {
    privileges = ["RISK_VIEW_RISKS", "RISK_VIEW_ALL_RISKS", "RISK_BULK_UPLOAD"];
    const user = userEvent.setup();
    renderAt("");
    await screen.findByText("2026-ASG-Q2-0001");

    // Report Download is still there beside it.
    expect(await screen.findByRole("button", { name: "Report Download" })).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Import risks" }));

    expect(await screen.findByRole("dialog", { name: "Import risks from CSV" })).toBeInTheDocument();
  });
});
