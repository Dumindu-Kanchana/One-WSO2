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

import type { ReactNode } from "react";
import { Card, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useSelfReview } from "../api/useSelfReview";
import type { ParCycle, ParRating } from "../api/types";
import { decodeParComment, isEmptyHtml } from "../util/parComment";
import { ParCommentView } from "./ParContent";
import ParSelfReviewView from "./ParSelfReviewView";
import ParLead360Evidence from "./ParLead360Evidence";
import Leadership360ResultsCard from "./Leadership360ResultsCard";

// One report's record in a past PAR 2.0 cycle, read-only, for their lead:
// the lead's feedback, then what the lead had while reviewing. That's the
// self-review and the PAR 360° responses with names, or, for a member of the
// leadership team, their Leadership 360° results. No OKRs: they keep no
// history, so today's list would stand in for what the lead saw then.
export default function ParLeadHistoryPar2Record({
  cycle,
  rating,
  employeeEmail,
}: {
  cycle: Pick<ParCycle, "parCycleId">;
  rating: ParRating;
  employeeEmail: string;
}) {
  const selfReview = useSelfReview(cycle.parCycleId, employeeEmail);
  const leader = Boolean(rating.parIsLeadershipEmployee);
  const leadComment = decodeParComment(rating.parLeadComment);

  return (
    <Stack spacing={2}>
      <Section title="Lead's feedback">
        {isEmptyHtml(leadComment) ? <Empty>No feedback was shared.</Empty> : <ParCommentView html={leadComment} />}
      </Section>

      <Section title="Self-review">
        {selfReview.isLoading ? (
          <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />
        ) : selfReview.isError ? (
          <ErrorNotice error={selfReview.error} onRetry={() => selfReview.refetch()} retrying={selfReview.isFetching}>
            Couldn't load the self-review.
          </ErrorNotice>
        ) : selfReview.data && Object.keys(selfReview.data.answers).length > 0 ? (
          <ParSelfReviewView definition={selfReview.data.template.definition} answers={selfReview.data.answers} framed={false} />
        ) : (
          <Empty>No self-review was shared.</Empty>
        )}
      </Section>

      {leader ? (
        <Leadership360ResultsCard
          view="REPORTS"
          leaderEmail={employeeEmail}
          parCycleId={cycle.parCycleId}
          fallback={
            <Section title="Leadership 360° results">
              <Empty>No Leadership 360° results for this cycle.</Empty>
            </Section>
          }
        />
      ) : (
        <ParLead360Evidence parCycleId={cycle.parCycleId} employeeEmail={employeeEmail} />
      )}
    </Stack>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Typography sx={{ fontWeight: 600, mb: 1.5 }}>{title}</Typography>
      {children}
    </Card>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <Typography variant="body2" color="text.secondary">
      {children}
    </Typography>
  );
}
