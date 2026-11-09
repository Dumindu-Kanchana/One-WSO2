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
import { HttpError, authedPost, authedPut } from "@api/http";
import type { TilSubmissionPayload, TilSubmissionUpdatePayload } from "./tilTypes";
import { useCreateTilSubmission, useUpdateTilSubmission } from "./useTilMutations";

// The token and identity hooks pull Asgardeo into the module graph, and that
// package does not resolve under vitest's ESM loader.
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@hooks/useAsgardeoSub", () => ({ useAsgardeoSub: () => ({ state: { status: "ready", sub: "user" } }) }));
vi.mock("@config/apiConfig", () => ({
  tilServiceUrls: { submissions: "/submissions", submission: (id: string) => `/submissions/${id}` },
}));
vi.mock("@api/http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@api/http")>()),
  authedPost: vi.fn(),
  authedPut: vi.fn(),
}));

const FEED_KEY = ["til-submissions", "user"];
const ENTRY_KEY = ["til-submission", "user", "entry"];

/** A query client whose refetches never finish, and the wrapper that provides it. */
function setup() {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries").mockReturnValue(new Promise(() => {}));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { invalidate, wrapper };
}

describe("TIL saves that fail on the network", () => {
  it("fetches the feed again after sharing fails, without holding back the error", async () => {
    vi.mocked(authedPost).mockRejectedValue(new TypeError("Failed to fetch"));
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useCreateTilSubmission(), { wrapper });
    act(() => result.current.mutate({} as TilSubmissionPayload));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: FEED_KEY });
  });

  it("fetches the entry and the feed again after saving an edit fails, without holding back the error", async () => {
    vi.mocked(authedPut).mockRejectedValue(new TypeError("Failed to fetch"));
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useUpdateTilSubmission(), { wrapper });
    act(() => result.current.mutate({ id: "entry", payload: {} as TilSubmissionUpdatePayload }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ENTRY_KEY });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: FEED_KEY });
  });

  it("fetches nothing again when the server answered", async () => {
    const badRequest = new HttpError("/x", 400, JSON.stringify({ message: "Title is required." }));
    vi.mocked(authedPost).mockRejectedValue(badRequest);
    vi.mocked(authedPut).mockRejectedValue(badRequest);
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => ({ create: useCreateTilSubmission(), update: useUpdateTilSubmission() }), {
      wrapper,
    });
    act(() => result.current.create.mutate({} as TilSubmissionPayload));
    act(() => result.current.update.mutate({ id: "entry", payload: {} as TilSubmissionUpdatePayload }));
    await waitFor(() => expect(result.current.create.isError && result.current.update.isError).toBe(true));
    expect(invalidate).not.toHaveBeenCalled();
  });
});
