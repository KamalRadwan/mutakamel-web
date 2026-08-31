import { describe, expect, it } from "vitest";
import {
  formatBackupBytes,
  formatBackupDate,
  formatBackupNumber,
  isAmbiguousWriteFailure,
  shouldRetainBackupCommandKey,
  shortBackupId,
} from "./backup-format";

describe("backup presentation safety helpers", () => {
  it("formats byte counts without exposing storage identifiers", () => {
    expect(formatBackupBytes("1073741824")).toBe("1.0 GB");
    expect(formatBackupBytes("1073741824", "ar-EG")).toBe("١٫٠ GB");
    expect(formatBackupBytes(null)).toBe("Not available");
    expect(formatBackupBytes("invalid")).toBe("Not available");
  });

  it("retains the exact command key only while the outcome can still be replayed", () => {
    expect(
      shouldRetainBackupCommandKey({ httpStatus: 500, errorCode: "HTTP_500" }),
    ).toBe(true);
    expect(
      shouldRetainBackupCommandKey({ httpStatus: 401, errorCode: "HTTP_401" }),
    ).toBe(true);
    expect(
      shouldRetainBackupCommandKey({
        httpStatus: 409,
        errorCode: "GW.IDEM.IN_FLIGHT",
      }),
    ).toBe(true);
    expect(
      shouldRetainBackupCommandKey({ httpStatus: 422, errorCode: "INVALID" }),
    ).toBe(false);
  });

  it("uses explicit unavailable copy for missing or invalid timestamps", () => {
    expect(formatBackupDate(null)).toBe("Not available");
    expect(formatBackupDate("not-a-date")).toBe("Not available");
  });

  it("formats operational counts with an explicit supported locale", () => {
    expect(formatBackupNumber(1234, "en-US")).toBe("1,234");
    expect(formatBackupNumber(1234, "ar-EG")).toBe("١٬٢٣٤");
  });

  it("shortens identifiers only for visual display", () => {
    const id = "019f0000-0000-7000-8000-000000000001";
    expect(shortBackupId(id)).toBe("019f0000…000001");
    expect(shortBackupId("short-id")).toBe("short-id");
  });

  it("treats server and network-class failures as ambiguous writes", () => {
    expect(isAmbiguousWriteFailure(0)).toBe(true);
    expect(isAmbiguousWriteFailure(500)).toBe(true);
    expect(isAmbiguousWriteFailure(503)).toBe(true);
    expect(isAmbiguousWriteFailure(409)).toBe(false);
    expect(isAmbiguousWriteFailure(422)).toBe(false);
  });
});

