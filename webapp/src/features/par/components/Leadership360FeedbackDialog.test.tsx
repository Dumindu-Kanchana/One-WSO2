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
import type { Leadership360CurrentSurvey, Leadership360Draft } from "../api/leadership360Types";

const submitMutate = vi.fn();
const draftMutate = vi.fn();

vi.mock("../api/useLeadership360", () => ({
  useSaveLeadership360Draft: () => ({ mutate: draftMutate, isPending: false, isError: false, isSuccess: false }),
  useSubmitLeadership360Feedback: () => ({ mutate: submitMutate, isPending: false, isError: false }),
}));

const { default: Leadership360FeedbackDialog } = await import("./Leadership360FeedbackDialog");

const survey: Leadership360CurrentSurvey = {
  survey: {
    surveyId: 7,
    surveyName: "Leadership 360 2026",
    formTemplateId: 1,
    status: "OPEN",
  },
  template: {
    formTemplateId: 1,
    formKind: "LEADERSHIP_360",
    formVersion: 1,
    definition: {
      kind: "LEADERSHIP_360",
      version: 1,
      title: "Leadership 360° feedback",
      scales: { agreement: { min: 1, max: 5, minLabel: "Strongly disagree", maxLabel: "Strongly agree" } },
      sections: [
        {
          id: "relationship",
          title: "How you work with them",
          display: "HEADER",
          questions: [
            {
              id: "relationship",
              type: "CHOICE",
              text: "How do you work with this leader?",
              required: true,
              options: [{ value: "DIRECT_LEAD", label: "They are my direct lead" }],
            },
          ],
        },
        {
          id: "traits",
          title: "Personal traits",
          questions: [{ id: "integrity", type: "RATING", scale: "agreement", text: "Shows integrity", required: true }],
        },
        {
          id: "other",
          title: "Other feedback",
          questions: [{ id: "other", type: "TEXT", text: "Anything else?", required: false }],
        },
      ],
    },
  },
};

const leader = { workEmail: "lead@wso2.com", employeeName: "Ada Lead", jobRole: "Director", employeeThumbnail: null };

function renderDialog(
  props: {
    draft?: Leadership360Draft;
    anonymousGiven?: boolean;
    survey?: typeof survey;
    submitted?: { answers: Record<string, string | number>; on: string };
  } = {},
) {
  render(
    <Leadership360FeedbackDialog
      open
      onClose={() => {}}
      survey={survey}
      leader={leader}
      workEmail="me@wso2.com"
      onSubmitted={() => {}}
      {...props}
    />,
  );
}

const LOCAL_KEY = "par-l360-anonymous-draft:me@wso2.com:7:lead@wso2.com";

beforeEach(() => {
  submitMutate.mockReset();
  draftMutate.mockReset();
  window.localStorage.clear();
});

const named = () => screen.getByRole("button", { name: "Named" });
const anonymousOption = () => screen.getByRole("button", { name: "Anonymous" });

