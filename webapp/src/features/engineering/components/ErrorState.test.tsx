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
import userEvent from "@testing-library/user-event";
import { HttpError } from "@api/http";
import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";

describe("ErrorState", () => {
  it("says something went wrong and offers no retry unless asked", () => {
    render(<ErrorState />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("We couldn't load this data. Please try again.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("shows the server's own message as the detail line when the response carries one", () => {
    const error = new HttpError(
      "/x",
      400,
      JSON.stringify({ message: "Range may not exceed 366 days." }),
    );
    render(<ErrorState error={error} />);
    expect(screen.getByText("Range may not exceed 366 days.")).toBeInTheDocument();
    expect(
      screen.queryByText("We couldn't load this data. Please try again."),
    ).not.toBeInTheDocument();
  });

  it("falls back to the default sentence when the response carries no message", () => {
    render(<ErrorState error={new HttpError("/x", 502, "<html>Bad gateway</html>")} />);
    expect(screen.getByText("We couldn't load this data. Please try again.")).toBeInTheDocument();
    expect(screen.queryByText(/Bad gateway/)).not.toBeInTheDocument();
  });

  it("falls back to the default sentence for a failure that is not an HTTP response", () => {
    render(<ErrorState error={new TypeError("Failed to fetch")} />);
    expect(screen.getByText("We couldn't load this data. Please try again.")).toBeInTheDocument();
  });

  it("lets a caller write its own title and detail", () => {
    render(<ErrorState title="Chart unavailable" description="Try a shorter range." />);
    expect(screen.getByText("Chart unavailable")).toBeInTheDocument();
    expect(screen.getByText("Try a shorter range.")).toBeInTheDocument();
  });

  it("offers Retry when there is something to retry", async () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("EmptyState", () => {
  it("shows the title alone by default", () => {
    render(<EmptyState title="No data for the selected range" />);
    expect(screen.getByText("No data for the selected range")).toBeInTheDocument();
  });

  it("shows a description and an icon when given", () => {
    render(
      <EmptyState
        title="No tracked repositories"
        description="Add one to start collecting."
        icon={<span data-testid="icon" />}
      />,
    );
    expect(screen.getByText("No tracked repositories")).toBeInTheDocument();
    expect(screen.getByText("Add one to start collecting.")).toBeInTheDocument();
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });
});
