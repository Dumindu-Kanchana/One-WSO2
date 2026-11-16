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
import { Alert, Skeleton, Stack } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { isPreviewEnabled } from "@config/previewFeatures";
import { useMeProfile } from "@features/my/api/useMeProfile";
import { useActiveParCycle } from "../api/useParData";
import Par360AboutMe from "../components/Par360AboutMe";
import Leadership360ResultsCard from "../components/Leadership360ResultsCard";

// Active cycle → 360° feedback: your summary once your lead shares your PAR,
// and — for leaders — this cycle's Leadership 360° results (live once 3
// people have responded); then asking for feedback and who responded.
export default function ParCycleFeedbackSection() {
  const profile = useMeProfile();
  const workEmail = profile.data?.userInfo.workEmail;
  const activeCycles = useActiveParCycle(workEmail);
  const cycle = activeCycles.data?.[0];

  if (profile.isLoading || activeCycles.isLoading) {
    return <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5, maxWidth: 1100 }} />;
  }
  if (activeCycles.isError) {
    return (
      <ErrorNotice error={activeCycles.error} onRetry={() => activeCycles.refetch()} retrying={activeCycles.isFetching}>
        Couldn't load your PAR cycle.
      </ErrorNotice>
    );
  }
  if (!cycle || !workEmail) {
    return <Alert severity="info">There's no PAR cycle open for you right now.</Alert>;
  }
  const leadership = isPreviewEnabled("leadership360");
  return (
    <Stack spacing={2} sx={{ maxWidth: 1100 }}>
      <Par360AboutMe
        cycle={cycle}
        workEmail={workEmail}
        afterSummary={leadership && <Leadership360ResultsCard view="SELF" parCycleId={cycle.parCycleId} />}
      />
    </Stack>
  );
}
