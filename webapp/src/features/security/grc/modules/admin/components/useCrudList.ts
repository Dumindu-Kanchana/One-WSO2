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

import { type DependencyList, useEffect, useState } from "react";

// Rows + loading + error for an admin CRUD list. The effect refetches when
// `deps` change and discards a response that arrives after they changed (or
// after unmount), so a slow earlier fetch can't overwrite a newer list.
// `reload` (after a save or delete) is never stale.
export function useCrudList<T>(fetchAll: () => Promise<T[]>, deps: DependencyList) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = (isStale: () => boolean = () => false) => {
    setLoading(true);
    setError(null);
    fetchAll()
      .then((r) => {
        if (!isStale()) setRows(r);
      })
      .catch((e) => {
        if (!isStale()) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!isStale()) setLoading(false);
      });
  };

  useEffect(() => {
    let cancelled = false;
    load(() => cancelled);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { rows, loading, error, setError, reload: () => load() };
}
