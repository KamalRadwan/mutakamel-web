import { valueShape } from './query-operators';
import type { Condition, Group, Query, QueryField, Value } from './query.model';

function isMissingBound(bound: unknown): boolean {
  if (bound === undefined || bound === null) return true;
  if (typeof bound === 'string') return bound.trim() === '';
  if (typeof bound === 'number') return Number.isNaN(bound);
  return false;
}

function isIncompleteCondition(cond: Condition): boolean {
  if (!cond.field.trim() || cond.operator === null) return true;
  const shape = valueShape(cond.operator);
  if (shape === 'none') return false;
  if (cond.value === undefined || cond.value === null) return true;
  if (typeof cond.value === 'string') return cond.value.trim() === '';
  if (typeof cond.value === 'number') return Number.isNaN(cond.value);
  if (shape === 'list') {
    return (
      !Array.isArray(cond.value) ||
      cond.value.length === 0 ||
      cond.value.some((item) => isMissingBound(item))
    );
  }
  if (shape === 'range') {
    return (
      !Array.isArray(cond.value) ||
      cond.value.length !== 2 ||
      isMissingBound(cond.value[0]) ||
      isMissingBound(cond.value[1])
    );
  }
  return false;
}

function normalizeListValues(items: (string | number)[]): string[] | number[] {
  if (items.length === 0) return [];
  if (items.every((item): item is number => typeof item === 'number')) {
    return Array.from(new Set(items)).sort((a, b) => a - b);
  }
  const trimmed = items.map((item) => (typeof item === 'string' ? item.trim() : String(item)));
  return Array.from(new Set(trimmed)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function normalizeCondition(cond: Condition, dropIncomplete: boolean): Condition | null {
  if (dropIncomplete && isIncompleteCondition(cond)) return null;
  if (cond.operator === null) return cond;

  const shape = valueShape(cond.operator);
  if (shape === 'none') {
    return cond.value === undefined ? cond : { ...cond, value: undefined };
  }

  let value: Value | undefined = cond.value;

  if (typeof value === 'string') {
    value = value.trim();
  } else if (shape === 'range' && Array.isArray(value) && value.length === 2) {
    const [from, to] = value;
    if (typeof from === 'string' && typeof to === 'string') {
      value = [from.trim(), to.trim()];
    }
  } else if (shape === 'list' && Array.isArray(value)) {
    const sorted = normalizeListValues(value);
    if (sorted.length === 0 && dropIncomplete) return null;

    if (cond.operator === 'in' && sorted.length === 1) {
      return { ...cond, operator: 'eq', value: sorted[0] };
    }
    if (cond.operator === 'nin' && sorted.length === 1) {
      return { ...cond, operator: 'neq', value: sorted[0] };
    }
    value = sorted;
  }

  return { ...cond, value };
}

function normalizeGroup(
  group: Group,
  dropIncomplete: boolean,
  isRoot: boolean,
): Group | Condition | null {
  const children: (Condition | Group)[] = [];

  for (const child of group.children) {
    if (child.kind === 'condition') {
      const normalized = normalizeCondition(child, dropIncomplete);
      if (normalized !== null) children.push(normalized);
    } else {
      const normalized = normalizeGroup(child, dropIncomplete, false);
      if (normalized === null) continue;
      if (normalized.kind === 'group' && normalized.op === group.op) {
        children.push(...normalized.children);
      } else {
        children.push(normalized);
      }
    }
  }

  if (!isRoot) {
    if (children.length === 0) return null;
    if (children.length === 1) return children[0];
  }

  return { ...group, children };
}

export function normalize(
  query: Query,
  _fields: QueryField[],
  options?: { dropIncomplete?: boolean },
): Query {
  const dropIncomplete = options?.dropIncomplete ?? false;
  const fixed: Condition[] = [];
  for (const cond of query.fixed) {
    const normalized = normalizeCondition(cond, dropIncomplete);
    if (normalized !== null) fixed.push(normalized);
  }

  const root = normalizeGroup(query.root, dropIncomplete, true) as Group;
  return { root, fixed };
}
