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

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import TableHeaderSearch from "./TableHeaderSearch";

// A header whose search value is held the way a table holds it.
function Header({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <TableHeaderSearch title="Version" noun="version" value={value} onChange={setValue} />
      <output data-testid="value">{value}</output>
    </>
  );
}

describe("TableHeaderSearch", () => {
  it("shows the title with a magnifier, and no field, until the magnifier is clicked", async () => {
    const user = userEvent.setup();
    render(<Header />);

    expect(screen.getByText("Version")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filter by version" }));

    const field = screen.getByRole("textbox", { name: "Filter versions" });
    expect(field).toHaveAttribute("placeholder", "Filter…");
    expect(field).toHaveFocus();
    expect(screen.getByRole("button", { name: "Clear version filter" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Filter by version" })).not.toBeInTheDocument();
  });

  it("reports what is typed and clears and closes from the clear button", async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.click(screen.getByRole("button", { name: "Filter by version" }));
    await user.type(screen.getByRole("textbox", { name: "Filter versions" }), "4.5");
    expect(screen.getByTestId("value")).toHaveTextContent("4.5");

    await user.click(screen.getByRole("button", { name: "Clear version filter" }));

    expect(screen.getByTestId("value")).toHaveTextContent("");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filter by version" })).toBeInTheDocument();
  });

  it("clears and closes on Escape", async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.click(screen.getByRole("button", { name: "Filter by version" }));
    await user.type(screen.getByRole("textbox", { name: "Filter versions" }), "4.5");
    await user.keyboard("{Escape}");

    expect(screen.getByTestId("value")).toHaveTextContent("");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows the field whenever it holds a value, so a redrawn table never filters behind a closed one", () => {
    render(<Header initial="4.5" />);
    expect(screen.getByRole("textbox", { name: "Filter versions" })).toHaveValue("4.5");
    expect(screen.getByRole("button", { name: "Clear version filter" })).toBeInTheDocument();
  });

  it("is not a login field for a password manager", async () => {
    const user = userEvent.setup();
    render(<Header />);
    await user.click(screen.getByRole("button", { name: "Filter by version" }));
    const field = screen.getByRole("textbox", { name: "Filter versions" });
    expect(field).toHaveAttribute("autocomplete", "off");
    expect(field).toHaveAttribute("data-1p-ignore", "true");
  });
});
