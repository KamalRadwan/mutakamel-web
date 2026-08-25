import type { PublisherKey, PublisherKeyChallenge } from "./types";

export const CORRELATION_ID = "019f1000-0000-7000-8000-000000000001";
export const PUBLISHER_KEY_ID = "019f1000-0000-7000-8000-000000000002";
export const CHALLENGE_ID = "019f1000-0000-7000-8000-000000000003";
export const IDEMPOTENCY_KEY = "019f1000-0000-7000-8000-000000000004";
export const PUBLIC_KEY = `${"A".repeat(43)}=`;
export const SIGNATURE = `${"A".repeat(86)}==`;
export const FINGERPRINT = "a".repeat(64);

export const ACTIVE_KEY: PublisherKey = {
  publisherKeyId: PUBLISHER_KEY_ID,
  keyId: "core-release-primary",
  algorithm: "Ed25519",
  publicKeyBase64: PUBLIC_KEY,
  publicKeyFingerprint: FINGERPRINT,
  status: "ACTIVE",
  revision: 1,
  registeredAt: "2026-08-12T12:00:00.000Z",
  revokedAt: null,
  revocationReasonCode: null,
};

export const REVOKED_KEY: PublisherKey = {
  ...ACTIVE_KEY,
  publisherKeyId: "019f1000-0000-7000-8000-000000000005",
  keyId: "core-release-retired",
  publicKeyFingerprint: "b".repeat(64),
  status: "REVOKED",
  revision: 2,
  revokedAt: "2026-08-12T12:30:00.000Z",
  revocationReasonCode: "KEY_ROTATED",
};

export const CHALLENGE: PublisherKeyChallenge = {
  challengeId: CHALLENGE_ID,
  algorithm: "Ed25519",
  payloadBase64: "A".repeat(136),
  signingDigest: "c".repeat(64),
  expiresAt: "2026-08-12T12:05:00.000Z",
  publicKeyFingerprint: FINGERPRINT,
  constraints: {
    publicKeyEncoding: "raw-32-byte-base64",
    signatureEncoding: "raw-64-byte-base64",
  },
};

export function envelope<T>(data: T) {
  return {
    success: true,
    data,
    correlationId: CORRELATION_ID,
    timestamp: "2026-08-12T12:00:01.000Z",
  };
}

