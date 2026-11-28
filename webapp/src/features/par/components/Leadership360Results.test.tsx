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
import { fireEvent, render, screen } from "@testing-library/react";
import type { FormDefinition, Leadership360Summary } from "../api/leadership360Types";

const query = <T,>(data: T) => ({ data, isLoading: false, isError: false, refetch: vi.fn() });

let summary: Leadership360Summary;
const definition = {
  kind: "LEADERSHIP_360",
  version: 1,
  title: "Leadership 360° feedback",
  scales: { agreement: { min: 1, max: 5, minLabel: "Strongly disagree", maxLabel: "Strongly agree" } },
  sections: [
    {
      id: "relationship",
      title: "How you work with them",
      questions: [
        {
          id: "relationship",
          type: "CHOICE",
          text: "How do you work with this leader?",
          required: true,
          aggregateOnly: true,
          options: [{ value: "TEAM_LEAD", label: "Another lead in my team" }],
        },
      ],
    },
    {
      id: "traits",
      title: "Personal traits",
      questions: [{ id: "integrity", type: "RATING", text: "Shows integrity", scale: "agreement", required: true }],
    },
    {
      id: "feedback",
      title: "Feedback",
      questions: [{ id: "other-feedback", type: "TEXT", text: "Anything else" }],
    },
    {
      id: "context",
      title: "Context",
      // The same option value as the relationship question's, with another label.
      questions: [
        { id: "seniority", type: "CHOICE", text: "Their role", options: [{ value: "TEAM_LEAD", label: "Leads a team" }] },
      ],
    },
  ],
} as unknown as FormDefinition;

vi.mock("../api/useLeadership360", () => ({
  useLeadership360SurveyWithTemplate: () => query({ template: { definition } }),
  useLeadership360Summary: () => query(summary),
}));

const { Leadership360Results } = await import("./Leadership360Results");

const results = (responseCount: number): Leadership360Summary => ({
  leaderEmail: "ada@example.com",
  responseCount,
  available: true,
  ...(responseCount >= 3 ? { overallAverage: 4 } : {}),
  questionAverages: responseCount >= 3 ? [{ questionId: "integrity", average: 4, ratingCount: responseCount }] : [],
  comments: ["Share more context"],
  namedComments: [],
  namedResponses: [],
});

describe("Leadership360Results", () => {
  it("below 3, shows a leader's lead only the responses: no averages or comments", () => {
    summary = { ...results(1), comments: [], anonymousResponses: [{ answers: { integrity: 2 } }] };
    render(<Leadership360Results surveyId={5} view="REPORTS" leaderEmail="ada@example.com" />);
    expect(screen.getByText("The averages and comments show after 3 or more responses.")).toBeInTheDocument();
    expect(screen.queryByText("Overall")).not.toBeInTheDocument();
    expect(screen.queryByText("Comments")).not.toBeInTheDocument();
    expect(screen.queryByText("No written comments.")).not.toBeInTheDocument();
    expect(screen.getByText("Responses (1)")).toBeInTheDocument();
  });

  it("shows a leader's lead every response in full, anonymous ones without a name or date", () => {
    summary = {
      ...results(3),
      namedResponses: [
        {
          respondentEmail: "bob@example.com",
          respondentName: "Bob Silva",
          submittedOn: "2026-11-20",
          latest: true,
          answers: { integrity: 5 },
        },
      ],
      anonymousResponses: [
        { answers: { "other-feedback": "Share more context", integrity: 2, relationship: "TEAM_LEAD" } },
      ],
    };
    render(<Leadership360Results surveyId={5} view="REPORTS" leaderEmail="ada@example.com" />);
    expect(screen.getByText("Responses (2)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Bob Silva · / })).toBeInTheDocument();
    const anonymous = screen.getByRole("button", { name: "Anonymous" });
    fireEvent.click(anonymous);
    const details = anonymous.closest(".MuiAccordion-root")!;
    // Every answer, in the form's order, a choice by its label.
    expect(details).toHaveTextContent(
      "How do you work with this leader?: Another lead in my team" +
        "Shows integrity: 2" +
        "Anything else: Share more context",
    );
  });

  it("labels each choice from its own question, when two questions share a value", () => {
    summary = { ...results(1), anonymousResponses: [{ answers: { relationship: "TEAM_LEAD", seniority: "TEAM_LEAD" } }] };
    render(<Leadership360Results surveyId={5} view="REPORTS" leaderEmail="ada@example.com" />);
    const anonymous = screen.getByRole("button", { name: "Anonymous" });
    fireEvent.click(anonymous);
    expect(anonymous.closest(".MuiAccordion-root")!).toHaveTextContent(
      "How do you work with this leader?: Another lead in my team" + "Their role: Leads a team",
    );
  });

  it("shows the leader no whole responses", () => {
    summary = { ...results(3), namedResponses: undefined };
    render(<Leadership360Results surveyId={5} view="SELF" leaderEmail="ada@example.com" />);
    expect(screen.queryByText(/^Responses \(/)).not.toBeInTheDocument();
    expect(screen.getByText("Share more context")).toBeInTheDocument();
  });

  it("from 3, shows the averages", () => {
    summary = results(3);
    render(<Leadership360Results surveyId={5} view="REPORTS" leaderEmail="ada@example.com" />);
    expect(screen.getByText("Overall")).toBeInTheDocument();
    expect(screen.getByText("Shows integrity")).toBeInTheDocument();
    expect(screen.queryByText(/averages show after/)).not.toBeInTheDocument();
  });
});
