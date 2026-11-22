import { ApiError } from '../../settings/shared/settings-api';
import { LeadRow } from '../leads.model';
import { LeadSearchBody, WireNode, normalizePhoneTerm } from './lead-search.compile';

export interface LeadDetail {
  createdByUserId?: string | null;
  createdAt?: string | null;
  convertedAt?: string | null;
  description?: string | null;
  expectedNeed?: string | null;
  disqualificationReasonId?: string | null;
  qualifiedAt?: string | null;
  disqualifiedAt?: string | null;
  convertedCustomerId?: string | null;
}

const ALLOWED_WIRE_FIELDS = new Set([
  'leadProfileType',
  'acquisitionSourceId',
  'stageId',
  'stageFlag',
  'status',
  'ownerUserId',
  'createdByUserId',
  'rating',
  'cardColor',
  'createdAt',
  'updatedAt',
  'convertedAt',
  'description',
  'interestSummary',
  'expectedNeed',
  'disqualificationReasonId',
  'qualifiedAt',
  'disqualifiedAt',
  'convertedCustomerId',
]);

const DATE_FIELDS = new Set(['createdAt', 'updatedAt', 'convertedAt', 'qualifiedAt', 'disqualifiedAt']);
const MAX_DEPTH = 5;
const MAX_LEAVES = 100;

type WireLeaf = { field: string; operator: string; value?: unknown };

function isWireGroup(node: WireNode): node is { op: 'AND' | 'OR'; children: WireNode[] } {
  return 'op' in node;
}

/**
 * lead-filter-spec validateLeaf: details are string arrays. INVALID_FIELD { field, path };
 * INVALID_OPERATOR_VALUE { path, field, operator, reason (lowercase LEAD_FILTER_VALUE_REASONS), expected? }.
 */
function invalidValue(leaf: WireLeaf, path: string, reason: string, expected?: string): ApiError {
  return new ApiError(400, 'INVALID_OPERATOR_VALUE', {
    path: [path],
    field: [leaf.field],
    operator: [leaf.operator],
    reason: [reason],
    ...(expected ? { expected: [expected] } : {}),
  });
}

function validateLeaf(leaf: WireLeaf, path: string): void {
  if (!ALLOWED_WIRE_FIELDS.has(leaf.field)) {
    throw new ApiError(400, 'INVALID_FIELD', { field: [leaf.field], path: [path] });
  }

  const { operator, value } = leaf;
  switch (operator) {
    case 'isNull':
    case 'isNotNull':
      if (value !== undefined && value !== null) {
        throw invalidValue(leaf, path, 'value_type');
      }
      return;

    case 'between':
      if (!Array.isArray(value) || value.length !== 2 || value[0] === null || value[0] === undefined || value[1] === null || value[1] === undefined) {
        throw invalidValue(leaf, path, 'between_arity', '[from,to]');
      }
      return;

    case 'in':
    case 'nin':
      if (!Array.isArray(value)) throw invalidValue(leaf, path, 'value_type', 'array');
      if (value.length === 0) throw invalidValue(leaf, path, 'array_empty');
      return;

    case 'ilike':
    case 'contains':
    case 'startsWith':
    case 'endsWith':
      if (typeof value !== 'string') {
        throw invalidValue(leaf, path, 'value_type', 'string 1..200');
      }
      return;

    case 'ilikeAny':
      if (!Array.isArray(value)) throw invalidValue(leaf, path, 'value_type', 'array');
      if (value.length === 0) throw invalidValue(leaf, path, 'array_empty');
      if (!value.every((item) => typeof item === 'string')) throw invalidValue(leaf, path, 'value_type', 'string 1..200');
      return;

    case 'eq':
    case 'neq':
    case 'is':
    case 'gte':
    case 'lte':
    case 'lt':
    case 'gt':
      if (value === undefined || value === null || Array.isArray(value) || typeof value === 'object') {
        throw invalidValue(leaf, path, 'value_type');
      }
      return;

    default:
      throw invalidValue(leaf, path, 'operator_not_allowed');
  }
}

function validateTree(node: WireNode, depth = 0, counter = { leaves: 0 }, path = 'filterTree'): void {
  if (isWireGroup(node)) {
    const nextDepth = depth + 1;
    if (nextDepth > MAX_DEPTH || (node.op !== 'AND' && node.op !== 'OR') || !Array.isArray(node.children) || node.children.length === 0) {
      throw new ApiError(400, 'CRM_VALIDATION_FAILED');
    }
    node.children.forEach((child, i) => validateTree(child, nextDepth, counter, `${path}.children[${i}]`));
    return;
  }

  counter.leaves += 1;
  if (counter.leaves > MAX_LEAVES) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED');
  }
  validateLeaf(node, path);
}

function hasText(haystack: string | null | undefined, needleLower: string): boolean {
  return !!haystack && haystack.toLowerCase().includes(needleLower);
}

function matchesSearch(lead: LeadRow & Partial<LeadDetail>, search: string, searchField: LeadSearchBody['searchField']): boolean {
  const trimmed = search.trim();
  if (!trimmed) return true;
  const term = trimmed.toLowerCase();

  const matchesLead = () => hasText(lead.displayName, term) || hasText(lead.interestSummary, term);
  const matchesCustomer = () => hasText(lead.displayName, term) || hasText(lead.primaryContact?.displayName, term);
  const matchesEmail = () => hasText(lead.email, term) || hasText(lead.companyEmail, term) || hasText(lead.primaryContact?.email, term);
  const matchesPhone = () => {
    const phoneTerm = normalizePhoneTerm(trimmed);
    if (!phoneTerm) return false;
    const candidates = [lead.primaryMobile, lead.companyPhone, ...(lead.phones ?? []), ...(lead.primaryContact?.phones ?? [])];
    return candidates.some((phone) => !!phone && normalizePhoneTerm(phone).includes(phoneTerm));
  };

  switch (searchField) {
    case 'lead':
      return matchesLead();
    case 'customer':
      return matchesCustomer();
    case 'email':
      return matchesEmail();
    case 'phone':
      return matchesPhone();
    default:
      return matchesLead() || matchesCustomer() || matchesEmail() || matchesPhone();
  }
}

