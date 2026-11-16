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

import { Chip, type SxProps, type Theme } from "@wso2/oxygen-ui";
import { formatShortDate } from "../util/parDate";
import { daysLeft, daysLeftLabel } from "../util/parDeadline";

// Soon (the last three days, and the day itself): a soft amber of its own rather than the theme's
// warning colour, which in an orange theme reads like the main colour ("To do").
const SOON_SX = (theme: Theme) =>
  theme.palette.mode === "dark"
    ? { bgcolor: "rgba(245, 158, 11, 0.18)", color: "#FCD34D", border: "1px solid rgba(245, 158, 11, 0.6)" }
    : { bgcolor: "#FEF3C7", color: "#92400E", border: "1px solid #F59E0B" };

// One of the viewer's own deadlines: the date and how long is left, grey while there's time,
// amber in the last three days and on the day. Nothing once it has passed: the task locks then,
// so there's nothing to be late with. `daysOnly` leaves the date out ("5 days left") where the
// date is already shown nearby.
export default function ParDueChip({ due, daysOnly = false, sx }: { due: string; daysOnly?: boolean; sx?: SxProps<Theme> }) {
  const days = daysLeft(due);
  if (Number.isNaN(days) || days < 0) return null;
  const label = daysOnly
    ? daysLeftLabel(days)
    : days === 0
      ? "Due today"
      : `Due ${formatShortDate(due)} · ${days === 1 ? "1 day left" : `${days} days left`}`;
  const soon = days <= 3;
  return (
    <Chip
      size="small"
      label={label}
      variant={soon ? "filled" : "outlined"}
      sx={[...(soon ? [SOON_SX] : []), ...(Array.isArray(sx) ? sx : [sx])]}
    />
  );
}
