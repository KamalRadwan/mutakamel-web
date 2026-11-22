import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import {
  createIceServer,
  createPhoneServer,
  deleteIceServer,
  deletePhoneServer,
  getPhoneConfig,
  getPhoneSeats,
  listPhoneServers,
  reorderPhoneServers,
  updateIceServer,
  updatePhoneServer,
} from './phone-servers.api';
import { resetPhoneServersFake, setFakeWebPhoneFailNext, setFakeWebPhoneModuleState } from './phone-servers.fake';
import { PHONE_SERVER_LIMIT } from './phone-servers.model';

/*
 * phone-servers.api.ts over phone-servers.fake.ts. The webphone routes return bare bodies (no
 * Core { data, meta } envelope): the server list is a plain array ordered by priority, single
 * records are bare. Writes go through the gateway idempotency (GW.IDEM.MISSING / MISMATCH).
 */

async function settle<T>(promise: Promise<T>): Promise<T> {
  const guarded = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.runAllTimersAsync();
  const result = await guarded;
  if (!result.ok) throw result.error;
  return result.value;
}

async function errorOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await settle(promise);
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected an ApiError');
}

const NEW_SERVER = { name: 'Giza', sipDomain: 'giza.example.com', websocketUrl: 'wss://giza.example.com/ws', enabled: true };

