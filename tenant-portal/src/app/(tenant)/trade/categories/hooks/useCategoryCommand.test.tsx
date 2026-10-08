// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCategoryCommand } from "./useCategoryCommand";

const { submit, capture } = vi.hoisted(() => ({ submit: vi.fn(), capture: vi.fn() }));
vi.mock("../category-api", async (original) => {
  const actual = await original<typeof import("../category-api")>();
  return { ...actual, submitCategory: submit, captureCategorySubmission: capture.mockImplementation(actual.captureCategorySubmission) };
});
vi.mock("@/lib/api/errors", () => ({ normalizeApiError: (value: unknown) => value }));
const id = "019f0000-0000-7000-8000-000000000001";
const receipt = { id, version: 2, treeVersion: 4, changed: true };
const command = { action: "update" as const, id, version: 1, body: { displayName: "Original" } };
afterEach(cleanup);
beforeEach(() => { submit.mockReset(); capture.mockClear(); });

describe("Category command recovery", () => {
  it("retains immutable intent and the original key after an unknown outcome", async () => {
    submit.mockRejectedValueOnce({ status: 0 }).mockResolvedValueOnce({ receipt, replayed: true });
    const { result } = renderHook(() => useCategoryCommand(true));
    const input = { ...command, body: { displayName: "Original" } };
    await act(async () => { expect(await result.current.submit(input)).toBeNull(); });
    expect(result.current.state.kind).toBe("uncertain");
    input.body.displayName = "Changed after submission";
    await act(async () => { expect(await result.current.submit(input)).toBeNull(); });
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { expect(await result.current.retry()).toEqual(receipt); });
    expect(capture).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[1][0]).toBe(submit.mock.calls[0][0]);
    expect(submit.mock.calls[1][0].body).toBe('{"displayName":"Original"}');
    expect(result.current.state).toEqual({ kind: "saved", receipt, replayed: true });
  });
  it("blocks double submissions synchronously and does not resend a confirmed command", async () => {
    let finish!: (value: { receipt: typeof receipt; replayed: boolean }) => void;
    submit.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => useCategoryCommand(true));
    let pending!: Promise<unknown>;
    act(() => { pending = result.current.submit(command); void result.current.submit(command); });
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ receipt, replayed: false }); await pending; });
    await act(async () => { expect(await result.current.retry()).toBeNull(); });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(result.current.state.kind).toBe("saved");
  });
  it("permits a reviewed new intent after a definite version conflict", async () => {
    submit.mockRejectedValueOnce({ status: 409, code: "TRADE.CONCURRENCY.STALE_VERSION" })
      .mockResolvedValueOnce({ receipt, replayed: false });
    const { result } = renderHook(() => useCategoryCommand(true));
    await act(async () => { await result.current.submit(command); });
    expect(result.current.state.kind).toBe("rejected");
    await act(async () => { await result.current.submit({ ...command, version: 2 }); });
    expect(submit.mock.calls[1][0].key).not.toBe(submit.mock.calls[0][0].key);
    expect(submit.mock.calls[1][0].ifMatch).toBe('"2"');
  });
  it("requires current write admission even for same-key recovery", async () => {
    submit.mockRejectedValue({ status: 504 });
    const { result, rerender } = renderHook(({ enabled }) => useCategoryCommand(enabled), { initialProps: { enabled: true } });
    await act(async () => { await result.current.submit(command); });
    rerender({ enabled: false });
    await act(async () => { expect(await result.current.retry()).toBeNull(); });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(result.current.state.kind).toBe("uncertain");
  });
});
