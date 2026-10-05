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

import { Box, Typography } from "@wso2/oxygen-ui";
import type { JSX, ReactNode } from "react";

// `required` renders the asterisk convention users expect on a form: the field
// must be filled before the step will submit. It mirrors the validation on the
// same field — keep the two in step, or the form will either promise something
// it doesn't enforce or enforce something it didn't warn about.
export default function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }): JSX.Element {
  return (
    <Typography variant="body2" fontWeight={500} color="text.primary" sx={{ display: "block", mb: 1 }}>
      {children}
      {required && (
        // Inherits the label's colour rather than fixing one: the form sits on a
        // dark card in dark mode and a light one otherwise, so a hard-coded
        // colour would be invisible in one of them.
        <Box component="span" aria-hidden="true" sx={{ color: "inherit", ml: 0.4 }}>
          *
        </Box>
      )}
    </Typography>
  );
}
