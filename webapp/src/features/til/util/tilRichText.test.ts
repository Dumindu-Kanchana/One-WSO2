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
  isEmptyTilHtml,
  isSameTilHtml,
  normalizeTilSpaces,
  sanitizeEditorHtml,
  sanitizeTilHtml,
  tilDisplayHtml,
  tilExcerpt,
  tilPlainTextLength,
  tilReadingMinutes,
} from "./tilRichText";
import { isTilArticleSearch, tilArticlePath, tilEntryPath } from "./tilArticleView";

describe("tilReadingMinutes", () => {
  it("rounds up at 200 words a minute, with a one-minute floor", () => {
    expect(tilReadingMinutes("<p>A few words.</p>")).toBe(1);
    expect(tilReadingMinutes(`<p>${"word ".repeat(201)}</p>`)).toBe(2);
  });
});

describe("TIL article view paths", () => {
  it("builds the in-shell and article URLs for one entry", () => {
    expect(tilEntryPath("abc")).toBe("/knowledge/today-i-learned/abc");
    expect(tilArticlePath("abc")).toBe("/knowledge/today-i-learned/abc?view=article");
  });

  it("recognises the article view from a search string or params", () => {
    expect(isTilArticleSearch("?view=article")).toBe(true);
    expect(isTilArticleSearch(new URLSearchParams("view=article&x=1"))).toBe(true);
    expect(isTilArticleSearch("")).toBe(false);
  });
});

describe("normalizeTilSpaces", () => {
  it("turns the editor's &nbsp; and raw no-break spaces into ordinary spaces", () => {
    expect(normalizeTilSpaces("<p>a&nbsp;b\u00a0c</p>")).toBe("<p>a b c</p>");
  });

  it("leaves a typed '&nbsp;' (escaped as &amp;nbsp;) alone", () => {
    expect(normalizeTilSpaces("<p>&amp;nbsp;</p>")).toBe("<p>&amp;nbsp;</p>");
  });
});

describe("tilDisplayHtml", () => {
  it("sanitizes and normalizes spaces in one pass", () => {
    expect(tilDisplayHtml("<p>a&nbsp;b</p><script>x()</script>")).toBe("<p>a b</p>");
  });

  const link = (url: string) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;

  it("makes a web address in the text a link that opens in a new tab", () => {
    expect(tilDisplayHtml("<p>Docs: https://wso2.com/docs/</p>")).toBe(`<p>Docs: ${link("https://wso2.com/docs/")}</p>`);
  });

  it("links every address, inside formatting and list items too", () => {
    expect(tilDisplayHtml("<ul><li><strong>http://a.example</strong> or https://b.example</li></ul>")).toBe(
      `<ul><li><strong>${link("http://a.example")}</strong> or ${link("https://b.example")}</li></ul>`,
    );
  });

  it("links an address Quill saved with &nbsp; around it", () => {
    expect(tilDisplayHtml("<p>see&nbsp;https://wso2.com&nbsp;now</p>")).toBe(`<p>see ${link("https://wso2.com")} now</p>`);
  });

  it("leaves the punctuation that ends a sentence out of the link", () => {
    expect(tilDisplayHtml("<p>See https://wso2.com/a, then https://wso2.com/b.</p>")).toBe(
      `<p>See ${link("https://wso2.com/a")}, then ${link("https://wso2.com/b")}.</p>`,
    );
    expect(tilDisplayHtml("<p>(see https://wso2.com/a)</p>")).toBe(`<p>(see ${link("https://wso2.com/a")})</p>`);
    expect(tilDisplayHtml("<p>“https://wso2.com/a”</p>")).toBe(`<p>“${link("https://wso2.com/a")}”</p>`);
  });

  it("keeps a closing bracket the address itself opened", () => {
    expect(tilDisplayHtml("<p>https://en.wikipedia.org/wiki/Go_(game)</p>")).toBe(
      `<p>${link("https://en.wikipedia.org/wiki/Go_(game)")}</p>`,
    );
  });

  it("keeps a query string intact", () => {
    expect(tilDisplayHtml("<p>https://wso2.com/s?q=a&amp;b=c</p>")).toBe(
      '<p><a href="https://wso2.com/s?q=a&amp;b=c" target="_blank" rel="noopener noreferrer">https://wso2.com/s?q=a&amp;b=c</a></p>',
    );
  });

  it("links only http and https addresses that have a host", () => {
    for (const html of [
      "<p>javascript:alert(1)</p>",
      "<p>ftp://files.example</p>",
      "<p>https://</p>",
      "<p>xhttps://wso2.com</p>",
      "<p>wso2.com</p>",
    ]) {
      expect(tilDisplayHtml(html)).toBe(html);
    }
  });

  it("leaves text that is already a link alone", () => {
    const html = '<p><a href="https://wso2.com" target="_blank">https://wso2.com</a></p>';
    expect(tilDisplayHtml(html)).toBe(html);
  });

  it("can't be made to write markup through an address", () => {
    const html = tilDisplayHtml('<p>https://wso2.com/"onmouseover="alert(1)</p>');
    expect(html).toBe(`<p>${link("https://wso2.com/")}"onmouseover="alert(1)</p>`);
  });
});

