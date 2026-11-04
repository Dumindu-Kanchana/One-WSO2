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

import { DEMO_PERSPECTIVE_KEYS, isParOnlyDemo } from "@config/parOnlyDemo";
import { useEffect, useRef, type JSX } from "react";
import { Box, IconButton, Paper, Tooltip, Typography } from "@wso2/oxygen-ui";
// Oxygen 0.6.0 re-exports neither of these (checked against its dist), and
// @mui/material is already a direct dependency that the theme files import from.
import ClickAwayListener from "@mui/material/ClickAwayListener";
import Popper from "@mui/material/Popper";
import { ArrowUpRightIcon, StarIcon } from "@wso2/oxygen-ui-icons-react";
import { useNavigate } from "react-router";
import {
  FUNCTIONAL_PERSPECTIVES,
  PERSPECTIVES,
  type PerspectiveDef,
} from "@constants/perspectives";
import { useActivePerspective } from "@context/perspective/PerspectiveContext";
import { perspectiveHue } from "@config/perspectiveHues";
import { appMark } from "@components/app-marks/appMarkRegistry";
import { useFavourites } from "@features/favourites/useFavourites";

interface WaffleOverlayProps {
  /** The launcher button. The panel hangs off it and closes back onto it. */
  anchorEl: HTMLElement;
  onClose: () => void;
}

