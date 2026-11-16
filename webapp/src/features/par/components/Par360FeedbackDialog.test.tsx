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
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { Review360Form } from "../api/review360Types";

const saveMutate = vi.fn();
const submitMutate = vi.fn();
let form: Review360Form;

vi.mock("../api/useReview360", () => ({
  useReviewForm: () => ({ isLoading: false, isError: false, data: form }),
  useSaveReviewForm: () => ({ mutate: saveMutate, isPending: false }),
  useSubmitReviewForm: () => ({ mutate: submitMutate, isPending: false }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));

const { default: Par360FeedbackDialog } = await import("./Par360FeedbackDialog");

const OWNERSHIP_HINT = "Follows through without being chased; owns outcomes, not just tasks";

function pending(answers: Review360Form["answers"] = {}, reviewStatus: Review360Form["reviewStatus"] = "PENDING") {
  return {
    employeeEmail: "alex@wso2.com",
    answers,
    reviewStatus,
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
            questions: [
              { id: "ownership", type: "RATING", scale: "frequency", required: true, text: "Ownership", hint: OWNERSHIP_HINT },
            ],
          },
          {
            id: "comments",
            title: "Written feedback",
            questions: [{ id: "feedback", type: "TEXT", text: "Written feedback", maxLength: 5000 }],
          },
        ],
      },
    },
  } as Review360Form;
}

function renderDialog(offered = false) {
  render(
    <Par360FeedbackDialog
      open
      onClose={() => {}}
      parCycleId={2}
      employeeEmail="alex@wso2.com"
      employeeName="Alex Morgan"
      deadline="9999-12-31"
      offered={offered}
    />,
  );
}

beforeEach(() => {
  saveMutate.mockReset();
  submitMutate.mockReset();
  form = pending();
});

describe("Par360FeedbackDialog", () => {
  it("says in one line who sees what", () => {
    renderDialog();
    expect(
      screen.getByText("Alex Morgan sees only anonymised scores; their lead sees your feedback with your name."),
    ).toBeInTheDocument();
  });

  it("says only who reads feedback nobody asked for", () => {
    renderDialog(true);
    expect(screen.getByText("Alex Morgan's lead sees your feedback with your name.")).toBeInTheDocument();
  });

  it("keeps a behaviour's description behind its help icon", () => {
    renderDialog();
    expect(screen.getByRole("img", { name: OWNERSHIP_HINT })).toBeInTheDocument();
    expect(screen.queryByText(OWNERSHIP_HINT)).not.toBeInTheDocument();
  });

  it("submits without written feedback, which is optional", () => {
    renderDialog();
    expect(screen.getByText("Optional")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Peer" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Ownership (required)" })).getByRole("button", { name: "Role model" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.queryByText(/Still to answer/)).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Submit" }).at(-1)!);
    expect(submitMutate).toHaveBeenCalledWith({ relationship: "PEER", ownership: 5 }, expect.anything());
  });

  it("names what's still to answer and doesn't ask to submit", () => {
    renderDialog();
    fireEvent.change(screen.getByRole("textbox", { name: "Written feedback" }), { target: { value: "Clear updates." } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByText("Still to answer: How do you work with them?, Ownership.")).toBeInTheDocument();
    expect(screen.queryByText("Submit your feedback?")).not.toBeInTheDocument();
  });

  it("doesn't ask how you work together when the requester said, and submits their answer", () => {
    form = { ...pending(), requestAnswers: { relationship: "CROSS_TEAM" } };
    renderDialog();
    expect(screen.queryByText("How do you work with them?")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Peer" })).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("group", { name: "Ownership (required)" })).getByRole("button", { name: "Role model" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Submit" }).at(-1)!);
    expect(submitMutate).toHaveBeenCalledWith({ relationship: "CROSS_TEAM", ownership: 5 }, expect.anything());
  });

  it("shows submitted feedback read-only, without marks or a submit button", () => {
    form = pending({ relationship: "PEER", ownership: 4, feedback: "Clear updates." }, "SHARED");
    renderDialog();
    expect(screen.getByText("Clear updates.")).toBeInTheDocument();
    expect(screen.queryByText("Optional")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });
});
