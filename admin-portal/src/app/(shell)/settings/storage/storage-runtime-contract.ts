interface StorageRuntimeConfig {
  enabled: boolean;
  configured: boolean;
  brokerConfigured: boolean;
  updatedAt: string | null;
}

export interface PatchStorageRuntimeConfigDto {
  enabled?: boolean;
  rotateKey?: true;
}

export interface CoreStorageRuntimeSnapshot {
  data: StorageRuntimeConfig;
  correlationId: string;
  timestamp: string;
}

const CONFIG_KEYS = [
  "enabled",
  "configured",
  "brokerConfigured",
  "updatedAt",
] as const;

export function readStorageRuntimeConfigEnvelope(
  payload: unknown,
): CoreStorageRuntimeSnapshot {
  const envelope = plainRecord(payload);
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

function readConfig(value: unknown): StorageRuntimeConfig {
  const config = plainRecord(value);
  if (
    !config ||
    Object.keys(config).length !== CONFIG_KEYS.length ||
    Object.keys(config).some(
      (key) => !CONFIG_KEYS.includes(key as (typeof CONFIG_KEYS)[number]),
    ) ||
    typeof config.enabled !== "boolean" ||
    typeof config.configured !== "boolean" ||
    typeof config.brokerConfigured !== "boolean" ||
    !(config.updatedAt === null || validIsoDate(config.updatedAt))
  ) {
    invalidResponse();
  }

  const result = config as unknown as StorageRuntimeConfig;
  if (result.enabled && !result.configured) invalidResponse();
  return result;
}

function plainRecord(value: unknown): Record<string, unknown> | null {
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

function invalidResponse(): never {
  throw new Error("INVALID_STORAGE_RUNTIME_CONFIG_RESPONSE");
}
