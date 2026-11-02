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
import { useActiveParCycle, useParHasActiveCycle, useParHasLead } from "./useParData";
import { useParShowsPar2 } from "./useReview360";

// The open PAR 2.0 cycle, and what the employee can do in it. Giving feedback
// needs only the cycle; asking for it, a self-review and the tracker need a
// lead too. Leadership 360° runs with the cycle, behind its own preview flag.
export function useParFeedbackParts(workEmail: string | undefined, profileLoading: boolean) {
  const activeCycles = useActiveParCycle(workEmail);
  const cycle = activeCycles.data?.[0];
  const { hasLead, isLoading: leadLoading } = useParHasLead(workEmail, profileLoading);
  const { isActive, isLoading: activeLoading } = useParHasActiveCycle(workEmail, profileLoading);
  const { showsPar2, isLoading: par2Loading } = useParShowsPar2(cycle?.parCycleId);
  const par2Cycle = Boolean(cycle) && isActive && showsPar2;
  return {
    cycle: par2Cycle ? cycle : undefined,
    hasLead,
    leadership: isPreviewEnabled("leadership360"),
    isLoading: profileLoading || leadLoading || activeLoading || activeCycles.isLoading || par2Loading,
    cycleError: activeCycles.error,
    retryCycle: () => activeCycles.refetch(),
  };
}
