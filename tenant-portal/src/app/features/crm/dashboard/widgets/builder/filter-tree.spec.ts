import { describe, expect, it } from 'vitest';
import type { Condition, Group, Operator, Query } from '../../../../../shared/query-builder/query.model';
import type { FilterGroup, FilterLeaf } from '../../../../../shared/widgets/dashboard/analytics.model';
import {
  filterTreeDepth,
  filterTreeMetricKeys,
  filterTreeRecordType,
  filterTreeSupported,
  fromWire,
  strictWireOperator,
  toWire,
  unknownWireOperators,
  unmappableOperators,
  type WireCondition,
} from './filter-tree';

function leaf(field: string, operator: string, value?: FilterLeaf['value']): FilterLeaf {
  return { field, operator: operator as FilterLeaf['operator'], ...(value !== undefined ? { value } : {}) };
}

function cond(field: string, operator: Operator | null, value?: Condition['value']): Condition {
  return { kind: 'condition', id: `c-${field}-${operator}`, field, operator, value };
}

function query(children: (Condition | Group)[], op: 'AND' | 'OR' = 'AND'): Query {
  return { root: { kind: 'group', id: 'g-root', op, children }, fixed: [] };
}

function firstCondition(q: Query): WireCondition {
  return q.root.children[0] as WireCondition;
}

describe('filter-tree toWire / fromWire', () => {
  it('round-trips every known operator unchanged', () => {
    const tree: FilterGroup = {
      kind: 'AND',
      children: [
        leaf('leads.status', 'EQ', 'OPEN'),
        leaf('leads.status', 'NEQ', 'LOST'),
        leaf('leads.rating', 'GTE', 2),
        leaf('leads.rating', 'LTE', 4),
        leaf('leads.sourceId', 'IN', ['website', 'referral']),
        leaf('leads.sourceId', 'NOT_IN', ['direct']),
        leaf('leads.rating', 'BETWEEN', [1, 3]),
        leaf('leads.ownerUserId', 'IS_EMPTY'),
        leaf('leads.ownerUserId', 'IS_NOT_EMPTY'),
        leaf('leads.status', 'CONTAINS', 'OP'),
        leaf('leads.createdAt', 'EQ', '2026-01-01'),
        leaf('leads.createdAt', 'GT', '2026-01-01'),
        leaf('leads.createdAt', 'LT', '2026-12-31'),
        { kind: 'OR', children: [leaf('leads.rating', 'EQ', 5), leaf('leads.rating', 'EQ', 0)] },
      ],
    };
    expect(toWire(fromWire(tree))).toEqual(tree);
  });

  it('keeps strict GT on a number field: shown as gte, sent back as GT', () => {
    const tree: FilterGroup = { kind: 'AND', children: [leaf('leads.rating', 'GT', 3)] };
    const q = fromWire(tree);
    const c = firstCondition(q);
    expect(c.operator).toBe('gte');
    expect(c.wireOperator).toBe('GT');
    expect(toWire(q)).toEqual(tree);
    expect(strictWireOperator(c, 'gte')).toBe('GT');
    expect(strictWireOperator(c, 'lte')).toBeNull();
  });

  it('keeps strict LT on a number field: shown as lte, sent back as LT', () => {
    const tree: FilterGroup = { kind: 'AND', children: [leaf('opportunities.estimatedValue', 'LT', 1000)] };
    const q = fromWire(tree);
    const c = firstCondition(q);
    expect(c.operator).toBe('lte');
    expect(toWire(q)).toEqual(tree);
    expect(strictWireOperator(c, 'lte')).toBe('LT');
  });

  it('drops the strict wire operator once the UI operator changes', () => {
    const q = fromWire({ kind: 'AND', children: [leaf('leads.rating', 'GT', 3)] });
    const c = firstCondition(q);
    c.operator = 'lte';
    expect(toWire(q)).toEqual({ kind: 'AND', children: [leaf('leads.rating', 'LTE', 3)] });
  });

  it('reads date GT/LT as after/before and reports no strict operator for dates', () => {
    const q = fromWire({ kind: 'AND', children: [leaf('leads.createdAt', 'GT', '2026-01-01')] });
    const c = firstCondition(q);
    expect(c.operator).toBe('after');
    expect(strictWireOperator(c, 'after')).toBeNull();
  });

  it('maps UI operators exactly (after -> GT, before -> LT, is -> EQ)', () => {
    const wire = toWire(
      query([
        cond('leads.createdAt', 'after', '2026-01-01'),
        cond('leads.createdAt', 'before', '2026-02-01'),
        cond('leads.status', 'is', 'OPEN'),
      ]),
    );
    expect(wire?.children.map((n) => (n as FilterLeaf).operator)).toEqual(['GT', 'LT', 'EQ']);
  });

  it('returns undefined for an empty query and an empty query for a missing tree', () => {
    expect(toWire(query([]))).toBeUndefined();
    expect(fromWire(null).root.children).toEqual([]);
    expect(fromWire({ kind: 'AND', children: [] }).root.children).toEqual([]);
  });
});

