import { generateUUIDv7 } from "@/lib/uuid";
import { inspectorClone, inspectorRecords } from "./inspector-contract";
import type { TableOperation } from "./inspector-table";

interface Anchor { row: number; column: number; rows: number; columns: number; cell: Record<string, unknown> }
function anchorsOf(columns: Record<string, unknown>[], rows: Record<string, unknown>[]): Anchor[] | null {
  const anchors: Anchor[] = [], occupied = new Set<string>();
  for (let row = 0; row < rows.length; row++) for (const cell of inspectorRecords(rows[row].cells)) {
    const column = columns.findIndex(column => column.id === cell.columnId), height = Number(cell.rowSpan), width = Number(cell.colSpan);
    if (column < 0 || !Number.isInteger(height) || !Number.isInteger(width) || height < 1 || width < 1 || row + height > rows.length || column + width > columns.length) return null;
    for (let y = row; y < row + height; y++) for (let x = column; x < column + width; x++) {
      const key = `${y}:${x}`; if (occupied.has(key)) return null; occupied.add(key);
    }
    anchors.push({ row, column, rows: height, columns: width, cell });
  }
  return occupied.size === columns.length * rows.length ? anchors : null;
}
const emptyCell = () => ({ id: generateUUIDv7(), value: { kind: "TEXT", value: "" } });
function rebuild(columns: Record<string, unknown>[], rows: Record<string, unknown>[], anchors: Anchor[]): boolean {
  for (let row = 0; row < rows.length; row++) {
    rows[row].cells = anchors.filter(anchor => anchor.row === row).sort((a, b) => a.column - b.column).map(anchor => ({ ...anchor.cell, columnId: columns[anchor.column].id, rowSpan: anchor.rows, colSpan: anchor.columns }));
    // The owner V1 row schema requires at least one anchored cell per row.
    if (!(rows[row].cells as unknown[]).length) return false;
  }
  return anchorsOf(columns, rows) !== null;
}

/** Span-aware row/column edits. Swaps crossing a merged span are explicitly refused. */
export function editInspectorGrid(inputColumns: Record<string, unknown>[], inputRows: Record<string, unknown>[], operation: TableOperation, insertedColumn?: Record<string, unknown>) {
  const columns = inspectorClone(inputColumns), rows = inspectorClone(inputRows), anchors = anchorsOf(columns, rows);
  if (!anchors) return null;
  const count = operation.axis === "row" ? rows.length : columns.length, index = operation.index;
  if (index < 0 || index > count || !Number.isInteger(index) || (operation.kind !== "insert" && index === count)) return null;
  const start = operation.axis === "row" ? "row" : "column", span = operation.axis === "row" ? "rows" : "columns";
  if (operation.kind === "insert") {
    if (count >= (operation.axis === "row" ? 100 : 30)) return null;
    if (operation.axis === "row") rows.splice(index, 0, { id: generateUUIDv7(), cells: [] });
    else { if (!insertedColumn) return null; columns.splice(index, 0, inspectorClone(insertedColumn)); }
    for (const anchor of anchors) {
      if (anchor[start] < index && anchor[start] + anchor[span] > index) anchor[span] += 1;
      else if (anchor[start] >= index) anchor[start] += 1;
    }
    const otherCount = operation.axis === "row" ? columns.length : rows.length;
    for (let other = 0; other < otherCount; other++) {
      const y = operation.axis === "row" ? index : other, x = operation.axis === "column" ? index : other;
      if (!anchors.some(anchor => y >= anchor.row && y < anchor.row + anchor.rows && x >= anchor.column && x < anchor.column + anchor.columns)) anchors.push({ row: y, column: x, rows: 1, columns: 1, cell: emptyCell() });
    }
  } else if (operation.kind === "remove") {
    if (count <= 1) return null;
    (operation.axis === "row" ? rows : columns).splice(index, 1);
    for (let at = anchors.length - 1; at >= 0; at--) {
      const anchor = anchors[at], end = anchor[start] + anchor[span];
      if (anchor[start] === index && anchor[span] === 1) { anchors.splice(at, 1); continue; }
      if (anchor[start] <= index && end > index) anchor[span] -= 1;
      if (anchor[start] > index) anchor[start] -= 1;
    }
  } else if (operation.kind === "move") {
    const target = index + operation.delta;
    if (target < 0 || target >= count || anchors.some(anchor => anchor[span] > 1 && [index, target].some(value => value >= anchor[start] && value < anchor[start] + anchor[span]))) return null;
    const values = operation.axis === "row" ? rows : columns;
    [values[index], values[target]] = [values[target], values[index]];
    for (const anchor of anchors) {
      if (anchor[start] === index) anchor[start] = target;
      else if (anchor[start] === target) anchor[start] = index;
    }
  }
  return rebuild(columns, rows, anchors) ? { columns, rows } : null;
}

export function mergeInspectorGrid(inputColumns: Record<string, unknown>[], inputRows: Record<string, unknown>[], startRow: number, endRow: number, startColumn: number, endColumn: number, unmerge = false) {
  const columns = inspectorClone(inputColumns), rows = inspectorClone(inputRows), anchors = anchorsOf(columns, rows);
  if (!anchors || ![startRow, endRow, startColumn, endColumn].every(Number.isInteger) || startRow < 0 || startColumn < 0 || endRow >= rows.length || endColumn >= columns.length || endRow < startRow || endColumn < startColumn) return null;
  if (unmerge) {
    const anchor = anchors.find(anchor => startRow >= anchor.row && startRow < anchor.row + anchor.rows && startColumn >= anchor.column && startColumn < anchor.column + anchor.columns);
    if (!anchor || (anchor.rows === 1 && anchor.columns === 1)) return null;
    const height = anchor.rows, width = anchor.columns; anchor.rows = 1; anchor.columns = 1;
    for (let y = anchor.row; y < anchor.row + height; y++) for (let x = anchor.column; x < anchor.column + width; x++) {
      if (y !== anchor.row || x !== anchor.column) anchors.push({ row: y, column: x, rows: 1, columns: 1, cell: { ...emptyCell(), ...(anchor.cell.style ? { style: inspectorClone(anchor.cell.style) } : {}) } });
    }
  } else {
    if (startRow === endRow && startColumn === endColumn) return null;
    const intersects = anchors.filter(anchor => anchor.row <= endRow && anchor.row + anchor.rows > startRow && anchor.column <= endColumn && anchor.column + anchor.columns > startColumn);
    if (intersects.some(anchor => anchor.row < startRow || anchor.column < startColumn || anchor.row + anchor.rows - 1 > endRow || anchor.column + anchor.columns - 1 > endColumn)) return null;
    const first = intersects.find(anchor => anchor.row === startRow && anchor.column === startColumn);
    if (!first) return null;
    for (const anchor of intersects) if (anchor !== first) anchors.splice(anchors.indexOf(anchor), 1);
    first.rows = endRow - startRow + 1; first.columns = endColumn - startColumn + 1;
  }
  return rebuild(columns, rows, anchors) ? { columns, rows } : null;
}
