import { ApiError } from '../../../../core/api/api-errors';
import { fakeDelay, fakeId } from '../../../../core/fake/fake-utils';
import { CORE_VALIDATION_FAILED, coreValidationDetails } from '../core-response.model';
import {
  CALLER_ID_PATTERN,
  CreateIceEntryBody,
  CreatePhoneServerBody,
  ICE_URL_PATTERN,
  IceEntry,
  IceKind,
  IceTransportPolicy,
  MAX_RETRIES_MAX,
  MAX_RETRIES_MIN,
  PHONE_SERVER_LIMIT,
  PHONE_SERVER_NAME_MAX,
  PhoneConfig,
  PhoneSeats,
  PhoneServer,
  REGISTER_EXPIRES_DEFAULT,
  REGISTER_EXPIRES_MAX,
  REGISTER_EXPIRES_MIN,
  SIP_DOMAIN_PATTERN,
  SIP_URI_PATTERN,
  TIMEOUT_SECONDS_MAX,
  TIMEOUT_SECONDS_MIN,
  UpdateIceEntryPatch,
  UpdatePhoneServerPatch,
  WEBSOCKET_URL_PATTERN,
  hasEnabledTurn,
} from './phone-servers.model';

export type FakeWebPhoneModuleState = 'ACTIVE' | 'NOT_PURCHASED' | 'PROVISIONING_PENDING' | 'INACTIVE';

export let FAKE_WEBPHONE_MODULE_STATE: FakeWebPhoneModuleState = 'ACTIVE';
export let FAKE_WEBPHONE_FAIL_NEXT = false;

export function setFakeWebPhoneModuleState(state: FakeWebPhoneModuleState): void {
  FAKE_WEBPHONE_MODULE_STATE = state;
}

export function setFakeWebPhoneFailNext(fail: boolean): void {
  FAKE_WEBPHONE_FAIL_NEXT = fail;
}

interface StoredIceEntry extends IceEntry {
  hasCredential: boolean;
}

interface StoredPhoneServer extends Omit<PhoneServer, 'iceServers'> {
  iceServers: StoredIceEntry[];
}

interface IdempotencyEntry {
  op: string;
  fingerprint: string;
  result: unknown;
}

interface PhoneServersStore {
  servers: StoredPhoneServer[];
  seats: PhoneSeats;
  idempotency: Map<string, IdempotencyEntry>;
}

function createSeedStore(): PhoneServersStore {
  return {
    servers: [
      {
        id: 'srv-cairo-1',
        name: 'Cairo primary',
        priority: 1,
        enabled: true,
        sipDomain: 'pbx.example.com',
        websocketUrl: 'wss://pbx1.example.com:8089/ws',
        realm: 'pbx.example.com',
        outboundProxy: null,
        fromDomain: 'pbx.example.com',
        registrarServer: 'sip:pbx1.example.com',
        contactUri: null,
        registerExpires: 600,
        defaultCallerId: '+20225550100',
        iceTransportPolicy: 'all',
        iceEnabled: true,
        traceSip: false,
        sessionTimers: true,
        allowInvalidTlsCertificate: false,
        defaultTimeoutSeconds: 10,
        defaultMaxRetries: 2,
        iceServers: [
          {
            id: 'ice-cairo-1-stun',
            kind: 'STUN',
            urls: ['stun:stun.example.com:3478'],
            username: null,
            credentialConfigured: false,
            hasCredential: false,
            enabled: true,
          },
          {
            id: 'ice-cairo-1-turn',
            kind: 'TURN',
            urls: ['turns:turn1.example.com:5349?transport=tcp'],
            username: 'turn-cairo',
            credentialConfigured: true,
            hasCredential: true,
            enabled: true,
          },
        ],
      },
      {
        id: 'srv-cairo-2',
        name: 'Cairo backup',
        priority: 2,
        enabled: true,
        sipDomain: 'pbx.example.com',
        websocketUrl: 'wss://pbx2.example.com:8089/ws',
        realm: 'pbx.example.com',
        outboundProxy: null,
        fromDomain: null,
        registrarServer: null,
        contactUri: null,
        registerExpires: 600,
        defaultCallerId: null,
        iceTransportPolicy: 'relay',
        iceEnabled: true,
        traceSip: false,
        sessionTimers: true,
        allowInvalidTlsCertificate: false,
        defaultTimeoutSeconds: null,
        defaultMaxRetries: null,
        iceServers: [
          {
            id: 'ice-cairo-2-turn',
            kind: 'TURN',
            urls: ['turns:turn2.example.com:5349?transport=tcp'],
            username: 'turn-backup',
            credentialConfigured: true,
            hasCredential: true,
            enabled: true,
          },
        ],
      },
      {
        id: 'srv-alex-3',
        name: 'Alexandria test',
        priority: 3,
        enabled: false,
        sipDomain: 'lab.pbx.example.com',
        websocketUrl: 'wss://pbx3.example.invalid/ws',
        realm: null,
        outboundProxy: null,
        fromDomain: null,
        registrarServer: null,
        contactUri: null,
        registerExpires: 300,
        defaultCallerId: null,
        iceTransportPolicy: 'all',
        iceEnabled: false,
        traceSip: true,
        sessionTimers: false,
        allowInvalidTlsCertificate: false,
        defaultTimeoutSeconds: null,
        defaultMaxRetries: null,
        iceServers: [],
      },
    ],
    seats: {
      allowed: 10,
      occupied: 7,
      available: 3,
      overAllowance: false,
    },
    idempotency: new Map<string, IdempotencyEntry>(),
  };
}

