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
// under vitest's ESM loader. The editor is a plain textarea, so Quill stays out
// of jsdom.
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
vi.mock("./TilRichTextField", () => ({
  default: ({ value, onChange }: { value: string; onChange: (html: string) => void }) => (
    <textarea aria-label="What did you learn?" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

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

const NEW_TITLE = "Telnet isn't an HTTPS test";
const TITLE_PLACEHOLDER = "e.g. API latency and connection pooling";

/** Fills in a new entry: a title, the Internal source and what was learned. */
function fillNewEntry() {
  fireEvent.change(screen.getByPlaceholderText(TITLE_PLACEHOLDER), { target: { value: NEW_TITLE } });
  fireEvent.mouseDown(screen.getByRole("combobox"));
  fireEvent.click(screen.getByRole("option", { name: "Internal" }));
  fireEvent.change(screen.getByLabelText("What did you learn?"), { target: { value: ENTRY.what } });
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

  it("explains a share that failed on the network under the editor, as an alert", () => {
    mocks.create.error = new TypeError("Failed to fetch");
    render(<SubmitEntryDialog open onClose={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/so this may not have been shared/);
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
  });

  it("shows no toast when sharing a new entry fails on the network", () => {
    mocks.create.mutate.mockImplementation((_vars, options: { onError: (err: Error) => void }) =>
      options.onError(new TypeError("Failed to fetch")),
    );
    render(<SubmitEntryDialog open onClose={vi.fn()} />);
    fillNewEntry();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(mocks.create.mutate).toHaveBeenCalledOnce();
    expect(mocks.showError).not.toHaveBeenCalled();
  });

  it("keeps a new entry's draft through a close after sharing it failed on the network", () => {
    mocks.create.error = new TypeError("Failed to fetch");
    const { rerender } = render(<SubmitEntryDialog open onClose={vi.fn()} />);
    fillNewEntry();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocks.create.reset).toHaveBeenCalledOnce();
    mocks.create.error = null;
    rerender(<SubmitEntryDialog open={false} onClose={vi.fn()} />);
    rerender(<SubmitEntryDialog open onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText(TITLE_PLACEHOLDER)).toHaveValue(NEW_TITLE);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("still clears a new entry's draft on any other close", () => {
    const { rerender } = render(<SubmitEntryDialog open onClose={vi.fn()} />);
    fillNewEntry();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    rerender(<SubmitEntryDialog open={false} onClose={vi.fn()} />);
    rerender(<SubmitEntryDialog open onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText(TITLE_PLACEHOLDER)).toHaveValue("");
  });

  it("explains an edit that failed on the network under the editor, as an alert", () => {
    mocks.update.error = new TypeError("Failed to fetch");
    render(<SubmitEntryDialog open onClose={vi.fn()} entry={ENTRY} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/so this may not have been saved\. Saving it again is safe\./);
  });

  it("shows no toast for a save that never reached the server", () => {
    saveFailingWith(new TypeError("Failed to fetch"));
    expect(mocks.update.mutate).toHaveBeenCalledOnce();
    expect(mocks.showError).not.toHaveBeenCalled();
  });

  it("still toasts the server's own message for any other failure", () => {
    saveFailingWith(new HttpError("/x", 400, JSON.stringify({ message: "Title is required." })));
    expect(mocks.showError).toHaveBeenCalledWith("Title is required.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
