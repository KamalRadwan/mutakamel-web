import { resolveDate } from '../../../../shared/query-builder/query-dates';
import { Condition, Group, Operator, Query, QueryField, Value } from '../../../../shared/query-builder/query.model';
import { normalize } from '../../../../shared/query-builder/query-normalize';
import { leadSearchFields } from './lead-search.fields';

export type LeadSearchField = 'lead' | 'customer' | 'email' | 'phone';

export interface LeadSearchBody {
  /** Branch scope; the backend requires a UUIDv7 (`LeadSearchFiltersDto.branchId`) for search, board, kpis, selection and bulk queries. */
  branchId: string;
  search?: string;
  searchField?: LeadSearchField;
  tagIds?: string[];
  hasOverdueActivity?: boolean;
  filterTree?: WireNode;
}

export type WireNode =
  | { op: 'AND' | 'OR'; children: WireNode[] }
  | { field: string; operator: string; value?: unknown };

export interface CompileLeadContext {
  branchId: string;
  meUserId: string;
  timeZone: string;
  now?: Date;
}

const TEXT_SEARCH_FIELDS = new Set<LeadSearchField>(['lead', 'customer', 'email', 'phone']);
const ROOT_FIELD_IDS = new Set(['lead', 'customer', 'email', 'phone', 'tag', 'overdue']);
const DATE_WIRE_FIELDS = new Set(['createdAt', 'updatedAt', 'convertedAt', 'qualifiedAt', 'disqualifiedAt']);

const WIRE_FIELD_MAP: Record<string, string> = {
  leadType: 'leadProfileType',
  source: 'acquisitionSourceId',
  stage: 'stageId',
  stageFlag: 'stageFlag',
  status: 'status',
  owner: 'ownerUserId',
  createdBy: 'createdByUserId',
  rating: 'rating',
  cardColor: 'cardColor',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  convertedAt: 'convertedAt',
  description: 'description',
  interestSummary: 'interestSummary',
  expectedNeed: 'expectedNeed',
  leadProfileType: 'leadProfileType',
  acquisitionSourceId: 'acquisitionSourceId',
  stageId: 'stageId',
  ownerUserId: 'ownerUserId',
  createdByUserId: 'createdByUserId',
  disqualificationReasonId: 'disqualificationReasonId',
  qualifiedAt: 'qualifiedAt',
  disqualifiedAt: 'disqualifiedAt',
  convertedCustomerId: 'convertedCustomerId',
};

const COMPILE_FIELDS: QueryField[] = leadSearchFields({
  t: (k) => k,
  stages: [],
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

function isGroupWire(node: WireNode): node is { op: 'AND' | 'OR'; children: WireNode[] } {
  return 'op' in node;
}

function resolveMeValue(value: Value | undefined, meUserId: string): unknown {
  if (value === '$me') return meUserId;
  if (Array.isArray(value)) {
    return value.map((item) => (item === '$me' ? meUserId : item));
  }
  return value;
}

function compileDateCondition(wireField: string, op: Operator, value: Value | undefined, ctx: CompileLeadContext): WireNode | null {
  if (op === 'isNull' || op === 'isNotNull') {
    return { field: wireField, operator: op };
  }
  const resolved = resolveDate(op, value ?? null, ctx.timeZone, ctx.now);
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

function compileCondition(cond: Condition, ctx: CompileLeadContext): WireNode | null {
  if (ROOT_FIELD_IDS.has(cond.field)) return null;
  const wireField = WIRE_FIELD_MAP[cond.field];
  if (!wireField || !cond.operator) return null;

  const op = cond.operator;
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
    if ((op === 'contains' || op === 'ilike' || op === 'startsWith' || op === 'endsWith') && value === '') {
      return null;
    }
  }

  if (Array.isArray(value)) {
    if (op === 'ilikeAny') {
      const patterns = value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
      return patterns.length > 0 ? { field: wireField, operator: 'ilikeAny', value: patterns } : null;
    }
    if (op === 'in' || op === 'nin') {
      if (value.length === 0) return null;
      if (value.length === 1) {
        return { field: wireField, operator: op === 'in' ? 'eq' : 'neq', value: value[0] };
      }
      return { field: wireField, operator: op, value };
    }
    if (op === 'between') {
      return value.length === 2 && value[0] !== null && value[1] !== null ? { field: wireField, operator: 'between', value } : null;
    }
    return { field: wireField, operator: op, value };
  }

  return { field: wireField, operator: op, value };
}

function compileGroup(group: Group, ctx: CompileLeadContext): WireNode | null {
  const children: WireNode[] = [];

  for (const child of group.children) {
    if (child.kind === 'condition') {
      const leaf = compileCondition(child, ctx);
      if (leaf) children.push(leaf);
      continue;
    }

    const compiledChild = compileGroup(child, ctx);
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
    return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function applyFixedCondition(cond: Condition, body: LeadSearchBody): void {
  if (TEXT_SEARCH_FIELDS.has(cond.field as LeadSearchField)) {
    if (typeof cond.value !== 'string') return;
    const field = cond.field as LeadSearchField;
    const term = field === 'phone' ? normalizePhoneTerm(cond.value) : cond.value.trim();
    if (!term) return;
    body.search = term;
    body.searchField = field;
    return;
  }

  if (cond.field === 'tag') {
    const tagIds = extractTagIds(cond.value);
    if (tagIds.length > 0) body.tagIds = tagIds;
    return;
  }

  if (cond.field === 'overdue' && typeof cond.value === 'boolean') {
    body.hasOverdueActivity = cond.operator === 'neq' ? !cond.value : cond.value;
  }
}

/** Compile a UI Query into the backend POST /leads/search body. */
export function compileLeadQuery(query: Query, ctx: CompileLeadContext): LeadSearchBody {
  const normalized = normalize(query, COMPILE_FIELDS);
  const body: LeadSearchBody = { branchId: ctx.branchId };

  for (const cond of normalized.fixed) {
    applyFixedCondition(cond, body);
  }

  if (normalized.root.op === 'AND') {
    for (const child of normalized.root.children) {
      if (child.kind === 'condition' && ROOT_FIELD_IDS.has(child.field)) {
        applyFixedCondition(child, body);
      }
    }
  }

  const filterTree = compileGroup(normalized.root, ctx);
  if (filterTree) {
    body.filterTree = filterTree;
  }

  return body;
}
