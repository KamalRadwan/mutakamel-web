import { InjectionToken } from '@angular/core';
import { z } from 'zod';

// RT10: realtime-app/packages/contracts/src/{constants,handshake,socket,primitives}.ts.
// Kept local because dependency manifests belong to infra-link-bulk-2.
const uuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const uuid7 = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const date = z.iso.datetime();
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const printable = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .regex(/^[^\u0000-\u001f\u007f-\u009f]+$/u);
export const notificationCursorSchema = printable(512);
const safeType = z.string().regex(/^[a-z][a-z0-9_.-]{0,127}$/);
const scope = z.enum(['CRM_LEADS', 'PRESENCE', 'NOTIFICATIONS', 'ALL']);
export type RealtimeScope = z.infer<typeof scope>;
const tuple = {
  presenceGeneration: uuid,
  logicalSessionId: uuid,
  sessionStartedAt: date,
  stateVersion: integer,
};
const envelope = {
  contractVersion: z.literal(1),
  eventId: uuid,
  occurredAt: date,
  correlationId: uuid,
};
const event = <T extends z.ZodType>(payload: T) => z.strictObject({ ...envelope, payload });
const presenceEvent = <T extends z.ZodType>(payload: T) =>
  z.strictObject({ ...envelope, ...tuple, payload });

export const realtimeProtocolErrorSchema = z.strictObject({
  code: z.enum([
    'REALTIME.AUTH.REQUIRED',
    'REALTIME.AUTH.TOKEN_EXPIRED',
    'REALTIME.AUTH.NOT_AUTHORIZED',
    'REALTIME.AUTH.ACCESS_REVOKED',
    'REALTIME.PROTOCOL.UNSUPPORTED_VERSION',
    'REALTIME.PROTOCOL.INVALID_PAYLOAD',
    'REALTIME.PROTOCOL.PAYLOAD_TOO_LARGE',
    'REALTIME.PROTOCOL.IDEMPOTENCY_CONFLICT',
    'REALTIME.PROTOCOL.STALE_STATE',
    'REALTIME.LIMIT.RATE_LIMITED',
    'REALTIME.LIMIT.TOO_MANY_CONNECTIONS',
    'REALTIME.LIMIT.TOO_MANY_SUBSCRIPTIONS',
    'REALTIME.DEPENDENCY.SERVER_NOT_READY',
    'REALTIME.RECOVERY.RESYNC_REQUIRED',
    'REALTIME.INTERNAL.ERROR',
  ]),
  message: z.string().min(1).max(256),
  retryable: z.boolean(),
  retryAfterMs: z.number().int().min(0).max(60_000).nullable(),
});
export const realtimeAdmissionErrorSchema = z.strictObject({
  contractVersion: z.literal(1),
  code: z.enum([
    'REALTIME.HANDSHAKE.INVALID',
    'REALTIME.AUTH.MISSING_TOKEN',
    'REALTIME.AUTH.TOKEN_IN_URL',
    'REALTIME.AUTH.INVALID_TOKEN',
    'REALTIME.AUTH.TOKEN_EXPIRED',
    'REALTIME.AUTH.AUDIENCE_NOT_ALLOWED',
    'REALTIME.AUTH.ORIGIN_NOT_ALLOWED',
    'REALTIME.AUTH.TENANT_HOST_MISMATCH',
    'REALTIME.AUTH.TENANT_INACTIVE',
    'REALTIME.AUTH.IDENTITY_INACTIVE',
    'REALTIME.AUTH.SESSION_INVALIDATED',
    'REALTIME.AUTH.NOT_ALLOWED',
    'REALTIME.DEPENDENCY.ADMISSION_UNAVAILABLE',
    'REALTIME.DEPENDENCY.SERVER_NOT_READY',
    'REALTIME.LIMIT.RATE_LIMITED',
  ]),
  message: z.string().min(1).max(256),
  retryable: z.boolean(),
  correlationId: uuid7,
  retryAfterMs: z.number().int().min(0).max(60_000).nullable(),
});
/** socketError() currently exposes this smaller data object on connect_error. */
export const realtimeGatewayAdmissionSchema = realtimeAdmissionErrorSchema.pick({
  code: true,
  retryable: true,
  retryAfterMs: true,
});
export const realtimeGatewayActivationErrorSchema = realtimeGatewayAdmissionSchema.extend({
  message: z.string().min(1).max(256),
});

const opaqueId = z
  .string()
  .min(16)
  .max(128)
  .refine((value) => {
    if (/^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(value)) {
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
    }
    return /^[A-Za-z0-9_-]+$/.test(value);
  });
