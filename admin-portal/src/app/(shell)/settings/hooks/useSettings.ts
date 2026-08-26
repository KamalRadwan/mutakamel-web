"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient, getApiRequestOutcome } from "@/lib/api/axiosClient";
import { generateUUIDv7 } from "@/lib/utils/uuid";
import { adminCan, adminCanAll } from "@/lib/auth/rbac";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { useToast } from "@/components/ui/ToastContext";
import { isAmbiguousWriteOutcome } from "@/shared/api/write-command-recovery";
import { SETTINGS_UI_REGISTRY, type SettingUIMetadata } from "./useSettingsRegistry";

export type SystemSettingValue = string | number | boolean;
export type SettingsLoadState =
  | "LOADING"
  | "READY"
  | "FORBIDDEN"
  | "UNAVAILABLE"
  | "ERROR";

export interface MergedSystemSetting {
  key: string;
  value: SystemSettingValue;
  description: string;
  descriptionI18n: { en: string; ar: string };
  isDefault: boolean;
  readOnly: boolean;
}

export interface SettingFieldData extends MergedSystemSetting {
  uiMeta?: SettingUIMetadata;
  isSaving?: boolean;
  lastSaved?: Date | null;
  error?: string | null;
  permissionLocked?: boolean;
  isRefreshing?: boolean;
  hasPendingChange?: boolean;
}

const SETTINGS_SAVE_PERMISSIONS = [
  "admin.settings.update",
  "admin.settings.critical",
] as const;
const MIN_TOP_UP_KEY = "billing.min_topup_usd";
const MAX_TOP_UP_KEY = "billing.max_topup_usd";

interface SettingWriteIntent {
  fingerprint: string;
  idempotencyKey: string;
  ambiguous: boolean;
}

