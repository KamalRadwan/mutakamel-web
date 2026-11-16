// Exact bounds: crm-app/src/crm/settings/dto/update-crm-settings.dto.ts.
export const ASTERISK_TEXT_LIMITS = {
  websocketUrl: 512, sipDomain: 180, realm: 180, outboundProxy: 512,
  defaultCallerId: 64, fromDomain: 180, registrarServer: 180, contactUri: 255,
} as const;
export type AsteriskTextKey = keyof typeof ASTERISK_TEXT_LIMITS;
export type ServerListKey = "turnServers" | "iceServers";
interface IceServer { urls: string[]; username?: string; hasCredential: boolean }
export type AsteriskSettings = Partial<Record<AsteriskTextKey, string | null>> & {
  enabled: boolean; allowInvalidTlsCertificate: boolean; sessionTimers?: boolean; traceSip?: boolean;
  registerExpires?: number | null; stunServers?: string[]; turnServers?: IceServer[]; iceServers?: IceServer[];
};
export interface IceServerDraft extends IceServer { credential?: string; clearCredential?: boolean }
export type AsteriskDraft = Omit<AsteriskSettings, ServerListKey> & {
  turnServers?: IceServerDraft[]; iceServers?: IceServerDraft[];
  replaceTurnServers?: boolean; replaceIceServers?: boolean;
};
export type AsteriskPatch = Partial<Omit<AsteriskSettings, ServerListKey>> & {
  turnServers?: { urls: string[]; username?: string; credential?: string }[];
  iceServers?: { urls: string[]; username?: string; credential?: string }[];
};
export function settingsRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_CRM_SETTINGS_RESPONSE");
  return value as Record<string, unknown>;
}
function invalid(): never { throw new Error("INVALID_CRM_SETTINGS_RESPONSE"); }
function strings(value: unknown, max: number, maxLength: number, min = 0): string[] {
  if (!Array.isArray(value) || value.length < min || value.length > max ||
    value.some((s) => typeof s !== "string" || [...s].length > maxLength)) invalid();
  return [...value] as string[];
}
function parseServer(value: unknown): IceServer {
  const row = settingsRecord(value);
  if (typeof row.hasCredential !== "boolean" || row.credential !== undefined ||
    (row.username !== undefined && (typeof row.username !== "string" || [...row.username].length > 128))) invalid();
  return { urls: strings(row.urls, 8, 512, 1), hasCredential: row.hasCredential,
    ...(row.username === undefined ? {} : { username: row.username as string }) };
}
export function parseAsterisk(value: unknown): AsteriskSettings {
  const row = value === undefined ? {} : settingsRecord(value);
  const parsed: AsteriskSettings = { enabled: false, allowInvalidTlsCertificate: false };
  for (const key of ["enabled", "sessionTimers", "traceSip", "allowInvalidTlsCertificate"] as const) {
    if (row[key] !== undefined) {
      if (typeof row[key] !== "boolean") invalid();
      parsed[key] = row[key] as boolean;
    }
  }
  for (const key of Object.keys(ASTERISK_TEXT_LIMITS) as AsteriskTextKey[]) {
    const v = row[key];
    if (v !== undefined) {
      if (v !== null && (typeof v !== "string" || [...v].length > ASTERISK_TEXT_LIMITS[key])) invalid();
      if (key === "websocketUrl" && typeof v === "string" && !/^wss?:\/\//i.test(v)) invalid();
      parsed[key] = v as string | null;
    }
  }
  if (row.registerExpires !== undefined) {
    const v = row.registerExpires;
    if (v !== null && (!Number.isInteger(v) || (v as number) < 60 || (v as number) > 86400)) invalid();
    parsed.registerExpires = v as number | null;
  }
  if (row.stunServers !== undefined) parsed.stunServers = strings(row.stunServers, 16, 512);
  for (const key of ["turnServers", "iceServers"] as const) {
    if (row[key] !== undefined) {
      if (!Array.isArray(row[key]) || row[key].length > 16) invalid();
      parsed[key] = (row[key] as unknown[]).map(parseServer);
    }
  }
  return parsed;
}
export function editableAsterisk(value: AsteriskSettings): AsteriskDraft {
  return { ...value, stunServers: value.stunServers && [...value.stunServers],
    turnServers: value.turnServers?.map((s) => ({ ...s, urls: [...s.urls] })),
    iceServers: value.iceServers?.map((s) => ({ ...s, urls: [...s.urls] })) };
}
export function buildAsteriskPatch(current: AsteriskSettings, draft: AsteriskDraft): AsteriskPatch {
  const patch: AsteriskPatch = {};
  for (const key of Object.keys(ASTERISK_TEXT_LIMITS) as AsteriskTextKey[]) {
    if (draft[key] !== current[key]) patch[key] = draft[key];
  }
  for (const key of ["enabled", "sessionTimers", "traceSip", "allowInvalidTlsCertificate"] as const) {
    if (draft[key] !== current[key]) patch[key] = draft[key];
  }
  if (!Object.is(draft.registerExpires, current.registerExpires)) patch.registerExpires = draft.registerExpires;
  if (JSON.stringify(draft.stunServers) !== JSON.stringify(current.stunServers)) patch.stunServers = draft.stunServers;
  for (const key of ["turnServers", "iceServers"] as const) {
    const replacing = key === "turnServers" ? draft.replaceTurnServers : draft.replaceIceServers;
    if (replacing) patch[key] = (draft[key] ?? []).map((s) => ({ urls: [...s.urls],
      ...(s.username === undefined ? {} : { username: s.username }),
      ...(s.credential ? { credential: s.credential } : {}) }));
  }
  return patch;
}
