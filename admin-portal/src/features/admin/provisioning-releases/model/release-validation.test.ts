import { describe, expect, it } from "vitest";
import type { ReleaseDefinitionDraft, ReleaseDraft } from "../types/provisioning-releases";
import {
  buildCreateReleaseDraftDto,
  buildPublishReleaseDraftDto,
  buildRetireReleaseDto,
  canonicalJson,
  EMPTY_RELEASE_DEFINITION,
  validatePublishDraft,
  validateReleaseDefinition,
  validateRetireDraft,
} from "./release-validation";

const COMPONENT_ID = "019f0000-0000-7000-8000-000000000001";
const PUBLISHER_ID = "019f0000-0000-7000-8000-000000000002";
const DRAFT_ID = "019f0000-0000-7000-8000-000000000003";
const SHA = "a".repeat(64);
const SIGNATURE = `${"A".repeat(86)}==`;

function validDefinition(): ReleaseDefinitionDraft {
  const compatibility = { contractVersion: 1, requiredComponents: {} };
  return {
    ...EMPTY_RELEASE_DEFINITION,
    componentId: COMPONENT_ID,
    releaseVersion: "2.0.0+build.7",
    manifestVersion: "2",
    contractVersion: "1",
    runtimeBuildSha: "abcdef1",
    schemaTarget: "core:v2",
    schemaChecksum: SHA,
    manifestPayload: JSON.stringify({
      componentKey: "core.foundation",
      contractVersion: 1,
      schemaTarget: "core:v2",
      seedPacks: [
        { key: "system.roles", version: "1.0.0", policy: "CREATE_IF_MISSING", checksum: SHA },
      ],
      compatibility,
    }),
    compatibility: JSON.stringify(compatibility),
    riskLevel: "HIGH",
    selfServiceAllowed: false,
    requiresBackup: true,
    requiresMaintenance: true,
  };
}

