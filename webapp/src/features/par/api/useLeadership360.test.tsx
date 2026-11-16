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
import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readLocalDraft, writeLocalDraft } from "../util/leadership360LocalDraft";

const authedPut = vi.fn<(url: string, token: string, body: unknown) => Promise<void>>(async () => undefined);
vi.mock("@api/http", () => ({
  authedGet: vi.fn(),
  authedPut: (url: string, token: string, body: unknown) => authedPut(url, token, body),
  authedPost: vi.fn(),
  defaultQueryRetry: false,
  HttpError: class extends Error {},
}));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@config/apiConfig", () => ({
  parBackendUrl: "http://par",
  parServiceUrls: { leadership360Drafts: (surveyId: number) => `/surveys/${surveyId}/drafts` },
}));
vi.mock("@features/my/util/digiopsHeaders", () => ({ digiopsHeaders: () => ({}) }));

const { useDiscardLeadership360Draft } = await import("./useLeadership360");

describe("useDiscardLeadership360Draft", () => {
  it("deletes both copies: the named draft on the server and an anonymous one in this browser", async () => {
    writeLocalDraft("me@wso2.com", 3, "elena@wso2.com", { q1: 4 });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useDiscardLeadership360Draft(3, "me@wso2.com"), { wrapper });

    act(() => result.current.mutate("elena@wso2.com"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(authedPut).toHaveBeenCalledWith("/surveys/3/drafts", "token", {
      leaderEmail: "elena@wso2.com",
      answers: {},
      anonymous: true,
    });
    expect(readLocalDraft("me@wso2.com", 3, "elena@wso2.com")).toBeNull();
  });
});
