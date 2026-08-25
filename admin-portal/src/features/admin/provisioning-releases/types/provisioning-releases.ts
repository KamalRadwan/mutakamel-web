import type { NormalizedApiError } from "@/shared/api/normalized-api-error";

export const RELEASE_DRAFT_STATUSES = [
  "DRAFT",
  "VALIDATED",
  "PUBLISHED",
  "ABANDONED",
] as const;
export type ReleaseDraftStatus = (typeof RELEASE_DRAFT_STATUSES)[number];

export const RELEASE_STATUSES = ["PUBLISHED", "RETIRED"] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

export const RELEASE_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type ReleaseRiskLevel = (typeof RELEASE_RISK_LEVELS)[number];

export const PUBLICATION_SOURCES = ["MIGRATION", "SIGNED_API"] as const;
export type PublicationSource = (typeof PUBLICATION_SOURCES)[number];

export interface ReleaseDraft {
  draftId: string;
  componentId: string;
  releaseVersion: string;
  manifestVersion: number;
  contractVersion: number;
  runtimeBuildSha: string;
  schemaTarget: string;
  schemaChecksum: string | null;
  manifestChecksum: string;
  manifestPayload: Record<string, unknown>;
  compatibility: Record<string, unknown>;
  riskLevel: ReleaseRiskLevel;
  selfServiceAllowed: boolean;
  requiresBackup: boolean;
  requiresMaintenance: boolean;
  revision: number;
  status: ReleaseDraftStatus;
  publisherKeyId: string | null;
  signingDigest: string | null;
  validatedAt: string | null;
  publishedReleaseId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProvisioningRelease {
  releaseId: string;
  componentId: string;
  releaseVersion: string;
  manifestVersion: number;
  contractVersion: number;
  runtimeBuildSha: string;
  schemaTarget: string;
  schemaChecksum: string | null;
  manifestChecksum: string;
  manifestPayload: Record<string, unknown>;
  compatibility: Record<string, unknown>;
  riskLevel: ReleaseRiskLevel;
  selfServiceAllowed: boolean;
  requiresBackup: boolean;
  requiresMaintenance: boolean;
  status: ReleaseStatus;
  publicationSource: PublicationSource;
  publisherKeyId: string | null;
  signatureAlgorithm: "Ed25519" | null;
  signatureBase64: string | null;
  signedPayloadDigest: string | null;
  publishedAt: string;
  retiredAt: string | null;
  retirementReasonCode: string | null;
}

export interface ReleaseValidation {
  publisherKeyId: string;
  draftId: string;
  revision: number;
  manifestChecksum: string;
  signingDigest: string;
  payloadBase64: string;
  algorithm: "Ed25519";
}

export interface CoreSnapshot<T> {
  data: T;
  correlationId: string;
  responseTimestamp: string;
}

export interface ReleaseDraftBodyDto {
  componentId: string;
  releaseVersion: string;
  manifestVersion: number;
  contractVersion: number;
  runtimeBuildSha: string;
  schemaTarget: string;
  schemaChecksum?: string;
  manifestPayload: Record<string, unknown>;
  compatibility: Record<string, unknown>;
  riskLevel: ReleaseRiskLevel;
  selfServiceAllowed: boolean;
  requiresBackup: boolean;
  requiresMaintenance: boolean;
}

export type CreateReleaseDraftDto = ReleaseDraftBodyDto;
export type UpdateReleaseDraftDto = ReleaseDraftBodyDto & {
  expectedRevision: number;
};
export interface ValidateReleaseDraftDto {
  expectedRevision: number;
  expectedManifestChecksum: string;
  publisherKeyId: string;
}
export type PublishReleaseDraftDto = ValidateReleaseDraftDto & {
  expectedSigningDigest: string;
  signatureAlgorithm: "Ed25519";
  signatureBase64: string;
};
export interface RetireReleaseDto {
  expectedManifestChecksum: string;
  reasonCode: string;
}

export interface ReleaseDefinitionDraft {
  componentId: string;
  releaseVersion: string;
  manifestVersion: string;
  contractVersion: string;
  runtimeBuildSha: string;
  schemaTarget: string;
  schemaChecksum: string;
  manifestPayload: string;
  compatibility: string;
  riskLevel: ReleaseRiskLevel;
  selfServiceAllowed: boolean;
  requiresBackup: boolean;
  requiresMaintenance: boolean;
}

export interface PublishDraft {
  signatureBase64: string;
  confirmed: boolean;
}

export interface RetireDraft {
  reasonCode: string;
  confirmed: boolean;
}

export interface ReleasePermissions {
  canRead: boolean;
  canManageDrafts: boolean;
  canPublishCritical: boolean;
  canRetireCritical: boolean;
}

export type ResourceState =
  | "LOADING"
  | "READY"
  | "EMPTY"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "UNAVAILABLE"
  | "ERROR";

export type ReleaseMutationName =
  | "CREATE"
  | "UPDATE"
  | "VALIDATE"
  | "PUBLISH"
  | "RETIRE";
export type ReleaseMutationPhase =
  | "IDLE"
  | "PENDING"
  | "SUCCEEDED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "VALIDATION"
  | "IN_FLIGHT"
  | "UNAVAILABLE"
  | "ERROR";
export interface ReleaseMutationState {
  name: ReleaseMutationName | null;
  phase: ReleaseMutationPhase;
  error: NormalizedApiError | null;
  correlationId: string | null;
}

export type ReleaseValidationCode =
  | "INVALID_UUID_V7"
  | "INVALID_VERSION"
  | "INVALID_POSITIVE_INTEGER"
  | "INVALID_BUILD_SHA"
  | "INVALID_SCHEMA_TARGET"
  | "INVALID_SHA256"
  | "INVALID_JSON_OBJECT"
  | "JSON_TOO_LARGE"
  | "SECRET_FIELD_FORBIDDEN"
  | "INVALID_MANIFEST_STRUCTURE"
  | "INVALID_COMPATIBILITY"
  | "INVALID_SIGNATURE"
  | "INVALID_REASON_CODE"
  | "CONFIRMATION_REQUIRED";
export type ReleaseValidationErrors = Record<string, ReleaseValidationCode>;
