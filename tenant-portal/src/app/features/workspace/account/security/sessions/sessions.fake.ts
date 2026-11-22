import { ApiError } from '../../../../../core/api/api-errors';
import { fakeDelay, fakeId } from '../../../../../core/fake/fake-utils';
import {
  AuthSession,
  SESSION_CLIENT_TYPES,
  SESSION_END_REASONS,
  SESSION_HISTORY_PAGE_SIZE,
  SessionClientType,
  SessionList,
} from './sessions.model';

export let FAKE_SESSIONS_FAIL_NEXT = false;

export function setFakeSessionsFailNext(fail: boolean): void {
  FAKE_SESSIONS_FAIL_NEXT = fail;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const IDLE_WINDOW_MS = 2 * HOUR_MS;
const ABSOLUTE_WINDOW_MS = 30 * DAY_MS;

// Backend UUID_V7_PATTERN: version nibble 7, RFC variant 8-b.
const UUID_V7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CLIENT_IDS: Readonly<Record<SessionClientType, string>> = {
  WEB: 'mutakamel-tenant-web',
  IOS: 'mutakamel-tenant-ios',
  ANDROID: 'mutakamel-tenant-android',
  DESKTOP: 'mutakamel-tenant-desktop',
};

const ENDED_DEVICE_LABELS: readonly (string | null)[] = [
  null,
  'iPhone 15',
  'Pixel 9',
  'Office MacBook',
  null,
  'Workstation Windows',
  'iPad Pro',
];

function createSeedSessions(): AuthSession[] {
  const now = Date.now();

  const buildActive = (opts: {
    clientType: SessionClientType;
    deviceLabel: string | null;
    createdMs: number;
    activeMs: number;
    refreshMs: number;
    refreshUseCount: string;
    accessIssueCount: string;
    current: boolean;
  }): AuthSession => ({
    id: fakeId(),
    clientType: opts.clientType,
    clientId: CLIENT_IDS[opts.clientType],
    deviceLabel: opts.deviceLabel,
    createdAt: new Date(opts.createdMs).toISOString(),
    lastRefreshAt: new Date(opts.refreshMs).toISOString(),
    lastAccessIssuedAt: new Date(opts.activeMs).toISOString(),
    lastUserActivityAt: new Date(opts.activeMs).toISOString(),
    idleExpiresAt: new Date(opts.activeMs + IDLE_WINDOW_MS).toISOString(),
    absoluteExpiresAt: new Date(opts.createdMs + ABSOLUTE_WINDOW_MS).toISOString(),
    endedAt: null,
    endReason: null,
    refreshUseCount: opts.refreshUseCount,
    accessIssueCount: opts.accessIssueCount,
    credentialVersion: 3,
    sessionEpoch: 1,
    current: opts.current,
  });

  const active: AuthSession[] = [
    buildActive({
      clientType: 'WEB',
      deviceLabel: null,
      createdMs: now - HOUR_MS,
      activeMs: now - 2 * MINUTE_MS,
      refreshMs: now - 15 * MINUTE_MS,
      refreshUseCount: '4',
      accessIssueCount: '12',
      current: true,
    }),
    buildActive({
      clientType: 'WEB',
      deviceLabel: null,
      createdMs: now - 2 * DAY_MS,
      activeMs: now - 5 * HOUR_MS,
      refreshMs: now - 6 * HOUR_MS,
      refreshUseCount: '18',
      accessIssueCount: '47',
      current: false,
    }),
    buildActive({
      clientType: 'IOS',
      deviceLabel: 'iPhone 15',
      createdMs: now - 10 * DAY_MS,
      activeMs: now - DAY_MS,
      refreshMs: now - (DAY_MS + HOUR_MS),
      refreshUseCount: '29',
      accessIssueCount: '84',
      current: false,
    }),
  ];

  const ended: AuthSession[] = Array.from({ length: 60 }, (_, index): AuthSession => {
    const clientType = SESSION_CLIENT_TYPES[index % SESSION_CLIENT_TYPES.length];
    const endReason = SESSION_END_REASONS[index % SESSION_END_REASONS.length];
    const endedMs = now - (index + 1) * DAY_MS - (index % 6) * HOUR_MS;
    const activeMs = endedMs - 15 * MINUTE_MS;
    const createdMs = endedMs - ((index % 7) + 1) * DAY_MS;
    const hasActivity = index % 4 !== 0;

    return {
      id: fakeId(),
      clientType,
      clientId: CLIENT_IDS[clientType],
      deviceLabel: clientType === 'WEB' ? null : ENDED_DEVICE_LABELS[index % ENDED_DEVICE_LABELS.length],
      createdAt: new Date(createdMs).toISOString(),
      lastRefreshAt: new Date(activeMs - 10 * MINUTE_MS).toISOString(),
      lastAccessIssuedAt: new Date(activeMs).toISOString(),
      lastUserActivityAt: hasActivity ? new Date(activeMs).toISOString() : null,
      idleExpiresAt: new Date(activeMs + IDLE_WINDOW_MS).toISOString(),
      absoluteExpiresAt: new Date(createdMs + ABSOLUTE_WINDOW_MS).toISOString(),
      endedAt: new Date(endedMs).toISOString(),
      endReason,
      refreshUseCount: String(3 + (index % 40)),
      accessIssueCount: String(12 + ((index * 5) % 90)),
      credentialVersion: 2 + (index % 2),
      sessionEpoch: 1,
      current: false,
    };
  });

  return [...active, ...ended];
}

let sessions: AuthSession[] = createSeedSessions();

function cloneSession(s: AuthSession): AuthSession {
  return { ...s };
}

function consumeFailNext(): void {
  if (!FAKE_SESSIONS_FAIL_NEXT) return;
  FAKE_SESSIONS_FAIL_NEXT = false;
  throw new ApiError(500, 'INTERNAL_ERROR');
}

export async function fakeListSessions(historyPage = 1): Promise<SessionList> {
  await fakeDelay();
  consumeFailNext();

  if (!Number.isInteger(historyPage) || historyPage < 1) {
    throw new ApiError(400, 'CORE_VALIDATION_FAILED', { historyPage: [Number.isInteger(historyPage) ? 'min' : 'is_int'] });
  }

  // The backend keeps the current session first among the active ones.
  const active = sessions
    .filter((s) => s.endedAt === null)
    .sort((a, b) => Number(b.current) - Number(a.current));
  const ended = sessions
    .filter((s) => s.endedAt !== null)
    .sort((a, b) => Date.parse(b.endedAt!) - Date.parse(a.endedAt!));

  const pageSize = SESSION_HISTORY_PAGE_SIZE;
  const start = (historyPage - 1) * pageSize;
  const pageEnded = ended.slice(start, start + pageSize);
  const hasMore = start + pageSize < ended.length;

  return {
    items: [...active, ...pageEnded].map(cloneSession),
    endedHistory: {
      page: historyPage,
      pageSize,
      hasMore,
    },
  };
}

export async function fakeRevokeSession(id: string): Promise<void> {
  await fakeDelay();
  consumeFailNext();

  if (!UUID_V7_RE.test(id)) {
    throw new ApiError(400, 'COMMON.VALIDATION.UUID_V7_INVALID');
  }

  const canonicalId = id.toLowerCase();
  const target = sessions.find((s) => s.id.toLowerCase() === canonicalId);
  if (!target || target.endedAt !== null) {
    return;
  }

  const now = new Date().toISOString();
  sessions = sessions.map((s) =>
    s.id.toLowerCase() === canonicalId ? { ...s, endedAt: now, endReason: 'DEVICE_REVOKED', current: false } : s,
  );
}

export async function fakeLogoutAll(): Promise<void> {
  await fakeDelay();
  consumeFailNext();

  const now = new Date().toISOString();
  sessions = sessions.map((s) =>
    s.endedAt === null ? { ...s, endedAt: now, endReason: 'LOGOUT_ALL', current: false } : s,
  );
}
