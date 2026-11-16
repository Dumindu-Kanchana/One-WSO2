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

import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import ReactQuill, { Quill, type DeltaStatic } from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@wso2/oxygen-ui";
import { addLinkProtocol, sanitizeParHtml, withLinkProtocol } from "../util/parComment";
import { Delta, linkifyDelta } from "../util/parLinkify";

// A rich-text field: a toolbar with Undo and Redo, and an auto-expanding
// editor. `react-quill-new` in place of `react-quill`: the fork that supports
// React 19.
//
// Sanitize on write only, not on the controlled `value` — re-sanitizing it
// on every render (as the source does) double-decodes entities and is the
// classic trigger for Quill's caret-jump bug. decodeParComment already
// sanitizes once at the read boundary, so `value` is safe as-is here. Nor is
// the sanitized copy of what was typed handed back: the sanitizer writes some
// characters differently (an apostrophe), and Quill would replace its whole
// contents on every keystroke, each time a fresh step to undo.
const TOOLBAR = [["undo", "redo"], ["bold", "italic", "underline"], [{ list: "ordered" }, { list: "bullet" }], [{ indent: "-1" }, { indent: "+1" }], ["link"], ["clean"]];
const FORMATS = ["bold", "italic", "underline", "list", "bullet", "indent", "link"];

// Quill has no undo or redo icon: arrows drawn like its own, so they take the
// theme's colours.
const icons = Quill.import("ui/icons") as Record<string, string>;
icons.undo =
  '<svg viewBox="0 0 18 18"><polygon class="ql-fill ql-stroke" points="6 10 4 12 2 10 6 10"></polygon>' +
  '<path class="ql-stroke" d="M8.09,13.91A4.6,4.6,0,0,0,9,14,5,5,0,1,0,4,9"></path></svg>';
icons.redo =
  '<svg viewBox="0 0 18 18"><polygon class="ql-fill ql-stroke" points="12 10 14 12 16 10 12 10"></polygon>' +
  '<path class="ql-stroke" d="M9.91,13.91A4.6,4.6,0,0,1,9,14a5,5,0,1,1,5-5"></path></svg>';

/** What a caller can do with the field besides setting its value. */
export interface ParRichTextFieldHandle {
  /** Puts this in the field as one step that Undo (or Cmd+Z) takes back. */
  replaceContents: (html: string) => void;
}

type QuillHistory = {
  clear: () => void;
  cutoff: () => void;
  undo: () => void;
  redo: () => void;
  stack: { undo: unknown[]; redo: unknown[] };
};
const historyOf = (quill: Quill) => quill.getModule("history") as QuillHistory;
// Undo and Redo are off while there's nothing to take back or bring back.
const refreshUndo = (quill: Quill) => {
  const toolbar = (quill.getModule("toolbar") as { container: HTMLElement }).container;
  const { stack } = historyOf(quill);
  for (const step of ["undo", "redo"] as const) {
    const button = toolbar.querySelector<HTMLButtonElement>(`button.ql-${step}`);
    if (button) button.disabled = stack[step].length === 0;
  }
};

