import { describe, expect, it } from "vitest";
import {
  PublisherKeyContractError,
  readPublisherKey,
  readPublisherKeyChallenge,
  readPublisherKeys,
} from "./readers";
import {
  ACTIVE_KEY,
  CHALLENGE,
  CORRELATION_ID,
  REVOKED_KEY,
  envelope,
} from "./test-fixtures";

describe("publisher-key readers", () => {
  it("reads the bounded no-store directory and lifecycle evidence", () => {
    const result = readPublisherKeys(envelope([ACTIVE_KEY, REVOKED_KEY]));

    expect(result.data).toEqual([ACTIVE_KEY, REVOKED_KEY]);
    expect(result.correlationId).toBe(CORRELATION_ID);
  });

  it("reads one exact publisher-key response", () => {
    expect(readPublisherKey(envelope(ACTIVE_KEY)).data).toEqual(ACTIVE_KEY);
  });

  it("rejects unknown envelope or row fields", () => {
    expect(() =>
      readPublisherKey({ ...envelope(ACTIVE_KEY), meta: {} }),
    ).toThrow(PublisherKeyContractError);
    expect(() =>
      readPublisherKey(envelope({ ...ACTIVE_KEY, proofPayload: "secret" })),
    ).toThrow(PublisherKeyContractError);
  });

  it("rejects duplicate identities and an unbounded directory", () => {
    expect(() =>
      readPublisherKeys(envelope([ACTIVE_KEY, { ...ACTIVE_KEY }])),
    ).toThrow(PublisherKeyContractError);
    expect(() =>
      readPublisherKeys(envelope(Array.from({ length: 501 }, () => ACTIVE_KEY))),
    ).toThrow(PublisherKeyContractError);
  });

  it("rejects lifecycle contradictions", () => {
    expect(() =>
      readPublisherKey(
        envelope({
          ...ACTIVE_KEY,
          status: "REVOKED",
          revokedAt: null,
          revocationReasonCode: null,
        }),
      ),
    ).toThrow(PublisherKeyContractError);
    expect(() =>
      readPublisherKey(
        envelope({ ...ACTIVE_KEY, revokedAt: "2026-08-12T12:30:00.000Z" }),
      ),
    ).toThrow(PublisherKeyContractError);
  });

  it("reads the signing-safe challenge projection only", () => {
    expect(readPublisherKeyChallenge(envelope(CHALLENGE)).data).toEqual(
      CHALLENGE,
    );
  });

  it("rejects expired, overlong, or structurally widened challenges", () => {
    expect(() =>
      readPublisherKeyChallenge(
        envelope({ ...CHALLENGE, expiresAt: "2026-08-12T12:00:00.000Z" }),
      ),
    ).toThrow(PublisherKeyContractError);
    expect(() =>
      readPublisherKeyChallenge(
        envelope({ ...CHALLENGE, privateKeyBase64: "must-not-pass" }),
      ),
    ).toThrow(PublisherKeyContractError);
    expect(() =>
      readPublisherKeyChallenge(
        envelope({
          ...CHALLENGE,
          constraints: {
            ...CHALLENGE.constraints,
            signatureEncoding: "pem",
          },
        }),
      ),
    ).toThrow(PublisherKeyContractError);
  });
});

