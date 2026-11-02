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
import { render, screen } from "@testing-library/react";
import type { Leadership360ResultsEntry, Leadership360Survey } from "../api/leadership360Types";

const query = <T,>(data: T) => ({ data, isLoading: false, isError: false, refetch: vi.fn() });

let surveys: Leadership360Survey[] = [];
let results: Leadership360ResultsEntry[] = [];
const asked: { surveyId: number | undefined; view: string }[] = [];

vi.mock("../api/useLeadership360", async (importOriginal) => ({
  cycleSurvey: (await importOriginal<typeof import("../api/useLeadership360")>()).cycleSurvey,
  useLeadership360Surveys: () => query(surveys),
  useLeadership360Results: (surveyId: number | undefined, view: string) => {
    asked.push({ surveyId, view });
    return query(results);
  },
}));
vi.mock("./Leadership360SummaryDialog", () => ({ default: () => null }));

const { default: Leadership360ResultsCard } = await import("./Leadership360ResultsCard");

const survey = (surveyId: number, status: Leadership360Survey["status"], parCycleId?: number): Leadership360Survey => ({
  surveyId,
  surveyName: `Survey ${surveyId}`,
  formTemplateId: 1,
  startDate: "2026-10-01",
  endDate: "2026-11-12",
  status,
  parCycleId,
});
const ada = { workEmail: "ada@example.com", employeeName: "Ada", jobRole: null, employeeThumbnail: null };

beforeEach(() => {
  surveys = [survey(5, "OPEN", 9), survey(2, "CLOSED")];
  results = [];
  asked.length = 0;
});

describe("Leadership360ResultsCard", () => {
  it("shows the cycle's survey, live, asking only for your own results", () => {
    results = [{ leader: ada, responseCount: 4, available: true }];
    render(<Leadership360ResultsCard view="SELF" parCycleId={9} />);
    expect(screen.getByText("Your Leadership 360° results")).toBeInTheDocument();
    expect(screen.getByText("Survey 5")).toBeInTheDocument();
    expect(screen.getByText(/Updates as feedback comes in/)).toBeInTheDocument();
    expect(screen.getByText("4 responses")).toBeInTheDocument();
    expect(asked.every((a) => a.surveyId === 5 && a.view === "SELF")).toBe(true);
  });

  it("gives the count before there are enough responses", () => {
    results = [{ leader: ada, responseCount: 2, available: false }];
    render(<Leadership360ResultsCard view="SELF" parCycleId={9} />);
    expect(screen.getByText("2 responses so far; results show from 3.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View results" })).not.toBeInTheDocument();
  });

  it("shows a closed cycle's survey as final results (History)", () => {
    surveys = [survey(5, "OPEN", 9), survey(2, "CLOSED", 4)];
    results = [{ leader: ada, responseCount: 6, available: true }];
    render(<Leadership360ResultsCard view="SELF" parCycleId={4} />);
    expect(screen.getByText("Survey 2")).toBeInTheDocument();
    expect(screen.getByText("Results from a survey that has closed.")).toBeInTheDocument();
  });

  it("shows nothing for someone outside the leadership team", () => {
    const { container } = render(<Leadership360ResultsCard view="SELF" parCycleId={9} />);
    expect(container).toBeEmptyDOMElement();
  });
});
