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

import { Quill, type DeltaStatic } from "react-quill-new";
import { withLinkProtocol } from "./parComment";

export const Delta = Quill.import("delta") as typeof DeltaStatic;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"]*[^\s<>".,;:!?)\]]/gi;

/** Turns bare URLs in pasted text into links; text already linked is left alone. */
export function linkifyDelta(delta: DeltaStatic): DeltaStatic {
  const out = new Delta();
  for (const op of delta.ops) {
    if (typeof op.insert !== "string" || op.attributes?.link) {
      out.push(op);
      continue;
    }
    let last = 0;
    for (const match of op.insert.matchAll(URL_RE)) {
      if (match.index > last) out.insert(op.insert.slice(last, match.index), op.attributes);
      out.insert(match[0], { ...op.attributes, link: withLinkProtocol(match[0]) });
      last = match.index + match[0].length;
    }
    if (last < op.insert.length) out.insert(op.insert.slice(last), op.attributes);
  }
  return out;
}
