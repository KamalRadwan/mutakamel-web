import {
  PUBLISHER_KEY_STATUSES,
  type ContractResult,
  type PublisherKey,
  type PublisherKeyChallenge,
} from "./types";

const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA_256 = /^[0-9a-f]{64}$/u;
const KEY_ID = /^[a-z][a-z0-9._-]{2,63}$/u;
const SAFE_CODE = /^[A-Z][A-Z0-9._-]{2,95}$/u;
const RAW_ED25519_PUBLIC_KEY_BASE64 =
  /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/u;
const CANONICAL_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;

export class PublisherKeyContractError extends Error {
  constructor() {
    super("INVALID_PROVISIONING_PUBLISHER_KEY_RESPONSE");
    this.name = "PublisherKeyContractError";
  }
}

export function isUuidV7(value: string): boolean {
  return UUID_V7.test(value);
}

export function readPublisherKeys(
  payload: unknown,
): ContractResult<PublisherKey[]> {
  const envelope = readEnvelope(payload);
  const data = array(envelope.data, 500).map(readPublisherKeyValue);
  unique(data.map((row) => row.publisherKeyId));
  unique(data.map((row) => row.keyId));
  unique(data.map((row) => row.publicKeyFingerprint));
  return { ...envelope, data };
}

export function readPublisherKey(
  payload: unknown,
): ContractResult<PublisherKey> {
  const envelope = readEnvelope(payload);
  return { ...envelope, data: readPublisherKeyValue(envelope.data) };
}

export function readPublisherKeyChallenge(
  payload: unknown,
): ContractResult<PublisherKeyChallenge> {
  const envelope = readEnvelope(payload);
  const row = object(envelope.data);
  exactKeys(row, [
    "challengeId",
    "algorithm",
    "payloadBase64",
    "signingDigest",
    "expiresAt",
    "publicKeyFingerprint",
    "constraints",
  ]);
  const constraints = object(row.constraints);
  exactKeys(constraints, ["publicKeyEncoding", "signatureEncoding"]);
  const expiresAt = instant(row.expiresAt);
  const responseAt = Date.parse(envelope.timestamp);
  const expiry = Date.parse(expiresAt);
  const payloadBase64 = matching(row.payloadBase64, CANONICAL_BASE64, 684, 136);
  if (
    row.algorithm !== "Ed25519" ||
    constraints.publicKeyEncoding !== "raw-32-byte-base64" ||
    constraints.signatureEncoding !== "raw-64-byte-base64" ||
    expiry <= responseAt ||
    expiry > responseAt + 15 * 60 * 1_000 ||
    !isCanonicalBase64(payloadBase64) ||
    decodedBase64Length(payloadBase64) < 100 ||
    decodedBase64Length(payloadBase64) > 512
  ) {
    fail();
  }
  return {
    ...envelope,
    data: {
      challengeId: uuid(row.challengeId),
      algorithm: "Ed25519",
      payloadBase64,
      signingDigest: matching(row.signingDigest, SHA_256, 64, 64),
      expiresAt,
      publicKeyFingerprint: matching(
        row.publicKeyFingerprint,
        SHA_256,
        64,
        64,
      ),
      constraints: {
        publicKeyEncoding: "raw-32-byte-base64",
        signatureEncoding: "raw-64-byte-base64",
      },
    },
  };
}

function readPublisherKeyValue(value: unknown): PublisherKey {
  const row = object(value);
  exactKeys(row, [
    "publisherKeyId",
    "keyId",
    "algorithm",
    "publicKeyBase64",
    "publicKeyFingerprint",
    "status",
    "revision",
    "registeredAt",
    "revokedAt",
    "revocationReasonCode",
  ]);
  const status = oneOf(row.status, PUBLISHER_KEY_STATUSES);
  const revokedAt = nullableInstant(row.revokedAt);
  const reason = nullableMatching(row.revocationReasonCode, SAFE_CODE, 96);
  if (
    row.algorithm !== "Ed25519" ||
    (status === "ACTIVE" && (revokedAt !== null || reason !== null)) ||
    (status === "REVOKED" && (revokedAt === null || reason === null))
  ) {
    fail();
  }
  const registeredAt = instant(row.registeredAt);
  if (revokedAt !== null && Date.parse(revokedAt) < Date.parse(registeredAt)) {
    fail();
  }
  return {
    publisherKeyId: uuid(row.publisherKeyId),
    keyId: matching(row.keyId, KEY_ID, 64, 3),
    algorithm: "Ed25519",
    publicKeyBase64: matching(
      row.publicKeyBase64,
      RAW_ED25519_PUBLIC_KEY_BASE64,
      44,
      44,
    ),
    publicKeyFingerprint: matching(
      row.publicKeyFingerprint,
      SHA_256,
      64,
      64,
    ),
    status,
    revision: positiveInteger(row.revision),
    registeredAt,
    revokedAt,
    revocationReasonCode: reason,
  };
}

interface Envelope {
  data: unknown;
  correlationId: string;
  timestamp: string;
}

function readEnvelope(value: unknown): Envelope {
  const envelope = object(value);
  exactKeys(envelope, ["success", "data", "correlationId", "timestamp"]);
  if (envelope.success !== true) fail();
  return {
    data: envelope.data,
    correlationId: uuid(envelope.correlationId),
    timestamp: instant(envelope.timestamp),
  };
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail();
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((entry, index) => entry !== wanted[index])
  ) {
    fail();
  }
}

function array(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) fail();
  return value;
}

function uuid(value: unknown): string {
  if (typeof value !== "string" || !isUuidV7(value)) fail();
  return value;
}

function instant(value: unknown): string {
  if (typeof value !== "string") fail();
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    fail();
  }
  return value;
}

function nullableInstant(value: unknown): string | null {
  return value === null ? null : instant(value);
}

function matching(
  value: unknown,
  pattern: RegExp,
  maximum: number,
  minimum = 1,
): string {
  if (
    typeof value !== "string" ||
    value.length < minimum ||
    value.length > maximum ||
    !pattern.test(value)
  ) {
    fail();
  }
  return value;
}

function nullableMatching(
  value: unknown,
  pattern: RegExp,
  maximum: number,
): string | null {
  return value === null ? null : matching(value, pattern, maximum);
}

function positiveInteger(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 2_147_483_647
  ) {
    fail();
  }
  return value;
}

function oneOf<const T extends string>(
  value: unknown,
  values: readonly T[],
): T {
  if (typeof value !== "string" || !values.includes(value as T)) fail();
  return value as T;
}

function unique(values: string[]): void {
  if (new Set(values).size !== values.length) fail();
}

function isCanonicalBase64(value: string): boolean {
  if (value.length % 4 !== 0 || !CANONICAL_BASE64.test(value)) return false;
  if (value.endsWith("==")) return /[AQgw]/u.test(value.at(-3) ?? "");
  if (value.endsWith("=")) {
    return /[AEIMQUYcgkosw048]/u.test(value.at(-2) ?? "");
  }
  return true;
}

function decodedBase64Length(value: string): number {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return (value.length / 4) * 3 - padding;
}

function fail(): never {
  throw new PublisherKeyContractError();
}
