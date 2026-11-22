import {
  fakeCreateExtension,
  fakeGetExtensionByOwner,
  fakeGetExtensionServers,
  fakeGetPhoneSeats,
  fakeListPhoneServers,
  fakeListUserCallLogs,
  fakePutExtensionServers,
  fakeUpdateExtension,
} from './staff-phone.fake';
import {
  CreateStaffPhoneExtensionBody,
  ListUserCallLogsQuery,
  ListUserCallLogsResponse,
  PhoneSeats,
  PutStaffPhoneServersBody,
  StaffPhoneChainLink,
  StaffPhoneExtension,
  StaffPhoneServer,
  UpdateStaffPhoneExtensionPatch,
} from './staff-phone.model';

export { toCallLogTypeParam } from './staff-phone.model';

// Real browser base: /api/tenant/webphone/v1. Core wraps every 2xx response as `{ success, data, ... }`;
// a central unwrap (Phase 5 Core HTTP adapter) strips it and each function returns what it leaves: the `data`
// part, except the paged GET users/:userId/call-logs, which gives `{ data, meta }`.

export function getExtensionByOwner(ownerId: string): Promise<StaffPhoneExtension> {
  // GET /api/tenant/webphone/v1/extensions/by-owner/:ownerId [webphone.extensions.read]
  return fakeGetExtensionByOwner(ownerId);
}

export function createExtension(
  body: CreateStaffPhoneExtensionBody,
  key: string,
): Promise<StaffPhoneExtension> {
  // POST /api/tenant/webphone/v1/extensions (x-idempotency-key) [webphone.extensions.manage]
  return fakeCreateExtension(body, key);
}

export function updateExtension(
  id: string,
  patch: UpdateStaffPhoneExtensionPatch,
  key: string,
): Promise<StaffPhoneExtension> {
  // PATCH /api/tenant/webphone/v1/extensions/:id (x-idempotency-key) [webphone.extensions.manage]
  return fakeUpdateExtension(id, patch, key);
}

export function getExtensionServers(id: string): Promise<StaffPhoneChainLink[]> {
  // GET /api/tenant/webphone/v1/extensions/:id/servers [webphone.extensions.read]
  return fakeGetExtensionServers(id);
}

export function putExtensionServers(
  id: string,
  body: PutStaffPhoneServersBody,
  key: string,
): Promise<StaffPhoneChainLink[]> {
  // PUT /api/tenant/webphone/v1/extensions/:id/servers (x-idempotency-key) [webphone.extensions.manage]
  return fakePutExtensionServers(id, body, key);
}

export function listPhoneServers(): Promise<StaffPhoneServer[]> {
  // GET /api/tenant/webphone/v1/servers [webphone.settings.read]
  return fakeListPhoneServers();
}

export function getPhoneSeats(): Promise<PhoneSeats> {
  // GET /api/tenant/webphone/v1/seats [webphone.settings.read]
  return fakeGetPhoneSeats();
}

export function listUserCallLogs(
  userId: string,
  query: ListUserCallLogsQuery = {},
): Promise<ListUserCallLogsResponse> {
  // GET /api/tenant/webphone/v1/users/:userId/call-logs?page&limit&type=A,B&from&to&q -> { data, meta } [webphone.call_logs.read] (always paged; page defaults to 1; `type` is one comma list, unknown keys are rejected; every view is audited as WEBPHONE_CALL_LOGS_VIEWED)
  return fakeListUserCallLogs(userId, query);
}