describe('filter-tree unmappable operators', () => {
  it('refuses UI operators with no wire meaning instead of defaulting them', () => {
    const q = query([
      cond('leads.status', 'ilike', 'op'),
      cond('leads.status', 'startsWith', 'O'),
      cond('leads.createdAt', 'relative', 'last7'),
      cond('leads.status', 'eq', 'OPEN'),
    ]);
    expect(unmappableOperators(q).sort()).toEqual(['ilike', 'relative', 'startsWith']);
    // None of them is guessed into another wire operator.
    expect(toWire(q)).toEqual({ kind: 'AND', children: [leaf('leads.status', 'EQ', 'OPEN')] });
  });

  it('does not flag a strict GT kept from the wire', () => {
    const q = fromWire({ kind: 'AND', children: [leaf('leads.rating', 'GT', 3)] });
    expect(unmappableOperators(q)).toEqual([]);
  });

  it('flags unknown wire operators and never maps them to another operator', () => {
    const tree: FilterGroup = {
      kind: 'AND',
      children: [leaf('leads.status', 'REGEX', '^O'), leaf('leads.status', 'EQ', 'OPEN')],
    };
    expect(unknownWireOperators(tree)).toEqual(['REGEX']);
    const q = fromWire(tree);
    expect(firstCondition(q).operator).toBeNull();
    const back = toWire(q);
    expect(back?.children).toEqual([leaf('leads.status', 'EQ', 'OPEN')]);
    expect(unknownWireOperators(null)).toEqual([]);
  });
});

describe('filter-tree depth', () => {
  it('counts group levels, not leaves', () => {
    expect(filterTreeDepth(null)).toBe(0);
    expect(filterTreeDepth({ kind: 'AND', children: [] })).toBe(0);
    expect(filterTreeDepth({ kind: 'AND', children: [leaf('leads.rating', 'EQ', 1), leaf('leads.rating', 'EQ', 2)] })).toBe(1);
    const deep: FilterGroup = {
      kind: 'AND',
      children: [
        leaf('leads.rating', 'EQ', 1),
        { kind: 'OR', children: [{ kind: 'AND', children: [leaf('leads.rating', 'EQ', 2)] }] },
        { kind: 'OR', children: [leaf('leads.rating', 'EQ', 3)] },
      ],
    };
    expect(filterTreeDepth(deep)).toBe(3);
  });
});

describe('filter-tree record type and support', () => {
  it('collects series metric and calculation operand keys', () => {
    expect(
      filterTreeMetricKeys([
        { metricKey: 'crm.leads.count', calculation: { operandMetricKey: 'crm.leads.qualified' } },
        { metricKey: 'crm.leads.lost' },
      ]),
    ).toEqual(['crm.leads.count', 'crm.leads.qualified', 'crm.leads.lost']);
  });

  it('resolves one record family', () => {
    expect(filterTreeRecordType([])).toBeNull();
    expect(filterTreeRecordType(['crm.leads.count', 'crm.leads.lost'])).toBe('leads');
    expect(filterTreeRecordType(['crm.opportunities.value'])).toBe('opportunities');
    expect(filterTreeRecordType(['crm.opportunities.stage_flow.count'])).toBeNull();
    expect(filterTreeRecordType(['crm.activities.count'])).toBeNull();
    expect(filterTreeRecordType(['crm.leads.count', 'crm.opportunities.value'])).toBeNull();
  });

  it('includes the calculation operand: a foreign operand makes the tree unsupported', () => {
    const same = filterTreeMetricKeys([
      { metricKey: 'crm.leads.count', calculation: { operandMetricKey: 'crm.leads.qualified' } },
    ]);
    expect(filterTreeSupported(same)).toBe(true);
    expect(filterTreeRecordType(same)).toBe('leads');

    const mixed = filterTreeMetricKeys([
      { metricKey: 'crm.leads.count', calculation: { operandMetricKey: 'crm.opportunities.count' } },
    ]);
    expect(filterTreeSupported(mixed)).toBe(false);
    expect(filterTreeRecordType(mixed)).toBeNull();

    const stageFlow = filterTreeMetricKeys([
      { metricKey: 'crm.opportunities.value', calculation: { operandMetricKey: 'crm.opportunities.stage_flow.in' } },
    ]);
    expect(filterTreeSupported(stageFlow)).toBe(false);
  });
});
