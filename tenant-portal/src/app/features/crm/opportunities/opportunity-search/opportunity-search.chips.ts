import {
  addDaysToDateString,
  formatCalendarDate,
  todayInTimeZone,
} from '../../../../shared/query-builder/query-dates';
import {
  Condition,
  Group,
  IssueCode,
  Query,
  QueryField,
  getCachedFieldOption,
} from '../../../../shared/query-builder/query.model';
import { PRESET_FIELD, SearchFacet, SearchOption } from '../../../../shared/ui/facet-search/facet-search.model';
import { ClosingFilter } from '../opportunities.model';

export const ADVANCED_FACET_FIELD = 'advanced';
export const CUSTOMER_PARTY_FACET_FIELD = 'customerPartyId';

export const OPPORTUNITY_PRESETS = ['mine', 'open', 'closingThisMonth'] as const;
export type OpportunityPreset = (typeof OPPORTUNITY_PRESETS)[number];

export interface OpportunityFacetOptions {
  timeZone?: string;
  now?: Date;
}

const TEXT_FIELDS = new Set(['q', 'customer', 'email', 'phone']);
const CHIP_TREE_FIELDS = new Set(['status', 'owner', 'currency']);
const CLOSING_FILTER_SET = new Set<ClosingFilter>(['OVERDUE', 'NEXT_7_DAYS', 'NEXT_30_DAYS', 'NO_DATE']);

let nextConditionSeq = 0;

function nextId(prefix = 'chip'): string {
  nextConditionSeq += 1;
  return `${prefix}-${nextConditionSeq}`;
}

function cloneGroup(group: Group): Group {
  return {
    kind: 'group',
    id: group.id,
    op: group.op,
    children: group.children.map((child) => (child.kind === 'group' ? cloneGroup(child) : { ...child })),
  };
}

function cloneQuery(query: Query): Query {
  return {
    root: cloneGroup(query.root),
    fixed: query.fixed.map((cond) => ({ ...cond })),
  };
}

function translate(
  t: (key: string, params?: Record<string, unknown>) => string,
  key: string,
  fallback: string,
  params?: Record<string, unknown>,
): string {
  const scopedKey = `opportunities.search.${key}`;
  const scoped = t(scopedKey, params);
  if (scoped && scoped !== scopedKey) return scoped;
  const direct = t(key, params);
  if (direct && direct !== key) return direct;
  return fallback;
}

function fieldMeta(fields: QueryField[], id: string): QueryField | undefined {
  return fields.find((field) => field.id === id);
}

function optionLabel(field: QueryField | undefined, value: string): string {
  const fromSpecial = field?.specialOptions?.find((opt) => opt.value === value)?.label;
  if (fromSpecial) return fromSpecial;
  const fromOptions = field?.options?.find((opt) => opt.value === value)?.label;
  if (fromOptions) return fromOptions;
  const cached = getCachedFieldOption(field?.id, value)?.label;
  return cached ?? value;
}

function countGroupLeaves(group: Group): number {
  let count = 0;
  for (const child of group.children) {
    if (child.kind === 'group') {
      count += countGroupLeaves(child);
    } else if (child.operator !== null) {
      count += 1;
    }
  }
  return count;
}

function closingBounds(options?: OpportunityFacetOptions): {
  todayIso: string;
  next7End: string;
  next30End: string;
} {
  const tz = options?.timeZone || 'Africa/Cairo';
  const now = options?.now ?? new Date();
  const todayIso = formatCalendarDate(todayInTimeZone(now, tz));
  return {
    todayIso,
    next7End: addDaysToDateString(todayIso, 7),
    next30End: addDaysToDateString(todayIso, 30),
  };
}

function matchClosingCondition(cond: Condition, bounds: ReturnType<typeof closingBounds>): ClosingFilter | null {
  if (cond.field !== 'closing') return null;
  if (cond.operator === 'isNull') return 'NO_DATE';
  if (cond.operator === 'before' && cond.value === bounds.todayIso) return 'OVERDUE';
  if (cond.operator === 'between' && Array.isArray(cond.value) && cond.value.length === 2) {
    const [from, to] = cond.value;
    if (from === bounds.todayIso && to === bounds.next7End) return 'NEXT_7_DAYS';
    if (from === bounds.todayIso && to === bounds.next30End) return 'NEXT_30_DAYS';
  }
  return null;
}

