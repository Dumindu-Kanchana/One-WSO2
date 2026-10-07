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
import MeddpiccCircles from "./MeddpiccCircles";
import type { CoverageLevel, DealLetterState, LetterKey } from "../types";

const coverage: Record<LetterKey, CoverageLevel> = { M: 2, E: 0, DC: 1, DP: 2, P: 0, I: 1, CH: 2, CO: 0 };
const dealState: Record<LetterKey, DealLetterState> = {
  M: "FILLED",
  E: "EMPTY",
  DC: "SUGGESTED",
  DP: "FILLED",
  P: "EMPTY",
  I: "FILLED",
  CH: "SUGGESTED",
  CO: "EMPTY",
};

describe("MeddpiccCircles", () => {
  it("draws the eight letters in MEDDPICC order, the two Ds and two Cs told apart by label", () => {
    render(<MeddpiccCircles variant="coverage" values={coverage} />);
    const group = screen.getByRole("group", { name: "MEDDPICC coverage" });
    expect(group.textContent).toBe("MEDDPICC");
    const labels = within(group)
      .getAllByRole("img")
      .map((el) => el.getAttribute("aria-label"));
    expect(labels).toEqual([
      "Metrics: answered",
      "Economic Buyer: not discussed",
      "Decision Criteria: mentioned",
      "Decision Process: answered",
      "Paper Process: not discussed",
      "Identify Pain: mentioned",
      "Champion: answered",
      "Competition: not discussed",
    ]);
  });

  it("says a call that hasn't been analysed is exactly that, not 'not discussed'", () => {
    render(<MeddpiccCircles variant="coverage" values={null} />);
    for (const circle of screen.getAllByRole("img")) {
      expect(circle).toHaveAccessibleName(/: not analysed yet$/);
    }
  });

  it("reads deal state as empty, AI-suggested or filled, and marks a suggestion with a sparkle", () => {
    const { container } = render(<MeddpiccCircles variant="dealState" values={dealState} />);
    expect(screen.getByRole("group", { name: "MEDDPICC deal state" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Metrics: filled in Salesforce" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Economic Buyer: empty" })).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Champion: AI suggestion waiting for approval" }),
    ).toBeInTheDocument();
    // One sparkle per suggested letter (DC and CH): shape, not only colour.
    expect(container.querySelectorAll("svg")).toHaveLength(2);
  });

  it("becomes buttons when clickable, reports the letter, and marks the selected one", async () => {
    const onLetterClick = vi.fn();
    render(
      <MeddpiccCircles variant="dealState" values={dealState} onLetterClick={onLetterClick} selected="CH" />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(8);
    expect(screen.getByRole("button", { name: /^Champion:/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^Competition:/ })).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(screen.getByRole("button", { name: /^Economic Buyer:/ }));
    expect(onLetterClick).toHaveBeenCalledWith("E");
  });

  it("is reachable by keyboard", async () => {
    const onLetterClick = vi.fn();
    render(<MeddpiccCircles variant="coverage" values={coverage} onLetterClick={onLetterClick} />);
    await userEvent.tab();
    expect(screen.getByRole("button", { name: /^Metrics:/ })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onLetterClick).toHaveBeenCalledWith("M");
  });

  it("does not let a circle's click reach the row it sits in", async () => {
    const onRow = vi.fn();
    render(
      <div onClick={onRow}>
        <MeddpiccCircles variant="coverage" values={coverage} onLetterClick={() => {}} />
      </div>,
    );
    await userEvent.click(screen.getByRole("button", { name: /^Paper Process:/ }));
    expect(onRow).not.toHaveBeenCalled();
  });

  it("shows up to two quotes for a letter on hover", async () => {
    const quote = (text: string) => ({
      meetingId: 1,
      meetingTitle: "Call",
      callStart: "2026-09-10T10:00:00Z",
      speaker: "Priya",
      quote: text,
      offsetSeconds: 75,
    });
    render(
      <MeddpiccCircles
        variant="coverage"
        values={coverage}
        quotes={{ CH: [quote("first"), quote("second"), quote("third")] }}
      />,
    );
    await userEvent.hover(screen.getByRole("img", { name: /^Champion:/ }));
    expect(await screen.findByText(/“first” — Priya, 1:15/)).toBeInTheDocument();
    expect(screen.getByText(/“second”/)).toBeInTheDocument();
    expect(screen.queryByText(/“third”/)).not.toBeInTheDocument();
    // The open tooltip describes the circle; it does not rename it.
    expect(screen.getByRole("img", { name: "Champion: answered" })).toBeInTheDocument();
  });
});
