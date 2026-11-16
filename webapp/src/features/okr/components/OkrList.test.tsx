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
import { okrsForCycle } from "@features/par/util/okr";
import { testKeyResult, testOkr } from "../testing/fixtures";
import OkrList from "./OkrList";

const ME = "a@example.com";

describe("OkrList", () => {
  it("shows what's the person's: their objective's status, and their key results, not their team's", async () => {
    const onCite = vi.fn();
    const mine = testOkr({
      keyResults: [
        testKeyResult({ keyResultId: 1, ownerEmail: "team@example.com", title: "Pages a week down by 40%" }),
      ],
    });
    const theirs = testOkr({
      okrId: 2,
      ownerEmail: "lead@example.com",
      ownerName: "Lee Lead",
      objective: "Improve reliability",
      keyResults: [testKeyResult({ keyResultId: 2, title: "Repeat P1s down to 6 a quarter" })],
    });
    render(<OkrList okrs={okrsForCycle([mine, theirs], ME, "2026-12-22")} personEmail={ME} onCite={onCite} />);

    expect(screen.getByText("Grow enterprise retention")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.queryByText("Pages a week down by 40%")).not.toBeInTheDocument();
    expect(screen.getByText("Lee Lead's objective")).toBeInTheDocument();
    expect(screen.getByText("Repeat P1s down to 6 a quarter")).toBeInTheDocument();

    const item = (objective: string) => within(screen.getByText(objective).closest("li")!);
    await userEvent.click(item("Grow enterprise retention").getByRole("button", { name: "Add to Impact" }));
    expect(onCite).toHaveBeenLastCalledWith(expect.objectContaining({ okrId: 1 }));
    await userEvent.click(item("Improve reliability").getByRole("button", { name: "Add to Impact" }));
    expect(onCite).toHaveBeenLastCalledWith(
      expect.objectContaining({ okrId: 2 }),
      expect.objectContaining({ keyResultId: 2 }),
    );
  });
});
