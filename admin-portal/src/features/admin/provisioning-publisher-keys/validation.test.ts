import { describe, expect, it } from "vitest";
import {
  buildChallengeCommand,
  buildRegisterCommand,
  buildRevokeCommand,
} from "./validation";
import {
  CHALLENGE_ID,
  PUBLIC_KEY,
  SIGNATURE,
} from "./test-fixtures";

describe("publisher-key DTO validation", () => {
  it("builds the exact challenge DTO", () => {
    expect(
      buildChallengeCommand({
        keyId: "core-release-primary",
        publicKeyBase64: PUBLIC_KEY,
        expiresInSeconds: "300",
      }),
    ).toEqual({
      command: {
        keyId: "core-release-primary",
        publicKeyBase64: PUBLIC_KEY,
        expiresInSeconds: 300,
      },
      errors: {},
    });
  });

  it.each(["59", "901", "60.0", " 60", ""])(
    "rejects challenge lifetime %s",
    (expiresInSeconds) => {
      expect(
        buildChallengeCommand({
          keyId: "core-release-primary",
          publicKeyBase64: PUBLIC_KEY,
          expiresInSeconds,
        }).command,
      ).toBeNull();
    },
  );

  it("enforces the exact key-id and raw-key encodings", () => {
    const result = buildChallengeCommand({
      keyId: "UPPERCASE",
      publicKeyBase64: `${PUBLIC_KEY} `,
      expiresInSeconds: "300",
    });
    expect(result.errors).toEqual({
      keyId: "KEY_ID",
      publicKeyBase64: "PUBLIC_KEY",
    });
  });

  it("rejects Base64 with noncanonical Ed25519 tail bits", () => {
    expect(
      buildChallengeCommand({
        keyId: "core-release-primary",
        publicKeyBase64: `${"A".repeat(42)}B=`,
        expiresInSeconds: "300",
      }).errors.publicKeyBase64,
    ).toBe("PUBLIC_KEY");
    expect(
      buildRegisterCommand({
        challengeId: CHALLENGE_ID,
        proofSignatureBase64: `${"A".repeat(85)}B==`,
      }).errors.proofSignatureBase64,
    ).toBe("SIGNATURE");
  });

  it("builds the exact registration DTO", () => {
    expect(
      buildRegisterCommand({
        challengeId: CHALLENGE_ID,
        proofSignatureBase64: SIGNATURE,
      }).command,
    ).toEqual({
      challengeId: CHALLENGE_ID,
      proofSignatureBase64: SIGNATURE,
    });
  });

  it("rejects a non-v7 challenge and noncanonical signature", () => {
    expect(
      buildRegisterCommand({
        challengeId: "019f1000-0000-4000-8000-000000000003",
        proofSignatureBase64: "not-a-signature",
      }).errors,
    ).toEqual({
      challengeId: "CHALLENGE_ID",
      proofSignatureBase64: "SIGNATURE",
    });
  });

  it("builds the exact revision-fenced revoke DTO", () => {
    expect(
      buildRevokeCommand({
        publisherKeyId: CHALLENGE_ID,
        expectedRevision: "7",
        reasonCode: "KEY_ROTATED",
      }).target,
    ).toEqual({
      publisherKeyId: CHALLENGE_ID,
      command: {
        expectedRevision: 7,
        expectedStatus: "ACTIVE",
        reasonCode: "KEY_ROTATED",
      },
    });
  });

  it.each(["lowercase", "A", "BAD REASON", "_BAD"])(
    "rejects unsafe reason code %s",
    (reasonCode) => {
      expect(
        buildRevokeCommand({
          publisherKeyId: CHALLENGE_ID,
          expectedRevision: "1",
          reasonCode,
        }).target,
      ).toBeNull();
    },
  );

  it("rejects invalid direct revoke path and revision inputs", () => {
    expect(
      buildRevokeCommand({
        publisherKeyId: "not-a-v7",
        expectedRevision: "0",
        reasonCode: "KEY_ROTATED",
      }).errors,
    ).toEqual({
      publisherKeyId: "PUBLISHER_KEY_ID",
      expectedRevision: "REVISION",
    });
  });
});
