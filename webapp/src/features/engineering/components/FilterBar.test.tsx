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
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Grid, MenuItem, Select } from "@wso2/oxygen-ui";
import type { StatsFilters } from "../utils/filters";
import FilterBar, { type FilterUpdate } from "./FilterBar";

vi.mock("@asgardeo/react", () => ({
  useAsgardeo: () => ({
    isSignedIn: true,
    isLoading: false,
    getAccessToken: async () => "test-token",
    signIn: vi.fn(),
  }),
}));

const originalConfig = window.config;

const repositories = [
  { id: 1, orgName: "wso2", repoName: "product-apim", productName: "API Manager", isActive: true },
  { id: 2, orgName: "wso2", repoName: "product-is", productName: "Identity Server", isActive: true },
  { id: 3, orgName: "wso2", repoName: "apk", productName: null, isActive: true },
  { id: 4, orgName: "wso2", repoName: "retired", productName: "Retired Product", isActive: false },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const filters: StatsFilters = { from: "2026-09-07", to: "2026-10-07", repos: [], interval: "day" };

function renderBar(
  props: Partial<React.ComponentProps<typeof FilterBar>> = {},
): { onChange: ReturnType<typeof vi.fn<(updates: FilterUpdate) => void>> } {
  const onChange = vi.fn<(updates: FilterUpdate) => void>();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <FilterBar filters={filters} onChange={onChange} {...props} />
    </QueryClientProvider>,
  );
  return { onChange };
}

beforeEach(() => {
  window.config = {
    ...(window.config ?? {}),
    ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL: "https://stats.example",
  } as Window["config"];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.startsWith("https://stats.example/api/v1/repositories")) {
        return jsonResponse({ count: repositories.length, repositories });
      }
      return jsonResponse({}, 404);
    }),
  );
});

afterEach(() => {
  window.config = originalConfig;
  vi.unstubAllGlobals();
});

describe("FilterBar's product picker", () => {
  it("is labelled Repositories, offers every active Product and means all of them when empty", async () => {
    const user = userEvent.setup();
    renderBar();
    const picker = screen.getByRole("combobox", { name: "Repositories" });
    expect(picker).toHaveAttribute("placeholder", "All repositories");

    await user.click(picker);
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "API Manager",
      "Identity Server",
      "apk",
    ]);
    expect(within(listbox).queryByText("Retired Product")).not.toBeInTheDocument();
  });

  it("finds a Product by typing", async () => {
    const user = userEvent.setup();
    renderBar();
    const picker = screen.getByRole("combobox", { name: "Repositories" });
    await user.type(picker, "ident");
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option").map((o) => o.textContent)).toEqual(["Identity Server"]);
  });

  it("reports the chosen ids and shows the choice as removable chips", async () => {
    const user = userEvent.setup();
    const { onChange } = renderBar({ filters: { ...filters, repos: [1] } });
    await waitFor(() => expect(screen.getByRole("button", { name: "API Manager" })).toBeInTheDocument());
    const picker = screen.getByRole("combobox", { name: "Repositories" });
    expect(picker).toHaveAttribute("placeholder", "");

    await user.click(picker);
    await user.click(await screen.findByRole("option", { name: "Identity Server" }));
    expect(onChange).toHaveBeenLastCalledWith({ repos: [1, 2] });

    // The chip's delete icon removes that Product alone.
    const chip = screen.getByRole("button", { name: "API Manager" });
    await user.click(within(chip).getByTestId("CancelIcon"));
    expect(onChange).toHaveBeenLastCalledWith({ repos: [] });
  });
});

describe("FilterBar's folding row", () => {
  it("opens with From and To and folds them away behind Filters", async () => {
    const user = userEvent.setup();
    renderBar({
      filterSlot: (
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <Select size="small" value="day" inputProps={{ "aria-label": "View" }}>
            <MenuItem value="day">Daily</MenuItem>
          </Select>
        </Grid>
      ),
    });
    expect(screen.getByLabelText("From")).toHaveValue("2026-09-07");
    expect(screen.getByLabelText("To")).toHaveValue("2026-10-07");
    expect(screen.getByRole("combobox", { name: "View" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.queryByLabelText("From")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("To")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "View" })).not.toBeInTheDocument();
    // The picker stays where it is.
    expect(screen.getByRole("combobox", { name: "Repositories" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByLabelText("From")).toHaveValue("2026-09-07");
    expect(screen.getByRole("combobox", { name: "View" })).toBeInTheDocument();
  });

  it("reports a changed From or To", () => {
    const { onChange } = renderBar();
    // A date input takes a whole value from its picker, not keystrokes.
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-01-01" } });
    expect(onChange).toHaveBeenLastCalledWith({ from: "2026-01-01" });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-03-31" } });
    expect(onChange).toHaveBeenLastCalledWith({ to: "2026-03-31" });
  });

  it("lets a screen put its own always-visible controls where the picker goes", () => {
    renderBar({
      pickerSlot: (
        <Select size="small" value={1} inputProps={{ "aria-label": "Product" }}>
          <MenuItem value={1}>API Manager</MenuItem>
        </Select>
      ),
    });
    expect(screen.getByRole("combobox", { name: "Product" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Repositories" })).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByLabelText("From")).toBeInTheDocument();
  });
});
