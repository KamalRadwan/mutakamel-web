import { fixedDecimalUnits } from "../documents/fixed-decimal";

export interface ValidTierRange {
  rowIndex: number;
  itemId: string;
  uomId: string;
  currencyCode: string;
  priority: number;
  minimumQuantity: string;
  maximumQuantity: string | null;
}

/** One concrete conflicting predecessor per row is sufficient to block an invalid draft. */
export function findTierOverlaps(rows: readonly ValidTierRange[]) {
  const groups = new Map<string, (ValidTierRange & { min: bigint; max: bigint | null })[]>();
  for (const row of rows) {
    const key = JSON.stringify([row.itemId, row.uomId, row.currencyCode, row.priority]);
    const group = groups.get(key) ?? [];
    group.push({ ...row, min: fixedDecimalUnits(row.minimumQuantity), max: row.maximumQuantity === null ? null : fixedDecimalUnits(row.maximumQuantity) });
    groups.set(key, group);
  }
  const conflicts: { rowIndexes: number[]; itemId: string; uomId: string; overlapStart: string; overlapEnd: string | null }[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => a.min < b.min ? -1 : a.min > b.min ? 1 : a.rowIndex - b.rowIndex);
    let predecessor = group[0];
    for (const row of group.slice(1)) {
      if (!predecessor) break;
      if (predecessor.max === null || predecessor.max > row.min) {
        const end = predecessor.max === null ? row.maximumQuantity : row.max === null || predecessor.max < row.max ? predecessor.maximumQuantity : row.maximumQuantity;
        conflicts.push({ rowIndexes: [predecessor.rowIndex, row.rowIndex], itemId: row.itemId, uomId: row.uomId, overlapStart: row.minimumQuantity, overlapEnd: end });
      }
      if (predecessor.max !== null && (row.max === null || row.max > predecessor.max)) predecessor = row;
    }
  }
  return conflicts;
}
