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

import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@api/http";
import { unsentEntryMessage } from "./tilError";

describe("unsentEntryMessage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("says commands in the text can be blocked when the request never got an answer", () => {
    const message = unsentEntryMessage(new TypeError("Failed to fetch"));
    expect(message).toMatch(/couldn't reach the server/);
    expect(message).toMatch(/looks like a command/);
    expect(message).not.toMatch(/Failed to fetch/);
  });

  it("says offline instead when the browser knows it has no connection", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    expect(unsentEntryMessage(new TypeError("Load failed"))).toMatch(/offline/);
  });

  it("leaves every other failure to the usual error", () => {
    expect(unsentEntryMessage(new HttpError("/x", 400, JSON.stringify({ message: "Title is required." })))).toBeUndefined();
    expect(unsentEntryMessage(new TypeError("Cannot read properties of undefined (reading 'id')"))).toBeUndefined();
    expect(unsentEntryMessage(null)).toBeUndefined();
  });
});
