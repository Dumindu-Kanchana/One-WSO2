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

import { useEffect, useReducer } from "react";

// The longest a browser timer can wait, about 24.8 days. A longer wait is taken in steps of it.
const LONGEST_TIMER_MS = 2 ** 31 - 1;

/**
 * Redraws the component at `at` (milliseconds since the epoch) while `waiting`, so what depends on that moment
 * shows without a reload. A time already past redraws at once.
 */
export function useRedrawAt(at: number, waiting: boolean): void {
  const [step, redraw] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!waiting || Number.isNaN(at)) return;
    const wait = Math.max(at - Date.now() + 1, 0);
    const timer = window.setTimeout(redraw, Math.min(wait, LONGEST_TIMER_MS));
    return () => window.clearTimeout(timer);
  }, [at, waiting, step]);
}
