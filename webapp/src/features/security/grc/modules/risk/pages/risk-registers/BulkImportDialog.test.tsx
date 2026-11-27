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

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureDownloads } from "@/test/downloads";
import type { BulkImportResult } from "../../api/riskApi";
import BulkImportDialog from "./BulkImportDialog";

// The dialog talks to the backend only through the shim's fetch, so a fake of it
// stands in for the whole backend and records every request.
const authFetch = vi.fn();
vi.mock("@features/security/grc/shim/useAuthApiClient", () => ({ useAuthApiClient: () => authFetch }));
vi.mock("@features/security/grc/shim/apiConfig", () => ({ BACKEND_BASE_URL: "http://backend.test" }));

const registers = [
  { id: 1, name: "Asgardeo", code: "ASG", register_template: "STANDARD" },
  { id: 3, name: "WSO2 Cloud", code: "CLD", register_template: "AGGREGATED" },
  { id: 4, name: "Retired", code: "RET", register_template: "STANDARD", status: "INACTIVE" },
  { id: 5, name: "No code", code: null, register_template: "STANDARD" },
].map((t) => ({ description: null, team_type: "BOTH", status: "ACTIVE", ...t }));

const noProblems = { migrated: 0, skipped: 0, rejects: 0, warnings: 0, mismatches: 0 };

function result(over: Partial<BulkImportResult>): BulkImportResult {
  return {
    mode: "dry_run",
    register_id: 1,
    register_name: "Asgardeo",
    template: "STANDARD",
    file_name: "register.csv",
    file_sha256: "abc",
    outcome: "clean",
    rows: 12,
    counts: { ...noProblems },
    ...over,
  };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const encoder = new TextEncoder();
const line = (o: object) => `${JSON.stringify(o)}\n`;

// A finished run's response: every line, then the end of the stream.
function stream(...events: object[]): Response {
  return new Response(events.map(line).join(""), { status: 200, headers: { "Content-Type": "application/x-ndjson" } });
}

// A run that is still going: the test pushes lines and ends it when it chooses.
function openStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start: (c) => (controller = c) });
  return {
    response: new Response(body, { status: 200, headers: { "Content-Type": "application/x-ndjson" } }),
    push: (o: object) => controller.enqueue(encoder.encode(line(o))),
    end: () => controller.close(),
  };
}

// What the backend answers to a run. A test replaces `next` to hold a run open or
// to refuse it.
let finished: { dry_run: BulkImportResult; import: BulkImportResult };
let next: ((mode: "dry_run" | "import") => Response) | null;

const posts = (): FormData[] =>
  authFetch.mock.calls.filter(([, init]) => init?.method === "POST").map(([, init]) => init.body as FormData);
const requested = (): string[] =>
  authFetch.mock.calls.map(([u]) => String(u).replace("http://backend.test/api/v1", ""));

beforeEach(() => {
  next = null;
  finished = {
    dry_run: result({}),
    import: result({
      mode: "import",
      counts: { ...noProblems, migrated: 12 },
      files: { report: "the report", risk_codes_csv: "Migration ID,Risk Code\n1,2025-ASG-Q1-0001\n" },
    }),
  };
  authFetch.mockReset();
  authFetch.mockImplementation(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input));
    const path = url.pathname.replace("/api/v1", "");
    if (path === "/risks/teams") return json(registers);
    if (path === "/risks/bulk-import/template") {
      return new Response("Year,Quarter\n", {
        status: 200,
        headers: { "Content-Disposition": 'attachment; filename="risk-import-template-asgardeo.csv"' },
      });
    }
    if (path === "/risks/bulk-import" && init?.method === "POST") {
      const mode = (init.body as FormData).get("mode") as "dry_run" | "import";
      if (next) return next(mode);
      return stream({ type: "ping" }, { type: "progress", phase: "write", done: 1, total: 1 }, { type: "result", ...finished[mode] });
    }
    return json({}, 404);
  });
});

// jsdom's Blob has no text(), and its Blob is not the one Node's Response knows.
// The bytes are read raw because decoding as text would swallow a byte order mark.
const readBlob = (blob: Blob) =>
  new Promise<number[]>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve([...new Uint8Array(reader.result as ArrayBuffer)]);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
const bytesOf = (text: string) => [...new TextEncoder().encode(text)];

const csv = (name = "register.csv") => new File(["Year,Quarter\n2025,Q1\n"], name, { type: "text/csv" });

async function renderOpen(onImported = vi.fn()) {
  const user = userEvent.setup();
  const view = render(<BulkImportDialog open onClose={vi.fn()} onImported={onImported} />);
  await screen.findByRole("combobox");
  return { user, onImported, ...view };
}

