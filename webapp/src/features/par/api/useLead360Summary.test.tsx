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
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import type { ParRating } from "./types";

const authedPost = vi.fn<(url: string) => Promise<unknown>>();
vi.mock("@api/http", () => ({
  authedPost: (url: string) => authedPost(url),
  authedPut: vi.fn(),
  defaultQueryRetry: false,
  HttpError: class extends Error {},
}));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@config/apiConfig", () => ({
  parServiceUrls: { parLead360SummarySuggestion: (id: number, email: string) => `/par-cycles/${id}/${email}/suggestion` },
}));
vi.mock("@features/my/util/digiopsHeaders", () => ({ digiopsHeaders: () => ({}) }));

const { useLead360SummarySuggestion } = await import("./useLead360Summary");

const ratingKey = ["par-rating", 2, "alex@example.com"];
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  client = new QueryClient();
  client.setQueryData<ParRating>(ratingKey, { parRatingId: 7 } as ParRating);
  authedPost.mockReset();
  authedPost.mockResolvedValue({ summary: "Colleagues see real ownership.", responseCount: 4 });
});

describe("useLead360SummarySuggestion", () => {
  it("asks again an hour after a failure even while the tab is hidden", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      authedPost.mockRejectedValueOnce(new Error("HTTP 503"));
      const { result } = renderHook(() => useLead360SummarySuggestion(2, "alex@example.com", 4, true), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));
      focusManager.setFocused(false);
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(authedPost).toHaveBeenCalledTimes(2);
    } finally {
      focusManager.setFocused(undefined);
      vi.useRealTimers();
    }
  });

  it("reads the kept suggestion", async () => {
    const { result } = renderHook(() => useLead360SummarySuggestion(2, "alex@example.com", 4, true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(authedPost).toHaveBeenCalledWith("/par-cycles/2/alex@example.com/suggestion");
  });

  it("asks only when it's wanted, and again only once more responses come in", async () => {
    const { result, rerender } = renderHook(
      ({ count, enabled }) => useLead360SummarySuggestion(2, "alex@example.com", count, enabled),
      { wrapper, initialProps: { count: 4, enabled: false } },
    );
    expect(authedPost).not.toHaveBeenCalled();
    rerender({ count: 4, enabled: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender({ count: 4, enabled: false });
    rerender({ count: 4, enabled: true });
    expect(authedPost).toHaveBeenCalledTimes(1);
    rerender({ count: 5, enabled: true });
    await waitFor(() => expect(authedPost).toHaveBeenCalledTimes(2));
  });

  it("asks again an hour after a failure, not before: the backend tries a failed one again only then", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      authedPost.mockRejectedValueOnce(new Error("HTTP 503"));
      const { result } = renderHook(() => useLead360SummarySuggestion(2, "alex@example.com", 4, true), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));
      await vi.advanceTimersByTimeAsync(59 * 60 * 1000);
      expect(authedPost).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(60 * 1000);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(authedPost).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
