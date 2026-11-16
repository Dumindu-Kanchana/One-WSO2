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

import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let okrsFlag = true;
const authedGet = vi.fn<(url: string, token: string) => Promise<never[]>>(async () => []);
const authedPost = vi.fn<(url: string, token: string, body: unknown) => Promise<null>>(async () => null);
const authedPatch = vi.fn<(url: string, token: string, body: unknown) => Promise<null>>(async () => null);
const authedPut = vi.fn<(url: string, token: string, body: unknown) => Promise<null>>(async () => null);
const authedDelete = vi.fn<(url: string, token: string) => Promise<void>>(async () => undefined);

vi.mock("@api/http", () => ({
  authedGet: (url: string, token: string) => authedGet(url, token),
  authedPost: (url: string, token: string, body: unknown) => authedPost(url, token, body),
  authedPatch: (url: string, token: string, body: unknown) => authedPatch(url, token, body),
  authedPut: (url: string, token: string, body: unknown) => authedPut(url, token, body),
  authedDelete: (url: string, token: string) => authedDelete(url, token),
  defaultQueryRetry: false,
}));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@hooks/useAsgardeoSub", () => ({ useAsgardeoSub: () => ({ state: { status: "ready", sub: "sub-1" } }) }));
vi.mock("@config/previewFeatures", () => ({ isPreviewEnabled: (f: string) => f === "okrs" && okrsFlag }));
vi.mock("@config/apiConfig", async () => {
  const peopleBackendUrl = "http://people";
  return {
    peopleBackendUrl,
    peopleServiceUrls: {
      okrs: (q: { ownerEmail: string } | { scope: string }) =>
        "ownerEmail" in q ? `${peopleBackendUrl}/okrs?ownerEmail=${q.ownerEmail}` : `${peopleBackendUrl}/okrs?scope=${q.scope}`,
      newOkr: `${peopleBackendUrl}/okrs`,
      okr: (id: number) => `${peopleBackendUrl}/okrs/${id}`,
      okrStatus: (id: number) => `${peopleBackendUrl}/okrs/${id}/status`,
      okrTeam: (owner: string, search: string) => `${peopleBackendUrl}/okr-team?ownerEmail=${owner}&search=${search}`,
      okrKeyResult: (id: number) => `${peopleBackendUrl}/okr-key-results/${id}`,
      okrKeyResultStatus: (id: number) => `${peopleBackendUrl}/okr-key-results/${id}/status`,
      okrKeyResultActions: (id: number) => `${peopleBackendUrl}/okr-key-results/${id}/actions`,
      okrAction: (id: number) => `${peopleBackendUrl}/okr-actions/${id}`,
      okrActionComments: (id: number) => `${peopleBackendUrl}/okr-actions/${id}/comments`,
    },
  };
});

const {
  useAddOkrAction,
  useAddOkrComment,
  useCreateOkr,
  useDeleteOkr,
  useOkrComments,
  useOkrList,
  useOkrTeam,
  useOkrs,
  useRemoveOkrAction,
  useSetKeyResultStatus,
  useSetOkrStatus,
  useUpdateKeyResultMeasure,
  useUpdateOkr,
  useUpdateOkrAction,
} = await import("./useOkrs");

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

beforeEach(() => {
  okrsFlag = true;
  for (const fn of [authedGet, authedPost, authedPatch, authedPut, authedDelete]) fn.mockClear();
});

