import type { TranslocoService } from '@jsverse/transloco';
import { ApiError as CoreApiError, errorMessage } from '../../../../core/api/api-errors';
import type { TenantScopeState } from '../../../../core/scope/tenant-scope';
import { ApiError, type TradeContext } from '../../shared/trade-api';
import { REASON_KINDS, type KnownReasonKind } from '../../shared/reasons/reason-kinds';
import { reasonErrorKey } from '../../shared/reasons/reasons-admin.api';

const REASON_KIND_SET: ReadonlySet<string> = new Set(REASON_KINDS);

export function isKnownReasonKind(value: string | null | undefined): value is KnownReasonKind {
  return typeof value === 'string' && REASON_KIND_SET.has(value);
}

export function isForbiddenError(error: unknown): boolean {
  return (error instanceof ApiError || error instanceof CoreApiError) && error.status === 403;
}

export function optionalTradeContext(tenantScope: TenantScopeState): TradeContext {
  const selection = tenantScope.selection?.();
  if (!selection?.companyId) return {};
  return selection.branchId
    ? { companyId: selection.companyId, branchId: selection.branchId }
    : { companyId: selection.companyId };
}

/**
 * Resolves localized error text for Trade ApiError and CoreApiError values.
 * Checks reasonErrorKey / tset.errors first, then tradeShared.errors (e.g. TRADE.CONTEXT.MISSING_COMPANY),
 * then falls back to shared Core error mapping (401, 403, 429, network, gateway idempotency).
 */
export function reasonErrorText(error: unknown, transloco: TranslocoService): string {
  if (error instanceof ApiError) {
    const mappedKey = reasonErrorKey(error);
    if (mappedKey !== 'tset.errors.generic') {
      const translated = transloco.translate(mappedKey);
      if (translated && translated !== mappedKey) return translated;
    }

    const normalized = error.code.replaceAll('.', '_');
    for (const prefix of ['tset.errors.', 'tradeShared.errors.'] as const) {
      const candidate = `${prefix}${normalized}`;
      const translated = transloco.translate(candidate);
      if (translated && translated !== candidate) return translated;
    }

    return errorMessage(
      new CoreApiError(error.status, error.code, error.details, { correlationId: error.correlationId }),
      'tset.errors',
      transloco,
    );
  }

  return errorMessage(error, 'tset.errors', transloco);
}
