import { afterEach, describe, expect, it } from 'vitest';
import { validateAutomationReason } from '../automation/automation-reasons.seed';
import { validateGovernanceReason } from '../governance/governance-reasons.seed';
import { ApiError } from './trade-api';
import {
  TRADE_FAKE_DB,
  assertReasonNoteShape,
  assertUsableReason,
  assertUsableReasonCode,
} from './trade-foundation.fake';

function caught(fn: () => unknown): ApiError {
  try {
    fn();
  } catch (error) {
    return error as ApiError;
  }
  throw new Error('expected an error');
}

const touched: { id: string; isActive: boolean }[] = [];
function deactivate(id: string): void {
  const row = TRADE_FAKE_DB.reasons.find((r) => r.id === id)!;
  touched.push({ id, isActive: row.isActive });
  row.isActive = false;
}

afterEach(() => {
  for (const t of touched.splice(0)) {
    TRADE_FAKE_DB.reasons.find((r) => r.id === t.id)!.isActive = t.isActive;
  }
});

describe('shared reason rule (backend TradeReasonsService)', () => {
  it('checks NOT_FOUND first, with details.field', () => {
    const error = caught(() => assertUsableReason({ id: 'rsn-missing', kind: 'ITEM_DISCONTINUE' }));
    expect([error.status, error.code]).toEqual([422, 'TRADE.REASON.NOT_FOUND']);
    expect(error.details).toEqual({ field: ['reasonCodeId'] });
  });

  it('checks INACTIVE before KIND_INVALID', () => {
    deactivate('rsn-account_block-legal');
    const error = caught(() => assertUsableReason({ id: 'rsn-account_block-legal', kind: 'ITEM_DISCONTINUE' }));
    expect(error.code).toBe('TRADE.REASON.INACTIVE');
  });

  it('reports KIND_INVALID with reason kind_mismatch, before NOTE_REQUIRED', () => {
    const error = caught(() => assertUsableReason({ id: 'rsn-account_block-other', kind: 'ITEM_DISCONTINUE' }));
    expect(error.code).toBe('TRADE.REASON.KIND_INVALID');
    expect(error.details).toEqual({ field: ['reasonCodeId'], reason: ['kind_mismatch'] });
  });

  it('requires a note for OTHER last', () => {
    const error = caught(() => assertUsableReason({ id: 'rsn-item_discontinue-other', kind: 'ITEM_DISCONTINUE', note: ' ' }));
    expect(error.code).toBe('TRADE.REASON.NOTE_REQUIRED');
    expect(error.details).toEqual({ field: ['reasonCodeId'] });
  });

  it('code look-up prefers the requested kind and uses field reasonCode', () => {
    expect(assertUsableReasonCode('CONTROL_TOWER_RESOLVE', 'OTHER', 'n').kind).toBe('CONTROL_TOWER_RESOLVE');
    const error = caught(() => assertUsableReasonCode('CONTROL_TOWER_RESOLVE', 'OPERATOR_RETRY'));
    expect(error.details).toEqual({ field: ['reasonCode'], reason: ['kind_mismatch'] });
  });

  it('treats a note over 500 as a DTO error: 400 VALIDATION_FAILED', () => {
    expect(() => assertReasonNoteShape('x'.repeat(500))).not.toThrow();
    const error = caught(() => assertReasonNoteShape('x'.repeat(501)));
    expect([error.status, error.code]).toEqual([400, 'TRADE.VALIDATION_FAILED']);
  });
});

describe('automation and governance reasons come from the shared seed', () => {
  it('seeds the backend codes once in TRADE_FAKE_DB.reasons', () => {
    const codes = (kind: string) => TRADE_FAKE_DB.reasons.filter((r) => r.kind === kind).map((r) => r.code);
    expect(codes('CONTROL_TOWER_RESOLVE')).toEqual(['SOURCE_FIXED', 'DUPLICATE_RESULT_IGNORED', 'CONFIRMED_WITH_OWNER', 'OTHER']);
    expect(codes('WEBHOOK_DELIVERY_RETRY')).toEqual(['OPERATOR_RETRY', 'ENDPOINT_FIXED', 'SECRET_ROTATED', 'OTHER']);
    expect(codes('PRICE_VERSION_RETIRE')).toEqual(['REPLACED_BY_NEW_PRICES', 'PRICING_ERROR', 'CAMPAIGN_ENDED', 'OTHER']);
  });

  it('automation accepts only codes, never the reason id', () => {
    expect(validateAutomationReason('CONTROL_TOWER_RESOLVE', 'SOURCE_FIXED').reasonCode).toBe('SOURCE_FIXED');
    const error = caught(() => validateAutomationReason('CONTROL_TOWER_RESOLVE', 'rsn-control_tower_resolve-source_fixed'));
    expect([error.status, error.code]).toEqual([400, 'TRADE.VALIDATION_FAILED']);
  });

  it('governance rejects a 501-character note with 400', () => {
    const error = caught(() => validateGovernanceReason('POLICY_VERSION_RETIRE', 'REPLACED', 'x'.repeat(501)));
    expect([error.status, error.code]).toEqual([400, 'TRADE.VALIDATION_FAILED']);
  });
});
