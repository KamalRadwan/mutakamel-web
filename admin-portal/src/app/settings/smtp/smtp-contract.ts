export type PlatformSmtpProtocol = "smtp" | "smtps";
export type SmtpHistoryValue = string | number | boolean | null;

export interface PlatformSmtpConfig {
  configured: boolean;
  revision: number | null;
  fromAddress: string | null;
  fromName: string | null;
  senderDomain: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  smtpProtocol: PlatformSmtpProtocol | null;
  smtpUsername: string | null;
  smtpPasswordConfigured: boolean;
  updatedAt: string | null;
}

export interface SmtpFormState {
  fromAddress: string;
  fromName: string;
  senderDomain: string;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean | null;
  smtpProtocol: PlatformSmtpProtocol | null;
  smtpUsername: string;
}

export interface SmtpAuditChange {
  field: string;
  label: string;
  previousValue: SmtpHistoryValue;
  newValue: SmtpHistoryValue;
}

export interface SmtpAuditLog {
  id: string;
  action: "CONFIGURED" | "UPDATED" | "CONNECTION_VERIFIED";
  revision: number | null;
  actor: string;
  changes: SmtpAuditChange[];
  createdAt: string;
}

export interface PatchPlatformSmtpConfigDto {
  fromAddress?: string;
  fromName?: string;
  senderDomain?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpProtocol?: PlatformSmtpProtocol;
  smtpUsername?: string;
  smtpPassword?: string;
}

export type SmtpField = keyof SmtpFormState | "smtpPassword";
export type SmtpValidationErrors = Partial<Record<SmtpField, string>>;

export interface CoreSnapshot<T> {
  data: T;
  correlationId: string;
  timestamp: string;
}

export const SMTP_ALLOWED_PORTS = [25, 465, 587, 2525] as const;
const CONFIG_KEYS = [
  "configured",
  "revision",
  "fromAddress",
  "fromName",
  "senderDomain",
  "smtpHost",
  "smtpPort",
  "smtpSecure",
  "smtpProtocol",
  "smtpUsername",
  "smtpPasswordConfigured",
  "updatedAt",
] as const;
const AUDIT_FIELDS = new Set([
  "fromAddress",
  "fromName",
  "senderDomain",
  "smtpHost",
  "smtpPort",
  "smtpSecure",
  "smtpProtocol",
  "smtpUsername",
  "smtpPassword",
]);
const DOMAIN_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function formFromSmtpConfig(config: PlatformSmtpConfig): SmtpFormState {
  return {
    fromAddress: config.fromAddress ?? "",
    fromName: config.fromName ?? "",
    senderDomain: config.senderDomain ?? "",
    smtpHost: config.smtpHost ?? "",
    smtpPort: config.smtpPort === null ? "" : String(config.smtpPort),
    smtpSecure: config.smtpSecure,
    smtpProtocol: config.smtpProtocol,
    smtpUsername: config.smtpUsername ?? "",
  };
}

export function validateSmtpForm(
  form: SmtpFormState,
  password: string,
  configured: boolean,
): SmtpValidationErrors {
  const errors: SmtpValidationErrors = {};
  const fromAddress = form.fromAddress.trim().toLowerCase();
  const fromName = form.fromName.trim();
  const senderDomain = form.senderDomain.trim().toLowerCase();
  const smtpHost = form.smtpHost.trim().toLowerCase();
  const smtpUsername = form.smtpUsername.trim();

  if (!fromAddress || fromAddress.length > 320 || !validEmail(fromAddress)) {
    errors.fromAddress = "INVALID_EMAIL";
  }
  if (!fromName || fromName.length > 200 || /[\r\n]/u.test(fromName)) {
    errors.fromName = "INVALID_FROM_NAME";
  }
  if (senderDomain.length > 253 || !validDomain(senderDomain)) {
    errors.senderDomain = "INVALID_DOMAIN";
  }
  if (smtpHost.length > 253 || !validDomain(smtpHost)) {
    errors.smtpHost = "INVALID_DOMAIN";
  }
  if (!/^\d{1,5}$/u.test(form.smtpPort)) {
    errors.smtpPort = "INVALID_PORT";
  }
  const port = Number(form.smtpPort);
  if (!SMTP_ALLOWED_PORTS.includes(port as (typeof SMTP_ALLOWED_PORTS)[number])) {
    errors.smtpPort = "UNSUPPORTED_PORT";
  }
  if (form.smtpSecure === null) errors.smtpSecure = "SECURITY_REQUIRED";
  if (form.smtpProtocol !== "smtp" && form.smtpProtocol !== "smtps") {
    errors.smtpProtocol = "PROTOCOL_REQUIRED";
  }
  if (!smtpUsername || smtpUsername.length > 320) {
    errors.smtpUsername = "INVALID_USERNAME";
  }
  if ((!configured && !password) || password.length > 1024) {
    errors.smtpPassword = configured ? "PASSWORD_TOO_LONG" : "PASSWORD_REQUIRED";
  }
  if (form.smtpProtocol === "smtps" && form.smtpSecure !== true) {
    errors.smtpProtocol = "SMTPS_REQUIRES_SECURE";
    errors.smtpSecure = "SMTPS_REQUIRES_SECURE";
  }
  if (
    port === 465 &&
    (form.smtpProtocol !== "smtps" || form.smtpSecure !== true)
  ) {
    errors.smtpPort = "PORT_465_REQUIRES_SMTPS";
    errors.smtpProtocol = "PORT_465_REQUIRES_SMTPS";
    errors.smtpSecure = "PORT_465_REQUIRES_SMTPS";
  }
  return errors;
}