export function useSettings(prefix: string) {
  const { lang } = useI18n();
  const { user, isLoading: isAuthLoading } = useAuth();
  const toast = useToast();
  const canRead = adminCan(user, "admin.settings.read");
  const canUpdateCritical = adminCanAll(user, SETTINGS_SAVE_PERMISSIONS);
  const [settings, setSettings] = useState<SettingFieldData[]>([]);
  const [loadState, setLoadState] = useState<SettingsLoadState>("LOADING");
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [pendingChanges, setPendingChanges] = useState<
    Record<string, SystemSettingValue>
  >({});
  const [isSaving, setIsSaving] = useState(false);
  const valuesRef = useRef<Record<string, SystemSettingValue>>({});
  const serverValuesRef = useRef<Record<string, SystemSettingValue>>({});
  const pendingRef = useRef<Record<string, SystemSettingValue>>({});
  const writeIntentsRef = useRef(new Map<string, SettingWriteIntent>());
  const requestGeneration = useRef(0);

  const fetchSettings = useCallback(async () => {
    const generation = ++requestGeneration.current;
    if (isAuthLoading) {
      setLoadState("LOADING");
      return;
    }
    if (!canRead) {
      valuesRef.current = {};
      serverValuesRef.current = {};
      pendingRef.current = {};
      writeIntentsRef.current.clear();
      setSettings([]);
      setPendingChanges({});
      setLoadError(null);
      setLoadState("FORBIDDEN");
      return;
    }

    setLoadState("LOADING");
    setLoadError(null);
    try {
      const url = prefix
        ? `/api/admin/core/v1/system-settings?prefix=${encodeURIComponent(prefix)}`
        : "/api/admin/core/v1/system-settings";
      const response = await axiosClient.get<unknown>(url, { cache: "no-store" });
      if (generation !== requestGeneration.current) return;
      const data = readSettingsListEnvelope(response.data);
      const values = Object.fromEntries(data.map((item) => [item.key, item.value]));
      valuesRef.current = values;
      serverValuesRef.current = { ...values };
      pendingRef.current = {};
      writeIntentsRef.current.clear();
      setSettings(data.map((item) => toFieldData(item, canUpdateCritical)));
      setPendingChanges({});
      setLoadState("READY");
    } catch (caught) {
      if (generation !== requestGeneration.current) return;
      const normalized = normalizeApiError(caught);
      valuesRef.current = {};
      serverValuesRef.current = {};
      pendingRef.current = {};
      setSettings([]);
      setPendingChanges({});
      setLoadError(normalized);
      setLoadState(classifySettingsLoadError(normalized));
    }
  }, [canRead, canUpdateCritical, isAuthLoading, prefix]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchSettings();
    });
  }, [fetchSettings]);

  const updateSetting = useCallback(
    (key: string, newValue: SystemSettingValue) => {
      if (!canUpdateCritical) {
        throw new Error("SETTINGS_CRITICAL_PERMISSION_REQUIRED");
      }
      if (!(key in valuesRef.current)) {
        throw new Error("SETTING_NOT_LOADED");
      }
      const unresolved = writeIntentsRef.current.get(key);
      if (
        unresolved?.ambiguous &&
        unresolved.fingerprint !== settingWriteFingerprint(key, newValue)
      ) {
        throw new Error("PENDING_SETTING_WRITE_MUST_BE_RECONCILED");
      }
      validateSettingValue(key, newValue, lang);
      const candidate = { ...valuesRef.current, [key]: newValue };
      validateTopUpRange(candidate, lang);

      valuesRef.current = candidate;
      pendingRef.current = { ...pendingRef.current, [key]: newValue };
      setSettings((current) =>
        current.map((setting) =>
          setting.key === key
            ? {
                ...setting,
                value: newValue,
                error: null,
                hasPendingChange: true,
              }
            : setting,
        ),
      );
      setPendingChanges(pendingRef.current);
    },
    [canUpdateCritical, lang],
  );

  const saveAllSettings = useCallback(async () => {
    if (!canUpdateCritical) {
      throw new Error("SETTINGS_CRITICAL_PERMISSION_REQUIRED");
    }
    const pendingSnapshot = { ...pendingRef.current };
    const pendingKeys = Object.keys(pendingSnapshot);
    if (!pendingKeys.length) return;

    for (const [key, value] of Object.entries(pendingSnapshot)) {
      validateSettingValue(key, value, lang);
    }
    validateTopUpRange(
      { ...serverValuesRef.current, ...pendingSnapshot },
      lang,
    );
    const keys = orderSettingsWrites(
      pendingKeys,
      serverValuesRef.current,
      pendingSnapshot,
    );

    setIsSaving(true);
    setSettings((current) =>
      current.map((setting) =>
        keys.includes(setting.key)
          ? { ...setting, isSaving: true, error: null }
          : setting,
      ),
    );
    const failures: string[] = [];
    let topUpWriteFailed = false;

    for (const key of keys) {
      if (topUpWriteFailed && isTopUpKey(key)) {
        const message = localSettingsError(lang, "DEPENDENT_TOP_UP_WRITE_SKIPPED");
        failures.push(`${key}: ${message}`);
        setSettings((current) =>
          current.map((setting) =>
            setting.key === key
              ? { ...setting, isSaving: false, error: message }
              : setting,
          ),
        );
        continue;
      }

      const submittedValue = pendingSnapshot[key];
      const fingerprint = settingWriteFingerprint(key, submittedValue);
      const previousIntent = writeIntentsRef.current.get(key);
      if (previousIntent?.ambiguous && previousIntent.fingerprint !== fingerprint) {
        const message = localSettingsError(lang, "PENDING_SETTING_WRITE_MUST_BE_RECONCILED");
        failures.push(`${key}: ${message}`);
        setSettings((current) =>
          current.map((setting) =>
            setting.key === key
              ? { ...setting, isSaving: false, error: message }
              : setting,
          ),
        );
        continue;
      }
      const intent =
        previousIntent?.fingerprint === fingerprint
          ? previousIntent
          : {
              fingerprint,
              idempotencyKey: generateUUIDv7(),
              ambiguous: false,
            };
      writeIntentsRef.current.set(key, intent);
      try {
        const response = await axiosClient.put<unknown>(
          `/api/admin/core/v1/system-settings/${encodeURIComponent(key)}`,
          { value: submittedValue },
          {
            headers: { "x-idempotency-key": intent.idempotencyKey },
            skipAutoIdempotency: true,
            replayAfterRefresh: true,
            cache: "no-store",
          },
        );
        const authoritative = readSettingEnvelope(response.data, key);
        writeIntentsRef.current.delete(key);
        serverValuesRef.current = {
          ...serverValuesRef.current,
          [key]: authoritative.value,
        };
        if (pendingRef.current[key] === submittedValue) {
          const nextPending = { ...pendingRef.current };
          delete nextPending[key];
          pendingRef.current = nextPending;
          valuesRef.current = {
            ...valuesRef.current,
            [key]: authoritative.value,
          };
          setPendingChanges(nextPending);
          setSettings((current) =>
            current.map((setting) =>
              setting.key === key
                ? {
                    ...toFieldData(authoritative, canUpdateCritical),
                    isSaving: false,
                    lastSaved: new Date(),
                  }
                : setting,
            ),
          );
        }
      } catch (caught) {
        if (isTopUpKey(key)) topUpWriteFailed = true;
        const normalized = normalizeApiError(caught);
        if (
          getApiRequestOutcome(caught) === "settled-before-session-change" ||
          isAmbiguousWriteOutcome(normalized) ||
          /(?:UPSTREAM|UNAVAILABLE|TIMEOUT)/u.test(normalized.errorCode)
        ) {
          writeIntentsRef.current.set(key, { ...intent, ambiguous: true });
        } else {
          writeIntentsRef.current.delete(key);
        }
        const message = localSettingsError(lang, normalized.errorCode);
        failures.push(
          `${key}: ${message}${normalized.correlationId ? ` · ${normalized.correlationId}` : ""}`,
        );
        setSettings((current) =>
          current.map((setting) =>
            setting.key === key
              ? { ...setting, isSaving: false, error: message }
              : setting,
          ),
        );
      }
    }

    setIsSaving(false);
    if (failures.length) {
      toast.error(
        lang === "ar" ? "فشل الحفظ" : "Save failed",
        failures.join("\n"),
      );
      throw new Error("SETTINGS_SAVE_FAILED");
    }
    toast.success(
      lang === "ar" ? "تم الحفظ بنجاح" : "Settings saved",
      lang === "ar"
        ? "تم تحديث إعدادات النظام بنجاح."
        : "System configuration updated successfully.",
    );
  }, [canUpdateCritical, lang, toast]);

  const reloadSetting = useCallback(
    async (key: string) => {
      if (!canRead) throw new Error("SETTINGS_READ_PERMISSION_REQUIRED");
      if (pendingRef.current[key] !== undefined) {
        throw new Error("SAVE_OR_DISCARD_SETTING_CHANGE_FIRST");
      }
      setSettings((current) =>
        current.map((setting) =>
          setting.key === key
            ? { ...setting, isRefreshing: true, error: null }
            : setting,
        ),
      );
      try {
        const response = await axiosClient.get<unknown>(
          `/api/admin/core/v1/system-settings/${encodeURIComponent(key)}`,
          { cache: "no-store" },
        );
        const authoritative = readSettingEnvelope(response.data, key);
        serverValuesRef.current = {
          ...serverValuesRef.current,
          [key]: authoritative.value,
        };
        valuesRef.current = { ...valuesRef.current, [key]: authoritative.value };
        setSettings((current) =>
          current.map((setting) =>
            setting.key === key
              ? {
                  ...toFieldData(authoritative, canUpdateCritical),
                  isRefreshing: false,
                }
              : setting,
          ),
        );
      } catch (caught) {
        const normalized = normalizeApiError(caught);
        const message = localSettingsError(lang, normalized.errorCode);
        setSettings((current) =>
          current.map((setting) =>
            setting.key === key
              ? {
                  ...setting,
                  isRefreshing: false,
                  error: `${message}${normalized.correlationId ? ` · ${normalized.correlationId}` : ""}`,
                }
              : setting,
          ),
        );
        throw new Error("SETTING_RELOAD_FAILED");
      }
    },
    [canRead, canUpdateCritical, lang],
  );

  const hasUnsavedChanges = useMemo(
    () => Object.keys(pendingChanges).length > 0,
    [pendingChanges],
  );

  return {
    lang,
    settings,
    isLoading: loadState === "LOADING",
    loadState,
    isSaving,
    hasUnsavedChanges,
    loadError,
    canRead,
    canUpdateCritical,
    updateSetting,
    reloadSetting,
    saveAllSettings,
    refetch: fetchSettings,
  };
}

