import { describe, expect, it } from "vitest";
import {
  BACKUP_NON_IDEMPOTENT_GUARD_STORAGE_KEY,
  clearBackupNonIdempotentCommandAttempt,
  markBackupNonIdempotentCommandUnknown,
  parseBackupNonIdempotentCommandAttempt,
  readBackupNonIdempotentCommandAttempt,
  writeBackupNonIdempotentCommandAttempt,
  type BackupNonIdempotentCommandAttempt,
} from "./non-idempotent-command-guard";

const attempt: BackupNonIdempotentCommandAttempt = {
  kind: "BACKUP_START",
  targetId: "019f0000-0000-7000-8000-000000000010",
  issuedAt: "2026-08-04T12:00:00.000Z",
  localCommandId: "019f0000-0000-7000-8000-000000000020",
  status: "IN_FLIGHT",
};

describe("durable non-idempotent Backup command guard", () => {
  it("round-trips only the minimal validated attempt evidence", () => {
    const storage = new MemoryStorage();
    writeBackupNonIdempotentCommandAttempt(storage, attempt);

    expect(readBackupNonIdempotentCommandAttempt(storage)).toEqual(attempt);
    expect(JSON.parse(storage.getItem(BACKUP_NON_IDEMPOTENT_GUARD_STORAGE_KEY)!))
      .toEqual(attempt);
  });

  it("retains an ambiguous attempt as UNKNOWN and clears only the owning command", () => {
    const storage = new MemoryStorage();
    writeBackupNonIdempotentCommandAttempt(storage, attempt);

    expect(
      markBackupNonIdempotentCommandUnknown(storage, attempt.localCommandId),
    ).toEqual({ ...attempt, status: "UNKNOWN" });
    expect(
      clearBackupNonIdempotentCommandAttempt(
        storage,
        "019f0000-0000-7000-8000-000000000099",
      ),
    ).toBe(false);
    expect(readBackupNonIdempotentCommandAttempt(storage)?.status).toBe("UNKNOWN");
    expect(
      clearBackupNonIdempotentCommandAttempt(storage, attempt.localCommandId),
    ).toBe(true);
    expect(readBackupNonIdempotentCommandAttempt(storage)).toBeNull();
  });

  it("rejects malformed, extra, or secret-bearing persisted records", () => {
    expect(() => parseBackupNonIdempotentCommandAttempt("not-json")).toThrow();
    expect(() =>
      parseBackupNonIdempotentCommandAttempt(
        JSON.stringify({ ...attempt, password: "must-not-be-persisted" }),
      ),
    ).toThrow(/unsupported/i);
    expect(() =>
      parseBackupNonIdempotentCommandAttempt(
        JSON.stringify({ ...attempt, targetId: "not-a-uuid" }),
      ),
    ).toThrow(/invalid/i);
  });
});

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}
