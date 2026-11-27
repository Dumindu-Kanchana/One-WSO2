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

import { useEffect, useId, useMemo, useRef, useState, type JSX, type KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import { Box, CircularProgress, InputAdornment, OutlinedInput, Paper, Typography } from "@wso2/oxygen-ui";
import { SearchIcon } from "@wso2/oxygen-ui-icons-react";
import { useEngagementSearch } from "../api/useEngagementApi";
import { useEngagementAccess, useEngagementUserInfo } from "../api/useEngagementUserInfo";
import type { SearchGroup, SearchItem, SearchKind } from "../api/engagementTypes";
import { engagementPaths } from "../engagementPaths";
import { canSearch, itemPath, SEARCH_LABEL, SEARCH_MIN_CHARS } from "../model/searchLinks";
import SearchHit from "./SearchHit";

const DEBOUNCE_MS = 250;
const PER_GROUP = 5;

/** Whether the keystroke is going into something the person is typing in. */
function typingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT";
}

/** The Engagement App's search box, for the header of every Finance screen: suggestions by kind of record as you type, "/" to focus, and a way on to the full results. */
export default function GlobalSearch(): JSX.Element | null {
  const access = useEngagementAccess();
  return canSearch(access) ? <SearchBox /> : null;
}

type Row = { readonly kind: SearchKind; readonly item: SearchItem } | "all";

