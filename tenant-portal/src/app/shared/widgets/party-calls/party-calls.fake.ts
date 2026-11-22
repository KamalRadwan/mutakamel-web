import { PhoneApiError } from '../../../core/phone/phone.model';
import { CallLogType } from '../call-log/call-log.model';
import {
  ListPartyCallsQuery,
  ListPartyCallsResponse,
  PartyCall,
  PartyCallLinkKind,
  PartyCallPartyType,
  PartyCallsSummary,
  PartyCallsSummaryQuery,
} from './party-calls.model';

export type FakePartyCallsMode = 'normal' | 'empty' | 'notFound' | 'error';

const DEFAULT_DELAY_MS = 300;
const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const SEEDED_LEAD_ID = 'lead-001';

let delayMs = DEFAULT_DELAY_MS;
let fakeMode: FakePartyCallsMode = 'normal';

const SEEDED_OWNERS: readonly { id: string; name: string }[] = [
  { id: 'u1', name: 'Kamal Radwan' },
  { id: 'u2', name: 'Mona Adel' },
  { id: 'u3', name: 'Omar Fathy' },
];

const SEEDED_CALL_TYPES: readonly Exclude<CallLogType, 'OUT'>[] = [
  'IN_ANS',
  'OUT_ANS',
  'IN_NOANS',
  'OUT_NOANS',
  'IN_BUSY',
  'OUT_BUSY',
];

const SEEDED_CONTACTS: readonly {
  displayName: string;
  phoneNumber: string;
  linkKind: PartyCallLinkKind;
}[] = [
  { displayName: 'Nile Logistics', phoneNumber: '+202210000000', linkKind: 'SOURCE' },
  { displayName: 'Ahmed Hassan', phoneNumber: '+201010000000', linkKind: 'SOURCE' },
  { displayName: 'Salma Adel', phoneNumber: '+201110007919', linkKind: 'NUMBER_MATCH' },
  { displayName: 'Mostafa Kamal', phoneNumber: '+201110015838', linkKind: 'NUMBER_MATCH' },
];

function buildSeededLeadCalls(): PartyCall[] {
  const now = Date.now();
  return Array.from({ length: 30 }, (_, index): PartyCall => {
    const contact = SEEDED_CONTACTS[index % SEEDED_CONTACTS.length];
    const owner = SEEDED_OWNERS[index % SEEDED_OWNERS.length];
    const type = SEEDED_CALL_TYPES[index % SEEDED_CALL_TYPES.length];
    const answered = type === 'IN_ANS' || type === 'OUT_ANS';

    let offsetMs: number;
    if (index < 4) {
      offsetMs = (index + 1) * 35 * MINUTE_MS;
    } else if (index < 8) {
      offsetMs = DAY_MS + (index - 3) * 50 * MINUTE_MS;
    } else {
      const dayOffset = 2 + Math.floor(((index - 8) / 22) * 28);
      offsetMs = dayOffset * DAY_MS + ((index * 41) % 540) * MINUTE_MS;
    }

    const startedMs = now - offsetMs;
    const durationSeconds = answered ? 42 + ((index * 53) % 380) : null;
    const answeredMs = answered ? startedMs + 4_000 : null;
    const endedMs =
      answeredMs !== null && durationSeconds !== null ? answeredMs + durationSeconds * 1000 : startedMs + 20_000;

    return {
      id: `party-call-${String(30 - index).padStart(4, '0')}`,
      callLogId: `call-log-${String(30 - index).padStart(4, '0')}`,
      type,
      phoneNumber: contact.phoneNumber,
      displayName: contact.displayName,
      startedAt: new Date(startedMs).toISOString(),
      answeredAt: answeredMs !== null ? new Date(answeredMs).toISOString() : null,
      endedAt: new Date(endedMs).toISOString(),
      durationSeconds,
      linkKind: contact.linkKind,
      ownerUserId: owner.id,
      ownerName: owner.name,
      transferKind: answered && index === 5 ? 'BLIND' : answered && index === 11 ? 'ATTENDED' : null,
      conferenceId: answered && index === 14 ? 'conf-001' : null,
    };
  });
}

