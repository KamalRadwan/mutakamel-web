import type { CorePath } from "@/lib/api/envelope";
import {
  invalidCoreResponse,
  isMember,
  nullableText,
  nullableUuidV7,
  record,
  requiredText,
  requiredTimestamp,
  requiredUuidV7,
} from "../contracts/core-page";
import {
  parsePartyAddress,
  parsePartyContactMethod,
  parsePartyRole,
  type PartyAddress,
  type PartyContactMethod,
  type PartyRole,
} from "./directory-children-contract";

// The party is Core's master record for a person or an organization; CRM's
// customers and Trade's commercial accounts are projections of it.
//
// Source: core-app/src/tenant/directory/directory.controller.ts and
// dto/party.dto.ts. Five independent permissions cover one screen — see
// docs/api/core-directory.md#directory--21-routes.

// Each route is written as its own complete literal rather than assembled from
// a shared prefix: `scripts/docs/verify-called-routes.mjs` matches the literals
// in source against the Gateway contract, and a bare `/directory` prefix is not
// a route.
export const PARTIES_PATH = "/api/tenant/core/v1/directory/parties";

export const PARTY_READ_PERMISSION = "directory.party.read";
export const PARTY_MANAGE_PERMISSION = "directory.party.manage";
export const CONTACT_MANAGE_PERMISSION = "directory.contact.manage";
export const ADDRESS_MANAGE_PERMISSION = "directory.address.manage";
export const ROLE_MANAGE_PERMISSION = "directory.role.manage";
export const RELATIONSHIP_MANAGE_PERMISSION = "directory.relationship.manage";
/** There is no `directory.settings.read` — the GET uses `.manage` too. */
export const DIRECTORY_SETTINGS_PERMISSION = "directory.settings.manage";

/** packages/common/src/enums/party-type.enum.ts. */
export const PARTY_TYPES = ["PERSON", "ORGANIZATION"] as const;
/** packages/common/src/enums/party-status.enum.ts. */
export const PARTY_STATUSES = ["ACTIVE", "INACTIVE", "BLOCKED"] as const;

type PartyType = (typeof PARTY_TYPES)[number];
export type PartyStatus = (typeof PARTY_STATUSES)[number];

/** `CreatePartyDto` / `UpdatePartyDto` column bounds. */
export const PARTY_DISPLAY_NAME_MAX = 200;
export const PARTY_LEGAL_NAME_MAX = 240;
export const PARTY_PERSON_NAME_MAX = 120;
export const PARTY_HONORIFIC_MAX = 40;
export const PARTY_ORGANIZATION_NAME_MAX = 200;
export const PARTY_REGISTRATION_MAX = 80;

/** `PARTY_SORT_FIELDS` — DirectoryService only accepts these three. */
export const PARTY_SORT_FIELDS = ["displayName", "createdAt", "updatedAt"] as const;
export type PartySortField = (typeof PARTY_SORT_FIELDS)[number];

/** `DirectoryService` and `DirectoryController` rejections. */
export const PARTY_DUPLICATE_CONTACT_METHOD_CODE = "PARTY_DUPLICATE_CONTACT_METHOD";
export const PARTY_IMAGE_REQUIRED_CODE = "PARTY_IMAGE_REQUIRED";
export const PARTY_IMAGE_INVALID_CODE = "PARTY_IMAGE_INVALID";
export const PARTY_IMAGE_TOO_LARGE_CODE = "PARTY_IMAGE_TOO_LARGE";

export interface Party {
  id: string;
  partyType: PartyType;
  displayName: string;
  legalName: string | null;
  firstName: string | null;
  lastName: string | null;
  honorificTitle: string | null;
  organizationName: string | null;
  taxNumber: string | null;
  commercialRegistrationNumber: string | null;
  branchId: string | null;
  ownerUserId: string | null;
  status: PartyStatus;
  /**
   * `toPartyView` also emits an `imageUrl`, but it is the **upstream**
   * `/api/v1/...` path. Browser calls use canonical Gateway paths only
   * (AGENTS.md), so the revision is kept and the URL is rebuilt here.
   */
  imageRevision: string | null;
  imageKind: "LOGO" | "PHOTO";
  createdAt: string;
  updatedAt: string;
  roles: PartyRole[];
  contactMethods: PartyContactMethod[];
  addresses: PartyAddress[];
}

export interface PartyFilters {
  partyType?: PartyType;
  status?: PartyStatus;
  roleType?: string;
  branchId?: string;
  ownerUserId?: string;
}

export interface PartyFormValues {
  partyType: PartyType;
  displayName: string;
  legalName: string;
  firstName: string;
  lastName: string;
  honorificTitle: string;
  organizationName: string;
  taxNumber: string;
  commercialRegistrationNumber: string;
}

export const EMPTY_PARTY_FORM: PartyFormValues = {
  partyType: "ORGANIZATION",
  displayName: "",
  legalName: "",
  firstName: "",
  lastName: "",
  honorificTitle: "",
  organizationName: "",
  taxNumber: "",
  commercialRegistrationNumber: "",
};

export function toPartyForm(party: Party): PartyFormValues {
  return {
    partyType: party.partyType,
    displayName: party.displayName,
    legalName: party.legalName ?? "",
    firstName: party.firstName ?? "",
    lastName: party.lastName ?? "",
    honorificTitle: party.honorificTitle ?? "",
    organizationName: party.organizationName ?? "",
    taxNumber: party.taxNumber ?? "",
    commercialRegistrationNumber: party.commercialRegistrationNumber ?? "",
  };
}

