// Mirrors trade-app extensions-registry.ts WEBHOOK_EVENT_FIELDS and the worker
// contract TRADE_WEBHOOK_SOURCE_FIELDS (GET /webhooks/events answers the same list).
export type WebhookEventType =
  | 'trading.catalog.item_changed.v1'
  | 'trading.commercial_account.changed.v1'
  | 'trading.quotation.sent.v1'
  | 'trading.quotation.accepted.v1'
  | 'trading.sales_order.confirmed.v1'
  | 'trading.purchase_order.confirmed.v1'
  | 'inventory.receipt.completed.v1'
  | 'inventory.delivery.completed.v1';

export interface WebhookEventSpec {
  eventType: WebhookEventType;
  eventVersion: number;
  fields: readonly string[];
}

export type RetryPolicyCode = 'EXPONENTIAL_STANDARD' | 'EXPONENTIAL_CONSERVATIVE';

export interface RetryPolicySpec {
  code: RetryPolicyCode;
  baseSeconds: number;
  maxSeconds: number;
}

/** Worker contract TradeWebhookRetryClass. */
export type WebhookRetryClass =
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'SERVER_ERROR'
  | 'CLIENT_ERROR'
  | 'DESTINATION_FORBIDDEN'
  | 'REDIRECT_FORBIDDEN'
  | 'SECRET_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'RESPONSE_TOO_LARGE'
  | 'INTEGRITY_ERROR';

export interface RetryClassSpec {
  code: WebhookRetryClass;
  retryable: boolean;
}

export const WEBHOOK_EVENTS: readonly WebhookEventSpec[] = [
  {
    eventType: 'trading.catalog.item_changed.v1',
    eventVersion: 1,
    fields: ['aggregateId', 'aggregateVersion', 'companyId', 'itemKind', 'canonicalCode', 'status', 'changedFields', 'businessEffectiveAt'],
  },
  {
    eventType: 'trading.commercial_account.changed.v1',
    eventVersion: 1,
    fields: ['aggregateId', 'aggregateVersion', 'companyId', 'partyId', 'accountRole', 'status', 'changedFields', 'businessEffectiveAt'],
  },
  {
    eventType: 'trading.quotation.sent.v1',
    eventVersion: 1,
    fields: ['aggregateId', 'aggregateVersion', 'companyId', 'branchId', 'quotationNumber', 'currencyCode', 'grandTotal', 'validUntil', 'businessEffectiveAt'],
  },
  {
    eventType: 'trading.quotation.accepted.v1',
    eventVersion: 1,
    fields: ['aggregateId', 'aggregateVersion', 'companyId', 'branchId', 'quotationNumber', 'businessEffectiveAt'],
  },
  {
    eventType: 'trading.sales_order.confirmed.v1',
    eventVersion: 1,
    fields: ['aggregateId', 'aggregateVersion', 'companyId', 'branchId', 'orderNumber', 'currencyCode', 'grandTotal', 'businessEffectiveAt'],
  },
  {
    eventType: 'trading.purchase_order.confirmed.v1',
    eventVersion: 1,
    fields: ['aggregateId', 'aggregateVersion', 'companyId', 'branchId', 'orderNumber', 'currencyCode', 'grandTotal', 'businessEffectiveAt'],
  },
  {
    eventType: 'inventory.receipt.completed.v1',
    eventVersion: 1,
    fields: ['aggregateId', 'aggregateVersion', 'companyId', 'branchId', 'purchaseOrderId', 'fulfillmentNodeId', 'businessEffectiveAt'],
  },
  {
    eventType: 'inventory.delivery.completed.v1',
    eventVersion: 1,
    fields: ['aggregateId', 'aggregateVersion', 'companyId', 'branchId', 'salesOrderId', 'fulfillmentNodeId', 'businessEffectiveAt'],
  },
] as const;

const MAX_BACKOFF_SECONDS = 6 * 3600;

export const RETRY_POLICIES: readonly RetryPolicySpec[] = [
  { code: 'EXPONENTIAL_STANDARD', baseSeconds: 30, maxSeconds: MAX_BACKOFF_SECONDS },
  { code: 'EXPONENTIAL_CONSERVATIVE', baseSeconds: 60, maxSeconds: MAX_BACKOFF_SECONDS },
] as const;

