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

import { isPreviewEnabled } from "@config/previewFeatures";
import type { ParCycle } from "./types";
import { isDeadlinePassed } from "../util/parDeadline";
import { useActiveParCycle, useParHasActiveCycle, useParHasLead } from "./useParData";
import { useParShowsPar2 } from "./useReview360";

// The open PAR 2.0 cycle and where feedback given now goes, for Give feedback.
// Leadership 360° runs with the cycle, behind its own preview flag.
//
// 360° feedback runs all year: inside a cycle's 360° window it goes to that
// cycle (`feedbackCycle` is the cycle); outside it, to cycle 0, held for the
// next cycle (`held`), and only offered, never requested.
export function useParFeedbackParts(workEmail: string | undefined, profileLoading: boolean) {
  const activeCycles = useActiveParCycle(workEmail);
  const cycle = activeCycles.data?.[0];
  const { hasLead, isLoading: leadLoading } = useParHasLead(workEmail, profileLoading);
  const { isActive, isLoading: activeLoading } = useParHasActiveCycle(workEmail, profileLoading);
  const { showsPar2, isLoading: par2Loading } = useParShowsPar2(cycle?.parCycleId);
  const par2Cycle = Boolean(cycle) && isActive && showsPar2;
  const windowOpen = par2Cycle && !isDeadlinePassed(cycle!.parThreeSixtyRatingDeadline);
  const held = !windowOpen && isPreviewEnabled("par2");
  return {
    cycle: par2Cycle ? cycle : undefined,
    feedbackCycle: windowOpen ? cycle : held ? heldCycle(cycle) : undefined,
    held,
    hasLead,
    leadership: isPreviewEnabled("leadership360"),
    isLoading: profileLoading || leadLoading || activeLoading || activeCycles.isLoading || par2Loading,
  };
}

// Cycle 0 stands for the next cycle: no deadline of its own (screens check `held`
// rather than a date).
function heldCycle(cycle: ParCycle | undefined): ParCycle {
  return { ...(cycle ?? {}), parCycleId: 0, parCycleName: "next", parThreeSixtyRatingDeadline: "9999-12-31" } as ParCycle;
}
