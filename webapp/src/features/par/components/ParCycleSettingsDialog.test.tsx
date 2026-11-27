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

import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ParCycle } from "../api/types";

const mutate = vi.fn();
const resolved = { showsPar2: false, isLoading: false, error: null, retry: vi.fn(), retrying: false };
let forms: Record<string, unknown> = resolved;

vi.mock("../api/useReview360", () => ({
  useParShowsPar2: () => forms,
}));
vi.mock("../api/useParMutations", () => ({
  useUpdateParCycle: () => ({ mutate, isPending: false, isError: false, error: null }),
}));
vi.mock("../api/useParAdmin", () => ({
  useParDepartments: () => ({ data: ["PARTNER OPS", "FIELD OPS", "FIELD OPS ENGINEERING"], isLoading: false, isError: false }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));
// A plain field, so a test can type a date.
vi.mock("./ParDateField", () => ({
  default: ({
    ariaLabel,
    value,
    onChange,
    helperText,
  }: {
    ariaLabel: string;
    value: string;
    onChange: (v: string) => void;
    helperText?: string;
  }) => (
    <>
      <input aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
      {helperText && <span>{helperText}</span>}
    </>
  ),
}));

const { default: ParCycleSettingsDialog } = await import("./ParCycleSettingsDialog");

const cycle = {
  parCycleId: 7,
  parCycleName: "2027 H1",
  parCycleStartDate: "2027-01-01",
  parCycleEndDate: "2027-08-31",
  parEvaluationStartDate: "2027-06-01",
  parEvaluationEndDate: "2027-07-31",
  parEmployeeDeadline: "2027-07-05",
  parThreeSixtyRatingDeadline: "2027-07-10",
  parLeadDeadline: "2027-07-15",
  parLeadHardDeadline: "2027-07-18",
  parSpecialRatingDeadline: "2027-07-20",
  parF2FDeadline: "2027-07-25",
  parCycleConfigurations: {
    employeeParQuestion: "What went well?",
    threeSixtyReviewQuestion: "What could be better?",
    parRatings: [],
    threeSixtyReviewRatings: [],
  },
  parCycleStatus: "OPEN",
} as ParCycle;

const originalConfig = window.config;
const setPar2 = (on: boolean) => {
  window.config = { ...(originalConfig ?? {}), ONE_WSO2_PREVIEW_FEATURES: { par2: on } } as Window["config"];
};

afterEach(() => {
  window.config = originalConfig;
  forms = resolved;
  mutate.mockReset();
});

function moveF2FDeadlineAndSave() {
  fireEvent.change(screen.getByLabelText("PAR F2F deadline"), { target: { value: "2027-07-28" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  fireEvent.click(
    within(screen.getByRole("dialog", { name: "Update PAR Cycle Settings" })).getByRole("button", { name: "Confirm" }),
  );
  return mutate.mock.calls[0][0];
}

describe("ParCycleSettingsDialog", () => {
  it("shows and sends the two questions for a cycle without the PAR 2.0 forms", () => {
    render(<ParCycleSettingsDialog open onClose={vi.fn()} cycle={cycle} />);
    expect(screen.getByRole("textbox", { name: "Employee PAR question" })).toHaveValue("What went well?");

    expect(moveF2FDeadlineAndSave().parCycleConfigurations).toEqual({
      employeeParQuestion: "What went well?",
      threeSixtyReviewQuestion: "What could be better?",
    });
  });

  it("leaves the hard lead deadline out for a cycle without the PAR 2.0 forms", () => {
    render(<ParCycleSettingsDialog open onClose={vi.fn()} cycle={cycle} />);
    expect(screen.queryByLabelText("Hard lead deadline")).not.toBeInTheDocument();
    expect(moveF2FDeadlineAndSave()).not.toHaveProperty("parLeadHardDeadline");
  });

  it("shows and sends the hard lead deadline of a PAR 2.0 cycle, after the lead deadline", () => {
    forms = { ...resolved, showsPar2: true };
    render(<ParCycleSettingsDialog open onClose={vi.fn()} cycle={cycle} />);
    const hardDeadline = screen.getByLabelText("Hard lead deadline");
    expect(hardDeadline).toHaveValue("2027-07-18");

    fireEvent.change(hardDeadline, { target: { value: "2027-07-15" } });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    fireEvent.change(hardDeadline, { target: { value: "2027-07-20" } });
    expect(moveF2FDeadlineAndSave().parLeadHardDeadline).toBe("2027-07-20");
  });

  it("says when the forms lookup fails, offers a retry, and leaves the questions out", () => {
    const retry = vi.fn();
    forms = { ...resolved, error: new Error("Network down"), retry };
    render(<ParCycleSettingsDialog open onClose={vi.fn()} cycle={cycle} />);
    expect(screen.getByText(/Couldn't check whether this cycle uses the PAR 2\.0 forms\./)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Employee PAR question" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalled();

    const payload = moveF2FDeadlineAndSave();
    expect(payload.parF2FDeadline).toBe("2027-07-28");
    expect(payload).not.toHaveProperty("parCycleConfigurations");
  });

  it("keeps Save off while it's not yet known whether the cycle uses the PAR 2.0 forms", () => {
    forms = { ...resolved, isLoading: true };
    render(<ParCycleSettingsDialog open onClose={vi.fn()} cycle={cycle} />);
    fireEvent.change(screen.getByLabelText("PAR F2F deadline"), { target: { value: "2027-07-28" } });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("changes the departments while the cycle runs, with par2 on", () => {
    setPar2(true);
    forms = { ...resolved, showsPar2: true };
    const ownDeadlineCycle = {
      ...cycle,
      parCycleConfigurations: {
        ...cycle.parCycleConfigurations,
        evidenceEnabledRating: "Needs Improvements",
        evidenceExemptDepartments: ["FIELD OPS", "PARTNER OPS"],
        departmentEmployeeDeadlines: [{ department: "FIELD OPS", deadline: "2027-07-08" }],
      },
    } as ParCycle;
    render(<ParCycleSettingsDialog open onClose={vi.fn()} cycle={ownDeadlineCycle} />);
    expect(screen.getByLabelText("Self-review deadline 1")).toHaveValue("2027-07-08");

    // Moving the lead deadline before Field Ops' own isn't allowed.
    fireEvent.change(screen.getByLabelText("Deadline for lead's feedback"), { target: { value: "2027-07-07" } });
    expect(screen.getByText("FIELD OPS's self-review deadline must be before the deadline for lead's feedback.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Deadline for lead's feedback"), { target: { value: "2027-07-15" } });

    fireEvent.click(screen.getByRole("button", { name: "Remove self-review deadline 1" }));
    const payload = moveF2FDeadlineAndSave();
    expect(payload.parCycleConfigurations).toEqual({
      evidenceExemptDepartments: ["FIELD OPS", "PARTNER OPS"],
      departmentEmployeeDeadlines: [],
    });
  });
});

describe("ParCycleSettingsDialog: a PAR 2.0 cycle's date order", () => {
  // Saved before the order: the 360° deadline before the self-review deadline.
  const oldCycle = { ...cycle, parEmployeeDeadline: "2027-07-12", parThreeSixtyRatingDeadline: "2027-07-10" } as ParCycle;
  const save = () => screen.getByRole("button", { name: "Save" });

  it("doesn't hold up a save that changes no date", () => {
    forms = { ...resolved, showsPar2: true };
    setPar2(true);
    render(<ParCycleSettingsDialog open onClose={vi.fn()} cycle={oldCycle} />);
    expect(screen.queryByText(/Must be later than/)).not.toBeInTheDocument();
  });

  it("puts every date in order once one changes", () => {
    forms = { ...resolved, showsPar2: true };
    render(<ParCycleSettingsDialog open onClose={vi.fn()} cycle={oldCycle} />);
    fireEvent.change(screen.getByLabelText("PAR F2F deadline"), { target: { value: "2027-07-28" } });
    expect(screen.getByText("Must be later than the employee PAR deadline")).toBeInTheDocument();
    expect(save()).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Deadline for 360° feedback"), { target: { value: "2027-07-13" } });
    expect(screen.queryByText(/Must be later than/)).not.toBeInTheDocument();
    expect(save()).toBeEnabled();
  });

  it("names the date each one must follow", () => {
    forms = { ...resolved, showsPar2: true };
    render(<ParCycleSettingsDialog open onClose={vi.fn()} cycle={cycle} />);
    fireEvent.change(screen.getByLabelText("PAR F2F deadline"), { target: { value: "2027-07-18" } });
    expect(screen.getByText("Must be later than the hard lead deadline")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("PAR F2F deadline"), { target: { value: "2027-07-31" } });
    expect(screen.getByText("Must be later than the PAR F2F deadline")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("PAR F2F deadline"), { target: { value: "2027-07-25" } });
    fireEvent.change(screen.getByLabelText("PAR cycle end date"), { target: { value: "2027-07-31" } });
    expect(screen.getByText("Must be later than the PAR evaluation closing date")).toBeInTheDocument();
  });

  it("keeps a PAR 1.0 cycle to today's checks", () => {
    render(<ParCycleSettingsDialog open onClose={vi.fn()} cycle={oldCycle} />);
    fireEvent.change(screen.getByLabelText("PAR F2F deadline"), { target: { value: "2027-07-28" } });
    expect(screen.queryByText(/Must be later than/)).not.toBeInTheDocument();
  });
});

describe("ParCycleSettingsDialog: the Top 5%/20% deadline", () => {
  it("isn't shown for a PAR 2.0 cycle, and is sent as the lead deadline", () => {
    forms = { ...resolved, showsPar2: true };
    render(<ParCycleSettingsDialog open onClose={vi.fn()} cycle={cycle} />);
    expect(screen.queryByLabelText("Top 5%/20% rating submission")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Deadline for lead's feedback"), { target: { value: "2027-07-14" } });
    expect(moveF2FDeadlineAndSave().parSpecialRatingDeadline).toBe("2027-07-14");
  });

  it("stays for a PAR 1.0 cycle", () => {
    render(<ParCycleSettingsDialog open onClose={vi.fn()} cycle={cycle} />);
    expect(screen.getByLabelText("Top 5%/20% rating submission")).toBeInTheDocument();
  });
});
