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
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import IntervalSelect from "./IntervalSelect";

describe("IntervalSelect", () => {
  it("is named by its label and shows the current Interval's word", () => {
    render(<IntervalSelect label="Interval" value="month" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "Interval" })).toHaveTextContent("Monthly");
  });

  it("takes the Downloads screen's label, View", () => {
    render(<IntervalSelect label="View" value="day" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "View" })).toHaveTextContent("Daily");
  });

  it("offers Daily, Monthly and Cumulative in that order and reports the chosen Interval", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<IntervalSelect label="Interval" value="day" onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Interval" }));
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Daily",
      "Monthly",
      "Cumulative",
    ]);

    await user.click(within(listbox).getByRole("option", { name: "Cumulative" }));
    expect(onChange).toHaveBeenCalledWith("cumulative");
  });
});