export function buildSmtpPatch(
  form: SmtpFormState,
  password: string,
  current: PlatformSmtpConfig,
): { dto: PatchPlatformSmtpConfigDto; errors: SmtpValidationErrors } {
  const errors = validateSmtpForm(form, password, current.configured);
  if (Object.keys(errors).length) return { dto: {}, errors };
  const normalized = {
    fromAddress: form.fromAddress.trim().toLowerCase(),
    fromName: form.fromName.trim(),
    senderDomain: form.senderDomain.trim().toLowerCase(),
    smtpHost: form.smtpHost.trim().toLowerCase(),
    smtpPort: Number(form.smtpPort),
    smtpSecure: form.smtpSecure as boolean,
    smtpProtocol: form.smtpProtocol as PlatformSmtpProtocol,
    smtpUsername: form.smtpUsername.trim(),
  };
  const dto: PatchPlatformSmtpConfigDto = {};
  for (const field of Object.keys(normalized) as Array<keyof typeof normalized>) {
    if (!current.configured || normalized[field] !== current[field]) {
      assignPatchValue(dto, field, normalized[field]);
    }
  }
  if (password) dto.smtpPassword = password;
  return { dto, errors };
}

export function isSmtpFormDirty(
  form: SmtpFormState,
  password: string,
  current: PlatformSmtpConfig,
): boolean {
  return (
    password.length > 0 ||
    JSON.stringify(form) !== JSON.stringify(formFromSmtpConfig(current))
  );
}

export function readSmtpConfigEnvelope(payload: unknown): CoreSnapshot<PlatformSmtpConfig> {
  return readEnvelope(payload, readSmtpConfig);
}

export function readSmtpAuditEnvelope(payload: unknown): CoreSnapshot<SmtpAuditLog[]> {
  return readEnvelope(payload, (value) => {
    if (!Array.isArray(value) || value.length > 25) invalidResponse();
    return value.map(readAuditLog);
  });
}

export function readSmtpVerificationEnvelope(payload: unknown): CoreSnapshot<{ verified: true }> {
  return readEnvelope(payload, (value) => {
    const result = record(value);
    if (!result || result.verified !== true) invalidResponse();
    return { verified: true };
  });
}