function matchPreset(cond: Condition, bounds: ReturnType<typeof closingBounds>): OpportunityPreset | null {
  if (
    cond.field === 'owner' &&
    ((cond.operator === 'eq' && cond.value === '$me') ||
      (cond.operator === 'in' && Array.isArray(cond.value) && cond.value.length === 1 && cond.value[0] === '$me'))
  ) {
    return 'mine';
  }
  if (
    cond.field === 'status' &&
    ((cond.operator === 'eq' && cond.value === 'OPEN') ||
      (cond.operator === 'in' && Array.isArray(cond.value) && cond.value.length === 1 && cond.value[0] === 'OPEN'))
  ) {
    return 'open';
  }
  if (matchClosingCondition(cond, bounds) === 'NEXT_30_DAYS') {
    return 'closingThisMonth';
  }
  return null;
}

function isChipTreeCondition(cond: Condition, bounds: ReturnType<typeof closingBounds>): boolean {
  if (cond.field === 'tags') {
    return (
      (cond.operator === 'hasAny' || cond.operator === 'in' || cond.operator === 'eq' || cond.operator === null) &&
      ((Array.isArray(cond.value) && cond.value.length > 0) ||
        (typeof cond.value === 'string' && cond.value.length > 0))
    );
  }
  if (cond.field === 'closing') {
    return matchClosingCondition(cond, bounds) !== null;
  }
  if (!CHIP_TREE_FIELDS.has(cond.field)) return false;
  if (cond.operator === 'eq') return typeof cond.value === 'string' && cond.value.length > 0;
  if (cond.operator === 'in') {
    return Array.isArray(cond.value) && cond.value.length > 0 && cond.value.every((v) => typeof v === 'string');
  }
  return false;
}

function isChipFixedCondition(cond: Condition): boolean {
  if (TEXT_FIELDS.has(cond.field)) {
    return typeof cond.value === 'string' && cond.value.trim().length > 0;
  }
  if (cond.field === 'tags') {
    return (
      (cond.operator === 'hasAny' || cond.operator === 'in' || cond.operator === 'eq' || cond.operator === null) &&
      ((Array.isArray(cond.value) && cond.value.length > 0) ||
        (typeof cond.value === 'string' && cond.value.length > 0))
    );
  }
  return false;
}

function pushFacetValue(map: Map<string, SearchOption[]>, fieldId: string, option: SearchOption): void {
  const existing = map.get(fieldId) ?? [];
  if (!existing.some((item) => item.value === option.value)) {
    existing.push(option);
  }
  map.set(fieldId, existing);
}

/** Empty opportunity search query with no conditions. */
export function emptyOpportunityQuery(): Query {
  return {
    root: { kind: 'group', id: 'root', op: 'AND', children: [] },
    fixed: [],
  };
}

/** Default opportunity search query: none. */
export function defaultOpportunityQuery(): Query {
  return emptyOpportunityQuery();
}