describe("isSameTilHtml", () => {
  it("treats the editor's re-spelling of quotes and spaces as the same content", () => {
    expect(isSameTilHtml("<p>it&#39;s&nbsp;&quot;done&quot;</p>", "<p>it's \"done\"</p>")).toBe(true);
  });

  it("still sees a real change, including formatting", () => {
    expect(isSameTilHtml("<p>one</p>", "<p>two</p>")).toBe(false);
    expect(isSameTilHtml("<p>one</p>", "<p><strong>one</strong></p>")).toBe(false);
  });
});

describe("sanitizeEditorHtml", () => {
  it("hands back the editor's own string when sanitizing would only re-spell quotes", () => {
    // Quill escapes quotes in text; the sanitizer's serializer doesn't. A
    // different string here made react-quill-new reset the editor and drop
    // the line Enter had just added.
    const html = "<p>it&#39;s &quot;done&quot;</p><p></p>";
    expect(sanitizeTilHtml(html)).not.toBe(html);
    expect(sanitizeEditorHtml(html)).toBe(html);
  });

  it("still returns the clean version when sanitizing removes something", () => {
    expect(sanitizeEditorHtml('<p>it&#39;s</p><script>alert("x")</script>')).toBe("<p>it's</p>");
  });

  it("still strips a picture", () => {
    expect(sanitizeEditorHtml('<p>a</p><img src="https://wso2.com/x.png">')).toBe("<p>a</p>");
  });
});

describe("sanitizeTilHtml", () => {
  it("keeps allowlisted formatting", () => {
    const html = "<p>Learned <strong>a lot</strong> from <em>this</em>.</p>";
    expect(sanitizeTilHtml(html)).toBe(html);
  });

  it("strips a script tag and its contents", () => {
    expect(sanitizeTilHtml('<p>hi</p><script>alert("x")</script>')).toBe("<p>hi</p>");
  });

  it("strips a disallowed attribute (onerror) but keeps the element", () => {
    const result = sanitizeTilHtml('<p onerror="alert(1)">hi</p>');
    expect(result).not.toContain("onerror");
    expect(result).toContain("hi");
  });

  it("keeps a safe link's href", () => {
    expect(sanitizeTilHtml('<a href="https://wso2.com">WSO2</a>')).toContain('href="https://wso2.com"');
  });

  it("drops a javascript: link", () => {
    expect(sanitizeTilHtml('<a href="javascript:alert(1)">bad</a>')).not.toContain("javascript:");
  });

  it.each([
    '<img src="https://wso2.com/x.png" alt="a screenshot" width="50%">',
    '<img src="data:image/png;base64,aGVsbG8=">',
    '<img src="javascript:alert(1)" onerror="alert(1)">',
  ])("strips a picture, whatever its source: %s", (img) => {
    // Entries are text only, so an <img> pasted in, or saved back when
    // pictures were allowed, never shows.
    expect(sanitizeTilHtml(`<p>a</p>${img}`)).toBe("<p>a</p>");
  });
});

describe("isEmptyTilHtml", () => {
  it("treats Quill's default empty markup as empty", () => {
    expect(isEmptyTilHtml("<p><br></p>")).toBe(true);
  });

  it("treats a blank string as empty", () => {
    expect(isEmptyTilHtml("")).toBe(true);
  });

  it("treats real content as not empty", () => {
    expect(isEmptyTilHtml("<p>Learned something.</p>")).toBe(false);
  });
});

describe("tilPlainTextLength", () => {
  it("counts only the text, not the markup", () => {
    expect(tilPlainTextLength("<p><strong>abc</strong></p>")).toBe(3);
  });

  it("doesn't glue adjacent paragraphs into one word", () => {
    expect(tilPlainTextLength("<p>One</p><p>Two</p>")).toBe("One Two".length);
  });

  it("counts characters as the backend does: code points, not UTF-16 units", () => {
    expect(tilPlainTextLength("<p>😀</p>")).toBe(1);
    expect(tilPlainTextLength("<p>é ශ 中</p>")).toBe(5);
    // A family emoji is three people joined by two zero-width joiners.
    expect(tilPlainTextLength("<p>👨‍👩‍👧</p>")).toBe(5);
  });

  it("counts an entity as the one character it stands for", () => {
    expect(tilPlainTextLength("<p>R&amp;D</p>")).toBe(3);
  });
});

describe("tilExcerpt", () => {
  it("returns short content unchanged", () => {
    expect(tilExcerpt("<p>Short learning.</p>")).toBe("Short learning.");
  });

  it("puts each paragraph and list item on its own line", () => {
    expect(tilExcerpt("<p>First.</p><p>Second.</p><ul><li>One</li><li>Two</li></ul>")).toBe(
      "First.\nSecond.\nOne\nTwo",
    );
  });

  it("drops the blank line an empty paragraph would leave", () => {
    expect(tilExcerpt("<p>First.</p><p><br></p><p>Second.</p>")).toBe("First.\nSecond.");
  });

  it("does not turn a newline in the markup source into a line break", () => {
    expect(tilExcerpt("<p>One\nsentence.</p>")).toBe("One sentence.");
  });

  it("truncates long content at a word boundary with an ellipsis", () => {
    const long = Array.from({ length: 10 }, (_, i) => `word${i}`).join(" ");
    const result = tilExcerpt(`<p>${long}</p>`, 20);
    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBeLessThan(long.length);
    expect(result).not.toMatch(/\s…$/);
  });
});
