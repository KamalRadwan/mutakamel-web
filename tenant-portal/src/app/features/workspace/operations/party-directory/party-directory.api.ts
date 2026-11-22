import {
  fakeAddAddress,
  fakeAddContactMethod,
  fakeAddRelationship,
  fakeAddRole,
  fakeCreateParty,
  fakeDeleteAddress,
  fakeDeleteContactMethod,
  fakeDeleteParty,
  fakeDeletePartyImage,
  fakeDeleteRelationship,
  fakeDeleteRole,
  fakeGetDirectorySettings,
  fakeGetParty,
  fakeListOrgContacts,
  fakeListParties,
  fakePartyImageDataUrl,
  fakeUpdateAddress,
  fakeUpdateContactMethod,
  fakeUpdateParty,
  fakeUploadPartyImage,
} from './party-directory.fake';
import {
  CreateAddressBody,
  CreateContactMethodBody,
  CreatePartyBody,
  CreateRelationshipBody,
  CreateRoleBody,
  DirectorySettings,
  ListOrgContactsQuery,
  ListPartiesQuery,
  OrgContact,
  Page,
  PartyAddress,
  PartyContactMethod,
  PartyDetail,
  PartyListItem,
  PartyRelationship,
  PartyRole,
  UpdateAddressBody,
  UpdateContactMethodBody,
  UpdatePartyBody,
} from './party-directory.model';

// Real browser base: /api/tenant/core/v1
// Note: Directory mutations are WRITE_SENSITIVE with idempotent=false and require no x-idempotency-key header.

/** GET /api/tenant/core/v1/directory/parties (query: page, limit, sortBy, sortDir, search, partyType, status, roleType, branchId, sharedOnly, ownerUserId) */
export function listParties(q: ListPartiesQuery = {}): Promise<Page<PartyListItem>> {
  return fakeListParties(q);
}

/** GET /api/tenant/core/v1/directory/parties/:id */
export function getParty(id: string): Promise<PartyDetail> {
  return fakeGetParty(id);
}

/** POST /api/tenant/core/v1/directory/parties */
export function createParty(body: CreatePartyBody): Promise<PartyDetail> {
  return fakeCreateParty(body);
}

/** PATCH /api/tenant/core/v1/directory/parties/:id */
export function updateParty(id: string, body: UpdatePartyBody): Promise<PartyDetail> {
  return fakeUpdateParty(id, body);
}

/** DELETE /api/tenant/core/v1/directory/parties/:id */
export function deleteParty(id: string): Promise<void> {
  return fakeDeleteParty(id);
}

/** POST /api/tenant/core/v1/directory/parties/:id/image (multipart field: file) */
export function uploadPartyImage(id: string, file: File): Promise<PartyDetail> {
  return fakeUploadPartyImage(id, file);
}

/** DELETE /api/tenant/core/v1/directory/parties/:id/image */
export function deletePartyImage(id: string): Promise<void> {
  return fakeDeletePartyImage(id);
}

/** Resolves the fake in-memory SVG/uploaded data URL; returns null (placeholder) otherwise. Phase 5: map Core-relative /api/v1/tenant/directory/... to /api/tenant/core/v1/directory/.... */
export function partyImageSrc(item: { imageUrl: string | null } | null | undefined): string | null {
  const url = item?.imageUrl;
  if (!url) return null;
  const fakeUrl = fakePartyImageDataUrl(url);
  if (fakeUrl) return fakeUrl;
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  return null;
}

/** GET /api/tenant/core/v1/directory/parties/:id/contacts (query: page, limit) */
export function listOrgContacts(id: string, q: ListOrgContactsQuery = {}): Promise<Page<OrgContact>> {
  return fakeListOrgContacts(id, q);
}

/** POST /api/tenant/core/v1/directory/parties/:id/contact-methods */
export function addContactMethod(id: string, body: CreateContactMethodBody): Promise<PartyContactMethod> {
  return fakeAddContactMethod(id, body);
}

/** PATCH /api/tenant/core/v1/directory/contact-methods/:methodId */
export function updateContactMethod(methodId: string, body: UpdateContactMethodBody): Promise<PartyContactMethod> {
  return fakeUpdateContactMethod(methodId, body);
}

/** DELETE /api/tenant/core/v1/directory/contact-methods/:methodId */
export function deleteContactMethod(methodId: string): Promise<void> {
  return fakeDeleteContactMethod(methodId);
}

/** POST /api/tenant/core/v1/directory/parties/:id/addresses */
export function addAddress(id: string, body: CreateAddressBody): Promise<PartyAddress> {
  return fakeAddAddress(id, body);
}

/** PATCH /api/tenant/core/v1/directory/addresses/:addressId */
export function updateAddress(addressId: string, body: UpdateAddressBody): Promise<PartyAddress> {
  return fakeUpdateAddress(addressId, body);
}

/** DELETE /api/tenant/core/v1/directory/addresses/:addressId */
export function deleteAddress(addressId: string): Promise<void> {
  return fakeDeleteAddress(addressId);
}

/** POST /api/tenant/core/v1/directory/parties/:id/roles */
export function addRole(id: string, body: CreateRoleBody): Promise<PartyRole> {
  return fakeAddRole(id, body);
}

/** DELETE /api/tenant/core/v1/directory/party-roles/:roleId */
export function deleteRole(roleId: string): Promise<void> {
  return fakeDeleteRole(roleId);
}

/** POST /api/tenant/core/v1/directory/relationships */
export function addRelationship(body: CreateRelationshipBody): Promise<PartyRelationship> {
  return fakeAddRelationship(body);
}

/** DELETE /api/tenant/core/v1/directory/relationships/:relationshipId */
export function deleteRelationship(relationshipId: string): Promise<void> {
  return fakeDeleteRelationship(relationshipId);
}

/** GET /api/tenant/core/v1/directory/settings */
export function getDirectorySettings(): Promise<DirectorySettings> {
  return fakeGetDirectorySettings();
}
