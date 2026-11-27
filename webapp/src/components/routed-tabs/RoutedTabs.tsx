/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { Link, useLocation } from "react-router";
import { Box, Chip, Skeleton, Tab, Tabs } from "@wso2/oxygen-ui";
import type { ScreenBadge } from "@components/screen-badge/screenBadge";
import ScreenBadgeLabel from "@components/screen-badge/ScreenBadgeLabel";
import { SCREEN_BADGE_SKELETON_SX, screenBadgePillSx } from "@components/screen-badge/screenBadgeSx";

// A tab bar whose tabs are links, so which tab is open lives in the URL rather
// than in component state. That makes a tab linkable, survivable across a
// refresh, and reachable with the back button — none of which `useState` tabs
// can do.
//
// The component only draws the bar. The tab bodies are nested routes rendered
// through an <Outlet />, which is what keeps each one gated at the route rather
// than merely hidden from the bar.

export interface RoutedTabDef {
  /** URL segment under `basePath`, and the tab's identity. Empty for an index tab at `basePath` itself. */
  segment: string;
  label: string;
  /** A badge drawn beside the label. */
  badge?: ScreenBadge;
  /** The badge is still loading: a placeholder holds its place until `badge` is set. */
  badgeLoading?: boolean;
}

/** A tab bar whose tabs link to routes under `basePath`, with the current route's tab selected. */
export default function RoutedTabs({
  basePath,
  tabs,
  ariaLabel,
  scrollable = false,
  keepSearchParams,
}: {
  basePath: string;
  tabs: readonly RoutedTabDef[];
  ariaLabel: string;
  /** One row that scrolls sideways when the labels do not fit. */
  scrollable?: boolean;
  /**
   * Query parameters to carry into every tab's link, for tabs that are views of
   * the same data (`["month"]` lets `?month=` survive a switch). Only the named
   * parameters are kept, so a filter set on one tab does not silently filter
   * the next. Off by default: a tab's own query parameters usually mean
   * nothing to its neighbours.
   */
  keepSearchParams?: readonly string[];
}) {
  const { pathname, search } = useLocation();

  // Match on the segment that follows basePath rather than on the whole path,
  // so a deeper URL (a future detail route under a tab) keeps its tab lit.
  const rest = pathname.startsWith(basePath) ? pathname.slice(basePath.length) : "";
  const current = rest.replace(/^\//, "").split("/")[0];
  const active = tabs.find((t) => t.segment === current);

  // An unrecognised segment leaves every tab unlit rather than lighting the
  // wrong one. The route itself decides what to render in that case.
  if (tabs.length === 0) return null;

  const kept = keptSearch(search, keepSearchParams);

  return (
    <Tabs
      value={active ? active.segment : false}
      aria-label={ariaLabel}
      variant={scrollable ? "scrollable" : "standard"}
      scrollButtons={scrollable ? "auto" : undefined}
      allowScrollButtonsMobile={scrollable}
      sx={{
        mb: 2,
        minWidth: 0,
        maxWidth: "100%",
        minHeight: 36,
        "& .MuiTab-root": {
          minHeight: 36,
          textTransform: "none",
          fontSize: 13,
          fontWeight: 600,
        },
      }}
    >
      {tabs.map((t) => (
        <Tab
          key={t.segment}
          value={t.segment}
          label={t.badge || t.badgeLoading ? badgedLabel(t.label, t.badge) : t.label}
          component={Link}
          to={`${t.segment ? `${basePath}/${t.segment}` : basePath}${kept}`}
        />
      ))}
    </Tabs>
  );
}

/** A tab label with its badge beside it, or the badge's placeholder while it loads. */
function badgedLabel(label: string, badge: ScreenBadge | undefined) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
      {label}
      {badge ? (
        <Chip size="small" color="primary" sx={screenBadgePillSx(badge)} label={<ScreenBadgeLabel badge={badge} placement="top" />} />
      ) : (
        <Skeleton variant="rounded" sx={SCREEN_BADGE_SKELETON_SX} aria-hidden data-testid="tab-badge-loading" />
      )}
    </Box>
  );
}

// The query string holding only the named parameters (in their current order),
// with its leading "?", or "" when none of them is present.
function keptSearch(search: string, names: readonly string[] | undefined): string {
  if (!names || names.length === 0) return "";
  const current = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const [key, value] of current) {
    if (names.includes(key)) kept.append(key, value);
  }
  const query = kept.toString();
  return query ? `?${query}` : "";
}