describe("Leadership360FeedbackDialog", () => {
  it("is named by default, and says who sees what in a tooltip", async () => {
    renderDialog();
    expect(named()).toHaveAttribute("aria-pressed", "true");
    fireEvent.mouseOver(named());
    expect(await screen.findByText("Ada Lead and their lead see your response with your name.")).toBeInTheDocument();
  });

  it("says the name isn't stored when anonymous", async () => {
    renderDialog();
    fireEvent.click(anonymousOption());
    expect(anonymousOption()).toHaveAttribute("aria-pressed", "true");
    fireEvent.mouseOver(anonymousOption());
    expect(await screen.findByText("Your name is not stored with this response.")).toBeInTheDocument();
  });

  it("names the leader's role and survey, without its end date", () => {
    renderDialog();
    expect(screen.getByText("Director · Leadership 360 2026")).toBeInTheDocument();
  });

  it("shows every section on one page, the written feedback as an optional box under its title", () => {
    renderDialog();
    expect(screen.getByRole("heading", { name: "Personal traits" })).toBeInTheDocument();
    expect(within(screen.getByRole("heading", { name: /^Other feedback/ })).getByText("Optional")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Anything else?" })).toBeInTheDocument();
    expect(screen.queryByText("Anything else?")).not.toBeInTheDocument();
  });

  it("doesn't submit while a required question is unanswered", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByText("2 required questions still need an answer.")).toBeInTheDocument();
    expect(submitMutate).not.toHaveBeenCalled();
  });

  it("asks for confirmation, then submits only the answers given, with the name", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("radio", { name: "They are my direct lead" }));
    fireEvent.click(screen.getByRole("button", { name: "4 of 5" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByText("Submit named feedback on Ada Lead?")).toBeInTheDocument();
    expect(screen.getByText("You can't change it after you submit.")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Submit" }).at(-1)!);
    expect(submitMutate).toHaveBeenCalledWith(
      { leaderEmail: "lead@wso2.com", answers: { relationship: "DIRECT_LEAD", integrity: 4 }, anonymous: false },
      expect.anything(),
    );
  });

  it("keeps an anonymous draft in this browser only", () => {
    renderDialog();
    fireEvent.click(anonymousOption());
    fireEvent.click(screen.getByRole("button", { name: "4 of 5" }));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? "null")).toEqual({ integrity: 4 });
    expect(draftMutate).not.toHaveBeenCalled();
    expect(screen.getByText("Draft saved in this browser")).toBeInTheDocument();
  });

  it("picks up an anonymous draft from this browser, as anonymous", () => {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify({ integrity: 2 }));
    renderDialog();
    expect(screen.getByRole("button", { name: "2 of 5" })).toHaveAttribute("aria-pressed", "true");
    expect(anonymousOption()).toHaveAttribute("aria-pressed", "true");
  });

  it("opens a named draft as named, and removes it from the server when switched to anonymous", () => {
    renderDialog({ draft: { leaderEmail: "lead@wso2.com", answers: { integrity: 3 }, anonymous: false } });
    expect(named()).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(anonymousOption());
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(draftMutate).toHaveBeenCalledWith({ leaderEmail: "lead@wso2.com", answers: {}, anonymous: true });
    expect(JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? "null")).toEqual({ integrity: 3 });
  });

  it("outside a cycle's 360° window, takes named feedback only, for the next cycle", async () => {
    renderDialog({ survey: { ...survey, survey: { ...survey.survey, surveyId: 0, held: true } } });
    expect(named()).toHaveAttribute("aria-pressed", "true");
    expect(anonymousOption()).toBeDisabled();
    expect(screen.getByText("Director · Counts toward the next PAR cycle")).toBeInTheDocument();
    fireEvent.mouseOver(anonymousOption().parentElement!);
    expect(
      await screen.findByText("Anonymous feedback can only be given while a PAR cycle is open."),
    ).toBeInTheDocument();
  });

  it("shows named feedback you submitted read-only, with when", () => {
    renderDialog({
      submitted: { answers: { relationship: "DIRECT_LEAD", integrity: 4, other: "Clear priorities." }, on: "2026-11-12" },
    });
    expect(screen.getByText("Submitted with your name · 12 Nov '26")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Named" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "4 of 5" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "4 of 5" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "They are my direct lead" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "They are my direct lead" })).toBeDisabled();
    expect(screen.getByText("Clear priorities.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save draft" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(draftMutate).not.toHaveBeenCalled();
  });

  it("allows only named feedback once the cycle's anonymous one on this leader is used", async () => {
    renderDialog({ anonymousGiven: true });
    expect(named()).toHaveAttribute("aria-pressed", "true");
    expect(anonymousOption()).toBeDisabled();
    fireEvent.mouseOver(anonymousOption().parentElement!);
    expect(
      await screen.findByText("You gave anonymous feedback on Ada Lead in this cycle. You can still give named feedback."),
    ).toBeInTheDocument();
  });
});
