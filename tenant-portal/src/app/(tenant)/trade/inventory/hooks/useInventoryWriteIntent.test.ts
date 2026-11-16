// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { useInventoryWriteIntent } from "./useInventoryWriteIntent";

const mocks = vi.hoisted(() => ({ post: vi.fn(), patch: vi.fn(), sequence: 0 }));
vi.mock("../../trade-api", () => ({ tradePost: mocks.post, tradePatch: mocks.patch }));
vi.mock("@/lib/uuid", () => ({ generateUUIDv7: () => `019f3000-0000-7000-8000-${String(++mocks.sequence).padStart(12, "0")}` }));
const path = "/api/tenant/trade/v1/inventory/periods" as const;
const headers = { "x-mutakamel-company-id": "company-a" };
const response = { data: { id: "record" }, headers: new Headers() };
const rejection = (status: number, code?: string) => new TenantApiClientError("Rejected", { status, statusText: "", headers: new Headers(), data: { errorCode: code } });
beforeEach(() => { mocks.post.mockReset(); mocks.patch.mockReset(); mocks.sequence = 0; });
afterEach(cleanup);

describe("inventory write identity", () => {
  it("retries an unknown outcome with the same key and exact payload", async () => {
    mocks.post.mockRejectedValueOnce(new Error("Network timeout")).mockResolvedValue(response);
    const { result } = renderHook(useInventoryWriteIntent);
    await act(async () => { await expect(result.current.post(path, { code: "NOV" }, headers)).rejects.toThrow("Network timeout"); });
    await act(async () => { await result.current.post(path, { code: "NOV" }, headers); result.current.complete(); });
    expect(mocks.post.mock.calls[0][2].headers["x-idempotency-key"]).toBe(mocks.post.mock.calls[1][2].headers["x-idempotency-key"]);
    expect(mocks.post.mock.calls[1][1]).toEqual({ code: "NOV" });
  });

  it("blocks changed input and changed scope while an earlier outcome is unknown", async () => {
    mocks.post.mockRejectedValue(new Error("Timeout"));
    const { result } = renderHook(useInventoryWriteIntent);
    await expect(result.current.post(path, { code: "NOV" }, headers)).rejects.toThrow("Timeout");
    await expect(result.current.post(path, { code: "DEC" }, headers)).rejects.toThrow("INVENTORY_UNRESOLVED_WRITE");
    await expect(result.current.post(path, { code: "NOV" }, { "x-mutakamel-company-id": "company-b" })).rejects.toThrow("INVENTORY_UNRESOLVED_WRITE");
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it("keeps identity for a server 5xx and an in-flight key", async () => {
    mocks.post.mockRejectedValueOnce(rejection(503)).mockRejectedValueOnce(rejection(409, "TRADE.IDEMPOTENCY.IN_FLIGHT")).mockResolvedValue(response);
    const { result } = renderHook(useInventoryWriteIntent);
    await expect(result.current.post(path, {}, headers)).rejects.toThrow();
    await expect(result.current.post(path, {}, headers)).rejects.toThrow();
    await result.current.post(path, {}, headers);
    expect(new Set(mocks.post.mock.calls.map((call) => call[2].headers["x-idempotency-key"])).size).toBe(1);
  });

  it("allows corrected input under a new key after a definitive validation rejection", async () => {
    mocks.post.mockRejectedValueOnce(rejection(400)).mockResolvedValue(response);
    const { result } = renderHook(useInventoryWriteIntent);
    await expect(result.current.post(path, { code: "bad" }, headers)).rejects.toThrow();
    await result.current.post(path, { code: "NOV" }, headers);
    expect(mocks.post.mock.calls[0][2].headers["x-idempotency-key"]).not.toBe(mocks.post.mock.calls[1][2].headers["x-idempotency-key"]);
  });

  it("does not resolve an unvalidated success payload until the caller completes it", async () => {
    mocks.post.mockResolvedValue(response);
    const { result } = renderHook(useInventoryWriteIntent);
    await result.current.post(path, { code: "NOV" }, headers);
    // A caller that fails response validation deliberately does not complete.
    await expect(result.current.post(path, { code: "DEC" }, headers)).rejects.toThrow("INVENTORY_UNRESOLVED_WRITE");
    await result.current.post(path, { code: "NOV" }, headers);
    expect(mocks.post.mock.calls[0][2].headers["x-idempotency-key"]).toBe(mocks.post.mock.calls[1][2].headers["x-idempotency-key"]);
    result.current.complete();
    await result.current.post(path, { code: "DEC" }, headers);
    expect(mocks.post.mock.calls[2][2].headers["x-idempotency-key"]).not.toBe(mocks.post.mock.calls[0][2].headers["x-idempotency-key"]);
  });

  it("retains If-Match exactly for a patch retry", async () => {
    mocks.patch.mockRejectedValueOnce(new Error("Timeout")).mockResolvedValue(response);
    const { result } = renderHook(useInventoryWriteIntent);
    const scoped = { ...headers, "If-Match": '"4"' };
    await expect(result.current.patch(path, { status: "INACTIVE" }, scoped)).rejects.toThrow();
    await result.current.patch(path, { status: "INACTIVE" }, scoped);
    expect(mocks.patch.mock.calls[1][2].headers).toMatchObject({ "If-Match": '"4"', "x-idempotency-key": mocks.patch.mock.calls[0][2].headers["x-idempotency-key"] });
  });

  it("replays the saved request without a reconstructed draft and fences it to the original actor/scope", async () => {
    mocks.post.mockRejectedValueOnce(new Error("Timeout")).mockResolvedValue(response);
    const { result, rerender } = renderHook((actor: string) => useInventoryWriteIntent(actor), { initialProps: "actor-a/session-1" });
    await expect(result.current.post(path, { code: "NOV", dates: ["2026-11-01", "2026-11-30"] }, headers)).rejects.toThrow();
    expect(result.current.canRetry(path, { ...headers, "x-mutakamel-company-id": "company-b" })).toBe(false);
    await expect(result.current.retry(path, { ...headers, "x-mutakamel-company-id": "company-b" })).rejects.toThrow("INVENTORY_UNRESOLVED_WRITE");
    rerender("actor-b/session-2"); expect(result.current.canRetry(path, headers)).toBe(false);
    rerender("actor-a/session-1"); expect(result.current.canRetry(path, headers)).toBe(true);
    await result.current.retry(path, headers);
    expect(mocks.post.mock.calls[1][1]).toEqual(mocks.post.mock.calls[0][1]);
    expect(mocks.post.mock.calls[1][2].headers["x-idempotency-key"]).toBe(mocks.post.mock.calls[0][2].headers["x-idempotency-key"]);
    expect(result.current.hasPending()).toBe(true); result.current.complete(); expect(result.current.hasPending()).toBe(false);
  });
});
