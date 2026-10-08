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
import userEvent from "@testing-library/user-event";
import { Table, TableBody, TableCell } from "@wso2/oxygen-ui";
import SelectableRow from "./SelectableRow";

function renderRow(selected: boolean, onActivate = vi.fn()) {
  render(
    <Table>
      <TableBody>
        <SelectableRow selected={selected} onActivate={onActivate}>
          <TableCell>WSO2 API Manager 4.5.0 Released!</TableCell>
          <TableCell>v4.5.0</TableCell>
        </SelectableRow>
      </TableBody>
    </Table>,
  );
  return onActivate;
}

describe("SelectableRow", () => {
  it("is a whole-row button that keeps the name's own case and says whether it is picked", () => {
    renderRow(true);
    const row = screen.getByRole("button", { name: /WSO2 API Manager 4\.5\.0 Released!/ });
    expect(row).toHaveAttribute("aria-pressed", "true");
    expect(row).toHaveClass("Mui-selected");
    expect(screen.getByText("WSO2 API Manager 4.5.0 Released!")).toBeInTheDocument();
  });

  it("is not highlighted while it is not picked", () => {
    renderRow(false);
    const row = screen.getByRole("button");
    expect(row).toHaveAttribute("aria-pressed", "false");
    expect(row).not.toHaveClass("Mui-selected");
  });

  it("activates on a click, on Enter and on Space, and on no other key", async () => {
    const user = userEvent.setup();
    const onActivate = renderRow(false);
    const row = screen.getByRole("button");

    await user.click(row);
    expect(onActivate).toHaveBeenCalledTimes(1);

    row.focus();
    await user.keyboard("{Enter}");
    expect(onActivate).toHaveBeenCalledTimes(2);
    await user.keyboard(" ");
    expect(onActivate).toHaveBeenCalledTimes(3);
    await user.keyboard("{ArrowDown}");
    expect(onActivate).toHaveBeenCalledTimes(3);
  });
});
