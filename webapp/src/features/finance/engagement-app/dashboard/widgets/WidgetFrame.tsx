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

import { useId, type JSX } from "react";
import { Box, Card, Typography } from "@wso2/oxygen-ui";
import { DownloadIcon, EyeOffIcon, PinIcon, PinOffIcon } from "@wso2/oxygen-ui-icons-react";
import { eaSurfaceSx } from "../../components/eaStyles";
import type { RowAction } from "../../components/EaTable";
import { RowMenu } from "../../components/RowActions";
import { Refreshing } from "../../components/EaSkeletons";
import { Failed } from "../../components/ListCard";
import { Calm } from "../dashboardParts";
import type { WidgetCtx, WidgetDef } from "./types";
import WidgetSkeleton from "./WidgetSkeletons";
import { widgetState } from "./widgetState";

/** A widget: a card with its title, note and menu, and below them its skeleton, its failure with Retry, its empty text, or its body. */
export default function WidgetFrame({
  def,
  ctx,
  pinned,
  exporting,
  onExport,
  onHide,
  onPin,
}: {
  def: WidgetDef;
  ctx: WidgetCtx;
  pinned: boolean;
  /** Whether this widget's CSV is being prepared. The grid holds it, so a change of layout does not forget it. */
  exporting: boolean;
  onExport: () => void;
  onHide: () => void;
  onPin: () => void;
}): JSX.Element {
  const titleId = useId();
  const state = widgetState(def, ctx);
  const heading = def.heading?.(ctx) ?? def.title;
  const note = typeof def.note === "function" ? def.note(ctx) : def.note;
  // A refetch (a new period or filter) keeps the previous figures, dimmed, until the new ones arrive. Allocations Today handles its own.
  const dim = def.source === "cost" && ctx.cost.query.isPlaceholderData;
  const items: RowAction[] = [
    { label: pinned ? "Unpin" : "Pin to Top", icon: pinned ? <PinOffIcon size={15} /> : <PinIcon size={15} />, onClick: onPin },
    { label: "Hide Widget", icon: <EyeOffIcon size={15} />, onClick: onHide },
    ...(def.csv
      ? [
          {
            label: exporting ? "Exporting…" : "Export CSV",
            icon: <DownloadIcon size={15} />,
            // A summary widget still showing the previous period would export the new one, so wait for its figures.
            disabled: exporting || (def.csv !== "transactions" && ctx.cost.query.isPlaceholderData),
            onClick: onExport,
          },
        ]
      : []),
  ];
  const Body = def.Component;
  const retry = () => (def.source === "cost" ? void ctx.cost.query.refetch() : ctx.retry(def.section));
  return (
    <Card variant="outlined" component="section" aria-labelledby={titleId} sx={[{ p: 2, minWidth: 0, height: "100%", boxSizing: "border-box" }, eaSurfaceSx]}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h2" id={titleId} sx={{ fontSize: 15.5, fontWeight: 600, letterSpacing: "-0.01em" }}>
            {heading}
          </Typography>
          {note ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {note}
            </Typography>
          ) : null}
        </Box>
        <RowMenu items={items} label={heading} />
      </Box>
      {state.kind === "loading" ? (
        <WidgetSkeleton id={def.id} />
      ) : state.kind === "failed" ? (
        <Failed what={heading} error={state.error ?? null} onRetry={retry} retrying={def.source === "cost" ? ctx.cost.query.isFetching : ctx.retrying} />
      ) : state.kind === "empty" ? (
        <Calm>{def.empty}</Calm>
      ) : (
        <Refreshing active={dim}>
          <Body ctx={ctx} />
        </Refreshing>
      )}
    </Card>
  );
}