function readWireValue(lead: LeadRow & Partial<LeadDetail>, field: string): string | number | boolean | null {
  switch (field) {
    case 'leadProfileType':
      return lead.leadProfileType;
    case 'acquisitionSourceId':
      return lead.acquisitionSource?.id ?? null;
    case 'stageId':
      return lead.stageId;
    case 'stageFlag':
      return lead.stageFlag;
    case 'status':
      return lead.status;
    case 'ownerUserId':
      return lead.owner?.userId ?? null;
    case 'createdByUserId':
      return lead.createdByUserId ?? lead.owner?.userId ?? null;
    case 'rating':
      return lead.rating;
    case 'cardColor':
      return lead.cardColor ?? null;
    case 'createdAt':
      return lead.createdAt ?? lead.updatedAt ?? null;
    case 'updatedAt':
      return lead.updatedAt ?? null;
    case 'convertedAt':
      return lead.convertedAt ?? null;
    case 'description':
      return lead.description ?? null;
    case 'interestSummary':
      return lead.interestSummary ?? null;
    case 'expectedNeed':
      return lead.expectedNeed ?? null;
    case 'disqualificationReasonId':
      return lead.disqualificationReasonId ?? null;
    case 'qualifiedAt':
      return lead.qualifiedAt ?? null;
    case 'disqualifiedAt':
      return lead.disqualifiedAt ?? null;
    case 'convertedCustomerId':
      return lead.convertedCustomerId ?? null;
    default:
      return null;
  }
}

function toComparable(value: unknown, isDate: boolean): number | string | boolean | null {
  if (value === null || value === undefined) return null;
  if (isDate) {
    const ms = typeof value === 'number' ? value : Date.parse(String(value));
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
    return value;
  }
  return null;
}

function evaluateLeaf(lead: LeadRow & Partial<LeadDetail>, leaf: WireLeaf): boolean {
  const actual = readWireValue(lead, leaf.field);

  if (leaf.operator === 'isNull') return actual === null;
  if (leaf.operator === 'isNotNull') return actual !== null;
  if (actual === null) return false;

  const isDate = DATE_FIELDS.has(leaf.field);
  const left = toComparable(actual, isDate);
  if (left === null) return false;

  switch (leaf.operator) {
    case 'eq':
    case 'is': {
      const right = toComparable(leaf.value, isDate);
      return right !== null && left === right;
    }
    case 'neq': {
      const right = toComparable(leaf.value, isDate);
      return right !== null && left !== right;
    }
    case 'in':
      return (leaf.value as unknown[]).some((item) => {
        const right = toComparable(item, isDate);
        return right !== null && left === right;
      });
    case 'nin':
      return (leaf.value as unknown[]).every((item) => {
        const right = toComparable(item, isDate);
        return right !== null && left !== right;
      });
    case 'gte': {
      const right = toComparable(leaf.value, isDate);
      return right !== null && left >= right;
    }
    case 'lte': {
      const right = toComparable(leaf.value, isDate);
      return right !== null && left <= right;
    }
    case 'gt': {
      const right = toComparable(leaf.value, isDate);
      return right !== null && left > right;
    }
    case 'lt': {
      const right = toComparable(leaf.value, isDate);
      return right !== null && left < right;
    }
    case 'between': {
      const [minRaw, maxRaw] = leaf.value as [unknown, unknown];
      const min = toComparable(minRaw, isDate);
      const max = toComparable(maxRaw, isDate);
      return min !== null && max !== null && left >= min && left <= max;
    }
    case 'ilike':
    case 'contains':
      return typeof actual === 'string' && actual.toLowerCase().includes(String(leaf.value).toLowerCase());
    case 'ilikeAny':
      return typeof actual === 'string' && (leaf.value as string[]).some((pattern) => actual.toLowerCase().includes(pattern.toLowerCase()));
    case 'startsWith':
      return typeof actual === 'string' && actual.toLowerCase().startsWith(String(leaf.value).toLowerCase());
    case 'endsWith':
      return typeof actual === 'string' && actual.toLowerCase().endsWith(String(leaf.value).toLowerCase());
    default:
      return false;
  }
}

function evaluateTree(lead: LeadRow & Partial<LeadDetail>, node: WireNode): boolean {
  if (isWireGroup(node)) {
    return node.op === 'AND' ? node.children.every((child) => evaluateTree(lead, child)) : node.children.some((child) => evaluateTree(lead, child));
  }
  return evaluateLeaf(lead, node);
}

/** Fake-server query evaluator with strict field/operator validation and SQL null semantics. */
export function matchesLead(lead: LeadRow & Partial<LeadDetail>, body: LeadSearchBody, _ctx?: { now?: Date }): boolean {
  if (body.filterTree) {
    validateTree(body.filterTree);
  }

  if (body.search !== undefined && !matchesSearch(lead, body.search, body.searchField)) {
    return false;
  }

  if (body.tagIds && body.tagIds.length > 0 && !(lead.tags ?? []).some((tag) => body.tagIds!.includes(tag.id))) {
    return false;
  }

  if (body.hasOverdueActivity !== undefined) {
    const overdue = lead.nextActivity?.bucket === 'OVERDUE';
    if (overdue !== body.hasOverdueActivity) return false;
  }

  if (body.filterTree && !evaluateTree(lead, body.filterTree)) {
    return false;
  }

  return true;
}
