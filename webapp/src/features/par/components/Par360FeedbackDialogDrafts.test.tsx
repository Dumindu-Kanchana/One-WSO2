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
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Review360Form } from "../api/review360Types";

// The draft as the backend holds it: a GET returns it, a PUT replaces its answers.
let stored: Review360Form;
const authedGet = vi.fn(async () => structuredClone(stored));
const authedPut = vi.fn(async (_url: string, _token: string, body: { answers: Review360Form["answers"] }) => {
  stored = { ...stored, answers: body.answers, reviewStatus: "DRAFT" };
});

vi.mock("@api/http", () => ({
  authedGet: () => authedGet(),
  authedPut: (url: string, token: string, body: { answers: Review360Form["answers"] }) => authedPut(url, token, body),
  authedPost: vi.fn(),
  defaultQueryRetry: false,
  HttpError: class extends Error {},
}));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@config/apiConfig", () => ({
  parBackendUrl: "http://par",
  parServiceUrls: { parReviewForm: () => "/review-form", parReviewFormSubmission: () => "/review-form/submission" },
}));
vi.mock("@features/my/util/digiopsHeaders", () => ({ digiopsHeaders: () => ({}) }));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));

const { default: Par360FeedbackDialog } = await import("./Par360FeedbackDialog");

const draft = (answers: Review360Form["answers"]): Review360Form => ({
  employeeEmail: "alex@wso2.com",
  answers,
  reviewStatus: "PENDING",
  requestAnswers: { relationship: "PEER" },
  template: {
    formTemplateId: 5,
    formKind: "PEER_360",
    formVersion: 2,
    definition: {
      kind: "PEER_360",
      version: 2,
      title: "360° feedback",
      scales: {
        frequency: {
          min: 1,
          max: 5,
          minLabel: "Rarely",
          maxLabel: "Role model",
          labels: ["Rarely", "Sometimes", "Consistently", "Often exceeds", "Role model"],
        },
      },
      sections: [
        {
          id: "relationship",
          title: "How you work together",
          questions: [
            {
              id: "relationship",
              type: "CHOICE",
              text: "How do you work with them?",
              required: true,
              askedOnRequest: true,
              options: [
                { value: "PEER", label: "Peer" },
                { value: "CROSS_TEAM", label: "Cross-team" },
              ],
            },
          ],
        },
        {
          id: "behaviours",
          title: "Behaviours",
          questions: [{ id: "ownership", type: "RATING", scale: "frequency", required: true, text: "Ownership" }],
        },
        {
          id: "comments",
          title: "Written feedback",
          questions: [{ id: "feedback", type: "TEXT", text: "Written feedback", maxLength: 5000 }],
        },
      ],
    },
  },
} as Review360Form);

// The shared client's defaults (AppWithConfig): nothing refetches on mount.
const appClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { refetchOnWindowFocus: false, refetchOnReconnect: false, refetchOnMount: false, retry: false },
    },
  });

function renderDialog() {
  const client = appClient();
  const dialog = (open: boolean) => (
    <QueryClientProvider client={client}>
      <Par360FeedbackDialog
        open={open}
        onClose={() => {}}
        parCycleId={2}
        employeeEmail="alex@wso2.com"
        employeeName="Alex Morgan"
        deadline="9999-12-31"
      />
    </QueryClientProvider>
  );
  const view = render(dialog(true));
  return { close: () => view.rerender(dialog(false)), reopen: () => view.rerender(dialog(true)) };
}

const ownership = (label: string) =>
  within(screen.getByRole("group", { name: "Ownership (required)" })).getByRole("button", { name: label });

beforeEach(() => {
  stored = draft({});
  authedGet.mockClear();
  authedPut.mockClear();
});

describe("Par360FeedbackDialog drafts", () => {
  it("shows the saved draft when the form is opened again", async () => {
    const dialog = renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: "Consistently" }));
    await waitFor(() => expect(authedPut).toHaveBeenCalled(), { timeout: 3000 });
    dialog.close();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    // Reopening draws the form from the cache at once; a refetch, if any, would come too late.
    authedGet.mockImplementationOnce(() => new Promise(() => {}));
    dialog.reopen();
    expect(await screen.findByRole("group", { name: "Ownership (required)" })).toBeInTheDocument();
    expect(ownership("Consistently")).toHaveAttribute("aria-pressed", "true");
  });

  it("saves a change made just before closing", async () => {
    stored = draft({ relationship: "PEER", ownership: 4 });
    const dialog = renderDialog();
    fireEvent.change(await screen.findByRole("textbox", { name: "Written feedback" }), {
      target: { value: "Clear updates." },
    });
    dialog.close();
    await waitFor(() =>
      expect(authedPut).toHaveBeenCalledWith("/review-form", "token", {
        answers: { relationship: "PEER", ownership: 4, feedback: "Clear updates." },
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    dialog.reopen();
    expect(await screen.findByRole("textbox", { name: "Written feedback" })).toHaveValue("Clear updates.");
  });
});
