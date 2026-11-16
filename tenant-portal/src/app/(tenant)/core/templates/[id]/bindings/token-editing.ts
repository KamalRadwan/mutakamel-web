import { dataClone, dataRecord, type DataValue } from "./binding-contract";

export function tokenRows(value: unknown): DataValue[] { return Array.isArray(value) ? value.map(dataRecord) : []; }
export function moveToken(rows: DataValue[], index: number, delta: -1 | 1): DataValue[] {
  const next = [...rows], target = index + delta;
  if (target < 0 || target >= rows.length) return next;
  [next[index], next[target]] = [next[target], next[index]]; return next;
}
export function richParagraphs(value: unknown, path: number[] = []): { path: number[]; paragraph: DataValue }[] {
  return tokenRows(dataRecord(value).content).flatMap((node, index) => node.type === "paragraph" ? [{ path: [...path, index], paragraph: node }] : richParagraphs(node, [...path, index]));
}
export function replaceRichParagraph(value: unknown, path: number[], content: DataValue[]): DataValue {
  const next = dataClone(dataRecord(value)); let node = next;
  for (const index of path) node = tokenRows(node.content)[index];
  node.content = content; return next;
}
