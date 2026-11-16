// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { AcquisitionSource } from "../acquisition-source-contract";
import { useMoveAcquisitionSourceForm } from "./useMoveAcquisitionSourceForm";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en", dir: "ltr" }) }));
afterEach(cleanup);
const items: AcquisitionSource[] = ["Website", "Facebook", "Referral"].map((nameEn, index) => ({
  id: `01902001-3000-7000-8000-00000000000${index + 1}`, nameAr: `مصدر ${index + 1}`, nameEn,
  sortOrder: index + 1, isActive: index !== 1, iconUrl: null,
  createdAt: "2026-08-25T10:00:00.000Z", updatedAt: "2026-08-25T10:00:00.000Z",
}));

describe("move acquisition source form", () => {
  it("offers positions for the full catalogue including inactive sources and previews the insertion", () => {
    const { result } = renderHook(() => useMoveAcquisitionSourceForm(items[2], items, false, false, vi.fn(), vi.fn()));
    expect(result.current.positions.map(({ value }) => value)).toEqual(["1", "2", "3"]);
    expect(result.current.currentPosition).toBe("3");
    expect(result.current.submitDisabled).toBe(true);
    act(() => result.current.setPosition("2"));
    expect(result.current.preview).toContain("Facebook");
    expect(result.current.submitDisabled).toBe(false);
  });

  it("retains a rejected selection and closes only after confirmed success", async () => {
    const send = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const close = vi.fn();
    const { result } = renderHook(() => useMoveAcquisitionSourceForm(items[2], items, false, false, close, send));
    act(() => result.current.setPosition("1"));
    await act(async () => { await result.current.submit(); });
    expect(result.current.position).toBe("1");
    expect(close).not.toHaveBeenCalled();
    await act(async () => { await result.current.submit(); });
    expect(send).toHaveBeenNthCalledWith(1, 1);
    expect(send).toHaveBeenNthCalledWith(2, 1);
    expect(close).toHaveBeenCalledOnce();
  });

  it.each(["0", "4", "1.5", "", "2e0"])("rejects an invalid position %s without a write", async (position) => {
    const send = vi.fn();
    const { result } = renderHook(() => useMoveAcquisitionSourceForm(items[2], items, false, false, vi.fn(), send));
    act(() => result.current.setPosition(position));
    await act(async () => { await result.current.submit(); });
    expect(send).not.toHaveBeenCalled();
    expect(result.current.error).toBe(en.crmAcquisitionSources.positionInvalid);
  });

  it("does not write a no-op, a stale missing source, or a blocked form", async () => {
    const send = vi.fn();
    const { result, rerender } = renderHook(({ source, blocked }) =>
      useMoveAcquisitionSourceForm(source, items, false, blocked, vi.fn(), send),
    { initialProps: { source: items[2], blocked: false } });
    await act(async () => { await result.current.submit(); });
    act(() => result.current.setPosition("1"));
    rerender({ source: items[2], blocked: true });
    await act(async () => { await result.current.submit(); });
    rerender({ source: { ...items[2], id: "01902001-3000-7000-8000-000000000099" }, blocked: false });
    act(() => result.current.setPosition("1"));
    await act(async () => { await result.current.submit(); });
    expect(send).not.toHaveBeenCalled();
  });

  it("serializes submissions and cannot close a different source after completion", async () => {
    let finish!: (saved: boolean) => void;
    const send = vi.fn(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    const close = vi.fn();
    const { result, rerender } = renderHook(({ source }) =>
      useMoveAcquisitionSourceForm(source, items, false, false, close, send), { initialProps: { source: items[2] } });
    act(() => result.current.setPosition("1"));
    let first!: Promise<boolean>;
    act(() => { first = result.current.submit(); });
    await act(async () => { await result.current.submit(); });
    expect(send).toHaveBeenCalledOnce();
    rerender({ source: items[1] });
    expect(result.current.position).toBe("2");
    await act(async () => { finish(true); await first; });
    expect(close).not.toHaveBeenCalled();
  });

  it("releases its local pending guard after a thrown submit and does not close on unmount", async () => {
    let finish!: (saved: boolean) => void;
    const send = vi.fn().mockRejectedValueOnce(new Error("Rejected"))
      .mockImplementationOnce(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    const close = vi.fn();
    const { result, unmount } = renderHook(() => useMoveAcquisitionSourceForm(items[2], items, false, false, close, send));
    act(() => result.current.setPosition("1"));
    await act(async () => { await expect(result.current.submit()).rejects.toThrow("Rejected"); });
    let pending!: Promise<boolean>;
    act(() => { pending = result.current.submit(); });
    unmount();
    await act(async () => { finish(true); await pending; });
    expect(send).toHaveBeenCalledTimes(2);
    expect(close).not.toHaveBeenCalled();
  });
});
