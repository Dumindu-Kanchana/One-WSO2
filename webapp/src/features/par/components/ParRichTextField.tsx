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

import { useEffect, useMemo, useRef, useState } from "react";
import ReactQuill, { type DeltaStatic } from "react-quill-new";
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

// Ports par-app's CustomRichTextField: same toolbar, same auto-expanding
// editor. `react-quill-new` in place of `react-quill` — the fork that
// supports React 19.
//
// Sanitize on write only, not on the controlled `value` — re-sanitizing it
// on every render (as the source does) double-decodes entities and is the
// classic trigger for Quill's caret-jump bug. decodeParComment already
// sanitizes once at the read boundary, so `value` is safe as-is here.
const TOOLBAR = [["bold", "italic", "underline"], [{ list: "ordered" }, { list: "bullet" }], [{ indent: "-1" }, { indent: "+1" }], ["link"], ["clean"]];
const FORMATS = ["bold", "italic", "underline", "list", "bullet", "indent", "link"];

export default function ParRichTextField({
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const theme = useTheme();
  // theme.palette holds the light scheme only; theme.vars follows the
  // light/dark switch.
  const palette = (theme.vars ?? theme).palette;
  const quillRef = useRef<ReactQuill>(null);
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
          border: `1px solid ${palette.divider}`,
          borderRadius: 1,
        },
        // Grows with content from minHeight, scrolls past maxHeight.
        "& .ql-container": {
          fontSize: "inherit",
          fontFamily: "inherit",
          border: "none",
          flex: 1,
          minHeight: "30vh",
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
        "& .ql-editor.ql-blank::before": { color: palette.text.primary, opacity: 0.6 },
        "& .ql-snow .ql-tooltip": { display: "none" },
        "& .ql-snow a": { color: palette.primary.main },
      }}
    >
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={(html) => onChange(sanitizeParHtml(addLinkProtocol(html)))}
        placeholder={placeholder}
        modules={modules}
        formats={FORMATS}
        readOnly={disabled}
      />

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
