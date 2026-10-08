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

import type { JSX } from "react";
import { Navigate, useLocation } from "react-router";

/**
 * Forwards to `to`, keeping the query string.
 *
 * A bookmark made during the preview carries its filters in the address —
 * `?from=…&interval=month` — and a redirect that dropped them would open a
 * different view from the one the person saved. `replace`, so Back leaves
 * rather than bouncing off this route and forwarding again.
 */
export default function ForwardKeepingQuery({ to }: { to: string }): JSX.Element {
  const { search } = useLocation();
  return <Navigate to={{ pathname: to, search }} replace />;
}
