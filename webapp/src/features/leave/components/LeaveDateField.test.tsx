/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import LeaveDateField from "./LeaveDateField";

function show(props: Partial<Parameters<typeof LeaveDateField>[0]> = {}) {
  const onChange = vi.fn();
  render(<LeaveDateField label="Last sabbatical" value="" onChange={onChange} {...props} />);
  return onChange;
}

describe("the year list", () => {
  // The browser's own picker listed every year and only greyed out the ones
  // outside the bounds. This one lists only the years that can be picked.
  it("offers only the years between min and max", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    show({ min: "2024-09-01", max: "2026-10-14" });
    await user.click(screen.getByRole("button", { name: /choose date/i }));
    await user.click(await screen.findByRole("button", { name: /switch to year view/i }));
    const years = within(await screen.findByRole("radiogroup")).getAllByRole("radio");
    expect(years.map((y) => y.textContent)).toEqual(["2024", "2025", "2026"]);
  });
});

describe("the calendar popup", () => {
  // Several date fields sit side by side, so the open calendar has to say
  // which one it belongs to.
  it("is named after its field", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    show();
    await user.click(screen.getByRole("button", { name: /choose date/i }));
    expect(await screen.findByRole("dialog", { name: "Last sabbatical calendar" })).toBeInTheDocument();
  });
});

/** A caller that holds the value, as every leave form does. */
function Form({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <LeaveDateField label="Start" value={value} min="2024-09-01" max="2026-10-14" onChange={setValue} />
      <output aria-label="held">{value}</output>
    </>
  );
}

describe("an out-of-range date typed into a form", () => {
  // Handing MUI back the "" the form now holds used to wipe the typed date and
  // its error, so the date just vanished.
  it("stays on screen, marked invalid, while the form holds no date", () => {
    render(<Form initial="2025-03-04" />);
    const field = screen.getByLabelText("Start");
    fireEvent.change(field, { target: { value: "2020-01-01" } });
    expect(screen.getByLabelText("held")).toHaveTextContent(/^$/);
    expect(field).toHaveValue("2020-01-01");
    expect(document.querySelector('[aria-invalid="true"]')).not.toBeNull();
  });

  it("gives way to the next allowed date", () => {
    render(<Form initial="2025-03-04" />);
    const field = screen.getByLabelText("Start");
    fireEvent.change(field, { target: { value: "2020-01-01" } });
    fireEvent.change(field, { target: { value: "2025-06-01" } });
    expect(screen.getByLabelText("held")).toHaveTextContent("2025-06-01");
    expect(field).toHaveValue("2025-06-01");
    expect(document.querySelector('[aria-invalid="true"]')).toBeNull();
  });
});

/** A From/To pair whose To can't be earlier than From, like the report toolbars. */
function Range() {
  const [from, setFrom] = useState("2026-06-01");
  const [to, setTo] = useState("2026-10-15");
  return (
    <>
      <LeaveDateField label="From" value={from} onChange={setFrom} />
      <LeaveDateField label="To" value={to} min={from} onChange={setTo} />
      <output aria-label="held to">{to}</output>
    </>
  );
}

describe("a red date whose bounds move to allow it", () => {
  // Typed To before From, then moved From earlier: the To date is now allowed
  // and shown without error, so the form must hold it too.
  it("is handed to the form once it is allowed", () => {
    render(<Range />);
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-03-01" } });
    expect(screen.getByLabelText("held to")).toHaveTextContent(/^$/);
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-02-01" } });
    expect(screen.getByLabelText("held to")).toHaveTextContent("2026-03-01");
    expect(document.querySelector('[aria-invalid="true"]')).toBeNull();
  });
});

describe("a value that is not a real date", () => {
  // new Date(2025, 1, 31) is 3 March; the field must not show a different day.
  it("shows as empty rather than rolling over", () => {
    show({ value: "2025-02-31" });
    expect(screen.getByLabelText("Last sabbatical")).toHaveValue("");
  });

  it("still shows a real date", () => {
    show({ value: "2024-02-29" });
    expect(screen.getByLabelText("Last sabbatical")).toHaveValue("2024-02-29");
  });
});

describe("a typed date", () => {
  it("comes back as YYYY-MM-DD", () => {
    const onChange = show({ min: "2024-09-01", max: "2026-10-14" });
    fireEvent.change(screen.getByLabelText("Last sabbatical"), { target: { value: "2025-03-04" } });
    expect(onChange).toHaveBeenLastCalledWith("2025-03-04");
  });

  // A native input let a typed date straight past min and max.
  it("before min is no date at all", () => {
    const onChange = show({ min: "2024-09-01", max: "2026-10-14" });
    fireEvent.change(screen.getByLabelText("Last sabbatical"), { target: { value: "2020-01-01" } });
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("after max is no date at all", () => {
    const onChange = show({ min: "2024-09-01", max: "2026-10-14" });
    fireEvent.change(screen.getByLabelText("Last sabbatical"), { target: { value: "2027-01-01" } });
    expect(onChange).toHaveBeenLastCalledWith("");
  });
});

describe("Leave's own forms", () => {
  // PAR's settings (a label inside the border, a reason for a refused date)
  // are opt-in: a leave form keeps its label above the field and its own messages.
  it("keep the label above the field and give no reason of their own", () => {
    const { container } = render(<Form initial="2025-03-04" />);
    expect(container.querySelector("label")).toBeNull();
    expect(screen.getByText("Start")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Start"), { target: { value: "2020-01-01" } });
    expect(screen.queryByText(/Must be on or/)).not.toBeInTheDocument();
  });
});
