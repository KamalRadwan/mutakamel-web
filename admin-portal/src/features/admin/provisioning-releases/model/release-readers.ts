import {
  PUBLICATION_SOURCES,
  RELEASE_DRAFT_STATUSES,
  RELEASE_RISK_LEVELS,
  RELEASE_STATUSES,
  type CoreSnapshot,
  type ProvisioningRelease,
  type PublicationSource,
  type ReleaseDraft,
  type ReleaseDraftStatus,
  type ReleaseRiskLevel,
  type ReleaseStatus,
  type ReleaseValidation,
} from "../types/provisioning-releases";

const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._:+-]{0,63}$/;
/**
 * `runtimeBuildSha` does not carry a build SHA today.
 *
 * The provisioning release catalogue types it as
 * `runtimeBuildSha: typeof MUTAKAMEL_APP_VERSION` and seeds it with the app
 * version, `0.0.1`. A hex-only pattern therefore rejected every release the
 * platform itself publishes, so `/provisioning/releases` and the release detail
 * page both failed with INVALID_PROVISIONING_RELEASE_RESPONSE on an HTTP 200 -
 * and an operator authoring a release could not match the seeded format either.
 *
 * Accepts a build SHA or the platform's identifier shape, which is what the
 * field actually holds. The real repair is upstream: either the field is
 * renamed to what it carries, or the catalogue starts emitting a genuine build
 * SHA. Until one of those happens, the reader has to read what is sent.
 */
const BUILD_SHA = /^(?:[0-9a-f]{7,64}|[A-Za-z0-9][A-Za-z0-9._:+-]{0,63})$/;
const SCHEMA_TARGET = /^[A-Za-z][A-Za-z0-9._:-]{0,254}$/;
const ED25519_SIGNATURE = /^[A-Za-z0-9+/]{86}==$/;
const PAYLOAD_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const SECRET_KEY = /(password|secret|token|credential|authorization|cookie|private.?key)/iu;
const MAX_JSON_BYTES = 256 * 1024;

export function readReleaseDraftList(payload: unknown): CoreSnapshot<ReleaseDraft[]> {
  const envelope = readEnvelope(payload);
  if (!Array.isArray(envelope.data) || envelope.data.length > 500) invalid();
  return snapshot(envelope, envelope.data.map(readReleaseDraft));
}

export function readReleaseList(
  payload: unknown,
): CoreSnapshot<ProvisioningRelease[]> {
  const envelope = readEnvelope(payload);
  if (!Array.isArray(envelope.data) || envelope.data.length > 1_000) invalid();
  return snapshot(envelope, envelope.data.map(readRelease));
}

export function readReleaseDraftSnapshot(
  payload: unknown,
): CoreSnapshot<ReleaseDraft> {
  const envelope = readEnvelope(payload);
  return snapshot(envelope, readReleaseDraft(envelope.data));
}

export function readReleaseSnapshot(
  payload: unknown,
): CoreSnapshot<ProvisioningRelease> {
  const envelope = readEnvelope(payload);
  return snapshot(envelope, readRelease(envelope.data));
}

export function readReleaseValidationSnapshot(
  payload: unknown,
): CoreSnapshot<ReleaseValidation> {
  const envelope = readEnvelope(payload);
  const row = requiredRecord(envelope.data);
  const payloadBase64 = boundedString(row.payloadBase64, 1_000_000);
  if (!PAYLOAD_BASE64.test(payloadBase64)) invalid();
  return snapshot(envelope, {
    publisherKeyId: uuidV7(row.publisherKeyId),
    draftId: uuidV7(row.draftId),
    revision: positiveInteger(row.revision),
    manifestChecksum: sha256(row.manifestChecksum),
    signingDigest: sha256(row.signingDigest),
    payloadBase64,
    algorithm: exact(row.algorithm, "Ed25519"),
  });
}

function readReleaseDraft(value: unknown): ReleaseDraft {
  const row = requiredRecord(value);
  const status = oneOf(row.status, RELEASE_DRAFT_STATUSES) as ReleaseDraftStatus;
  const publisherKeyId = nullableUuidV7(row.publisherKeyId);
  const signingDigest = nullableSha256(row.signingDigest);
  const validatedAt = nullableTimestamp(row.validatedAt);
  const publishedReleaseId = nullableUuidV7(row.publishedReleaseId);

  if (status === "DRAFT" && (publisherKeyId || signingDigest || validatedAt || publishedReleaseId)) {
    invalid();
  }
  if (
    (status === "VALIDATED" || status === "PUBLISHED") &&
    (!publisherKeyId || !signingDigest || !validatedAt)
  ) {
    invalid();
  }
  if ((status === "PUBLISHED") !== Boolean(publishedReleaseId)) invalid();

  return {
    draftId: uuidV7(row.draftId),
    ...readDefinition(row),
    revision: positiveInteger(row.revision),
    status,
    publisherKeyId,
    signingDigest,
    validatedAt,
    publishedReleaseId,
    createdAt: timestamp(row.createdAt),
    updatedAt: timestamp(row.updatedAt),
  };
}

