import type {
  CreateReleaseDraftDto,
  PublishDraft,
  PublishReleaseDraftDto,
  ReleaseDefinitionDraft,
  ReleaseDraft,
  ReleaseValidationCode,
  ReleaseValidationErrors,
  RetireDraft,
  RetireReleaseDto,
  UpdateReleaseDraftDto,
  ValidateReleaseDraftDto,
} from "../types/provisioning-releases";

const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._:+-]{0,63}$/;
const BUILD_SHA = /^[0-9a-f]{7,64}$/;
const SCHEMA_TARGET = /^[A-Za-z][A-Za-z0-9._:-]{0,254}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const SAFE_CODE = /^[A-Z][A-Z0-9._-]{2,95}$/;
const SAFE_KEY = /^[a-z][a-z0-9._-]{0,127}$/;
const SAFE_COMPONENT_KEY = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9_-]*)*$/;
const ED25519_SIGNATURE = /^[A-Za-z0-9+/]{86}==$/;
const SECRET_KEY = /(password|secret|token|credential|authorization|cookie|private.?key)/iu;
const MAX_JSON_BYTES = 256 * 1024;
const MAX_INTEGER = 2_147_483_647;
const SEED_POLICIES = new Set([
  "SYSTEM_MANAGED",
  "CREATE_ONCE",
  "CREATE_IF_MISSING",
  "PATCH_IF_UNMODIFIED",
  "ADDITIVE",
  "TRANSFORM",
  "MANUAL_CONFLICT",
]);

export const EMPTY_RELEASE_DEFINITION: ReleaseDefinitionDraft = {
  componentId: "",
  releaseVersion: "",
  manifestVersion: "1",
  contractVersion: "1",
  runtimeBuildSha: "",
  schemaTarget: "",
  schemaChecksum: "",
  manifestPayload: JSON.stringify(
    {
      componentKey: "",
      contractVersion: 1,
      schemaTarget: "",
      seedPacks: [],
      compatibility: { contractVersion: 1, requiredComponents: {} },
    },
    null,
    2,
  ),
  compatibility: JSON.stringify(
    { contractVersion: 1, requiredComponents: {} },
    null,
    2,
  ),
  riskLevel: "LOW",
  selfServiceAllowed: false,
  requiresBackup: false,
  requiresMaintenance: false,
};

export function definitionFromRelease(draft: ReleaseDraft): ReleaseDefinitionDraft {
  return {
    componentId: draft.componentId,
    releaseVersion: draft.releaseVersion,
    manifestVersion: String(draft.manifestVersion),
    contractVersion: String(draft.contractVersion),
    runtimeBuildSha: draft.runtimeBuildSha,
    schemaTarget: draft.schemaTarget,
    schemaChecksum: draft.schemaChecksum ?? "",
    manifestPayload: JSON.stringify(draft.manifestPayload, null, 2),
    compatibility: JSON.stringify(draft.compatibility, null, 2),
    riskLevel: draft.riskLevel,
    selfServiceAllowed: draft.selfServiceAllowed,
    requiresBackup: draft.requiresBackup,
    requiresMaintenance: draft.requiresMaintenance,
  };
}

export function validateReleaseDefinition(
  draft: ReleaseDefinitionDraft,
): ReleaseValidationErrors {
  const errors: ReleaseValidationErrors = {};
  if (!UUID_V7.test(draft.componentId.trim())) errors.componentId = "INVALID_UUID_V7";
  if (!VERSION.test(draft.releaseVersion.trim())) errors.releaseVersion = "INVALID_VERSION";
  validateInteger(draft.manifestVersion, "manifestVersion", errors);
  validateInteger(draft.contractVersion, "contractVersion", errors);
  if (!BUILD_SHA.test(draft.runtimeBuildSha.trim())) errors.runtimeBuildSha = "INVALID_BUILD_SHA";
  if (!SCHEMA_TARGET.test(draft.schemaTarget.trim())) errors.schemaTarget = "INVALID_SCHEMA_TARGET";
  if (draft.schemaChecksum.trim() && !SHA256.test(draft.schemaChecksum.trim())) {
    errors.schemaChecksum = "INVALID_SHA256";
  }

  const manifest = parseJsonObject(draft.manifestPayload, "manifestPayload", errors);
  const compatibility = parseJsonObject(draft.compatibility, "compatibility", errors);
  if (manifest && !errors.manifestPayload) {
    const code = validateManifestStructure(
      manifest,
      Number(draft.contractVersion),
      draft.schemaTarget.trim(),
      compatibility,
    );
    if (code) errors.manifestPayload = code;
  }
  if (compatibility && !errors.compatibility) {
    const code = validateCompatibility(compatibility);
    if (code) errors.compatibility = code;
  }
  return errors;
}