async function chooseRegister(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("combobox"));
  await user.click(await screen.findByRole("option", { name: new RegExp(name) }));
}

async function chooseFile(user: ReturnType<typeof userEvent.setup>, file = csv()) {
  await user.upload(screen.getByLabelText("CSV file", { selector: "input" }), file);
}

async function runDryRun(user: ReturnType<typeof userEvent.setup>) {
  await chooseRegister(user, "Asgardeo");
  await chooseFile(user);
  await user.click(screen.getByRole("button", { name: "Run dry run" }));
}

describe("Bulk import — setup", () => {
  it("offers the registers that can take risks, with their template", async () => {
    const { user } = await renderOpen();
    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByRole("option", { name: "Asgardeo — Standard" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "WSO2 Cloud — Aggregated (platforms)" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Retired/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /No code/ })).not.toBeInTheDocument();
  });

  it("offers nothing to do until a register and a file are chosen", async () => {
    const { user } = await renderOpen();

    expect(screen.getByRole("button", { name: "Download template" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Run dry run" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Import/ })).toBeDisabled();

    await chooseRegister(user, "Asgardeo");
    expect(screen.getByRole("button", { name: "Download template" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Run dry run" })).toBeDisabled(); // still no file

    await chooseFile(user);
    expect(screen.getByRole("button", { name: "Run dry run" })).toBeEnabled();
    expect(screen.getByRole("button", { name: /^Import/ })).toBeDisabled(); // never before a dry run
  });

  it("downloads the template of the chosen register", async () => {
    const downloads = captureDownloads();
    const { user } = await renderOpen();
    await chooseRegister(user, "WSO2 Cloud");

    await user.click(screen.getByRole("button", { name: "Download template" }));

    await waitFor(() => expect(downloads.filenames).toEqual(["risk-import-template-asgardeo.csv"]));
    expect(requested()).toContain("/risks/bulk-import/template?register_id=3");
  });
});

describe("Bulk import — dry run", () => {
  it("sends the file, register and mode, and shows progress while it runs", async () => {
    const held = openStream();
    next = () => held.response;
    const { user } = await renderOpen();
    await chooseRegister(user, "Asgardeo");
    await chooseFile(user, csv("asgardeo.csv"));

    await user.click(screen.getByRole("button", { name: "Run dry run" }));
    held.push({ type: "progress", phase: "resolve", done: 0, total: 12 });

    expect(await screen.findByText(/Dry run: Looking up people/)).toBeInTheDocument();
    const [form] = posts();
    expect(form.get("register_id")).toBe("1");
    expect(form.get("mode")).toBe("dry_run");
    expect((form.get("file") as File).name).toBe("asgardeo.csv");
    // While it runs the controls that would change the question are locked.
    expect(screen.getByRole("button", { name: "Run dry run" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    held.push({ type: "result", ...finished.dry_run });
    held.end();
    expect(await screen.findByText(/found nothing to reject/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  });

  it("a clean dry run offers the import, and nothing before it", async () => {
    const { user } = await renderOpen();
    await runDryRun(user);

    expect(await screen.findByText(/found nothing to reject/)).toBeInTheDocument();
    expect(screen.getByText("12 rows")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import 12 rows" })).toBeEnabled();
  });

  it("a dry run with a rejected row lists it and cannot be imported", async () => {
    finished.dry_run = result({
      counts: { ...noProblems, rejects: 2, warnings: 1 },
      findings: [
        { migration_id: 4, csv_row: 6, risk_title: "T", severity: "WARN", failure: "Action Steps", detail: "placeholder inserted" },
        { migration_id: 2, csv_row: 3, risk_title: "T2", severity: "REJECT", failure: "Quarter", detail: "not Q1..Q4" },
        { migration_id: 1, csv_row: 2, risk_title: "T1", severity: "REJECT", failure: "Risk Owner", detail: "no active account" },
      ],
      files: { errors_csv: "migration_id,csv_row\n", report: "the report" },
    });
    const { user } = await renderOpen();
    await runDryRun(user);

    expect(await screen.findByText(/cannot be imported while any row is rejected/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Import/ })).toBeDisabled();

    // Rejections come first, then by row.
    const rows = within(screen.getByRole("table", { name: "Findings" })).getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getAllByRole("cell")[2].textContent)).toEqual(["Risk Owner", "Quarter", "Action Steps"]);
    expect(screen.getByRole("button", { name: "errors.csv" })).toBeInTheDocument();
  });

  it("shows the server's refusal", async () => {
    next = () => json({ message: "Another import is running. Wait for it to finish, then try again." }, 409);
    const { user } = await renderOpen();
    await runDryRun(user);

    expect(await screen.findByText(/Another import is running/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run dry run" })).toBeEnabled();
  });

  it("shows why a run stopped", async () => {
    next = () => stream({ type: "ping" }, { type: "error", message: "csv is missing column(s): Platform", reference: "r1" });
    const { user } = await renderOpen();
    await runDryRun(user);

    expect(await screen.findByText("csv is missing column(s): Platform")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Import/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Run dry run" })).toBeEnabled();
  });

  it("says so when the connection closes before a result arrives", async () => {
    next = () => stream({ type: "ping" }, { type: "progress", phase: "resolve", done: 0, total: 12 });
    const { user } = await renderOpen();
    await runDryRun(user);

    expect(await screen.findByText(/connection closed before the run finished/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Import/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Run dry run" })).toBeEnabled();
  });

  it("leaving the page ends the request", async () => {
    const held = openStream();
    next = () => held.response;
    const { user, unmount } = await renderOpen();
    await runDryRun(user);
    await waitFor(() => expect(posts()).toHaveLength(1));
    const signal = authFetch.mock.calls.find(([, init]) => init?.method === "POST")![1].signal as AbortSignal;
    expect(signal.aborted).toBe(false);

    unmount();

    expect(signal.aborted).toBe(true);
  });
});

describe("Bulk import — the import", () => {
  it("imports the same file, then reports the result and refreshes the list", async () => {
    const { user, onImported } = await renderOpen();
    await runDryRun(user);
    await user.click(await screen.findByRole("button", { name: "Import 12 rows" }));

    expect(await screen.findByText(/12 written, 0 already there/)).toBeInTheDocument();
    const importForm = posts()[1];
    expect(importForm.get("mode")).toBe("import");
    expect(importForm.get("register_id")).toBe("1");
    expect((importForm.get("file") as File).name).toBe("register.csv");
    expect(importForm.get("acknowledge_warnings")).toBeNull();
    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "risk_codes.csv" })).toBeInTheDocument();
    // Another import is not offered from the same result.
    expect(screen.getByRole("button", { name: "Run dry run" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeEnabled();
  });

  it("shows progress while the import writes, and keeps the window open", async () => {
    const { user } = await renderOpen();
    await runDryRun(user);
    const importButton = await screen.findByRole("button", { name: "Import 12 rows" });
    const held = openStream();
    next = () => held.response;

    await user.click(importButton);
    held.push({ type: "progress", phase: "write", done: 3, total: 12 });

    expect(await screen.findByText(/Import: Writing risks \(3 of 12\)/)).toBeInTheDocument();
    expect(screen.getByText(/If the connection drops, the import stops/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    held.push({ type: "result", ...finished.import });
    held.end();
    expect(await screen.findByText(/12 written/)).toBeInTheDocument();
  });

  it("makes the admin accept warnings before importing", async () => {
    finished.dry_run = result({
      counts: { ...noProblems, warnings: 2 },
      findings: [{ migration_id: 1, csv_row: 2, risk_title: "T", severity: "WARN", failure: "Action Steps", detail: "placeholder" }],
    });
    const { user } = await renderOpen();
    await runDryRun(user);

    const importButton = await screen.findByRole("button", { name: "Import 12 rows" });
    expect(importButton).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: /accept them/ }));
    expect(importButton).toBeEnabled();

    await user.click(importButton);
    await waitFor(() => expect(posts()).toHaveLength(2));
    expect(posts()[1].get("acknowledge_warnings")).toBe("true");
  });

  // The failed import tells the admin to run the file again. Both buttons used to
  // be off after it, so the only way out was to choose the file again.
  it("lets the admin run a fresh dry run after an import fails", async () => {
    const { user, onImported } = await renderOpen();
    await runDryRun(user);
    next = () =>
      stream({ type: "error", message: "The run could not complete. Nothing from it is lost: run the same file again to continue.", reference: "r1" });
    await user.click(await screen.findByRole("button", { name: "Import 12 rows" }));
    expect(await screen.findByText(/run the same file again to continue/)).toBeInTheDocument();
    // Rows may have been written before it stopped, so the list is refreshed.
    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));

    // Import itself stays off: the fresh dry run says what is left to write.
    expect(screen.getByRole("button", { name: /^Import/ })).toBeDisabled();
    const dryRunButton = screen.getByRole("button", { name: "Run dry run" });
    expect(dryRunButton).toBeEnabled();

    next = null;
    await user.click(dryRunButton);
    await waitFor(() => expect(posts()).toHaveLength(3));
    expect(posts()[2].get("mode")).toBe("dry_run");

    expect(await screen.findByText(/found nothing to reject/)).toBeInTheDocument();
    expect(screen.queryByText(/run the same file again to continue/)).not.toBeInTheDocument();
  });

  it("flags differences found by the check after the import", async () => {
    finished.import = result({
      mode: "import",
      outcome: "completed_with_findings",
      counts: { ...noProblems, migrated: 10, mismatches: 2 },
      files: { errors_csv: "x", report: "y", risk_codes_csv: "z" },
    });
    const { user } = await renderOpen();
    await runDryRun(user);
    await user.click(await screen.findByRole("button", { name: "Import 12 rows" }));

    expect(await screen.findByText(/found differences/)).toBeInTheDocument();
  });

  it("says a refused import wrote nothing, lists the rows, and allows a fresh dry run", async () => {
    finished.import = result({
      mode: "import",
      outcome: "completed_with_findings",
      counts: { ...noProblems, rejects: 1 },
      findings: [
        { migration_id: 1, csv_row: 2, risk_title: "T1", severity: "REJECT", failure: "Risk Owner", detail: "no active account" },
      ],
    });
    const { user } = await renderOpen();
    await runDryRun(user);
    await user.click(await screen.findByRole("button", { name: "Import 12 rows" }));

    expect(await screen.findByText(/import was refused and nothing was written/)).toBeInTheDocument();
    expect(screen.queryByText(/The import finished/)).not.toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Findings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run dry run" })).toBeEnabled();
  });

  it("saves a result file from the result, with the byte order mark Excel needs on a CSV", async () => {
    const downloads = captureDownloads();
    const { user } = await renderOpen();
    await runDryRun(user);
    await user.click(await screen.findByRole("button", { name: "Import 12 rows" }));

    await user.click(await screen.findByRole("button", { name: "risk_codes.csv" }));
    await user.click(screen.getByRole("button", { name: "report.txt" }));

    await waitFor(() => expect(downloads.filenames).toEqual(["risk_codes.csv", "report.txt"]));
    expect(await readBlob(downloads.blobs[0])).toEqual([0xef, 0xbb, 0xbf, ...bytesOf("Migration ID,Risk Code\n1,2025-ASG-Q1-0001\n")]);
    expect(await readBlob(downloads.blobs[1])).toEqual(bytesOf("the report")); // plain text: no mark
    // The files are in the result already: nothing more is fetched for them.
    expect(requested().filter((u) => u.includes("job"))).toEqual([]);
  });
});

describe("Bulk import — a dry run only vouches for its own file", () => {
  it("choosing another file clears the dry run and the import with it", async () => {
    const { user } = await renderOpen();
    await runDryRun(user);
    expect(await screen.findByRole("button", { name: "Import 12 rows" })).toBeEnabled();

    await chooseFile(user, csv("other.csv"));

    expect(screen.queryByText(/found nothing to reject/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Import/ })).toBeDisabled();
  });

  it("choosing another register clears it too", async () => {
    const { user } = await renderOpen();
    await runDryRun(user);
    expect(await screen.findByRole("button", { name: "Import 12 rows" })).toBeEnabled();

    await chooseRegister(user, "WSO2 Cloud");

    expect(screen.getByRole("button", { name: /^Import/ })).toBeDisabled();
    expect(screen.queryByText(/found nothing to reject/)).not.toBeInTheDocument();
  });
});

describe("Bulk import — what the dry run says the import would do", () => {
  const counts = (over: Partial<NonNullable<BulkImportResult["counts"]>>) => ({ ...noProblems, plan_known: true, ...over });

  it("offers an import of just the rows that are new", async () => {
    finished.dry_run = result({ rows: 5, counts: counts({ to_write: 2, already_done: 3 }) });
    const { user } = await renderOpen();
    await runDryRun(user);

    expect(await screen.findByText(/would write 2 rows and skip 3 that are already there/)).toBeInTheDocument();
    expect(screen.getByText("2 to write")).toBeInTheDocument();
    expect(screen.getByText("3 already there")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import 2 rows" })).toBeEnabled();
  });

  it("says so, and offers no import, when every row is already there", async () => {
    finished.dry_run = result({ rows: 3, counts: counts({ to_write: 0, already_done: 3 }) });
    const { user } = await renderOpen();
    await runDryRun(user);

    expect(await screen.findByText(/nothing to import/)).toBeInTheDocument();
    expect(screen.queryByText(/found nothing to reject/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Import/ })).toBeDisabled();
  });

  it("does not offer the acknowledgement when there is nothing to import", async () => {
    finished.dry_run = result({ rows: 3, counts: counts({ to_write: 0, already_done: 3, warnings: 2 }) });
    const { user } = await renderOpen();
    await runDryRun(user);

    await screen.findByText(/nothing to import/);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
