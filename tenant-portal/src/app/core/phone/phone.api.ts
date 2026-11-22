import {
  fakeCreateCallLog,
  fakeGetMe,
  fakeListCallLogs,
  fakeLookupNumber,
} from './phone.fake';
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

// Core wraps every 2xx response as `{ success, data, ... }`; a central unwrap (Phase 5 Core HTTP adapter) strips it.
// Each function returns what that unwrap leaves: paged call-log lists give `{ data, meta }`, everything else the `data` part.

/** GET /api/tenant/webphone/v1/me (Cache-Control: no-store); returns `reason` (NO_EXTENSION | DISABLED | NO_SERVER | OVER_CAPACITY) when disabled, with no SIP or TURN secret. */
export function getMe(): Promise<PhoneMe> {
  return fakeGetMe();
}

/** GET /api/tenant/webphone/v1/me/call-logs?page&limit&type=A,B&from&to&q -> `{ data, meta }` — always send `page` (without it the server returns a legacy bare array of 50); `limit` is 1..100 (default 20); `type` is one comma list (no other filter key: unknown keys are rejected); `q` matches phone digits or display name. */
export function listCallLogs(query: ListCallLogsQuery = {}): Promise<ListCallLogsResponse> {
  return fakeListCallLogs(query);
}

/** POST /api/tenant/webphone/v1/me/call-logs -> 201 with the raw stored row (no `ownerName`; `phoneDigits` may be absent), or `null` when storage failed; never retried, no idempotency key; 422 on validation. */
export function createCallLog(body: CreateCallLogInput): Promise<CallLogRecord | null> {
  return fakeCreateCallLog(body);
}

/** GET /api/tenant/crm/v1/phone-lookup?number= -> `{ match: { type: LEAD | CUSTOMER_PROFILE | PARTY, id, name } | null, count }`; `count` stops at 2, and fewer than 6 digits returns 0. */
export function lookupNumber(number: string): Promise<PhoneLookupResponse> {
  return fakeLookupNumber(number);
}