export function combineSettingsLoadStates(
  states: readonly SettingsLoadState[],
): SettingsLoadState {
  if (states.includes("FORBIDDEN")) return "FORBIDDEN";
  if (states.includes("UNAVAILABLE")) return "UNAVAILABLE";
  if (states.includes("ERROR")) return "ERROR";
  if (states.includes("LOADING")) return "LOADING";
  return "READY";
}

export function classifySettingsLoadError(
  error: NormalizedApiError,
): SettingsLoadState {
  if (error.httpStatus === 403) return "FORBIDDEN";
  if (error.httpStatus >= 500 || error.errorCode === "UNKNOWN_ERROR") {
    return "UNAVAILABLE";
  }
  return "ERROR";
}

export function validateTopUpRange(
  values: Readonly<Record<string, SystemSettingValue>>,
  lang: "ar" | "en",
): void {
  const minimum = values[MIN_TOP_UP_KEY];
  const maximum = values[MAX_TOP_UP_KEY];
  if (minimum === undefined || maximum === undefined) return;
  if (typeof minimum !== "number" || typeof maximum !== "number") {
    throw new Error(
      lang === "ar"
        ? "يجب أن تكون حدود الشحن أعداداً صحيحة."
        : "Wallet top-up limits must be integers.",
    );
  }
  if (minimum > maximum) {
    throw new Error(
      lang === "ar"
        ? `الحد الأدنى لا يمكن أن يكون أكبر من الحد الأقصى (${maximum}).`
        : `Minimum cannot be greater than the maximum (${maximum}).`,
    );
  }
}

