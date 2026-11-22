import {
  addDaysToDateString,
  formatCalendarDate,
  isValidDateString,
  resolveDate,
  todayInTimeZone,
} from '../../../../shared/query-builder/query-dates';
import { normalize } from '../../../../shared/query-builder/query-normalize';
import {
  Condition,
  Group,
  Operator,
  Query,
  QueryField,
  RelativeDate,
  Value,
} from '../../../../shared/query-builder/query.model';
import { ApiError, errorCodeOf } from '../../settings/shared/settings-api';
import { RecordSearchRejected } from '../../shared/record/search/record-search.model';
import { OpportunitySearchBody, SearchField, WireNode } from '../opportunities.model';
import { opportunitySearchFields } from './opportunity-search.fields';

export interface CompileOpportunityContext {
  branchId: string;
  pipelineId?: string | null;
  customerPartyId?: string | null;
  meUserId: string;
  timeZone: string;
  now?: Date;
}

const TEXT_SEARCH_MAP: Record<string, SearchField> = {
  q: 'opportunity',
  customer: 'customer',
  email: 'email',
  phone: 'phone',
};

const TEXT_SEARCH_IDS = new Set(Object.keys(TEXT_SEARCH_MAP));
const TIMESTAMP_WIRE_FIELDS = new Set(['nextOpenActivityAt', 'createdAt', 'updatedAt', 'wonAt', 'lostAt']);

const WIRE_FIELD_MAP: Record<string, string> = {
  title: 'title',
  description: 'description',
  stage: 'stageId',
  stageId: 'stageId',
  stageCategory: 'stageCategory',
  status: 'status',
  owner: 'ownerUserId',
  ownerUserId: 'ownerUserId',
  ownerTeam: 'ownerTeamId',
  ownerTeamId: 'ownerTeamId',
  createdBy: 'createdByUserId',
  createdByUserId: 'createdByUserId',
  customerRecord: 'customerProfileId',
  customerProfileId: 'customerProfileId',
  customerType: 'customerProfileType',
  customerProfileType: 'customerProfileType',
  customerStatus: 'customerStatus',
  contact: 'contactPartyId',
  contactPartyId: 'contactPartyId',
  fromLead: 'leadId',
  leadId: 'leadId',
  leadSource: 'leadSourceId',
  leadSourceId: 'leadSourceId',
  amount: 'amount',
  currency: 'currencyCode',
  currencyCode: 'currencyCode',
  probability: 'probabilityPercent',
  probabilityPercent: 'probabilityPercent',
  importance: 'importance',
  color: 'cardColor',
  cardColor: 'cardColor',
  tags: 'tagIds',
  tagIds: 'tagIds',
  closing: 'expectedCloseDate',
  expectedCloseDate: 'expectedCloseDate',
  activityState: 'activityState',
  nextActivity: 'nextOpenActivityAt',
  nextOpenActivityAt: 'nextOpenActivityAt',
  openActivities: 'openActivityCount',
  openActivityCount: 'openActivityCount',
  daysInStage: 'daysInStage',
  lostReason: 'lostReasonId',
  lostReasonId: 'lostReasonId',
  winReason: 'winReasonId',
  winReasonId: 'winReasonId',
  lostNote: 'lostReason',
  created: 'createdAt',
  createdAt: 'createdAt',
  updated: 'updatedAt',
  updatedAt: 'updatedAt',
  wonAt: 'wonAt',
  lostAt: 'lostAt',
};

const COMPILE_FIELDS: QueryField[] = opportunitySearchFields({
  t: (key) => key,
  stages: [],
  sources: [],
  tags: [],
  currencies: [],
  winReasons: [],
  lossReasons: [],
  owners: async () => [],
  teams: async () => [],
  customers: async () => [],
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

function extractStringIds(value: Value | undefined): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)),
    );
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function compileTagsLeaf(op: Operator, value: Value | undefined): WireNode | null {
  if (op === 'isNull' || op === 'isNotNull') {
    return { field: 'tagIds', operator: op };
  }
  const ids = extractStringIds(value);
  if (ids.length === 0) return null;
  if (op === 'nin') {
    return { field: 'tagIds', operator: 'noneOf', value: ids };
  }
  return { field: 'tagIds', operator: 'anyOf', value: ids };
}

function expandStatusValues(items: unknown[]): string[] {
  const expanded: string[] = [];
  for (const item of items) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (trimmed === 'OPEN') {
      expanded.push('IN_PROGRESS', 'ON_HOLD');
    } else {
      expanded.push(trimmed);
    }
  }
  return Array.from(new Set(expanded));
}

