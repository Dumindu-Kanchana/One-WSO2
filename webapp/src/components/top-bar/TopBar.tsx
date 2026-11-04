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

import { isParOnlyDemo } from "@config/parOnlyDemo";
import { useEffect, type JSX } from "react";
import {
  Box,
  ColorSchemeImage,
  ColorSchemeToggle,
  Header,
  IconButton,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { MenuIcon, SearchIcon } from "@wso2/oxygen-ui-icons-react";
import AppsGridIcon from "./AppsGridIcon";
import { Link as RouterLink } from "react-router";
import { landingPath } from "@config/landingConfig";
import PinnedTabs from "@features/pinned/components/PinnedTabs";
import PinThisPageButton from "@features/pinned/components/PinThisPageButton";
import { usePinnedEntries } from "@features/pinned/usePinned";
import ThemeSelect from "./ThemeSelect";
import UserProfileMenu from "./UserProfileMenu";

// The shortcut hint has to name a key the reader actually has: the handler
// below accepts Cmd *or* Ctrl, so a hardcoded "⌘K" misinforms every
// Windows and Linux user.
//
// `navigator.platform` is formally deprecated, and that is not a reason to
// replace it here: no engine intends to remove it (too much of the web reads
// it), while its stated successor `navigator.userAgentData` is unimplemented in
// Firefox and Safari and absent from TypeScript's DOM lib. A layered check
// would therefore fall through to this same call on two of three engines while
// costing an ambient type declaration. Read once — the platform cannot change
// at runtime. iPadOS reporting as Mac is correct rather than a bug: an iPad
// with a keyboard has a Cmd key.
const IS_APPLE_PLATFORM =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** No "+" in either form, matching the badge's compact style. */
const SHORTCUT_HINT = IS_APPLE_PLATFORM ? "⌘K" : "Ctrl K";

// Brand lockup sizing. Constrained by https://wso2.com/about/brand, which is
// stricter than it looks — check there before changing any of this:
//
//  - "Icon should not be isolated." The pulse mark may not be used apart from
//    the wordmark, so the full logo asset is the only option here — regardless
//    of what any other app does. (The favicon is the one exception, because a
//    ~16px square slot cannot hold a 2.5:1 lockup at all.)
//  - The logo "is strictly monochrome": black on light, white on dark. Orange
//    (#F14E23) is approved for the icon on DARK backgrounds only, so it can't be
//    used on this header, whose background is `background.paper`.
//  - The padding inside the SVG is not slack to be cropped out — it is the
//    mandated clear space ("4x padding"). Leave it alone.
//
// Sizing: the visible letters are half the height set here (artwork occupies
// y 163.7-490.6 of a 0-654.2 viewBox). "One" is one word of the two-word name,
// so it has to render at the same letter height as "WSO2" beside it — these two
// constants move together. Inter at weight 600 has a 0.7375x cap height,
// measured in a browser:
//
//   title px   cap height   logo px to match
//   18         13.27        26.5   <- Oxygen's own BrandTitle token
//   22         16.22        32.4   <- chosen; the pair scaled up for presence
//   24         17.70        35.4
//
// UNRESOLVED: the brand minimum for digital use is 180x72px, which at this
// aspect means a 72px-tall logo. The Oxygen toolbar is 56px (xs) / 64px (sm+),
// so no compliant-minimum logo fits. Needs a ruling from the brand owner on
// what applies to product chrome; every value here is below that minimum.
const BRAND_TITLE_PX = 22;
const BRAND_LOGO_PX = 32;

interface TopBarProps {
  collapsed: boolean;
  onToggleSidebar: () => void;
  /** Receives the button element, so the launcher can hang off it. */
  onToggleWaffle: (anchor: HTMLElement) => void;
  /** Whether the launcher is currently showing, for aria-expanded. */
  waffleOpen: boolean;
  onOpenAsk: () => void;
}

// The persistent top bar, on Oxygen's compound `Header`, in the order the
// component expects: Toggle → Brand → (switcher/search) → Spacer → Actions.
//
// Oxygen supplies the bar's height, background, border, and brand-title
// typography, so nothing here sets those. The rail-width-matching `width: 260`
// the old hand-rolled bar used is gone with it — Oxygen's Sidebar is 250/64 and
// the header no longer needs to align to it.
export default function TopBar({
  collapsed,
  onToggleSidebar,
  onToggleWaffle,
  waffleOpen,
  onOpenAsk,
}: TopBarProps): JSX.Element {
  // Only the count matters here — the strip itself renders the entries.
  const hasPinned = usePinnedEntries().length > 0;

  useEffect(() => {
    if (isParOnlyDemo()) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenAsk();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpenAsk]);

  return (
    <Header>
      {/* The hamburger in both states: Oxygen's default collapse icon carries a
          left arrow, and in this corner that reads as Back. */}
      <Header.Toggle
        collapsed={collapsed}
        onToggle={onToggleSidebar}
        expandIcon={<MenuIcon size={20} />}
        collapseIcon={<MenuIcon size={20} />}
      />

      <Header.Brand sx={{ flexShrink: 0 }}>
        {/* The lockup is the way home, as it is in every other product.
            Deliberately a real link rather than an onClick, so cmd-click and
            middle-click open a new tab the way a logo is expected to.
            `Header.Brand` is not polymorphic, so the link nests inside it and
            reproduces the flex row its children were relying on.

            It goes to the LANDING path, not a hardcoded /me: that honours the
            per-user setting on /settings, and still lands on Me for anyone who
            has not changed it. Sending someone to Me when they have chosen a
            different home would contradict their own preference.

            aria-label because the only text inside is "One" and the wordmark
            carries alt="" — on its own that is a thin name for a link. */}
        <Box
          component={RouterLink}
          to={landingPath()}
          aria-label="One WSO2 home"
          sx={{
            display: "flex",
            alignItems: "center",
            textDecoration: "none",
            color: "inherit",
            borderRadius: 1,
            "&:focus-visible": {
              outline: 2,
              outlineStyle: "solid",
              outlineColor: "primary.main",
              outlineOffset: 2,
            },
          }}
        >
          {/* Overrides Oxygen's 16→18px token, paired with BRAND_LOGO_PX above:
              "One" is one word of the name, so its size is set by the lockup
              rather than by the app-name token. */}
          <Header.BrandTitle sx={{ whiteSpace: "nowrap", fontSize: BRAND_TITLE_PX }}>
            One
          </Header.BrandTitle>
          {/* Negative margin so "One" and the WSO2 logo read as one lockup rather
              than two adjacent elements. */}
          <Header.BrandLogo sx={{ ml: "-4px" }}>
            {/* The full logo, monochrome per brand rules — black on light, white
                on dark. ColorSchemeImage picks the variant from the resolved
                colour scheme. alt="" because "One" beside it plus the wordmark
                already read as the product name. */}
            <ColorSchemeImage
              src={{ light: "/wso2-logo-black.svg", dark: "/wso2-logo-white.svg" }}
              alt=""
              height={BRAND_LOGO_PX}
              width="auto"
            />
          </Header.BrandLogo>
        </Box>
      </Header.Brand>

      {/* Palette trigger. A click target rather than a real input: the palette
          owns the query field.

          Fixed responsive widths rather than `flex: 1`, so the flexible slot
          belongs to PinnedTabs instead — the pinned strip is the part that
          benefits from spare room. It also narrows once anything is pinned,
          since the two share that row; at `xs` it collapses to an icon. */}
      {/* DEMO ONLY: the PAR-only demo has nothing for Ask Novera to search. */}
      {!isParOnlyDemo() && (
      <Box
        role="button"
        tabIndex={0}
        onClick={onOpenAsk}
        aria-label="Ask Novera"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenAsk();
          }
        }}
        sx={{
          flexShrink: 0,
          width: hasPinned
            ? { xs: 40, sm: 200, md: 260, lg: 320 }
            : { xs: 40, sm: 280, md: 400, lg: 520 },
          display: "flex",
          alignItems: "center",
          justifyContent: { xs: "center", sm: "flex-start" },
          gap: 1.25,
          bgcolor: "action.hover",
          border: 1,
          borderColor: "divider",
          borderRadius: 1.5,
          px: { xs: 0, sm: 1.75 },
          py: 0.75,
          color: "text.secondary",
          cursor: "text",
          transition: "border-color .15s, width .15s",
          "&:hover": { borderColor: "text.disabled" },
          "&:focus-visible": { outline: 2, outlineStyle: "solid", outlineColor: "primary.main" },
        }}
      >
        <SearchIcon size={16} style={{ flexShrink: 0 }} />
        {/* Names Novera deliberately: it is a committed part of the product, and
            the palette states plainly that the assistant is still coming rather
            than implying it already answers. */}
        <Typography variant="body2" noWrap sx={{ display: { xs: "none", sm: "block" } }}>
          Ask Novera
        </Typography>
        <Box
          sx={{
            ml: "auto",
            display: { xs: "none", md: "block" },
            bgcolor: "background.paper",
            border: 1,
            borderColor: "divider",
            borderRadius: 0.75,
            px: 0.75,
            flexShrink: 0,
          }}
        >
          <Typography variant="caption">{SHORTCUT_HINT}</Typography>
        </Box>
      </Box>
      )}

      {/* Takes the flexible middle slot, collapsing to a plain spacer when
          nothing is pinned. */}
      {isParOnlyDemo() ? <Box sx={{ flex: 1 }} /> : <PinnedTabs />}

      <Header.Actions>
        <Tooltip title="Switch app">
          <IconButton
            onClick={(e) => onToggleWaffle(e.currentTarget)}
            size="small"
            aria-label="Switch app"
            data-tour="app-menu"
            aria-haspopup="dialog"
            aria-expanded={waffleOpen}
          >
            <AppsGridIcon size={20} />
          </IconButton>
        </Tooltip>
        {!isParOnlyDemo() && <PinThisPageButton />}
        {/* Palette, then light/dark within it — two separate choices, both
            persisted, deliberately adjacent. The tour treats them as one thing,
            so the marker sits on a wrapper rather than on either control. */}
        <Box sx={{ display: "flex", alignItems: "center" }} data-tour="theme">
          <ThemeSelect />
          {/* Oxygen's own 3-state cycle: light → dark → system. */}
          <ColorSchemeToggle size="small" />
        </Box>
        <UserProfileMenu />
      </Header.Actions>
    </Header>
  );
}
