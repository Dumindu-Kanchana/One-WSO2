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

import DOMPurify from "dompurify";

// Everything to do with the "What did you learn?" rich-text field: the HTML
// sanitizing every value goes through whether it's being edited or read
// back, and the plain-text helpers that let the length limit and the
// "is this actually empty" check reason about content, not markup. Mirrors
// promotion's own promotionRichText.ts (same library, same allowlist); kept
// as its own copy rather than a shared import because PAR's and Promotion's
// equivalents are already separate per-feature copies, not one shared util.

// Sanitized on both write and read: `what` is written by one employee and
// read by every OTHER employee who opens the feed, so the read side never
// trusts that the editor sanitized it either. Text only: no <img>, so a
// pasted or dragged-in picture never reaches storage. The backend sanitizer
// allows the same tags.
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "ol", "ul", "li", "a"],
  ALLOWED_ATTR: ["href", "target"],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
};

export function sanitizeTilHtml(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

/** sanitizeTilHtml for the editor's own change events: returns `html`
 * unchanged when sanitizing would only re-spell it, and the clean version
 * when it actually removes something.
 *
 * Quill writes a quote or apostrophe in text as &quot; / &#39;, the browser
 * serializer behind sanitizeTilHtml writes it bare, so the clean string can
 * differ from Quill's while saying the same thing. react-quill-new resets the
 * whole editor from the value it gets back whenever that differs from the one
 * it emitted, and the reset drops an empty trailing line: Enter at the end of
 * any entry with a quote or apostrophe in it did nothing. */
export function sanitizeEditorHtml(html: string): string {
  const cleaned = sanitizeTilHtml(html);
  const reserialized = new DOMParser().parseFromString(html, "text/html").body.innerHTML;
  return cleaned === reserialized ? html : cleaned;
}

/** Quill (through react-quill-new) writes every space in text as &nbsp;, and
 * a line of non-breaking spaces can't wrap between words, so long lines broke
 * mid-word on the entry page. Turns them back into ordinary spaces. Applied
 * when saving and when displaying, never to the editor's own change events:
 * those must hand back exactly what Quill emitted (see sanitizeEditorHtml). */
export function normalizeTilSpaces(html: string): string {
  return html.replace(/&nbsp;|\u00a0/g, " ");
}

// A web address written out in the text: http:// or https:// up to the next
// space. Punctuation that ends the sentence around it is trimmed off after
// (trimUrlEnd).
const URL_IN_TEXT = /\bhttps?:\/\/[^\s<>"]+/gi;

/** `url` without the punctuation a sentence puts after it: "see
 * https://example.com." links up to ".com". A closing bracket stays when the
 * address opened one, as in https://en.wikipedia.org/wiki/Go_(game). */
function trimUrlEnd(url: string): string {
  let end = url.length;
  while (end > 0) {
    const last = url[end - 1];
    const open = last === ")" ? "(" : last === "]" ? "[" : undefined;
    const head = url.slice(0, end);
    if (/[.,;:!?'"*’”»]/.test(last) || (open && head.split(last).length > head.split(open).length)) {
      end -= 1;
    } else {
      break;
    }
  }
  return url.slice(0, end);
}

function isWebAddress(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.hostname !== "";
  } catch {
    return false;
  }
}

/** `html` with every web address in its text made a link that opens in a new
 * tab. The editor has no link format, so an address someone types or pastes
 * is saved as plain text; this is where it becomes clickable, for entries
 * already saved too. Runs on sanitized HTML: every anchor it adds is built
 * through the DOM, with an http(s) href that URL parsed, so nothing it writes
 * can carry markup. Text already inside a link is left alone. */
function linkifyTilUrls(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.parentElement?.closest("a")) texts.push(node as Text);
  }
  for (const text of texts) {
    const value = text.data;
    const parts: Node[] = [];
    let done = 0;
    for (const match of value.matchAll(URL_IN_TEXT)) {
      const url = trimUrlEnd(match[0]);
      if (!isWebAddress(url)) continue;
      const link = doc.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
      link.textContent = url;
      parts.push(doc.createTextNode(value.slice(done, match.index)), link);
      done = match.index + url.length;
    }
    if (parts.length === 0) continue;
    parts.push(doc.createTextNode(value.slice(done)));
    text.replaceWith(...parts);
  }
  return doc.body.innerHTML;
}

