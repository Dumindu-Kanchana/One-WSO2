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

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminTeam } from "../api/adminApi";
import RiskTeamsPage from "./RiskTeamsPage";

const authFetch = vi.fn();
vi.mock("@features/security/grc/shim/useAuthApiClient", () => ({
  useAuthApiClient: () => authFetch,
}));
vi.mock("@features/security/grc/shim/apiConfig", () => ({ BACKEND_BASE_URL: "http://backend.test" }));

let teams: AdminTeam[] = [];

const writes = (method: string) =>
  authFetch.mock.calls
    .filter(([, init]) => init?.method === method)
    .map(([url, init]) => ({ url: String(url), body: JSON.parse(String(init.body)) }));

beforeEach(() => {
  authFetch.mockReset();
  authFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
    if (init?.method === "POST") return new Response(JSON.stringify({ id: 99 }), { status: 201 });
    if (init?.method === "PUT") return new Response(null, { status: 204 });
    return new Response(JSON.stringify(teams), { status: 200 });
  });
});

const openAdd = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole("button", { name: /Add Team/ }));
  await screen.findByLabelText("Name");
};

const chooseType = async (user: ReturnType<typeof userEvent.setup>, option: RegExp) => {
  await user.click(screen.getByRole("combobox", { name: "Team Type" }));
  await user.click(await screen.findByRole("option", { name: option }));
};

describe("RiskTeamsPage dialog — Team Type and Code", () => {
  it("asks for the Team Type before the Code", async () => {
    teams = [];
    const user = userEvent.setup();
    render(<RiskTeamsPage />);
    await openAdd(user);
    const type = screen.getByRole("combobox", { name: "Team Type" });
    const code = screen.getByLabelText("Code *");
    expect(type.compareDocumentPosition(code) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("does not ask an assignment team for a code, and sends none", async () => {
    teams = [];
    const user = userEvent.setup();
    render(<RiskTeamsPage />);
    await openAdd(user);
    await user.type(screen.getByLabelText("Name"), "SRE Team A");
    await user.type(screen.getByLabelText("Code *"), "typed-before-switching");
    await chooseType(user, /Assignment/);
    expect(screen.queryByLabelText(/^Code/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(writes("POST")).toHaveLength(1));
    expect(writes("POST")[0].body).toMatchObject({ name: "SRE Team A", team_type: "ASSIGNMENT", code: null });
  });

  it("still requires a code for a register", async () => {
    teams = [];
    const user = userEvent.setup();
    render(<RiskTeamsPage />);
    await openAdd(user);
    await user.type(screen.getByLabelText("Name"), "WSO2 Cloud");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Code is required for a Register team.")).toBeInTheDocument();
    expect(writes("POST")).toHaveLength(0);
  });

  it("brings the code field back when the type is switched to Register", async () => {
    teams = [];
    const user = userEvent.setup();
    render(<RiskTeamsPage />);
    await openAdd(user);
    await chooseType(user, /Assignment/);
    expect(screen.queryByLabelText(/^Code/)).not.toBeInTheDocument();
    await chooseType(user, /Register/);
    expect(screen.getByLabelText("Code *")).toBeInTheDocument();
  });

  it("keeps showing the code of an existing assignment team that has one", async () => {
    teams = [
      {
        id: 5,
        name: "Legacy Team",
        code: "LEG",
        description: null,
        team_type: "ASSIGNMENT",
        register_template: "STANDARD",
        status: "ACTIVE",
      },
    ];
    const user = userEvent.setup();
    render(<RiskTeamsPage />);
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    expect(await screen.findByLabelText("Code")).toHaveValue("LEG");
  });
});
