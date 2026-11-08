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
    const message = unsentEntryMessage(new TypeError("Failed to fetch"), false);
    expect(message).toMatch(/may not have been shared/);
    expect(message).toMatch(/looks like a command/);
    expect(message).not.toMatch(/Failed to fetch/);
  });

  it("asks to check the feed before a new entry is shared again, and says the draft stays", () => {
    const message = unsentEntryMessage(new TypeError("Failed to fetch"), false);
    expect(message).toMatch(/Check the feed before sharing it again: what you wrote stays here/);
  });

  it("says an edit can simply be saved again", () => {
    const message = unsentEntryMessage(new TypeError("Failed to fetch"), true);
    expect(message).toMatch(/may not have been saved\. Saving it again is safe\./);
    expect(message).not.toMatch(/Check the feed/);
  });

  it("says offline instead when the browser knows it has no connection", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const message = unsentEntryMessage(new TypeError("Load failed"), false);
    expect(message).toMatch(/offline, so this may not have been shared/);
    expect(message).toMatch(/Check the feed before sharing it again/);
    expect(message).not.toMatch(/looks like a command|reword/);
  });

  it("leaves every other failure to the usual error", () => {
    const badRequest = new HttpError("/x", 400, JSON.stringify({ message: "Title is required." }));
    expect(unsentEntryMessage(badRequest, false)).toBeUndefined();
    const bug = new TypeError("Cannot read properties of undefined (reading 'id')");
    expect(unsentEntryMessage(bug, false)).toBeUndefined();
    expect(unsentEntryMessage(null, true)).toBeUndefined();
  });
});
