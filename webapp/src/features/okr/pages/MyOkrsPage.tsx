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

import { useMemo, useState } from "react";
import { Box, Button, Card, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import { PlusIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import PerspectiveHeader from "@components/perspective-header/PerspectiveHeader";
import { useUserInfo } from "@api/useUserInfo";
import { useOkrs } from "../api/useOkrs";
import OkrDialog from "../components/OkrDialog";
import OkrFilterBar from "../components/OkrFilterBar";
import OkrObjectiveCard from "../components/OkrObjectiveCard";
import { NO_OKR_FILTERS, filterOkrs, keyResultProgress, okrsOfPerson, sortOkrs, type OkrFilters } from "../util/okr";

// Me → My OKRs: what you're accountable for. The objectives you own, with all
// their key results, including those you've given to your team; and your key
// results on others' objectives, without the rest of those objectives. You set
// and manage your own here; your leads can too, from Manage OKRs.
export default function MyOkrsPage() {
  const userInfo = useUserInfo();
  const workEmail = userInfo.data?.workEmail;
  const myName = userInfo.data ? `${userInfo.data.firstName} ${userInfo.data.lastName}`.trim() : undefined;
  const okrs = useOkrs(workEmail);
  const [filters, setFilters] = useState<OkrFilters>(NO_OKR_FILTERS);
  const [setting, setSetting] = useState(false);

  const all = useMemo(
    () => (workEmail ? sortOkrs(okrsOfPerson(okrs.data ?? [], workEmail)) : []),
    [okrs.data, workEmail],
  );
  const shown = useMemo(() => filterOkrs(all, filters), [all, filters]);
  const { completed, total, overdue } = keyResultProgress(all);
  const closed = all.filter((o) => o.status === "CLOSED").length;
  const setButton = (
    <Button variant="contained" startIcon={<PlusIcon size={16} />} onClick={() => setSetting(true)}>
      Set an OKR
    </Button>
  );

  return (
    <Box>
      <PerspectiveHeader
        title="My OKRs"
        subtitle="Your objectives, and your key results on others', with where each one stands."
      />
      <Stack spacing={2} sx={{ maxWidth: 1200 }}>
        {userInfo.isLoading || okrs.isLoading ? (
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1.5 }} />
        ) : userInfo.isError ? (
          <ErrorNotice error={userInfo.error} onRetry={() => userInfo.refetch()}>
            Couldn&apos;t load your OKRs.
          </ErrorNotice>
        ) : okrs.isError ? (
          <ErrorNotice error={okrs.error} onRetry={() => okrs.refetch()} retrying={okrs.isFetching}>
            Couldn&apos;t load your OKRs.
          </ErrorNotice>
        ) : all.length === 0 ? (
          <Card variant="outlined" sx={{ p: 4, textAlign: "center" }}>
            <Typography sx={{ fontWeight: 600 }}>No OKRs yet</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Set your first: the objective, and the key results that will show it&apos;s done. Your lead can set them
              for you too.
            </Typography>
            {setButton}
          </Card>
        ) : (
          <>
            <OkrFilterBar
              filters={filters}
              onChange={setFilters}
              searchLabel="Search objectives and key results"
              actions={setButton}
            />
            <Typography variant="body2" color="text.secondary">
              {total > 0
                ? `${completed} of ${total} key ${total === 1 ? "result" : "results"} completed`
                : "No key results for you yet"}
              {overdue > 0 ? ` · ${overdue} overdue` : ""}
              {closed > 0 && filters.status !== "closed" ? ` · ${closed} closed, under Closed` : ""}
            </Typography>
            {shown.length === 0 ? (
              <Card variant="outlined" sx={{ p: 4, textAlign: "center" }}>
                <Typography sx={{ fontWeight: 600 }}>Nothing matches</Typography>
                <Typography variant="body2" color="text.secondary">
                  Try another search or filter.
                </Typography>
              </Card>
            ) : (
              <Stack spacing={2}>
                {shown.map((okr, i) => (
                  <OkrObjectiveCard
                    key={okr.okrId}
                    okr={okr}
                    index={i}
                    othersObjective={okr.ownerEmail.toLowerCase() !== workEmail?.toLowerCase()}
                  />
                ))}
              </Stack>
            )}
          </>
        )}
      </Stack>
      {setting && workEmail && (
        <OkrDialog open owner={{ workEmail, name: myName }} onClose={() => setSetting(false)} />
      )}
    </Box>
  );
}
