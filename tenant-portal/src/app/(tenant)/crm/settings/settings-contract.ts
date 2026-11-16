import { isUUIDv7 } from "@/lib/uuid";
import { buildAsteriskPatch, editableAsterisk, parseAsterisk, settingsRecord,
  type AsteriskSettings, type AsteriskDraft, type AsteriskPatch } from "./asterisk-contract";
export interface CrmSettings {
  id: string; requireQualifiedStageForConversion: boolean; defaultPipelineId: string;
  outboundEmailContentRetentionDays: number; outboundEmailRetentionPolicyRevision: number;
  asteriskIntegration: AsteriskSettings;
}
export interface EditableCrmSettings {
  requireQualifiedStageForConversion: boolean; outboundEmailContentRetentionDays: number;
  asteriskIntegration?: AsteriskDraft;
}
export type CrmSettingsPatch = Partial<Omit<EditableCrmSettings, "asteriskIntegration">> & {
  expectedOutboundEmailRetentionPolicyRevision?: number; asteriskIntegration?: AsteriskPatch;
};
export function parseCrmSettingsResponse(payload: unknown): CrmSettings {
  const row = settingsRecord(payload);
  if (!isUUIDv7(row.id) || !isUUIDv7(row.defaultPipelineId) ||
    typeof row.requireQualifiedStageForConversion !== "boolean" ||
    !Number.isInteger(row.outboundEmailContentRetentionDays) ||
    (row.outboundEmailContentRetentionDays as number) < 30 || (row.outboundEmailContentRetentionDays as number) > 2555 ||
    !Number.isSafeInteger(row.outboundEmailRetentionPolicyRevision) || (row.outboundEmailRetentionPolicyRevision as number) < 1) {
    throw new Error("INVALID_CRM_SETTINGS_RESPONSE");
  }
  return { id: row.id, defaultPipelineId: row.defaultPipelineId,
    requireQualifiedStageForConversion: row.requireQualifiedStageForConversion,
    outboundEmailContentRetentionDays: row.outboundEmailContentRetentionDays as number,
    outboundEmailRetentionPolicyRevision: row.outboundEmailRetentionPolicyRevision as number,
    asteriskIntegration: parseAsterisk(row.asteriskIntegration) };
}
export function editableSettings(settings: CrmSettings): EditableCrmSettings {
  return { requireQualifiedStageForConversion: settings.requireQualifiedStageForConversion,
    outboundEmailContentRetentionDays: settings.outboundEmailContentRetentionDays,
    asteriskIntegration: editableAsterisk(settings.asteriskIntegration) };
}
export function buildCrmSettingsPatch(current: CrmSettings, draft: EditableCrmSettings): CrmSettingsPatch {
  if (!Number.isInteger(draft.outboundEmailContentRetentionDays) || draft.outboundEmailContentRetentionDays < 30 || draft.outboundEmailContentRetentionDays > 2555) {
    throw new RangeError("CRM_SETTINGS_RETENTION_INVALID");
  }
  const patch: CrmSettingsPatch = {};
  if (draft.requireQualifiedStageForConversion !== current.requireQualifiedStageForConversion) patch.requireQualifiedStageForConversion = draft.requireQualifiedStageForConversion;
  if (draft.outboundEmailContentRetentionDays !== current.outboundEmailContentRetentionDays) {
    patch.outboundEmailContentRetentionDays = draft.outboundEmailContentRetentionDays;
    patch.expectedOutboundEmailRetentionPolicyRevision = current.outboundEmailRetentionPolicyRevision;
  }
  if (draft.asteriskIntegration) {
    const asterisk = buildAsteriskPatch(current.asteriskIntegration, draft.asteriskIntegration);
    if (Object.keys(asterisk).length) patch.asteriskIntegration = asterisk;
  }
  return patch;
}
export function settingsDirty(current: CrmSettings | null, draft: EditableCrmSettings | null): boolean {
  if (!current || !draft) return false;
  try { return Object.keys(buildCrmSettingsPatch(current, draft)).length > 0; }
  catch { return true; }
}

/** Rebase only the user's changes; refreshed fields are never silently written back. */
export function rebaseSettingsDraft(previous: CrmSettings, next: CrmSettings, draft: EditableCrmSettings): EditableCrmSettings {
  const result: EditableCrmSettings = {
    requireQualifiedStageForConversion: draft.requireQualifiedStageForConversion === previous.requireQualifiedStageForConversion
      ? next.requireQualifiedStageForConversion : draft.requireQualifiedStageForConversion,
    outboundEmailContentRetentionDays: Object.is(draft.outboundEmailContentRetentionDays, previous.outboundEmailContentRetentionDays)
      ? next.outboundEmailContentRetentionDays : draft.outboundEmailContentRetentionDays,
  };
  if (draft.asteriskIntegration) {
    const changes = buildAsteriskPatch(previous.asteriskIntegration, draft.asteriskIntegration);
    const a = editableAsterisk(next.asteriskIntegration);
    for (const key of Object.keys(changes) as (keyof AsteriskDraft)[]) {
      Object.assign(a, { [key]: draft.asteriskIntegration[key] });
    }
    if (draft.asteriskIntegration.replaceTurnServers) { a.turnServers = draft.asteriskIntegration.turnServers; a.replaceTurnServers = true; }
    if (draft.asteriskIntegration.replaceIceServers) { a.iceServers = draft.asteriskIntegration.iceServers; a.replaceIceServers = true; }
    result.asteriskIntegration = a;
  }
  return result;
}
