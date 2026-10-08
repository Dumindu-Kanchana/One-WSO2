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
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { formatDate } from "../utils/format";
import DateHeaderFilter from "./DateHeaderFilter";

let showPicker: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // jsdom has no native picker to open; the hidden input is driven by setting
  // its value, as a person's pick would.
  showPicker = vi.fn();
  HTMLInputElement.prototype.showPicker = showPicker as unknown as () => void;
});

describe("DateHeaderFilter", () => {
  it("opens the browser's picker from the calendar icon and reports the chosen day", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<DateHeaderFilter type="date" value="" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Filter by date" }));
    expect(showPicker).toHaveBeenCalledTimes(1);

    fireEvent.change(container.querySelector('input[type="date"]') as HTMLInputElement, {
      target: { value: "2026-06-28" },
    });
    expect(onChange).toHaveBeenLastCalledWith("2026-06-28");
  });

  it("shows the chosen value as a chip, in the given form, and clears it from the chip", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateHeaderFilter type="date" value="2026-06-28" onChange={onChange} format={formatDate} />);

    const chip = screen.getByRole("button", { name: "28 Jun 2026" });
    expect(screen.getByRole("button", { name: "Change date filter" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Filter by date" })).not.toBeInTheDocument();

    await user.click(within(chip).getByTestId("CancelIcon"));
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("offers a month picker and writes the month as it is when no form is given", () => {
    const { container } = render(<DateHeaderFilter type="month" value="2025-02" onChange={vi.fn()} />);
    expect(container.querySelector('input[type="month"]')).not.toBeNull();
    expect(container.querySelector('input[type="date"]')).toBeNull();
    expect(screen.getByRole("button", { name: "2025-02" })).toBeInTheDocument();
  });
});
