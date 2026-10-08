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

// Shared model for the App → items menu used by persona perspectives
// (People Ops, Finance, …). Each perspective supplies its own registry of
// apps + top-level items; this module holds the generic shape + the
// capability gating both share.

// ---- capability / role model ----------------------------------------------
//
// The suite apps each use their own IAM role vocabulary
// (CANDIDATE / Intern / People-Ops-Team / FINANCE / EXTERNAL_USER / …),
// which don't all map onto one scheme. One WSO2 only knows the people-app
// privilege numbers returned in /user-info, so we collapse every app's
// roles onto these four One-WSO2 capabilities and gate each menu item on
// the capability that best matches its backing role.

import type { LucideIcon } from "@wso2/oxygen-ui-icons-react";

export type Capability = "employee" | "lead" | "serviceDesk" | "admin";

// people-app privilege numbers (see people-app CLAUDE.md). One WSO2's
// /user-info proxies people-app, so these are the numbers we receive.
const PRIVILEGE = {
  EMPLOYEE: 987, // every authenticated user
  LEAD: 993,
  SERVICE_DESK: 991,
  ADMIN: 999,
} as const;

// Derive the caller's capability set from their /user-info privileges.
// "employee" is baseline — any authenticated user has it (privilege 987
// is granted to everyone), so the menu is never empty even before the
// full privileges array has loaded.
export function capabilitiesFromPrivileges(privileges: number[] | undefined): Set<Capability> {
  const caps = new Set<Capability>(["employee"]);
  const p = privileges ?? [];
  if (p.includes(PRIVILEGE.LEAD)) caps.add("lead");
  if (p.includes(PRIVILEGE.SERVICE_DESK)) caps.add("serviceDesk");
  if (p.includes(PRIVILEGE.ADMIN)) caps.add("admin");
  return caps;
}

// Human labels for the restriction chip shown on a persona's menu board.
export const CAPABILITY_LABEL: Record<Capability, string> = {
  employee: "Employee",
  lead: "Lead",
  serviceDesk: "Service Desk",
  admin: "Admin",
};

// ---- registry shape --------------------------------------------------------

export interface MenuAppItem {
  // Anchor id on the persona's canvas — the rail scrolls to this.
  id: string;
  label: string;
  // One-line description shown on the page card.
  desc: string;
  // Visible when the caller has ANY of these capabilities (OR semantics,
  // matching each app's allowRoles). Omitted = visible to everyone.
  requires?: Capability[];
  // When set, this item is a real route (the rail navigates to it) rather
  // than a scroll-anchor on the overview page.
  path?: string;
  // Drawn on the nested rail row. Omitted, the row is a plain label, which is
  // what every app but Download Stats wants.
  icon?: LucideIcon;
}

export interface MenuApp {
  key: string;
  name: string;
  // Rendered by the rail, the waffle, and the app-menu board. A Lucide icon
  // component from @wso2/oxygen-ui-icons-react — callers size it at the call
  // site (16 inline, 20 rail, 24 tile) rather than the registry deciding.
  icon: LucideIcon;
  purpose: string;
  items: MenuAppItem[];
  // Keep this app rendered as an expandable group in the rail even while it has
  // only ONE visible item, instead of collapsing to a leaf that jumps straight
  // there. For an app that is genuinely one screen (Menu → Home) collapsing is
  // right; for one that is about to grow, it teaches the wrong shape — the item
  // disappears as a concept, and reappears the day a second one lands.
  alwaysGroup?: boolean;
  // One rail row, named for the app, opening its first item. The items stay
  // on the section so a pin can still name each screen; the app's tab bar is
  // what offers them. Mutually exclusive with `alwaysGroup`.
  inTabs?: boolean;
}

// Items of an app the caller is allowed to see, given their capabilities.
export function visibleItems(app: MenuApp, caps: Set<Capability>): MenuAppItem[] {
  return app.items.filter((it) => itemAllowed(it, caps));
}

export function itemAllowed(item: MenuAppItem, caps: Set<Capability>): boolean {
  if (!item.requires || item.requires.length === 0) return true;
  return item.requires.some((r) => caps.has(r));
}
