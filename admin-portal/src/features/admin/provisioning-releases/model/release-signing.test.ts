import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReleaseDraft } from "../types/provisioning-releases";
import { buildVerifiedSigningPayload } from "./release-signing";

const TIMESTAMP = "2026-08-31T10:00:00.000Z";
const draft: ReleaseDraft = {
  draftId: "019f0000-0000-7000-8000-000000000001",
  componentId: "019f0000-0000-7000-8000-000000000002",
  releaseVersion: "2.0.0",
  manifestVersion: 2,
  contractVersion: 1,
  runtimeBuildSha: "abcdef1",
  schemaTarget: "core:v2",
  schemaChecksum: null,
  manifestChecksum: "a".repeat(64),
  manifestPayload: { z: "متكامل ✅", a: [1, false, null] },
  compatibility: { requiredComponents: {}, contractVersion: 1 },
  riskLevel: "LOW",
  selfServiceAllowed: false,
  requiresBackup: true,
  requiresMaintenance: false,
  revision: 2,
  status: "VALIDATED",
  publisherKeyId: "019f0000-0000-7000-8000-000000000003",
  signingDigest: "0".repeat(64),
  validatedAt: TIMESTAMP,
  publishedReleaseId: null,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
};

// Fixed bytes catch changes to key order, UTF-8 encoding, or signed fields.
const payload = '{"compatibility":{"contractVersion":1,"requiredComponents":{}},"componentId":"019f0000-0000-7000-8000-000000000002","contractVersion":1,"draftId":"019f0000-0000-7000-8000-000000000001","manifestChecksum":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","manifestPayload":{"a":[1,false,null],"z":"متكامل ✅"},"manifestVersion":2,"publisherKeyId":"019f0000-0000-7000-8000-000000000003","purpose":"PROVISIONING_RELEASE_PUBLICATION","releaseVersion":"2.0.0","requiresBackup":true,"requiresMaintenance":false,"revision":2,"riskLevel":"LOW","runtimeBuildSha":"abcdef1","schemaChecksum":null,"schemaTarget":"core:v2","schemaVersion":1,"selfServiceAllowed":false}';

describe("release signing evidence on HTTP", () => {
  beforeEach(() => vi.stubGlobal("crypto", {}));
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the canonical payload, base64, and exact SHA-256 comparison without SubtleCrypto", async () => {
    const expectedDigest = createHash("sha256").update(payload, "utf8").digest("hex");
    const result = await buildVerifiedSigningPayload({ ...draft, signingDigest: expectedDigest });
    expect(result).toEqual({
      payloadBase64: Buffer.from(payload, "utf8").toString("base64"),
      computedDigest: expectedDigest,
      matchesCoreDigest: true,
    });
    await expect(buildVerifiedSigningPayload(draft)).resolves.toMatchObject({
      payloadBase64: result.payloadBase64,
      computedDigest: expectedDigest,
      matchesCoreDigest: false,
    });
  });

  it.each([
    { status: "DRAFT" as const },
    { publisherKeyId: null },
    { signingDigest: null },
  ])("still refuses incomplete signing state %j", async (invalid) => {
    await expect(buildVerifiedSigningPayload({ ...draft, ...invalid }))
      .rejects.toThrow("INVALID_PROVISIONING_RELEASE_SIGNING_STATE");
  });
});
