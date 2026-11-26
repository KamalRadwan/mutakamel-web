import {
  Condition,
  Group,
  IssueCode,
  Query,
  QueryField,
  getCachedFieldOption,
} from '../../../../shared/query-builder/query.model';
import { PRESET_FIELD, SearchFacet, SearchOption } from '../../../../shared/ui/facet-search/facet-search.model';

export const ADVANCED_FACET_FIELD = 'advanced';

type PresetValue = 'mine' | 'active';

const TEXT_FIELDS = new Set(['customer', 'email', 'phone']);
const CHIP_TREE_FIELDS = new Set(['status', 'profileType', 'ownerUserId', 'acquisitionSourceId']);

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
  const scopedKey = `customers.search.${key}`;
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

function matchPreset(cond: Condition): PresetValue | null {
  if (
    cond.field === 'ownerUserId' &&
    ((cond.operator === 'eq' && cond.value === '$me') ||
      (cond.operator === 'in' && Array.isArray(cond.value) && cond.value.length === 1 && cond.value[0] === '$me'))
  ) {
    return 'mine';
  }
  if (
    cond.field === 'status' &&
    ((cond.operator === 'eq' && cond.value === 'ACTIVE_CUSTOMER') ||
      (cond.operator === 'in' &&
        Array.isArray(cond.value) &&
        cond.value.length === 1 &&
        cond.value[0] === 'ACTIVE_CUSTOMER'))
  ) {
    return 'active';
  }
  return null;
}

function isChipTreeCondition(cond: Condition): boolean {
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

/** Empty query with no conditions. */
export function emptyCustomerQuery(): Query {
  return {
    root: { kind: 'group', id: 'root', op: 'AND', children: [] },
    fixed: [],
  };
}

export function defaultCustomerQuery(): Query {
  const query = emptyCustomerQuery();
  query.root.children.push({ kind: 'condition', id: 'preset-mine', field: 'ownerUserId', operator: 'eq', value: '$me' });
  return query;
}

/** Convert a Query into facet-search chips plus one optional `advanced` summary chip. */
export function queryToFacets(
  query: Query,
  fields: QueryField[],
  t: (key: string, params?: Record<string, unknown>) => string,
): SearchFacet[] {
  const presets: PresetValue[] = [];
  const chipValues = new Map<string, SearchOption[]>();
  let advancedCount = 0;

  const addPreset = (preset: PresetValue) => {
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
      const preset = matchPreset(child);
      if (preset) {
        addPreset(preset);
        continue;
      }
      if (isChipTreeCondition(child)) {
        const meta = fieldMeta(fields, child.field);
        const vals = Array.isArray(child.value)
          ? child.value.filter((v): v is string => typeof v === 'string')
          : [String(child.value)];
        for (const val of vals) {
          pushFacetValue(chipValues, child.field, { value: val, label: optionLabel(meta, val) });
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
    const presetDefaults: Record<PresetValue, string> = {
      mine: 'My customers',
      active: 'Active customers',
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

function stripNonChipConditions(query: Query): void {
  query.fixed = query.fixed.filter((cond) => isChipFixedCondition(cond));
  if (query.root.op !== 'AND') {
    query.root = { kind: 'group', id: query.root.id, op: 'AND', children: [] };
    return;
  }
  query.root.children = query.root.children.filter(
    (child) => child.kind === 'condition' && (matchPreset(child) !== null || isChipTreeCondition(child)),
  );
}

function removeChipValue(query: Query, field: string, value: string): void {
  if (field === PRESET_FIELD) {
    query.root.children = query.root.children.filter(
      (child) => !(child.kind === 'condition' && matchPreset(child) === value),
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
    query.fixed = query.fixed.flatMap((cond): Condition[] => {
      if (cond.field !== 'tags') return [cond];
      const current = Array.isArray(cond.value)
        ? cond.value.map(String)
        : typeof cond.value === 'string'
          ? [cond.value]
          : [];
      const remaining = current.filter((item) => item !== value);
      if (remaining.length === 0) return [];
      return [{ ...cond, value: remaining }];
    });
    return;
  }

  if (query.root.op !== 'AND') return;
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

function addChipValue(
  query: Query,
  field: string,
  value: string,
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
    const existing = query.fixed.find((cond) => cond.field === 'tags');
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
    query.fixed.push({ kind: 'condition', id: nextId('tags'), field: 'tags', operator: 'hasAny', value: [value] });
    return;
  }

  if (field === PRESET_FIELD) {
    ensureAndRoot(query);
    if (value === 'mine') {
      if (hasConflictForTarget(query, 'ownerUserId', '$me')) {
        rejected.push({ field: 'ownerUserId', value, code: 'CONTRADICTION' });
        return;
      }
      if (!query.root.children.some((child) => child.kind === 'condition' && matchPreset(child) === 'mine')) {
        query.root.children.push({
          kind: 'condition',
          id: nextId('preset'),
          field: 'ownerUserId',
          operator: 'eq',
          value: '$me',
        });
      }
      return;
    }

    if (value === 'active') {
      if (hasConflictForTarget(query, 'status', 'ACTIVE_CUSTOMER')) {
        rejected.push({ field: 'status', value, code: 'CONTRADICTION' });
        return;
      }
      if (!query.root.children.some((child) => child.kind === 'condition' && matchPreset(child) === 'active')) {
        query.root.children.push({
          kind: 'condition',
          id: nextId('preset'),
          field: 'status',
          operator: 'eq',
          value: 'ACTIVE_CUSTOMER',
        });
      }
      return;
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
    if (facet.field === ADVANCED_FACET_FIELD) continue;
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
): { query: Query; rejected: { field: string; value: string; code: IssueCode }[] } {
  const prevFacets = queryToFacets(prev, fields, (key) => key);
  const query = cloneQuery(prev);
  const rejected: { field: string; value: string; code: IssueCode }[] = [];

  const hadAdvanced = prevFacets.some((facet) => facet.field === ADVANCED_FACET_FIELD);
  const hasAdvanced = facets.some((facet) => facet.field === ADVANCED_FACET_FIELD);
  if (hadAdvanced && !hasAdvanced) {
    stripNonChipConditions(query);
  }

  const prevPairs = facetPairs(prevFacets);
  const nextPairs = facetPairs(facets);

  for (const oldPair of prevPairs) {
    const stillPresent = nextPairs.some((pair) => pair.field === oldPair.field && pair.value === oldPair.value);
    if (!stillPresent) {
      removeChipValue(query, oldPair.field, oldPair.value);
    }
  }

  for (const newPair of nextPairs) {
    const wasPresent = prevPairs.some((pair) => pair.field === newPair.field && pair.value === newPair.value);
    if (!wasPresent) {
      addChipValue(query, newPair.field, newPair.value, rejected);
    }
  }

  return { query, rejected };
}