function readSmtpConfig(value: unknown): PlatformSmtpConfig {
  const config = record(value);
  if (!config || Object.keys(config).some((key) => !CONFIG_KEYS.includes(key as (typeof CONFIG_KEYS)[number]))) {
    invalidResponse();
  }
  if (
    typeof config.configured !== "boolean" ||
    typeof config.smtpPasswordConfigured !== "boolean" ||
    !nullableInteger(config.revision) ||
    !nullableString(config.fromAddress, 320) ||
    !nullableString(config.fromName, 200) ||
    !nullableString(config.senderDomain, 253) ||
    !nullableString(config.smtpHost, 253) ||
    !nullableInteger(config.smtpPort) ||
    !(config.smtpSecure === null || typeof config.smtpSecure === "boolean") ||
    !(config.smtpProtocol === null || config.smtpProtocol === "smtp" || config.smtpProtocol === "smtps") ||
    !nullableString(config.smtpUsername, 320) ||
    !nullableIsoDate(config.updatedAt)
  ) {
    invalidResponse();
  }
  const result = config as unknown as PlatformSmtpConfig;
  if (!result.configured) {
    if (
      result.revision !== null ||
      result.fromAddress !== null ||
      result.fromName !== null ||
      result.senderDomain !== null ||
      result.smtpHost !== null ||
      result.smtpPort !== null ||
      result.smtpSecure !== null ||
      result.smtpProtocol !== null ||
      result.smtpUsername !== null ||
      result.smtpPasswordConfigured ||
      result.updatedAt !== null
    ) {
      invalidResponse();
    }
    return result;
  }
  if (
    result.revision === null || result.revision < 1 ||
    result.fromAddress === null || !validEmail(result.fromAddress) ||
    result.fromName === null || !result.fromName ||
    result.senderDomain === null || !validDomain(result.senderDomain) ||
    result.smtpHost === null || !validDomain(result.smtpHost) ||
    result.smtpPort === null || !SMTP_ALLOWED_PORTS.includes(result.smtpPort as (typeof SMTP_ALLOWED_PORTS)[number]) ||
    result.smtpSecure === null ||
    result.smtpProtocol === null ||
    result.smtpUsername === null || !result.smtpUsername ||
    !result.smtpPasswordConfigured ||
    result.updatedAt === null ||
    (result.smtpProtocol === "smtps" && result.smtpSecure !== true) ||
    (result.smtpPort === 465 && (result.smtpProtocol !== "smtps" || result.smtpSecure !== true))
  ) {
    invalidResponse();
  }
  return result;
}

function readAuditLog(value: unknown): SmtpAuditLog {
  const log = record(value);
  if (
    !log ||
    !boundedString(log.id, 200) ||
    !["CONFIGURED", "UPDATED", "CONNECTION_VERIFIED"].includes(String(log.action)) ||
    !nullableInteger(log.revision) ||
    !boundedString(log.actor, 320) ||
    !Array.isArray(log.changes) ||
    log.changes.length > 20 ||
    !validIsoDate(log.createdAt)
  ) {
    invalidResponse();
  }
  return {
    id: log.id as string,
    action: log.action as SmtpAuditLog["action"],
    revision: log.revision as number | null,
    actor: log.actor as string,
    changes: log.changes.map(readAuditChange),
    createdAt: log.createdAt as string,
  };
}

function readAuditChange(value: unknown): SmtpAuditChange {
  const change = record(value);
  if (
    !change ||
    typeof change.field !== "string" ||
    !AUDIT_FIELDS.has(change.field) ||
    !boundedString(change.label, 200) ||
    !historyValue(change.previousValue) ||
    !historyValue(change.newValue)
  ) {
    invalidResponse();
  }
  if (
    change.field === "smtpPassword" &&
    ![null, "Configured", "Updated"].includes(change.previousValue as null | string)
  ) {
    invalidResponse();
  }
  if (
    change.field === "smtpPassword" &&
    ![null, "Configured", "Updated"].includes(change.newValue as null | string)
  ) {
    invalidResponse();
  }
  return change as unknown as SmtpAuditChange;
}

function readEnvelope<T>(payload: unknown, reader: (value: unknown) => T): CoreSnapshot<T> {
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
    data: reader(envelope.data),
    correlationId: envelope.correlationId as string,
    timestamp: envelope.timestamp as string,
  };
}

function assignPatchValue<K extends keyof PatchPlatformSmtpConfigDto>(
  dto: PatchPlatformSmtpConfigDto,
  key: K,
  value: NonNullable<PatchPlatformSmtpConfigDto[K]>,
): void {
  dto[key] = value;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nullableString(value: unknown, maximum: number): boolean {
  return value === null || boundedString(value, maximum);
}

function boundedString(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum;
}

function nullableInteger(value: unknown): boolean {
  return value === null || (typeof value === "number" && Number.isInteger(value));
}

function nullableIsoDate(value: unknown): boolean {
  return value === null || validIsoDate(value);
}

function validIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function historyValue(value: unknown): value is SmtpHistoryValue {
  return (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    (typeof value === "string" && value.length <= 500)
  );
}

function validEmail(value: string): boolean {
  if (!EMAIL_PATTERN.test(value)) return false;
  const at = value.lastIndexOf("@");
  return at > 0 && validDomain(value.slice(at + 1).toLowerCase());
}

function validDomain(value: string): boolean {
  return (
    DOMAIN_PATTERN.test(value) &&
    !/^\d{1,3}(?:\.\d{1,3}){3}$/u.test(value)
  );
}

function invalidResponse(): never {
  throw new Error("INVALID_SMTP_RESPONSE");
}