// Manual retry is allowed only after these classes (webhook-subscriptions.service.ts retryDelivery).
export const RETRY_CLASSES: readonly RetryClassSpec[] = [
  { code: 'TIMEOUT', retryable: true },
  { code: 'RATE_LIMIT', retryable: true },
  { code: 'SERVER_ERROR', retryable: true },
  { code: 'NETWORK_ERROR', retryable: true },
  { code: 'CLIENT_ERROR', retryable: false },
  { code: 'DESTINATION_FORBIDDEN', retryable: false },
  { code: 'REDIRECT_FORBIDDEN', retryable: false },
  { code: 'SECRET_UNAVAILABLE', retryable: false },
  { code: 'RESPONSE_TOO_LARGE', retryable: false },
  { code: 'INTEGRITY_ERROR', retryable: false },
] as const;

export const RETRY_REASON_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,39}$/;

export const SUBSCRIPTION_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,79}$/;

export const WEBHOOK_LIMITS = {
  maxEventsPerSubscription: 30,
  maxFieldsPerEvent: 40,
  maxBranches: 100,
  maxEndpointLength: 2048,
  maxReasonNote: 500,
  minAttempts: 1,
  maxAttempts: 10,
  defaultAttempts: 6,
  minOverlapHours: 30,
  maxOverlapHours: 168,
  defaultOverlapHours: 30,
  revealWindowMinutes: 15,
} as const;

const SECRET_QUERY_KEY_PATTERN = /(token|secret|key|auth|signature|credential)/i;

export function getWebhookEvent(eventType: string): WebhookEventSpec | undefined {
  return WEBHOOK_EVENTS.find((e) => e.eventType === eventType);
}

export function isRetryClassRetryable(code: WebhookRetryClass | null | undefined): boolean {
  if (!code) return false;
  return RETRY_CLASSES.find((c) => c.code === code)?.retryable ?? false;
}

export function backoffSeconds(policy: RetryPolicyCode, attempt: number): number {
  const spec = RETRY_POLICIES.find((p) => p.code === policy) ?? RETRY_POLICIES[0];
  const n = Math.max(1, Math.trunc(attempt));
  const raw = spec.baseSeconds * 4 ** (n - 1);
  return Math.min(raw, spec.maxSeconds);
}

export function backoffText(
  policy: RetryPolicyCode,
  attempt: number,
  lang: 'en' | 'ar' = 'en',
): string {
  const sec = backoffSeconds(policy, attempt);
  if (sec < 60) {
    return lang === 'ar' ? `${sec} ثانية` : `${sec}s`;
  }
  const mins = Math.floor(sec / 60);
  if (mins < 60) {
    return lang === 'ar' ? `${mins} دقيقة` : `${mins}m`;
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (remMins === 0) {
    return lang === 'ar' ? `${hours} ساعات` : `${hours}h`;
  }
  return lang === 'ar' ? `${hours} س ${remMins} د` : `${hours}h ${remMins}m`;
}

export function endpointProblems(url: string): string[] {
  const trimmed = (url ?? '').trim();
  if (!trimmed) {
    return ['INVALID_URL'];
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return ['INVALID_URL'];
  }

  const problems: string[] = [];

  if (parsed.protocol !== 'https:') {
    problems.push('HTTPS_REQUIRED');
  }
  if (parsed.username !== '' || parsed.password !== '') {
    problems.push('USERINFO_FORBIDDEN');
  }
  if (parsed.hash !== '' || trimmed.includes('#')) {
    problems.push('FRAGMENT_FORBIDDEN');
  }

  const host = parsed.hostname.toLowerCase();
  const isLocalhost =
    host === 'localhost' ||
    host.endsWith('.local') ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '[::1]' ||
    host.startsWith('127.');
  if (isLocalhost) {
    problems.push('LOCALHOST_FORBIDDEN');
  }

  if (parsed.port !== '' && parsed.port !== '443' && parsed.port !== '8443') {
    problems.push('PORT_FORBIDDEN');
  }

  for (const [key] of parsed.searchParams.entries()) {
    if (SECRET_QUERY_KEY_PATTERN.test(key)) {
      problems.push('SECRET_QUERY_FORBIDDEN');
      break;
    }
  }

  return problems;
}