export function orderSettingsWrites(
  keys: readonly string[],
  serverValues: Readonly<Record<string, SystemSettingValue>>,
  pending: Readonly<Record<string, SystemSettingValue>>,
): string[] {
  const ordinary = keys.filter((key) => !isTopUpKey(key));
  const hasMinimum = keys.includes(MIN_TOP_UP_KEY);
  const hasMaximum = keys.includes(MAX_TOP_UP_KEY);
  if (!hasMinimum && !hasMaximum) return [...keys];
  if (!hasMinimum) return [...ordinary, MAX_TOP_UP_KEY];
  if (!hasMaximum) return [...ordinary, MIN_TOP_UP_KEY];

  const serverMinimum = serverValues[MIN_TOP_UP_KEY];
  const serverMaximum = serverValues[MAX_TOP_UP_KEY];
  const targetMinimum = pending[MIN_TOP_UP_KEY];
  const targetMaximum = pending[MAX_TOP_UP_KEY];
  if (
    typeof serverMaximum === "number" &&
    typeof targetMinimum === "number" &&
    targetMinimum > serverMaximum
  ) {
    return [...ordinary, MAX_TOP_UP_KEY, MIN_TOP_UP_KEY];
  }
  if (
    typeof serverMinimum === "number" &&
    typeof targetMaximum === "number" &&
    targetMaximum < serverMinimum
  ) {
    return [...ordinary, MIN_TOP_UP_KEY, MAX_TOP_UP_KEY];
  }
  return [...ordinary, MIN_TOP_UP_KEY, MAX_TOP_UP_KEY];
}

