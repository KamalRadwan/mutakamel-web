import {
  assertReasonCodeShape,
  assertReasonNoteShape,
  assertUsableReasonCode,
} from '../shared/trade-foundation.fake';

export type AutomationReasonKind = 'WEBHOOK_DELIVERY_RETRY' | 'CONTROL_TOWER_RESOLVE';

/**
 * The automation reasons live in the shared seed (`REASON_SEEDS` in trade-foundation.fake.ts), like the
 * backend starter catalogue. Kept so existing callers keep working; nothing is pushed at runtime.
 */
export function seedAutomationReasons(): void {
  // One source: TRADE_FAKE_DB.reasons.
}

/**
 * Same as the backend: the DTO accepts only a reason code (`^[A-Z][A-Z0-9_]{1,39}$`, never the id) and a
 * note of at most 500 characters (both 400 TRADE.VALIDATION_FAILED), then `assertUsableCode`
 * (NOT_FOUND -> INACTIVE -> KIND_INVALID -> NOTE_REQUIRED, 422).
 */
export function validateAutomationReason(
  kind: AutomationReasonKind,
  reasonCode: string | null | undefined,
  reasonNote?: string | null,
): { reasonCode: string; reasonNote: string } {
  assertReasonCodeShape(reasonCode);
  assertReasonNoteShape(reasonNote);
  const reason = assertUsableReasonCode(kind, reasonCode, reasonNote);
  return { reasonCode: reason.code, reasonNote: (reasonNote ?? '').trim() };
}
