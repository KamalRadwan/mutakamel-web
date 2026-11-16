// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDataTableSort } from "./useDataTableSort";
import type { ColumnDef } from "./types";

const columns: ColumnDef<{ id: string }>[] = [
  { id: "name", header: "Name", sortable: true, sortField: "firstName", cell: row => row.id },
  { id: "actions", header: "Actions", cell: row => row.id },
];
describe("list sort control", () => {
  it("leaves the prompt visible when the server default has no column option", () => {
    const { result } = renderHook(() => useDataTableSort(columns, vi.fn(), {id:"createdAt",direction:"desc"}));
    expect(result.current.selected).toBe("");
  });
  it("uses the declared server sort field and direction", () => {
    const onChange=vi.fn();
    const { result }=renderHook(()=>useDataTableSort(columns,onChange));
    act(()=>result.current.select("firstName:desc"));
    expect(onChange).toHaveBeenCalledWith({ id:"firstName",direction:"desc" });
  });
  it("refuses unknown fields, display-only columns and invalid directions", () => {
    const onChange=vi.fn();
    const { result }=renderHook(()=>useDataTableSort(columns,onChange));
    act(()=>{ for(const value of ["secret:asc","actions:asc","firstName:up"]) result.current.select(value); });
    expect(onChange).not.toHaveBeenCalled();
  });
});