function SearchBox(): JSX.Element {
  const navigate = useNavigate();
  const access = useEngagementAccess();
  const queues = useEngagementUserInfo().data?.workQueues;
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [typed, setTyped] = useState("");
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const t = setTimeout(() => setTyped(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || typingTarget(e.target)) return;
      e.preventDefault();
      input.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const wanted = text.trim().length >= SEARCH_MIN_CHARS;
  const settled = typed === text.trim();
  const search = useEngagementSearch(typed, PER_GROUP);
  const groups: readonly SearchGroup[] = useMemo(() => search.data?.groups ?? [], [search.data]);
  const failed = search.data?.failed ?? [];
  const rows: Row[] = useMemo(
    () => (settled && search.data && !search.isPlaceholderData ? [...groups.flatMap((g) => g.items.map((item) => ({ kind: g.kind, item }))), "all" as const] : []),
    [groups, settled, search.data, search.isPlaceholderData],
  );
  const loading = wanted && (!settled || search.isPending || search.isFetching) && !search.isError;

  useEffect(() => {
    document.getElementById(`${id}-opt-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [active, id]);

  const close = () => {
    setOpen(false);
    setActive(-1);
  };
  const showAll = () => {
    const q = text.trim();
    if (q.length < SEARCH_MIN_CHARS) return;
    close();
    input.current?.blur();
    navigate(engagementPaths.search(q));
  };
  const pick = (row: Row) => {
    if (row === "all") return showAll();
    close();
    setText("");
    input.current?.blur();
    navigate(itemPath(row.kind, row.item, access, queues));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!rows.length) return;
      e.preventDefault();
      setOpen(true);
      setActive((a) => (e.key === "ArrowDown" ? (a + 1) % rows.length : (a <= 0 ? rows.length : a) - 1));
    } else if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      const row = rows[active];
      if (row) pick(row);
      else showAll();
    }
  };

  const show = open && wanted;
  return (
    <Box
      sx={{ position: "relative", width: { xs: "100%", md: 300 } }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          close();
          setFocused(false);
        }
      }}
    >
      <OutlinedInput
        inputRef={input}
        size="small"
        fullWidth
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setFocused(true);
        }}
        onKeyDown={onKeyDown}
        placeholder="Search Engagement App"
        inputProps={{
          "aria-label": "Search Engagement App",
          role: "combobox",
          "aria-expanded": show,
          "aria-controls": `${id}-list`,
          "aria-autocomplete": "list",
          "aria-activedescendant": active >= 0 ? `${id}-opt-${active}` : undefined,
          autoComplete: "off",
        }}
        startAdornment={
          <InputAdornment position="start">
            <SearchIcon size={15} />
          </InputAdornment>
        }
        endAdornment={
          !focused && !text ? (
            <InputAdornment position="end">
              <Box
                component="kbd"
                aria-hidden
                sx={{ fontFamily: "inherit", fontSize: 11, lineHeight: 1, px: 0.75, py: 0.4, borderRadius: 0.75, border: 1, borderColor: "divider", color: "text.secondary" }}
              >
                /
              </Box>
            </InputAdornment>
          ) : null
        }
        sx={{ height: 36, fontSize: 13 }}
      />
      {show ? (
        <Paper
          elevation={8}
          id={`${id}-list`}
          role="listbox"
          aria-label="Search suggestions"
          // Keep the focus in the box when the list is clicked.
          onMouseDown={(e) => e.preventDefault()}
          sx={{ position: "absolute", top: "calc(100% + 4px)", right: 0, left: { xs: 0, md: "auto" }, width: { xs: "100%", md: 440 }, maxHeight: 460, overflowY: "auto", zIndex: (t) => t.zIndex.modal - 1, border: 1, borderColor: "divider", bgcolor: "background.default", backgroundImage: "none", backdropFilter: "none" }}
        >
          {loading ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.5 }}>
              <CircularProgress size={14} />
              <Typography variant="body2" color="text.secondary">
                Searching…
              </Typography>
            </Box>
          ) : search.isError ? (
            <Typography variant="body2" color="error" role="alert" sx={{ p: 1.5 }}>
              Couldn&apos;t search. Try again.
            </Typography>
          ) : (
            <>
              {groups.map((g, gi) => (
                <Box key={g.kind} role="group" aria-label={SEARCH_LABEL[g.kind]}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", px: 1.5, pt: 1.25, pb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", letterSpacing: 0.3 }}>
                      {SEARCH_LABEL[g.kind]}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {g.total}
                    </Typography>
                  </Box>
                  {g.items.map((item, ii) => {
                    const mine = groups.slice(0, gi).reduce((n, x) => n + x.items.length, 0) + ii;
                    return (
                      <Option key={item.id} id={`${id}-opt-${mine}`} active={active === mine} onHover={() => setActive(mine)} onPick={() => pick({ kind: g.kind, item })}>
                        <SearchHit kind={g.kind} item={item} />
                      </Option>
                    );
                  })}
                </Box>
              ))}
              {failed.map((k) => (
                <Typography key={k} variant="caption" color="warning.main" role="status" sx={{ display: "block", px: 1.5, py: 0.75 }}>
                  Couldn&apos;t search {SEARCH_LABEL[k]}
                </Typography>
              ))}
              {search.data && groups.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>
                  No matches
                </Typography>
              ) : null}
              {search.data ? (
                <Option id={`${id}-opt-${rows.length - 1}`} active={active === rows.length - 1} onHover={() => setActive(rows.length - 1)} onPick={() => pick("all")} divider>
                  <Typography color="primary" sx={{ fontSize: 13, fontWeight: 600 }}>
                    Show All Results
                  </Typography>
                </Option>
              ) : null}
            </>
          )}
        </Paper>
      ) : null}
    </Box>
  );
}

function Option({
  id,
  active,
  onHover,
  onPick,
  divider = false,
  children,
}: {
  readonly id: string;
  readonly active: boolean;
  readonly onHover: () => void;
  readonly onPick: () => void;
  readonly divider?: boolean;
  readonly children: React.ReactNode;
}): JSX.Element {
  return (
    <Box
      id={id}
      role="option"
      aria-selected={active}
      onMouseMove={onHover}
      onClick={onPick}
      sx={{ px: 1.5, py: 0.85, cursor: "pointer", bgcolor: active ? "action.hover" : undefined, ...(divider ? { borderTop: 1, borderColor: "divider", mt: 0.5 } : {}) }}
    >
      {children}
    </Box>
  );
}