let seededLeadCalls: PartyCall[] = buildSeededLeadCalls();

function delay(): Promise<void> {
  if (delayMs <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Dev/test switch to adjust fake party-call API delay (set 0 in unit tests). */
export function setFakePartyCallsDelay(ms: number): void {
  delayMs = Math.max(0, ms);
}

/** Dev/test switch to simulate party-call states (`normal`, `empty`, `notFound`, `error`). */
export function setFakePartyCallsMode(mode: FakePartyCallsMode): void {
  fakeMode = mode;
}

/** Resets fake party-call module state to defaults (intended for unit tests). */
export function resetPartyCallsFake(): void {
  delayMs = DEFAULT_DELAY_MS;
  fakeMode = 'normal';
  seededLeadCalls = buildSeededLeadCalls();
}

function callsForParty(partyType: PartyCallPartyType, partyId: string): PartyCall[] {
  if (fakeMode === 'notFound' || partyId === 'lead-404') {
    throw new PhoneApiError(404, 'NOT_FOUND');
  }
  if (fakeMode === 'error') {
    throw new PhoneApiError(500, 'SERVER_ERROR');
  }
  if (fakeMode === 'empty') {
    return [];
  }
  if (partyType === 'LEAD' && partyId === SEEDED_LEAD_ID) {
    return seededLeadCalls;
  }
  return [];
}

export async function fakeListPartyCalls(query: ListPartyCallsQuery): Promise<ListPartyCallsResponse> {
  await delay();
  const fromMs = parseDateBound(query.from, false);
  const toMs = parseDateBound(query.to, true);
  if (fromMs !== null && toMs !== null && fromMs > toMs) {
    throw new PhoneApiError(400, 'VALIDATION_ERROR');
  }

  const page = Math.max(1, query.page ?? 1);
  const limit = Math.max(1, Math.min(100, query.limit ?? 20));
  const source = callsForParty(query.partyType, query.partyId);

  const typeList = query.type ? query.type.split(',').filter(Boolean) : [];
  const typeSet = typeList.length > 0 ? new Set<string>(typeList) : null;
  const rawSearch = query.q?.trim() ?? '';
  const lowerSearch = rawSearch.toLowerCase();
  const searchDigits = rawSearch.replace(/\D/g, '');
  const isDigitOnlySearch = rawSearch.length > 0 && searchDigits.length > 0 && !/\p{L}/u.test(rawSearch);

  const filtered = source.filter((entry) => {
    if (typeSet && !typeSet.has(entry.type)) return false;

    if (fromMs !== null || toMs !== null) {
      if (!entry.startedAt) return false;
      const entryTime = Date.parse(entry.startedAt);
      if (Number.isNaN(entryTime)) return false;
      if (fromMs !== null && entryTime < fromMs) return false;
      if (toMs !== null && entryTime > toMs) return false;
    }

    if (rawSearch) {
      if (isDigitOnlySearch) {
        if (!entry.phoneNumber.replace(/\D/g, '').includes(searchDigits)) return false;
      } else if (!(entry.displayName?.toLowerCase().includes(lowerSearch) ?? false)) {
        return false;
      }
    }

    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const ta = a.startedAt ? Date.parse(a.startedAt) : Number.NEGATIVE_INFINITY;
    const tb = b.startedAt ? Date.parse(b.startedAt) : Number.NEGATIVE_INFINITY;
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

export async function fakeGetPartyCallsSummary(query: PartyCallsSummaryQuery): Promise<PartyCallsSummary> {
  await delay();
  const source = callsForParty(query.partyType, query.partyId);
  let missed = 0;
  let lastCallAt: string | null = null;
  let lastMs = Number.NEGATIVE_INFINITY;

  for (const call of source) {
    if (call.type === 'IN_NOANS') {
      missed += 1;
    }
    if (call.startedAt) {
      const ms = Date.parse(call.startedAt);
      if (!Number.isNaN(ms) && ms > lastMs) {
        lastMs = ms;
        lastCallAt = call.startedAt;
      }
    }
  }

  return {
    total: source.length,
    missed,
    lastCallAt,
  };
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
