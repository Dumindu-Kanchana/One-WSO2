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

// Who can do what in Echo, decided against meet-app's OWN privilege numbers
// 
// Nothing here is access control. The meet-app backend enforces every rule
// on its own, and answers 403 on every endpoint for a caller in no
// authorised group. 

import type { VisibilityAnswer } from "@components/side-rail/visibilityFold";
import { SALES_ECHO_STATS_ITEM_ID } from "@constants/perspectives";
import { useMemo } from "react";
import { SALES_PRIVILEGE } from "./salesTypes";
import { isSalesBackendConfigured, useSalesUserInfo } from "./useSalesData";
import { describeError, isForbidden } from "../util/salesError";

export interface SalesGate {
  /** True once /user-info has answered, either way. */
  isResolved: boolean;
  /** meet-app ADMIN (privilege 762). */
  isAdmin: boolean;
  /** The signed-in caller's work email, for the host comparison. */
  workEmail: string | null;
}

export function useSalesGate(): SalesGate {
  const { data, isLoading } = useSalesUserInfo();

  return useMemo(() => {
    const privileges = data?.privileges ?? [];
    const isAdmin = privileges.includes(SALES_PRIVILEGE.ADMIN);
    const workEmail = data?.workEmail ?? null;

    return {
      isResolved: !isLoading,
      isAdmin,
      workEmail,
    };
  }, [data, isLoading]);
}

export interface SalesRailGate {
  /** Whether a Sales rail row should show. */
  canSee: (itemId: string) => boolean;
  /** True while the answer is still being fetched. */
  isResolving: boolean;
  /** True when the access check itself failed (not a 403 -- that is an answer, not a failure). */
  isError: boolean;
  /** What went wrong, when isError. */
  errorMessage: string | undefined;
  /** Ask again. */
  retry: () => void;
}

/**
 * The rail's view of Sales access, alongside useSecurityGate and friends.
 *
 * Shows the rows only once meet-app has let the caller in, exactly like useMarketingOpsGate
 * and useSecurityGate: hidden while the answer is in flight (so they never flash in for
 * someone refused), hidden on a 403 (no access), and hidden when the check itself failed --
 * failing closed, as those gates do. A failure is also reported through isError, so it is
 * surfaced as "couldn't check" rather than read as "no access". With no backend URL configured
 * the rows stay: there is nothing to ask, and the page explains what is missing.
 *
 * `enabled` so the request is only made while Sales is the open perspective.
 *
 * @param enabled - Whether Sales is the active perspective
 */
export function useSalesRailGate(enabled: boolean): SalesRailGate {
  const { data, isPending, isLoading, isError, error, refetch } = useSalesUserInfo(enabled);
  const active = enabled && isSalesBackendConfigured();
  // isPending as well as isLoading: while the caller's identity is still resolving the query
  // is disabled, which React Query reports as pending but NOT loading -- checking isLoading
  // alone let the row show for that moment and then vanish when the 403 arrived.
  const isResolving = active && (isPending || isLoading);
  const failed = active && isError && !isForbidden(error);
  const open = !isResolving && !(active && isError);
  // Echo stats is for admins: shown only once meet-app has said this caller is one. With no
  // backend configured there is no one to ask, so it stays hidden rather than open.
  const isAdmin = (data?.privileges ?? []).includes(SALES_PRIVILEGE.ADMIN);
  return {
    canSee: (itemId) => open && (itemId !== SALES_ECHO_STATS_ITEM_ID || (active && isAdmin)),
    isResolving,
    isError: failed,
    errorMessage: failed ? describeError(error) : undefined,
    retry: () => void refetch(),
  };
}

export function salesVisibility(gate: SalesRailGate): VisibilityAnswer {
  const canSee = (id: string) => gate.canSee(id);
  return gate.isError
    ? { canSee, resolving: gate.isResolving, error: gate.errorMessage, retry: gate.retry }
    : { canSee, resolving: gate.isResolving, retry: () => undefined };
}