export const realtimeHandshakeSchema = z.strictObject({
  contractVersion: z.literal(1),
  deviceId: opaqueId,
  clientInstanceId: opaqueId,
  platform: z.literal('web'),
  appVersion: printable(64),
  tabId: opaqueId.optional(),
  lastNotificationCursor: notificationCursorSchema.optional(),
  locale: z
    .string()
    .min(2)
    .max(35)
    .refine((value) => {
      try {
        return Intl.getCanonicalLocales(value)[0] === value;
      } catch {
        return false;
      }
    })
    .optional(),
  timezone: z
    .string()
    .min(1)
    .max(128)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    })
    .optional(),
});
export type RealtimeHandshake = z.infer<typeof realtimeHandshakeSchema>;

const route = printable(1_024).refine((value) => {
  const path = value.split(/[?#]/u, 1)[0] ?? '';
  return (
    value.startsWith('/') &&
    !value.startsWith('//') &&
    value.normalize('NFC') === value &&
    !value.includes('\\') &&
    !path.includes('//') &&
    !/%(?:00|2e|2f|5c)/iu.test(path) &&
    !path.split('/').some((part) => part === '.' || part === '..')
  );
});
const text = (points: number, bytes: number) =>
  z
    .string()
    .min(1)
    .refine(
      (value) =>
        Array.from(value).length <= points && new TextEncoder().encode(value).length <= bytes,
    );
const notificationCreated = z
  .strictObject({
    notificationId: uuid,
    recipientId: uuid,
    deliveryEventId: uuid7,
    cursor: notificationCursorSchema,
    type: safeType,
    title: text(180, 720),
    body: text(4_000, 16_384),
    priority: z.enum(['P0_CRITICAL', 'P1_HIGH', 'P2_NORMAL', 'P3_LOW']),
    entity: z.strictObject({ type: safeType, id: uuid }).nullable(),
    action: z.strictObject({ route }).nullable(),
    createdAt: date,
    expiresAt: date.nullable(),
    silent: z.boolean(),
    metadata: z
      .record(
        z.string().regex(/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/u),
        z.union([z.string().max(512), z.number().finite().safe(), z.boolean(), z.null()]),
      )
      .refine((value) => Object.keys(value).length <= 16),
  })
  .refine(
    (value) =>
      value.expiresAt === null || Date.parse(value.expiresAt) >= Date.parse(value.createdAt),
  );
const presence = {
  userId: uuid,
  connectivity: z.enum(['ONLINE', 'OFFLINE']),
  activity: z.enum(['ACTIVE', 'IDLE', 'AWAY']),
  availability: z.enum(['AVAILABLE', 'BUSY', 'DO_NOT_DISTURB', 'INVISIBLE']),
  availabilityUntil: date.nullable(),
  changedAt: date,
};

export const realtimeServerSchemas = {
  'session.ready.v1': presenceEvent(
    z.strictObject({
      recovered: z.boolean(),
      recoveryComplete: z.boolean(),
      capabilities: z.strictObject({
        crmLeads: z.strictObject({ receive: z.boolean() }),
        notifications: z.strictObject({ receive: z.boolean() }),
        presence: z.strictObject({
          publishSelf: z.boolean(),
          watchMode: z.enum(['NONE', 'SELF', 'SCOPED']),
        }),
      }),
      grantedCapabilities: z
        .array(z.enum(['CRM_LEADS', 'NOTIFICATIONS', 'PRESENCE_SELF', 'PRESENCE_WATCH']))
        .max(4)
        .refine((values) => new Set(values).size === values.length),
      notificationResyncRequired: z.boolean(),
      lastNotificationCursorAccepted: z.boolean(),
    }),
  ),
  'notification.created.v1': event(notificationCreated),
  'notification.updated.v1': event(
    z.strictObject({
      notificationId: uuid,
      recipientId: uuid,
      change: z.enum(['READ', 'ACKNOWLEDGED', 'DISMISSED']),
      state: z.strictObject({
        readAt: date.nullable(),
        acknowledgedAt: date.nullable(),
        dismissedAt: date.nullable(),
      }),
      changedAt: date,
      recipientStateVersion: integer,
    }),
  ),
  'notification.unread-count.changed.v1': event(
    z.strictObject({ unreadCount: integer, unreadRevision: integer, changedAt: date }),
  ),
  'crm.leads.changed.v1': event(
    z.strictObject({
      tenantId: uuid,
      branchId: uuid,
      leadId: uuid,
      revision: z
        .string()
        .max(19)
        .regex(/^[1-9][0-9]{0,18}(?![\s\S])/u)
        .refine((value) => value.length < 19 || value <= '9223372036854775807'),
      changeKind: z.enum(['CREATED', 'UPDATED', 'STAGE_CHANGED', 'CONVERTED', 'DELETED']),
    }),
  ),
  'crm.leads.scope-resync.v1': event(
    z.strictObject({ scope: z.literal('CRM_LEADS'), reason: z.literal('SCOPE_CHANGED') }),
  ),
  'presence.changed.v1': presenceEvent(z.strictObject(presence)),
  'presence.watch.snapshot.v1': z.strictObject({
    ...envelope,
    presenceGeneration: uuid,
    payload: z
      .strictObject({
        requestId: uuid7,
        items: z.array(z.strictObject({ ...presence, ...tuple })).max(250),
        chunkIndex: integer,
        chunkCount: z.number().int().min(1).max(250),
      })
      .refine((value) => value.chunkIndex < value.chunkCount),
  }),
  'realtime.sync.required.v1': event(
    z.strictObject({
      scope,
      reason: z.enum([
        'RECOVERY_INCOMPLETE',
        'PRESENCE_GENERATION_CHANGED',
        'PRESENCE_STATE_GAP',
        'NOTIFICATION_CURSOR_AMBIGUOUS',
        'NOTIFICATION_BULK_STATE_CHANGED',
        'ADAPTER_RECOVERY_UNAVAILABLE',
      ]),
      lastCommittedNotificationCursor: notificationCursorSchema.nullable(),
    }),
  ),
  'system.access-expiring.v1': event(z.strictObject({ expiresAt: date })),
  'system.access-revoked.v1': event(
    z.strictObject({
      reason: z.enum([
        'TOKEN_EXPIRED',
        'SESSION_INVALIDATED',
        'ACCESS_REVOKED',
        'USER_SUSPENDED',
        'USER_DELETED',
      ]),
    }),
  ),
  'system.tenant-unavailable.v1': event(
    z.strictObject({
      reason: z.enum([
        'TENANT_SUSPENDED',
        'TENANT_DELETED',
        'TENANT_MOVED',
        'TENANT_HOST_INVALIDATED',
      ]),
    }),
  ),
  'system.connection-replaced.v1': event(
    z.strictObject({ reason: z.literal('CLIENT_INSTANCE_REPLACED') }),
  ),
  'system.server-draining.v1': event(
    z.strictObject({ retryAfterMs: z.number().int().min(0).max(60_000) }),
  ),
  // The current gateway's activation catch also embeds its strict admission error
  // projection here (gateway.ts:217-227). Handle that real shape without retrying
  // a terminal admission failure as an unstructured transport error.
  'realtime.error.v1': event(
    z.union([realtimeProtocolErrorSchema, realtimeGatewayActivationErrorSchema]),
  ),
} as const;
export type RealtimeEventName = keyof typeof realtimeServerSchemas;
export type RealtimeEventData<N extends RealtimeEventName> = z.infer<
  (typeof realtimeServerSchemas)[N]
>;
export type RealtimeEvent = {
  [N in RealtimeEventName]: { name: N; event: RealtimeEventData<N> };
}[RealtimeEventName];

const eventBytes: Record<RealtimeEventName, number> = {
  'session.ready.v1': 4_096,
  'notification.created.v1': 16_384,
  'notification.updated.v1': 8_192,
  'notification.unread-count.changed.v1': 2_048,
  'crm.leads.changed.v1': 1_024,
  'crm.leads.scope-resync.v1': 1_024,
  'presence.changed.v1': 8_192,
  'presence.watch.snapshot.v1': 32_768,
  'realtime.sync.required.v1': 2_048,
  'system.access-expiring.v1': 1_024,
  'system.access-revoked.v1': 2_048,
  'system.tenant-unavailable.v1': 2_048,
  'system.connection-replaced.v1': 1_024,
  'system.server-draining.v1': 2_048,
  'realtime.error.v1': 4_096,
};

export function parseRealtimeEvent<N extends RealtimeEventName>(
  name: N,
  input: unknown,
): RealtimeEventData<N> {
  assertRealtimeBounds(input, eventBytes[name]);
  return realtimeServerSchemas[name].parse(input) as RealtimeEventData<N>;
}

const commandEnvelope = {
  contractVersion: z.literal(1),
  requestId: uuid7,
  clientSentAt: date.optional(),
};
export const realtimeCommandSchemas = {
  'notification.received.v1': z.strictObject({
    ...commandEnvelope,
    payload: z.strictObject({
      notificationId: uuid,
      recipientId: uuid,
      deliveryEventId: uuid7,
      cursor: notificationCursorSchema,
    }),
  }),
  'realtime.sync.request.v1': z.strictObject({
    ...commandEnvelope,
    payload: z.strictObject({
      scope,
      lastNotificationCursor: notificationCursorSchema.nullable().optional(),
    }),
  }),
} as const;
export type RealtimeCommandName = keyof typeof realtimeCommandSchemas;
export type RealtimeCommand<N extends RealtimeCommandName> = z.infer<
  (typeof realtimeCommandSchemas)[N]
>;
const ackBase = { contractVersion: z.literal(1), requestId: uuid7, serverTime: date };
const ackData = {
  'notification.received.v1': z.strictObject({ accepted: z.literal(true) }),
  'realtime.sync.request.v1': z.strictObject({
    snapshotScheduled: z.boolean(),
    restResyncRequired: z.boolean(),
  }),
};
export function parseRealtimeAck(name: RealtimeCommandName, input: unknown) {
  assertRealtimeBounds(input, 8_192);
  return z
    .discriminatedUnion('ok', [
      z.strictObject({ ...ackBase, ok: z.literal(true), data: ackData[name] }),
      z.strictObject({ ...ackBase, ok: z.literal(false), error: realtimeProtocolErrorSchema }),
    ])
    .parse(input);
}
export type RealtimeAcknowledgementData = Extract<
  ReturnType<typeof parseRealtimeAck>,
  { ok: true }
>['data'];

/** Reject cyclic/deep/oversize data before schema traversal, including cross-tab input. */
export function assertRealtimeBounds(input: unknown, maxBytes: number): void {
  let nodes = 0;
  const visited = new WeakSet<object>();
  const visit = (value: unknown, depth: number): void => {
    if (++nodes > 4_096) throw new Error('Realtime payload bounds');
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))
    )
      return;
    if (typeof value === 'object' && value !== null) {
      if (
        depth >= 8 ||
        visited.has(value) ||
        Object.getOwnPropertySymbols(value).length > 0 ||
        (!Array.isArray(value) &&
          Object.getPrototypeOf(value) !== Object.prototype &&
          Object.getPrototypeOf(value) !== null)
      ) {
        throw new Error('Realtime payload bounds');
      }
      visited.add(value);
      for (const child of Object.values(value)) visit(child, depth + 1);
    } else throw new Error('Realtime payload bounds');
  };
  visit(input, 0);
  const json = JSON.stringify(input);
  if (json === undefined || new TextEncoder().encode(json).length > maxBytes)
    throw new Error('Realtime payload bounds');
}

