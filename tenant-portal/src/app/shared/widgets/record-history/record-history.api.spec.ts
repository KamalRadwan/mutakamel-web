import { describe, expect, it } from 'vitest';
import type { AuditEvent, AuditHistoryGroup } from '../../../features/workspace/operations/audit-log/audit-log.api';
import {
  historyItemFromEvent,
  historyItemFromGroup,
  listRecordHistory,
  planHistoryCategory,
  relatedPartyIdsFor,
} from './record-history.api';
import { HistoryItem } from './record-history.model';

const V7 = (n: number) => `0192b7ea-7c4f-7a7d-9c9f-${String(n).padStart(12, '0')}`;

function item(partial: Partial<HistoryItem>): HistoryItem {
  return {
    id: 'h',
    action: 'UPDATE',
    subjectKind: 'lead',
    subjectId: null,
    referenceLabel: null,
    createdAt: '2026-11-20T10:00:00.000Z',
    actorLabel: null,
    actorType: 'USER',
    outcome: 'SUCCESS',
    reason: null,
    diff: [],
    ...partial,
  };
}

describe('record-history.api over the audit-log wrappers', () => {
  it('maps widget filters to backend historyCategory values', () => {
    expect(planHistoryCategory(undefined)).toEqual({});
    expect(planHistoryCategory('contact')).toEqual({ backend: 'contact' });
    expect(planHistoryCategory('record').backend).toBe('lead');
    expect(planHistoryCategory('details').backend).toBe('lead');
    const stages = planHistoryCategory('stages');
    expect(stages.backend).toBe('lead');
    expect(stages.keep?.(item({ action: 'OPPORTUNITY_STAGE_CHANGED' }))).toBe(true);
    expect(stages.keep?.(item({ action: 'OPPORTUNITY_UPDATED' }))).toBe(false);
    const note = planHistoryCategory('note');
    expect(note.backend).toBeUndefined();
    expect(note.keep?.(item({ subjectKind: 'note' }))).toBe(true);
  });

  it('sends only 1..21 unique UUIDv7 related party ids', () => {
    const ids = Array.from({ length: 25 }, (_, i) => V7(i));
    expect(relatedPartyIdsFor([...ids, ids[0], 'party-c-1-2'])).toEqual(ids.slice(0, 21));
    expect(relatedPartyIdsFor(['party-c-1-2'])).toEqual([]);
  });

  it('keeps grouped rows as they are and maps flat events like the grouped view', () => {
    const group: AuditHistoryGroup = {
      ...item({ id: 'g1' }),
      subjectKind: 'contact',
      diff: [{ field: 'phone', before: 'a', after: 'b' }],
    };
    expect(historyItemFromGroup(group)).toEqual(group);
    const event = {
      id: 'e1',
      action: 'CUSTOMER_PROFILE_UPDATED',
      entityType: 'CustomerProfile',
      entityId: V7(1),
      entityLabel: 'Acme Retail',
      createdAt: '2026-11-20T10:00:00.000Z',
      actorLabel: 'Mona Adel',
      actorType: 'USER',
      outcome: 'SUCCESS',
      reason: null,
      diff: null,
      before: { status: 'PROSPECT', updatedAt: 'x' },
      after: { status: 'INACTIVE', updatedAt: 'y' },
    } as unknown as AuditEvent;
    const mapped = historyItemFromEvent(event);
    expect(mapped.subjectKind).toBe('lead');
    expect(mapped.referenceLabel).toBe('Acme Retail');
    expect(mapped.diff).toEqual([{ field: 'status', before: 'PROSPECT', after: 'INACTIVE' }]);
  });

  it('routes a Lead to the record history route and returns its seeded events (the fake accepts lead-* ids)', async () => {
    const page = await listRecordHistory('Lead', 'lead-001', []);
    expect(page.items.length).toBeGreaterThan(0);
  });
});
