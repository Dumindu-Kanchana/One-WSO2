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
import { fireEvent, render, screen } from "@testing-library/react";
import { HttpError } from "@api/http";
import type { TilSubmission } from "../api/tilTypes";

// The data and mutation hooks are replaced with stand-ins the tests control.
// They pull Asgardeo into the module graph, and that package does not resolve
// under vitest's ESM loader. The editor is stubbed so Quill stays out of jsdom.
type MutationStub = { error: Error | null; isPending: boolean; mutate: ReturnType<typeof vi.fn>; reset: () => void };
const mocks = vi.hoisted(() => ({
  showError: vi.fn(),
  create: undefined as unknown as MutationStub,
  update: undefined as unknown as MutationStub,
}));

vi.mock("../api/useTilData", () => ({
  useCustomerSearch: () => ({ data: [], isLoading: false }),
  useTilUserInfo: () => ({
    data: { email: "alex@example.com", displayName: "Alex Sample", canModerate: false },
    isLoading: false,
  }),
  useTilWhatMaxLength: () => ({ max: 5000, known: true, failed: false, retry: vi.fn() }),
}));
vi.mock("../api/useTilMutations", () => ({
  useCreateTilSubmission: () => mocks.create,
  useUpdateTilSubmission: () => mocks.update,
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showError: mocks.showError, showSuccess: vi.fn(), showWarning: vi.fn() }),
}));
vi.mock("./TilRichTextField", () => ({ default: () => null }));

import SubmitEntryDialog from "./SubmitEntryDialog";

const ENTRY: TilSubmission = {
  id: "entry",
  title: "Telnet to port 443 succeeding doesn't mean HTTPS will work",
  who: "Alex Sample",
  where: "Internal",
  whereDetail: null,
  what: "<p>curl -skv https://allowed.example.com -o /dev/null</p>",
  submittedByEmail: "alex@example.com",
  createdAt: new Date("2026-10-04T15:34:13Z"),
  updatedAt: null,
  notifiedAt: null,
};

function stubMutation(): MutationStub {
  return { error: null, isPending: false, mutate: vi.fn(), reset: vi.fn() };
}

/** Edits the entry's title and saves, with the save failing as `error`. */
function saveFailingWith(error: Error) {
  mocks.update.mutate.mockImplementation((_vars, options: { onError: (err: Error) => void }) => options.onError(error));
  render(<SubmitEntryDialog open onClose={vi.fn()} entry={ENTRY} />);
  fireEvent.change(screen.getByDisplayValue(ENTRY.title), { target: { value: "Telnet isn't an HTTPS test" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
}

describe("SubmitEntryDialog save errors", () => {
  beforeEach(() => {
    mocks.showError.mockReset();
    mocks.create = stubMutation();
    mocks.update = stubMutation();
  });

  it("explains a share that never reached the server under the editor", () => {
    mocks.create.error = new TypeError("Failed to fetch");
    render(<SubmitEntryDialog open onClose={vi.fn()} />);
    expect(screen.getByText(/couldn't reach the server, so it wasn't saved/)).toBeInTheDocument();
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
  });

  it("explains an edit that never reached the server under the editor", () => {
    mocks.update.error = new TypeError("Failed to fetch");
    render(<SubmitEntryDialog open onClose={vi.fn()} entry={ENTRY} />);
    expect(screen.getByText(/couldn't reach the server, so it wasn't saved/)).toBeInTheDocument();
  });

  it("shows no toast for a save that never reached the server", () => {
    saveFailingWith(new TypeError("Failed to fetch"));
    expect(mocks.update.mutate).toHaveBeenCalledOnce();
    expect(mocks.showError).not.toHaveBeenCalled();
  });

  it("still toasts the server's own message for any other failure", () => {
    saveFailingWith(new HttpError("/x", 400, JSON.stringify({ message: "Title is required." })));
    expect(mocks.showError).toHaveBeenCalledWith("Title is required.");
    expect(screen.queryByText(/couldn't reach the server/)).not.toBeInTheDocument();
  });
});
