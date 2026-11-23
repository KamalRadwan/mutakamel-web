import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadFilterDomains } from '../widgets.api';
import { TestBed } from '@angular/core/testing';
import { OrgApi } from '../../../../../shared/widgets/dashboard/org.api';
import { bindAnalyticsPermissions } from '../../../../../shared/widgets/dashboard/analytics-permissions';
import { bindCrmHttpForTest, crmQueries } from '../../../shared/crm-http';
import { CrmHttpStub } from '../../../shared/testing/crm-http-testing';
import { ApiError } from '../../../../../core/api/api-errors';
import type { Condition, Group, Operator, Query } from '../../../../../shared/query-builder/query.model';
import type { FilterGroup, FilterLeaf } from '../../../../../shared/widgets/dashboard/analytics.model';
import {
  filterTreeDepth,
  filterFieldsFor,
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


describe('filter domains', () => {
  it('contains no seeded people, acquisition sources or opportunity stages', () => {
    for (const record of ['leads', 'opportunities'] as const) {
      const fields = filterFieldsFor(record, 'en');
      for (const field of fields.filter((item) => item.kind === 'enum')) {
        expect(field.options).toEqual([]);
      }
    }
  });

  it('uses server UUIDs and bilingual labels while keeping domains isolated', () => {
    const domains = {
      'leads.sourceId': [{ value: 'source-uuid', labelEn: 'Exhibition', labelAr: 'معرض' }],
      'leads.ownerUserId': [{ value: 'user-uuid', labelEn: 'Owner', labelAr: 'المسؤول' }],
      'opportunities.stageId': [{ value: 'stage-uuid', labelEn: 'Review', labelAr: 'مراجعة' }],
    };
    expect(filterFieldsFor('leads', 'ar', domains).find((f) => f.id === 'leads.sourceId')?.options)
      .toEqual([{ value: 'source-uuid', label: 'معرض' }]);
    expect(filterFieldsFor('opportunities', 'en', domains).find((f) => f.id === 'opportunities.stageId')?.options)
      .toEqual([{ value: 'stage-uuid', label: 'Review' }]);
    expect(filterFieldsFor('leads', 'en').find((f) => f.id === 'leads.sourceId')?.options).toEqual([]);
  });
});


describe('live filter domain loading', () => {
  let org: OrgApi;
  let dispose: () => void;
  let stub: CrmHttpStub;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    org = TestBed.inject(OrgApi);
    bindAnalyticsPermissions(() => ['users.user.read', 'crm.acquisition_sources.read', 'crm.pipelines.manage']);
    stub = new CrmHttpStub({
      '/static-data': { enumOptions: { leadStatuses: [{ value: 'OPEN', label: { en: 'Open', ar: 'مفتوح' } }] } },
      '/acquisition-sources': [
        { id: 'source', nameEn: 'Fair', nameAr: 'معرض', isActive: true },
        { id: 'old-source', nameEn: 'Old', nameAr: 'قديم', isActive: false },
      ],
      '/opportunity-stages': [
        { id: 'stage', nameEn: 'Review', nameAr: 'مراجعة', isActive: true },
        { id: 'old-stage', nameEn: 'Old', nameAr: 'قديم', isActive: false },
      ],
    });
    dispose = bindCrmHttpForTest(stub);
    vi.spyOn(org, 'listUsers').mockResolvedValue([{ id: 'user', name: 'Owner', nameAr: 'Owner',
      email: 'owner@example.test', teamId: 'team', branchId: 'branch' }]);
  });
  afterEach(() => { crmQueries().clear(); dispose(); vi.restoreAllMocks(); TestBed.resetTestingModule(); bindAnalyticsPermissions(() => []); });

  it('loads people, active sources, active stages and status options from their real contracts', async () => {
    const domains = await loadFilterDomains(org);
    expect(domains['leads.sourceId']).toEqual([{ value: 'source', labelEn: 'Fair', labelAr: 'معرض' }]);
    expect(domains['opportunities.stageId']).toEqual([{ value: 'stage', labelEn: 'Review', labelAr: 'مراجعة' }]);
    expect(domains['leads.ownerUserId']?.map((o) => o.value)).toEqual(['user']);
    expect(domains['leads.status']?.map((o) => o.value)).toEqual(['OPEN']);
  });

  it('propagates lookup failure instead of returning a substitute domain', async () => {
    vi.spyOn(stub, 'read').mockRejectedValueOnce(new ApiError(503, 'GW.UPSTREAM.UNAVAILABLE'));
    await expect(loadFilterDomains(org)).rejects.toMatchObject({ status: 503 });
  });

  it('does not request directories or catalogues without their read permission', async () => {
    bindAnalyticsPermissions(() => []);
    const domains = await loadFilterDomains(org);
    expect(org.listUsers).not.toHaveBeenCalled();
    expect(stub.recordedReads().map((read) => read.path)).toEqual(['/static-data']);
    expect(domains['leads.sourceId']).toEqual([]);
    expect(domains['opportunities.stageId']).toEqual([]);
  });
});
