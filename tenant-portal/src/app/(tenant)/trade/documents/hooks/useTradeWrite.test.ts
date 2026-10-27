// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TradeResult } from "../../trade-api";
import { useTradeWrite } from "./useTradeWrite";

const toast = vi.hoisted(() => ({
  success: vi.fn(), error: vi.fn(), errorFromApi: vi.fn(), outcomeFromApi: vi.fn(() => false),
}));
vi.mock("@/design-system", () => ({ useToast: () => toast }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: {
  tradeDocuments: { savedDescription: "Saved", replayedDescription: "Replayed", errors: {} },
} }) }));
vi.mock("../../trade-api", () => ({
  isTradeReplay: (headers: Headers) => headers.get("idempotency-replayed") === "true",
}));
vi.mock("@/lib/api/errors", () => ({
  normalizeApiError: (error: unknown) => error instanceof Error ? { status: 0 } : error,
}));

function response(): TradeResult {
  return { data: {}, headers: new Headers({ "idempotency-replayed": "true" }), status: 201 };
}
function sender() {
  return vi.fn<(headers: Record<string, string>) => Promise<TradeResult>>();
}

describe("document write recovery fence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retains the original operation and key, ignores new writes and runs success on replay", async () => {
    const send = sender().mockRejectedValueOnce(new Error("Response lost")).mockResolvedValue(response());
    const replacement = sender().mockResolvedValue(response());
    const onSuccess = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useTradeWrite());
    const originalRun = result.current.runWrite;
    await act(async () => { expect(await originalRun({ operation: "Create", send, onSuccess })).toBe(false); });
    const pending = result.current.ambiguous!;
    expect(result.current.isWriting).toBe(false);
    expect(result.current.isBlocked).toBe(true);
    expect(onSuccess).not.toHaveBeenCalled();
    await act(async () => {
      expect(await originalRun({ operation: "Changed draft", send: replacement })).toBe(false);
      expect(await result.current.runWrite({ operation: "Changed draft", send: replacement })).toBe(false);
      result.current.clearWriteError();
    });
    expect(replacement).not.toHaveBeenCalled();
    await act(async () => { await pending.retry(); });
    expect(send.mock.calls[1]).toEqual(send.mock.calls[0]);
    expect(send.mock.calls[0]![0]["x-idempotency-key"]).toBe(pending.idempotencyKey);
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith("Create", "Replayed");
    expect(result.current.ambiguous).toBeNull();
    expect(result.current.isBlocked).toBe(false);
    await act(async () => { await pending.retry(); });
    expect(send).toHaveBeenCalledTimes(2);
    await act(async () => { await result.current.runWrite({ operation: "Next", send: replacement }); });
    expect(replacement.mock.calls[0]![0]["x-idempotency-key"]).not.toBe(pending.idempotencyKey);
  });

  it("blocks concurrent submissions before disabled controls have rendered", async () => {
    let finish!: (value: TradeResult) => void;
    const send = sender().mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => useTradeWrite());
    await act(async () => {
      const first = result.current.runWrite({ operation: "Create", send });
      expect(await result.current.runWrite({ operation: "Create", send })).toBe(false);
      finish(response());
      await first;
    });
    expect(send).toHaveBeenCalledOnce();
  });

  it("allows only one recovery attempt in flight", async () => {
    let finish!: (value: TradeResult) => void;
    const send = sender().mockRejectedValueOnce(new Error("Response lost"))
      .mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => useTradeWrite());
    await act(async () => { await result.current.runWrite({ operation: "Create", send }); });
    const pending = result.current.ambiguous!;
    await act(async () => {
      const first = pending.retry();
      await pending.retry();
      finish(response());
      await first;
    });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it.each([403, 409, 429, 503])("retains the fence when recovery returns HTTP %s", async (status) => {
    const send = sender().mockRejectedValueOnce(new Error("Response lost")).mockRejectedValueOnce({ status });
    const { result } = renderHook(() => useTradeWrite());
    await act(async () => { await result.current.runWrite({ operation: "Create", send }); });
    const pending = result.current.ambiguous!;
    await act(async () => { await pending.retry(); });
    expect(result.current.ambiguous?.idempotencyKey).toBe(pending.idempotencyKey);
    expect(result.current.isBlocked).toBe(true);
    expect(result.current.writeError?.status).toBe(status);
    await act(async () => { expect(await result.current.runWrite({ operation: "Create", send })).toBe(false); });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("allows correction after an ordinary HTTP rejection", async () => {
    const send = sender().mockRejectedValueOnce({ status: 422 }).mockResolvedValue(response());
    const { result } = renderHook(() => useTradeWrite());
    await act(async () => { await result.current.runWrite({ operation: "Create", send }); });
    expect(result.current.isBlocked).toBe(false);
    expect(result.current.ambiguous).toBeNull();
    await act(async () => { expect(await result.current.runWrite({ operation: "Create", send })).toBe(true); });
    expect(send.mock.calls[1]![0]["x-idempotency-key"]).not.toBe(send.mock.calls[0]![0]["x-idempotency-key"]);
  });

  it("does not classify a refresh failure after confirmed success as an unknown write", async () => {
    const send = sender().mockResolvedValue(response());
    const onSuccess = vi.fn().mockRejectedValue(new Error("Refresh failed"));
    const { result } = renderHook(() => useTradeWrite());
    await act(async () => {
      await expect(result.current.runWrite({ operation: "Create", send, onSuccess })).rejects.toThrow("Refresh failed");
    });
    expect(result.current.ambiguous).toBeNull();
    expect(result.current.isBlocked).toBe(false);
  });
});