/** Convert a Query into facet-search chips plus one optional `advanced` summary chip. */
export function queryToFacets(
  query: Query,
  fields: QueryField[],
  t: (key: string, params?: Record<string, unknown>) => string,
  options?: OpportunityFacetOptions,
): SearchFacet[] {
  const bounds = closingBounds(options);
  const presets: OpportunityPreset[] = [];
  const chipValues = new Map<string, SearchOption[]>();
  let advancedCount = 0;

  const addPreset = (preset: OpportunityPreset) => {
    if (!presets.includes(preset)) presets.push(preset);
  };

  for (const cond of query.fixed) {
    if (TEXT_FIELDS.has(cond.field)) {
      if (typeof cond.value === 'string' && cond.value.trim().length > 0) {
        const text = cond.value.trim();
        pushFacetValue(chipValues, cond.field, { value: text, label: text });
      }
      continue;
    }
    if (cond.field === 'tags') {
      if (isChipFixedCondition(cond)) {
        const meta = fieldMeta(fields, 'tags');
        const ids = Array.isArray(cond.value)
          ? cond.value.filter((v): v is string => typeof v === 'string')
          : [String(cond.value)];
        for (const id of ids) {
          if (id) pushFacetValue(chipValues, 'tags', { value: id, label: optionLabel(meta, id) });
        }
      } else if (cond.operator !== null) {
        advancedCount += 1;
      }
      continue;
    }
    if (cond.operator !== null) {
      advancedCount += 1;
    }
  }

  if (query.root.op !== 'AND') {
    advancedCount += countGroupLeaves(query.root);
  } else {
    for (const child of query.root.children) {
      if (child.kind === 'group') {
        advancedCount += countGroupLeaves(child);
        continue;
      }
      const preset = matchPreset(child, bounds);
      if (preset) {
        addPreset(preset);
        continue;
      }
      if (child.field === 'closing') {
        const closingKind = matchClosingCondition(child, bounds);
        if (closingKind) {
          const meta = fieldMeta(fields, 'closing');
          pushFacetValue(chipValues, 'closing', { value: closingKind, label: optionLabel(meta, closingKind) });
          continue;
        }
      }
      if (isChipTreeCondition(child, bounds)) {
        const meta = fieldMeta(fields, child.field);
        const vals = Array.isArray(child.value)
          ? child.value.filter((v): v is string => typeof v === 'string')
          : [String(child.value)];
        for (const val of vals) {
          if (val) pushFacetValue(chipValues, child.field, { value: val, label: optionLabel(meta, val) });
        }
        continue;
      }
      if (child.operator !== null) {
        advancedCount += 1;
      }
    }
  }

  const result: SearchFacet[] = [];

  if (presets.length > 0) {
    const presetDefaults: Record<OpportunityPreset, string> = {
      mine: 'My opportunities',
      open: 'Open',
      closingThisMonth: 'Closing this month',
    };
    result.push({
      field: PRESET_FIELD,
      label: '',
      values: presets.map((value) => ({
        value,
        label: translate(t, `presets.${value}`, presetDefaults[value]),
      })),
    });
  }

  for (const [fieldId, values] of chipValues.entries()) {
    const label = fieldMeta(fields, fieldId)?.label ?? fieldId;
    result.push({ field: fieldId, label, values });
  }

  if (advancedCount > 0) {
    result.push({
      field: ADVANCED_FACET_FIELD,
      label: translate(t, 'advanced', 'Advanced'),
      values: [
        {
          value: ADVANCED_FACET_FIELD,
          label: translate(t, 'advancedCount', `${advancedCount} conditions`, { n: advancedCount }),
        },
      ],
    });
  }

  return result;
}

function stripNonChipConditions(query: Query, bounds: ReturnType<typeof closingBounds>): void {
  query.fixed = query.fixed.filter((cond) => isChipFixedCondition(cond));
  if (query.root.op !== 'AND') {
    query.root = { kind: 'group', id: query.root.id, op: 'AND', children: [] };
    return;
  }
  query.root.children = query.root.children.filter(
    (child) =>
      child.kind === 'condition' && (matchPreset(child, bounds) !== null || isChipTreeCondition(child, bounds)),
  );
}

function removeChipValue(
  query: Query,
  field: string,
  value: string,
  bounds: ReturnType<typeof closingBounds>,
): void {
  if (field === PRESET_FIELD) {
    query.root.children = query.root.children.filter(
      (child) => !(child.kind === 'condition' && matchPreset(child, bounds) === value),
    );
    return;
  }

  if (TEXT_FIELDS.has(field)) {
    query.fixed = query.fixed.filter(
      (cond) => !(cond.field === field && typeof cond.value === 'string' && cond.value.trim() === value),
    );
    return;
  }

  if (field === 'tags') {
    const stripTag = (cond: Condition): Condition[] => {
      if (cond.field !== 'tags') return [cond];
      const current = Array.isArray(cond.value)
        ? cond.value.map(String)
        : typeof cond.value === 'string'
          ? [cond.value]
          : [];
      const remaining = current.filter((item) => item !== value);
      if (remaining.length === 0) return [];
      return [{ ...cond, value: remaining }];
    };
    query.fixed = query.fixed.flatMap(stripTag);
    if (query.root.op === 'AND') {
      query.root.children = query.root.children.flatMap((child): (Condition | Group)[] =>
        child.kind === 'condition' ? stripTag(child) : [child],
      );
    }
    return;
  }

  if (query.root.op !== 'AND') return;

  if (field === 'closing') {
    query.root.children = query.root.children.filter(
      (child) => !(child.kind === 'condition' && matchClosingCondition(child, bounds) === value),
    );
    return;
  }

  query.root.children = query.root.children.flatMap((child): (Condition | Group)[] => {
    if (child.kind !== 'condition' || child.field !== field) return [child];
    if (child.operator === 'eq' && child.value === value) return [];
    if (child.operator === 'in' && Array.isArray(child.value)) {
      const remaining = (child.value as readonly (string | number)[]).filter((item) => item !== value) as string[];
      if (remaining.length === 0) return [];
      if (remaining.length === 1) return [{ ...child, operator: 'eq' as const, value: remaining[0] }];
      return [{ ...child, value: remaining }];
    }
    return [child];
  });
}

