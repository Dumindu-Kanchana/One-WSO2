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

import { Box, Card, Skeleton, Typography } from "@wso2/oxygen-ui";
import { TargetIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import type { Okr, OkrKeyResult } from "@features/okr/api/okrTypes";
import { useOkrs } from "@features/okr/api/useOkrs";
import OkrList from "@features/okr/components/OkrList";
import { keyResultProgress } from "@features/okr/util/okr";
import { okrsForCycle } from "../util/okr";
import ParEmptyState from "./ParEmptyState";

// Someone's OKRs for a PAR cycle: only what's theirs (okrsForCycle). A card for
// the person themselves, hidden when they have none. The count is of their own
// key results, and goes when they have none.
export function ParOkrCard({
  ownerEmail,
  cycleEndDate,
  title = "Your OKRs",
  onCite,
  citeLabel,
}: {
  ownerEmail: string | undefined;
  cycleEndDate: string;
  title?: string;
  onCite?: (okr: Okr, keyResult?: OkrKeyResult) => void;
  citeLabel?: string;
}) {
  const okrs = useOkrs(ownerEmail);
  if (okrs.isLoading) return <Skeleton variant="rectangular" height={96} sx={{ borderRadius: 1.5 }} />;
  // Supporting information: a failure to load hides the card rather than
  // getting in the way of the page it sits on.
  if (!okrs.isSuccess || !ownerEmail) return null;
  const shown = okrsForCycle(okrs.data, ownerEmail, cycleEndDate);
  if (shown.length === 0) return null;
  const { completed, total } = keyResultProgress(shown);
  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.25 }}>
        <TargetIcon size={16} />
        <Typography sx={{ fontWeight: 600, flex: 1 }}>{title}</Typography>
        {total > 0 && (
          <Typography variant="caption" color="text.secondary">
            {completed} of {total} completed
          </Typography>
        )}
      </Box>
      <OkrList okrs={shown} personEmail={ownerEmail} onCite={onCite} citeLabel={citeLabel} />
    </Card>
  );
}

// The lead's evidence tab: the employee's OKRs and how many of their own key
// results are completed.
export function ParOkrEvidence({ ownerEmail, cycleEndDate }: { ownerEmail: string; cycleEndDate: string }) {
  const okrs = useOkrs(ownerEmail);
  if (okrs.isLoading) return <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />;
  if (okrs.isError) {
    return (
      <ErrorNotice error={okrs.error} onRetry={() => okrs.refetch()} retrying={okrs.isFetching}>
        Couldn't load their OKRs.
      </ErrorNotice>
    );
  }
  const shown = okrsForCycle(okrs.data ?? [], ownerEmail, cycleEndDate);
  if (shown.length === 0) return <ParEmptyState text="No OKRs were set for this person" />;
  const { completed, total, overdue } = keyResultProgress(shown);
  return (
    <>
      {total > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {completed} of {total} completed{overdue ? `, ${overdue} overdue` : ""}.
        </Typography>
      )}
      <OkrList okrs={shown} personEmail={ownerEmail} />
    </>
  );
}