function validateSettingValue(
  key: string,
  value: SystemSettingValue,
  lang: "ar" | "en",
): void {
  const metadata = SETTINGS_UI_REGISTRY[key];
  if (metadata?.inputType === "number") {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      throw new Error(
        lang === "ar" ? "يجب إدخال عدد صحيح." : "Enter a whole number.",
      );
    }
    if (metadata.min !== undefined && value < metadata.min) {
      throw new Error(
        lang === "ar"
          ? `يجب أن تكون القيمة على الأقل ${metadata.min}.`
          : `Value must be at least ${metadata.min}.`,
      );
    }
    if (metadata.max !== undefined && value > metadata.max) {
      throw new Error(
        lang === "ar"
          ? `يجب أن تكون القيمة على الأكثر ${metadata.max}.`
          : `Value must be at most ${metadata.max}.`,
      );
    }
  }
  if (metadata?.inputType === "boolean" && typeof value !== "boolean") {
    throw new Error(lang === "ar" ? "قيمة منطقية غير صالحة." : "Invalid boolean value.");
  }
  if (
    (metadata?.inputType === "string" || metadata?.inputType === "enum") &&
    typeof value !== "string"
  ) {
    throw new Error(lang === "ar" ? "قيمة نصية غير صالحة." : "Invalid text value.");
  }
  if (
    metadata?.inputType === "enum" &&
    metadata.options &&
    !metadata.options.some((option) => option.value === value)
  ) {
    throw new Error(lang === "ar" ? "قيمة غير صالحة." : "Invalid option selected.");
  }

  const invalidJsonArray =
    lang === "ar"
      ? "يجب إدخال مصفوفة JSON صحيحة من إعدادات RTCIceServer."
      : "Enter a valid JSON array of RTCIceServer objects.";
  const invalidJsonObject =
    lang === "ar" ? "يجب إدخال كائن JSON صحيح." : "Enter a valid JSON object.";

  if (key === "asterisk.turn_servers_json" || key === "asterisk.ice_servers_json") {
    if (typeof value !== "string" || value.length > 10_000) {
      throw new Error(invalidJsonArray);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error(invalidJsonArray);
    }
    if (!Array.isArray(parsed) || !parsed.every(isValidIceServerObject)) {
      throw new Error(invalidJsonArray);
    }
  }

  if (key === "asterisk.extra_json") {
    if (typeof value !== "string" || value.length > 10_000) {
      throw new Error(invalidJsonObject);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error(invalidJsonObject);
    }
    if (!plainRecord(parsed)) throw new Error(invalidJsonObject);
  }

  if (
    key === "asterisk.websocket_url" &&
    (typeof value !== "string" || (value !== "" && !/^wss?:\/\/\S+$/iu.test(value)))
  ) {
    throw new Error(
      lang === "ar"
        ? "رابط WebSocket يجب أن يبدأ بـ ws:// أو wss:// بدون مسافات."
        : "WebSocket URL must start with ws:// or wss:// and contain no spaces.",
    );
  }
}

function toFieldData(
  item: MergedSystemSetting,
  canUpdateCritical: boolean,
): SettingFieldData {
  const registered = SETTINGS_UI_REGISTRY[item.key];
  const label =
    item.key
      .split(".")
      .pop()
      ?.replace(/_/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase()) ?? item.key;
  const fallback: SettingUIMetadata = {
    key: item.key,
    titleEn: label,
    titleAr: label,
    inputType:
      typeof item.value === "boolean"
        ? "boolean"
        : typeof item.value === "number"
          ? "number"
          : "string",
    defaultValue: item.value,
    descEn:
      item.descriptionI18n.en || item.description || `System setting ${item.key}`,
    descAr:
      item.descriptionI18n.ar || item.description || `إعداد النظام ${item.key}`,
  };
  return {
    ...item,
    readOnly: item.readOnly || !canUpdateCritical,
    permissionLocked: !item.readOnly && !canUpdateCritical,
    uiMeta: registered ?? fallback,
    isSaving: false,
    lastSaved: null,
    error: null,
    isRefreshing: false,
    hasPendingChange: false,
  };
}

