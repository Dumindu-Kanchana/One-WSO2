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
import type { Okr } from "../api/okrTypes";
import { useOkrs } from "../api/useOkrs";
import { okrProgress, okrsForCycle } from "../util/okr";
import ParOkrList from "./ParOkrList";
import ParEmptyState from "./ParEmptyState";

// Someone's OKRs for a PAR cycle (due in the year up to its end, and any still
// open). A card for the person themselves, hidden when they have none.
export function ParOkrCard({
  ownerEmail,
  cycleEndDate,
  title = "Your OKRs",
  showKeyResults = true,
  onCite,
  citeLabel,
}: {
  ownerEmail: string | undefined;
  cycleEndDate: string;
  title?: string;
  showKeyResults?: boolean;
  onCite?: (okr: Okr) => void;
  citeLabel?: string;
}) {
  const okrs = useOkrs(ownerEmail);
  if (okrs.isLoading) return <Skeleton variant="rectangular" height={96} sx={{ borderRadius: 1.5 }} />;
  // Supporting information: a failure to load hides the card rather than
  // getting in the way of the page it sits on.
  if (!okrs.isSuccess) return null;
  const shown = okrsForCycle(okrs.data, cycleEndDate);
  if (shown.length === 0) return null;
  const { completed, total } = okrProgress(shown);
  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.25 }}>
        <TargetIcon size={16} />
        <Typography sx={{ fontWeight: 600, flex: 1 }}>{title}</Typography>
        <Typography variant="caption" color="text.secondary">
          {completed} of {total} completed
        </Typography>
      </Box>
      <ParOkrList okrs={shown} showKeyResults={showKeyResults} onCite={onCite} citeLabel={citeLabel} />
    </Card>
  );
}

// The lead's evidence tab: the employee's OKRs and how many are completed.
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
  const shown = okrsForCycle(okrs.data ?? [], cycleEndDate);
  if (shown.length === 0) return <ParEmptyState text="No OKRs were set for this person" />;
  const { completed, total } = okrProgress(shown);
  return (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {completed} of {total} completed.
      </Typography>
      <ParOkrList okrs={shown} />
    </>
  );
}
