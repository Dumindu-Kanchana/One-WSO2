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

import { Link as RouterLink } from "react-router";
import { Link } from "@wso2/oxygen-ui";
import { dealPath } from "../../util/salesPaths";
import { formatDateTime } from "../../util/salesTime";
import type { DealGaps, SalesforceFieldGaps, SalesforceStats } from "../types";
import { formatCount, formatRate } from "../util/statsFormat";
import { StatTiles, StatsSection, StatsTable, type StatsColumn } from "./StatsParts";

const FIELD_COLUMNS: readonly StatsColumn<SalesforceFieldGaps>[] = [
  { key: "label", label: "Field", render: (f) => f.label },
  { key: "dealsInScope", label: "Opportunities in scope", numeric: true, render: (f) => formatCount(f.dealsInScope) },
  { key: "filled", label: "Filled", numeric: true, render: (f) => formatCount(f.filled) },
  { key: "missing", label: "Missing", numeric: true, render: (f) => formatCount(f.missing) },
  { key: "echoProposed", label: "Echo can fill", numeric: true, render: (f) => formatCount(f.echoProposed) },
];

const DEAL_COLUMNS: readonly StatsColumn<DealGaps>[] = [
  {
    key: "name",
    label: "Opportunity",
    render: (d) => (
      <Link component={RouterLink} to={dealPath(d.opportunityId)} underline="hover" sx={{ fontWeight: 600 }}>
        {d.name}
      </Link>
    ),
  },
  { key: "owner", label: "Owner", render: (d) => d.ownerEmail ?? "—" },
  { key: "stage", label: "Stage", render: (d) => d.stage },
  { key: "inScope", label: "In scope", numeric: true, render: (d) => formatCount(d.inScope) },
  { key: "missing", label: "Missing", numeric: true, render: (d) => formatCount(d.missing) },
  { key: "echoProposed", label: "Echo can fill", numeric: true, render: (d) => formatCount(d.echoProposed) },
];

/**
 * MEDDPICC completeness in Salesforce for the open deals on the Opportunities list, as it
 * stands now. Not bound to the range: the toggle above does not change it.
 */
export default function SalesforceSection({ salesforce }: { salesforce: SalesforceStats }) {
  return (
    <StatsSection
      title="Salesforce completeness"
      subtitle={`Open opportunities, as of ${formatDateTime(salesforce.asOf)}: how many of the Gate fields that apply at each one's stage hold a value in Salesforce. Not limited to the range above.`}
    >
      <StatTiles
        tiles={[
          { label: "Open opportunities", value: formatCount(salesforce.deals) },
          {
            label: "Fill rate",
            value: formatRate(salesforce.fillRate),
            hint: `${formatCount(salesforce.fieldsFilled)} of ${formatCount(salesforce.fieldsInScope)} fields`,
          },
          { label: "Fields missing", value: formatCount(salesforce.fieldsMissing) },
          {
            label: "Echo can fill",
            value: formatCount(salesforce.echoCanFill),
            hint: "missing, with a suggestion waiting",
          },
        ]}
      />
      <StatsTable
        title="By field, most missing first"
        columns={FIELD_COLUMNS}
        rows={salesforce.byField}
        rowKey={(f) => f.fieldKey}
        empty="No open opportunities on the list."
      />
      <StatsTable
        title="Opportunities with the most gaps"
        columns={DEAL_COLUMNS}
        rows={salesforce.dealsWithMostGaps}
        rowKey={(d) => d.opportunityId}
        empty="No open opportunities are missing a field."
      />
    </StatsSection>
  );
}
