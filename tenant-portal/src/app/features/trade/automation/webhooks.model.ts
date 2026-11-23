import type { ScopeTarget } from './automation-shared/automation.model';
import type { RetryPolicyCode, WebhookRetryClass } from './webhooks.registry';

// Shapes follow trade-app src/modules/extensions-automation/webhook-subscriptions.service.ts,
// webhook-secret-reveal.service.ts and dto/extensions-automation.dto.ts.

export type { ScopeTarget, RetryPolicyCode };

/** Webhook subscriptions are TENANT or COMPANY level only. */
export type WebhookScopeTarget = Exclude<ScopeTarget, 'BRANCH'>;

export type SubscriptionStatus = 'DRAFT' | 'ACTIVE' | 'DISABLED';

export type SubscriptionVersionStatus = 'PENDING_SECRET' | 'ACTIVE' | 'DISABLED' | 'SUPERSEDED';

export type SecretStatus = 'PENDING' | 'ACTIVE' | 'OVERLAP' | 'REVOKED' | 'FAILED';

export type SecretOperationType = 'CREATE' | 'ROTATE' | 'REVOKE';

export type SecretOperationStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED';

export type DeliveryStatus =
  | 'PENDING'
  | 'RETRY_PENDING'
  | 'DELIVERED'
  | 'FAILED'
  | 'EXHAUSTED'
  | 'DISABLED';

export type AttemptOutcome = 'DELIVERED' | 'RETRYABLE_FAILURE' | 'PERMANENT_FAILURE';

/** The endpoint is never returned in full: only origin and path (no query string). */
export interface WebhookEndpoint {
  origin: string;
  pathname: string;
}

/** GET /webhooks/events item and the event entry of a subscription version. */
export interface WebhookEventDefinition {
  eventType: string;
  eventVersion: number;
  fields: string[];
}

export type WebhookEventSelection = WebhookEventDefinition;

export interface WebhookEventCatalogue {
  items: WebhookEventDefinition[];
}

/** projectSecret */
export interface WebhookSecret {
  id: string;
  status: SecretStatus;
  providerSecretVersion: string;
  algorithmCode: string;
  signatureVersion: number;
  activeFrom: string | null;
  overlapUntil: string | null;
  revokedAt: string | null;
}

