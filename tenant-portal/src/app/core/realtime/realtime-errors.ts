import { ApiError, errorMessage } from '../api/api-errors';
import type { SettingsTranslator } from '../api/settings-translator';
import {
  realtimeAdmissionErrorSchema,
  realtimeGatewayActivationErrorSchema,
  realtimeGatewayAdmissionSchema,
  realtimeProtocolErrorSchema,
  type RealtimeFailure,
} from './realtime-client.model';

export class RealtimeError extends ApiError {
  constructor(readonly failure: RealtimeFailure) {
    super(
      failure.status,
      failure.code,
      failure.retryAfterMs === null
        ? undefined
        : { retryAfterSeconds: [String(Math.ceil(failure.retryAfterMs / 1_000))] },
      { correlationId: failure.correlationId },
    );
  }
}

export function realtimeFailure(error: unknown): RealtimeFailure {
  if (error instanceof RealtimeError) return error.failure;
  if (error instanceof ApiError)
    return {
      code: error.code,
      status: error.status,
      retryable: error.status === 0 || error.status === 429 || error.status >= 500,
      retryAfterMs: null,
      correlationId: error.correlationId ?? null,
    };
  const data = typeof error === 'object' && error !== null && 'data' in error ? error.data : error;
  const admission = realtimeAdmissionErrorSchema.safeParse(data);
  const gateway = realtimeGatewayAdmissionSchema.safeParse(data);
  const protocol = realtimeProtocolErrorSchema.safeParse(data);
  const activation = realtimeGatewayActivationErrorSchema.safeParse(data);
  if (admission.success || protocol.success || gateway.success || activation.success) {
    const parsed = admission.success
      ? admission.data
      : protocol.success
        ? protocol.data
        : gateway.success
          ? gateway.data
          : activation.data;
    if (parsed)
      return {
        code: parsed.code,
        status: parsed.code.includes('.AUTH.') ? 403 : parsed.code.includes('.LIMIT.') ? 429 : 503,
        retryable:
          parsed.retryable &&
          !parsed.code.includes('.AUTH.') &&
          !parsed.code.includes('.PROTOCOL.'),
        retryAfterMs: parsed.retryAfterMs,
        correlationId: admission.success ? admission.data.correlationId : null,
      };
  }
  return {
    code: 'NETWORK_ERROR',
    status: 0,
    retryable: true,
    retryAfterMs: null,
    correlationId: null,
  };
}

/** Uses the existing scoped/shared error resolver; no server-provided message is displayed. */
export function realtimeErrorMessage(failure: RealtimeFailure, t: SettingsTranslator): string {
  return errorMessage(new RealtimeError(failure), 'realtime', t);
}

export function realtimeClientFailure(code: string, retryable = false): RealtimeFailure {
  return { code, retryable, status: retryable ? 0 : 503, retryAfterMs: null, correlationId: null };
}
