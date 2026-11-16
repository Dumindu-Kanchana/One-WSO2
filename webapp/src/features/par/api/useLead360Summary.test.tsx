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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ParRating } from "./types";

const authedGet = vi.fn<(url: string) => Promise<unknown>>();
vi.mock("@api/http", () => ({
  authedGet: (url: string) => authedGet(url),
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
  authedGet.mockReset();
  authedGet.mockResolvedValue({ summary: "Colleagues see real ownership.", responseCount: 4, suggestionsLeft: 8 });
});

describe("useLead360SummarySuggestion", () => {
  it("reads the kept suggestion and notes on the rating what it was written from", async () => {
    const { result } = renderHook(() => useLead360SummarySuggestion(2, "alex@example.com", 4, true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(authedGet).toHaveBeenCalledWith("/par-cycles/2/alex@example.com/suggestion");
    expect(client.getQueryData<ParRating>(ratingKey)).toMatchObject({
      parLead360SuggestionResponses: 4,
      parLead360SuggestionsLeft: 8,
    });
  });

  it("asks only when it's wanted, and again only once more responses come in", async () => {
    const { result, rerender } = renderHook(
      ({ count, enabled }) => useLead360SummarySuggestion(2, "alex@example.com", count, enabled),
      { wrapper, initialProps: { count: 4, enabled: false } },
    );
    expect(authedGet).not.toHaveBeenCalled();
    rerender({ count: 4, enabled: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender({ count: 4, enabled: false });
    rerender({ count: 4, enabled: true });
    expect(authedGet).toHaveBeenCalledTimes(1);
    rerender({ count: 5, enabled: true });
    await waitFor(() => expect(authedGet).toHaveBeenCalledTimes(2));
  });

  it("doesn't retry: each one written counts toward the cap, even when it fails", async () => {
    authedGet.mockRejectedValue(new Error("HTTP 503"));
    const { result } = renderHook(() => useLead360SummarySuggestion(2, "alex@example.com", 4, true), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(authedGet).toHaveBeenCalledTimes(1);
  });
});