export function buildCreateReleaseDraftDto(
  draft: ReleaseDefinitionDraft,
): CreateReleaseDraftDto {
  return buildDefinitionDto(draft);
}

export function buildUpdateReleaseDraftDto(
  draft: ReleaseDefinitionDraft,
  expectedRevision: number,
): UpdateReleaseDraftDto {
  return { ...buildDefinitionDto(draft), expectedRevision };
}

export function buildValidateReleaseDraftDto(
  draft: ReleaseDraft,
  publisherKeyId: string,
): ValidateReleaseDraftDto {
  return {
    expectedRevision: draft.revision,
    expectedManifestChecksum: draft.manifestChecksum,
    publisherKeyId: publisherKeyId.trim().toLowerCase(),
  };
}

export function validatePublisherKeyId(value: string): ReleaseValidationErrors {
  return UUID_V7.test(value.trim()) ? {} : { publisherKeyId: "INVALID_UUID_V7" };
}

export function validatePublishDraft(draft: PublishDraft): ReleaseValidationErrors {
  const errors: ReleaseValidationErrors = {};
  if (!ED25519_SIGNATURE.test(draft.signatureBase64.trim())) {
    errors.signatureBase64 = "INVALID_SIGNATURE";
  }
  if (!draft.confirmed) errors.confirmed = "CONFIRMATION_REQUIRED";
  return errors;
}

export function buildPublishReleaseDraftDto(
  releaseDraft: ReleaseDraft,
  input: PublishDraft,
): PublishReleaseDraftDto {
  if (!releaseDraft.publisherKeyId || !releaseDraft.signingDigest) {
    throw new Error("INVALID_PROVISIONING_RELEASE_SIGNING_STATE");
  }
  return {
    expectedRevision: releaseDraft.revision,
    expectedManifestChecksum: releaseDraft.manifestChecksum,
    publisherKeyId: releaseDraft.publisherKeyId,
    expectedSigningDigest: releaseDraft.signingDigest,
    signatureAlgorithm: "Ed25519",
    signatureBase64: input.signatureBase64.trim(),
  };
}

export function validateRetireDraft(draft: RetireDraft): ReleaseValidationErrors {
  const errors: ReleaseValidationErrors = {};
  if (!SAFE_CODE.test(draft.reasonCode.trim())) errors.reasonCode = "INVALID_REASON_CODE";
  if (!draft.confirmed) errors.confirmed = "CONFIRMATION_REQUIRED";
  return errors;
}

export function buildRetireReleaseDto(
  manifestChecksum: string,
  draft: RetireDraft,
): RetireReleaseDto {
  return {
    expectedManifestChecksum: manifestChecksum,
    reasonCode: draft.reasonCode.trim(),
  };
}

function buildDefinitionDto(draft: ReleaseDefinitionDraft): CreateReleaseDraftDto {
  return {
    componentId: draft.componentId.trim().toLowerCase(),
    releaseVersion: draft.releaseVersion.trim(),
    manifestVersion: Number(draft.manifestVersion),
    contractVersion: Number(draft.contractVersion),
    runtimeBuildSha: draft.runtimeBuildSha.trim(),
    schemaTarget: draft.schemaTarget.trim(),
    ...(draft.schemaChecksum.trim()
      ? { schemaChecksum: draft.schemaChecksum.trim().toLowerCase() }
      : {}),
    manifestPayload: JSON.parse(draft.manifestPayload) as Record<string, unknown>,
    compatibility: JSON.parse(draft.compatibility) as Record<string, unknown>,
    riskLevel: draft.riskLevel,
    selfServiceAllowed: draft.selfServiceAllowed,
    requiresBackup: draft.requiresBackup,
    requiresMaintenance: draft.requiresMaintenance,
  };
}