function ensureAndRoot(query: Query): void {
  if (query.root.op === 'AND') return;
  if (query.root.children.length === 0) {
    query.root = { kind: 'group', id: query.root.id, op: 'AND', children: [] };
    return;
  }
  query.root = {
    kind: 'group',
    id: 'root',
    op: 'AND',
    children: [query.root],
  };
}

function hasConflictForTarget(query: Query, field: string, target: string): boolean {
  if (query.root.op !== 'AND') return false;
  return query.root.children.some((child) => {
    if (child.kind !== 'condition' || child.field !== field) return false;
    if (child.operator === 'isNull') return true;
    if (child.operator === 'neq' && child.value === target) return true;
    if (child.operator === 'nin' && Array.isArray(child.value) && (child.value as readonly unknown[]).includes(target)) {
      return true;
    }
    if (child.operator === 'eq' && child.value !== target) return true;
    if (
      child.operator === 'in' &&
      Array.isArray(child.value) &&
      !(child.value as readonly unknown[]).includes(target)
    ) {
      return true;
    }
    return false;
  });
}

function buildClosingCondition(kind: ClosingFilter, bounds: ReturnType<typeof closingBounds>): Condition {
  switch (kind) {
    case 'OVERDUE':
      return { kind: 'condition', id: nextId('closing'), field: 'closing', operator: 'before', value: bounds.todayIso };
    case 'NEXT_7_DAYS':
      return {
        kind: 'condition',
        id: nextId('closing'),
        field: 'closing',
        operator: 'between',
        value: [bounds.todayIso, bounds.next7End],
      };
    case 'NEXT_30_DAYS':
      return {
        kind: 'condition',
        id: nextId('closing'),
        field: 'closing',
        operator: 'between',
        value: [bounds.todayIso, bounds.next30End],
      };
    case 'NO_DATE':
      return { kind: 'condition', id: nextId('closing'), field: 'closing', operator: 'isNull', value: undefined };
  }
}

function addClosingCondition(
  query: Query,
  kind: ClosingFilter,
  bounds: ReturnType<typeof closingBounds>,
  rejected: { field: string; value: string; code: IssueCode }[],
): void {
  ensureAndRoot(query);
  const existing = query.root.children.filter(
    (child): child is Condition => child.kind === 'condition' && child.field === 'closing',
  );
  if (existing.some((cond) => matchClosingCondition(cond, bounds) === kind)) {
    return;
  }
  if (existing.length > 0) {
    rejected.push({ field: 'closing', value: kind, code: 'CONTRADICTION' });
    return;
  }
  query.root.children.push(buildClosingCondition(kind, bounds));
}

