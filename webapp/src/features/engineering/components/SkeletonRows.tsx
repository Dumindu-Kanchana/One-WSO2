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

import { Box, Skeleton } from "@wso2/oxygen-ui";
import { type JSX } from "react";

// Skeleton rows while a table waits, as many as the standalone's tables draw.
const DEFAULT_ROWS = 5;

// What a Download Stats table shows in place of its rows while they load
// (spec: loading inside a screen is a skeleton; One's spinner is the gate's).
export default function SkeletonRows({ count = DEFAULT_ROWS }: { count?: number }): JSX.Element {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="rounded" height={36} />
      ))}
    </Box>
  );
}