function validateInteger(
  value: string,
  field: string,
  errors: ReleaseValidationErrors,
): void {
  const parsed = Number(value);
  if (!/^\d+$/.test(value) || !Number.isInteger(parsed) || parsed < 1 || parsed > MAX_INTEGER) {
    errors[field] = "INVALID_POSITIVE_INTEGER";
  }
}

function parseJsonObject(
  value: string,
  field: string,
  errors: ReleaseValidationErrors,
): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) {
      errors[field] = "INVALID_JSON_OBJECT";
      return null;
    }
    if (
      new TextEncoder().encode(JSON.stringify(parsed)).byteLength >
      MAX_JSON_BYTES
    ) {
      errors[field] = "JSON_TOO_LARGE";
      return null;
    }
    if (containsSecretKey(parsed)) {
      errors[field] = "SECRET_FIELD_FORBIDDEN";
      return null;
    }
    return parsed;
  } catch {
    errors[field] = "INVALID_JSON_OBJECT";
    return null;
  }
}

function validateManifestStructure(
  value: Record<string, unknown>,
  contractVersion: number,
  schemaTarget: string,
  compatibility: Record<string, unknown> | null,
): ReleaseValidationCode | null {
  if (
    Object.keys(value).some(
      (key) =>
        !["componentKey", "contractVersion", "schemaTarget", "seedPacks", "compatibility"].includes(
          key,
        ),
    ) ||
    typeof value.componentKey !== "string" ||
    !SAFE_COMPONENT_KEY.test(value.componentKey) ||
    value.contractVersion !== contractVersion ||
    value.schemaTarget !== schemaTarget ||
    !Array.isArray(value.seedPacks) ||
    (value.compatibility !== undefined &&
      (!compatibility || canonicalJson(value.compatibility) !== canonicalJson(compatibility)))
  ) {
    return "INVALID_MANIFEST_STRUCTURE";
  }

  const keys = new Set<string>();
  for (const item of value.seedPacks) {
    if (
      !isRecord(item) ||
      Object.keys(item).some((key) => !["key", "version", "policy", "checksum"].includes(key)) ||
      typeof item.key !== "string" ||
      !SAFE_KEY.test(item.key) ||
      keys.has(item.key) ||
      typeof item.version !== "string" ||
      !VERSION.test(item.version) ||
      typeof item.policy !== "string" ||
      !SEED_POLICIES.has(item.policy) ||
      typeof item.checksum !== "string" ||
      !SHA256.test(item.checksum)
    ) {
      return "INVALID_MANIFEST_STRUCTURE";
    }
    keys.add(item.key);
  }
  return null;
}

function validateCompatibility(value: Record<string, unknown>): ReleaseValidationCode | null {
  if (
    Object.keys(value).some((key) => key !== "contractVersion" && key !== "requiredComponents") ||
    value.contractVersion !== 1 ||
    !isRecord(value.requiredComponents)
  ) {
    return "INVALID_COMPATIBILITY";
  }
  for (const [key, constraint] of Object.entries(value.requiredComponents)) {
    const versions = typeof constraint === "string" ? [constraint] : constraint;
    if (
      !SAFE_COMPONENT_KEY.test(key) ||
      !Array.isArray(versions) ||
      versions.length < 1 ||
      versions.length > 32 ||
      versions.some((version) => typeof version !== "string" || !VERSION.test(version)) ||
      new Set(versions).size !== versions.length
    ) {
      return "INVALID_COMPATIBILITY";
    }
  }
  return null;
}

function containsSecretKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsSecretKey);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(
    ([key, child]) => SECRET_KEY.test(key) || containsSecretKey(child),
  );
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  throw new Error("INVALID_CANONICAL_JSON");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
