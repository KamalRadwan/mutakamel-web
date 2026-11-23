import { inject } from '@angular/core';
import { CoreHttp } from '../api/core-http';
import { runInCrm } from '../../features/crm/shared/crm-runtime';
import {
  CallLogRecord,
  CreateCallLogInput,
  ListCallLogsQuery,
  ListCallLogsResponse,
  PhoneLookupResponse,
  PhoneMe,
} from './phone.model';

export type {
  CallLog,
  CallLogRecord,
  CallLogType,
  CallSourceType,
  CreateCallLogInput,
  ListCallLogsQuery,
  ListCallLogsResponse,
  PhoneLookupMatch,
  PhoneLookupResponse,
  PhoneMe,
  PhoneServer,
} from './phone.model';
export { toCallLogTypeParam } from './phone.model';

const PHONE_PATH = '/api/tenant/webphone/v1/me';

// Resolve through the existing application injector so shell and CRM callers share CoreHttp.
function phoneHttp(): CoreHttp {
  return runInCrm(() => inject(CoreHttp));
}

/** GET /api/tenant/webphone/v1/me (Cache-Control: no-store); returns `reason` (NO_EXTENSION | DISABLED | NO_SERVER | OVER_CAPACITY) when disabled, with no SIP or TURN secret. */
export async function getMe(): Promise<PhoneMe> {
  return phoneHttp().read<PhoneMe>(PHONE_PATH);
}

/** GET /api/tenant/webphone/v1/me/call-logs?page&limit&type=A,B&from&to&q -> `{ data, meta }` — always send `page` (without it the server returns a legacy bare array of 50); `limit` is 1..100 (default 20); `type` is one comma list (no other filter key: unknown keys are rejected); `q` matches phone digits or display name. */
export async function listCallLogs(query: ListCallLogsQuery = {}): Promise<ListCallLogsResponse> {
  // This nested page is not a Core full-page envelope. Omitting page selects a legacy array.
  return phoneHttp().read<ListCallLogsResponse>(`${PHONE_PATH}/call-logs`, {
    page: query.page ?? 1,
    limit: query.limit,
    type: query.type,
    from: query.from,
    to: query.to,
    q: query.q,
  });
}

/** POST /api/tenant/webphone/v1/me/call-logs -> 201 with the raw stored row (no `ownerName`; `phoneDigits` may be absent), or `null` when storage failed; never retried, no idempotency key; 422 on validation. */
export async function createCallLog(body: CreateCallLogInput): Promise<CallLogRecord | null> {
  // Append-only event: no idempotency key, retry, queue or replay.
  return (await phoneHttp().write<CallLogRecord | null>('POST', `${PHONE_PATH}/call-logs`, body)).data;
}

/** GET /api/tenant/crm/v1/phone-lookup?number= -> `{ match: { type: LEAD | CUSTOMER_PROFILE | PARTY, id, name } | null, count }`; `count` stops at 2, and fewer than 6 digits returns 0. */
export async function lookupNumber(number: string): Promise<PhoneLookupResponse> {
  return phoneHttp().read<PhoneLookupResponse>('/api/tenant/crm/v1/phone-lookup', { number }, { bare: true });
}
