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

import { describe, expect, it } from "vitest";
import { Delta, linkifyDelta } from "./parLinkify";

describe("linkifyDelta", () => {
  it("links each URL in pasted text and keeps the text around it", () => {
    const out = linkifyDelta(new Delta().insert("see http://a.com and www.b.com ok", { bold: true }));
    expect(out.ops).toEqual([
      { insert: "see ", attributes: { bold: true } },
      { insert: "http://a.com", attributes: { bold: true, link: "http://a.com" } },
      { insert: " and ", attributes: { bold: true } },
      { insert: "www.b.com", attributes: { bold: true, link: "https://www.b.com" } },
      { insert: " ok", attributes: { bold: true } },
    ]);
  });

  it("leaves trailing punctuation out of the link", () => {
    const out = linkifyDelta(new Delta().insert("(see www.a.com/x)."));
    expect(out.ops).toEqual([
      { insert: "(see " },
      { insert: "www.a.com/x", attributes: { link: "https://www.a.com/x" } },
      { insert: ")." },
    ]);
  });

  it("leaves text that is already a link alone", () => {
    const delta = new Delta().insert("www.a.com", { link: "https://elsewhere.com" });
    expect(linkifyDelta(delta).ops).toEqual(delta.ops);
  });

  it("leaves text without a URL unchanged", () => {
    expect(linkifyDelta(new Delta().insert("no links here")).ops).toEqual([{ insert: "no links here" }]);
  });
});
