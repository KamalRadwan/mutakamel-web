import { CallLogType, CallRecordType } from '../../../../shared/widgets/call-log/call-log.model';
import { ApiError } from '../../../../core/api/api-errors';
import { fakeDelay, fakeId } from '../../../../core/fake/fake-utils';
import {
  CALLER_ID_PATTERN,
  CreateStaffPhoneExtensionBody,
  EXTENSION_PATTERN,
  ListUserCallLogsQuery,
  ListUserCallLogsResponse,
  PhoneSeats,
  PutStaffPhoneServersBody,
  STAFF_PHONE_LIMITS,
  StaffPhoneChainLink,
  StaffPhoneExtension,
  StaffPhoneServer,
  StaffUserCallLog,
  UpdateStaffPhoneExtensionPatch,
} from './staff-phone.model';
import { buildActorMeSync, getStaffSeatSource } from './staff.fake';

export type FakePhoneModuleState = 'ACTIVE' | 'NOT_PURCHASED' | 'PROVISIONING_PENDING' | 'INACTIVE';

export let FAKE_PHONE_FREE_SEAT = false;
export let FAKE_PHONE_GRACE = false;
export let FAKE_PHONE_MODULE_STATE: FakePhoneModuleState = 'ACTIVE';
export let FAKE_PHONE_NO_SERVERS = false;
export let FAKE_PHONE_LOAD_FAIL = false;

export function setFakePhoneFreeSeat(on: boolean): void {
  FAKE_PHONE_FREE_SEAT = on;
}

export function setFakePhoneGrace(on: boolean): void {
  FAKE_PHONE_GRACE = on;
}

export function setFakePhoneModuleState(state: FakePhoneModuleState): void {
  FAKE_PHONE_MODULE_STATE = state;
}

export function setFakePhoneNoServers(empty: boolean): void {
  FAKE_PHONE_NO_SERVERS = empty;
}

export function setFakePhoneLoadFail(fail: boolean): void {
  FAKE_PHONE_LOAD_FAIL = fail;
}

interface StoredExtension extends StaffPhoneExtension {
  hasPassword: boolean;
}

interface IdempotencyRecord {
  op: string;
  bodyHash: string;
  result: unknown;
}

interface PhoneStoreState {
  servers: StaffPhoneServer[];
  extensions: StoredExtension[];
  chains: Map<string, StaffPhoneChainLink[]>;
  callLogs: StaffUserCallLog[];
  idempotency: Map<string, IdempotencyRecord>;
  overCapacitySinceIso: string;
}

const SEAT_ALLOWANCE = 10;
const BASE_OCCUPIED_OUTSIDE_SEED = 8;
const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const SEED_TENANT_ID = 'tenant-1';

const CALL_LOG_TYPES: readonly Exclude<CallLogType, 'OUT'>[] = [
  'IN_ANS',
  'OUT_ANS',
  'IN_NOANS',
  'OUT_NOANS',
  'IN_BUSY',
  'OUT_BUSY',
];

const CALL_CONTACTS_SEED: readonly {
  name: string | null;
  number: string;
  sourceType: CallRecordType | null;
  sourceId: string | null;
  sourceLabel: string | null;
}[] = [
  { name: 'أحمد علي', number: '+201005550142', sourceType: 'LEAD', sourceId: 'lead-001', sourceLabel: 'أحمد علي' },
  { name: 'Nile Logistics', number: '+20225550111', sourceType: 'LEAD', sourceId: 'lead-002', sourceLabel: 'Nile Logistics' },
  { name: 'شركة الدلتا للأغذية', number: '+201005550188', sourceType: 'CUSTOMER_PROFILE', sourceId: 'cust-003', sourceLabel: 'شركة الدلتا للأغذية' },
  { name: 'Sara Mahmoud', number: '+201023456789', sourceType: 'LEAD', sourceId: 'lead-004', sourceLabel: 'Sara Mahmoud' },
  { name: 'مؤسسة النصر', number: '+966501122331', sourceType: 'OPPORTUNITY', sourceId: 'opp-005', sourceLabel: 'مؤسسة النصر — تجديد سنوي' },
  { name: 'Karim Saeed', number: '+201098765432', sourceType: 'PARTY', sourceId: 'party-006', sourceLabel: 'Karim Saeed' },
  { name: 'منى عادل', number: '+201223344556', sourceType: 'LEAD', sourceId: 'lead-007', sourceLabel: 'منى عادل' },
  { name: 'Cairo Steel Co.', number: '+20227778899', sourceType: 'LEAD', sourceId: 'lead-008', sourceLabel: 'Cairo Steel Co.' },
  { name: 'يوسف حسن', number: '+201551234567', sourceType: null, sourceId: null, sourceLabel: null },
  { name: 'Red Sea Resorts', number: '+201144556677', sourceType: 'CUSTOMER_PROFILE', sourceId: 'cust-010', sourceLabel: 'Red Sea Resorts' },
  { name: 'دينا سمير', number: '+201066778899', sourceType: 'LEAD', sourceId: 'lead-011', sourceLabel: 'دينا سمير' },
  { name: null, number: '+201112223344', sourceType: null, sourceId: null, sourceLabel: null },
];

