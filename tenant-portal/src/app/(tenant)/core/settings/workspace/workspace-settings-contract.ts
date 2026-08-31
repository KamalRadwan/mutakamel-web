import type { CorePath } from "@/lib/api/envelope";
import { isNonEmptyString, isTimestamp, isUuidV7, record } from "../../core-validation";

export const WORKSPACE_SETTINGS_PATH: CorePath = "/api/tenant/core/v1/workspace-settings";

/**
 * `LanguageEnum` — shared-libs/packages/i18n/src/enums/language.enum.ts.
 * `WorkspaceSettingsService.assertValidLanguage` rejects anything else with a
 * 422 `LANGUAGE_INVALID`.
 */
export const WORKSPACE_LANGUAGES = ["en", "ar"] as const;

/** `UpdateWorkspaceSettingsDto` column bounds. */
export const CURRENCY_CODE_LENGTH = 3;
export const TIMEZONE_MAX_LENGTH = 48;

/** `WorkspaceSettingsService` throws these; each needs its own message. */
export const TENANT_NOT_READY_CODE = "TENANT_NOT_READY";
export const CURRENCY_NOT_ENABLED_CODE = "CURRENCY_NOT_ENABLED";
export const TIMEZONE_INVALID_CODE = "TIMEZONE_INVALID";
export const LANGUAGE_INVALID_CODE = "LANGUAGE_INVALID";

export interface WorkspaceSettings {
  id: string;
  defaultLanguage: string;
  defaultCurrencyCode: string | null;
  timezone: string;
  allowSupport: boolean;
  updatedAt: string;
}

export interface WorkspaceSettingsDraft {
  defaultLanguage: string;
  defaultCurrencyCode: string;
  timezone: string;
  allowSupport: boolean;
}

/** `UpdateWorkspaceSettingsDto` — every field optional, unknown keys rejected. */
export interface UpdateWorkspaceSettingsRequest {
  defaultLanguage?: string;
  defaultCurrencyCode?: string;
  timezone?: string;
  allowSupport?: boolean;
}

export function toWorkspaceSettingsDraft(settings: WorkspaceSettings): WorkspaceSettingsDraft {
  return {
    defaultLanguage: settings.defaultLanguage,
    defaultCurrencyCode: settings.defaultCurrencyCode ?? "",
    timezone: settings.timezone,
    allowSupport: settings.allowSupport,
  };
}

/**
 * Sends only what actually changed. The server rejects unknown keys
 * (`forbidNonWhitelisted`) and treats every present key as an intent to write,
 * so echoing unchanged values back would take a lock and bump `updatedAt` for
 * nothing.
 */
export function buildWorkspaceSettingsRequest(
  current: WorkspaceSettings,
  draft: WorkspaceSettingsDraft,
): UpdateWorkspaceSettingsRequest {
  const request: UpdateWorkspaceSettingsRequest = {};
  const language = draft.defaultLanguage.trim().toLowerCase();
  const currency = draft.defaultCurrencyCode.trim().toUpperCase();
  const timezone = draft.timezone.trim();

  if (language !== current.defaultLanguage) request.defaultLanguage = language;
  if (currency !== (current.defaultCurrencyCode ?? "") && currency !== "") {
    request.defaultCurrencyCode = currency;
  }
  if (timezone !== current.timezone) request.timezone = timezone;
  if (draft.allowSupport !== current.allowSupport) request.allowSupport = draft.allowSupport;
  return request;
}

export function isWorkspaceSettingsDraftValid(draft: WorkspaceSettingsDraft): boolean {
  const currency = draft.defaultCurrencyCode.trim();
  const timezone = draft.timezone.trim();
  return (
    timezone.length > 0 &&
    timezone.length <= TIMEZONE_MAX_LENGTH &&
    (currency.length === 0 || currency.length === CURRENCY_CODE_LENGTH)
  );
}

export function parseWorkspaceSettingsResponse(payload: unknown): WorkspaceSettings {
  const settings = record(payload);
  if (
    !settings ||
    !isUuidV7(settings.id) ||
    !isNonEmptyString(settings.defaultLanguage, 8) ||
    !isNonEmptyString(settings.timezone, TIMEZONE_MAX_LENGTH) ||
    typeof settings.allowSupport !== "boolean" ||
    !isTimestamp(settings.updatedAt) ||
    !isNullableCurrencyCode(settings.defaultCurrencyCode)
  ) {
    invalidResponse();
  }

  return {
    id: settings.id,
    defaultLanguage: settings.defaultLanguage,
    // The column is nullable and TypeORM omits an undefined property, so both
    // absent and null mean "no workspace default currency".
    defaultCurrencyCode: (settings.defaultCurrencyCode as string | null | undefined) ?? null,
    timezone: settings.timezone,
    allowSupport: settings.allowSupport,
    updatedAt: settings.updatedAt,
  };
}

function isNullableCurrencyCode(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.length === CURRENCY_CODE_LENGTH)
  );
}

/** `Intl.supportedValuesOf` is what the server itself validates against. */
export function supportedTimezones(): string[] {
  const supportedValuesOf = (
    Intl as typeof Intl & { supportedValuesOf?: (key: "timeZone") => string[] }
  ).supportedValuesOf;
  try {
    return supportedValuesOf?.("timeZone") ?? [];
  } catch {
    return [];
  }
}

function invalidResponse(): never {
  throw new Error("Invalid Core workspace-settings response.");
}
