import { readCoreData, writeCoreData } from "@/lib/api/envelope";
import type { CorePath } from "@/lib/api/envelope";
import {
  CORE_DETAIL_RESPONSE_LIMIT_BYTES,
  CORE_WRITE_RESPONSE_LIMIT_BYTES,
  invalidCoreResponse,
  isMember,
  record,
  requiredBoolean,
} from "../../contracts/core-page";

// Duplicate prevention is a **setting**, not a constant: a create that fails on
// a duplicate is a configured outcome, and the screen that configures it is
// this one. Source: core-app/src/tenant/directory/dto/directory-settings.dto.ts.

const DIRECTORY_SETTINGS_PATH =
  "/api/tenant/core/v1/directory/settings" as CorePath;

/** packages/common/src/enums/directory-duplicate-scope.enum.ts. */
export const DUPLICATE_SCOPES = ["TENANT", "BRANCH", "PARTY_ROLE"] as const;
type DuplicateScope = (typeof DUPLICATE_SCOPES)[number];

/** `UpdateDirectorySettingsDto` bounds. */
const MAX_CONTACT_METHODS_PER_PARTY = 200;
const MAX_ADDRESSES_PER_PARTY = 200;
const MAX_PARTY_CACHE_TTL_SECONDS = 86_400;

export interface DirectorySettings {
  duplicateScope: DuplicateScope;
  preventDuplicateEmail: boolean;
  preventDuplicatePhone: boolean;
  preventDuplicateWhatsapp: boolean;
  maxContactMethodsPerParty: number;
  maxAddressesPerParty: number;
  partyCacheTtlSeconds: number;
}

export interface DirectorySettingsFormValues {
  duplicateScope: DuplicateScope;
  preventDuplicateEmail: boolean;
  preventDuplicatePhone: boolean;
  preventDuplicateWhatsapp: boolean;
  maxContactMethodsPerParty: string;
  maxAddressesPerParty: string;
  partyCacheTtlSeconds: string;
}

export function toDirectorySettingsForm(
  settings: DirectorySettings,
): DirectorySettingsFormValues {
  return {
    duplicateScope: settings.duplicateScope,
    preventDuplicateEmail: settings.preventDuplicateEmail,
    preventDuplicatePhone: settings.preventDuplicatePhone,
    preventDuplicateWhatsapp: settings.preventDuplicateWhatsapp,
    maxContactMethodsPerParty: String(settings.maxContactMethodsPerParty),
    maxAddressesPerParty: String(settings.maxAddressesPerParty),
    partyCacheTtlSeconds: String(settings.partyCacheTtlSeconds),
  };
}

function boundedInteger(source: Record<string, unknown>, key: string, min: number, max: number): number {
  const value = source[key];
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    invalidCoreResponse();
  }
  return value as number;
}

function parseDirectorySettings(payload: unknown): DirectorySettings {
  const settings = record(payload);
  if (!settings || !isMember(DUPLICATE_SCOPES, settings.duplicateScope)) invalidCoreResponse();
  return {
    duplicateScope: settings.duplicateScope,
    preventDuplicateEmail: requiredBoolean(settings, "preventDuplicateEmail"),
    preventDuplicatePhone: requiredBoolean(settings, "preventDuplicatePhone"),
    preventDuplicateWhatsapp: requiredBoolean(settings, "preventDuplicateWhatsapp"),
    maxContactMethodsPerParty: boundedInteger(
      settings,
      "maxContactMethodsPerParty",
      1,
      MAX_CONTACT_METHODS_PER_PARTY,
    ),
    maxAddressesPerParty: boundedInteger(
      settings,
      "maxAddressesPerParty",
      1,
      MAX_ADDRESSES_PER_PARTY,
    ),
    partyCacheTtlSeconds: boundedInteger(
      settings,
      "partyCacheTtlSeconds",
      0,
      MAX_PARTY_CACHE_TTL_SECONDS,
    ),
  };
}

function formInteger(raw: string, min: number, max: number, failure: string): number {
  const trimmed = raw.trim();
  if (!/^\d{1,6}$/u.test(trimmed)) throw new Error(failure);
  const parsed = Number(trimmed);
  if (parsed < min || parsed > max) throw new Error(failure);
  return parsed;
}

/** Only the fields that actually moved — the DTO is entirely optional. */
export function buildDirectorySettingsRequest(
  current: DirectorySettings,
  values: DirectorySettingsFormValues,
): Record<string, unknown> {
  const request: Record<string, unknown> = {};
  if (values.duplicateScope !== current.duplicateScope) {
    request.duplicateScope = values.duplicateScope;
  }
  if (values.preventDuplicateEmail !== current.preventDuplicateEmail) {
    request.preventDuplicateEmail = values.preventDuplicateEmail;
  }
  if (values.preventDuplicatePhone !== current.preventDuplicatePhone) {
    request.preventDuplicatePhone = values.preventDuplicatePhone;
  }
  if (values.preventDuplicateWhatsapp !== current.preventDuplicateWhatsapp) {
    request.preventDuplicateWhatsapp = values.preventDuplicateWhatsapp;
  }
  const contacts = formInteger(
    values.maxContactMethodsPerParty,
    1,
    MAX_CONTACT_METHODS_PER_PARTY,
    "DIRECTORY_SETTINGS_FORM_CONTACTS",
  );
  if (contacts !== current.maxContactMethodsPerParty) request.maxContactMethodsPerParty = contacts;
  const addresses = formInteger(
    values.maxAddressesPerParty,
    1,
    MAX_ADDRESSES_PER_PARTY,
    "DIRECTORY_SETTINGS_FORM_ADDRESSES",
  );
  if (addresses !== current.maxAddressesPerParty) request.maxAddressesPerParty = addresses;
  const ttl = formInteger(
    values.partyCacheTtlSeconds,
    0,
    MAX_PARTY_CACHE_TTL_SECONDS,
    "DIRECTORY_SETTINGS_FORM_TTL",
  );
  if (ttl !== current.partyCacheTtlSeconds) request.partyCacheTtlSeconds = ttl;
  return request;
}

export async function fetchDirectorySettings(
  signal?: AbortSignal,
): Promise<DirectorySettings> {
  return parseDirectorySettings(
    await readCoreData(DIRECTORY_SETTINGS_PATH, {
      signal,
      cache: "no-store",
      maxResponseBytes: CORE_DETAIL_RESPONSE_LIMIT_BYTES,
    }),
  );
}

export async function saveDirectorySettings(
  body: Record<string, unknown>,
): Promise<DirectorySettings> {
  return parseDirectorySettings(
    await writeCoreData("patch", DIRECTORY_SETTINGS_PATH, body, {
      maxResponseBytes: CORE_WRITE_RESPONSE_LIMIT_BYTES,
    }),
  );
}
