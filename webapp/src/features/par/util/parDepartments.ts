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

import type { DepartmentDeadline, ParCycle, ParCycleConfigurations } from "../api/types";

// PAR admins pick departments by their HR name, in any business unit, for two
// of a cycle's settings: the departments that share the rating that needs
// evidence without it, and the departments with a self-review deadline of
// their own. A PAR's department is its team's (parDepartment).

/** Whether two names are the same department: HR's name, whatever the case or the spaces around it. */
export function isSameDepartment(name: string, other: string): boolean {
  return name.trim().toLowerCase() === other.trim().toLowerCase();
}

/** Whether a department is one of a list. */
export function isDepartmentIn(departments: string[] | undefined, department: string | undefined): boolean {
  return department !== undefined && (departments ?? []).some((name) => isSameDepartment(name, department));
}

/** The self-review deadline of a PAR in a department: the department's own in
 * the cycle, or the cycle's. */
export function employeeDeadlineFor(
  cycle: Pick<ParCycle, "parEmployeeDeadline" | "parCycleConfigurations">,
  department: string | undefined,
): string {
  const own = department
    ? cycle.parCycleConfigurations?.departmentEmployeeDeadlines?.find((d) => isSameDepartment(d.department, department))
    : undefined;
  return own?.deadline ?? cycle.parEmployeeDeadline;
}

/** The deadline after which a lead (or a PAR admin) can share a PAR of a PAR 2.0 cycle: the 360° deadline, or the
 * employee's own self-review deadline when their department's is later. Sharing opens once it has passed
 * everywhere (deadlineEndsEverywhereAt), as the backend's checkShareOpen has it, so all 360° feedback is in. */
export function shareOpensAfter(
  cycle: Pick<ParCycle, "parEmployeeDeadline" | "parThreeSixtyRatingDeadline" | "parCycleConfigurations">,
  department: string | undefined,
): { date: string; after: "360" | "self-review" } {
  const selfReview = employeeDeadlineFor(cycle, department);
  return selfReview > cycle.parThreeSixtyRatingDeadline
    ? { date: selfReview, after: "self-review" }
    : { date: cycle.parThreeSixtyRatingDeadline, after: "360" };
}

/** Whether a lead shares the rating that needs evidence without it for a PAR in this department. */
export function needsNoEvidence(configurations: ParCycleConfigurations | undefined, department: string | undefined) {
  return isDepartmentIn(configurations?.evidenceExemptDepartments, department);
}

/** The departments as they'll be saved: each name trimmed, a blank or repeated one (whatever the case) left out. */
export function cleanDepartments(departments: string[]): string[] {
  const kept: string[] = [];
  for (const department of departments.map((d) => d.trim())) {
    if (department && !isDepartmentIn(kept, department)) kept.push(department);
  }
  return kept;
}

/** Why the departments' own self-review deadlines can't be saved yet, or null
 * when they can: each needs a department, named once, and a date after the
 * evaluation starts, no later than it ends, and before the lead deadline, as
 * the cycle's own. */
export function departmentDeadlinesProblem(
  deadlines: DepartmentDeadline[],
  dates: { evaluationStart: string; evaluationEnd: string; leadDeadline: string },
): string | null {
  const seen: string[] = [];
  for (const { department, deadline } of deadlines) {
    if (!department.trim()) return "Pick a department for each self-review deadline.";
    if (isDepartmentIn(seen, department)) return `${department.trim()} has more than one self-review deadline.`;
    seen.push(department);
    if (!deadline) return `Pick a self-review deadline for ${department.trim()}.`;
    if (deadline <= dates.evaluationStart || (dates.evaluationEnd && deadline > dates.evaluationEnd)) {
      return `${department.trim()}'s self-review deadline must be after the PAR creation date and no later than the evaluation closes.`;
    }
    if (dates.leadDeadline && deadline >= dates.leadDeadline) {
      return `${department.trim()}'s self-review deadline must be before the deadline for lead's feedback.`;
    }
  }
  return null;
}