describe('phone servers api (fake)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetPhoneServersFake();
  });
  afterEach(() => vi.useRealTimers());

  describe('reads', () => {
    it('lists servers as a bare array ordered by priority, hiding ICE credentials', async () => {
      const servers = await settle(listPhoneServers());
      expect(Array.isArray(servers)).toBe(true);
      expect(servers.map((server) => server.id)).toEqual(['srv-cairo-1', 'srv-cairo-2', 'srv-alex-3']);
      const turn = servers[0].iceServers[1];
      expect(Object.keys(turn).sort()).toEqual(['credentialConfigured', 'enabled', 'id', 'kind', 'urls', 'username']);
      expect(turn.credentialConfigured).toBe(true);
    });

    it('returns the config and seats as bare records', async () => {
      expect(await settle(getPhoneConfig())).toEqual({ enabled: true });
      expect(await settle(getPhoneSeats())).toEqual({ allowed: 10, occupied: 7, available: 3, overAllowance: false });
    });

    it('answers the module state codes', async () => {
      setFakeWebPhoneModuleState('NOT_PURCHASED');
      const notPurchased = await errorOf(listPhoneServers());
      expect([notPurchased.status, notPurchased.code]).toEqual([403, 'WEBPHONE_MODULE_NOT_PURCHASED']);

      setFakeWebPhoneModuleState('PROVISIONING_PENDING');
      const pending = await errorOf(getPhoneConfig());
      expect([pending.status, pending.code]).toEqual([409, 'WEBPHONE_PROVISIONING_PENDING']);

      setFakeWebPhoneModuleState('INACTIVE');
      await expect(settle(listPhoneServers())).resolves.toHaveLength(3);
      const inactive = await errorOf(createPhoneServer(NEW_SERVER, newIdempotencyKey()));
      expect([inactive.status, inactive.code]).toEqual([403, 'WEBPHONE_MODULE_INACTIVE']);
    });

    it('fails the next call once with 500 INTERNAL_ERROR', async () => {
      setFakeWebPhoneFailNext(true);
      const error = await errorOf(getPhoneSeats());
      expect([error.status, error.code]).toEqual([500, 'INTERNAL_ERROR']);
      await expect(settle(getPhoneSeats())).resolves.toBeTruthy();
    });
  });

  describe('servers', () => {
    it('creates a server at the end with defaults', async () => {
      const created = await settle(createPhoneServer(NEW_SERVER, newIdempotencyKey()));
      expect(created).toMatchObject({ name: 'Giza', priority: 4, registerExpires: 600, iceTransportPolicy: 'all', iceServers: [] });
      expect((await settle(listPhoneServers())).at(-1)!.id).toBe(created.id);
    });

    it('replays a key, answers GW.IDEM.MISMATCH for another body and GW.IDEM.MISSING without a key', async () => {
      const key = newIdempotencyKey();
      const first = await settle(createPhoneServer(NEW_SERVER, key));
      expect(await settle(createPhoneServer(NEW_SERVER, key))).toEqual(first);
      expect(await settle(listPhoneServers())).toHaveLength(4);

      const mismatch = await errorOf(createPhoneServer({ ...NEW_SERVER, name: 'Other' }, key));
      expect([mismatch.status, mismatch.code]).toEqual([409, 'GW.IDEM.MISMATCH']);
      const missing = await errorOf(createPhoneServer(NEW_SERVER, ' '));
      expect([missing.status, missing.code]).toEqual([400, 'GW.IDEM.MISSING']);
    });

    it('answers 400 CORE_VALIDATION_FAILED with details keyed by field (string arrays)', async () => {
      const error = await errorOf(createPhoneServer({ ...NEW_SERVER, websocketUrl: 'http://x' }, newIdempotencyKey()));
      expect([error.status, error.code]).toEqual([400, 'CORE_VALIDATION_FAILED']);
      expect(error.details).toEqual({ websocketUrl: ['websocketUrl is not valid'] });

      const expires = await errorOf(updatePhoneServer('srv-cairo-1', { registerExpires: 10 }, newIdempotencyKey()));
      expect(Object.keys(expires.details ?? {})).toEqual(['registerExpires']);
    });

    it('answers 409 WEBPHONE_SERVER_LIMIT_REACHED at the limit (WebphoneExceptionFilter: ConflictException)', async () => {
      for (let index = 3; index < PHONE_SERVER_LIMIT; index++) {
        await settle(createPhoneServer({ ...NEW_SERVER, name: `S${index}` }, newIdempotencyKey()));
      }
      const error = await errorOf(createPhoneServer({ ...NEW_SERVER, name: 'One too many' }, newIdempotencyKey()));
      expect([error.status, error.code]).toEqual([409, 'WEBPHONE_SERVER_LIMIT_REACHED']);
    });

    // AGENTS.md Phase 3: fake error details hold string arrays only (the backend's shared filter drops
    // other values). WEBPHONE_SERVER_LIMIT_REACHED sends { limit: 10 } as a number.
    it('WEBPHONE_SERVER_LIMIT_REACHED details are string arrays only (the fake sends none)', async () => {
      for (let index = 3; index < PHONE_SERVER_LIMIT; index++) {
        await settle(createPhoneServer({ ...NEW_SERVER, name: `S${index}` }, newIdempotencyKey()));
      }
      const error = await errorOf(createPhoneServer({ ...NEW_SERVER, name: 'One too many' }, newIdempotencyKey()));
      for (const value of Object.values(error.details ?? {})) {
        expect(Array.isArray(value) && value.every((item) => typeof item === 'string')).toBe(true);
      }
    });

    it('updates a server and normalises optional strings', async () => {
      const updated = await settle(updatePhoneServer('srv-cairo-1', { name: ' Cairo main ', realm: '  ', defaultCallerId: '+201000' }, newIdempotencyKey()));
      expect(updated).toMatchObject({ name: 'Cairo main', realm: null, defaultCallerId: '+201000' });
    });

    it('answers 422 WEBPHONE_RELAY_WITHOUT_TURN and 404 WEBPHONE_SERVER_NOT_FOUND', async () => {
      const relay = await errorOf(updatePhoneServer('srv-alex-3', { iceTransportPolicy: 'relay' }, newIdempotencyKey()));
      expect([relay.status, relay.code]).toEqual([422, 'WEBPHONE_RELAY_WITHOUT_TURN']);
      const missing = await errorOf(updatePhoneServer('nope', { name: 'X' }, newIdempotencyKey()));
      expect([missing.status, missing.code]).toEqual([404, 'WEBPHONE_SERVER_NOT_FOUND']);
    });

    it('reorders servers and renumbers priorities', async () => {
      const servers = await settle(reorderPhoneServers(['srv-alex-3', 'srv-cairo-1', 'srv-cairo-2'], newIdempotencyKey()));
      expect(servers.map((server) => [server.id, server.priority])).toEqual([
        ['srv-alex-3', 1],
        ['srv-cairo-1', 2],
        ['srv-cairo-2', 3],
      ]);
      const invalid = await errorOf(reorderPhoneServers(['srv-alex-3', 'srv-alex-3', 'srv-cairo-1'], newIdempotencyKey()));
      expect([invalid.status, invalid.code]).toEqual([422, 'WEBPHONE_SERVER_ORDER_INVALID']);
    });

    it('deletes a server and closes the priority gap', async () => {
      await expect(settle(deletePhoneServer('srv-cairo-1', newIdempotencyKey()))).resolves.toBeUndefined();
      const servers = await settle(listPhoneServers());
      expect(servers.map((server) => [server.id, server.priority])).toEqual([
        ['srv-cairo-2', 1],
        ['srv-alex-3', 2],
      ]);
      const missing = await errorOf(deletePhoneServer('srv-cairo-1', newIdempotencyKey()));
      expect(missing.code).toBe('WEBPHONE_SERVER_NOT_FOUND');
    });

    it('reports the module disabled when no server is enabled', async () => {
      await settle(updatePhoneServer('srv-cairo-1', { enabled: false }, newIdempotencyKey()));
      await settle(updatePhoneServer('srv-cairo-2', { enabled: false }, newIdempotencyKey()));
      expect(await settle(getPhoneConfig())).toEqual({ enabled: false });
    });
  });

  describe('ICE servers', () => {
    it('creates a TURN entry with credentials and reports only credentialConfigured', async () => {
      const entry = await settle(
        createIceServer('srv-alex-3', { kind: 'TURN', urls: [' turn:t.example.com:3478 ', ''], username: 'u', credential: 'secret' }, newIdempotencyKey()),
      );
      expect(entry).toMatchObject({ kind: 'TURN', urls: ['turn:t.example.com:3478'], username: 'u', credentialConfigured: true, enabled: true });
      expect(entry).not.toHaveProperty('credential');
      expect(entry).not.toHaveProperty('hasCredential');
    });

    it('answers 400 CORE_VALIDATION_FAILED keyed by urls, credential or username', async () => {
      const urls = await errorOf(createIceServer('srv-alex-3', { kind: 'STUN', urls: ['http://x'] }, newIdempotencyKey()));
      expect([urls.status, urls.code]).toEqual([400, 'CORE_VALIDATION_FAILED']);
      expect(urls.details).toEqual({ urls: ['urls is not valid'] });
      const credential = await errorOf(createIceServer('srv-alex-3', { kind: 'TURN', urls: ['turn:x'], username: 'u' }, newIdempotencyKey()));
      expect(credential.details).toEqual({ credential: ['credential is not valid'] });
      const stun = await errorOf(createIceServer('srv-alex-3', { kind: 'STUN', urls: ['stun:x'], username: 'u' }, newIdempotencyKey()));
      expect(stun.details).toEqual({ username: ['username is not valid'] });
    });

    it('updates an entry, clearing the credential with null', async () => {
      const updated = await settle(updateIceServer('srv-cairo-1', 'ice-cairo-1-turn', { username: null, credential: null }, newIdempotencyKey()));
      expect(updated).toMatchObject({ username: null, credentialConfigured: false });
    });

    it('protects the only TURN entry of a relay server', async () => {
      const disable = await errorOf(updateIceServer('srv-cairo-2', 'ice-cairo-2-turn', { enabled: false }, newIdempotencyKey()));
      expect([disable.status, disable.code]).toEqual([422, 'WEBPHONE_RELAY_WITHOUT_TURN']);
      const remove = await errorOf(deleteIceServer('srv-cairo-2', 'ice-cairo-2-turn', newIdempotencyKey()));
      expect(remove.code).toBe('WEBPHONE_RELAY_WITHOUT_TURN');
    });

    it('deletes an entry and answers WEBPHONE_ICE_SERVER_NOT_FOUND after', async () => {
      await expect(settle(deleteIceServer('srv-cairo-1', 'ice-cairo-1-stun', newIdempotencyKey()))).resolves.toBeUndefined();
      const missing = await errorOf(updateIceServer('srv-cairo-1', 'ice-cairo-1-stun', { enabled: false }, newIdempotencyKey()));
      expect([missing.status, missing.code]).toEqual([404, 'WEBPHONE_ICE_SERVER_NOT_FOUND']);
    });
  });
});