export interface WebhookSecretOperation {
  id: string;
  type: SecretOperationType;
  status: SecretOperationStatus;
  safeErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookSecretRevealState {
  available: boolean;
  availableUntil: string | null;
}

/** projectSubscriptionSummary (list item). */
export interface WebhookSubscription {
  id: string;
  code: string;
  status: SubscriptionStatus;
  version: number;
  scopeTarget: WebhookScopeTarget;
  companyId: string | null;
  endpoint: WebhookEndpoint;
  activeVersionNumber: number | null;
  secret: WebhookSecret | null;
  updatedAt: string;
}

/** projectVersion (write responses). */
export interface WebhookVersionSummary {
  id: string;
  versionNumber: number;
  scopeTarget: WebhookScopeTarget;
  companyId: string | null;
  endpoint: WebhookEndpoint;
  retryPolicyCode: RetryPolicyCode;
  maxAttempts: number;
  status: SubscriptionVersionStatus;
  version: number;
}

/** currentVersion of GET /webhooks/subscriptions/:id. */
export interface WebhookSubscriptionVersion {
  id: string;
  versionNumber: number;
  scopeTarget: WebhookScopeTarget;
  companyId: string | null;
  endpoint: WebhookEndpoint;
  retryPolicyCode: RetryPolicyCode;
  maxAttempts: number;
  status: SubscriptionVersionStatus;
  branches: string[];
  events: WebhookEventDefinition[];
}

export interface WebhookSubscriptionDetail {
  id: string;
  code: string;
  status: SubscriptionStatus;
  version: number;
  currentVersion: WebhookSubscriptionVersion;
  secret: WebhookSecret | null;
  secretReveal: WebhookSecretRevealState;
  secretOperation: WebhookSecretOperation | null;
}

/** The subscription entity as the write endpoints serialize it. */
export interface WebhookSubscriptionEntity {
  id: string;
  code: string;
  status: SubscriptionStatus;
  currentActiveVersionId: string | null;
  currentSecretReferenceId: string | null;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/** POST /webhooks/subscriptions (201). */
export interface CreateSubscriptionResult extends WebhookSubscriptionEntity {
  currentVersion: WebhookVersionSummary;
  secretSetup: {
    status: 'PENDING';
    operationId: string;
    secretReferenceId: string;
    plaintextReturned: false;
  };
}

/** PATCH /webhooks/subscriptions/:id (200). */
export interface UpdateSubscriptionResult extends WebhookSubscriptionEntity {
  currentVersion: WebhookVersionSummary;
}

/** POST rotate-secret / revoke-secret (202). */
export interface SecretOperationAccepted {
  statusCode: 202;
  subscriptionId: string;
  status: 'PENDING_PROVIDER_RECONCILIATION';
  operationId: string;
  secretReferenceId: string;
  plaintextReturned: false;
}

/** POST /webhooks/subscriptions/:id/test (202). */
export interface TestDeliveryAccepted {
  statusCode: 202;
  deliveryId: string;
  status: DeliveryStatus;
  synthetic: true;
}

/** POST /webhooks/deliveries/:id/retry (202). */
export interface RetryDeliveryAccepted {
  statusCode: 202;
  deliveryId: string;
  status: 'RETRY_PENDING';
  nextAttemptAt: string;
}

/** POST reveal-secret (200, Cache-Control: private, no-store). The only place the plaintext exists. */
export interface RevealSecretResult {
  secretReferenceId: string;
  secret: string;
  secretEncoding: 'base64';
  algorithmCode: 'HMAC_SHA256';
}

/** projectDeliveries item. */
export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  subscriptionCode: string;
  status: DeliveryStatus;
  sourceEventType: string;
  sourceEventId: string;
  companyId: string | null;
  branchId: string | null;
  payloadSchemaCode: string;
  payloadHash: string;
  payloadSizeBytes: number;
  attemptCount: number;
  nextAttemptAt: string | null;
  terminalAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  endpoint: WebhookEndpoint;
}

export interface WebhookDeliveryAttempt {
  attemptNumber: number;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  outcome: AttemptOutcome | null;
  retryClass: WebhookRetryClass | null;
  httpStatus: number | null;
  safeErrorCode: string | null;
}

export interface WebhookDeliveryDetail extends WebhookDelivery {
  attempts: WebhookDeliveryAttempt[];
}

export interface WebhookDeliveryCounts {
  total: number;
  byStatus: Record<DeliveryStatus, number>;
}

export type DeliveryCounts = WebhookDeliveryCounts;

export interface ListSubscriptionsQuery {
  status?: SubscriptionStatus;
  page?: number;
  limit?: number;
}

export interface CreateSubscriptionInput {
  code: string;
  scopeTarget: WebhookScopeTarget;
  endpointUri: string;
  retryPolicyCode: RetryPolicyCode;
  maxAttempts: number;
  branchIds?: string[];
  events: WebhookEventSelection[];
}

export interface UpdateSubscriptionInput {
  endpointUri?: string;
  retryPolicyCode?: RetryPolicyCode;
  maxAttempts?: number;
  status?: 'ACTIVE' | 'DISABLED';
  branchIds?: string[];
  events?: WebhookEventSelection[];
}

/** WebhookDeliveryFiltersDto (status is a comma list on the wire). */
export interface DeliveryFilters {
  status?: DeliveryStatus[];
  subscriptionId?: string;
  eventType?: string;
  createdFrom?: string;
  createdTo?: string;
}

export interface ListDeliveriesQuery extends DeliveryFilters {
  page?: number;
  limit?: number;
}

export interface RetryDeliveryInput {
  reasonCode: string;
  reasonNote?: string;
}

/** The URL the backend projects: origin + path. */
export function endpointText(endpoint: WebhookEndpoint): string {
  return `${endpoint.origin}${endpoint.pathname === '/' ? '' : endpoint.pathname}`;
}

/** Retry is a manual action on an EXHAUSTED delivery whose last attempt failed with a retryable class. */
export function canRetryDelivery(
  delivery: WebhookDeliveryDetail,
  subscriptionStatus: SubscriptionStatus | null,
): boolean {
  if (delivery.status !== 'EXHAUSTED' || subscriptionStatus !== 'ACTIVE') return false;
  const last = delivery.attempts.at(-1);
  return (
    last?.outcome === 'RETRYABLE_FAILURE' &&
    (last.retryClass === 'TIMEOUT' ||
      last.retryClass === 'RATE_LIMIT' ||
      last.retryClass === 'SERVER_ERROR' ||
      last.retryClass === 'NETWORK_ERROR')
  );
}