let store: PhoneServersStore = createSeedStore();

export function resetPhoneServersFake(): void {
  store = createSeedStore();
  FAKE_WEBPHONE_MODULE_STATE = 'ACTIVE';
  FAKE_WEBPHONE_FAIL_NEXT = false;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function toIceView(entry: StoredIceEntry): IceEntry {
  return {
    id: entry.id,
    kind: entry.kind,
    urls: [...entry.urls],
    username: entry.username,
    credentialConfigured: entry.hasCredential,
    enabled: entry.enabled,
  };
}

function toServerView(server: StoredPhoneServer): PhoneServer {
  return {
    ...server,
    iceServers: server.iceServers.map(toIceView),
  };
}

async function enterCall(isWrite: boolean): Promise<void> {
  await fakeDelay();
  if (FAKE_WEBPHONE_FAIL_NEXT) {
    FAKE_WEBPHONE_FAIL_NEXT = false;
    throw new ApiError(500, 'INTERNAL_ERROR');
  }
  if (FAKE_WEBPHONE_MODULE_STATE === 'NOT_PURCHASED') {
    throw new ApiError(403, 'WEBPHONE_MODULE_NOT_PURCHASED');
  }
  if (FAKE_WEBPHONE_MODULE_STATE === 'PROVISIONING_PENDING') {
    throw new ApiError(409, 'WEBPHONE_PROVISIONING_PENDING');
  }
  if (isWrite && FAKE_WEBPHONE_MODULE_STATE === 'INACTIVE') {
    throw new ApiError(403, 'WEBPHONE_MODULE_INACTIVE');
  }
}

function runIdempotent<T>(op: string, key: string, payload: unknown, run: () => T): T {
  const trimmedKey = key.trim();
  if (!trimmedKey) {
    throw new ApiError(400, 'GW.IDEM.MISSING');
  }
  const fingerprint = JSON.stringify(payload) ?? '';
  const cacheKey = `${op}:${trimmedKey}`;
  const existing = store.idempotency.get(cacheKey);
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      throw new ApiError(409, 'GW.IDEM.MISMATCH');
    }
    return clone(existing.result as T);
  }
  const result = run();
  store.idempotency.set(cacheKey, { op, fingerprint, result: clone(result) });
  return clone(result);
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Core's global ValidationPipe answers a bad DTO with 400 CORE_VALIDATION_FAILED, details keyed by
 * field path (string arrays). The webphone filter only catches WebphoneDomainError, not DTO errors.
 */
function invalidField(field: string): ApiError {
  return new ApiError(400, CORE_VALIDATION_FAILED, coreValidationDetails({ [field]: 'invalid' }));
}

