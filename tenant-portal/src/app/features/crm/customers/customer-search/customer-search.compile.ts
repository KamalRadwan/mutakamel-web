import { resolveDate } from '../../../../shared/query-builder/query-dates';
import { normalize } from '../../../../shared/query-builder/query-normalize';
import { Condition, Group, Operator, Query, QueryField, Value } from '../../../../shared/query-builder/query.model';
import {
  CustomerFilterItem,
  CustomerFilterNode,
  CustomerSearchBody,
  CustomerSearchField,
} from '../customers.model';
import { RecordSearchRejected } from '../../shared/record/search/record-search.model';
import { customerSearchFields } from './customer-search.fields';

export interface CompileCustomerContext {
  branchId: string;
  meUserId: string;
  timeZone: string;
  now?: Date;
}

const TEXT_SEARCH_FIELDS = new Set<CustomerSearchField>(['customer', 'email', 'phone']);
const ROOT_FIELD_IDS = new Set(['customer', 'email', 'phone', 'tags']);
const DATE_WIRE_FIELDS = new Set(['createdAt', 'updatedAt']);

const WIRE_FIELD_MAP: Record<string, string> = {
  status: 'status',
  profileType: 'profileType',
  ownerUserId: 'ownerUserId',
  acquisitionSourceId: 'acquisitionSourceId',
  rating: 'rating',
  cardColor: 'cardColor',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  description: 'description',
  fromLead: 'sourceLeadId',
};

const COMPILE_FIELDS: QueryField[] = customerSearchFields({
  t: (key) => key,
  sources: [],
  tags: [],
  owners: async () => [],
  language: 'en',
});

/** Strip everything except digits and `+`, turning a leading `00` into `+`. */
export function normalizePhoneTerm(raw: string): string {
  const cleaned = raw.trim().replace(/[^\d+]/g, '');
  if (cleaned.startsWith('00')) return `+${cleaned.slice(2)}`;
  return cleaned;
}

function isGroupWire(node: CustomerFilterNode): node is { op: 'AND' | 'OR'; children: CustomerFilterNode[] } {
  return 'op' in node;
}

function resolveMeValue(value: Value | undefined, meUserId: string): unknown {
  if (value === '$me') return meUserId;
  if (Array.isArray(value)) {
    return value.map((item) => (item === '$me' ? meUserId : item));
  }
  return value;
}

function compileDateCondition(
  wireField: string,
  op: Operator,
  value: Value | undefined,
  ctx: CompileCustomerContext,
): CustomerFilterNode | null {
  if (op === 'isNull' || op === 'isNotNull') {
    return { field: wireField, operator: op };
  }
  const resolved = resolveDate(op, value ?? null, ctx.timeZone || 'UTC', ctx.now);
  if (resolved.isNull !== undefined) {
    return { field: wireField, operator: resolved.isNull ? 'isNull' : 'isNotNull' };
  }
  if (op === 'on' || op === 'between' || op === 'relative') {
    if (resolved.gte !== undefined && resolved.lt !== undefined) {
      return {
        op: 'AND',
        children: [
          { field: wireField, operator: 'gte', value: resolved.gte },
          { field: wireField, operator: 'lt', value: resolved.lt },
        ],
      };
    }
    if (resolved.gte !== undefined) return { field: wireField, operator: 'gte', value: resolved.gte };
    if (resolved.lt !== undefined) return { field: wireField, operator: 'lt', value: resolved.lt };
    return null;
  }
  if (op === 'before') {
    return resolved.lt !== undefined ? { field: wireField, operator: 'lt', value: resolved.lt } : null;
  }
  if (op === 'after') {
    return resolved.gte !== undefined ? { field: wireField, operator: 'gte', value: resolved.gte } : null;
  }
  const bound = op === 'lte' ? (resolved.lt ?? value) : (resolved.gte ?? value);
  return bound !== undefined && bound !== null ? { field: wireField, operator: op, value: bound } : null;
}

