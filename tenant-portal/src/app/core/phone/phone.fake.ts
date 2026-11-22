import { isDevMode } from '@angular/core';
import { readPhoneDevMe } from './phone-dev-me';
import {
  CallLog,
  CallLogRecord,
  CallLogType,
  CallSourceType,
  CreateCallLogInput,
  ListCallLogsQuery,
  ListCallLogsResponse,
  PhoneApiError,
  PhoneLookupResponse,
  PhoneMe,
  PhoneServer,
} from './phone.model';

export type FakePhoneMeMode =
  | 'enabled'
  | 'NO_EXTENSION'
  | 'DISABLED'
  | 'NO_SERVER'
  | 'OVER_CAPACITY'
  | 'notConfigured'
  | '403'
  | '409'
  | 'MODULE_INACTIVE'
  | 'SCOPE_MISMATCH'
  | 'FORBIDDEN'
  | 'SERVER_ERROR';

export type FakeCallLogsMode = 'normal' | 'empty' | 'error';

const DEFAULT_DELAY_MS = 300;
const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const SEED_TENANT_ID = 'tenant-1';
const SEED_EXTENSION_ID = 'ext-me';
const SEED_OWNER_ID = 'user-me';
const MAX_PHONE_NUMBER_LENGTH = 80;
const MAX_DISPLAY_NAME_LENGTH = 120;
const MAX_SOURCE_LABEL_LENGTH = 160;
const MAX_CAUSE_LENGTH = 120;
const MAX_DURATION_SECONDS = 86_400;

const DEFAULT_TURN_TTL_MS = 3_600_000;

let delayMs = DEFAULT_DELAY_MS;
let turnTtlMs = DEFAULT_TURN_TTL_MS;
let meMode: FakePhoneMeMode = 'enabled';
let callLogsMode: FakeCallLogsMode = 'normal';

const SEEDED_SERVERS: PhoneServer[] = [
  {
    id: 'srv-cairo-1',
    name: 'Cairo primary',
    priority: 1,
    sipDomain: 'pbx.example.com',
    websocketUrl: 'wss://pbx1.example.com:8089/ws',
    realm: null,
    outboundProxy: null,
    fromDomain: null,
    registrarServer: null,
    contactUri: null,
    registerExpires: 300,
    defaultCallerId: '+20225550100',
    iceTransportPolicy: 'all',
    traceSip: false,
    sessionTimers: true,
    allowInvalidTlsCertificate: false,
    timeoutSeconds: 10,
    maxRetries: 2,
    iceServers: [{ kind: 'STUN', urls: ['stun:stun.l.google.com:19302'] }],
  },
  {
    id: 'srv-cairo-2',
    name: 'Cairo backup',
    priority: 2,
    sipDomain: 'pbx.example.com',
    websocketUrl: 'wss://pbx2.example.com:8089/ws',
    realm: null,
    outboundProxy: null,
    fromDomain: null,
    registrarServer: null,
    contactUri: null,
    registerExpires: 300,
    defaultCallerId: '+20225550100',
    iceTransportPolicy: 'all',
    traceSip: false,
    sessionTimers: true,
    allowInvalidTlsCertificate: false,
    timeoutSeconds: 10,
    maxRetries: 2,
    iceServers: [{ kind: 'STUN', urls: ['stun:stun.l.google.com:19302'] }],
  },
];

const CONTACTS_SEED: readonly {
  name: string;
  number: string;
  sourceType: CallSourceType | null;
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
  { name: 'Unknown Caller', number: '+201112223344', sourceType: null, sourceId: null, sourceLabel: null },
];

const LIVE_TYPES: readonly Exclude<CallLogType, 'OUT'>[] = [
  'IN_ANS',
  'OUT_ANS',
  'IN_NOANS',
  'OUT_NOANS',
  'IN_BUSY',
  'OUT_BUSY',
];

