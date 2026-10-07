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

// Everything to do with a par-app comment field (parEmployeeComment,
// parLeadComment, reviewComment, the admin-configured question text, ...):
// the wire encoding, and the HTML sanitizing every rich-text value goes
// through whether it's being edited or read back.

// ---- wire encoding ----------------------------------------------------------
//
// par-app's comment fields are base64 on the wire — the backend's
// NONE_EMPTY_BASE64_STRING_REGEX constraint rejects anything else. Encoded
// as `btoa(encodeURIComponent(value))` so a non-Latin1 character survives
// btoa, which only accepts one byte per character.

/** A stored comment is base64 of a URI-encoded string — see base64Regex in
 * par-app's config/constant.ts. An empty/undefined field is not base64 at
 * all; treat it as "no comment yet" rather than trying to decode it. */
const BASE64_RE = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;

export function encodeParComment(value: string): string {
  return btoa(encodeURIComponent(value));
}

/** Returns "" for an absent/malformed field rather than throwing — a
 * comment that hasn't been saved yet is not an error. Sanitized before
 * being handed back, since callers either seed an editable field with it
 * or render it read-only — both need it safe to put in the DOM. */
export function decodeParComment(value: string | undefined): string {
  if (!value || !BASE64_RE.test(value)) return "";
  try {
    return sanitizeParHtml(decodeURIComponent(atob(value)));
  } catch {
    return "";
  }
}

// ---- HTML sanitizing ---------------------------------------------------------
//
// Comment fields are rich text (react-quill), not plain strings — and so is
// the admin-configured question text (employeeParQuestion,
// threeSixtyReviewQuestion), which can carry real markup like a `<br/>`.
// Both go through the same sanitize pass, whether being edited or read back.

// Mirrors par-app's config/constant.ts SANITIZE_CONFIG exactly, contradictions
// and all: `style` is listed in both ALLOWED_ATTR and FORBID_ATTR (FORBID
// wins — it's actually stripped), "alert" in FORBID_TAGS isn't a real HTML
// element, and "on*" sits beside four already-covered named handlers.
// DOMPurify resolves all of it safely; kept as source has it rather than
// tidied, since a "cleanup" here is exactly how a security config drifts
// from what it's actually enforcing.
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br", "li", "ol", "ul", "div", "span", "u"],
  ALLOWED_ATTR: ["href", "target", "class", "style", "data-list"],
  FORBID_TAGS: ["style", "script", "iframe", "frame", "object", "embed", "alert"],
  FORBID_ATTR: ["on*", "onclick", "onerror", "onload", "onmouseover", "style"],
  ADD_ATTR: ["target", "href", "rel"],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
};

/** Browser-native HTML-entity decode — react-quill and stored comments can
 * both carry entities (`&amp;` etc.) that need resolving before sanitizing. */
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

/** Decode + sanitize a comment's (or question's) HTML, for both the editor's
 * initial value and the read-only rendering. */
export function sanitizeParHtml(html: string): string {
  return DOMPurify.sanitize(decodeHtmlEntities(html), SANITIZE_CONFIG);
}

/** Quill keeps a link typed without a scheme (`www.example.com`) as-is,
 * which the browser then resolves relative to this app. */
export function addLinkProtocol(html: string): string {
  return html.replace(/href="(?![a-z][a-z0-9+.-]*:|[/#])/gi, 'href="https://');
}

export function withLinkProtocol(url: string): string {
  return /^([a-z][a-z0-9+.-]*:|[/#])/i.test(url) ? url : `https://${url}`;
}

/** A Quill editor with nothing typed still returns markup (`<p><br></p>`,
 * not `""`), so `.trim() === ""` never catches an empty answer. Strips tags
 * and `&nbsp;` the same way par-app's own validation does
 * (ParInputForm.tsx's "is-not-empty-html" yup test) before checking. */
export function isEmptyHtml(html: string): boolean {
  const textContent = html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  return textContent === "";
}
