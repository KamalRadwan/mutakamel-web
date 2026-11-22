import {
  assertReasonCodeShape,
  assertReasonNoteShape,
  assertUsableReasonCode,
} from '../shared/trade-foundation.fake';
import type { ReasonCode } from '../shared/trade-foundation.model';

export type GovernanceReasonKind =
  | 'PRICE_VERSION_RETIRE'
  | 'POLICY_VERSION_REJECT'
  | 'POLICY_VERSION_RETIRE'
  | 'POLICY_VERSION_ROLLBACK'
  | 'WORKFLOW_VERSION_REJECT'
  | 'WORKFLOW_VERSION_RETIRE'
  | 'WORKFLOW_VERSION_ROLLBACK';

/**
 * The governance reasons live in the shared seed (`REASON_SEEDS` in trade-foundation.fake.ts), like the
 * backend starter catalogue. Kept so existing callers keep working; nothing is pushed at runtime.
 */
export function seedGovernanceReasons(): void {
  // One source: TRADE_FAKE_DB.reasons.
}

/**
 * Same as the backend: the DTO accepts only a reason code (`^[A-Z][A-Z0-9_]{1,39}$`) and a note of at most
 * 500 characters (both 400 TRADE.VALIDATION_FAILED), then `assertUsableCode`
 * (NOT_FOUND -> INACTIVE -> KIND_INVALID -> NOTE_REQUIRED, 422).
 */
export function validateGovernanceReason(
  kind: GovernanceReasonKind,
  reasonCode: string | null | undefined,
  reasonNote?: string | null,
): { reason: ReasonCode; reasonCode: string; reasonNote: string } {
  assertReasonCodeShape(reasonCode);
  assertReasonNoteShape(reasonNote);
  const reason = assertUsableReasonCode(kind, reasonCode, reasonNote);
  return { reason, reasonCode: reason.code, reasonNote: (reasonNote ?? '').trim() };
}
