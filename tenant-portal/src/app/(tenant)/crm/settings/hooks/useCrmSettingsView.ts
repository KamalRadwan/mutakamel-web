"use client";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useCrmSettings } from "./useCrmSettings";
import { editableAsterisk, type AsteriskDraft, type IceServerDraft, type ServerListKey } from "../asterisk-contract";

export function useCrmSettingsView() {
  const model = useCrmSettings();
  const guard = useUnsavedChangesGuard(model.isDirty || model.isSaving || model.needsReview);
  const setAsterisk = <K extends keyof AsteriskDraft>(key: K, value: AsteriskDraft[K]) => {
    if (!model.canManage || model.isSaving) return;
    model.setDraft((current) => current && model.settings ? { ...current,
      asteriskIntegration: { ...(current.asteriskIntegration ?? editableAsterisk(model.settings.asteriskIntegration)), [key]: value } } : current);
  };
  const replaceList = (key: ServerListKey, enabled: boolean) => {
    if (!model.canManage || model.isSaving) return;
    model.setDraft((current) => {
      if (!current || !model.settings) return current;
      const a = current.asteriskIntegration ?? editableAsterisk(model.settings.asteriskIntegration);
      const flag = key === "turnServers" ? "replaceTurnServers" : "replaceIceServers";
      return { ...current, asteriskIntegration: { ...a, [flag]: enabled,
        [key]: enabled ? a[key] : editableAsterisk(model.settings.asteriskIntegration)[key] } };
    });
  };
  const updateServer = (key: ServerListKey, index: number, patch: Partial<IceServerDraft>) => {
    const a = model.draft?.asteriskIntegration;
    if (!a) return;
    setAsterisk(key, (a[key] ?? []).map((s, i) => i === index ? { ...s, ...patch } : s));
  };
  const addServer = (key: ServerListKey) => {
    const rows = model.draft?.asteriskIntegration?.[key] ?? [];
    if (rows.length < 16) setAsterisk(key, [...rows, { urls: [""], hasCredential: false }]);
  };
  const removeServer = (key: ServerListKey, index: number) => {
    setAsterisk(key, model.draft?.asteriskIntegration?.[key]?.filter((_, i) => i !== index) ?? []);
  };
  const setQualification = (value: boolean) => {
    if (model.canManage && !model.isSaving) model.setDraft((d) => d && { ...d, requireQualifiedStageForConversion: value });
  };
  const setRetention = (value: number) => {
    if (model.canManage && !model.isSaving) model.setDraft((d) => d && { ...d, outboundEmailContentRetentionDays: value });
  };
  return { ...model, guard, setAsterisk, replaceList, updateServer, addServer, removeServer, setQualification, setRetention,
    discard: () => guard.requestDiscard(model.resetDraft),
    reload: () => guard.requestDiscard(() => { void model.fetchSettings(); }),
    openTelephony: () => model.setTelephonyOpen(true),
    closeTelephony: (open: boolean) => { if (!model.isSaving) model.setTelephonyOpen(open); },
  };
}
export type CrmSettingsView = ReturnType<typeof useCrmSettingsView>;