// The app switcher: a panel hanging off the launcher button, with favourites
// above the full set of apps. Unbuilt tiles
// render grayscaled and don't navigate; a tile for an app that lives in another
// application opens it in a new tab and says so with a corner badge.
//
// Deliberately NOT modal, which is the whole point of the `Popper`. A launcher
// is a place you glance at, so the page behind it stays scrollable and
// clickable and nothing is dimmed. That trade is real and worth naming: a modal
// would give focus containment and hide the background from assistive tech for
// free, and this gives up both. What replaces them:
//
//  - Escape closes, and a click outside closes (ClickAwayListener).
//  - Focus moves into the panel on open and returns to the button on close.
//  - Tab is free to leave the panel, which is correct here — trapping focus in
//    a surface the user can click straight past would strand them.
//  - `role="dialog"` WITHOUT `aria-modal`. Claiming aria-modal on a non-modal
//    surface tells a screen reader the rest of the page is inert when it isn't.
export default function WaffleOverlay({ anchorEl, onClose }: WaffleOverlayProps): JSX.Element {
  const navigate = useNavigate();
  const active = useActivePerspective();
  const panelRef = useRef<HTMLDivElement>(null);
  // Read through a ref inside the mount effect below. The parent passes an
  // inline arrow, so `onClose` has a new identity on every one of its renders —
  // as a dependency it would tear down and re-run the effect mid-open, which
  // restores focus to the button and then re-focuses the panel, throwing away
  // whichever tile the user had tabbed to.
  const onCloseRef = useRef(onClose);
  // Synced in an effect, not assigned during render: writing to a ref while
  // rendering is unsafe under the React compiler (and flagged by its lint rule),
  // because a render can be discarded or replayed.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const { favourites, isFavourite, toggle } = useFavourites();

  // Resolved through the registry rather than stored: the saved list is keys, so
  // a renamed or relocated perspective needs no migration.
  const favouriteItems = favourites
    .map((key) => PERSPECTIVES.find((p) => p.key === key))
    .filter((p): p is PerspectiveDef => p !== undefined)
    // DEMO ONLY: the PAR-only demo offers Me and People Ops alone.
    .filter((p) => !isParOnlyDemo() || DEMO_PERSPECTIVE_KEYS.has(p.key));
  const apps = isParOnlyDemo()
    ? FUNCTIONAL_PERSPECTIVES.filter((p) => DEMO_PERSPECTIVE_KEYS.has(p.key))
    : FUNCTIONAL_PERSPECTIVES;

  useEffect(() => {
    // Captured at setup, not read in the cleanup: by teardown the ref may
    // already be detached, which would silently skip the focus restore below.
    const panel = panelRef.current;
    // Focus the panel rather than the first tile: landing on "People Ops"
    // would read as though it were selected.
    panel?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      // Only pull focus back if it is still inside the panel. If the user
      // clicked into the page behind, yanking focus to the button would undo
      // the very interaction this panel exists to allow.
      if (panel?.contains(document.activeElement)) {
        anchorEl.focus();
      }
    };
    // Deliberately excludes `onClose` — see onCloseRef above. This effect is
    // about mounting and unmounting, so it should run exactly twice.
  }, [anchorEl]);

  const pick = (p: PerspectiveDef) => {
    if (!p.access) return;
    // A separate application. The tile is a real anchor carrying the URL,
    // `target="_blank"` and `rel="noopener noreferrer"`, so the BROWSER opens
    // the tab — opening one here as well opened CSM twice on every click, and
    // on a ctrl-click too, since that fires onClick as well as navigating.
    // All this has left to do is get the launcher out of the way.
    if (p.externalUrl) {
      onClose();
      return;
    }
    if (!p.path) return;
    navigate(p.path);
    onClose();
  };

  return (
    <ClickAwayListener
      onClickAway={(event) => {
        // The button owns its own toggle. Without this, clicking it while open
        // would close here and immediately reopen there.
        if (anchorEl.contains(event.target as Node)) return;
        onClose();
      }}
    >
      <Popper
        open
        anchorEl={anchorEl}
        placement="bottom-start"
        // Keep it beside the button rather than sliding along the viewport, and
        // let it flip above if the window is short.
        modifiers={[
          { name: "offset", options: { offset: [0, 8] } },
          { name: "preventOverflow", options: { padding: 8 } },
        ]}
        sx={{ zIndex: (theme) => theme.zIndex.modal }}
      >
        {/* Opaque underlay, and load-bearing. Some themes give every Paper a
            translucent fill — `background.paper` is literally "#ffffffe1" under
            Acrylic Purple — which is right for a card resting on the canvas and
            wrong for a panel floating over arbitrary content: page text shows
            through the tiles. It also breaks a guarantee, because the tile
            washes in perspectiveHues.ts are measured against an opaque surface.
            Compositing the paper over `background.default`, which is opaque in
            every shipped theme, keeps the intended tint without the bleed. */}
        <Box
          sx={{
            bgcolor: "background.default",
            borderRadius: 2,
            overflow: "hidden",
            boxShadow: 8,
          }}
        >
          <Paper
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-label="All apps"
            elevation={0}
            sx={{
              width: 336,
              maxWidth: "calc(100vw - 16px)",
              p: 1.5,
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              backgroundImage: "none",
              "&:focus": { outline: "none" },
            }}
          >
            {/* Only when it has content: an empty "Favourites" heading would be
                a permanent invitation with nothing under it. Apps appear here as
                well as in their own group below, which is what makes a shortcut
                a shortcut. */}
            {favouriteItems.length > 0 && (
              <>
                <Typography variant="overline" color="text.secondary" component="h2">
                  Favourites
                </Typography>
                <WaffleGroup
                  items={favouriteItems}
                  activeKey={active.key}
                  onPick={pick}
                  isFavourite={isFavourite}
                  onToggleFavourite={toggle}
                />
              </>
            )}

            <Typography
              variant="overline"
              color="text.secondary"
              component="h2"
              sx={favouriteItems.length > 0 ? { display: "block", mt: 1.5 } : undefined}
            >
              Apps
            </Typography>
            <WaffleGroup
              items={apps}
              activeKey={active.key}
              onPick={pick}
              isFavourite={isFavourite}
              onToggleFavourite={toggle}
            />

          </Paper>
        </Box>
      </Popper>
    </ClickAwayListener>
  );
}

interface WaffleGroupProps {
  items: readonly PerspectiveDef[];
  activeKey: string;
  onPick: (p: PerspectiveDef) => void;
  isFavourite: (key: string) => boolean;
  onToggleFavourite: (key: string) => void;
}