function buildUserSeedCallLogs(
  ownerId: string,
  ownerName: string,
  extensionId: string | null,
  count: number,
  idPrefix: string,
  seedOffset: number,
): StaffUserCallLog[] {
  const now = Date.now();
  let answeredSeq = 0;
  return Array.from({ length: count }, (_, index): StaffUserCallLog => {
    const contact = CALL_CONTACTS_SEED[(index + seedOffset) % CALL_CONTACTS_SEED.length];
    const type = CALL_LOG_TYPES[(index + seedOffset) % CALL_LOG_TYPES.length];
    const answered = type === 'IN_ANS' || type === 'OUT_ANS';
    if (answered) {
      answeredSeq += 1;
    }
    const busy = type === 'IN_BUSY' || type === 'OUT_BUSY';

    let offsetMs: number;
    if (index < 4) {
      offsetMs = (index + 1 + seedOffset) * 24 * MINUTE_MS;
    } else if (index < 8) {
      offsetMs = DAY_MS + (index - 3) * 35 * MINUTE_MS;
    } else {
      const span = Math.max(1, count - 8);
      const dayOffset = 2 + Math.floor(((index - 8) / span) * 58);
      offsetMs = dayOffset * DAY_MS + (((index + seedOffset) * 37) % 600) * MINUTE_MS;
    }

    const startedMs = now - offsetMs;
    const durationSeconds = answered ? 30 + (((index + seedOffset) * 43) % 420) : null;
    const answeredMs = answered ? startedMs + 4_000 : null;
    const endedMs =
      answeredMs !== null && durationSeconds !== null
        ? answeredMs + durationSeconds * 1000
        : startedMs + 18_000;

    return {
      id: `${idPrefix}-${String(count - index).padStart(4, '0')}`,
      tenantId: SEED_TENANT_ID,
      extensionId,
      ownerId,
      ownerName,
      type,
      displayName: contact.name,
      phoneNumber: contact.number,
      phoneDigits: contact.number.replace(/\D/g, ''),
      startedAt: new Date(startedMs).toISOString(),
      answeredAt: answeredMs !== null ? new Date(answeredMs).toISOString() : null,
      endedAt: new Date(endedMs).toISOString(),
      durationSeconds,
      cause: busy ? '486: Busy Here' : answered ? '200: OK' : '408: No Answer',
      createdAt: new Date(endedMs).toISOString(),
      sourceType: contact.sourceType,
      sourceId: contact.sourceId,
      sourceLabel: contact.sourceLabel,
      transferKind: answered && answeredSeq === 2 ? 'BLIND' : answered && answeredSeq === 3 ? 'ATTENDED' : null,
      conferenceId: answered && answeredSeq === 4 ? 'conf-001' : null,
    };
  });
}

