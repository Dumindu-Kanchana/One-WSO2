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

import type { MouseEvent } from "react";
import { Box, ButtonBase, Stack, Tooltip, Typography, alpha } from "@wso2/oxygen-ui";
import { SparklesIcon } from "@wso2/oxygen-ui-icons-react";
import { formatOffset } from "../../api/salesTypes";
import type { CoverageLevel, DealLetterState, EvidenceQuote, LetterKey } from "../types";
import { COVERAGE_LABELS, DEAL_STATE_LABELS, LETTERS } from "../util/meddpiccFormat";

type Tone = "filled" | "partial" | "suggested" | "empty";

interface CommonProps {
  /** Clicking a circle filters by that Letter. Without it the circles are display-only. */
  onLetterClick?: (letter: LetterKey) => void;
  /** The Letter currently filtered on, drawn with a ring. */
  selected?: LetterKey | null;
  size?: "small" | "medium";
  /** Names the group for assistive tech, e.g. "MEDDPICC coverage for <meeting>". */
  label?: string;
}

interface CoverageProps extends CommonProps {
  variant: "coverage";
  /** Null when the call has not been analysed yet: every circle is empty. */
  values: Record<LetterKey, CoverageLevel> | null;
  /** Up to two per Letter, shown on hover. */
  quotes?: Partial<Record<LetterKey, EvidenceQuote[]>>;
}

interface DealStateProps extends CommonProps {
  variant: "dealState";
  values: Record<LetterKey, DealLetterState>;
}

export type MeddpiccCirclesProps = CoverageProps | DealStateProps;

function toneAndText(props: MeddpiccCirclesProps, letter: LetterKey): { tone: Tone; text: string } {
  if (props.variant === "coverage") {
    if (!props.values) return { tone: "empty", text: "not analysed yet" };
    const level = props.values[letter] ?? 0;
    return { tone: level === 2 ? "filled" : level === 1 ? "partial" : "empty", text: COVERAGE_LABELS[level] };
  }
  const state = props.values[letter] ?? "EMPTY";
  return {
    tone: state === "FILLED" ? "filled" : state === "SUGGESTED" ? "suggested" : "empty",
    text: DEAL_STATE_LABELS[state],
  };
}

/**
 * The eight MEDDPICC circles, M E D D P I C C.
 *
 * Two readings of the same row, chosen by `variant`:
 *   coverage   — how much one call dealt with each Letter: none / mentioned
 *                (light) / answered (dark).
 *   dealState  — where the Opportunity stands: empty / AI-suggested (outlined,
 *                with a sparkle) / filled in Salesforce (dark).
 *
 * The state is never carried by colour alone: every circle has a label saying
 * which Letter it is and what state it's in, and the suggested state also
 * differs in shape (outline and sparkle), not just shade.
 */
export default function MeddpiccCircles(props: MeddpiccCirclesProps) {
  const { onLetterClick, selected = null, size = "small", label } = props;
  const diameter = size === "small" ? 20 : 26;
  const groupLabel =
    label ?? (props.variant === "coverage" ? "MEDDPICC coverage" : "MEDDPICC deal state");

  return (
    <Stack direction="row" spacing={0.5} role="group" aria-label={groupLabel} sx={{ alignItems: "center" }}>
      {LETTERS.map((letter) => {
        const { tone, text } = toneAndText(props, letter.key);
        const quotes = props.variant === "coverage" ? (props.quotes?.[letter.key] ?? []).slice(0, 2) : [];
        const ariaLabel = `${letter.label}: ${text}`;
        const isSelected = selected === letter.key;

        const circle = (
          <Box
            aria-hidden="true"
            sx={(theme) => {
              const main = theme.palette.primary.main;
              return {
                position: "relative",
                width: diameter,
                height: diameter,
                borderRadius: "50%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: size === "small" ? 10.5 : 12.5,
                fontWeight: 700,
                lineHeight: 1,
                boxSizing: "border-box",
                ...(tone === "filled" && { bgcolor: main, color: theme.palette.primary.contrastText }),
                ...(tone === "partial" && { bgcolor: alpha(main, 0.2), color: main }),
                ...(tone === "suggested" && { border: `1.5px solid ${main}`, color: main }),
                ...(tone === "empty" && {
                  border: `1px solid ${theme.palette.divider}`,
                  color: theme.palette.text.disabled,
                }),
                ...(isSelected && { outline: `2px solid ${main}`, outlineOffset: 2 }),
              };
            }}
          >
            {letter.short}
            {tone === "suggested" && (
              <Box
                component="span"
                sx={{
                  position: "absolute",
                  top: -5,
                  right: -5,
                  display: "inline-flex",
                  color: "warning.main",
                  bgcolor: "background.paper",
                  borderRadius: "50%",
                }}
              >
                <SparklesIcon size={size === "small" ? 10 : 12} />
              </Box>
            )}
          </Box>
        );

        const tooltip = (
          <Box sx={{ maxWidth: 280 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, display: "block" }}>
              {letter.label}
            </Typography>
            <Typography variant="caption" sx={{ display: "block" }}>
              {text.charAt(0).toUpperCase() + text.slice(1)}
            </Typography>
            {quotes.map((q, i) => (
              <Typography key={i} variant="caption" sx={{ display: "block", mt: 0.75, fontStyle: "italic" }}>
                “{q.quote}” — {q.speaker}, {formatOffset(q.offsetSeconds)}
              </Typography>
            ))}
          </Box>
        );

        return (
          // describeChild: the tooltip DESCRIBES the circle. Without it MUI labels the
          // circle by the tooltip while it is open, replacing "Champion: answered"
          // with whatever quotes the tooltip holds.
          <Tooltip key={letter.key} title={tooltip} arrow describeChild>
            {onLetterClick ? (
              <ButtonBase
                aria-label={ariaLabel}
                aria-pressed={isSelected}
                onClick={(event: MouseEvent) => {
                  // Circles sit inside clickable rows; the circle's click is its own.
                  event.stopPropagation();
                  onLetterClick(letter.key);
                }}
                sx={{ borderRadius: "50%", "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 } }}
              >
                {circle}
              </ButtonBase>
            ) : (
              <Box component="span" role="img" aria-label={ariaLabel} sx={{ display: "inline-flex" }}>
                {circle}
              </Box>
            )}
          </Tooltip>
        );
      })}
    </Stack>
  );
}
