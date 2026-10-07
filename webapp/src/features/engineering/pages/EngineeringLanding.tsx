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
import PerspectiveLanding from "@components/perspective-landing/PerspectiveLanding";
import { isPreviewEnabled } from "@config/previewFeatures";
import EngineeringUnavailable from "../components/EngineeringUnavailable";

/**
 * The Engineering landing, at /engineering.
 *
 * With the flag on, this is the same landing every perspective without an
 * overview has: it forwards to the first rail row the reader can open, which
 * is Download Stats → Overview (`forwardsToFirstItem` in perspectives.ts).
 *
 * With the flag off it cannot be: the Engineering perspective is absent from
 * the registry, so `PerspectiveLanding` would resolve the active perspective
 * to Me and forward a visitor there — a silent bounce for someone who typed
 * an address they were given. The route stays registered to answer them.
 */
export default function EngineeringLanding(): JSX.Element {
  if (!isPreviewEnabled("engineering")) return <EngineeringUnavailable />;
  return <PerspectiveLanding />;
}
