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

import type { JSX, ReactNode } from "react";
import { Box, LinearProgress, Skeleton, Typography } from "@wso2/oxygen-ui";
import EaTable, { type Column } from "./EaTable";
import { FactsCard, FactsGrid, type Fact } from "./Facts";
import { ListCard } from "./ListCard";
import { SKELETON_DELAY_MS, useAfterDelay } from "./useAfterDelay";

/** Facts whose values are still loading: the real labels, with a bar where each value will be. `two` names the values that take two lines. */
function loadingFacts(labels: readonly string[], two: readonly string[] = []): Fact[] {
  return labels.map((label, i) => ({
    label,
    value: (
      <>
        <Skeleton variant="text" width={`${55 + ((i * 17) % 35)}%`} />
        {two.includes(label) ? <Skeleton variant="text" width="40%" sx={{ fontSize: 12 }} /> : null}
      </>
    ),
  }));
}

interface FactsSkeletonProps {
  readonly labels: readonly string[];
  readonly two?: readonly string[];
  readonly columns?: 2 | 3 | 4;
}

/** A facts grid while its record loads, in the same grid as FactsGrid. */
export function FactsGridSkeleton({ labels, two, columns }: FactsSkeletonProps): JSX.Element {
  return <FactsGrid facts={loadingFacts(labels, two)} columns={columns} />;
}

/** A facts card while its record loads. */
export function FactsSkeleton({ labels, two, columns }: FactsSkeletonProps): JSX.Element {
  return <FactsCard facts={loadingFacts(labels, two)} columns={columns} />;
}

/** A table while its first rows load: the real headers over placeholder rows. */
export function TableSkeleton<T>({ columns, ariaLabel, rows }: { readonly columns: readonly Column<T>[]; readonly ariaLabel: string; readonly rows?: number }): JSX.Element {
  return <EaTable<T> ariaLabel={ariaLabel} columns={columns} rows={[]} rowKey={String} empty={null} loading loadingRows={rows} />;
}

/**
 * A detail page while its record loads, in the loaded layout: the facts card, `between` (what sits under it), then the tab bar with the
 * tabs known by now as text and `moreTabs` bars for those that depend on the record, over `children` (the open tab's skeleton).
 */
export function DetailSkeleton({
  facts,
  two,
  tabs,
  moreTabs = 0,
  between,
  children,
}: {
  readonly facts: readonly string[];
  readonly two?: readonly string[];
  readonly tabs: readonly string[];
  readonly moreTabs?: number;
  readonly between?: ReactNode;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <Box aria-busy="true">
      <FactsSkeleton labels={facts} two={two} />
      {between}
      <ListCard>
        <Box sx={{ display: "flex", alignItems: "center", gap: 4, px: 2, minHeight: 36, mb: 2, overflow: "hidden", whiteSpace: "nowrap" }}>
          {tabs.map((t) => (
            <Typography key={t} sx={{ fontSize: 13, fontWeight: 600, color: "text.secondary" }}>
              {t}
            </Typography>
          ))}
          {Array.from({ length: moreTabs }, (_, i) => (
            <Skeleton key={i} variant="text" width={90} sx={{ fontSize: 13, flexShrink: 0 }} aria-hidden />
          ))}
        </Box>
        {children}
      </ListCard>
    </Box>
  );
}

/**
 * Something on screen being fetched again (a new period or filter): the old content stays, dimmed, and a thin progress bar
 * appears over it if the answer takes a moment. Nothing moves, and the dimming says the figures are not the new ones yet.
 */
export function Refreshing({ active, delay = SKELETON_DELAY_MS, children }: { readonly active: boolean; readonly delay?: number; readonly children: ReactNode }): JSX.Element {
  const late = useAfterDelay(active, delay);
  return (
    <Box sx={{ position: "relative" }} aria-busy={active || undefined}>
      {late ? <LinearProgress aria-label="Loading" sx={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, zIndex: 1 }} /> : null}
      <Box sx={{ opacity: active ? 0.55 : 1, transition: "opacity 120ms" }}>{children}</Box>
    </Box>
  );
}

/**
 * Space for something still loading. Its children (the skeleton) appear only after the delay, and the box keeps
 * `minHeight` meanwhile, so nothing below moves when the data or the skeleton arrives.
 */
export function DelayedSkeleton({ minHeight, delay = SKELETON_DELAY_MS, children }: { readonly minHeight: number; readonly delay?: number; readonly children: ReactNode }): JSX.Element {
  const show = useAfterDelay(true, delay);
  return (
    <Box sx={{ minHeight }} aria-busy="true" aria-label="Loading">
      {show ? children : null}
    </Box>
  );
}
