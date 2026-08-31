import { describe, expect, it } from "vitest";
import {
  applyColumnLayout,
  columnWidth,
  initialOrder,
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  moveColumn,
  resolveColumnLayout,
  setColumnWidth,
} from "./column-layout";
import type { ColumnDef } from "./types";

interface Row {
  id: string;
}

const cell = () => null;

const columns: ColumnDef<Row>[] = [
  { id: "select", header: "", cell, sticky: "start" },
  { id: "name", header: "Name", cell },
  { id: "stage", header: "Stage", cell },
  { id: "owner", header: "Owner", cell },
  { id: "actions", header: "Actions", cell, sticky: "end" },
];

describe("column order", () => {
  it("excludes sticky columns from the reorderable set", () => {
    expect(initialOrder(columns)).toEqual(["name", "stage", "owner"]);
  });

  it("applies a stored order and keeps sticky columns pinned to their edges", () => {
    const applied = applyColumnLayout(columns, { order: ["owner", "name", "stage"], widths: {} });
    expect(applied.map((column) => column.id)).toEqual(["select", "owner", "name", "stage", "actions"]);
  });

  it("refuses to move a sticky column out of its edge, even if the order names it", () => {
    const applied = applyColumnLayout(columns, { order: ["actions", "name"], widths: {} });
    expect(applied.map((column) => column.id)).toEqual(["select", "name", "stage", "owner", "actions"]);
  });

  it("appends a column the stored layout has never seen", () => {
    const layout = resolveColumnLayout(columns, { order: ["owner", "name"], widths: {} });
    expect(layout.order).toEqual(["owner", "name", "stage"]);
  });

  it("drops an id for a column that no longer exists", () => {
    const layout = resolveColumnLayout(columns, { order: ["gone", "name", "stage", "owner"], widths: {} });
    expect(layout.order).toEqual(["name", "stage", "owner"]);
  });

  it("moves a column one place in either direction", () => {
    expect(moveColumn(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveColumn(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
  });

  it("does not move past either end", () => {
    expect(moveColumn(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(moveColumn(["a", "b"], "b", 1)).toEqual(["a", "b"]);
  });

  it("ignores an unknown id rather than corrupting the order", () => {
    expect(moveColumn(["a", "b"], "zzz", 1)).toEqual(["a", "b"]);
  });
});

describe("column width", () => {
  it("clamps to the readable range in both directions", () => {
    expect(setColumnWidth({}, "name", 4).name).toBe(MIN_COLUMN_WIDTH);
    expect(setColumnWidth({}, "name", 9999).name).toBe(MAX_COLUMN_WIDTH);
  });

  it("rounds to whole pixels", () => {
    expect(setColumnWidth({}, "name", 200.6).name).toBe(201);
  });

  it("leaves other columns untouched", () => {
    expect(setColumnWidth({ stage: 120 }, "name", 200)).toEqual({ stage: 120, name: 200 });
  });

  it("falls back to the declared width when nothing is stored", () => {
    const declared: ColumnDef<Row> = { id: "name", header: "Name", cell, width: "12rem" };
    expect(columnWidth(declared, { order: [], widths: {} })).toBe("12rem");
    expect(columnWidth(declared, { order: [], widths: { name: 200 } })).toBe("200px");
  });
});
