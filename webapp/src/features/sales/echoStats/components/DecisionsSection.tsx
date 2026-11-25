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

// What account managers did with Echo's suggestions.
//
// Deliberately never called accuracy. An AM approving a value says the AM accepted it, not
// that it was right, and a rejection can be about timing as much as truth. Accuracy needs a
// labelled gold set to compare against; until there is one, this is the decision rate and
// says so.

import { Typography } from "@wso2/oxygen-ui";
import type {
  ConfidenceBand,
  DecisionStats,
  FieldDecisions,
  MergeStatusDecisions,
  RejectReasonCount,
  UserDecisions,
} from "../types";
import { formatCount, formatRate, mergeStatusLabel, statsRejectReasonLabel } from "../util/statsFormat";
import { StatTiles, StatsPair, StatsSection, StatsTable, type StatsColumn } from "./StatsParts";

const FIELD_COLUMNS: readonly StatsColumn<FieldDecisions>[] = [
  { key: "label", label: "Field", render: (f) => f.label },
  { key: "approved", label: "Approved as proposed", numeric: true, render: (f) => formatCount(f.approved) },
  { key: "edited", label: "Edited", numeric: true, render: (f) => formatCount(f.edited) },
  { key: "rejected", label: "Rejected", numeric: true, render: (f) => formatCount(f.rejected) },
  { key: "pending", label: "Pending", numeric: true, render: (f) => formatCount(f.pending) },
  { key: "rate", label: "Approved as proposed rate", numeric: true, render: (f) => formatRate(f.approvedAsIsRate) },
];

const REASON_COLUMNS: readonly StatsColumn<RejectReasonCount>[] = [
  { key: "reason", label: "Reason", render: (r) => statsRejectReasonLabel(r.reason) },
  { key: "count", label: "Rejections", numeric: true, render: (r) => formatCount(r.count) },
];

const BAND_COLUMNS: readonly StatsColumn<ConfidenceBand>[] = [
  { key: "band", label: "Confidence", render: (b) => b.band },
  { key: "decided", label: "Decided", numeric: true, render: (b) => formatCount(b.decided) },
  { key: "rate", label: "Approved as proposed rate", numeric: true, render: (b) => formatRate(b.approvedAsIsRate) },
];

const MERGE_COLUMNS: readonly StatsColumn<MergeStatusDecisions>[] = [
  {
    key: "mergeStatus",
    label: "Merge status",
    render: (m) => (
      <>
        {m.mergeStatus}
        <Typography component="span" variant="caption" color="text.secondary" sx={{ display: "block" }}>
          {mergeStatusLabel(m.mergeStatus)}
        </Typography>
      </>
    ),
  },
  { key: "decided", label: "Decided", numeric: true, render: (m) => formatCount(m.decided) },
  { key: "rate", label: "Approved as proposed rate", numeric: true, render: (m) => formatRate(m.approvedAsIsRate) },
];

const USER_COLUMNS: readonly StatsColumn<UserDecisions>[] = [
  { key: "email", label: "User", render: (u) => u.email },
  { key: "approved", label: "Approved as proposed", numeric: true, render: (u) => formatCount(u.approved) },
  { key: "edited", label: "Edited", numeric: true, render: (u) => formatCount(u.edited) },
  { key: "rejected", label: "Rejected", numeric: true, render: (u) => formatCount(u.rejected) },
];

const NOTHING_DECIDED = "No suggestions decided in this range.";

export default function DecisionsSection({ decisions }: { decisions: DecisionStats }) {
  return (
    <StatsSection
      title="AM decisions on Echo's suggestions"
      subtitle="What account managers did with Echo's suggestions, not how accurate they were: measuring accuracy needs the labelled gold set."
    >
      <StatTiles
        tiles={[
          { label: "Approved as proposed", value: formatCount(decisions.approved) },
          { label: "Edited", value: formatCount(decisions.edited), hint: "approved with a changed value" },
          { label: "Rejected", value: formatCount(decisions.rejected) },
          // Every PROPOSED suggestion on every deal, not only those on the Opportunities list,
          // so it can differ from the pending counts there.
          {
            label: "Pending suggestions (all deals)",
            value: formatCount(decisions.pending),
            hint: "waiting now, any age",
          },
          {
            label: "Approved as proposed rate",
            value: formatRate(decisions.approvedAsIsRate),
            hint: "of suggestions decided",
          },
        ]}
      />
      <StatsTable
        title="By field"
        columns={FIELD_COLUMNS}
        rows={decisions.byField}
        rowKey={(f) => f.fieldKey}
        empty="No suggestions decided in this range, and none pending."
      />
      <StatsPair>
        <StatsTable
          title="Reject reasons"
          columns={REASON_COLUMNS}
          rows={decisions.rejectReasons}
          rowKey={(r) => r.reason}
          empty="No suggestions rejected in this range."
        />
        <StatsTable
          title="By confidence"
          columns={BAND_COLUMNS}
          rows={decisions.byConfidence}
          rowKey={(b) => b.band}
          empty={NOTHING_DECIDED}
        />
        <StatsTable
          title="By merge status"
          columns={MERGE_COLUMNS}
          rows={decisions.byMergeStatus}
          rowKey={(m) => m.mergeStatus}
          empty={NOTHING_DECIDED}
        />
        <StatsTable
          title="By user"
          columns={USER_COLUMNS}
          rows={decisions.byUser}
          rowKey={(u) => u.email}
          empty={NOTHING_DECIDED}
        />
      </StatsPair>
    </StatsSection>
  );
}