/** Sanitized HTML for read-only display, with &nbsp; as ordinary spaces —
 * which also covers entries saved before saving normalized them — and web
 * addresses as links. */
export function tilDisplayHtml(html: string): string {
  return linkifyTilUrls(normalizeTilSpaces(sanitizeTilHtml(html)));
}

/** Whether two `what` values say the same thing once the editor's own
 * re-spellings (escaped quotes, &nbsp;) are set aside, so an entry opened for
 * editing doesn't read as changed before anything was touched. */
export function isSameTilHtml(a: string, b: string): boolean {
  const canonical = (html: string) =>
    normalizeTilSpaces(new DOMParser().parseFromString(html, "text/html").body.innerHTML);
  return canonical(a) === canonical(b);
}

// Converts to plain text for the two things that must count characters, not
// markup: the character counter and the max-length check. Block-level tags
// become a space first so "<p>One</p><p>Two</p>" doesn't read as "OneTwo".
export function tilPlainText(html: string): string {
  // DOMParser round-trip decodes every HTML entity (&amp;, &lt;, &gt;, …),
  // not just &nbsp; -- a manual replace list only ever covers what's been
  // noticed, and Quill emits &amp;/&lt;/&gt; for plain "&"/"<"/">" in the
  // original text, same as any other HTML serializer. Without this, a
  // search for "R&D" never matches an entry that actually says "R&D" (its
  // plain text would still read "R&amp;D"), and excerpts show raw entities
  // instead of the character. Block tags become a space FIRST, same as
  // before, so adjacent paragraphs don't glue into one word -- but matching
  // "<br ...>" directly rather than only "</br>" (closing-tag form), since
  // <br> is a void element and real markup essentially never actually
  // closes it.
  const spaced = html.replace(/<\/(p|li)>|<br\s*\/?>/gi, " ");
  const text = new DOMParser().parseFromString(spaced, "text/html").body.textContent ?? "";
  return text.replace(/\u00a0/g, " ").trim();
}

// Counts Unicode code points, the same unit the backend counts: an emoji
// like 😀 is one, where String.length would say two.
export function tilPlainTextLength(html: string): number {
  return [...tilPlainText(html)].length;
}

/** Minutes to read an entry at 200 words a minute, never less than one. */
export function tilReadingMinutes(html: string): number {
  const words = tilPlainText(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

/** A Quill editor with nothing typed still returns markup (`<p><br></p>`,
 * not `""`), so `.trim() === ""` on the raw HTML never catches an empty
 * entry — check the plain-text content instead. */
export function isEmptyTilHtml(html: string): boolean {
  return tilPlainText(html) === "";
}

// Raised from 180 (~1 line at the feed card's width) to give a real 2-3
// line preview instead of a single truncated line -- SubmissionCard clamps
// the rendered text to 3 lines via CSS regardless, so this just controls
// how much text is available to fill them.
const EXCERPT_LENGTH = 480;

// Like tilPlainText, but each paragraph, list item and line break starts a
// new line instead of becoming a space, so a preview keeps the entry's shape.
// Blank lines (an empty paragraph from pressing Enter twice) are dropped —
// in a three-line preview they'd use up a line showing nothing. Kept apart
// from tilPlainText, which must stay space-joined: the length limit
// counts its output, and the backend counts the same way.
function tilPlainTextLines(html: string): string {
  const lined = html.replace(/\s+/g, " ").replace(/<\/(p|li)>|<br\s*\/?>/gi, "\n");
  const text = new DOMParser().parseFromString(lined, "text/html").body.textContent ?? "";
  return text
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

/** A plain-text preview for the feed list, one line per paragraph or list
 * item (shown with `white-space: pre-line`). Inline formatting (bold, list
 * markers) is dropped. Trims at a word or line boundary near EXCERPT_LENGTH
 * rather than mid-word, and only appends "…" when something was actually
 * cut. The full rich version still shows on the entry's own page. */
export function tilExcerpt(html: string, maxLength: number = EXCERPT_LENGTH): string {
  const text = tilPlainTextLines(html);
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastBreak = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("\n"));
  return `${lastBreak > maxLength * 0.6 ? cut.slice(0, lastBreak) : cut}…`;
}
