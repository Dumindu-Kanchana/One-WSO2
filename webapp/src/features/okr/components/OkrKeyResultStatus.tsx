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

import { useState } from "react";
import { Box, Chip, Menu, MenuItem } from "@wso2/oxygen-ui";
import { ChevronDownIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { KEY_RESULT_STATUSES, type OkrKeyResult } from "../api/okrTypes";
import { useSetKeyResultStatus } from "../api/useOkrs";
import { KEY_RESULT_STATUS_COLOR, KEY_RESULT_STATUS_LABEL } from "../util/okr";

// Where a key result stands. Its owner, and whoever manages the objective,
// change it from the menu while the objective is open; everyone else reads it.
export default function OkrKeyResultStatus({ keyResult, editable }: { keyResult: OkrKeyResult; editable: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const setStatus = useSetKeyResultStatus();
  const { showError } = useNotifications();
  const label = KEY_RESULT_STATUS_LABEL[keyResult.status];
  const chipSx = { height: 24, fontSize: 12, fontWeight: 600 };

  if (!editable) {
    return (
      <Chip
        size="small"
        variant="outlined"
        color={KEY_RESULT_STATUS_COLOR[keyResult.status]}
        label={label}
        sx={chipSx}
      />
    );
  }
  return (
    <>
      <Chip
        size="small"
        variant="outlined"
        color={KEY_RESULT_STATUS_COLOR[keyResult.status]}
        label={
          <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
            {label}
            <ChevronDownIcon size={14} />
          </Box>
        }
        onClick={(e) => setAnchor(e.currentTarget)}
        disabled={setStatus.isPending}
        aria-label={`Status: ${label}. Change it`}
        aria-haspopup="menu"
        sx={chipSx}
      />
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {KEY_RESULT_STATUSES.map((status) => (
          <MenuItem
            key={status}
            selected={status === keyResult.status}
            onClick={() => {
              setAnchor(null);
              if (status === keyResult.status) return;
              setStatus.mutate(
                { keyResultId: keyResult.keyResultId, status },
                { onError: (err) => showError(describeError(err)) },
              );
            }}
          >
            {KEY_RESULT_STATUS_LABEL[status]}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
