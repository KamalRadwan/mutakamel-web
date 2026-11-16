import { generateUUIDv7 } from "@/lib/uuid";
import type { EditorNode } from "../../template-editor-model";
import { inspectorClone, inspectorRecord, inspectorRecords } from "./inspector-contract";
import { editInspectorGrid, mergeInspectorGrid } from "./inspector-grid";

export type TableOperation = { kind: "insert" | "remove"; axis: "row" | "column"; index: number } | { kind: "move"; axis: "row" | "column"; index: number; delta: -1 | 1 };

function insertedColumn(dynamic: boolean) {
  return { id: generateUUIDv7(), width: { value: 1, unit: "PERCENT" }, align: "START", verticalAlign: "TOP", wrap: true, visible: true,
    ...(dynamic ? { header: { kind: "TEXT", value: "" }, value: { kind: "TEXT", value: "" } } : {}) };
}

/** Preserve cell identities and ASTs; schema admission remains mandatory after this local edit. */
export function changeInspectorTable(node: EditorNode, operation: TableOperation): EditorNode | null {
  if (!["staticTable", "dynamicTable"].includes(node.type) || !Number.isInteger(operation.index)) return null;
  if (operation.axis === "row" && node.type !== "staticTable") return null;
  const next = inspectorClone(node), dynamic = node.type === "dynamicTable";
  const columns = inspectorRecords(next.props.columns), rows = inspectorRecords(next.props.rows);
  const added = operation.kind === "insert" && operation.axis === "column" ? insertedColumn(dynamic) : undefined;
  if (!dynamic) {
    const grid = editInspectorGrid(columns, rows, operation, added);
    if (!grid) return null;
    next.props.columns = grid.columns; next.props.rows = grid.rows;
  } else {
    const values = [...columns], index = operation.index;
    if (index < 0 || index > values.length || (operation.kind !== "insert" && index === values.length)) return null;
    if (operation.kind === "insert") { if (!added || values.length >= 30) return null; values.splice(index, 0, added); }
    if (operation.kind === "remove") { if (values.length <= 1) return null; values.splice(index, 1); }
    if (operation.kind === "move") { const target = index + operation.delta; if (target < 0 || target >= values.length) return null; [values[index], values[target]] = [values[target], values[index]]; }
    for (const key of ["headerBands", "footerBands"] as const) {
      if (!Array.isArray(next.props[key])) continue;
      const bands = inspectorRecords(next.props[key]);
      for (const band of bands) {
        const grid = editInspectorGrid(columns, inspectorRecords(band.rows), operation, added);
        if (!grid) return null;
        band.rows = grid.rows;
      }
      next.props[key] = bands;
    }
    next.props.columns = values;
  }
  if (operation.axis === "column" && operation.kind !== "move") inspectorRecords(next.props.columns).forEach(column => { column.width = { value: 100 / inspectorRecords(next.props.columns).length, unit: "PERCENT" }; });
  const fixed = inspectorRecord(next.props.fixedCanvas);
  if (!dynamic && Array.isArray(fixed.rowHeightsMm) && operation.axis === "row") {
    const heights = [...fixed.rowHeightsMm], index = operation.index;
    if (operation.kind === "insert") heights.splice(index, 0, Number(heights[Math.min(index, heights.length - 1)] ?? 10));
    if (operation.kind === "remove") heights.splice(index, 1);
    if (operation.kind === "move") [heights[index], heights[index + operation.delta]] = [heights[index + operation.delta], heights[index]];
    next.props.fixedCanvas = { ...fixed, rowHeightsMm: heights };
  }
  return next;
}

export function mergeInspectorTable(node: EditorNode, startRow: number, endRow: number, startColumn: number, endColumn: number, unmerge = false): EditorNode | null {
  if (node.type !== "staticTable") return null;
  const grid = mergeInspectorGrid(inspectorRecords(node.props.columns), inspectorRecords(node.props.rows), startRow, endRow, startColumn, endColumn, unmerge);
  return grid ? { ...node, props: { ...node.props, columns: grid.columns, rows: grid.rows } } : null;
}

export function updateInspectorCollection(node: EditorNode, key: "columns" | "rows", index: number, patch: Record<string, unknown>): EditorNode {
  const values = inspectorRecords(node.props[key]);
  return { ...node, props: { ...node.props, [key]: values.map((value, at) => at === index ? { ...value, ...patch } : value) } };
}