/** A path parameter is never interpolated unhecked — the id shape is asserted first. */
function assertPartyId(id: string): string {
  if (!/^[0-9a-f-]{36}$/iu.test(id)) invalidCoreResponse();
  return encodeURIComponent(id);
}

export function partyPath(id: string): CorePath {
  return `/api/tenant/core/v1/directory/parties/${assertPartyId(id)}`;
}

export function partyImageRoute(id: string): CorePath {
  return `/api/tenant/core/v1/directory/parties/${assertPartyId(id)}/image`;
}

/** `GET /parties/:id/image` is `private, no-store`; the revision busts the tag cache. */
export function partyImageSrc(party: Party): string {
  return `${partyImageRoute(party.id)}?v=${encodeURIComponent(party.imageRevision ?? "0")}`;
}

function optionalString(values: Record<string, string>, key: string): string | undefined {
  const value = values[key]?.trim();
  return value ? value : undefined;
}

/**
 * `CreatePartyDto`. The nested `roles`/`contactMethods`/`addresses` arrays are
 * deliberately not sent: each child has its own route with its own permission,
 * and a create form that silently wrote addresses would bypass
 * `directory.address.manage`.
 */
export function buildCreatePartyRequest(values: PartyFormValues): Record<string, unknown> {
  const displayName = values.displayName.trim();
  if (displayName.length === 0 || displayName.length > PARTY_DISPLAY_NAME_MAX) {
    throw new Error("PARTY_FORM_DISPLAY_NAME");
  }
  const scalars = values as unknown as Record<string, string>;
  return {
    partyType: values.partyType,
    displayName,
    ...pick(scalars, "legalName", "firstName", "lastName", "honorificTitle"),
    ...pick(scalars, "organizationName", "taxNumber", "commercialRegistrationNumber"),
  };
}

/** `UpdatePartyDto` — no `partyType`, and `status` is only settable here. */
export function buildUpdatePartyRequest(
  current: Party,
  values: PartyFormValues,
  status: PartyStatus,
): Record<string, unknown> {
  const displayName = values.displayName.trim();
  if (displayName.length === 0 || displayName.length > PARTY_DISPLAY_NAME_MAX) {
    throw new Error("PARTY_FORM_DISPLAY_NAME");
  }
  const request: Record<string, unknown> = {};
  if (displayName !== current.displayName) request.displayName = displayName;
  const scalars = values as unknown as Record<string, string>;
  for (const key of [
    "legalName",
    "firstName",
    "lastName",
    "honorificTitle",
    "organizationName",
    "taxNumber",
    "commercialRegistrationNumber",
  ] as const) {
    const next = scalars[key]?.trim() ?? "";
    if (next !== (current[key] ?? "")) request[key] = next;
  }
  if (status !== current.status) request.status = status;
  return request;
}

function pick(
  values: Record<string, string>,
  ...keys: string[]
): Record<string, string> {
  const picked: Record<string, string> = {};
  for (const key of keys) {
    const value = optionalString(values, key);
    if (value !== undefined) picked[key] = value;
  }
  return picked;
}

function parseChildren<T>(
  source: Record<string, unknown>,
  key: string,
  parseItem: (value: unknown) => T,
): T[] {
  const value = source[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) invalidCoreResponse();
  return value.map(parseItem);
}

export function parseParty(payload: unknown): Party {
  const party = record(payload);
  if (
    !party ||
    !isMember(PARTY_TYPES, party.partyType) ||
    !isMember(PARTY_STATUSES, party.status)
  ) {
    invalidCoreResponse();
  }
  const imageRevision = nullableText(party, "imageRevision", 40);
  return {
    id: requiredUuidV7(party, "id"),
    partyType: party.partyType,
    displayName: requiredText(party, "displayName", PARTY_DISPLAY_NAME_MAX),
    legalName: nullableText(party, "legalName", PARTY_LEGAL_NAME_MAX),
    firstName: nullableText(party, "firstName", PARTY_PERSON_NAME_MAX),
    lastName: nullableText(party, "lastName", PARTY_PERSON_NAME_MAX),
    honorificTitle: nullableText(party, "honorificTitle", PARTY_HONORIFIC_MAX),
    organizationName: nullableText(party, "organizationName", PARTY_ORGANIZATION_NAME_MAX),
    taxNumber: nullableText(party, "taxNumber", PARTY_REGISTRATION_MAX),
    commercialRegistrationNumber: nullableText(
      party,
      "commercialRegistrationNumber",
      PARTY_REGISTRATION_MAX,
    ),
    branchId: nullableUuidV7(party, "branchId"),
    ownerUserId: nullableUuidV7(party, "ownerUserId"),
    status: party.status,
    imageRevision,
    imageKind: party.partyType === "ORGANIZATION" ? "LOGO" : "PHOTO",
    createdAt: requiredTimestamp(party, "createdAt"),
    updatedAt: requiredTimestamp(party, "updatedAt"),
    roles: parseChildren(party, "roles", parsePartyRole),
    contactMethods: parseChildren(party, "contactMethods", parsePartyContactMethod),
    addresses: parseChildren(party, "addresses", parsePartyAddress),
  };
}

/** `MAX_SIZE_BYTES[BUCKETS.AVATARS]` — the controller rejects anything larger with 413. */
export const PARTY_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
/** `ALLOWED_MIME[BUCKETS.AVATARS]`, and the extension must match the type. */
export const PARTY_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
