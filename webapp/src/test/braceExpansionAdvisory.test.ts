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

import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

// npm audit's range for the brace-expansion denial-of-service advisories is
// `<=1.1.20 || 2.0.0 - 2.1.6`. exceljs@4.4.0 reaches the 2.x copy through
// archiver → readdir-glob → minimatch, which asks for ^2.0.1. 2.1.7 is the
// newest 2.x release that range accepts, and 1.1.21 is the same for ^1.1.7.
// An unlisted major is not a patched release. The advisory lines in this
// lockfile are 1.x and 2.x only.
const isPatchedRelease = (version: string): boolean => {
  const [major, minor, patch] = version.split(".").map(Number);
  if (major === 1) return minor > 1 || (minor === 1 && patch >= 21);
  if (major === 2) return minor > 1 || (minor === 1 && patch >= 7);
  return false;
};

it("resolves brace-expansion outside the denial-of-service advisory range", () => {
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8")) as {
    packages: Record<string, { version?: string }>;
  };
  const resolved = Object.entries(lock.packages)
    .filter(
      ([path]) =>
        path === "node_modules/brace-expansion" ||
        path.endsWith("/node_modules/brace-expansion"),
    )
    .map(([path, pkg]) => ({ path, version: pkg.version }));

  const archiveChain = resolved.find((entry) =>
    entry.path.startsWith("node_modules/readdir-glob/"),
  );

  expect(archiveChain?.version).toBeDefined();
  expect(resolved.filter((entry) => !isPatchedRelease(entry.version ?? ""))).toEqual([]);
});
