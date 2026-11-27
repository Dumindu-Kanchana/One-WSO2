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

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import RoutedTabs, { type RoutedTabDef } from "./RoutedTabs";

/** Longer, in ms, than MUI waits before opening a tooltip on hover. */
const TOOLTIP_SETTLE_MS = 300;

const TABS: readonly RoutedTabDef[] = [
  { segment: "one", label: "One" },
  { segment: "two", label: "Two" },
];

function UrlProbe() {
  const { pathname, search } = useLocation();
  return <div data-testid="url">{pathname + search}</div>;
}

function renderTabs(
  url: string,
  props: { tabs?: readonly RoutedTabDef[]; keepSearchParams?: readonly string[] } = {},
) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <RoutedTabs
        basePath="/app"
        tabs={props.tabs ?? TABS}
        ariaLabel="Sections"
        keepSearchParams={props.keepSearchParams}
      />
      <UrlProbe />
    </MemoryRouter>,
  );
}

describe("without keepSearchParams (the default)", () => {
  it("links each tab to its bare path, dropping the query string", () => {
    renderTabs("/app/one?month=2026-11");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("href", "/app/two");
  });

  it("lights the tab the URL names", () => {
    renderTabs("/app/two?month=2026-11");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "false");
  });

  it("treats an empty list as off", () => {
    renderTabs("/app/one?month=2026-11", { keepSearchParams: [] });
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("href", "/app/two");
  });
});

describe("with keepSearchParams", () => {
  it("carries only the named parameters into every tab's link", () => {
    renderTabs("/app/one?bu=API&month=2026-11&region=Europe", { keepSearchParams: ["month"] });
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("href", "/app/one?month=2026-11");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("href", "/app/two?month=2026-11");
  });

  it("keeps the named parameters across a switch and drops the rest", async () => {
    renderTabs("/app/one?month=2026-11&show=email", { keepSearchParams: ["month"] });
    await userEvent.setup().click(screen.getByRole("tab", { name: "Two" }));
    expect(screen.getByTestId("url")).toHaveTextContent(/^\/app\/two\?month=2026-11$/);
  });

  it("adds nothing when none of the named parameters is present", () => {
    renderTabs("/app/one?bu=API", { keepSearchParams: ["month"] });
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("href", "/app/two");
  });
});

describe("an index tab (empty segment)", () => {
  const withIndex: readonly RoutedTabDef[] = [{ segment: "", label: "All" }, ...TABS];

  it("links to the base path itself, and is lit there", () => {
    renderTabs("/app?month=2026-11", { tabs: withIndex, keepSearchParams: ["month"] });
    const all = screen.getByRole("tab", { name: "All" });
    expect(all).toHaveAttribute("href", "/app?month=2026-11");
    expect(all).toHaveAttribute("aria-selected", "true");
  });
});

describe("RoutedTabs badges", () => {
  it("shows a tab's badge beside its label, with its reason for screen readers", () => {
    renderTabs("/app/one", {
      tabs: [
        { segment: "one", label: "One" },
        { segment: "two", label: "Two", badge: { label: "Set up", reason: "A rule needs setting up." } },
      ],
    });

    const tab = screen.getByRole("tab", { name: "Two Set up A rule needs setting up." });
    expect(within(tab).getByText("Set up")).toBeTruthy();
  });

  it("shows a badge without a reason with no hover text", async () => {
    renderTabs("/app/one", { tabs: [{ segment: "one", label: "One", badge: { label: "5" } }] });
    await userEvent.hover(screen.getByText("5"));
    // Past MUI's delay before a tooltip opens, so an absent tooltip means there is none.
    await new Promise((resolve) => setTimeout(resolve, TOOLTIP_SETTLE_MS));

    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByRole("tab", { name: "One 5" })).toBeTruthy();
  });

  it("leaves a tab without a badge as its label alone", () => {
    renderTabs("/app/one", { tabs: [{ segment: "one", label: "One" }] });
    expect(screen.getByRole("tab", { name: "One" })).toBeTruthy();
  });
});

describe("with a badge", () => {
  it("holds the badge's place with a placeholder while it loads, and keeps the label", () => {
    renderTabs("/app/one", { tabs: [{ segment: "one", label: "One", badgeLoading: true }, { segment: "two", label: "Two" }] });
    const one = screen.getByRole("tab", { name: "One" });
    expect(within(one).getByTestId("tab-badge-loading")).toBeInTheDocument();
    expect(within(screen.getByRole("tab", { name: "Two" })).queryByTestId("tab-badge-loading")).toBeNull();
  });

  it("draws the badge, not the placeholder, once it is known", () => {
    renderTabs("/app/one", { tabs: [{ segment: "one", label: "One", badge: { label: "3", reason: "3 rows" }, badgeLoading: true }] });
    const one = screen.getByRole("tab", { name: /One/ });
    expect(within(one).getByText("3")).toBeInTheDocument();
    expect(within(one).queryByTestId("tab-badge-loading")).toBeNull();
  });
});