function readSettingsListEnvelope(payload: unknown): MergedSystemSetting[] {
  const envelope = plainRecord(payload);
  if (
    envelope?.success !== true ||
    typeof envelope.correlationId !== "string" ||
    !envelope.correlationId ||
    typeof envelope.timestamp !== "string" ||
    Number.isNaN(Date.parse(envelope.timestamp)) ||
    !Array.isArray(envelope.data) ||
    envelope.data.length > 100
  ) {
    throw new Error("INVALID_SETTINGS_RESPONSE");
  }
  return envelope.data.map((item) => readSetting(item));
}

function readSettingEnvelope(payload: unknown, expectedKey: string): MergedSystemSetting {
  const envelope = plainRecord(payload);
  if (
    envelope?.success !== true ||
    typeof envelope.correlationId !== "string" ||
    !envelope.correlationId ||
    typeof envelope.timestamp !== "string" ||
    Number.isNaN(Date.parse(envelope.timestamp))
  ) {
    throw new Error("INVALID_SETTINGS_RESPONSE");
  }
  const setting = readSetting(envelope.data);
  if (setting.key !== expectedKey) throw new Error("INVALID_SETTINGS_RESPONSE");
  return setting;
}

function readSetting(value: unknown): MergedSystemSetting {
  const item = plainRecord(value);
  const descriptions = plainRecord(item?.descriptionI18n);
  if (
    !item ||
    typeof item.key !== "string" ||
    !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/u.test(item.key) ||
    !isSettingValue(item.value) ||
    typeof item.description !== "string" ||
    !descriptions ||
    typeof descriptions.en !== "string" ||
    typeof descriptions.ar !== "string" ||
    typeof item.isDefault !== "boolean" ||
    typeof item.readOnly !== "boolean"
  ) {
    throw new Error("INVALID_SETTINGS_RESPONSE");
  }
  return {
    key: item.key,
    value: item.value,
    description: item.description,
    descriptionI18n: { en: descriptions.en, ar: descriptions.ar },
    isDefault: item.isDefault,
    readOnly: item.readOnly,
  };
}

function isSettingValue(value: unknown): value is SystemSettingValue {
  return (
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function isTopUpKey(key: string): boolean {
  return key === MIN_TOP_UP_KEY || key === MAX_TOP_UP_KEY;
}

function isValidIceServerObject(value: unknown): boolean {
  const record = plainRecord(value);
  if (!record) return false;
  if (typeof record.urls === "string") return Boolean(record.urls.trim());
  return (
    Array.isArray(record.urls) &&
    record.urls.length > 0 &&
    record.urls.every(
      (url) => typeof url === "string" && Boolean(url.trim()),
    )
  );
}

function plainRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function settingWriteFingerprint(
  key: string,
  value: SystemSettingValue,
): string {
  return JSON.stringify({
    method: "PUT",
    path: `/api/admin/core/v1/system-settings/${encodeURIComponent(key)}`,
    body: { value },
  });
}

function localSettingsError(lang: "ar" | "en", code: string): string {
  if (code === "PENDING_SETTING_WRITE_MUST_BE_RECONCILED") {
    return lang === "ar"
      ? "يوجد حفظ سابق لم تُحسم نتيجته. أعد إرسال القيمة الأصلية نفسها قبل تعديلها."
      : "A previous save has an unresolved outcome. Retry the exact original value before changing it.";
  }
  if (code === "DEPENDENT_TOP_UP_WRITE_SKIPPED") {
    return lang === "ar"
      ? "لم تُرسل القيمة التابعة لأن كتابة حد الشحن الأول لم تنجح."
      : "The dependent value was not sent because the first top-up limit write failed.";
  }
  return lang === "ar"
    ? `تعذر حفظ هذا الإعداد بأمان. رمز الخطأ: ${code}`
    : `This setting could not be saved safely. Error code: ${code}`;
}
