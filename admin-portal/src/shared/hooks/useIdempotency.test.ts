// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateUUIDv7Mock } = vi.hoisted(() => ({
  generateUUIDv7Mock: vi.fn(),
}));

vi.mock("@/lib/utils/uuid", () => ({
  generateUUIDv7: generateUUIDv7Mock,
}));

import { useIdempotency } from "./useIdempotency";

describe("useIdempotency", () => {
  beforeEach(() => {
    generateUUIDv7Mock.mockReset();
    generateUUIDv7Mock
      .mockReturnValueOnce("019f0000-0000-7000-8000-000000000001")
      .mockReturnValueOnce("019f0000-0000-7000-8000-000000000002")
      .mockReturnValueOnce("019f0000-0000-7000-8000-000000000003");
  });

  it("keeps the same UUIDv7 for an exact retry and rotates it for a new intent", () => {
    const { result } = renderHook(() => useIdempotency());
    const intent = {
      action: "start-backup-run",
      databaseServerId: "019f0000-0000-7000-8000-000000000099",
      reason: "Operator request",
    };

    let first = "";
    let retry = "";
    let changed = "";
    act(() => {
      first = result.current.getIdempotencyKey(intent);
      retry = result.current.getIdempotencyKey({ ...intent });
      changed = result.current.getIdempotencyKey({
        ...intent,
        reason: "Different command intent",
      });
    });

    expect(first).toBe("019f0000-0000-7000-8000-000000000001");
    expect(retry).toBe(first);
    expect(changed).toBe("019f0000-0000-7000-8000-000000000002");
  });

  it("allocates a fresh key after a definitive completion", () => {
    const { result } = renderHook(() => useIdempotency());
    const intent = { action: "promote-restore", runId: "restore-1" };
    const first = result.current.getIdempotencyKey(intent);

    act(() => result.current.resetKey());

    expect(result.current.getIdempotencyKey(intent)).toBe(
      "019f0000-0000-7000-8000-000000000002",
    );
    expect(result.current.getIdempotencyKey(intent)).not.toBe(first);
  });
});
