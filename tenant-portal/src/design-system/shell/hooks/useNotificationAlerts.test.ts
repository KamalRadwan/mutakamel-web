// @vitest-environment jsdom
import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { en } from "@/i18n/dictionaries/en";
import { ar, type Dictionary } from "@/i18n/dictionaries/ar";
import type { TenantNotification } from "@/lib/notifications/tenant-notification-runtime";
import { useNotificationAlerts } from "./useNotificationAlerts";

const state = vi.hoisted(() => ({ generation: "test-session" as string | null, items: [] as TenantNotification[] }));
let dictionary: Dictionary = en;
let language: "en" | "ar" = "en";
vi.mock("sonner", () => ({ toast: { dismiss: vi.fn() } }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionary }) }));
vi.mock("@/i18n/useLanguage", () => ({ useLanguage: () => language }));
vi.mock("@/context/TenantRealtimeProvider", () => ({ TENANT_REALTIME_SHELL_EVENTS: { notificationCreated: "notification-created" } }));
vi.mock("@/lib/notifications/tenant-notification-runtime", () => ({ tenantNotificationRuntime: { getSnapshot: () => state } }));
const oscillatorStart = vi.fn();
const contextClose = vi.fn().mockResolvedValue(undefined);
const resume = vi.fn().mockResolvedValue(undefined);

class TestAudioContext {
  state = "running"; currentTime = 0; destination = {};
  resume = resume; close = contextClose;
  createOscillator() { return { frequency: { value: 0 }, connect: (gain: unknown) => gain, start: oscillatorStart, stop: vi.fn(), disconnect: vi.fn(), onended: null }; }
  createGain() { return { gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() }; }
}
function receive(id: string, overrides = {}) {
  state.items.push(notification(id));
  window.dispatchEvent(new CustomEvent("notification-created", { detail: { payload: { notificationId: id, createdAt: new Date().toISOString(), ...overrides } } }));
}
function notification(id: string): TenantNotification {
  return { id, recipientId: id, sourceApp: "core", notificationType: "core.activity.reminder", priority: "P2_NORMAL",
    title: "Review proposal", body: "Review pricing", actionUrl: null, entityType: "activity", entityId: id,
    channels: ["IN_APP"], metadata: { activitySubject: "Review proposal", activityType: "CALL", dueAt: "2026-11-04T20:22:00Z", reminderOffsetMinutes: 2 },
    createdAt: new Date().toISOString(), readAt: null, acknowledgedAt: null, deliveredAt: null, recipientStateVersion: 0 };
}
beforeEach(() => { dictionary = en; language = "en"; state.generation = "test-session"; state.items = []; localStorage.clear(); vi.stubGlobal("AudioContext", TestAudioContext); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe("notification sound", () => {
  it("plays a single chime for a new event after interaction, and never repeats it on replay", () => {
    renderHook(() => useNotificationAlerts(state.generation));
    fireEvent.pointerDown(document);
    act(() => { receive("new"); receive("new"); });
    expect(oscillatorStart).toHaveBeenCalledTimes(2);
  });
  it("does not ring for retained history, silent events, replayed history or before audio unlock", () => {
    state.items = [notification("retained")];
    renderHook(() => useNotificationAlerts(state.generation));
    act(() => receive("before-unlock"));
    fireEvent.keyDown(document, { key: "Enter" });
    act(() => { receive("retained"); receive("silent", { silent: true }); receive("old", { createdAt: "2020-01-01T00:00:00Z" }); });
    expect(oscillatorStart).not.toHaveBeenCalled();
  });
  it("persists mute, permits enabling it and cleans up audio on unmount", async () => {
    localStorage.setItem("tenant-notification-sound", "off");
    const hook = renderHook(() => useNotificationAlerts(state.generation));
    await act(async () => {});
    expect(hook.result.current.soundEnabled).toBe(false);
    fireEvent.pointerDown(document);
    act(() => receive("muted"));
    expect(oscillatorStart).not.toHaveBeenCalled();
    act(() => hook.result.current.toggleSound());
    expect(localStorage.getItem("tenant-notification-sound")).toBe("on");
    act(() => receive("audible"));
    expect(oscillatorStart).toHaveBeenCalledTimes(2);
    hook.unmount();
    expect(contextClose).toHaveBeenCalledOnce();
    act(() => receive("after-cleanup"));
    expect(oscillatorStart).toHaveBeenCalledTimes(2);
  });
  it("ignores obsolete auth generations and unsupported audio", () => {
    vi.stubGlobal("AudioContext", undefined);
    renderHook(() => useNotificationAlerts(state.generation));
    fireEvent.pointerDown(document);
    state.generation = "replacement";
    act(() => receive("obsolete"));
    expect(oscillatorStart).not.toHaveBeenCalled();
  });
});

describe("notification toaster", () => {
  it.each(["en", "ar"] as const)("shows localized event details once for 30 seconds, even while sound is muted (%s)", async (locale) => {
    vi.useFakeTimers();
    dictionary = { en, ar }[locale]; language = locale;
    localStorage.setItem("tenant-notification-sound", "off");
    const dispatch = vi.spyOn(window, "dispatchEvent");
    renderHook(() => useNotificationAlerts(state.generation));
    await act(async () => {});
    act(() => { receive("new"); receive("new"); });
    const events = dispatch.mock.calls.map(([event]) => event).filter((event) => event.type === "global-toast");
    expect(events).toHaveLength(1);
    const detail = (events[0] as CustomEvent).detail;
    expect(detail).toMatchObject({ type: "info", duration: 30_000, dedupeKey: "notification:new" });
    expect(detail.title).toContain("Review proposal");
    expect(detail.message).toContain(dictionary.activities.types.CALL);
    act(() => vi.advanceTimersByTime(29_999));
    expect(toast.dismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(toast.dismiss).toHaveBeenCalledWith("notification:new");
    expect(oscillatorStart).not.toHaveBeenCalled();
  });
  it("ignores silent/replayed events and clears visible notification toasts on auth replacement", () => {
    const dispatch = vi.spyOn(window, "dispatchEvent");
    const hook = renderHook(() => useNotificationAlerts(state.generation));
    act(() => { receive("silent", { silent: true }); receive("old", { createdAt: "2020-01-01T00:00:00Z" }); });
    expect(dispatch.mock.calls.filter(([event]) => event.type === "global-toast")).toHaveLength(0);
    act(() => receive("current"));
    state.generation = "replacement";
    hook.rerender();
    expect(toast.dismiss).toHaveBeenCalledWith("notification:current");
  });
});
