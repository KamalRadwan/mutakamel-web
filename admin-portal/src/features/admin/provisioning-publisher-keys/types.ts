import type { NormalizedApiError } from "@/shared/api/normalized-api-error";

export const PUBLISHER_KEY_STATUSES = ["ACTIVE", "REVOKED"] as const;
type PublisherKeyStatus = (typeof PUBLISHER_KEY_STATUSES)[number];

export interface PublisherKey {
  publisherKeyId: string;
  keyId: string;
  algorithm: "Ed25519";
  publicKeyBase64: string;
  publicKeyFingerprint: string;
  status: PublisherKeyStatus;
  revision: number;
  registeredAt: string;
  revokedAt: string | null;
  revocationReasonCode: string | null;
}

export interface PublisherKeyChallenge {
  challengeId: string;
  algorithm: "Ed25519";
  payloadBase64: string;
  signingDigest: string;
  expiresAt: string;
  publicKeyFingerprint: string;
  constraints: {
    publicKeyEncoding: "raw-32-byte-base64";
    signatureEncoding: "raw-64-byte-base64";
  };
}

export interface ContractResult<T> {
  data: T;
  correlationId: string;
  timestamp: string;
}

export interface CreateChallengeCommand {
  keyId: string;
  publicKeyBase64: string;
  expiresInSeconds: number;
}

export interface RegisterPublisherKeyCommand {
  challengeId: string;
  proofSignatureBase64: string;
}

export interface RevokePublisherKeyCommand {
  expectedRevision: number;
  expectedStatus: "ACTIVE";
  reasonCode: string;
}

export interface ChallengeDraft {
  keyId: string;
  publicKeyBase64: string;
  expiresInSeconds: string;
}

export interface RegisterDraft {
  challengeId: string;
  proofSignatureBase64: string;
}

export interface RevokeDraft {
  publisherKeyId: string;
  expectedRevision: string;
  reasonCode: string;
}

export type FieldErrorCode =
  | "KEY_ID"
  | "PUBLIC_KEY"
  | "EXPIRY"
  | "CHALLENGE_ID"
  | "SIGNATURE"
  | "PUBLISHER_KEY_ID"
  | "REVISION"
  | "REASON";

export type FieldErrors<T extends string> = Partial<Record<T, FieldErrorCode>>;

export type ResourceState =
  | "LOADING"
  | "READY"
  | "EMPTY"
  | "FORBIDDEN"
  | "UNAVAILABLE"
  | "STALE"
  | "ERROR";

export interface ResourceView<T> {
  data: T | null;
  state: ResourceState;
  error: NormalizedApiError | null;
  correlationId: string | null;
  timestamp: string | null;
  isRefreshing: boolean;
}

export type MutationKind = "CHALLENGE" | "REGISTER" | "REVOKE";

export type MutationState =
  | "IDLE"
  | "CONFIRMING_REGISTER"
  | "CONFIRMING_REVOKE"
  | "PENDING"
  | "SUCCESS"
  | "VALIDATION"
  | "FORBIDDEN"
  | "CONFLICT"
  | "AMBIGUOUS"
  | "ERROR";

export type PublisherKeyMutationIntent =
  | {
      kind: "CHALLENGE";
      command: CreateChallengeCommand;
      idempotencyKey: string;
    }
  | {
      kind: "REGISTER";
      command: RegisterPublisherKeyCommand;
      idempotencyKey: string;
    }
  | {
      kind: "REVOKE";
      publisherKeyId: string;
      command: RevokePublisherKeyCommand;
      idempotencyKey: string;
    };
