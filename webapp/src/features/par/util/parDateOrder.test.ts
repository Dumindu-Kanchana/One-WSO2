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

import { describe, expect, it } from "vitest";
import { dateOrderProblems } from "./parDateOrder";

describe("dateOrderProblems", () => {
  it("compares each date with the one before it, skipping any not set", () => {
    expect(dateOrderProblems({ parEmployeeDeadline: "2027-07-05", parLeadDeadline: "2027-07-05" })).toEqual({
      parLeadDeadline: "Must be later than the employee PAR deadline",
    });
    // No hard lead deadline: the F2F deadline follows the lead deadline.
    expect(
      dateOrderProblems({ parLeadDeadline: "2027-07-15", parLeadHardDeadline: "", parF2FDeadline: "2027-07-14" }),
    ).toEqual({ parF2FDeadline: "Must be later than the lead's feedback deadline" });
    expect(dateOrderProblems({})).toEqual({});
  });
});
