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

import { describe, expect, it } from "vitest";
import { act, render, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TablePagination } from "@wso2/oxygen-ui";
import type { ChangeEvent, JSX } from "react";
import { DEFAULT_ROWS_PER_PAGE, ROWS_PER_PAGE_OPTIONS } from "../constants/tableConstants";
import { usePagination } from "./usePagination";

const rows = Array.from({ length: 23 }, (_, i) => `row-${i + 1}`);

function rowsPerPageEvent(value: number): ChangeEvent<HTMLInputElement> {
  return { target: { value: String(value) } } as unknown as ChangeEvent<HTMLInputElement>;
}

describe("usePagination", () => {
  it("offers the standalone's rows-per-page choices and starts on ten", () => {
    expect(ROWS_PER_PAGE_OPTIONS).toEqual([10, 25, 50, 100]);
    expect(DEFAULT_ROWS_PER_PAGE).toBe(10);
  });

  it("starts on the first page of ten rows and counts every row", () => {
    const { result } = renderHook(() => usePagination(rows));
    expect(result.current.page).toBe(0);
    expect(result.current.rowsPerPage).toBe(10);
    expect(result.current.count).toBe(23);
    expect(result.current.paged).toEqual(rows.slice(0, 10));
  });

  it("moves to the page asked for", () => {
    const { result } = renderHook(() => usePagination(rows));
    act(() => result.current.onPageChange(null, 2));
    expect(result.current.page).toBe(2);
    expect(result.current.paged).toEqual(["row-21", "row-22", "row-23"]);
  });

  it("goes back to the first page when the rows per page change", () => {
    const { result } = renderHook(() => usePagination(rows));
    act(() => result.current.onPageChange(null, 1));
    act(() => result.current.onRowsPerPageChange(rowsPerPageEvent(25)));
    expect(result.current.page).toBe(0);
    expect(result.current.rowsPerPage).toBe(25);
    expect(result.current.paged).toEqual(rows);
  });

  it("never points past the last page when the rows shrink", () => {
    const { result, rerender } = renderHook(({ data }) => usePagination(data), {
      initialProps: { data: rows },
    });
    act(() => result.current.onPageChange(null, 2));
    rerender({ data: rows.slice(0, 5) });
    expect(result.current.page).toBe(0);
    expect(result.current.paged).toEqual(rows.slice(0, 5));
  });

  it("takes another starting page size", () => {
    const { result } = renderHook(() => usePagination(rows, 25));
    expect(result.current.rowsPerPage).toBe(25);
    expect(result.current.paged).toHaveLength(23);
  });
});

function Harness(): JSX.Element {
  const pagination = usePagination(rows);
  return (
    <>
      <ul>
        {pagination.paged.map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>
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
    </>
  );
}

describe("usePagination with the table pagination control", () => {
  it("drives the first, next and last buttons and the rows-per-page select", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    expect(screen.getByText("1–10 of 23")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /go to last page/i }));
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "row-21",
      "row-22",
      "row-23",
    ]);

    await user.click(screen.getByRole("button", { name: /go to first page/i }));
    expect(within(list).getByText("row-1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /go to next page/i }));
    expect(within(list).getByText("row-11")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: /rows per page/i }));
    await user.click(await screen.findByRole("option", { name: "25" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(23);
    expect(screen.getByText("1–23 of 23")).toBeInTheDocument();
  });
});
