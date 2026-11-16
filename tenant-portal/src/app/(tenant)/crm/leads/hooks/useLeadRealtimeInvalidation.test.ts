// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  clearTenantLeadRealtime,
  publishTenantLeadRealtime,
} from "@/context/tenant-lead-realtime";
import { useLeadRealtimeInvalidation } from "./useLeadRealtimeInvalidation";

const generation = "tenant:session-a:user-a";
const branchId = "branch-a";
const payload = {
  tenantId: "tenant-a", branchId, leadId: "unloaded-lead",
  revision: "9007199254740993", changeKind: "UPDATED" as const,
};
function changed(patch: Partial<typeof payload> = {}, auth = generation) {
  act(() => publishTenantLeadRealtime({ generation: auth, kind: "changed", payload: { ...payload, ...patch } }));
}
async function advance(ms = 200) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  clearTenantLeadRealtime();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("debounces unloaded IDs and uses the latest reconciliation without resetting the timer", async () => {
  const reconcile = vi.fn().mockResolvedValue(true);
  const next = vi.fn().mockResolvedValue(true);
  const view = renderHook((props) => useLeadRealtimeInvalidation(props), {
    initialProps: { generation, branchId, reconcile },
  });
  changed();
  await advance(150);
  changed({ revision: "9007199254740994" });
  view.rerender({ generation, branchId, reconcile: next });
  await advance(199);
  expect(next).not.toHaveBeenCalled();
  await advance(1);
  expect(next).toHaveBeenCalledTimes(1);
  expect(reconcile).not.toHaveBeenCalled();
});

it("enforces maximum wait during a continuous burst", async () => {
  const reconcile = vi.fn().mockResolvedValue(true);
  renderHook(() => useLeadRealtimeInvalidation({ generation, branchId, reconcile }));
  for (let n = 0; n < 10; n += 1) {
    changed({ revision: String(100 + n) });
    await advance(100);
  }
  expect(reconcile).toHaveBeenCalledTimes(1);
});

it("keeps one request in flight and runs one trailing refresh", async () => {
  let finish!: () => void;
  const reconcile = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }))
    .mockResolvedValue(true);
  renderHook(() => useLeadRealtimeInvalidation({ generation, branchId, reconcile }));
  changed();
  await advance();
  changed({ revision: "9007199254740994" });
  changed({ revision: "9007199254740995" });
  await advance(2_000);
  expect(reconcile).toHaveBeenCalledTimes(1);
  await act(async () => { finish(); });
  expect(reconcile).toHaveBeenCalledTimes(2);
  await advance(2_000);
  expect(reconcile).toHaveBeenCalledTimes(2);
});

it("deduplicates large revisions and reordered events but keeps equal-revision deletion", async () => {
  const reconcile = vi.fn().mockResolvedValue(true);
  renderHook(() => useLeadRealtimeInvalidation({ generation, branchId, reconcile }));
  changed();
  await advance();
  changed();
  changed({ revision: "9007199254740992" });
  await advance();
  expect(reconcile).toHaveBeenCalledTimes(1);
  act(() => publishTenantLeadRealtime({ generation, kind: "changed", payload: { ...payload, changeKind: "DELETED" } }));
  await advance();
  expect(reconcile).toHaveBeenCalledTimes(2);
});

it("bounds revision memory and clears it on resync", async () => {
  const reconcile = vi.fn().mockResolvedValue(true);
  renderHook(() => useLeadRealtimeInvalidation({ generation, branchId, reconcile }));
  for (let n = 0; n < 513; n += 1) changed({ leadId: `lead-${n}` });
  await advance();
  changed({ leadId: "lead-0" });
  await advance();
  expect(reconcile).toHaveBeenCalledTimes(2);
  act(() => publishTenantLeadRealtime({ generation, kind: "resync" }));
  await advance();
  changed({ leadId: "lead-0" });
  await advance();
  expect(reconcile).toHaveBeenCalledTimes(4);
});

it("fences branches and generations, cancels timers and aborts in-flight work", async () => {
  const reconcile = vi.fn().mockImplementation(() => new Promise<void>(() => undefined));
  const view = renderHook((props) => useLeadRealtimeInvalidation(props), {
    initialProps: { generation, branchId, reconcile },
  });
  changed({ branchId: "branch-b" });
  changed({}, "old-session");
  await advance();
  expect(reconcile).not.toHaveBeenCalled();
  changed();
  view.rerender({ generation, branchId: "branch-b", reconcile });
  await advance();
  expect(reconcile).not.toHaveBeenCalled();
  changed({ branchId: "branch-b" });
  await advance();
  const signal = reconcile.mock.calls[0][0] as AbortSignal;
  view.rerender({ generation: "new-session", branchId: "branch-b", reconcile });
  expect(signal.aborted).toBe(true);
  changed({ branchId: "branch-b" }, "new-session");
  view.unmount();
  await advance(2_000);
  expect(reconcile).toHaveBeenCalledTimes(1);
});

it("does not trail an old request after the branch changes", async () => {
  let finish!: () => void;
  const reconcile = vi.fn().mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  const view = renderHook((props) => useLeadRealtimeInvalidation(props), {
    initialProps: { generation, branchId, reconcile },
  });
  changed();
  await advance();
  changed({ revision: "9007199254740994" });
  view.rerender({ generation, branchId: "branch-b", reconcile });
  await act(async () => { finish(); });
  await advance(2_000);
  expect(reconcile).toHaveBeenCalledTimes(1);
});

it("recovers on readiness before/after mount, reconnect and ID-free resync", async () => {
  const reconcile = vi.fn().mockResolvedValue(true);
  publishTenantLeadRealtime({ generation, kind: "ready" });
  renderHook(() => useLeadRealtimeInvalidation({ generation, branchId, reconcile }));
  await advance();
  expect(reconcile).toHaveBeenCalledTimes(1);
  act(() => publishTenantLeadRealtime({ generation, kind: "ready" }));
  await advance();
  act(() => publishTenantLeadRealtime({ generation, kind: "resync" }));
  await advance();
  expect(reconcile).toHaveBeenCalledTimes(3);
});

it("defers hidden/offline changes and coalesces foreground/online recovery", async () => {
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  const reconcile = vi.fn().mockResolvedValue(true);
  renderHook(() => useLeadRealtimeInvalidation({ generation, branchId, reconcile }));
  changed();
  await advance(1_000);
  expect(reconcile).not.toHaveBeenCalled();
  visibility.mockReturnValue("visible");
  online.mockReturnValue(true);
  act(() => {
    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("pageshow"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await advance();
  expect(reconcile).toHaveBeenCalledTimes(1);
});

it("does not auto-retry an API denial and remains recoverable on focus", async () => {
  const reconcile = vi.fn().mockRejectedValue({ status: 403 });
  renderHook(() => useLeadRealtimeInvalidation({ generation, branchId, reconcile }));
  changed();
  await advance(10_000);
  expect(reconcile).toHaveBeenCalledTimes(1);
  act(() => window.dispatchEvent(new Event("focus")));
  await advance();
  expect(reconcile).toHaveBeenCalledTimes(2);
});
