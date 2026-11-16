"use client";

import { useEffect, useRef, useState } from "react";
import { toast as sonnerToast } from "sonner";
import { TENANT_REALTIME_SHELL_EVENTS } from "@/context/TenantRealtimeProvider";
import { useI18n } from "@/i18n/I18nContext";
import { useLanguage } from "@/i18n/useLanguage";
import { INTL_LOCALE } from "@/lib/format/locale";
import { notificationText } from "@/lib/notifications/notification-presentation";
import { tenantNotificationRuntime } from "@/lib/notifications/tenant-notification-runtime";
import { safeStorage } from "@/lib/safeStorage";

const SOUND_KEY = "tenant-notification-sound";
const NOTIFICATION_TOAST_DURATION_MS = 30_000;

export function useNotificationAlerts(generation: string | null) {
  const { t } = useI18n();
  const lang = useLanguage();
  const copy = useRef({ t, locale: INTL_LOCALE[lang] });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const enabled = useRef(true);
  const audio = useRef<AudioContext | null>(null);

  useEffect(() => { copy.current = { t, locale: INTL_LOCALE[lang] }; }, [t, lang]);

  useEffect(() => {
    const saved = safeStorage.getItem(SOUND_KEY) !== "off";
    enabled.current = saved;
    queueMicrotask(() => setSoundEnabled(saved));
  }, []);

  useEffect(() => {
    if (!generation) return;
    const seen = new Set(tenantNotificationRuntime.getSnapshot().items.map((item) => item.id));
    const toastTimers = new Map<string, ReturnType<typeof setTimeout>>();
    function unlock() {
      if (!enabled.current || !window.AudioContext) return;
      try {
        audio.current ??= new AudioContext();
        void audio.current.resume().catch(() => {});
      } catch { /* Sound availability must not interrupt the inbox. */ }
    }
    function onCreated(event: Event) {
      if (!(event instanceof CustomEvent) || tenantNotificationRuntime.getSnapshot().generation !== generation) return;
      const detail: unknown = event.detail;
      if (!detail || typeof detail !== "object" || !("payload" in detail)) return;
      const payload = detail.payload;
      if (!payload || typeof payload !== "object" || !("notificationId" in payload) || !("createdAt" in payload)) return;
      if (!payload || typeof payload.notificationId !== "string" || seen.has(payload.notificationId)) return;
      seen.add(payload.notificationId);
      if (seen.size > 1_000) seen.delete(seen.values().next().value!);
      // Resync/replayed history and silent events must not ring again.
      const age = typeof payload.createdAt === "string" ? Date.now() - Date.parse(payload.createdAt) : NaN;
      const item = tenantNotificationRuntime.getSnapshot().items.find((row) => row.id === payload.notificationId);
      if (!item || item.readAt !== null || ("silent" in payload && payload.silent) || !Number.isFinite(age) || age < -5_000 || age > 60_000) return;
      const { t: dictionary, locale } = copy.current;
      const text = notificationText(item, dictionary.audit.recordMessages, dictionary.coreNotifications, dictionary.activities.types, locale);
      const toastId = `notification:${item.id}`;
      window.dispatchEvent(new CustomEvent("global-toast", { detail: {
        type: "info", title: text.title, message: text.body,
        duration: NOTIFICATION_TOAST_DURATION_MS, dedupeKey: toastId,
      } }));
      // Sonner pauses its timer while hovered. This notification has the
      // requested fixed lifetime, even when the pointer stays over it.
      toastTimers.set(toastId, setTimeout(() => {
        sonnerToast.dismiss(toastId);
        toastTimers.delete(toastId);
      }, NOTIFICATION_TOAST_DURATION_MS));
      const context = audio.current;
      if (!enabled.current || !context || context.state !== "running") return;
      const start = context.currentTime;
      for (const [index, frequency] of [660, 880].entries()) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start + index * 0.14);
        gain.gain.linearRampToValueAtTime(0.12, start + index * 0.14 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + index * 0.14 + 0.2);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(start + index * 0.14);
        oscillator.stop(start + index * 0.14 + 0.22);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      }
    }
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    window.addEventListener(TENANT_REALTIME_SHELL_EVENTS.notificationCreated, onCreated);
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
      window.removeEventListener(TENANT_REALTIME_SHELL_EVENTS.notificationCreated, onCreated);
      for (const [id, timer] of toastTimers) { clearTimeout(timer); sonnerToast.dismiss(id); }
      void audio.current?.close().catch(() => {});
      audio.current = null;
    };
  }, [generation]);

  function toggleSound() {
    enabled.current = !enabled.current;
    setSoundEnabled(enabled.current);
    safeStorage.setItem(SOUND_KEY, enabled.current ? "on" : "off");
    if (enabled.current && window.AudioContext) {
      try {
        audio.current ??= new AudioContext();
        void audio.current.resume().catch(() => {});
      } catch { /* Keep the visual notification usable when audio is unavailable. */ }
    }
  }
  return { soundEnabled, toggleSound };
}