describe("OKR hooks", () => {
  it("read one person's, and lists, from the people backend", async () => {
    renderHook(() => useOkrs("ravi@example.com"), { wrapper });
    renderHook(() => useOkrList("team"), { wrapper });
    await waitFor(() => expect(authedGet).toHaveBeenCalledTimes(2));
    expect(authedGet).toHaveBeenCalledWith("http://people/okrs?ownerEmail=ravi@example.com", "token");
    expect(authedGet).toHaveBeenCalledWith("http://people/okrs?scope=team", "token");
  });

  it("read the team a key result can go to, and an action's comments", async () => {
    renderHook(() => useOkrTeam("hannah@example.com", " may "), { wrapper });
    renderHook(() => useOkrComments(9), { wrapper });
    await waitFor(() => expect(authedGet).toHaveBeenCalledTimes(2));
    expect(authedGet).toHaveBeenCalledWith("http://people/okr-team?ownerEmail=hannah@example.com&search=may", "token");
    expect(authedGet).toHaveBeenCalledWith("http://people/okr-actions/9/comments", "token");
  });

  it("set, change, complete and delete objectives through the people backend", async () => {
    const create = renderHook(() => useCreateOkr(), { wrapper }).result;
    const update = renderHook(() => useUpdateOkr(), { wrapper }).result;
    const setStatus = renderHook(() => useSetOkrStatus(), { wrapper }).result;
    const remove = renderHook(() => useDeleteOkr(), { wrapper }).result;
    const okr = { ownerEmail: "ravi@example.com", objective: "Ship", keyResults: [{ title: "Done", dueDate: "2026-12-31" }] };
    await act(async () => {
      await create.current.mutateAsync(okr);
      await update.current.mutateAsync({ okrId: 4, update: { version: 2, objective: "Ship it" } });
      await setStatus.current.mutateAsync({ okrId: 4, status: "CLOSED", reason: "Dropped" });
      await setStatus.current.mutateAsync({ okrId: 4, status: "OPEN" });
      await remove.current.mutateAsync(4);
    });
    expect(authedPost).toHaveBeenCalledWith("http://people/okrs", "token", okr);
    expect(authedPatch).toHaveBeenCalledWith("http://people/okrs/4", "token", { version: 2, objective: "Ship it" });
    expect(authedPut).toHaveBeenCalledWith("http://people/okrs/4/status", "token", { status: "CLOSED", reason: "Dropped" });
    expect(authedPut).toHaveBeenCalledWith("http://people/okrs/4/status", "token", { status: "OPEN" });
    expect(authedDelete).toHaveBeenCalledWith("http://people/okrs/4", "token");
  });

  it("work on key results, actions and comments through the people backend", async () => {
    const status = renderHook(() => useSetKeyResultStatus(), { wrapper }).result;
    const measure = renderHook(() => useUpdateKeyResultMeasure(), { wrapper }).result;
    const addAction = renderHook(() => useAddOkrAction(), { wrapper }).result;
    const updateAction = renderHook(() => useUpdateOkrAction(), { wrapper }).result;
    const removeAction = renderHook(() => useRemoveOkrAction(), { wrapper }).result;
    const comment = renderHook(() => useAddOkrComment(9), { wrapper }).result;
    await act(async () => {
      await status.current.mutateAsync({ keyResultId: 7, status: "AT_RISK" });
      await measure.current.mutateAsync({ keyResultId: 7, version: 3, baseline: "59", target: "60" });
      await addAction.current.mutateAsync({ keyResultId: 7, title: "Survey" });
      await updateAction.current.mutateAsync({ actionId: 9, done: true });
      await removeAction.current.mutateAsync(9);
      await comment.current.mutateAsync("Nice");
    });
    expect(authedPut).toHaveBeenCalledWith("http://people/okr-key-results/7/status", "token", { status: "AT_RISK" });
    expect(authedPatch).toHaveBeenCalledWith("http://people/okr-key-results/7", "token", {
      version: 3,
      baseline: "59",
      target: "60",
    });
    expect(authedPost).toHaveBeenCalledWith("http://people/okr-key-results/7/actions", "token", { title: "Survey" });
    expect(authedPatch).toHaveBeenCalledWith("http://people/okr-actions/9", "token", { done: true });
    expect(authedDelete).toHaveBeenCalledWith("http://people/okr-actions/9", "token");
    expect(authedPost).toHaveBeenCalledWith("http://people/okr-actions/9/comments", "token", { comment: "Nice" });
  });

  it("ask for nothing while the okrs preview flag is off", async () => {
    okrsFlag = false;
    const { result } = renderHook(() => useOkrs("ravi@example.com"), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.fetchStatus).toBe("idle");
    expect(authedGet).not.toHaveBeenCalled();
  });
});