function createSeedState(): PhoneStoreState {
  const servers: StaffPhoneServer[] = [
    {
      id: 'srv-cairo-1',
      name: 'Cairo primary',
      priority: 1,
      sipDomain: 'pbx.example.com',
      websocketUrl: 'wss://pbx1.example.com:8089/ws',
      enabled: true,
    },
    {
      id: 'srv-cairo-2',
      name: 'Cairo backup',
      priority: 2,
      sipDomain: 'pbx.example.com',
      websocketUrl: 'wss://pbx2.example.com:8089/ws',
      enabled: true,
    },
  ];

  const extensions: StoredExtension[] = [
    {
      id: 'ext-1001',
      tenantId: SEED_TENANT_ID,
      ownerId: 'u-owner',
      ownerType: 'TENANT_USER',
      extension: '1001',
      sipUsername: '1001',
      displayName: 'Kamal Radwan',
      outboundCallerId: '+20225550100',
      enabled: true,
      passwordConfigured: true,
      hasPassword: true,
      accessState: 'ACTIVE',
      enabledAt: '2026-01-10T09:00:00.000Z',
      createdAt: '2026-01-10T09:00:00.000Z',
      updatedAt: '2026-01-10T09:00:00.000Z',
    },
    {
      id: 'ext-1002',
      tenantId: SEED_TENANT_ID,
      ownerId: 'u-mona',
      ownerType: 'TENANT_USER',
      extension: '1002',
      sipUsername: '1002',
      displayName: null,
      outboundCallerId: null,
      enabled: false,
      passwordConfigured: true,
      hasPassword: true,
      accessState: 'ACTIVE',
      enabledAt: null,
      createdAt: '2026-01-10T09:00:00.000Z',
      updatedAt: '2026-02-01T10:00:00.000Z',
    },
    {
      id: 'ext-1003',
      tenantId: SEED_TENANT_ID,
      ownerId: 'u-omar',
      ownerType: 'TENANT_USER',
      extension: '1003',
      sipUsername: '1003',
      displayName: 'Omar Fathy',
      outboundCallerId: null,
      enabled: true,
      passwordConfigured: true,
      hasPassword: true,
      accessState: 'OVER_CAPACITY',
      enabledAt: '2026-03-15T11:30:00.000Z',
      createdAt: '2026-03-15T11:30:00.000Z',
      updatedAt: '2026-03-15T11:30:00.000Z',
    },
  ];

  const defaultLinks: StaffPhoneChainLink[] = servers.map((s) => ({
    serverId: s.id,
    priority: s.priority,
    timeoutSeconds: null,
    maxRetries: null,
  }));

  const chains = new Map<string, StaffPhoneChainLink[]>([
    ['ext-1001', structuredClone(defaultLinks)],
    ['ext-1002', structuredClone(defaultLinks)],
    ['ext-1003', structuredClone(defaultLinks)],
  ]);

  return {
    servers,
    extensions,
    chains,
    callLogs: [
      ...buildUserSeedCallLogs('u-owner', 'Kamal Radwan', 'ext-1001', 120, 'call-1001', 0),
      ...buildUserSeedCallLogs('u-mona', 'Mona El-Sayed', 'ext-1002', 15, 'call-1002', 3),
    ],
    idempotency: new Map<string, IdempotencyRecord>(),
    overCapacitySinceIso: new Date(Date.now() - 2 * DAY_MS).toISOString(),
  };
}

let store: PhoneStoreState = createSeedState();

