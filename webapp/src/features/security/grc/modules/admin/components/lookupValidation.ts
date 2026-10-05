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
// Mirrors the Compliance Entity's rule for a customer code, so a bad one is
// caught in the dialog rather than after a round trip. The code is embedded
// in Managed Services risk codes, so it can't contain the "-" separator.
export const CUSTOMER_CODE_MAX = 12;

// The name column of every lookup table is VARCHAR(255); the backend rejects a
// longer name, and the input stops at the limit so it never gets that far.
export const LOOKUP_NAME_MAX = 255;

// Returns a message for an invalid code, or null when it is fine.
export function customerCodeError(code: string): string | null {
  if (code === "") return "Code is required.";
  if (!/^[A-Z0-9]+$/.test(code)) return "Use only capital letters (A–Z) and digits (0–9).";
  if (code.length > CUSTOMER_CODE_MAX) return `Code can be at most ${CUSTOMER_CODE_MAX} characters.`;
  return null;
}
