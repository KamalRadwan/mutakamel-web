export interface RealtimeFatalAlertConfig {
  configured: boolean;
  enabled: boolean;
  revision: number | null;
  webhookUrl: string | null;
  webhookTokenConfigured: boolean;
  timeoutMs: number;
  updatedAt: string | null;
}

export interface FatalAlertFormState {
  enabled: boolean;
  webhookUrl: string;
  timeoutMs: string;
}

export interface PatchRealtimeFatalAlertConfigDto {
  enabled?: boolean;
  webhookUrl?: string;
  webhookToken?: string;
  timeoutMs?: number;
}

export type FatalAlertField = keyof FatalAlertFormState | "webhookToken";
export type FatalAlertValidationErrors = Partial<Record<FatalAlertField, string>>;

export interface CoreSnapshot<T> {
  data: T;
  correlationId: string;
  timestamp: string;
}

const CONFIG_KEYS = [
  "configured",
  "enabled",
  "revision",
  "webhookUrl",
  "webhookTokenConfigured",
  "timeoutMs",
  "updatedAt",
] as const;

export function formFromConfig(
  config: RealtimeFatalAlertConfig,
): FatalAlertFormState {
  return {
    enabled: config.enabled,
    webhookUrl: config.webhookUrl ?? "",
    timeoutMs: String(config.timeoutMs),
  };
}

export function isFatalAlertFormDirty(
  form: FatalAlertFormState,
  token: string,
  current: RealtimeFatalAlertConfig,
): boolean {
  return (
    token.length > 0 ||
    JSON.stringify(form) !== JSON.stringify(formFromConfig(current))
  );
}

export function buildFatalAlertPatch(
  form: FatalAlertFormState,
  token: string,
  current: RealtimeFatalAlertConfig,
): {
  dto: PatchRealtimeFatalAlertConfigDto;
  errors: FatalAlertValidationErrors;
} {
  const errors: FatalAlertValidationErrors = {};
  const webhookUrl = form.webhookUrl.trim();
  const webhookToken = token.trim();
  const timeoutMs = Number(form.timeoutMs);
  const intendsConfiguration =
    form.enabled || current.configured || webhookUrl.length > 0 || webhookToken.length > 0;

  if (intendsConfiguration && !validWebhookUrl(webhookUrl)) {
    errors.webhookUrl = "INVALID_WEBHOOK_URL";
  }
  if (!current.webhookTokenConfigured && intendsConfiguration && !webhookToken) {
    errors.webhookToken = "TOKEN_REQUIRED";
  } else if (utf8ByteLength(webhookToken) > 2048) {
    errors.webhookToken = "TOKEN_TOO_LONG";
  }
  if (
    !/^\d{1,6}$/u.test(form.timeoutMs) ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 120_000
  ) {
    errors.timeoutMs = "INVALID_TIMEOUT";
  }
  if (Object.keys(errors).length) return { dto: {}, errors };

  const dto: PatchRealtimeFatalAlertConfigDto = {};
  if (form.enabled !== current.enabled) dto.enabled = form.enabled;
  if (webhookUrl && webhookUrl !== current.webhookUrl) dto.webhookUrl = webhookUrl;
  if (webhookToken) dto.webhookToken = webhookToken;
  if (timeoutMs !== current.timeoutMs) dto.timeoutMs = timeoutMs;
  return { dto, errors };
}

export function readFatalAlertConfigEnvelope(
  payload: unknown,
): CoreSnapshot<RealtimeFatalAlertConfig> {
  const envelope = record(payload);
  if (
    !envelope ||
    envelope.success !== true ||
    !boundedString(envelope.correlationId, 200) ||
    !validIsoDate(envelope.timestamp)
  ) {
    invalidResponse();
  }
  return {
    data: readConfig(envelope.data),
    correlationId: envelope.correlationId as string,
    timestamp: envelope.timestamp as string,
  };
}

function readConfig(value: unknown): RealtimeFatalAlertConfig {
  const config = record(value);
  if (
    !config ||
    Object.keys(config).length !== CONFIG_KEYS.length ||
    Object.keys(config).some(
      (key) => !CONFIG_KEYS.includes(key as (typeof CONFIG_KEYS)[number]),
    ) ||
    typeof config.configured !== "boolean" ||
    typeof config.enabled !== "boolean" ||
    !nullablePositiveInteger(config.revision) ||
    !(config.webhookUrl === null || validWebhookUrl(config.webhookUrl)) ||
    typeof config.webhookTokenConfigured !== "boolean" ||
    !Number.isSafeInteger(config.timeoutMs) ||
    Number(config.timeoutMs) < 1 ||
    Number(config.timeoutMs) > 120_000 ||
    !(config.updatedAt === null || validIsoDate(config.updatedAt))
  ) {
    invalidResponse();
  }
  const result = config as unknown as RealtimeFatalAlertConfig;
  if (
    result.configured !== Boolean(result.webhookUrl && result.webhookTokenConfigured) ||
    (result.enabled && !result.configured) ||
    (result.revision === null) !== (result.updatedAt === null)
  ) {
    invalidResponse();
  }
  return result;
}

function validWebhookUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 1 || value.length > 2048) {
    return false;
  }
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function nullablePositiveInteger(value: unknown): boolean {
  return value === null || (Number.isSafeInteger(value) && Number(value) >= 1);
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function boundedString(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum;
}

function validIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function invalidResponse(): never {
  throw new Error("INVALID_FATAL_ALERT_CONFIG_RESPONSE");
}
