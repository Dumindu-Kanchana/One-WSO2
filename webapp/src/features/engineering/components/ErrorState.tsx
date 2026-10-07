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

import { Box, Button, Typography } from "@wso2/oxygen-ui";
import { type JSX } from "react";
import { serverMessage } from "@api/errors";

interface ErrorStateProps {
  title?: string;
  /** Overrides the detail line entirely; rare. */
  description?: string;
  /**
   * The caught error. When the response carried its own message, that is the
   * detail line (One's convention, docs/conventions.md "Presenting errors");
   * otherwise the standalone's sentence is. Never rendered raw.
   */
  error?: unknown;
  onRetry?: () => void;
  minHeight?: number | string;
}

const FALLBACK = "We couldn't load this data. Please try again.";

// Inline error placeholder for a failed card/chart/table fetch, in the
// standalone's shape: centred title, one line of detail, Retry (ADR 0002).
export default function ErrorState({
  title = "Something went wrong",
  description,
  error,
  onRetry,
  minHeight = 200,
}: ErrorStateProps): JSX.Element {
  const detail = description ?? serverMessage(error) ?? FALLBACK;
  return (
    <Box
      sx={{
        minHeight,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1.5,
        textAlign: "center",
        p: 3,
      }}
    >
      <Typography variant="body1" color="error">
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {detail}
      </Typography>
      {onRetry && (
        <Button variant="outlined" size="small" onClick={onRetry}>
          Retry
        </Button>
      )}
    </Box>
  );
}