function validateServerFields(fields: {
  name?: string;
  sipDomain?: string;
  websocketUrl?: string;
  registrarServer?: string | null;
  outboundProxy?: string | null;
  contactUri?: string | null;
  defaultCallerId?: string | null;
  registerExpires?: number;
  defaultTimeoutSeconds?: number | null;
  defaultMaxRetries?: number | null;
  iceTransportPolicy?: IceTransportPolicy;
}): void {
  if (fields.name !== undefined) {
    const name = fields.name.trim();
    if (!name || name.length > PHONE_SERVER_NAME_MAX) {
      throw invalidField('name');
    }
  }
  if (fields.sipDomain !== undefined) {
    const domain = fields.sipDomain.trim();
    if (!domain || !SIP_DOMAIN_PATTERN.test(domain)) {
      throw invalidField('sipDomain');
    }
  }
  if (fields.websocketUrl !== undefined) {
    const url = fields.websocketUrl.trim();
    if (!url || !WEBSOCKET_URL_PATTERN.test(url)) {
      throw invalidField('websocketUrl');
    }
  }
  if (fields.registrarServer !== undefined && fields.registrarServer !== null) {
    const uri = fields.registrarServer.trim();
    if (uri && !SIP_URI_PATTERN.test(uri)) {
      throw invalidField('registrarServer');
    }
  }
  if (fields.outboundProxy !== undefined && fields.outboundProxy !== null) {
    const uri = fields.outboundProxy.trim();
    if (uri && !SIP_URI_PATTERN.test(uri)) {
      throw invalidField('outboundProxy');
    }
  }
  if (fields.contactUri !== undefined && fields.contactUri !== null) {
    const uri = fields.contactUri.trim();
    if (uri && /\s/.test(uri)) {
      throw invalidField('contactUri');
    }
  }
  if (fields.defaultCallerId !== undefined && fields.defaultCallerId !== null) {
    const callerId = fields.defaultCallerId.trim();
    if (callerId && !CALLER_ID_PATTERN.test(callerId)) {
      throw invalidField('defaultCallerId');
    }
  }
  if (fields.registerExpires !== undefined) {
    if (
      !Number.isInteger(fields.registerExpires) ||
      fields.registerExpires < REGISTER_EXPIRES_MIN ||
      fields.registerExpires > REGISTER_EXPIRES_MAX
    ) {
      throw invalidField('registerExpires');
    }
  }
  if (fields.defaultTimeoutSeconds !== undefined && fields.defaultTimeoutSeconds !== null) {
    if (
      !Number.isInteger(fields.defaultTimeoutSeconds) ||
      fields.defaultTimeoutSeconds < TIMEOUT_SECONDS_MIN ||
      fields.defaultTimeoutSeconds > TIMEOUT_SECONDS_MAX
    ) {
      throw invalidField('defaultTimeoutSeconds');
    }
  }
  if (fields.defaultMaxRetries !== undefined && fields.defaultMaxRetries !== null) {
    if (
      !Number.isInteger(fields.defaultMaxRetries) ||
      fields.defaultMaxRetries < MAX_RETRIES_MIN ||
      fields.defaultMaxRetries > MAX_RETRIES_MAX
    ) {
      throw invalidField('defaultMaxRetries');
    }
  }
  if (fields.iceTransportPolicy !== undefined) {
    if (fields.iceTransportPolicy !== 'all' && fields.iceTransportPolicy !== 'relay') {
      throw invalidField('iceTransportPolicy');
    }
  }
}

function validateAndNormalizeIceUrls(urls: readonly string[]): string[] {
  const normalized = urls.map((url) => url.trim()).filter(Boolean);
  if (normalized.length === 0 || normalized.some((url) => !ICE_URL_PATTERN.test(url))) {
    throw invalidField('urls');
  }
  return normalized;
}

function validateIceCredentials(
  kind: IceKind,
  username: string | null,
  hasCredential: boolean,
  explicitCredentialSupplied: boolean,
): void {
  if (kind === 'STUN') {
    if (username !== null || explicitCredentialSupplied || hasCredential) {
      throw invalidField(username !== null ? 'username' : 'credential');
    }
    return;
  }
  const hasUsername = username !== null && username.length > 0;
  if (hasUsername !== hasCredential) {
    throw invalidField(hasUsername ? 'credential' : 'username');
  }
}

