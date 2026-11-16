import type { Dictionary } from "@/i18n/dictionaries/ar";
import { ASTERISK_TEXT_LIMITS, type AsteriskTextKey } from "./asterisk-contract";
import type { EditableCrmSettings } from "./settings-contract";
export type SettingsErrors = Record<string, string>;
export function validateSettings(draft: EditableCrmSettings | null, labels: Dictionary["crmSettings"]): SettingsErrors {
  const errors: SettingsErrors = {};
  if (!draft) return errors;
  if (!Number.isInteger(draft.outboundEmailContentRetentionDays) || draft.outboundEmailContentRetentionDays < 30 || draft.outboundEmailContentRetentionDays > 2555) errors.retention = labels.retentionHelp;
  const a = draft.asteriskIntegration;
  if (!a) return errors;
  const limit = (key: string, value: string | null | undefined, max: number) => {
    if (value && [...value].length > max) errors[key] = labels.maxCharacters.replace("{max}", String(max));
  };
  for (const key of Object.keys(ASTERISK_TEXT_LIMITS) as AsteriskTextKey[]) limit(key, a[key], ASTERISK_TEXT_LIMITS[key]);
  if (a.websocketUrl && !/^wss?:\/\//i.test(a.websocketUrl)) errors.websocketUrl = labels.websocketHelp;
  if (a.registerExpires != null && (!Number.isInteger(a.registerExpires) || a.registerExpires < 60 || a.registerExpires > 86400)) errors.registerExpires = labels.registrationHelp;
  if ((a.stunServers?.length ?? 0) > 16 || a.stunServers?.some((v) => [...v].length > 512)) errors.stunServers = labels.stunHelp;
  for (const key of ["turnServers", "iceServers"] as const) {
    if (!(key === "turnServers" ? a.replaceTurnServers : a.replaceIceServers)) continue;
    if ((a[key]?.length ?? 0) > 16) errors[key] = labels.serverHelp;
    a[key]?.forEach((server, i) => {
      const prefix = `${key}.${i}`;
      if (!server.urls.length || server.urls.length > 8 || server.urls.some((v) => !v || [...v].length > 512)) errors[`${prefix}.urls`] = labels.serverHelp;
      limit(`${prefix}.username`, server.username, 128);
      limit(`${prefix}.credential`, server.credential, 256);
      if (server.hasCredential && !server.credential && !server.clearCredential) errors[`${prefix}.credential`] = labels.credentialDecision;
    });
  }
  return errors;
}