describe("release-governance validation", () => {
  it("accepts every draft DTO field and emits only the strict Core body", () => {
    const definition = validDefinition();
    expect(validateReleaseDefinition(definition)).toEqual({});
    expect(buildCreateReleaseDraftDto(definition)).toEqual({
      componentId: COMPONENT_ID,
      releaseVersion: "2.0.0+build.7",
      manifestVersion: 2,
      contractVersion: 1,
      runtimeBuildSha: "abcdef1",
      schemaTarget: "core:v2",
      schemaChecksum: SHA,
      manifestPayload: JSON.parse(definition.manifestPayload),
      compatibility: JSON.parse(definition.compatibility),
      riskLevel: "HIGH",
      selfServiceAllowed: false,
      requiresBackup: true,
      requiresMaintenance: true,
    });
  });

  it("matches numeric, version, SHA, and schema validators exactly", () => {
    const invalid = {
      ...validDefinition(),
      componentId: "v4",
      releaseVersion: "bad space",
      manifestVersion: "0",
      contractVersion: "2147483648",
      // Was "ABCDEF1", rejected only for being uppercase hex. The field
      // carries the app version today, not a SHA, so an identifier of that
      // shape is legitimate; a space is what makes this one malformed.
      runtimeBuildSha: "bad sha",
      schemaTarget: "2invalid",
      schemaChecksum: "A".repeat(64),
    };
    expect(validateReleaseDefinition(invalid)).toMatchObject({
      componentId: "INVALID_UUID_V7",
      releaseVersion: "INVALID_VERSION",
      manifestVersion: "INVALID_POSITIVE_INTEGER",
      contractVersion: "INVALID_POSITIVE_INTEGER",
      runtimeBuildSha: "INVALID_BUILD_SHA",
      schemaTarget: "INVALID_SCHEMA_TARGET",
      schemaChecksum: "INVALID_SHA256",
    });
  });

  it("rejects recursive secret-bearing keys before transport", () => {
    const invalid = {
      ...validDefinition(),
      manifestPayload: JSON.stringify({ nested: [{ authorizationToken: "secret" }] }),
    };
    expect(validateReleaseDefinition(invalid).manifestPayload).toBe(
      "SECRET_FIELD_FORBIDDEN",
    );
  });

  it("enforces exact manifest and compatibility structures", () => {
    const mismatch = {
      ...validDefinition(),
      manifestPayload: JSON.stringify({
        componentKey: "core.foundation",
        contractVersion: 2,
        schemaTarget: "other",
        seedPacks: [],
      }),
      compatibility: JSON.stringify({ contractVersion: 2, requiredComponents: [] }),
    };
    expect(validateReleaseDefinition(mismatch)).toMatchObject({
      manifestPayload: "INVALID_MANIFEST_STRUCTURE",
      compatibility: "INVALID_COMPATIBILITY",
    });
  });

  it("requires exact detached signature and local critical confirmation", () => {
    expect(validatePublishDraft({ signatureBase64: "bad", confirmed: false })).toEqual({
      signatureBase64: "INVALID_SIGNATURE",
      confirmed: "CONFIRMATION_REQUIRED",
    });
    expect(validatePublishDraft({ signatureBase64: SIGNATURE, confirmed: true })).toEqual({});
    const releaseDraft = {
      draftId: DRAFT_ID,
      componentId: COMPONENT_ID,
      publisherKeyId: PUBLISHER_ID,
      signingDigest: SHA,
      manifestChecksum: SHA,
      revision: 2,
      status: "VALIDATED",
    } as ReleaseDraft;
    expect(
      buildPublishReleaseDraftDto(releaseDraft, {
        signatureBase64: SIGNATURE,
        confirmed: true,
      }),
    ).toEqual({
      expectedRevision: 2,
      expectedManifestChecksum: SHA,
      publisherKeyId: PUBLISHER_ID,
      expectedSigningDigest: SHA,
      signatureAlgorithm: "Ed25519",
      signatureBase64: SIGNATURE,
    });
  });

  it("validates and builds exact retirement fences", () => {
    expect(validateRetireDraft({ reasonCode: "bad reason", confirmed: false })).toEqual({
      reasonCode: "INVALID_REASON_CODE",
      confirmed: "CONFIRMATION_REQUIRED",
    });
    const input = { reasonCode: "SUPERSEDED_RELEASE", confirmed: true };
    expect(validateRetireDraft(input)).toEqual({});
    expect(buildRetireReleaseDto(SHA, input)).toEqual({
      expectedManifestChecksum: SHA,
      reasonCode: "SUPERSEDED_RELEASE",
    });
  });

  it("canonicalizes keys with Core's deterministic algorithm", () => {
    expect(canonicalJson({ z: [2, { b: true, a: null }], a: "x" })).toBe(
      '{"a":"x","z":[2,{"a":null,"b":true}]}',
    );
  });

  it("accepts the version-shaped runtimeBuildSha the catalogue actually seeds", () => {
    // UI-006. The catalogue types this field as `typeof MUTAKAMEL_APP_VERSION`
    // and seeds "0.0.1", so a hex-only rule rejected every release the platform
    // publishes - the list and detail pages both failed on an HTTP 200 - and an
    // operator could not author one matching the seeded format either.
    expect(
      validateReleaseDefinition({
        ...validDefinition(),
        runtimeBuildSha: "0.0.1",
      }).runtimeBuildSha,
    ).toBeUndefined();

    // A real build SHA stays valid.
    expect(
      validateReleaseDefinition({
        ...validDefinition(),
        runtimeBuildSha: "a".repeat(40),
      }).runtimeBuildSha,
    ).toBeUndefined();

    // Malformed input is still refused.
    expect(
      validateReleaseDefinition({
        ...validDefinition(),
        runtimeBuildSha: "bad sha",
      }).runtimeBuildSha,
    ).toBe("INVALID_BUILD_SHA");
  });
});