function assertRelayConstraint(server: {
  iceTransportPolicy: IceTransportPolicy;
  iceEnabled: boolean;
  iceServers: readonly { kind: IceKind; enabled: boolean }[];
}): void {
  if (server.iceTransportPolicy === 'relay' && (!server.iceEnabled || !hasEnabledTurn(server.iceServers))) {
    throw new ApiError(422, 'WEBPHONE_RELAY_WITHOUT_TURN');
  }
}

function renumberPriorities(): void {
  store.servers.forEach((server, index) => {
    server.priority = index + 1;
  });
}

export async function fakeGetPhoneConfig(): Promise<PhoneConfig> {
  await enterCall(false);
  const enabled = store.servers.some(
    (s) => s.enabled && s.sipDomain.trim().length > 0 && s.websocketUrl.trim().length > 0,
  );
  return { enabled };
}

export async function fakeGetPhoneSeats(): Promise<PhoneSeats> {
  await enterCall(false);
  return clone(store.seats);
}

export async function fakeListPhoneServers(): Promise<PhoneServer[]> {
  await enterCall(false);
  return [...store.servers]
    .sort((a, b) => a.priority - b.priority)
    .map(toServerView);
}

export async function fakeCreatePhoneServer(
  body: CreatePhoneServerBody,
  key: string,
): Promise<PhoneServer> {
  await enterCall(true);
  const payload = {
    name: body.name.trim(),
    sipDomain: body.sipDomain.trim(),
    websocketUrl: body.websocketUrl.trim(),
    enabled: Boolean(body.enabled),
  };

  return runIdempotent('createPhoneServer', key, payload, () => {
    if (store.servers.length >= PHONE_SERVER_LIMIT) {
      // Core: webphoneErrors.serverLimitReached -> WebphoneExceptionFilter answers 409 (ConflictException).
      // Its { limit: 10 } is a number, which the shared contract does not carry: the fake sends no details.
      throw new ApiError(409, 'WEBPHONE_SERVER_LIMIT_REACHED');
    }
    validateServerFields({
      name: payload.name,
      sipDomain: payload.sipDomain,
      websocketUrl: payload.websocketUrl,
    });

    const created: StoredPhoneServer = {
      id: `srv-${fakeId().slice(0, 8)}`,
      name: payload.name,
      priority: store.servers.length + 1,
      enabled: payload.enabled,
      sipDomain: payload.sipDomain,
      websocketUrl: payload.websocketUrl,
      realm: null,
      outboundProxy: null,
      fromDomain: null,
      registrarServer: null,
      contactUri: null,
      registerExpires: REGISTER_EXPIRES_DEFAULT,
      defaultCallerId: null,
      iceTransportPolicy: 'all',
      iceEnabled: false,
      traceSip: false,
      sessionTimers: true,
      allowInvalidTlsCertificate: false,
      defaultTimeoutSeconds: null,
      defaultMaxRetries: null,
      iceServers: [],
    };
    store.servers.push(created);
    renumberPriorities();
    return toServerView(created);
  });
}