function readRelease(value: unknown): ProvisioningRelease {
  const row = requiredRecord(value);
  const status = oneOf(row.status, RELEASE_STATUSES) as ReleaseStatus;
  const publicationSource = oneOf(
    row.publicationSource,
    PUBLICATION_SOURCES,
  ) as PublicationSource;
  const publisherKeyId = nullableUuidV7(row.publisherKeyId);
  const signatureAlgorithm = nullableExact(row.signatureAlgorithm, "Ed25519");
  const signatureBase64 = nullableSignature(row.signatureBase64);
  const signedPayloadDigest = nullableSha256(row.signedPayloadDigest);
  const retiredAt = nullableTimestamp(row.retiredAt);
  const retirementReasonCode = nullableBoundedString(row.retirementReasonCode, 96);

  if (
    publicationSource === "MIGRATION" &&
    (publisherKeyId || signatureAlgorithm || signatureBase64 || signedPayloadDigest)
  ) {
    invalid();
  }
  if (
    publicationSource === "SIGNED_API" &&
    (!publisherKeyId || !signatureAlgorithm || !signatureBase64 || !signedPayloadDigest)
  ) {
    invalid();
  }
  if ((status === "RETIRED") !== Boolean(retiredAt)) invalid();
  if (status === "PUBLISHED" && retirementReasonCode) invalid();

  return {
    releaseId: uuidV7(row.releaseId),
    ...readDefinition(row),
    status,
    publicationSource,
    publisherKeyId,
    signatureAlgorithm,
    signatureBase64,
    signedPayloadDigest,
    publishedAt: timestamp(row.publishedAt),
    retiredAt,
    retirementReasonCode,
  };
}

function readDefinition(row: Record<string, unknown>) {
  return {
    componentId: uuidV7(row.componentId),
    releaseVersion: patternString(row.releaseVersion, VERSION, 64),
    manifestVersion: positiveInteger(row.manifestVersion),
    contractVersion: positiveInteger(row.contractVersion),
    runtimeBuildSha: patternString(row.runtimeBuildSha, BUILD_SHA, 64),
    schemaTarget: patternString(row.schemaTarget, SCHEMA_TARGET, 255),
    schemaChecksum: nullableSha256(row.schemaChecksum),
    manifestChecksum: sha256(row.manifestChecksum),
    manifestPayload: safeJsonObject(row.manifestPayload),
    compatibility: safeJsonObject(row.compatibility),
    riskLevel: oneOf(row.riskLevel, RELEASE_RISK_LEVELS) as ReleaseRiskLevel,
    selfServiceAllowed: requiredBoolean(row.selfServiceAllowed),
    requiresBackup: requiredBoolean(row.requiresBackup),
    requiresMaintenance: requiredBoolean(row.requiresMaintenance),
  };
}

function readEnvelope(payload: unknown): Record<string, unknown> {
  const envelope = requiredRecord(payload);
  if (envelope.success !== true || !("data" in envelope)) invalid();
  boundedString(envelope.correlationId, 200);
  timestamp(envelope.timestamp);
  return envelope;
}

function snapshot<T>(envelope: Record<string, unknown>, data: T): CoreSnapshot<T> {
  return {
    data,
    correlationId: boundedString(envelope.correlationId, 200),
    responseTimestamp: timestamp(envelope.timestamp),
  };
}

function safeJsonObject(value: unknown): Record<string, unknown> {
  const object = requiredRecord(value);
  assertSafeJson(object);
  return structuredClone(object);
}

function assertSafeJson(value: unknown): void {
  const encoded = JSON.stringify(value);
  if (new TextEncoder().encode(encoded).byteLength > MAX_JSON_BYTES) invalid();
  walkSafeJson(value);
}

function walkSafeJson(value: unknown): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    value.forEach(walkSafeJson);
    return;
  }
  const object = record(value);
  if (!object) invalid();
  for (const [key, child] of Object.entries(object)) {
    if (SECRET_KEY.test(key)) invalid();
    walkSafeJson(child);
  }
}

function requiredRecord(value: unknown): Record<string, unknown> {
  const result = record(value);
  if (!result) invalid();
  return result;
}

function record(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null
    ? (value as Record<string, unknown>)
    : null;
}

function boundedString(value: unknown, maximum: number): string {
  if (typeof value !== "string") invalid();
  const result = value.trim();
  if (!result || result.length > maximum) invalid();
  return result;
}

function nullableBoundedString(value: unknown, maximum: number): string | null {
  return value === null || value === undefined ? null : boundedString(value, maximum);
}

function patternString(value: unknown, pattern: RegExp, maximum: number): string {
  const result = boundedString(value, maximum);
  if (!pattern.test(result)) invalid();
  return result;
}

function uuidV7(value: unknown): string {
  const result = boundedString(value, 36);
  if (!UUID_V7.test(result)) invalid();
  return result.toLowerCase();
}

function nullableUuidV7(value: unknown): string | null {
  return value === null || value === undefined ? null : uuidV7(value);
}

function sha256(value: unknown): string {
  const result = boundedString(value, 64);
  if (!SHA256.test(result)) invalid();
  return result;
}

function nullableSha256(value: unknown): string | null {
  return value === null || value === undefined ? null : sha256(value);
}

function nullableSignature(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const result = boundedString(value, 88);
  if (!ED25519_SIGNATURE.test(result)) invalid();
  return result;
}

function timestamp(value: unknown): string {
  const result = boundedString(value, 100);
  if (Number.isNaN(Date.parse(result))) invalid();
  return result;
}

function nullableTimestamp(value: unknown): string | null {
  return value === null || value === undefined ? null : timestamp(value);
}

function positiveInteger(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 2_147_483_647
  ) {
    invalid();
  }
  return value;
}

function requiredBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") invalid();
  return value;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) invalid();
  return value as T;
}

function exact<T extends string>(value: unknown, expected: T): T {
  if (value !== expected) invalid();
  return expected;
}

function nullableExact<T extends string>(value: unknown, expected: T): T | null {
  return value === null || value === undefined ? null : exact(value, expected);
}

function invalid(): never {
  throw new Error("INVALID_PROVISIONING_RELEASE_RESPONSE");
}
