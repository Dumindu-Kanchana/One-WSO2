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
import { CUSTOMER_CODE_MAX, customerCodeError } from "./lookupValidation";

describe("customerCodeError", () => {
  it("accepts capital letters and digits up to the maximum length", () => {
    expect(customerCodeError("BANKONESUB")).toBeNull();
    expect(customerCodeError("A")).toBeNull();
    expect(customerCodeError("ABC123")).toBeNull();
    expect(customerCodeError("A".repeat(CUSTOMER_CODE_MAX))).toBeNull();
  });

  it("requires a code", () => {
    expect(customerCodeError("")).toMatch(/required/i);
  });

  it("rejects lowercase, separators and spaces, which would corrupt a risk code", () => {
    expect(customerCodeError("bankone")).not.toBeNull();
    expect(customerCodeError("BANK-ONE")).not.toBeNull();
    expect(customerCodeError("BANK ONE")).not.toBeNull();
    expect(customerCodeError("BANK_ONE")).not.toBeNull();
  });

  it("rejects a code longer than the maximum", () => {
    expect(customerCodeError("A".repeat(CUSTOMER_CODE_MAX + 1))).toMatch(/at most/);
  });
});