export async function fakeUpdatePhoneServer(
  id: string,
  patch: UpdatePhoneServerPatch,
  key: string,
): Promise<PhoneServer> {
  await enterCall(true);
  return runIdempotent(`updatePhoneServer:${id}`, key, patch, () => {
    const existing = store.servers.find((s) => s.id === id);
    if (!existing) {
      throw new ApiError(404, 'WEBPHONE_SERVER_NOT_FOUND');
    }

    validateServerFields(patch);

    const nextIceEnabled = patch.iceEnabled !== undefined ? patch.iceEnabled : existing.iceEnabled;
    const nextPolicy =
      patch.iceTransportPolicy !== undefined ? patch.iceTransportPolicy : existing.iceTransportPolicy;

    const checkingRelay =
      patch.iceTransportPolicy !== undefined ||
      patch.iceEnabled !== undefined ||
      patch.enabled === true;

    if (checkingRelay) {
      assertRelayConstraint({
        iceTransportPolicy: nextPolicy,
        iceEnabled: nextIceEnabled,
        iceServers: existing.iceServers,
      });
    }

    if (patch.name !== undefined) existing.name = patch.name.trim();
    if (patch.enabled !== undefined) existing.enabled = patch.enabled;
    if (patch.sipDomain !== undefined) existing.sipDomain = patch.sipDomain.trim();
    if (patch.websocketUrl !== undefined) existing.websocketUrl = patch.websocketUrl.trim();
    if (patch.realm !== undefined) existing.realm = normalizeOptionalString(patch.realm);
    if (patch.outboundProxy !== undefined) existing.outboundProxy = normalizeOptionalString(patch.outboundProxy);
    if (patch.fromDomain !== undefined) existing.fromDomain = normalizeOptionalString(patch.fromDomain);
    if (patch.registrarServer !== undefined) existing.registrarServer = normalizeOptionalString(patch.registrarServer);
    if (patch.contactUri !== undefined) existing.contactUri = normalizeOptionalString(patch.contactUri);
    if (patch.registerExpires !== undefined) existing.registerExpires = patch.registerExpires;
    if (patch.defaultCallerId !== undefined) existing.defaultCallerId = normalizeOptionalString(patch.defaultCallerId);
    if (patch.iceTransportPolicy !== undefined) existing.iceTransportPolicy = patch.iceTransportPolicy;
    if (patch.iceEnabled !== undefined) existing.iceEnabled = patch.iceEnabled;
    if (patch.traceSip !== undefined) existing.traceSip = patch.traceSip;
    if (patch.sessionTimers !== undefined) existing.sessionTimers = patch.sessionTimers;
    if (patch.allowInvalidTlsCertificate !== undefined) {
      existing.allowInvalidTlsCertificate = patch.allowInvalidTlsCertificate;
    }
    if (patch.defaultTimeoutSeconds !== undefined) existing.defaultTimeoutSeconds = patch.defaultTimeoutSeconds;
    if (patch.defaultMaxRetries !== undefined) existing.defaultMaxRetries = patch.defaultMaxRetries;

    return toServerView(existing);
  });
}

export async function fakeReorderPhoneServers(ids: string[], key: string): Promise<PhoneServer[]> {
  await enterCall(true);
  return runIdempotent('reorderPhoneServers', key, { ids }, () => {
    const existingIds = new Set(store.servers.map((s) => s.id));
    const uniqueIds = new Set(ids);
    if (
      ids.length !== store.servers.length ||
      uniqueIds.size !== store.servers.length ||
      ids.some((id) => !existingIds.has(id))
    ) {
      throw new ApiError(422, 'WEBPHONE_SERVER_ORDER_INVALID');
    }

    const byId = new Map(store.servers.map((s) => [s.id, s]));
    store.servers = ids.map((id, index) => {
      const server = byId.get(id)!;
      server.priority = index + 1;
      return server;
    });
    return store.servers.map(toServerView);
  });
}

export async function fakeDeletePhoneServer(id: string, key: string): Promise<void> {
  await enterCall(true);
  runIdempotent(`deletePhoneServer:${id}`, key, { id }, () => {
    const index = store.servers.findIndex((s) => s.id === id);
    if (index < 0) {
      throw new ApiError(404, 'WEBPHONE_SERVER_NOT_FOUND');
    }
    store.servers.splice(index, 1);
    renumberPriorities();
    return true;
  });
}

export async function fakeCreateIceServer(
  serverId: string,
  body: CreateIceEntryBody,
  key: string,
): Promise<IceEntry> {
  await enterCall(true);
  const fingerprint = {
    serverId,
    kind: body.kind,
    urls: body.urls,
    username: body.username ?? null,
    hasCredential: Boolean(body.credential?.trim()),
    enabled: body.enabled ?? true,
  };

  return runIdempotent(`createIce:${serverId}`, key, fingerprint, () => {
    const server = store.servers.find((s) => s.id === serverId);
    if (!server) {
      throw new ApiError(404, 'WEBPHONE_SERVER_NOT_FOUND');
    }
    if (body.kind !== 'STUN' && body.kind !== 'TURN') {
      throw invalidField('kind');
    }

    const urls = validateAndNormalizeIceUrls(body.urls);
    const username = normalizeOptionalString(body.username);
    const hasTypedCredential = typeof body.credential === 'string' && body.credential.trim().length > 0;

    validateIceCredentials(body.kind, username, hasTypedCredential, hasTypedCredential);

    const created: StoredIceEntry = {
      id: `ice-${fakeId().slice(0, 8)}`,
      kind: body.kind,
      urls,
      username: body.kind === 'STUN' ? null : username,
      credentialConfigured: body.kind === 'STUN' ? false : hasTypedCredential,
      hasCredential: body.kind === 'STUN' ? false : hasTypedCredential,
      enabled: body.enabled ?? true,
    };

    server.iceServers.push(created);
    return toIceView(created);
  });
}

