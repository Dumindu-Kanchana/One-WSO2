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
import { act, render, screen } from "@testing-library/react";
import { useRedrawAt } from "./useRedrawAt";

// The clock and the timers, held by hand: each timer the hook sets is run when the test says.
let now = 0;
let timers: { run: () => void; wait: number }[] = [];
beforeEach(() => {
  timers = [];
  vi.spyOn(Date, "now").mockImplementation(() => now);
  vi.spyOn(window, "setTimeout").mockImplementation(((run: () => void, wait: number) => {
    timers.push({ run, wait });
    return timers.length;
  }) as typeof window.setTimeout);
  vi.spyOn(window, "clearTimeout").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

function Opens({ at }: { at: number }) {
  const open = now >= at;
  useRedrawAt(at, !open);
  return <span>{open ? "open" : "waiting"}</span>;
}

const runLast = (until: number) => {
  now = until;
  act(() => timers[timers.length - 1].run());
};

describe("useRedrawAt", () => {
  it("redraws at the time", () => {
    now = 1_000;
    render(<Opens at={61_000} />);
    expect(timers[timers.length - 1].wait).toBe(60_001);
    runLast(61_001);
    expect(screen.getByText("open")).toBeInTheDocument();
  });

  it("waits longer than a browser timer can, in steps", () => {
    const longest = 2 ** 31 - 1;
    const at = 40 * 24 * 60 * 60 * 1000;
    now = 0;
    render(<Opens at={at} />);
    expect(timers[timers.length - 1].wait).toBe(longest);
    runLast(longest);
    expect(screen.getByText("waiting")).toBeInTheDocument();
    expect(timers[timers.length - 1].wait).toBe(at - longest + 1);
    runLast(at + 1);
    expect(screen.getByText("open")).toBeInTheDocument();
  });
});