function WaffleGroup({
  items,
  activeKey,
  onPick,
  isFavourite,
  onToggleFavourite,
}: WaffleGroupProps): JSX.Element {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 1,
        mt: 1,
      }}
    >
      {items.map((p) => {
        const isActive = p.key === activeKey;
        // Undefined for a perspective with no hue yet, which degrades to the
        // neutral treatment rather than breaking the grid.
        const tint = perspectiveHue(p.key);
        // A filled two-tone mark where one exists; otherwise the line glyph on
        // the hue wash. Both paths stay live: a new perspective gets a working
        // tile before anyone draws it a mark.
        const Mark = appMark(p.key);
        const isExternal = Boolean(p.access && p.externalUrl);
        const tile = (
          <Box
            // A real anchor when it leaves the app, so middle-click and
            // ctrl-click open a tab the way they do everywhere else. onClick
            // stays on it to close the launcher.
            component={isExternal ? "a" : "button"}
            {...(isExternal
              ? { href: p.externalUrl, target: "_blank", rel: "noopener noreferrer" }
              : { type: "button" })}
            onClick={() => onPick(p)}
            disabled={!p.access}
            aria-label={
              isExternal
                ? `Open ${p.label} in a new tab`
                : p.access
                  ? `Switch to ${p.label}`
                  : `${p.label} — not available yet`
            }
            aria-current={isActive ? "page" : undefined}
            sx={{
              all: "unset",
              boxSizing: "border-box",
              // `all: unset` leaves the button shrink-to-fit, so without an
              // explicit width every tile sized to its own label — measured
              // 38.7px for "CSM" against 90.6px for "Marketing Ops" — and
              // `aspectRatio` then derived a different height for each.
              width: "100%",
              borderRadius: 1.5,
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: 0.75,
              px: 0.75,
              py: 1,
              textAlign: "center",
              color: "text.primary",
              // No border and no fill on the tile itself: the coloured badge below
              // is the object, and a grid of outlined boxes reads as a form rather
              // than a set of apps.
              cursor: p.access ? "pointer" : "not-allowed",
              transition: "background-color .15s",
              "&:hover:not(:disabled)": { bgcolor: "action.hover" },
              "&:focus-visible": {
                outline: 2,
                outlineStyle: "solid",
                outlineColor: "primary.main",
                outlineOffset: 2,
              },
              // Locked tiles desaturate rather than fade. `opacity` composites the
              // glyph and its wash toward the page together, which measured 1.82:1
              // and fails WCAG 1.4.11; removing the hue holds at 4.63:1.
              ...(p.access ? {} : { filter: "grayscale(1) contrast(0.9)" }),
            }}
          >
            {/* Marks a tile that leaves One WSO2, in the corner a tile badge
                belongs in. Absolutely positioned, so it adds no flex child and
                every tile keeps identical internal geometry — the same reason
                the label always occupies two lines whether or not it wraps.
                aria-hidden because the tile's own label already says "in a new
                tab"; the glyph is there for the eye scanning the grid. */}
            {isExternal && (
              <ArrowUpRightIcon
                size={11}
                aria-hidden
                style={{ position: "absolute", top: 6, right: 6 }}
              />
            )}
            {/* Every tile must have identical internal geometry, or the badges
                sit at different heights across the grid. Three rules do that:
                the badge never shrinks; the label always occupies exactly two
                lines whether or not it wraps ("Leave" vs "Marketing Ops"); and
                the badge above is taken out of flow so a tile carrying one
                doesn't have an extra flex child to centre around. */}
            <Box
              sx={(theme) => ({
                width: 48,
                height: 48,
                flexShrink: 0,
                borderRadius: "30%",
                display: "grid",
                placeItems: "center",
                // A mark carries its own colour and silhouette, so it needs no
                // wash behind it — the wash existed to give a line glyph the mass
                // a filled icon has on its own. Perspectives without a mark keep
                // the wash: the rounded container is what makes a line glyph read
                // as an app icon rather than a toolbar button.
                ...(Mark
                  ? { bgcolor: "transparent" }
                  : {
                      bgcolor: tint?.light.bg ?? "action.hover",
                      color: tint?.light.fg ?? "text.primary",
                      ...theme.applyStyles("dark", {
                        bgcolor: tint?.dark.bg ?? theme.palette.action.hover,
                        color: tint?.dark.fg ?? theme.palette.text.primary,
                      }),
                    }),
                // Selection is a neutral ring, never the brand accent: an orange
                // ring around Me's orange wash measures 3.00:1 and disappears.
                // Ink against the washes holds at 12.9-14.5:1.
                ...(isActive && {
                  outline: "2px solid",
                  outlineColor: "text.primary",
                  outlineOffset: 2,
                }),
              })}
            >
              {Mark ? <Mark size={48} /> : <p.icon size={24} />}
            </Box>
            <Typography
              variant="caption"
              sx={{
                fontWeight: isActive ? 600 : 400,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                lineHeight: 1.25,
                height: "2.5em",
                width: "100%",
              }}
            >
              {p.label}
            </Typography>
          </Box>
        );

        // The star is a SIBLING of the tile, not a child: the tile is itself a
        // <button>, and nesting one button inside another is invalid HTML that
        // browsers resolve unpredictably. The wrapper positions it instead.
        //
        // Shown on hover or keyboard focus, and always while favourited — so the
        // current favourites are readable without hunting for them, while the
        // control stays out of the way otherwise.
        const starred = isFavourite(p.key);
        const star = (
          <Tooltip title={starred ? `Remove ${p.label} from favourites` : `Add ${p.label} to favourites`}>
            <IconButton
              size="small"
              aria-label={
                starred ? `Remove ${p.label} from favourites` : `Add ${p.label} to favourites`
              }
              aria-pressed={starred}
              // Only a favourited tile's star is unconditionally visible (see the
              // opacity rules below), so the tour anchors to one of those. Me is a
              // default favourite, so there is always at least one.
              data-tour={starred ? "favourite" : undefined}
              onClick={() => onToggleFavourite(p.key)}
              sx={{
                position: "absolute",
                top: 0,
                right: 0,
                p: 0.25,
                color: starred ? "warning.main" : "text.secondary",
                transition: "opacity .12s",
                // Reveal-on-hover only where hovering exists. Two problems
                // otherwise: `opacity: 0` still takes taps, so on a touch screen
                // the top-right corner of a tile toggles the favourite instead
                // of opening the app; and if that corner is made inert instead,
                // a touch user can never favourite anything at all. So the
                // control is permanently visible without hover, and hidden —
                // properly, pointer events included — with it.
                opacity: 1,
                pointerEvents: "auto",
                "@media (hover: hover)": {
                  opacity: starred ? 1 : 0,
                  pointerEvents: starred ? "auto" : "none",
                  ".waffle-cell:hover &, &:focus-visible": {
                    opacity: 1,
                    pointerEvents: "auto",
                  },
                },
              }}
            >
              <StarIcon size={14} fill={starred ? "currentColor" : "none"} />
            </IconButton>
          </Tooltip>
        );

        // A disabled button emits no pointer events, so the tooltip needs a
        // wrapper to hang off.
        return p.access ? (
          <Box key={p.key} className="waffle-cell" sx={{ position: "relative" }}>
            {tile}
            {/* No star on an app that lives elsewhere: favourites and the
                landing page both resolve a perspective to a route, and this one
                has none — `reachablePerspectives` excludes it, so the toggle
                would appear to work and store nothing. The corner carries the
                outbound badge instead. */}
            {isExternal ? null : star}
          </Box>
        ) : (
          <Tooltip key={p.key} title={`${p.label} isn't available yet`}>
            {/* No star on a locked app: favouriting something you cannot open
                would be a shortcut to a dead end. */}
            <Box sx={{ display: "block" }}>{tile}</Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}
