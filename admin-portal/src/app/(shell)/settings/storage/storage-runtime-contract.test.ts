import { describe, expect, it } from "vitest";
import { readStorageRuntimeConfigEnvelope } from "./storage-runtime-contract";

const TIMESTAMP = "2026-08-25T03:00:00.000Z";

function envelope(data: unknown) {
  return {
    success: true,
    data,
    correlationId: "corr-storage-runtime",
    timestamp: TIMESTAMP,
  };
}

describe("Storage runtime settings contract", () => {
  it("accepts only the exact safe Core response projection", () => {
    expect(
      readStorageRuntimeConfigEnvelope(
        envelope({
          enabled: false,
          configured: true,
          brokerConfigured: true,
          updatedAt: TIMESTAMP,
        }),
      ).data,
    ).toEqual({
      enabled: false,
      configured: true,
      brokerConfigured: true,
      updatedAt: TIMESTAMP,
    });
  });

  it("preserves secret-free broker drift evidence without inventing runtime state", () => {
    expect(
      readStorageRuntimeConfigEnvelope(
        envelope({
          enabled: true,
          configured: true,
          brokerConfigured: false,
          updatedAt: TIMESTAMP,
        }),
      ).data,
    ).toEqual({
      enabled: true,
      configured: true,
      brokerConfigured: false,
      updatedAt: TIMESTAMP,
    });
  });

  it.each([
    {
      enabled: true,
      configured: false,
      brokerConfigured: true,
      updatedAt: null,
    },
    {
      enabled: false,
      configured: true,
      brokerConfigured: true,
      updatedAt: TIMESTAMP,
      masterKey: "must-not-leak",
    },
    {
      enabled: false,
      configured: true,
      brokerConfigured: true,
      updatedAt: TIMESTAMP,
      encryptedKey: "must-not-leak",
    },
    {
      enabled: false,
      configured: true,
      brokerConfigured: "yes",
      updatedAt: TIMESTAMP,
    },
    { enabled: false, configured: true, updatedAt: TIMESTAMP },
    {
      enabled: false,
      configured: true,
      brokerConfigured: true,
      updatedAt: "not-a-date",
    },
  ])("rejects unsafe or inconsistent config %#", (config) => {
    expect(() => readStorageRuntimeConfigEnvelope(envelope(config))).toThrow(
      "INVALID_STORAGE_RUNTIME_CONFIG_RESPONSE",
    );
  });
});