export async function fakeUpdateIceServer(
  serverId: string,
  iceId: string,
  patch: UpdateIceEntryPatch,
  key: string,
): Promise<IceEntry> {
  await enterCall(true);
  const fingerprint = {
    serverId,
    iceId,
    kind: patch.kind,
    urls: patch.urls,
    username: patch.username,
    credentialAction:
      patch.credential === null
        ? 'clear'
        : typeof patch.credential === 'string' && patch.credential.trim().length > 0
          ? 'set'
          : 'keep',
    enabled: patch.enabled,
  };

  return runIdempotent(`updateIce:${serverId}:${iceId}`, key, fingerprint, () => {
    const server = store.servers.find((s) => s.id === serverId);
    if (!server) {
      throw new ApiError(404, 'WEBPHONE_SERVER_NOT_FOUND');
    }
    const existing = server.iceServers.find((entry) => entry.id === iceId);
    if (!existing) {
      throw new ApiError(404, 'WEBPHONE_ICE_SERVER_NOT_FOUND');
    }

    const nextKind: IceKind = patch.kind ?? existing.kind;
    if (nextKind !== 'STUN' && nextKind !== 'TURN') {
      throw invalidField('kind');
    }

    const nextUrls = patch.urls !== undefined ? validateAndNormalizeIceUrls(patch.urls) : existing.urls;
    const nextEnabled = patch.enabled !== undefined ? patch.enabled : existing.enabled;

    let nextUsername =
      patch.username !== undefined ? normalizeOptionalString(patch.username) : existing.username;
    let nextHasCredential = existing.hasCredential;
    const explicitCredSupplied =
      typeof patch.credential === 'string' && patch.credential.trim().length > 0;

    if (patch.credential === null) {
      nextHasCredential = false;
    } else if (explicitCredSupplied) {
      nextHasCredential = true;
    }

    if (nextKind === 'STUN') {
      if (patch.kind === 'STUN' && patch.username === undefined && patch.credential === undefined) {
        nextUsername = null;
        nextHasCredential = false;
      }
      validateIceCredentials('STUN', nextUsername, nextHasCredential, explicitCredSupplied);
    } else {
      validateIceCredentials('TURN', nextUsername, nextHasCredential, explicitCredSupplied);
    }

    const simulatedEntries = server.iceServers.map((entry) =>
      entry.id === iceId ? { ...entry, kind: nextKind, enabled: nextEnabled } : entry,
    );
    assertRelayConstraint({
      iceTransportPolicy: server.iceTransportPolicy,
      iceEnabled: server.iceEnabled,
      iceServers: simulatedEntries,
    });

    existing.kind = nextKind;
    existing.urls = nextUrls;
    existing.enabled = nextEnabled;
    existing.username = nextKind === 'STUN' ? null : nextUsername;
    existing.hasCredential = nextKind === 'STUN' ? false : nextHasCredential;
    existing.credentialConfigured = existing.hasCredential;

    return toIceView(existing);
  });
}

export async function fakeDeleteIceServer(
  serverId: string,
  iceId: string,
  key: string,
): Promise<void> {
  await enterCall(true);
  runIdempotent(`deleteIce:${serverId}:${iceId}`, key, { serverId, iceId }, () => {
    const server = store.servers.find((s) => s.id === serverId);
    if (!server) {
      throw new ApiError(404, 'WEBPHONE_SERVER_NOT_FOUND');
    }
    const index = server.iceServers.findIndex((entry) => entry.id === iceId);
    if (index < 0) {
      throw new ApiError(404, 'WEBPHONE_ICE_SERVER_NOT_FOUND');
    }

    const simulatedEntries = server.iceServers.filter((_, i) => i !== index);
    assertRelayConstraint({
      iceTransportPolicy: server.iceTransportPolicy,
      iceEnabled: server.iceEnabled,
      iceServers: simulatedEntries,
    });

    server.iceServers.splice(index, 1);
    return true;
  });
}
