import { readCorePage, writeCoreData } from "@/lib/api/envelope";
import {
  CORE_LIST_RESPONSE_LIMIT_BYTES,
  CORE_WRITE_RESPONSE_LIMIT_BYTES,
  buildCoreListQuery,
  parseCorePage,
  type CorePage,
} from "../contracts/core-page";
import {
  RELATIONSHIPS_PATH,
  addressPath,
  contactMethodPath,
  parsePartyAddress,
  parsePartyContact,
  parsePartyContactMethod,
  parsePartyRole,
  partyAddressesPath,
  partyContactMethodsPath,
  partyContactsPath,
  partyRolePath,
  partyRolesPath,
  relationshipPath,
  type PartyAddress,
  type PartyContact,
  type PartyContactMethod,
  type PartyRole,
} from "./directory-children-contract";

const WRITE_CONFIG = { maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES };

// The child writes. Kept apart from the response contract so neither file has
// to hold both — docs/architecture/file-architecture.md#cleanliness-rules.

export async function createContactMethod(
  partyId: string,
  body: Record<string, unknown>,
): Promise<PartyContactMethod> {
  return parsePartyContactMethod(
    await writeCoreData("post", partyContactMethodsPath(partyId), body, WRITE_CONFIG),
  );
}

export async function updateContactMethod(
  methodId: string,
  body: Record<string, unknown>,
): Promise<PartyContactMethod> {
  return parsePartyContactMethod(
    await writeCoreData("patch", contactMethodPath(methodId), body, WRITE_CONFIG),
  );
}

export async function deleteContactMethod(methodId: string): Promise<void> {
  await writeCoreData("delete", contactMethodPath(methodId), undefined, WRITE_CONFIG);
}

export async function createAddress(
  partyId: string,
  body: Record<string, unknown>,
): Promise<PartyAddress> {
  return parsePartyAddress(
    await writeCoreData("post", partyAddressesPath(partyId), body, WRITE_CONFIG),
  );
}

export async function updateAddress(
  addressId: string,
  body: Record<string, unknown>,
): Promise<PartyAddress> {
  return parsePartyAddress(
    await writeCoreData("patch", addressPath(addressId), body, WRITE_CONFIG),
  );
}

export async function deleteAddress(addressId: string): Promise<void> {
  await writeCoreData("delete", addressPath(addressId), undefined, WRITE_CONFIG);
}

export async function createPartyRole(
  partyId: string,
  body: Record<string, unknown>,
): Promise<PartyRole> {
  return parsePartyRole(
    await writeCoreData("post", partyRolesPath(partyId), body, WRITE_CONFIG),
  );
}

/** Roles are removed through `party-roles/:roleId`, not `parties/:id/roles/:roleId`. */
export async function deletePartyRole(roleId: string): Promise<void> {
  await writeCoreData("delete", partyRolePath(roleId), undefined, WRITE_CONFIG);
}

export async function createRelationship(body: Record<string, unknown>): Promise<void> {
  await writeCoreData("post", RELATIONSHIPS_PATH, body, WRITE_CONFIG);
}

export async function deleteRelationship(relationshipId: string): Promise<void> {
  await writeCoreData("delete", relationshipPath(relationshipId), undefined, WRITE_CONFIG);
}

/** `GET /parties/:id/contacts` takes no filters — only pagination. */
export async function fetchPartyContacts(options: {
  partyId: string;
  page: number;
  signal?: AbortSignal;
}): Promise<CorePage<PartyContact>> {
  const envelope = await readCorePage(
    partyContactsPath(options.partyId),
    buildCoreListQuery({ page: options.page, search: "", sortBy: "createdAt", sortDir: "DESC" }),
    {
      signal: options.signal,
      cache: "no-store",
      maxResponseBytes: CORE_LIST_RESPONSE_LIMIT_BYTES,
    },
  );
  return parseCorePage(envelope, parsePartyContact);
}