/** Adapter contract for the exact socket.io-client dependency installed by the integration owner. */
export interface RealtimeSocket {
  on(name: string, listener: (value: unknown) => void): void;
  off(name: string, listener: (value: unknown) => void): void;
  emit(name: string, payload: unknown, acknowledge: (value: unknown) => void): void;
  connect(): void;
  disconnect(): void;
}
export interface RealtimeSocketOptions {
  path: '/realtime/socket.io';
  autoConnect: false;
  reconnection: false;
  forceNew: true;
  withCredentials: true;
  auth: RealtimeHandshake;
  timeout: number;
}
export type RealtimeSocketFactory = (options: RealtimeSocketOptions) => RealtimeSocket;
export const REALTIME_SOCKET_FACTORY = new InjectionToken<RealtimeSocketFactory | null>(
  'REALTIME_SOCKET_FACTORY',
  {
    providedIn: 'root',
    factory: () => null,
  },
);
export const REALTIME_CLIENT_OPTIONS = new InjectionToken<{ appVersion: string }>(
  'REALTIME_CLIENT_OPTIONS',
  {
    providedIn: 'root',
    factory: () => ({ appVersion: '0.0.0' }),
  },
);

export interface RealtimeFailure {
  code: string;
  status: number;
  retryable: boolean;
  retryAfterMs: number | null;
  correlationId: string | null;
}
export interface RealtimeConnectionState {
  status: 'idle' | 'connecting' | 'connected' | 'stale' | 'failed' | 'unavailable';
  stale: boolean;
  failure: RealtimeFailure | null;
  at: number;
}
export interface RealtimeRecovery {
  id: string;
  scope: RealtimeScope;
  reason: string;
  at: number;
}
export interface RealtimeScoped<T> {
  userId: string;
  value: T;
}