function compileStatusCondition(op: Operator, value: Value | undefined): WireNode | null {
  if (op === 'isNull' || op === 'isNotNull') {
    return { field: 'status', operator: op };
  }
  const rawList = Array.isArray(value) ? value : value !== undefined && value !== null ? [value] : [];
  const expanded = expandStatusValues(rawList);
  if (expanded.length === 0) return null;

  if (op === 'eq' || op === 'in') {
    return expanded.length === 1
      ? { field: 'status', operator: 'eq', value: expanded[0] }
      : { field: 'status', operator: 'in', value: expanded };
  }
  if (op === 'neq' || op === 'nin') {
    return expanded.length === 1
      ? { field: 'status', operator: 'neq', value: expanded[0] }
      : { field: 'status', operator: 'nin', value: expanded };
  }
  return null;
}

function resolveCalendarRelativeRange(
  rel: RelativeDate,
  timeZone: string,
  now: Date,
): [string, string] | null {
  const today = todayInTimeZone(now, timeZone);
  const todayStr = formatCalendarDate(today);
  switch (rel) {
    case 'today':
      return [todayStr, todayStr];
    case 'yesterday': {
      const y = addDaysToDateString(todayStr, -1);
      return [y, y];
    }
    case 'last7':
      return [addDaysToDateString(todayStr, -6), todayStr];
    case 'last30':
      return [addDaysToDateString(todayStr, -29), todayStr];
    case 'thisMonth': {
      const start = formatCalendarDate({ year: today.year, month: today.month, day: 1 });
      return [start, todayStr];
    }
    case 'lastMonth': {
      const prevYear = today.month === 1 ? today.year - 1 : today.year;
      const prevMonth = today.month === 1 ? 12 : today.month - 1;
      const start = formatCalendarDate({ year: prevYear, month: prevMonth, day: 1 });
      const thisMonthStart = formatCalendarDate({ year: today.year, month: today.month, day: 1 });
      return [start, addDaysToDateString(thisMonthStart, -1)];
    }
    case 'thisYear': {
      const start = formatCalendarDate({ year: today.year, month: 1, day: 1 });
      return [start, todayStr];
    }
    default:
      return null;
  }
}

function compileCalendarDateCondition(
  wireField: string,
  op: Operator,
  value: Value | undefined,
  ctx: CompileOpportunityContext,
): WireNode | null {
  if (op === 'isNull' || op === 'isNotNull') {
    return { field: wireField, operator: op };
  }
  const tz = ctx.timeZone || 'Africa/Cairo';
  const now = ctx.now ?? new Date();

  if (op === 'on' && isValidDateString(value)) {
    return { field: wireField, operator: 'eq', value: value.trim() };
  }
  if (op === 'before' && isValidDateString(value)) {
    return { field: wireField, operator: 'lt', value: value.trim() };
  }
  if (op === 'after' && isValidDateString(value)) {
    return { field: wireField, operator: 'gt', value: value.trim() };
  }
  if (op === 'between' && Array.isArray(value) && value.length === 2) {
    const [from, to] = value;
    if (isValidDateString(from) && isValidDateString(to)) {
      return { field: wireField, operator: 'between', value: [from.trim(), to.trim()] };
    }
    return null;
  }
  if (op === 'relative' && typeof value === 'string') {
    const range = resolveCalendarRelativeRange(value as RelativeDate, tz, now);
    if (!range) return null;
    return range[0] === range[1]
      ? { field: wireField, operator: 'eq', value: range[0] }
      : { field: wireField, operator: 'between', value: range };
  }
  return null;
}

