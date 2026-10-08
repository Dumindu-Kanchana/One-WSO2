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
import {
  addLinkProtocol,
  withLinkProtocol,
  decodeParComment,
  encodeParComment,
  isEmptyHtml,
  sanitizeParHtml,
} from "./parComment";

describe("the wire encoding", () => {
  it("round-trips a plain comment", () => {
    const html = "<p>Met every goal this cycle.</p>";
    expect(decodeParComment(encodeParComment(html))).toBe(html);
  });

  it("round-trips characters btoa alone cannot carry", () => {
    const html = "<p>සිංහල — “smart quotes”, 日本語, 🎯</p>";
    expect(decodeParComment(encodeParComment(html))).toBe(html);
  });

  it("produces base64 the backend's constraint accepts", () => {
    expect(encodeParComment("<p>hello</p>")).toMatch(
      /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/,
    );
  });
});

describe("decoding a field that isn't there", () => {
  it("reads an absent field as empty", () => {
    expect(decodeParComment(undefined)).toBe("");
    expect(decodeParComment("")).toBe("");
  });

  it("reads a non-base64 field as empty rather than throwing", () => {
    expect(decodeParComment("<p>not base64 at all</p>")).toBe("");
  });

  it("reads base64 of something undecodable as empty rather than throwing", () => {
    // Valid base64, but not valid URI-encoded text underneath.
    expect(decodeParComment(btoa("%E0%A4%A"))).toBe("");
  });

  it("sanitizes on the way out, not just on the way into the editor", () => {
    const stored = encodeParComment("<p>hi</p><script>steal()</script>");
    expect(decodeParComment(stored)).toBe("<p>hi</p>");
  });
});

describe("sanitizing", () => {
  it("keeps the formatting the editor is allowed to produce", () => {
    const html = "<p><strong>Shipped</strong> the <em>port</em>.</p><ul><li>One</li></ul>";
    expect(sanitizeParHtml(html)).toBe(html);
  });

  it("strips a script tag", () => {
    expect(sanitizeParHtml("<p>hi</p><script>steal()</script>")).toBe("<p>hi</p>");
  });

  it("strips an event-handler attribute but keeps the element", () => {
    const clean = sanitizeParHtml('<p onclick="steal()">hi</p>');
    expect(clean).not.toContain("onclick");
    expect(clean).toContain("hi");
  });

  it("catches markup that arrives HTML-escaped", () => {
    expect(sanitizeParHtml("&lt;script&gt;steal()&lt;/script&gt;")).not.toContain("<script");
  });
});

describe("spotting an empty answer", () => {
  it("treats an untouched editor as empty", () => {
    expect(isEmptyHtml("<p><br></p>")).toBe(true);
    expect(isEmptyHtml("<p>&nbsp;</p>")).toBe(true);
    expect(isEmptyHtml("")).toBe(true);
  });

  it("treats a real answer as not empty", () => {
    expect(isEmptyHtml("<p>Met every goal.</p>")).toBe(false);
  });
});

describe("addLinkProtocol", () => {
  it("adds https:// to a link typed without a scheme", () => {
    expect(addLinkProtocol('<a href="www.example.com">x</a>')).toBe('<a href="https://www.example.com">x</a>');
  });

  it("leaves links that already have a scheme alone", () => {
    const html = '<a href="http://a.com">a</a><a href="mailto:b@c.com">b</a>';
    expect(addLinkProtocol(html)).toBe(html);
  });

  it("leaves text that only looks like an href alone", () => {
    const html = '<p>href="example.com"</p>';
    expect(addLinkProtocol(html)).toBe(html);
  });
});

describe("withLinkProtocol", () => {
  it("adds https:// only when the URL has no scheme", () => {
    expect(withLinkProtocol("www.example.com")).toBe("https://www.example.com");
    expect(withLinkProtocol("http://example.com")).toBe("http://example.com");
  });

  it("treats a host with a port as having no scheme", () => {
    expect(withLinkProtocol("localhost:3000/x")).toBe("https://localhost:3000/x");
    expect(withLinkProtocol("example.com:8080")).toBe("https://example.com:8080");
  });

  it("turns a bare email address into a mailto: link", () => {
    expect(withLinkProtocol("user@example.com")).toBe("mailto:user@example.com");
    expect(withLinkProtocol("mailto:user@example.com")).toBe("mailto:user@example.com");
  });

  it("keeps ftp: and ftps: links as typed", () => {
    expect(withLinkProtocol("ftp://host/file")).toBe("ftp://host/file");
    expect(withLinkProtocol("ftps://host/file")).toBe("ftps://host/file");
  });

  it("keeps in-app links as typed", () => {
    expect(withLinkProtocol("/me/performance")).toBe("/me/performance");
    expect(withLinkProtocol("#section")).toBe("#section");
  });
});
