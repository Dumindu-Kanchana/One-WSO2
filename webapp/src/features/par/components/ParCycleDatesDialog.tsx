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

import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider } from "@wso2/oxygen-ui";
import type { ParCycle } from "../api/types";
import ParCycleDatesStepper from "./ParCycleDatesStepper";

// The cycle's dates, opened from the calendar button in Lead View and Admin View. 80vw wide rather than a
// fixed maxWidth breakpoint, since the stepper's steps need the room. `activeStep` as ParCycleDatesStepper
// takes it.
export default function ParCycleDatesDialog({
  cycle,
  open,
  onClose,
  activeStep,
}: {
  cycle: ParCycle;
  open: boolean;
  onClose: () => void;
  activeStep?: number;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} slotProps={{ paper: { sx: { width: "80vw" } } }}>
      <DialogTitle>Cycle Dates</DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 4, pb: 4 }}>
        <ParCycleDatesStepper cycle={cycle} activeStep={activeStep} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
