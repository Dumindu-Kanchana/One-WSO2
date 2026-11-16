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

import { StrictMode, createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { Quill } from "react-quill-new";
import ParRichTextField, { type ParRichTextFieldHandle } from "./ParRichTextField";

const quillIn = (container: HTMLElement) => Quill.find(container.querySelector(".ql-container")!) as Quill;
const undoButton = (container: HTMLElement) => container.querySelector<HTMLButtonElement>("button.ql-undo")!;
const redoButton = (container: HTMLElement) => container.querySelector<HTMLButtonElement>("button.ql-redo")!;
const undo = (quill: Quill) => act(() => (quill.getModule("history") as { undo: () => void }).undo());
// jsdom has no layout; Quill scrolls the caret into view after a key.
Range.prototype.getBoundingClientRect ??= () => new DOMRect();
const pressTab = (quill: Quill) =>
  act(() => {
    quill.root.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", keyCode: 9, which: 9, bubbles: true }));
  });

// The field as a caller holds it: its value in state, set from what it sends.
function Held({
  initial,
  onChange,
  onAcceptSuggestion,
  handle,
}: {
  initial: string;
  onChange?: (html: string) => void;
  onAcceptSuggestion?: () => void;
  handle?: React.Ref<ParRichTextFieldHandle>;
}) {
  const [value, setValue] = useState(initial);
  return (
    <ParRichTextField
      ref={handle}
      value={value}
      onChange={(html) => {
        setValue(html);
        onChange?.(html);
      }}
      onAcceptSuggestion={onAcceptSuggestion}
    />
  );
}

describe("ParRichTextField", () => {
  it("doesn't undo the saved text loading", () => {
    const { container } = render(<Held initial="<p>Saved text</p>" />);
    const quill = quillIn(container);
    undo(quill);
    expect(quill.getText().trim()).toBe("Saved text");
  });

  it("doesn't undo it when React mounts the editor twice either, as in development", () => {
    const { container } = render(
      <StrictMode>
        <Held initial="<p>Colleagues&nbsp;see&nbsp;ownership.</p>" />
      </StrictMode>,
    );
    expect(undoButton(container)).toBeDisabled();
    const quill = quillIn(container);
    undo(quill);
    expect(quill.getText().trim()).toBe("Colleagues see ownership.");
  });

  it("doesn't undo a value set from outside later either", () => {
    const { container, rerender } = render(<ParRichTextField value="" onChange={() => {}} />);
    rerender(<ParRichTextField value="<p>Another record</p>" onChange={() => {}} />);
    const quill = quillIn(container);
    undo(quill);
    expect(quill.getText().trim()).toBe("Another record");
  });

  it("still undoes what's typed", () => {
    const { container } = render(<Held initial="<p>Saved</p>" />);
    const quill = quillIn(container);
    act(() => {
      quill.insertText(quill.getLength() - 1, " and more", "user");
    });
    undo(quill);
    expect(quill.getText().trim()).toBe("Saved");
  });

  it("has Undo and Redo in the toolbar, each off until there's something to take or bring back", () => {
    const { container } = render(<Held initial="<p>Saved</p>" />);
    const quill = quillIn(container);
    expect(undoButton(container)).toBeDisabled();
    expect(redoButton(container)).toBeDisabled();
    act(() => {
      quill.insertText(quill.getLength() - 1, " and more", "user");
    });
    expect(undoButton(container)).toBeEnabled();
    fireEvent.click(undoButton(container));
    expect(quill.getText().trim()).toBe("Saved");
    expect(undoButton(container)).toBeDisabled();
    expect(redoButton(container)).toBeEnabled();
    fireEvent.click(redoButton(container));
    expect(quill.getText().trim()).toBe("Saved and more");
    expect(undoButton(container)).toBeEnabled();
    expect(redoButton(container)).toBeDisabled();
  });

  it("leaves nothing more to undo once what was typed is undone, apostrophes and all", () => {
    // Quill writes ' as &#39; and the sanitizer as ', so handing that value back
    // would replace the editor's contents: a fresh step to undo, no redo.
    const { container } = render(<Held initial="<p>Others' work</p>" />);
    const quill = quillIn(container);
    const history = quill.getModule("history") as { stack: { undo: unknown[]; redo: unknown[] } };
    act(() => {
      quill.insertText(quill.getLength() - 1, " and more", "user");
    });
    fireEvent.click(undoButton(container));
    expect(quill.getText().trim()).toBe("Others' work");
    expect(history.stack.undo).toHaveLength(0);
    expect(history.stack.redo).toHaveLength(1);
    expect(undoButton(container)).toBeDisabled();
  });

  it("puts replaced contents in as one step Undo takes back", () => {
    const onChange = vi.fn();
    const handle = createRef<ParRichTextFieldHandle>();
    const { container } = render(<Held initial="<p>My own words.</p>" onChange={onChange} handle={handle} />);
    act(() => handle.current!.replaceContents("<p>Suggested.</p><p>Second line.</p>"));
    const quill = quillIn(container);
    expect(quill.getText()).toBe("Suggested.\nSecond line.\n");
    expect(onChange).toHaveBeenCalled();
    fireEvent.click(undoButton(container));
    expect(quill.getText().trim()).toBe("My own words.");
  });

  it("takes the suggestion on Tab in the empty field, and types a tab otherwise", () => {
    const accept = vi.fn();
    const empty = render(<Held initial="" onAcceptSuggestion={accept} />);
    const quill = quillIn(empty.container);
    act(() => quill.setSelection(0, 0));
    pressTab(quill);
    expect(accept).toHaveBeenCalledTimes(1);
    expect(quill.getText()).toBe("\n");
    empty.unmount();

    const written = render(<Held initial="<p>Mine</p>" onAcceptSuggestion={accept} />);
    const quill2 = quillIn(written.container);
    act(() => quill2.setSelection(4, 0));
    pressTab(quill2);
    expect(accept).toHaveBeenCalledTimes(1);
    expect(quill2.getText()).toBe("Mine\t\n");
  });
});