function compileTimestampCondition(
  wireField: string,
  op: Operator,
  value: Value | undefined,
  ctx: CompileOpportunityContext,
): WireNode | null {
  if (op === 'isNull' || op === 'isNotNull') {
    return { field: wireField, operator: op };
  }
  const resolved = resolveDate(op, value ?? null, ctx.timeZone || 'Africa/Cairo', ctx.now);
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
  ctx: CompileOpportunityContext,
  rejected: RecordSearchRejected[],
  insideRootAnd: boolean,
): WireNode | null {
  if (TEXT_SEARCH_IDS.has(cond.field)) {
    if (!insideRootAnd) {
      rejected.push({ field: cond.field, reasonKey: 'search.rejected.ROOT_ONLY' });
    }
    return null;
  }

  const wireField = WIRE_FIELD_MAP[cond.field];
  if (!wireField || !cond.operator) {
    if (cond.field && cond.operator) {
      rejected.push({ field: cond.field, reasonKey: 'search.rejected.UNSUPPORTED' });
    }
    return null;
  }

  const op = cond.operator;

  if (wireField === 'tagIds') {
    return compileTagsLeaf(op, cond.value);
  }

  if (wireField === 'status') {
    return compileStatusCondition(op, cond.value);
  }

  if (op === 'isNull' || op === 'isNotNull') {
    return { field: wireField, operator: op };
  }

  if (wireField === 'expectedCloseDate') {
    return compileCalendarDateCondition(wireField, op, cond.value, ctx);
  }

  if (TIMESTAMP_WIRE_FIELDS.has(wireField)) {
    return compileTimestampCondition(wireField, op, cond.value, ctx);
  }

  let value = resolveMeValue(cond.value, ctx.meUserId);
  if (value === undefined || value === null) return null;

  if (typeof value === 'string') {
    value = value.trim();
    if (
      value === '' &&
      (op === 'contains' || op === 'ilike' || op === 'startsWith' || op === 'endsWith' || op === 'eq' || op === 'neq' || op === 'is')
    ) {
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
  ctx: CompileOpportunityContext,
  rejected: RecordSearchRejected[],
  isRoot: boolean,
): WireNode | null {
  const children: WireNode[] = [];
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

function applyRootCondition(
  cond: Condition,
  body: OpportunitySearchBody,
  extraAndLeaves: WireNode[],
  rejected: RecordSearchRejected[],
): void {
  const searchField = TEXT_SEARCH_MAP[cond.field];
  if (searchField) {
    if (typeof cond.value !== 'string') return;
    const term = searchField === 'phone' ? normalizePhoneTerm(cond.value) : cond.value.trim();
    if (!term) return;
    if (body.search === undefined) {
      body.search = term;
      body.searchField = searchField;
      return;
    }
    if (cond.field === 'q') {
      extraAndLeaves.push({ field: 'title', operator: 'contains', value: term });
      return;
    }
    rejected.push({ field: cond.field, reasonKey: 'search.rejected.oneTextFacet' });
    return;
  }

  if (cond.field === 'tags' && cond.operator !== null) {
    const leaf = compileTagsLeaf(cond.operator, cond.value);
    if (leaf) extraAndLeaves.push(leaf);
  }
}

/** Compile a UI Query into OpportunitySearchBody for Board, Cards, and Table. */
export function compileOpportunityQuery(
  query: Query,
  ctx: CompileOpportunityContext,
): { body: OpportunitySearchBody; rejected: RecordSearchRejected[] } {
  const normalized = normalize(query, COMPILE_FIELDS);
  const body: OpportunitySearchBody = { branchId: ctx.branchId };
  const rejected: RecordSearchRejected[] = [];
  const extraAndLeaves: WireNode[] = [];

  const pipelineId = ctx.pipelineId?.trim();
  if (pipelineId) {
    extraAndLeaves.push({ field: 'pipelineId', operator: 'eq', value: pipelineId });
  }

  const customerPartyId = ctx.customerPartyId?.trim();
  if (customerPartyId) {
    extraAndLeaves.push({ field: 'customerPartyId', operator: 'eq', value: customerPartyId });
  }

  for (const cond of normalized.fixed) {
    applyRootCondition(cond, body, extraAndLeaves, rejected);
  }

  if (normalized.root.op === 'AND') {
    for (const child of normalized.root.children) {
      if (child.kind === 'condition' && TEXT_SEARCH_IDS.has(child.field)) {
        applyRootCondition(child, body, extraAndLeaves, rejected);
      }
    }
  }

  const compiledTree = compileGroup(normalized.root, ctx, rejected, true);
  const topChildren: WireNode[] = [...extraAndLeaves];
  if (compiledTree) {
    if (isGroupWire(compiledTree) && compiledTree.op === 'AND') {
      topChildren.push(...compiledTree.children);
    } else {
      topChildren.push(compiledTree);
    }
  }

  if (topChildren.length === 1) {
    body.filterTree = topChildren[0];
  } else if (topChildren.length > 1) {
    body.filterTree = { op: 'AND', children: topChildren };
  }

  return { body, rejected };
}

/** Map backend 400/422 search validation errors to `opportunities.search.rejected.*` keys. */
export function opportunitySearchErrorKey(error: unknown): string | null {
  const code = errorCodeOf(error);
  if (code === 'OPPORTUNITY_FILTER_TAGS_CONFLICT') {
    return 'opportunities.search.rejected.tagsConflict';
  }
  if (code === 'INVALID_FIELD') {
    return 'opportunities.search.rejected.invalidField';
  }
  // INVALID_FILTER_TREE details { path: [path], reason: [lowercase reason] } do not change the message.
  if (code === 'INVALID_FILTER_TREE') {
    return 'opportunities.search.rejected.invalidValue';
  }
  if (code === 'INVALID_OPERATOR_VALUE') {
    // details.reason is a lowercase string array, e.g. ['operator_not_allowed'].
    const reason = error instanceof ApiError ? error.details?.['reason'] : undefined;
    if (Array.isArray(reason) && reason.includes('operator_not_allowed')) {
      return 'opportunities.search.rejected.operatorNotAllowed';
    }
    return 'opportunities.search.rejected.invalidValue';
  }
  return null;
}
