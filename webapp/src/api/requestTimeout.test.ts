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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@api/authBridge", () => ({ refreshAccessToken: vi.fn() }));

import { RequestTimeoutError, authedGet, authedPost } from "./http";
import { httpRetry } from "./errors";

const token = "opaque-token";

// A fetch that never answers on its own, only rejecting when its signal aborts —
// the shape of a request the gateway is holding.
function hangingFetch() {
  return vi.fn((_url: string, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    });
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = hangingFetch();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("authed helpers — timeoutMs", () => {
  it("authedGet gives up after timeoutMs with RequestTimeoutError", async () => {
    const err = await authedGet("https://api.test/x", token, undefined, { timeoutMs: 20 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RequestTimeoutError);
    expect((err as RequestTimeoutError).url).toBe("https://api.test/x");
    expect((err as Error).message).toMatch(/did not answer/);
  });

  it("authedPost gives up after timeoutMs with RequestTimeoutError", async () => {
    const err = await authedPost("https://api.test/x", token, { a: 1 }, undefined, { timeoutMs: 20 }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(RequestTimeoutError);
  });

  it("without timeoutMs, sends no signal — existing callers are unchanged", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await expect(authedGet("https://api.test/x", token)).resolves.toEqual({ ok: true });
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toBeUndefined();
  });

  it("an answer inside the limit is returned as usual", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await expect(authedGet("https://api.test/x", token, undefined, { timeoutMs: 1000 })).resolves.toEqual({
      ok: true,
    });
  });

  it("is retried by the shared retry predicate, as any non-HTTP failure is", () => {
    expect(httpRetry(0, new RequestTimeoutError("https://api.test/x", 20))).toBe(true);
    expect(httpRetry(1, new RequestTimeoutError("https://api.test/x", 20))).toBe(false);
  });
});