export default function ParRichTextField({
  value,
  onChange,
  placeholder,
  disabled = false,
  minHeight = "30vh",
  suggestion,
  onAcceptSuggestion,
  ref,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Where it starts before growing with its content: shorter for a short text. */
  minHeight?: string;
  /** Shown inside the field, under the line where typing starts: a suggestion
   * in grey for the caller to insert. The field shrinks to that one line. */
  suggestion?: ReactNode;
  /** Tab in the empty field takes the suggestion, as in Gmail. */
  onAcceptSuggestion?: () => void;
  ref?: Ref<ParRichTextFieldHandle>;
}) {
  const theme = useTheme();
  // theme.palette holds the light scheme only; theme.vars follows the
  // light/dark switch.
  const palette = (theme.vars ?? theme).palette;
  const quillRef = useRef<ReactQuill>(null);

  // The last value the field sent out, and the editor's own HTML for it.
  const [sent, setSent] = useState<{ html: string; own: string } | undefined>(undefined);

  // Quill keeps a value set from outside (the saved text loading, another
  // record) in its undo history, so Cmd+Z straight after would empty the
  // field. Each one starts the history afresh, as does each new editor (React
  // mounts twice in development, and Quill is rebuilt with its text); a value
  // the field sent out itself doesn't.
  const cleared = useRef<{ quill: Quill; value: string } | undefined>(undefined);
  useLayoutEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const sameEditor = quill === cleared.current?.quill;
    if (sameEditor && (value === cleared.current?.value || value === sent?.html)) return;
    cleared.current = { quill, value };
    historyOf(quill).clear();
    refreshUndo(quill);
  });

  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const refresh = () => refreshUndo(quill);
    quill.on("text-change", refresh);
    return () => {
      quill.off("text-change", refresh);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    replaceContents: (html) => {
      const quill = quillRef.current?.getEditor();
      if (!quill) return;
      historyOf(quill).cutoff();
      quill.setContents(quill.clipboard.convert({ html }), "api");
      quill.setSelection(quill.getLength(), 0, "api");
    },
  }));

  const acceptSuggestion = useRef(onAcceptSuggestion);
  useEffect(() => {
    acceptSuggestion.current = onAcceptSuggestion;
  });
  // Ahead of Quill's own Tab binding, which types a tab.
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    quill.keyboard.addBinding({ key: "Tab" }, () => {
      if (!acceptSuggestion.current || quill.getLength() > 1) return true;
      acceptSuggestion.current();
      return false;
    });
    const tab = quill.keyboard.bindings.Tab;
    tab.unshift(tab.pop()!);
  }, []);
  const [linkDialog, setLinkDialog] = useState<
    { index: number; length: number; text: string; url: string; existing: boolean } | undefined
  >(undefined);

  // Quill's own inline "Enter link" tooltip is replaced with a dialog. The
  // modules object must stay stable, or Quill re-initializes on every render.
  const modules = useMemo(
    () => ({
      toolbar: {
        container: TOOLBAR,
        handlers: {
          undo: () => {
            const quill = quillRef.current?.getEditor();
            if (quill) historyOf(quill).undo();
          },
          redo: () => {
            const quill = quillRef.current?.getEditor();
            if (quill) historyOf(quill).redo();
          },
          link: () => {
            const quill = quillRef.current?.getEditor();
            if (!quill) return;
            let range = quill.getSelection(true);
            const [linkBlot, offset] = quill.scroll.descendant(
              (blot: { statics: { blotName: string } }) => blot.statics.blotName === "link",
              range.index,
            );
            if (linkBlot && range.length === 0) {
              range = { index: range.index - offset, length: linkBlot.length() };
            }
            const currentUrl = quill.getFormat(range).link;
            setLinkDialog({
              index: range.index,
              length: range.length,
              text: quill.getText(range.index, range.length),
              url: typeof currentUrl === "string" ? currentUrl : "",
              existing: typeof currentUrl === "string",
            });
          },
        },
      },
      clipboard: { matchVisual: false, matchers: [] },
    }),
    [],
  );

  // Mirrors Quill's own Clipboard.onPaste, with the pasted content linkified.
  // Overridden here rather than as a clipboard matcher, since Quill skips
  // matchers entirely for a plain-text paste (e.g. a URL from the address bar).
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const clipboard = quill.getModule("clipboard") as {
      convert: (data: { html?: string; text?: string }, formats: Record<string, unknown>) => DeltaStatic;
      onPaste: (range: { index: number; length: number }, data: { html?: string; text?: string }) => void;
    };
    clipboard.onPaste = (range, data) => {
      // A link at the caret would otherwise be applied to the pasted text,
      // hiding any URL in it from linkifyDelta.
      const formats = { ...quill.getFormat(range.index) };
      delete formats.link;
      const pasted = linkifyDelta(clipboard.convert(data, formats));
      const delta = new Delta().retain(range.index).delete(range.length).concat(pasted);
      quill.updateContents(delta, "user");
      quill.setSelection(delta.length() - range.length, 0, "silent");
      quill.scrollSelectionIntoView();
    };
  }, []);

  const handleLinkSave = () => {
    const quill = quillRef.current?.getEditor();
    if (!quill || !linkDialog) return;
    const url = withLinkProtocol(linkDialog.url.trim());
    const text = linkDialog.text || linkDialog.url.trim();
    const selectedText = quill.getText(linkDialog.index, linkDialog.length);
    if (linkDialog.length > 0 && text === selectedText) {
      quill.formatText(linkDialog.index, linkDialog.length, "link", url, "user");
    } else {
      quill.deleteText(linkDialog.index, linkDialog.length, "user");
      quill.insertText(linkDialog.index, text, "link", url, "user");
    }
    quill.setSelection(linkDialog.index + text.length, 0, "user");
    setLinkDialog(undefined);
  };

  const handleLinkRemove = () => {
    const quill = quillRef.current?.getEditor();
    if (!quill || !linkDialog) return;
    quill.formatText(linkDialog.index, linkDialog.length, "link", false, "user");
    setLinkDialog(undefined);
  };

  return (
    <Box
      sx={{
        "& .quill": {
          display: "flex",
          flexDirection: "column",
        },
        // Grows with content from minHeight, scrolls past maxHeight.
        "& .ql-container": {
          fontSize: "inherit",
          fontFamily: "inherit",
          border: "none",
          flex: 1,
          minHeight: suggestion ? 0 : minHeight,
          maxHeight: "55vh",
          display: "flex",
          flexDirection: "column",
        },
        "& .ql-editor": {
          flex: 1,
          overflow: "auto",
          minHeight: 0,
          padding: "12px 15px",
          overflowWrap: "break-word",
          color: palette.text.primary,
        },
        "& .ql-toolbar": {
          borderTop: "none",
          borderLeft: "none",
          borderRight: "none",
          borderBottom: `1px solid ${palette.divider}`,
          flexShrink: 0,
        },
        "& .ql-container.ql-snow, & .ql-toolbar.ql-snow": {
          border: "none",
        },
        "& .ql-toolbar.ql-snow": {
          borderBottom: `1px solid ${palette.divider}`,
        },
        // Quill's snow theme hardcodes dark-grey icons and placeholder,
        // which disappear on a dark background.
        "& .ql-snow .ql-stroke": { stroke: palette.text.primary },
        "& .ql-snow .ql-fill": { fill: palette.text.primary },
        "& .ql-snow .ql-picker": { color: palette.text.primary },
        "& .ql-snow button:hover .ql-stroke, & .ql-snow button.ql-active .ql-stroke": {
          stroke: palette.primary.main,
        },
        "& .ql-snow button:hover .ql-fill, & .ql-snow button.ql-active .ql-fill": {
          fill: palette.primary.main,
        },
        "& .ql-snow button:disabled": { opacity: 0.35, cursor: "default" },
        "& .ql-snow button:disabled:hover .ql-stroke": { stroke: palette.text.primary },
        "& .ql-snow button:disabled:hover .ql-fill": { fill: palette.text.primary },
        "& .ql-editor.ql-blank::before": { color: palette.text.primary, opacity: 0.6 },
        "& .ql-snow .ql-tooltip": { display: "none" },
        "& .ql-snow a": { color: palette.primary.main },
      }}
    >
      <Box sx={{ border: `1px solid ${palette.divider}`, borderRadius: 1 }}>
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={value === sent?.html ? sent.own : value}
          onChange={(html) => {
            const sanitized = sanitizeParHtml(addLinkProtocol(html));
            setSent({ html: sanitized, own: html });
            onChange(sanitized);
          }}
          placeholder={placeholder}
          modules={modules}
          formats={FORMATS}
          readOnly={disabled}
        />
        {suggestion && (
          // Clicking around the suggestion starts typing, as it would in the field.
          <Box
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest("button")) quillRef.current?.focus();
            }}
            sx={{ px: "15px", pb: 1.5 }}
          >
            {suggestion}
          </Box>
        )}
      </Box>

      <Dialog open={Boolean(linkDialog)} onClose={() => setLinkDialog(undefined)} maxWidth="xs" fullWidth>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (linkDialog?.url.trim()) handleLinkSave();
          }}
        >
          <DialogTitle>{linkDialog?.existing ? "Edit Link" : "Insert Link"}</DialogTitle>
          <DialogContent>
            <Stack spacing={2}>
              <Box>
                <Typography component="label" htmlFor="par-link-text" variant="body2" color="text.secondary">
                  Text to display
                </Typography>
                <TextField
                  id="par-link-text"
                  size="small"
                  placeholder="Link text"
                  value={linkDialog?.text ?? ""}
                  onChange={(e) => setLinkDialog((d) => d && { ...d, text: e.target.value })}
                  fullWidth
                  sx={{ mt: 0.5 }}
                />
              </Box>
              <Box>
                <Typography component="label" htmlFor="par-link-url" variant="body2" color="text.secondary">
                  URL
                </Typography>
                <TextField
                  id="par-link-url"
                  size="small"
                  placeholder="https://example.com"
                  value={linkDialog?.url ?? ""}
                  onChange={(e) => setLinkDialog((d) => d && { ...d, url: e.target.value })}
                  autoFocus
                  fullWidth
                  sx={{ mt: 0.5 }}
                />
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            {linkDialog?.existing && (
              <Button color="error" onClick={handleLinkRemove} sx={{ mr: "auto" }}>
                Remove
              </Button>
            )}
            <Button onClick={() => setLinkDialog(undefined)}>Cancel</Button>
            <Button variant="contained" type="submit" disabled={!linkDialog?.url.trim()}>
              Save
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
