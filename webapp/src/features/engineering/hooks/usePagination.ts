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

import { type ChangeEvent, useState } from "react";
import { DEFAULT_ROWS_PER_PAGE } from "../constants/tableConstants";

export interface ClientPagination<T> {
  page: number;
  rowsPerPage: number;
  count: number;
  paged: T[];
  onPageChange: (event: unknown, newPage: number) => void;
  onRowsPerPageChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

/**
 * Client-side pagination for an already-fetched array of rows. Returns the
 * current page slice plus the handlers/values needed by Oxygen `TablePagination`
 * (with `showFirstButton` / `showLastButton`). The page index is clamped when
 * the underlying data shrinks, so it never points past the last page.
 */
export function usePagination<T>(
  rows: readonly T[],
  initialRowsPerPage: number = DEFAULT_ROWS_PER_PAGE,
): ClientPagination<T> {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);

  const count = rows.length;
  const maxPage = Math.max(0, Math.ceil(count / rowsPerPage) - 1);
  const safePage = Math.min(page, maxPage);
  const start = safePage * rowsPerPage;
  const paged = rows.slice(start, start + rowsPerPage);

  return {
    page: safePage,
    rowsPerPage,
    count,
    paged,
    onPageChange: (_event, newPage) => setPage(newPage),
    onRowsPerPageChange: (event) => {
      setRowsPerPage(parseInt(event.target.value, 10));
      setPage(0);
    },
  };
}
