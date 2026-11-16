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
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import ParDateField from "./ParDateField";

/** A caller that holds the value, as every PAR form does. */
function Held({ min }: { min?: string }) {
  const [value, setValue] = useState("");
  return (
    <>
      <ParDateField value={value} onChange={setValue} min={min} ariaLabel="date" />
      <output aria-label="held">{value}</output>
    </>
  );
}

// A typed date can fall outside min/max, and neither ParF2fTab nor
// ParScheduleF2fDialog's backend re-validates the range. ParDateField is the
// one shared place that has to refuse it: the caller is told there is no date,
// never handed the out-of-range one.
describe("ParDateField", () => {
  it("rejects a typed date before min", () => {
    const onChange = vi.fn();
    render(<ParDateField value="" onChange={onChange} min="2026-01-10" ariaLabel="date" />);
    fireEvent.change(screen.getByLabelText("date"), { target: { value: "2026-01-01" } });
    expect(onChange).not.toHaveBeenCalledWith("2026-01-01");
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("rejects a typed date after max", () => {
    const onChange = vi.fn();
    render(<ParDateField value="" onChange={onChange} max="2026-01-10" ariaLabel="date" />);
    fireEvent.change(screen.getByLabelText("date"), { target: { value: "2026-01-20" } });
    expect(onChange).not.toHaveBeenCalledWith("2026-01-20");
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("accepts a date within bounds", () => {
    const onChange = vi.fn();
    render(<ParDateField value="" onChange={onChange} min="2026-01-01" max="2026-01-31" ariaLabel="date" />);
    fireEvent.change(screen.getByLabelText("date"), { target: { value: "2026-01-15" } });
    expect(onChange).toHaveBeenCalledWith("2026-01-15");
  });

  it("accepts clearing the field even with bounds set", () => {
    const onChange = vi.fn();
    render(<ParDateField value="2026-01-15" onChange={onChange} min="2026-01-01" max="2026-01-31" ariaLabel="date" />);
    fireEvent.change(screen.getByLabelText("date"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("shows why a too-early date was rejected instead of silently reverting", () => {
    const onChange = vi.fn();
    render(<ParDateField value="" onChange={onChange} min="2026-01-10" ariaLabel="date" />);
    fireEvent.change(screen.getByLabelText("date"), { target: { value: "2026-01-01" } });
    expect(screen.getByText("Must be on or after 2026-01-10")).toBeInTheDocument();
  });

  it("shows why a too-late date was rejected instead of silently reverting", () => {
    const onChange = vi.fn();
    render(<ParDateField value="" onChange={onChange} max="2026-01-10" ariaLabel="date" />);
    fireEvent.change(screen.getByLabelText("date"), { target: { value: "2026-01-20" } });
    expect(screen.getByText("Must be on or before 2026-01-10")).toBeInTheDocument();
  });

  it("clears the rejection message once a valid date is accepted", () => {
    render(<Held min="2026-01-10" />);
    fireEvent.change(screen.getByLabelText("date"), { target: { value: "2026-01-01" } });
    expect(screen.getByText("Must be on or after 2026-01-10")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("date"), { target: { value: "2026-01-15" } });
    expect(screen.queryByText("Must be on or after 2026-01-10")).not.toBeInTheDocument();
    expect(screen.getByLabelText("held")).toHaveTextContent("2026-01-15");
  });

  // The same calendar as Leave, not the browser's own.
  it("opens the calendar picker, named after the field", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<ParDateField value="" onChange={vi.fn()} label="Cycle starts" ariaLabel="PAR cycle start date" />);
    await user.click(screen.getByRole("button", { name: /choose date/i }));
    // Named by the field's visible label.
    expect(await screen.findByRole("dialog", { name: "Cycle starts" })).toBeInTheDocument();
  });

  it("keeps the label inside the field's border, like the other fields in its form", () => {
    const { container } = render(
      <ParDateField value="" onChange={vi.fn()} label="Cycle starts" ariaLabel="PAR cycle start date" />,
    );
    expect(container.querySelector("label")).toHaveTextContent("Cycle starts");
    expect(screen.getByLabelText("PAR cycle start date")).toBeInTheDocument();
  });

  it("shows no label when the screen labels the field itself", () => {
    const { container } = render(<ParDateField value="" onChange={vi.fn()} ariaLabel="F2F completed date" />);
    expect(screen.getByLabelText("F2F completed date")).toBeInTheDocument();
    expect(container.querySelector("label")).toBeNull();
    expect(container).not.toHaveTextContent("F2F completed date");
  });
});
