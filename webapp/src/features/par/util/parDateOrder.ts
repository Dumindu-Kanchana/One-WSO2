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

export type OrderedDateField =
  | "parEmployeeDeadline"
  | "parThreeSixtyRatingDeadline"
  | "parLeadDeadline"
  | "parLeadHardDeadline"
  | "parF2FDeadline"
  | "parEvaluationEndDate"
  | "parCycleEndDate";

// A PAR 2.0 cycle's dates in their order, each strictly after the one before, as the backend's
// validateDateOrder checks them, by the names the cycle dialogs give them. A department's own self-review
// deadline may fall after the 360° deadline (departmentDeadlinesProblem), and the Top 5%/20% deadline isn't
// in it.
const DATE_ORDER: { field: OrderedDateField; name: string }[] = [
  { field: "parEmployeeDeadline", name: "the employee PAR deadline" },
  { field: "parThreeSixtyRatingDeadline", name: "the 360° feedback deadline" },
  { field: "parLeadDeadline", name: "the lead's feedback deadline" },
  { field: "parLeadHardDeadline", name: "the hard lead deadline" },
  { field: "parF2FDeadline", name: "the PAR F2F deadline" },
  { field: "parEvaluationEndDate", name: "the PAR evaluation closing date" },
  { field: "parCycleEndDate", name: "the cycle end date" },
];

/** For each date of a PAR 2.0 cycle that isn't after the one before it, the message for its field. A date not
 * set yet (or a hard lead deadline the cycle doesn't have) is skipped, so the next one is compared with the one
 * before it. */
export function dateOrderProblems(
  dates: Partial<Record<OrderedDateField, string>>,
): Partial<Record<OrderedDateField, string>> {
  const problems: Partial<Record<OrderedDateField, string>> = {};
  let previous: { date: string; name: string } | undefined;
  for (const { field, name } of DATE_ORDER) {
    const date = dates[field];
    if (!date) continue;
    if (previous && date <= previous.date) problems[field] = `Must be later than ${previous.name}`;
    previous = { date, name };
  }
  return problems;
}
