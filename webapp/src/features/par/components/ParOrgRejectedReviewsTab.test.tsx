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
import { render, screen } from "@testing-library/react";
import type { ParCycle, ParRejectedReview } from "../api/types";

const query = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null, refetch: vi.fn() });
const rejected: ParRejectedReview[] = [
  { employeeEmail: "alex@example.com", reviewerEmail: "sam@example.com", isOfferedFeedback: "TRUE" },
  { employeeEmail: "ravi@example.com", reviewerEmail: "maya@example.com", isOfferedFeedback: "FALSE" },
];

vi.mock("../api/useParAdmin", () => ({
  useParRejectedReviews: () => query(rejected),
  useParAdminParticipants: () =>
    query(
      ["alex", "sam", "ravi", "maya"].map((n) => ({ workEmail: `${n}@example.com`, employeeName: n.toUpperCase() })),
    ),
}));
vi.mock("../api/useParMutations", () => ({
  useRestoreRejectedReview: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));

const { default: ParOrgRejectedReviewsTab } = await import("./ParOrgRejectedReviewsTab");

describe("ParOrgRejectedReviewsTab", () => {
  it("tells an offer that was declined from a request, by the backend's TRUE / FALSE", () => {
    render(<ParOrgRejectedReviewsTab cycle={{ parCycleId: 2 } as ParCycle} />);
    expect(screen.getByText("Was offered a review by")).toBeInTheDocument();
    expect(screen.getByText("Requested a review from")).toBeInTheDocument();
  });
});
