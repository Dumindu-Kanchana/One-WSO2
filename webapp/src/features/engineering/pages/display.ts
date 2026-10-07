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

// Helpers the current screens still read while they wait to be rebuilt on the
// kit (../utils/format.ts, ../utils/filters.ts). The compact figure, the
// Product label, the local date-time and the calendar-day guard moved there;
// what is left here has no counterpart in the standalone and goes when its
// screen does.

const JOB_STATUS_LABEL: Record<string, string> = {
  SUCCESS: "Success",
  PARTIAL_FAILURE: "Partial failure",
  FAILED: "Failed",
  STARTED: "Started",
};

export function jobStatusLabel(status: string): string {
  return JOB_STATUS_LABEL[status] ?? status;
}

export function isIsolatedPoint(
  data: readonly Record<string, string | number | null>[],
  dataKey: string,
  index: number,
): boolean {
  const value = data[index]?.[dataKey];
  const prev = index > 0 ? data[index - 1]?.[dataKey] : null;
  const next = index + 1 < data.length ? data[index + 1]?.[dataKey] : null;
  return typeof value === "number" && typeof prev !== "number" && typeof next !== "number";
}
