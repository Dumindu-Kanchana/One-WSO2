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
import RequestCustomerDialog from "./RequestCustomerDialog";

const authFetch = vi.fn();
vi.mock("@features/security/grc/shim/useAuthApiClient", () => ({
  useAuthApiClient: () => authFetch,
}));
vi.mock("@features/security/grc/shim/apiConfig", () => ({ BACKEND_BASE_URL: "http://backend.test" }));

const posts = () =>
  authFetch.mock.calls.map(([url, init]) => ({
    url: String(url),
    method: init?.method,
    body: init?.body ? JSON.parse(String(init.body)) : null,
  }));

beforeEach(() => {
  authFetch.mockReset();
  authFetch.mockResolvedValue(new Response(JSON.stringify({ message: "ok" }), { status: 202 }));
});

describe("RequestCustomerDialog", () => {
  it("sends the request and confirms, with the optional fields trimmed or left out", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<RequestCustomerDialog open onClose={onClose} />);
    await user.type(screen.getByLabelText(/Customer name/), "  Acme Corp ");
    await user.type(screen.getByLabelText("Suggested code"), "acme");
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByText(/request has been sent to the platform admins/i)).toBeInTheDocument();
    expect(posts()).toEqual([
      {
        url: "http://backend.test/api/v1/risks/customer-requests",
        method: "POST",
        body: { customer_name: "Acme Corp", suggested_code: "ACME" },
      },
    ]);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("includes the note when given", async () => {
    const user = userEvent.setup();
    render(<RequestCustomerDialog open onClose={() => {}} />);
    await user.type(screen.getByLabelText(/Customer name/), "Acme");
    await user.type(screen.getByLabelText("Note"), "new contract");
    await user.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].body).toEqual({ customer_name: "Acme", note: "new contract" });
  });

  it("needs a customer name and a well-formed code before it sends anything", async () => {
    const user = userEvent.setup();
    render(<RequestCustomerDialog open onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByText("Customer name is required.")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Customer name/), "Acme");
    await user.type(screen.getByLabelText("Suggested code"), "AC-ME");
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByText(/1–12 capital letters or digits/)).toBeInTheDocument();
    expect(posts()).toHaveLength(0);
  });

  it("shows the backend's reason when the request is refused, and stays open to retry", async () => {
    authFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ message: "only someone who can raise Managed Services risks can request a customer" }),
        {
          status: 403,
        },
      ),
    );
    const user = userEvent.setup();
    render(<RequestCustomerDialog open onClose={() => {}} />);
    await user.type(screen.getByLabelText(/Customer name/), "Acme");
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByText(/only someone who can raise Managed Services risks/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send request" })).toBeEnabled();
  });
});