function buildSeedCallLogs(): CallLog[] {
  const now = Date.now();
  let answeredSeq = 0;
  return Array.from({ length: 236 }, (_, index): CallLog => {
    const contact = CONTACTS_SEED[index % CONTACTS_SEED.length];
    const type = LIVE_TYPES[index % LIVE_TYPES.length];
    const answered = type === 'IN_ANS' || type === 'OUT_ANS';
    if (answered) {
      answeredSeq += 1;
    }
    const busy = type === 'IN_BUSY' || type === 'OUT_BUSY';

    let offsetMs: number;
    if (index < 6) {
      // Today
      offsetMs = (index + 1) * 28 * MINUTE_MS;
    } else if (index < 12) {
      // Yesterday
      offsetMs = DAY_MS + (index - 5) * 45 * MINUTE_MS;
    } else {
      // Spread across the last 60 days
      const dayOffset = 2 + Math.floor(((index - 12) / (236 - 12)) * 58);
      offsetMs = dayOffset * DAY_MS + ((index * 37) % 600) * MINUTE_MS;
    }

    const startedMs = now - offsetMs;
    const durationSeconds = answered ? 35 + ((index * 47) % 420) : null;
    const answeredMs = answered ? startedMs + 4_000 : null;
    const endedMs = answeredMs !== null && durationSeconds !== null ? answeredMs + durationSeconds * 1000 : startedMs + 18_000;

    return {
      id: `call-log-${String(236 - index).padStart(4, '0')}`,
      tenantId: SEED_TENANT_ID,
      extensionId: SEED_EXTENSION_ID,
      ownerId: SEED_OWNER_ID,
      ownerName: null,
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

let callLogs: CallLog[] = buildSeedCallLogs();

function delay(): Promise<void> {
  if (delayMs <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Dev/test switch to adjust the fake API delay (set 0 in unit tests). */
export function setFakePhoneDelay(ms: number): void {
  delayMs = Math.max(0, ms);
}

/** Dev/test switch for how long the fake TURN credentials live (the phone refreshes `/me` 60 s before expiry). */
export function setFakeTurnTtl(ms: number): void {
  turnTtlMs = Math.max(0, ms);
}

/** Dev/test switch to simulate `/me` states (`enabled`, disabled reasons, `notConfigured`, and the error codes `403`, `409`, `MODULE_INACTIVE`, `SCOPE_MISMATCH`, `FORBIDDEN`, `SERVER_ERROR`). Also reachable as `window.__phoneFake.setMeMode`. */
export function setFakePhoneMeMode(mode: FakePhoneMeMode): void {
  meMode = mode;
}

/** Dev/test switch to simulate call-logs states (`normal`, `empty`, `error`). */
export function setFakeCallLogsMode(mode: FakeCallLogsMode): void {
  callLogsMode = mode;
}

/** Resets fake phone module state to defaults (intended for unit tests). */
export function resetPhoneFake(): void {
  delayMs = DEFAULT_DELAY_MS;
  turnTtlMs = DEFAULT_TURN_TTL_MS;
  meMode = 'enabled';
  callLogsMode = 'normal';
  callLogs = buildSeedCallLogs();
}

export async function fakeGetMe(): Promise<PhoneMe> {
  await delay();
  if (isDevMode()) {
    const devMe = readPhoneDevMe(true);
    if (devMe) {
      return clone(devMe);
    }
  }
  if (meMode === '403') {
    throw new PhoneApiError(403, 'WEBPHONE_MODULE_NOT_PURCHASED');
  }
  if (meMode === '409') {
    throw new PhoneApiError(409, 'WEBPHONE_PROVISIONING_PENDING');
  }
  if (meMode === 'MODULE_INACTIVE') {
    throw new PhoneApiError(403, 'WEBPHONE_MODULE_INACTIVE');
  }
  if (meMode === 'SCOPE_MISMATCH') {
    throw new PhoneApiError(403, 'WEBPHONE_SCOPE_MISMATCH');
  }
  if (meMode === 'FORBIDDEN') {
    // An uncoded 403 (e.g. the /me owner guard's bare message) must not be read as "not purchased".
    throw new PhoneApiError(403, 'FORBIDDEN');
  }
  if (meMode === 'SERVER_ERROR') {
    throw new PhoneApiError(500, 'WEBPHONE_INTERNAL_ERROR');
  }

  const baseTurn = {
    enabled: true,
    iceServers: [
      {
        urls: ['turn:turn.example.com:3478?transport=udp'],
        username: 'turn-user',
        credential: 'fake-turn-credential',
      },
    ],
    expiresAt: new Date(Date.now() + turnTtlMs).toISOString(),
  };

  if (meMode === 'NO_EXTENSION' || meMode === 'DISABLED' || meMode === 'NO_SERVER' || meMode === 'OVER_CAPACITY') {
    return clone({
      enabled: false,
      reason: meMode,
      extension: meMode === 'NO_EXTENSION' ? null : '1001',
      sipUsername: meMode === 'NO_EXTENSION' ? null : '1001',
      sipPassword: null,
      displayName: 'Sara Hassan',
      outboundCallerId: '+20225550100',
      passwordConfigured: meMode !== 'NO_EXTENSION',
      servers: meMode === 'NO_SERVER' ? [] : SEEDED_SERVERS,
      turnCredentials: baseTurn,
    });
  }

  if (meMode === 'notConfigured') {
    return clone({
      enabled: true,
      reason: null,
      extension: '1001',
      sipUsername: '1001',
      sipPassword: null,
      displayName: 'Sara Hassan',
      outboundCallerId: '+20225550100',
      passwordConfigured: false,
      servers: [],
      turnCredentials: baseTurn,
    });
  }

  return clone({
    enabled: true,
    reason: null,
    extension: '1001',
    sipUsername: '1001',
    sipPassword: 'fake-sip-password-1001',
    displayName: 'Sara Hassan',
    outboundCallerId: '+20225550100',
    passwordConfigured: true,
    servers: SEEDED_SERVERS,
    turnCredentials: baseTurn,
  });
}

export async function fakeListCallLogs(query: ListCallLogsQuery = {}): Promise<ListCallLogsResponse> {
  await delay();
  if (callLogsMode === 'error') {
    throw new PhoneApiError(500, 'SERVER_ERROR');
  }

  const page = Math.max(1, query.page ?? 1);
  const limit = Math.max(1, Math.min(100, query.limit ?? 20));

  if (callLogsMode === 'empty') {
    return { data: [], meta: { page, limit, total: 0 } };
  }

  const typeList = query.type ? query.type.split(',').filter(Boolean) : [];
  const typeSet = typeList.length > 0 ? new Set<string>(typeList) : null;
  const fromMs = parseDateBound(query.from, false);
  const toMs = parseDateBound(query.to, true);
  const rawSearch = query.q?.trim() ?? '';
  const lowerSearch = rawSearch.toLowerCase();
  const searchDigits = rawSearch.replace(/\D/g, '');

  const filtered = callLogs.filter((entry) => {
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

function validateCreateCallLog(body: CreateCallLogInput): void {
  if (body.phoneNumber.length > MAX_PHONE_NUMBER_LENGTH) {
    throw new PhoneApiError(422, 'VALIDATION_ERROR', { field: 'phoneNumber' });
  }
  if (body.displayName !== null && body.displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    throw new PhoneApiError(422, 'VALIDATION_ERROR', { field: 'displayName' });
  }
  const trimmedSourceLabel = body.sourceLabel?.trim() ?? '';
  if (trimmedSourceLabel.length > MAX_SOURCE_LABEL_LENGTH) {
    throw new PhoneApiError(422, 'VALIDATION_ERROR', { field: 'sourceLabel' });
  }
  if (
    body.durationSeconds !== null &&
    (!Number.isInteger(body.durationSeconds) || body.durationSeconds < 0 || body.durationSeconds > MAX_DURATION_SECONDS)
  ) {
    throw new PhoneApiError(422, 'VALIDATION_ERROR', { field: 'durationSeconds' });
  }
  const hasSourceType = Boolean(body.sourceType);
  const hasSourceId = Boolean(body.sourceId?.trim());
  const hasSourceLabel = trimmedSourceLabel.length > 0;
  if ((hasSourceType || hasSourceId || hasSourceLabel) && (!hasSourceType || !hasSourceId)) {
    throw new PhoneApiError(422, 'VALIDATION_ERROR', { field: hasSourceType ? 'sourceId' : 'sourceType' });
  }
}

export async function fakeCreateCallLog(body: CreateCallLogInput): Promise<CallLogRecord | null> {
  await delay();
  validateCreateCallLog(body);
  // The save response is the raw stored row: no joined `ownerName`, and the generated `phoneDigits` is not echoed.
  const { ownerName: _ownerName, phoneDigits: _phoneDigits, ...record } = appendFakeCallLog(body);
  return record;
}

/** Synchronously records a lost-call log during `pagehide` keepalive fallback in fake mode. */
export function appendFakeCallLog(body: CreateCallLogInput): CallLog {
  const phoneNumber = body.phoneNumber.slice(0, MAX_PHONE_NUMBER_LENGTH);
  const phoneDigits = phoneNumber.replace(/\D/g, '');
  const displayName = body.displayName !== null ? body.displayName.slice(0, MAX_DISPLAY_NAME_LENGTH) : null;
  const durationSeconds =
    body.durationSeconds !== null && Number.isFinite(body.durationSeconds)
      ? Math.max(0, Math.min(MAX_DURATION_SECONDS, Math.floor(body.durationSeconds)))
      : null;
  const cause = body.cause !== null ? body.cause.slice(0, MAX_CAUSE_LENGTH) : null;
  const trimmedSourceId = body.sourceId?.trim() ?? '';
  const hasSource = Boolean(body.sourceType && trimmedSourceId);
  const trimmedSourceLabel = body.sourceLabel?.trim() ?? '';
  const sourceLabel = hasSource && trimmedSourceLabel ? trimmedSourceLabel.slice(0, MAX_SOURCE_LABEL_LENGTH) : null;

  const created: CallLog = {
    id: `call-log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tenantId: SEED_TENANT_ID,
    extensionId: SEED_EXTENSION_ID,
    ownerId: SEED_OWNER_ID,
    ownerName: null,
    type: body.type,
    displayName,
    phoneNumber,
    phoneDigits,
    startedAt: body.startedAt,
    answeredAt: body.answeredAt,
    endedAt: body.endedAt,
    durationSeconds,
    cause,
    createdAt: new Date().toISOString(),
    sourceType: hasSource ? body.sourceType : null,
    sourceId: hasSource ? trimmedSourceId : null,
    sourceLabel,
    transferKind: body.transferKind ?? null,
    conferenceId: body.conferenceId ?? null,
  };
  callLogs = [created, ...callLogs];
  return clone(created);
}

export async function fakeLookupNumber(number: string): Promise<PhoneLookupResponse> {
  await delay();
  const digits = number.replace(/\D/g, '');
  if (digits.length < 6) {
    return { match: null, count: 0 };
  }
  if (digits === '201005550142') {
    return clone({
      match: { type: 'LEAD', id: 'lead-001', name: 'أحمد علي' },
      count: 1,
    });
  }
  if (digits === '966501122331') {
    return clone({
      match: { type: 'CUSTOMER_PROFILE', id: 'cp-003', name: 'مؤسسة النصر' },
      count: 1,
    });
  }
  if (digits === '201112223344') {
    return { match: null, count: 2 };
  }
  return { match: null, count: 0 };
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
