// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ command: vi.fn(), replacePrices: vi.fn() }));
vi.mock("../api/addons.api", () => ({ addonsApi: mocks }));
import { useAddonMutation, type AddonWrite } from "./useAddonMutation";
import { addonIds, addonReceiptFixture } from "../lib/addon-test-fixtures";
const write: AddonWrite = { type: "definition", addonKey: "crm.logistics", command: { kind: "CREATE", body: { key: "crm.logistics", name: "Logistics", description: "Not persisted" } } };
const unknown = { isNormalized: true, httpStatus: 503, errorCode: "UNAVAILABLE", message: "Unavailable", correlationId: addonIds.key };
beforeEach(() => { sessionStorage.clear(); vi.clearAllMocks(); });
afterEach(cleanup);
describe("Durable addon command identity", () => {
  it("reuses the exact key after an ambiguous transport error", async () => {
    mocks.command.mockRejectedValueOnce(unknown).mockResolvedValueOnce(addonReceiptFixture());
    const { result } = renderHook(() => useAddonMutation("crm", "CREATE", addonIds.app));
    await act(async () => { await result.current.submit(write); });
    expect(result.current.canRetry).toBe(true);
    await act(async () => { await result.current.retry(); });
    expect(mocks.command.mock.calls[1][3]).toBe(mocks.command.mock.calls[0][3]);
    expect(result.current.pending).toBeNull();
  });
  it("does not persist request values or allow a changed pending command", async () => {
    mocks.command.mockRejectedValue(unknown);
    const { result } = renderHook(() => useAddonMutation("crm", "CREATE", addonIds.app));
    await act(async () => { await result.current.submit(write); });
    const stored = sessionStorage.getItem(`admin.addons.command:${addonIds.app}:crm:CREATE`)!;
    expect(stored).toContain("intentSha256"); expect(stored).not.toContain("Not persisted"); expect(stored).not.toContain('"name"');
    await act(async () => { await result.current.submit({ ...write, command: { kind: "CREATE", body: { ...write.command.body, name: "Changed" } } } as AddonWrite); });
    expect(mocks.command).toHaveBeenCalledOnce(); expect(result.current.pending).not.toBeNull();
  });
  it("reuses a pending key after remount only for the same actor and exact payload", async () => {
    mocks.command.mockRejectedValueOnce(unknown).mockResolvedValue(addonReceiptFixture());
    const first = renderHook(() => useAddonMutation("crm", "CREATE", addonIds.app));
    await act(async () => { await first.result.current.submit(write); });
    const originalKey = mocks.command.mock.calls[0][3]; first.unmount();
    const second = renderHook(() => useAddonMutation("crm", "CREATE", addonIds.app));
    await act(async () => { await second.result.current.submit(write); });
    expect(mocks.command.mock.calls[1][3]).toBe(originalKey);
  });
  it("isolates identities between actors", async () => {
    mocks.command.mockRejectedValue(unknown);
    const first = renderHook(() => useAddonMutation("crm", "CREATE", addonIds.app));
    await act(async () => { await first.result.current.submit(write); }); first.unmount();
    const second = renderHook(() => useAddonMutation("crm", "CREATE", addonIds.addon));
    await act(async () => { await second.result.current.submit(write); });
    expect(mocks.command.mock.calls[1][3]).not.toBe(mocks.command.mock.calls[0][3]);
  });
  it("retains an earlier unknown journal when unmounted while preparing an exact retry", async () => {
    mocks.command.mockRejectedValue(unknown);
    const first = renderHook(() => useAddonMutation("crm", "CREATE", addonIds.app));
    await act(async () => { await first.result.current.submit(write); });
    const storageKey = `admin.addons.command:${addonIds.app}:crm:CREATE`;
    const pending = sessionStorage.getItem(storageKey);
    first.unmount();
    const second = renderHook(() => useAddonMutation("crm", "CREATE", addonIds.app));
    await act(async () => { const preparing = second.result.current.submit(write); second.unmount(); await preparing; });
    expect(mocks.command).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem(storageKey)).toBe(pending);
  });
  it.each([403, 409, 422])("retires a definitively rejected command (%s)", async httpStatus => {
    mocks.command.mockRejectedValue({ ...unknown, httpStatus, errorCode: "ADDON_CATALOGUE_REVISION_STALE" });
    const { result } = renderHook(() => useAddonMutation("crm", "CREATE", addonIds.app));
    await act(async () => { await result.current.submit(write); }); expect(result.current.pending).toBeNull();
    await act(async () => { await result.current.submit(write); });
    expect(mocks.command.mock.calls[1][3]).not.toBe(mocks.command.mock.calls[0][3]);
  });
  it.each(["GW.IDEM.IN_FLIGHT", "COMMERCIAL_RESPONSE_UNAVAILABLE"])("retains uncertain outcome %s", async errorCode => {
    mocks.command.mockRejectedValue({ ...unknown, httpStatus: errorCode === "GW.IDEM.IN_FLIGHT" ? 409 : 503, errorCode });
    const { result } = renderHook(() => useAddonMutation("crm", "CREATE", addonIds.app));
    await act(async () => { await result.current.submit(write); }); expect(result.current.pending).not.toBeNull();
  });
  it("does not dispatch twice on a double submit", async () => {
    mocks.command.mockResolvedValue(addonReceiptFixture());
    const { result } = renderHook(() => useAddonMutation("crm", "CREATE", addonIds.app));
    await act(async () => { await Promise.all([result.current.submit(write), result.current.submit(write)]); });
    expect(mocks.command).toHaveBeenCalledOnce();
  });
});
