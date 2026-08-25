import { describe, expect, it } from "vitest";
import {
  readReleaseDraftList,
  readReleaseDraftSnapshot,
  readReleaseSnapshot,
  readReleaseValidationSnapshot,
} from "./release-readers";

const DRAFT_ID = "019f0000-0000-7000-8000-000000000001";
const RELEASE_ID = "019f0000-0000-7000-8000-000000000002";
const COMPONENT_ID = "019f0000-0000-7000-8000-000000000003";
const PUBLISHER_ID = "019f0000-0000-7000-8000-000000000004";
const TIMESTAMP = "2026-08-12T08:00:00.000Z";
const SHA = "a".repeat(64);
const SIGNATURE = `${"A".repeat(86)}==`;

const definition = {
  componentId: COMPONENT_ID,
  releaseVersion: "2.0.0+build.7",
  manifestVersion: 2,
  contractVersion: 1,
  runtimeBuildSha: "abcdef1",
  schemaTarget: "core:v2",
  schemaChecksum: null,
  manifestChecksum: SHA,
  manifestPayload: {
    componentKey: "core.foundation",
    contractVersion: 1,
    schemaTarget: "core:v2",
    seedPacks: [],
  },
  compatibility: { contractVersion: 1, requiredComponents: {} },
  riskLevel: "MEDIUM",
  selfServiceAllowed: false,
  requiresBackup: true,
  requiresMaintenance: true,
};

const draft = {
  draftId: DRAFT_ID,
  ...definition,
  revision: 1,
  status: "DRAFT",
  publisherKeyId: null,
  signingDigest: null,
  validatedAt: null,
  publishedReleaseId: null,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  createIdempotencyKey: "must-not-project",
};

function envelope(data: unknown) {
  return { success: true, data, correlationId: "corr-release", timestamp: TIMESTAMP };
}

describe("release-governance wire readers", () => {
  it("projects a secret-free draft allowlist and preserves manifest JSON", () => {
    const result = readReleaseDraftSnapshot(envelope(draft));
    expect(result.data).toMatchObject({
      draftId: DRAFT_ID,
      manifestPayload: definition.manifestPayload,
      compatibility: definition.compatibility,
    });
    expect(result.data).not.toHaveProperty("createIdempotencyKey");
  });

  it("reads bounded draft lists and exact Core validation evidence", () => {
    expect(readReleaseDraftList(envelope([draft])).data).toHaveLength(1);
    expect(
      readReleaseValidationSnapshot(
        envelope({
          publisherKeyId: PUBLISHER_ID,
          draftId: DRAFT_ID,
          revision: 2,
          manifestChecksum: SHA,
          signingDigest: SHA,
          payloadBase64: "e30=",
          algorithm: "Ed25519",
        }),
      ).data,
    ).toEqual({
      publisherKeyId: PUBLISHER_ID,
      draftId: DRAFT_ID,
      revision: 2,
      manifestChecksum: SHA,
      signingDigest: SHA,
      payloadBase64: "e30=",
      algorithm: "Ed25519",
    });
  });

  it("accepts both signed API and migration publication disclosure shapes", () => {
    const signed = readReleaseSnapshot(
      envelope({
        releaseId: RELEASE_ID,
        ...definition,
        status: "PUBLISHED",
        publicationSource: "SIGNED_API",
        publisherKeyId: PUBLISHER_ID,
        signatureAlgorithm: "Ed25519",
        signatureBase64: SIGNATURE,
        signedPayloadDigest: SHA,
        publishedAt: TIMESTAMP,
        retiredAt: null,
        retirementReasonCode: null,
      }),
    );
    const migration = readReleaseSnapshot(
      envelope({
        releaseId: RELEASE_ID,
        ...definition,
        status: "PUBLISHED",
        publicationSource: "MIGRATION",
        publisherKeyId: null,
        signatureAlgorithm: null,
        signatureBase64: null,
        signedPayloadDigest: null,
        publishedAt: TIMESTAMP,
        retiredAt: null,
        retirementReasonCode: null,
      }),
    );
    expect(signed.data.signatureBase64).toBe(SIGNATURE);
    expect(migration.data.publisherKeyId).toBeNull();
  });

  it.each([
    ["secret-bearing manifest", { ...draft, manifestPayload: { privateKey: "do-not-expose" } }],
    ["non-v7 component", { ...draft, componentId: "component-1" }],
    ["unknown draft status", { ...draft, status: "READY" }],
    ["draft carrying signing evidence", { ...draft, signingDigest: SHA }],
  ])("fails closed for %s", (_label, malformed) => {
    expect(() => readReleaseDraftSnapshot(envelope(malformed))).toThrow(
      "INVALID_PROVISIONING_RELEASE_RESPONSE",
    );
  });

  it("rejects inconsistent signed-publication and retirement evidence", () => {
    expect(() =>
      readReleaseSnapshot(
        envelope({
          releaseId: RELEASE_ID,
          ...definition,
          status: "RETIRED",
          publicationSource: "SIGNED_API",
          publisherKeyId: null,
          signatureAlgorithm: null,
          signatureBase64: null,
          signedPayloadDigest: null,
          publishedAt: TIMESTAMP,
          retiredAt: null,
          retirementReasonCode: null,
        }),
      ),
    ).toThrow("INVALID_PROVISIONING_RELEASE_RESPONSE");
  });
});