function compileCondition(
  cond: Condition,
  ctx: CompileCustomerContext,
  rejected: RecordSearchRejected[],
  insideRootAnd: boolean,
): CustomerFilterNode | null {
  if (ROOT_FIELD_IDS.has(cond.field)) {
    if (!insideRootAnd) {
      rejected.push({ field: cond.field, reasonKey: 'ROOT_ONLY' });
    }
    return null;
  }

  const wireField = WIRE_FIELD_MAP[cond.field];
  if (!wireField || !cond.operator) {
    if (cond.field && cond.operator) {
      rejected.push({ field: cond.field, reasonKey: 'UNSUPPORTED' });
    }
    return null;
  }

  const op = cond.operator;

  if (cond.field === 'fromLead') {
    if (typeof cond.value !== 'boolean') return null;
    const isFromLead = op === 'neq' ? !cond.value : cond.value;
    return { field: 'sourceLeadId', operator: isFromLead ? 'isNotNull' : 'isNull' };
  }

  if (op === 'isNull' || op === 'isNotNull') {
    return { field: wireField, operator: op };
  }

  if (DATE_WIRE_FIELDS.has(wireField)) {
    return compileDateCondition(wireField, op, cond.value, ctx);
  }

  let value = resolveMeValue(cond.value, ctx.meUserId);
  if (value === undefined || value === null) return null;

  if (typeof value === 'string') {
    value = value.trim();
    if (value === '' && (op === 'contains' || op === 'ilike' || op === 'startsWith' || op === 'endsWith')) {
      return null;
    }
    if (value === '' && (op === 'eq' || op === 'neq' || op === 'is')) {
      return null;
    }
  }

  if (Array.isArray(value)) {
    if (op === 'ilikeAny') {
      const patterns = value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
      return patterns.length > 0 ? { field: wireField, operator: 'ilikeAny', value: patterns } : null;
    }
    if (op === 'in' || op === 'nin') {
      const cleaned = value.filter((item) => item !== '' && item !== null && item !== undefined);
      if (cleaned.length === 0) return null;
      if (cleaned.length === 1) {
        return { field: wireField, operator: op === 'in' ? 'eq' : 'neq', value: cleaned[0] };
      }
      return { field: wireField, operator: op, value: cleaned };
    }
    if (op === 'between') {
      return value.length === 2 && value[0] !== null && value[1] !== null
        ? { field: wireField, operator: 'between', value }
        : null;
    }
    return { field: wireField, operator: op, value };
  }

  return { field: wireField, operator: op, value };
}

function compileGroup(
  group: Group,
  ctx: CompileCustomerContext,
  rejected: RecordSearchRejected[],
  isRoot: boolean,
): CustomerFilterNode | null {
  const children: CustomerFilterNode[] = [];
  const insideRootAnd = isRoot && group.op === 'AND';

  for (const child of group.children) {
    if (child.kind === 'condition') {
      const leaf = compileCondition(child, ctx, rejected, insideRootAnd);
      if (leaf) {
        if (isGroupWire(leaf) && leaf.op === group.op) {
          children.push(...leaf.children);
        } else {
          children.push(leaf);
        }
      }
      continue;
    }

    const compiledChild = compileGroup(child, ctx, rejected, false);
    if (!compiledChild) continue;
    if (isGroupWire(compiledChild) && compiledChild.op === group.op) {
      children.push(...compiledChild.children);
    } else {
      children.push(compiledChild);
    }
  }

  if (children.length === 0) return null;
  if (children.length === 1) return children[0];
  return { op: group.op, children };
}

function extractTagIds(value: Value | undefined): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function applyRootCondition(cond: Condition, body: CustomerSearchBody, rejected: RecordSearchRejected[]): void {
  if (TEXT_SEARCH_FIELDS.has(cond.field as CustomerSearchField)) {
    if (typeof cond.value !== 'string') return;
    const field = cond.field as CustomerSearchField;
    const term = field === 'phone' ? normalizePhoneTerm(cond.value) : cond.value.trim();
    if (!term) return;
    if (body.search !== undefined) {
      rejected.push({ field, reasonKey: 'EXCLUSIVE' });
      return;
    }
    body.search = term;
    body.searchField = field;
    return;
  }

  if (cond.field === 'tags') {
    const tagIds = extractTagIds(cond.value);
    if (tagIds.length === 0) return;
    if (body.tagIds && body.tagIds.length > 0) {
      rejected.push({ field: 'tags', reasonKey: 'SINGLETON' });
      return;
    }
    body.tagIds = Array.from(new Set(tagIds));
  }
}

function flattenAndLeaves(node: CustomerFilterNode): CustomerFilterItem[] | null {
  if (!isGroupWire(node)) {
    return [{ field: node.field, operator: node.operator, value: node.value }];
  }
  if (node.op !== 'AND') return null;
  const items: CustomerFilterItem[] = [];
  for (const child of node.children) {
    const nested = flattenAndLeaves(child);
    if (!nested) return null;
    items.push(...nested);
  }
  return items;
}

/** Compile a UI Query into CustomerSearchBody (`filter[]` for flat AND chips/conditions, `filterTree` for nested/OR trees). */
export function compileCustomerQuery(
  query: Query,
  ctx: CompileCustomerContext,
): { body: CustomerSearchBody; rejected: RecordSearchRejected[] } {
  const normalized = normalize(query, COMPILE_FIELDS);
  const body: CustomerSearchBody = { branchId: ctx.branchId };
  const rejected: RecordSearchRejected[] = [];

  for (const cond of normalized.fixed) {
    applyRootCondition(cond, body, rejected);
  }

  if (normalized.root.op === 'AND') {
    for (const child of normalized.root.children) {
      if (child.kind === 'condition' && ROOT_FIELD_IDS.has(child.field)) {
        applyRootCondition(child, body, rejected);
      }
    }
  }

  const compiledTree = compileGroup(normalized.root, ctx, rejected, true);
  if (compiledTree) {
    const flatItems = normalized.root.op === 'AND' ? flattenAndLeaves(compiledTree) : null;
    if (flatItems && flatItems.length > 0) {
      body.filter = flatItems;
    } else {
      body.filterTree = compiledTree;
    }
  }

  return { body, rejected };
}