export function resetStaffPhoneFake(): void {
  store = createSeedState();
  FAKE_PHONE_FREE_SEAT = false;
  FAKE_PHONE_GRACE = false;
  FAKE_PHONE_MODULE_STATE = 'ACTIVE';
  FAKE_PHONE_NO_SERVERS = false;
  FAKE_PHONE_LOAD_FAIL = false;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function toExtensionView(stored: StoredExtension): StaffPhoneExtension {
  return {
    id: stored.id,
    tenantId: stored.tenantId,
    ownerId: stored.ownerId,
    ownerType: stored.ownerType,
    extension: stored.extension,
    sipUsername: stored.sipUsername,
    displayName: stored.displayName,
    outboundCallerId: stored.outboundCallerId,
    enabled: stored.enabled,
    passwordConfigured: stored.hasPassword,
    accessState: stored.accessState,
    enabledAt: stored.enabledAt,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
}

function actorHasAny(permissions: readonly string[]): boolean {
  const me = buildActorMeSync();
  if (me.isTenantOwner) return true;
  return permissions.some((permission) => {
    const entry = me.permissionScopes[permission];
    if (!entry) return false;
    return (
      entry.tenantWide ||
      entry.branchIds.length > 0 ||
      entry.companyIds.length > 0 ||
      me.permissions.includes(permission)
    );
  });
}

function checkModuleReadGate(): void {
  if (FAKE_PHONE_LOAD_FAIL) {
    throw new ApiError(500, 'INTERNAL_ERROR');
  }
  if (FAKE_PHONE_MODULE_STATE === 'NOT_PURCHASED') {
    throw new ApiError(403, 'WEBPHONE_MODULE_NOT_PURCHASED');
  }
  if (FAKE_PHONE_MODULE_STATE === 'PROVISIONING_PENDING') {
    throw new ApiError(409, 'WEBPHONE_PROVISIONING_PENDING');
  }
}

function checkModuleWriteGate(): void {
  checkModuleReadGate();
  if (FAKE_PHONE_MODULE_STATE === 'INACTIVE') {
    throw new ApiError(403, 'WEBPHONE_MODULE_INACTIVE');
  }
}

function computeSeats(): PhoneSeats {
  const enabledCount = store.extensions.filter((e) => e.enabled).length;
  const base = FAKE_PHONE_FREE_SEAT ? BASE_OCCUPIED_OUTSIDE_SEED - 1 : BASE_OCCUPIED_OUTSIDE_SEED;
  const occupied = Math.max(0, base + enabledCount);
  const available = Math.max(0, SEAT_ALLOWANCE - occupied);
  const overCapacity = store.extensions.filter((e) => e.enabled && e.accessState === 'OVER_CAPACITY').length;
  const graceUntil = FAKE_PHONE_GRACE
    ? new Date(Date.now() + 14 * 86_400_000).toISOString()
    : null;
  const overCapacitySince = overCapacity > 0 || FAKE_PHONE_GRACE ? store.overCapacitySinceIso : null;
  return {
    allowed: SEAT_ALLOWANCE,
    occupied,
    available,
    overAllowance: occupied > SEAT_ALLOWANCE || FAKE_PHONE_GRACE,
    graceUntil,
    overCapacity,
    overCapacitySince,
  };
}

function checkIdempotency<T>(op: string, key: string, body: unknown, run: () => T): T {
  const trimmedKey = key.trim();
  if (!trimmedKey) {
    throw new ApiError(400, 'GW.IDEM.MISSING');
  }
  const bodyHash = JSON.stringify(body) ?? '';
  const compositeKey = `${op}:${trimmedKey}`;
  const existing = store.idempotency.get(compositeKey);
  if (existing) {
    if (existing.bodyHash !== bodyHash) {
      throw new ApiError(409, 'GW.IDEM.MISMATCH');
    }
    return clone(existing.result as T);
  }
  const result = run();
  store.idempotency.set(compositeKey, { op, bodyHash, result: clone(result) });
  return clone(result);
}

function validateFields(fields: {
  extension?: string;
  sipUsername?: string;
  displayName?: string | null;
  outboundCallerId?: string | null;
}): void {
  if (fields.extension !== undefined) {
    const ext = fields.extension.trim();
    if (!ext || ext.length > STAFF_PHONE_LIMITS.extension || !EXTENSION_PATTERN.test(ext)) {
      throw new ApiError(422, 'VALIDATION_ERROR', { field: 'extension' });
    }
  }
  if (fields.sipUsername !== undefined) {
    const username = fields.sipUsername.trim();
    if (!username || username.length > STAFF_PHONE_LIMITS.sipUsername) {
      throw new ApiError(422, 'VALIDATION_ERROR', { field: 'sipUsername' });
    }
  }
  if (fields.displayName !== undefined && fields.displayName !== null) {
    if (fields.displayName.trim().length > STAFF_PHONE_LIMITS.displayName) {
      throw new ApiError(422, 'VALIDATION_ERROR', { field: 'displayName' });
    }
  }
  if (fields.outboundCallerId !== undefined && fields.outboundCallerId !== null) {
    const callerId = fields.outboundCallerId.trim();
    if (
      callerId.length > STAFF_PHONE_LIMITS.outboundCallerId ||
      (callerId.length > 0 && !CALLER_ID_PATTERN.test(callerId))
    ) {
      throw new ApiError(422, 'VALIDATION_ERROR', { field: 'outboundCallerId' });
    }
  }
}

export async function fakeGetExtensionByOwner(ownerId: string): Promise<StaffPhoneExtension> {
  await fakeDelay();
  if (!actorHasAny(['webphone.extensions.read', 'webphone.extensions.manage'])) {
    throw new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS');
  }
  checkModuleReadGate();
  const found = store.extensions.find((e) => e.ownerId === ownerId);
  if (!found) {
    throw new ApiError(404, 'WEBPHONE_EXTENSION_NOT_FOUND');
  }
  return clone(toExtensionView(found));
}

export async function fakeCreateExtension(
  body: CreateStaffPhoneExtensionBody,
  key: string,
): Promise<StaffPhoneExtension> {
  await fakeDelay();
  if (!actorHasAny(['webphone.extensions.manage'])) {
    throw new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS');
  }
  checkModuleWriteGate();

  const sanitizedBodyForIdem = {
    ownerId: body.ownerId,
    extension: body.extension,
    sipUsername: body.sipUsername,
    hasPassword: Boolean(body.sipPassword?.trim()),
    displayName: body.displayName ?? null,
    outboundCallerId: body.outboundCallerId ?? null,
    enabled: Boolean(body.enabled),
  };

  return checkIdempotency('createExtension', key, sanitizedBodyForIdem, () => {
    validateFields({
      extension: body.extension,
      sipUsername: body.sipUsername,
      displayName: body.displayName,
      outboundCallerId: body.outboundCallerId,
    });

    if (store.extensions.some((e) => e.ownerId === body.ownerId)) {
      throw new ApiError(409, 'WEBPHONE_OWNER_HAS_EXTENSION');
    }

    const extension = body.extension.trim();
    const sipUsername = body.sipUsername.trim();

    if (store.extensions.some((e) => e.extension.toLowerCase() === extension.toLowerCase())) {
      throw new ApiError(409, 'WEBPHONE_EXTENSION_TAKEN', { extension });
    }
    if (store.extensions.some((e) => e.sipUsername.toLowerCase() === sipUsername.toLowerCase())) {
      throw new ApiError(409, 'WEBPHONE_SIP_USERNAME_TAKEN', { sipUsername });
    }

    const hasPassword = Boolean(body.sipPassword && body.sipPassword.trim().length > 0);
    const enabled = Boolean(body.enabled);

    if (enabled && !hasPassword) {
      throw new ApiError(422, 'WEBPHONE_CONFIG_INCOMPLETE');
    }

    if (enabled) {
      const seats = computeSeats();
      if (seats.available <= 0) {
        throw new ApiError(409, 'WEBPHONE_SEAT_LIMIT_REACHED', {
          allowed: seats.allowed,
          occupied: seats.occupied,
        });
      }
    }

    const nowIso = new Date().toISOString();
    const created: StoredExtension = {
      id: `ext-${fakeId().slice(0, 8)}`,
      tenantId: SEED_TENANT_ID,
      ownerId: body.ownerId,
      ownerType: 'TENANT_USER',
      extension,
      sipUsername,
      displayName: body.displayName?.trim() || null,
      outboundCallerId: body.outboundCallerId?.trim() || null,
      enabled,
      passwordConfigured: hasPassword,
      hasPassword,
      accessState: 'ACTIVE',
      enabledAt: enabled ? nowIso : null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    store.extensions.push(created);

    const servers = FAKE_PHONE_NO_SERVERS
      ? []
      : [...store.servers].sort((a, b) => a.priority - b.priority);
    store.chains.set(
      created.id,
      servers.map((s, idx) => ({
        serverId: s.id,
        priority: idx + 1,
        timeoutSeconds: null,
        maxRetries: null,
      })),
    );

    return toExtensionView(created);
  });
}

export async function fakeUpdateExtension(
  id: string,
  patch: UpdateStaffPhoneExtensionPatch,
  key: string,
): Promise<StaffPhoneExtension> {
  await fakeDelay();
  if (!actorHasAny(['webphone.extensions.manage'])) {
    throw new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS');
  }
  checkModuleWriteGate();

  const sanitizedPatchForIdem = {
    id,
    extension: patch.extension,
    sipUsername: patch.sipUsername,
    hasPassword: patch.sipPassword !== undefined ? Boolean(patch.sipPassword.trim()) : undefined,
    displayName: patch.displayName,
    outboundCallerId: patch.outboundCallerId,
    enabled: patch.enabled,
  };

  return checkIdempotency(`updateExtension:${id}`, key, sanitizedPatchForIdem, () => {
    const existing = store.extensions.find((e) => e.id === id);
    if (!existing) {
      throw new ApiError(404, 'WEBPHONE_EXTENSION_NOT_FOUND');
    }

    validateFields({
      extension: patch.extension,
      sipUsername: patch.sipUsername,
      displayName: patch.displayName,
      outboundCallerId: patch.outboundCallerId,
    });

    const nextExtension = patch.extension !== undefined ? patch.extension.trim() : existing.extension;
    const nextUsername = patch.sipUsername !== undefined ? patch.sipUsername.trim() : existing.sipUsername;

    if (
      patch.extension !== undefined &&
      store.extensions.some((e) => e.id !== id && e.extension.toLowerCase() === nextExtension.toLowerCase())
    ) {
      throw new ApiError(409, 'WEBPHONE_EXTENSION_TAKEN', { extension: nextExtension });
    }
    if (
      patch.sipUsername !== undefined &&
      store.extensions.some((e) => e.id !== id && e.sipUsername.toLowerCase() === nextUsername.toLowerCase())
    ) {
      throw new ApiError(409, 'WEBPHONE_SIP_USERNAME_TAKEN', { sipUsername: nextUsername });
    }

    const passwordProvided = Boolean(patch.sipPassword && patch.sipPassword.trim().length > 0);
    const nextHasPassword = existing.hasPassword || passwordProvided;
    const nextEnabled = patch.enabled !== undefined ? patch.enabled : existing.enabled;

    if (nextEnabled && !nextHasPassword) {
      throw new ApiError(422, 'WEBPHONE_CONFIG_INCOMPLETE');
    }

    if (nextEnabled && !existing.enabled) {
      const seats = computeSeats();
      if (seats.available <= 0) {
        throw new ApiError(409, 'WEBPHONE_SEAT_LIMIT_REACHED', {
          allowed: seats.allowed,
          occupied: seats.occupied,
        });
      }
    }

    existing.extension = nextExtension;
    existing.sipUsername = nextUsername;
    if (patch.displayName !== undefined) {
      existing.displayName = patch.displayName?.trim() || null;
    }
    if (patch.outboundCallerId !== undefined) {
      existing.outboundCallerId = patch.outboundCallerId?.trim() || null;
    }
    existing.hasPassword = nextHasPassword;
    existing.passwordConfigured = nextHasPassword;

    const nowIso = new Date().toISOString();
    if (patch.enabled !== undefined && patch.enabled !== existing.enabled) {
      existing.enabled = patch.enabled;
      if (patch.enabled) {
        existing.enabledAt = nowIso;
        existing.accessState = 'ACTIVE';
      } else {
        existing.enabledAt = null;
        existing.accessState = 'ACTIVE';
      }
    }
    existing.updatedAt = nowIso;

    return toExtensionView(existing);
  });
}

export async function fakeGetExtensionServers(id: string): Promise<StaffPhoneChainLink[]> {
  await fakeDelay();
  if (!actorHasAny(['webphone.extensions.read', 'webphone.extensions.manage'])) {
    throw new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS');
  }
  checkModuleReadGate();
  const exists = store.extensions.some((e) => e.id === id);
  if (!exists) {
    throw new ApiError(404, 'WEBPHONE_EXTENSION_NOT_FOUND');
  }
  const chain = store.chains.get(id) ?? [];
  return clone([...chain].sort((a, b) => a.priority - b.priority));
}

export async function fakePutExtensionServers(
  id: string,
  body: PutStaffPhoneServersBody,
  key: string,
): Promise<StaffPhoneChainLink[]> {
  await fakeDelay();
  if (!actorHasAny(['webphone.extensions.manage'])) {
    throw new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS');
  }
  checkModuleWriteGate();

  return checkIdempotency(`putExtensionServers:${id}`, key, body, () => {
    const exists = store.extensions.some((e) => e.id === id);
    if (!exists) {
      throw new ApiError(404, 'WEBPHONE_EXTENSION_NOT_FOUND');
    }

    const validServerIds = new Set(store.servers.map((s) => s.id));
    const seen = new Set<string>();
    const nextChain: StaffPhoneChainLink[] = [];

    body.servers.forEach((item, index) => {
      if (!validServerIds.has(item.serverId) || seen.has(item.serverId)) {
        throw new ApiError(422, 'VALIDATION_ERROR', { field: 'servers' });
      }
      seen.add(item.serverId);
      nextChain.push({
        serverId: item.serverId,
        priority: index + 1,
        timeoutSeconds: item.timeoutSeconds,
        maxRetries: item.maxRetries,
      });
    });

    store.chains.set(id, nextChain);
    return clone(nextChain);
  });
}

export async function fakeListPhoneServers(): Promise<StaffPhoneServer[]> {
  await fakeDelay();
  if (!actorHasAny(['webphone.settings.read', 'webphone.extensions.read', 'webphone.extensions.manage'])) {
    throw new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS');
  }
  checkModuleReadGate();
  if (FAKE_PHONE_NO_SERVERS) return [];
  return clone([...store.servers].sort((a, b) => a.priority - b.priority));
}

export async function fakeGetPhoneSeats(): Promise<PhoneSeats> {
  await fakeDelay();
  if (!actorHasAny(['webphone.settings.read'])) {
    throw new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS');
  }
  checkModuleReadGate();
  return clone(computeSeats());
}

export async function fakeListUserCallLogs(
  userId: string,
  query: ListUserCallLogsQuery = {},
): Promise<ListUserCallLogsResponse> {
  await fakeDelay();
  if (!actorHasAny(['webphone.call_logs.read'])) {
    throw new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS');
  }
  checkModuleReadGate();

  const staffUsers = getStaffSeatSource().users;
  const matchedUser = staffUsers.find((u) => u.userId === userId);
  const matchedExt = store.extensions.find((e) => e.ownerId === userId || e.extension === userId);
  const resolvedOwnerId =
    matchedUser?.userId ??
    (matchedExt && staffUsers.some((u) => u.userId === matchedExt.ownerId) ? matchedExt.ownerId : null);

  if (!resolvedOwnerId) {
    throw new ApiError(404, 'WEBPHONE_USER_NOT_FOUND');
  }

  const page = Math.max(1, query.page ?? 1);
  const limit = Math.max(1, Math.min(100, query.limit ?? 20));
  const typeList = query.type ? query.type.split(',').filter(Boolean) : [];
  const typeSet = typeList.length > 0 ? new Set<string>(typeList) : null;
  const fromMs = parseDateBound(query.from, false);
  const toMs = parseDateBound(query.to, true);
  const rawSearch = query.q?.trim() ?? '';
  const lowerSearch = rawSearch.toLowerCase();
  const searchDigits = rawSearch.replace(/\D/g, '');

  const filtered = store.callLogs.filter((entry) => {
    if (entry.ownerId !== resolvedOwnerId) return false;
    if (typeSet && !typeSet.has(entry.type)) return false;

    const entryTime = Date.parse(entry.startedAt ?? entry.createdAt);
    if (fromMs !== null && !Number.isNaN(entryTime) && entryTime < fromMs) return false;
    if (toMs !== null && !Number.isNaN(entryTime) && entryTime > toMs) return false;

    if (rawSearch) {
      const matchesName = entry.displayName?.toLowerCase().includes(lowerSearch) ?? false;
      const matchesDigits = searchDigits.length > 0 && (entry.phoneDigits?.includes(searchDigits) ?? false);
      if (!matchesName && !matchesDigits) return false;
    }

    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const ta = parseSortTime(a.startedAt);
    const tb = parseSortTime(b.startedAt);
    if (tb !== ta) return tb - ta;
    return b.id.localeCompare(a.id);
  });

  const start = (page - 1) * limit;
  const slice = sorted.slice(start, start + limit);

  return {
    data: clone(slice),
    meta: {
      page,
      limit,
      total: sorted.length,
    },
  };
}

function parseSortTime(iso: string | null): number {
  if (!iso) return Number.NEGATIVE_INFINITY;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
}

function parseDateBound(raw: string | undefined, endOfDay: boolean): number | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const suffix = endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
    const ms = Date.parse(`${trimmed}${suffix}`);
    return Number.isNaN(ms) ? null : ms;
  }
  const ms = Date.parse(trimmed);
  return Number.isNaN(ms) ? null : ms;
}
