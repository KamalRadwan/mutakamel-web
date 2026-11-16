import type { Dictionary } from "@/i18n/dictionaries/ar";
import type { CorePath } from "@/lib/api/envelope";
import { formatTemplate } from "@/lib/format/template";
import { isNonEmptyString, isTimestamp, isUuidV7, record } from "../../core-validation";
import type { CurrencyOption } from "./currency-options";
import { WorkspaceInvalidResponseError } from "./workspace-errors";

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

export const WORKSPACE_TRACKED_FIELDS = [
  "defaultLanguage",
  "defaultCurrencyCode",
  "timezone",
  "allowSupport",
] as const;

type WorkspaceTrackedField = (typeof WORKSPACE_TRACKED_FIELDS)[number];

export interface WorkspaceSettings {
  id: string;
  defaultLanguage: string;
  defaultCurrencyCode: string | null;
  timezone: string;
  allowSupport: boolean;
  createdAt?: string;
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
    ...(isTimestamp(settings.createdAt) ? { createdAt: settings.createdAt } : {}),
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

export function getWorkspaceFieldLabel(field: WorkspaceTrackedField, t: Dictionary): string {
  switch (field) {
    case "defaultLanguage":
      return t.coreSettings.workspaceLanguage;
    case "defaultCurrencyCode":
      return t.coreSettings.workspaceCurrency;
    case "timezone":
      return t.coreSettings.workspaceTimezone;
    case "allowSupport":
      return t.coreSettings.workspaceAllowSupport;
  }
}

export function formatWorkspaceFieldValue(
  field: WorkspaceTrackedField,
  value: string | boolean | null | undefined,
  t: Dictionary,
  currencyOptions: readonly CurrencyOption[] = [],
): string {
  if (value === null || value === undefined || value === "") {
    return t.audit.valueEmpty;
  }

  if (field === "allowSupport" || typeof value === "boolean") {
    return Boolean(value) ? t.crmShared.booleanYes : t.crmShared.booleanNo;
  }

  if (field === "defaultLanguage") {
    const code = String(value).trim().toLowerCase();
    if (code === "en") return t.coreSettings.languageNames.en;
    if (code === "ar") return t.coreSettings.languageNames.ar;
    return formatTemplate(t.common.unknownCode, { code: String(value) });
  }

  if (field === "defaultCurrencyCode") {
    const code = String(value).trim().toUpperCase();
    if (!code) return t.audit.valueEmpty;
    const matched = currencyOptions.find((item) => item.code === code);
    return matched ? `${matched.code} — ${matched.name}` : code;
  }

  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : t.audit.valueEmpty;
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

/**
 * Formats an explicit `UTC±HH:MM` label for a named IANA timezone using an
 * explicit deterministic `Intl` locale. Returns `null` if the zone is invalid.
 */
export function formatTimezoneOffset(
  timeZone: string,
  locale: string,
  now: Date = new Date(),
): string | null {
  const trimmed = timeZone.trim();
  if (!trimmed || /^[+-]/u.test(trimmed)) return null;
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone: trimmed,
      timeZoneName: "longOffset",
    }).formatToParts(now);
    const offsetPart = parts.find((part) => part.type === "timeZoneName")?.value;
    if (!offsetPart) return "UTC+00:00";
    const normalized = offsetPart.replace(/^GMT/u, "UTC");
    return normalized === "UTC" ? "UTC+00:00" : normalized;
  } catch {
    return null;
  }
}

/**
 * Formats the localized descriptive name of an IANA timezone (for example,
 * `"Eastern European Standard Time"` or `"Arabia Standard Time"`).
 */
export function formatTimezoneLongName(
  timeZone: string,
  locale: string,
  now: Date = new Date(),
): string | null {
  const trimmed = timeZone.trim();
  if (!trimmed || /^[+-]/u.test(trimmed)) return null;
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone: trimmed,
      timeZoneName: "long",
    }).formatToParts(now);
    return parts.find((part) => part.type === "timeZoneName")?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Formats a live local clock readout in the target IANA timezone (`HH:MM:SS (UTC±HH:MM)`).
 */
export function formatTimezoneLiveClock(
  timeZone: string,
  locale: string,
  now: Date = new Date(),
): string | null {
  const trimmed = timeZone.trim();
  if (!trimmed || /^[+-]/u.test(trimmed)) return null;
  try {
    const timeText = new Intl.DateTimeFormat(locale, {
      timeZone: trimmed,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).format(now);
    const offset = formatTimezoneOffset(trimmed, locale, now);
    return offset ? `${timeText} (${offset})` : timeText;
  } catch {
    return null;
  }
}

function invalidResponse(): never {
  throw new WorkspaceInvalidResponseError("Invalid Core workspace-settings response.");
}
