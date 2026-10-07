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

import { TablePagination } from "@wso2/oxygen-ui";
import { type JSX } from "react";
import { ROWS_PER_PAGE_OPTIONS } from "../constants/tableConstants";
import type { ClientPagination } from "../hooks/usePagination";

// The pages control under every Download Stats table: the rows-per-page
// choices and first and last buttons, fed by usePagination.
export default function TablePager({
  pagination,
}: {
  pagination: ClientPagination<unknown>;
}): JSX.Element {
  return (
    <TablePagination
      component="div"
      count={pagination.count}
      page={pagination.page}
      onPageChange={pagination.onPageChange}
      rowsPerPage={pagination.rowsPerPage}
      onRowsPerPageChange={pagination.onRowsPerPageChange}
      rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
      showFirstButton
      showLastButton
    />
  );
}
