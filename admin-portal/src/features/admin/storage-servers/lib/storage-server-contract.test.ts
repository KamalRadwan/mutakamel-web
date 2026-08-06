import { describe, expect, it } from "vitest";
import {
  isSecureStorageEndpoint,
  probeFreshnessPercent,
  shouldResetStorageServerWriteKey,
} from "./storage-server-contract";

describe("storage server contract helpers", () => {
  it("accepts only a credential-free HTTPS origin", () => {
    expect(isSecureStorageEndpoint("https://garage.example.com")).toBe(true);
    expect(isSecureStorageEndpoint("http://garage.example.com")).toBe(false);
    expect(isSecureStorageEndpoint("https://user:pass@garage.example.com")).toBe(false);
    expect(isSecureStorageEndpoint("https://garage.example.com/path")).toBe(false);
    expect(isSecureStorageEndpoint("https://garage.example.com/?token=secret")).toBe(false);
  });

  it("retains a command key when the outcome is ambiguous", () => {
    expect(
      shouldResetStorageServerWriteKey({
        httpStatus: 500,
        errorCode: "UNKNOWN_ERROR",
      }),
    ).toBe(false);
    expect(
      shouldResetStorageServerWriteKey({
        httpStatus: 401,
        errorCode: "GW.AUTH.UNAUTHORIZED",
      }),
    ).toBe(false);
    expect(
      shouldResetStorageServerWriteKey({
        httpStatus: 409,
        errorCode: "GW.IDEM.IN_FLIGHT",
      }),
    ).toBe(false);
    expect(
      shouldResetStorageServerWriteKey({
        httpStatus: 409,
        errorCode: "STORAGE_SERVER_PROBE_IN_PROGRESS",
      }),
    ).toBe(false);
    expect(
      shouldResetStorageServerWriteKey({
        httpStatus: 409,
        errorCode: "STORAGE_SERVER_REGISTRATION_IN_PROGRESS",
      }),
    ).toBe(false);
  });

  it("rotates the command key after a definitive client rejection", () => {
    expect(
      shouldResetStorageServerWriteKey({
        httpStatus: 422,
        errorCode: "COMMON.VALIDATION.FAILED",
      }),
    ).toBe(true);
  });

  it("reports a bounded freshness percentage", () => {
    const testedAt = "2026-08-05T00:00:00.000Z";
    const expiresAt = "2026-08-06T00:00:00.000Z";
    expect(
      probeFreshnessPercent(
        testedAt,
        expiresAt,
        Date.parse("2026-08-05T12:00:00.000Z"),
      ),
    ).toBe(50);
    expect(probeFreshnessPercent(null, expiresAt)).toBe(0);
    expect(
      probeFreshnessPercent(
        testedAt,
        expiresAt,
        Date.parse("2026-08-07T00:00:00.000Z"),
      ),
    ).toBe(0);
  });
});
