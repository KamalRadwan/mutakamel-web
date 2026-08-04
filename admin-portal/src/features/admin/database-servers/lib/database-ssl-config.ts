import type {
  DatabaseServerSslConfigDto,
  DatabaseServerSslMode,
} from "../types";

export const DATABASE_SSL_MATERIAL_MAX_LENGTH = 20_000;
export const DATABASE_SSL_PASSPHRASE_MAX_LENGTH = 1_024;

export function compactDatabaseSslConfig(
  config: DatabaseServerSslConfigDto | undefined,
): DatabaseServerSslConfigDto | undefined {
  if (!config) return undefined;

  const compacted: DatabaseServerSslConfigDto = {};
  if (config.ca?.trim()) compacted.ca = config.ca.trim();
  if (config.cert?.trim()) compacted.cert = config.cert.trim();
  if (config.key?.trim()) compacted.key = config.key.trim();
  if (config.passphrase) compacted.passphrase = config.passphrase;

  return Object.keys(compacted).length > 0 ? compacted : undefined;
}

interface ValidateDatabaseSslConfigOptions {
  mode: DatabaseServerSslMode;
  config?: DatabaseServerSslConfigDto;
  hasStoredConfig?: boolean;
  removeStoredConfig?: boolean;
}

export function validateDatabaseSslConfig({
  mode,
  config,
  hasStoredConfig = false,
  removeStoredConfig = false,
}: ValidateDatabaseSslConfigOptions): string[] {
  const normalized = compactDatabaseSslConfig(config);
  const hasReplacement = Boolean(normalized);
  const errors: string[] = [];

  if (mode === "disable") {
    if (hasReplacement) {
      errors.push("Certificate files cannot be sent when SSL mode is disabled.");
    }
    return errors;
  }

  if (
    (mode === "verify-ca" || mode === "verify-full") &&
    ((!hasReplacement && (!hasStoredConfig || removeStoredConfig)) ||
      (hasReplacement && !normalized?.ca))
  ) {
    errors.push("A CA certificate is required for verify-ca and verify-full modes.");
  }

  if (Boolean(normalized?.cert) !== Boolean(normalized?.key)) {
    errors.push("The client certificate and private key must be uploaded together.");
  }

  if (normalized?.passphrase && !normalized.key) {
    errors.push("A private-key passphrase requires an uploaded private key.");
  }

  for (const [label, value] of [
    ["CA certificate", normalized?.ca],
    ["Client certificate", normalized?.cert],
    ["Private key", normalized?.key],
  ] as const) {
    if (value && value.length > DATABASE_SSL_MATERIAL_MAX_LENGTH) {
      errors.push(`${label} exceeds the 20,000 character API limit.`);
    }
  }

  if (
    normalized?.passphrase &&
    normalized.passphrase.length > DATABASE_SSL_PASSPHRASE_MAX_LENGTH
  ) {
    errors.push("Private-key passphrase exceeds the 1,024 character API limit.");
  }

  return errors;
}

export async function readDatabaseSslMaterialFile(
  file: File,
  label: string,
): Promise<string> {
  const value = await file.text();
  if (!value.trim()) {
    throw new Error(`${label} file is empty.`);
  }
  if (value.trim().length > DATABASE_SSL_MATERIAL_MAX_LENGTH) {
    throw new Error(`${label} exceeds the 20,000 character API limit.`);
  }
  return value;
}