function addChipValue(
  query: Query,
  field: string,
  value: string,
  bounds: ReturnType<typeof closingBounds>,
  rejected: { field: string; value: string; code: IssueCode }[],
): void {
  if (TEXT_FIELDS.has(field)) {
    const trimmed = value.trim();
    if (!trimmed) return;
    query.fixed = query.fixed.filter((cond) => !TEXT_FIELDS.has(cond.field));
    query.fixed.push({ kind: 'condition', id: nextId(field), field, operator: 'contains', value: trimmed });
    return;
  }

  if (field === 'tags') {
    ensureAndRoot(query);
    const existing =
      query.root.children.find((child): child is Condition => child.kind === 'condition' && child.field === 'tags') ??
      query.fixed.find((cond) => cond.field === 'tags');
    if (existing) {
      if (
        existing.operator === 'isNull' ||
        (existing.operator === 'nin' &&
          Array.isArray(existing.value) &&
          (existing.value as readonly unknown[]).includes(value))
      ) {
        rejected.push({ field: 'tags', value, code: 'CONTRADICTION' });
        return;
      }
      const list = Array.isArray(existing.value)
        ? existing.value.map(String)
        : typeof existing.value === 'string'
          ? [existing.value]
          : [];
      if (!list.includes(value)) {
        existing.operator = 'hasAny';
        existing.value = [...list, value];
      }
      return;
    }
    query.root.children.push({
      kind: 'condition',
      id: nextId('tags'),
      field: 'tags',
      operator: 'hasAny',
      value: [value],
    });
    return;
  }

  if (field === PRESET_FIELD) {
    ensureAndRoot(query);
    if (value === 'mine') {
      if (hasConflictForTarget(query, 'owner', '$me')) {
        rejected.push({ field: 'owner', value, code: 'CONTRADICTION' });
        return;
      }
      if (!query.root.children.some((child) => child.kind === 'condition' && matchPreset(child, bounds) === 'mine')) {
        query.root.children.push({
          kind: 'condition',
          id: nextId('preset'),
          field: 'owner',
          operator: 'eq',
          value: '$me',
        });
      }
      return;
    }

    if (value === 'open') {
      if (hasConflictForTarget(query, 'status', 'OPEN')) {
        rejected.push({ field: 'status', value, code: 'CONTRADICTION' });
        return;
      }
      if (!query.root.children.some((child) => child.kind === 'condition' && matchPreset(child, bounds) === 'open')) {
        query.root.children.push({
          kind: 'condition',
          id: nextId('preset'),
          field: 'status',
          operator: 'eq',
          value: 'OPEN',
        });
      }
      return;
    }

    if (value === 'closingThisMonth') {
      addClosingCondition(query, 'NEXT_30_DAYS', bounds, rejected);
      return;
    }
    return;
  }

  if (field === 'closing') {
    if (CLOSING_FILTER_SET.has(value as ClosingFilter)) {
      addClosingCondition(query, value as ClosingFilter, bounds, rejected);
    }
    return;
  }

  if (!CHIP_TREE_FIELDS.has(field)) return;
  ensureAndRoot(query);

  const conflict = query.root.children.some((child) => {
    if (child.kind !== 'condition' || child.field !== field) return false;
    if (child.operator === 'isNull') return true;
    if (child.operator === 'neq' && child.value === value) return true;
    if (child.operator === 'nin' && Array.isArray(child.value) && (child.value as readonly unknown[]).includes(value)) {
      return true;
    }
    return false;
  });
  if (conflict) {
    rejected.push({ field, value, code: 'CONTRADICTION' });
    return;
  }

  const mergeable = query.root.children.find(
    (child): child is Condition =>
      child.kind === 'condition' && child.field === field && (child.operator === 'eq' || child.operator === 'in'),
  );
  if (mergeable) {
    if (mergeable.operator === 'eq') {
      if (mergeable.value !== value && typeof mergeable.value === 'string') {
        mergeable.operator = 'in';
        mergeable.value = [mergeable.value, value];
      }
    } else if (Array.isArray(mergeable.value)) {
      const list = mergeable.value.map(String);
      if (!list.includes(value)) {
        mergeable.value = [...list, value];
      }
    }
    return;
  }

  query.root.children.push({ kind: 'condition', id: nextId(field), field, operator: 'eq', value });
}

function facetPairs(facets: SearchFacet[]): { field: string; value: string }[] {
  const pairs: { field: string; value: string }[] = [];
  for (const facet of facets) {
    if (facet.field === ADVANCED_FACET_FIELD || facet.field === CUSTOMER_PARTY_FACET_FIELD) continue;
    for (const option of facet.values) {
      pairs.push({ field: facet.field, value: option.value });
    }
  }
  return pairs;
}

/** Apply a facet-search diff to the previous Query while flagging any conflicting additions. */
export function facetsToQuery(
  prev: Query,
  facets: SearchFacet[],
  fields: QueryField[],
  options?: OpportunityFacetOptions,
): { query: Query; rejected: { field: string; value: string; code: IssueCode }[] } {
  const bounds = closingBounds(options);
  const prevFacets = queryToFacets(prev, fields, (key) => key, options);
  const query = cloneQuery(prev);
  const rejected: { field: string; value: string; code: IssueCode }[] = [];

  const hadAdvanced = prevFacets.some((facet) => facet.field === ADVANCED_FACET_FIELD);
  const hasAdvanced = facets.some((facet) => facet.field === ADVANCED_FACET_FIELD);
  if (hadAdvanced && !hasAdvanced) {
    stripNonChipConditions(query, bounds);
  }

  const prevPairs = facetPairs(prevFacets);
  const nextPairs = facetPairs(facets);

  for (const oldPair of prevPairs) {
    const stillPresent = nextPairs.some((pair) => pair.field === oldPair.field && pair.value === oldPair.value);
    if (!stillPresent) {
      removeChipValue(query, oldPair.field, oldPair.value, bounds);
    }
  }

  for (const newPair of nextPairs) {
    const wasPresent = prevPairs.some((pair) => pair.field === newPair.field && pair.value === newPair.value);
    if (!wasPresent) {
      addChipValue(query, newPair.field, newPair.value, bounds, rejected);
    }
  }

  return { query, rejected };
}
