import { describe, expect, it } from 'vitest';
import {
  assertRealtimeBounds,
  parseRealtimeAck,
  parseRealtimeEvent,
  realtimeHandshakeSchema,
} from './realtime-client.model';

const id = '019aabbc-0000-7000-8000-000000000001';
const at = '2026-11-23T12:00:00.000Z';
const envelope = <T>(payload: T) => ({
  contractVersion: 1,
  eventId: id,
  correlationId: id,
  occurredAt: at,
  payload,
});

describe('RT10 contract boundaries', () => {
  it('rejects credentials, unknown metadata and invalid IDs in the public cookie-only handshake', () => {
    const input = {
      contractVersion: 1,
      deviceId: id,
      clientInstanceId: id,
      platform: 'web',
      appVersion: '0.0.0',
    };
    expect(realtimeHandshakeSchema.parse(input)).toEqual(input);
    for (const patch of [
      { token: 'secret' },
      { accessToken: 'secret' },
      { platform: 'ios' },
      { deviceId: 'short' },
      { clientInstanceId: id.toUpperCase() },
      { lastNotificationCursor: '' },
      { locale: 'EN-us' },
      { timezone: 'not-a-time-zone' },
    ]) {
      expect(realtimeHandshakeSchema.safeParse({ ...input, ...patch }).success).toBe(false);
    }
  });

  it('preserves bigint CRM revisions without converting to a number', () => {
    const input = envelope({
      tenantId: id,
      branchId: id,
      leadId: id,
      revision: '9223372036854775807',
      changeKind: 'UPDATED',
    });
    expect(parseRealtimeEvent('crm.leads.changed.v1', input).payload.revision).toBe(
      '9223372036854775807',
    );
    for (const revision of ['9223372036854775808', '0', '01', '1\n', 1]) {
      expect(() =>
        parseRealtimeEvent('crm.leads.changed.v1', {
          ...input,
          payload: { ...input.payload, revision },
        }),
      ).toThrow();
    }
  });

  it('rejects extra fields, unsafe counts and unknown contract versions', () => {
    const input = envelope({ unreadCount: 2, unreadRevision: 3, changedAt: at });
    expect(
      parseRealtimeEvent('notification.unread-count.changed.v1', input).payload.unreadRevision,
    ).toBe(3);
    for (const value of [
      { ...input, secret: 'extra' },
      { ...input, contractVersion: 2 },
      { ...input, payload: { ...input.payload, unreadCount: -1 } },
      { ...input, payload: { ...input.payload, unreadRevision: Number.MAX_SAFE_INTEGER + 1 } },
    ])
      expect(() => parseRealtimeEvent('notification.unread-count.changed.v1', value)).toThrow();
  });

  it('strictly validates successful and failed acknowledgement envelopes', () => {
    const base = { contractVersion: 1, requestId: id, serverTime: at };
    expect(
      parseRealtimeAck('notification.received.v1', { ...base, ok: true, data: { accepted: true } })
        .ok,
    ).toBe(true);
    expect(() =>
      parseRealtimeAck('notification.received.v1', {
        ...base,
        ok: true,
        data: { accepted: false },
      }),
    ).toThrow();
    expect(
      parseRealtimeAck('realtime.sync.request.v1', {
        ...base,
        ok: false,
        error: {
          code: 'REALTIME.RECOVERY.RESYNC_REQUIRED',
          message: 'Resync',
          retryable: false,
          retryAfterMs: null,
        },
      }).ok,
    ).toBe(false);
    expect(() =>
      parseRealtimeAck('notification.received.v1', {
        ...base,
        requestId: '01234567-0123-4123-8123-012345678901',
        ok: true,
        data: { accepted: true },
      }),
    ).toThrow();
  });

  it('rejects non-JSON, cyclic, deep and oversized payloads before schema traversal', () => {
    const cycle: Record<string, unknown> = {};
    cycle['self'] = cycle;
    for (const value of [
      cycle,
      undefined,
      () => undefined,
      { value: Infinity },
      new Date(),
      { a: { b: { c: { d: { e: { f: { g: { h: {} } } } } } } } },
    ]) {
      expect(() => assertRealtimeBounds(value, 1_024)).toThrow();
    }
    expect(() => assertRealtimeBounds('x'.repeat(1_024), 1_024)).toThrow();
    expect(() => assertRealtimeBounds({ text: 'محتوى' }, 1_024)).not.toThrow();
  });
});
