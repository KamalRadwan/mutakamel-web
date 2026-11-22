import {
  fakeCreateIceServer,
  fakeCreatePhoneServer,
  fakeDeleteIceServer,
  fakeDeletePhoneServer,
  fakeGetPhoneConfig,
  fakeGetPhoneSeats,
  fakeListPhoneServers,
  fakeReorderPhoneServers,
  fakeUpdateIceServer,
  fakeUpdatePhoneServer,
} from './phone-servers.fake';
import {
  CreateIceEntryBody,
  CreatePhoneServerBody,
  IceEntry,
  PhoneConfig,
  PhoneSeats,
  PhoneServer,
  UpdateIceEntryPatch,
  UpdatePhoneServerPatch,
} from './phone-servers.model';

// Real browser base: /api/tenant/webphone/v1. Core returns bare bodies (no `{ data }` envelope): each function returns the body as-is.

export function getPhoneConfig(): Promise<PhoneConfig> {
  // GET /api/tenant/webphone/v1/config [webphone.settings.read]
  return fakeGetPhoneConfig();
}

export function getPhoneSeats(): Promise<PhoneSeats> {
  // GET /api/tenant/webphone/v1/seats [webphone.settings.read]
  return fakeGetPhoneSeats();
}

export function listPhoneServers(): Promise<PhoneServer[]> {
  // GET /api/tenant/webphone/v1/servers [webphone.settings.read]
  return fakeListPhoneServers();
}

export function createPhoneServer(
  body: CreatePhoneServerBody,
  key: string,
): Promise<PhoneServer> {
  // POST /api/tenant/webphone/v1/servers (x-idempotency-key) [webphone.settings.update]
  return fakeCreatePhoneServer(body, key);
}

export function updatePhoneServer(
  id: string,
  patch: UpdatePhoneServerPatch,
  key: string,
): Promise<PhoneServer> {
  // PATCH /api/tenant/webphone/v1/servers/:id (x-idempotency-key) [webphone.settings.update]
  return fakeUpdatePhoneServer(id, patch, key);
}

export function reorderPhoneServers(ids: string[], key: string): Promise<PhoneServer[]> {
  // PUT /api/tenant/webphone/v1/servers/order (x-idempotency-key) [webphone.settings.update]
  return fakeReorderPhoneServers(ids, key);
}

export function deletePhoneServer(id: string, key: string): Promise<void> {
  // DELETE /api/tenant/webphone/v1/servers/:id (x-idempotency-key) [webphone.settings.update]
  return fakeDeletePhoneServer(id, key);
}

export function createIceServer(
  serverId: string,
  body: CreateIceEntryBody,
  key: string,
): Promise<IceEntry> {
  // POST /api/tenant/webphone/v1/servers/:serverId/ice-servers (x-idempotency-key) [webphone.settings.update]
  return fakeCreateIceServer(serverId, body, key);
}

export function updateIceServer(
  serverId: string,
  iceId: string,
  patch: UpdateIceEntryPatch,
  key: string,
): Promise<IceEntry> {
  // PATCH /api/tenant/webphone/v1/servers/:serverId/ice-servers/:id (x-idempotency-key) [webphone.settings.update]
  return fakeUpdateIceServer(serverId, iceId, patch, key);
}

export function deleteIceServer(
  serverId: string,
  iceId: string,
  key: string,
): Promise<void> {
  // DELETE /api/tenant/webphone/v1/servers/:serverId/ice-servers/:id (x-idempotency-key) [webphone.settings.update]
  return fakeDeleteIceServer(serverId, iceId, key);
}
