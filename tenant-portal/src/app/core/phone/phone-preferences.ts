export type PhoneVolumeLevel = number | 'low' | 'medium' | 'high';
export type PhoneRingVolumeLevel = 'off' | 'low' | 'high';

export interface PhonePrefs {
  micId: string | null;
  speakerId: string | null;
  ringId: string | null;
  micVolume: number;
  speakerVolume: number;
  ringVolume: PhoneRingVolumeLevel;
  autoAnswer: boolean;
  dnd: boolean;
  notifications: boolean;
  notifyAsked: boolean;
  panelOpen: boolean;
}

export const PHONE_PREFS_STORAGE_KEY = 'mutakamel.phone.prefs';

export const DEFAULT_PHONE_PREFS: PhonePrefs = {
  micId: null,
  speakerId: null,
  ringId: null,
  micVolume: 70,
  speakerVolume: 60,
  ringVolume: 'high',
  autoAnswer: false,
  dnd: false,
  notifications: true,
  notifyAsked: false,
  panelOpen: false,
};

const VOLUME_GAINS: Record<'off' | 'low' | 'medium' | 'high', number> = {
  off: 0,
  low: 0.4,
  medium: 0.7,
  high: 1.0,
};

const LEGACY_VOLUME_PERCENT: Record<'low' | 'medium' | 'high', number> = {
  low: 40,
  medium: 70,
  high: 100,
};

/** Converts a numeric percentage (0..100) or preference volume level into an audio gain multiplier (0..1). */
export function volumeToGain(level: PhoneVolumeLevel | PhoneRingVolumeLevel): number {
  if (typeof level === 'number') {
    if (!Number.isFinite(level)) return 1.0;
    return Math.min(100, Math.max(0, level)) / 100;
  }
  return VOLUME_GAINS[level] ?? 1.0;
}

function asDeviceId(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asVolume(value: unknown, fallback: number): number {
  if (value === 'low' || value === 'medium' || value === 'high') {
    return LEGACY_VOLUME_PERCENT[value];
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(100, Math.max(0, Math.round(value)));
  }
  return fallback;
}

function asRingVolume(value: unknown, fallback: PhoneRingVolumeLevel): PhoneRingVolumeLevel {
  return value === 'off' || value === 'low' || value === 'high' ? value : fallback;
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Validates and normalizes untrusted JSON into a safe `PhonePrefs` object. */
export function sanitizePhonePrefs(raw: unknown): PhonePrefs {
  if (typeof raw !== 'object' || raw === null) {
    return { ...DEFAULT_PHONE_PREFS };
  }
  const obj = raw as Record<string, unknown>;
  return {
    micId: asDeviceId(obj['micId']),
    speakerId: asDeviceId(obj['speakerId']),
    ringId: asDeviceId(obj['ringId']),
    micVolume: asVolume(obj['micVolume'], DEFAULT_PHONE_PREFS.micVolume),
    speakerVolume: asVolume(obj['speakerVolume'], DEFAULT_PHONE_PREFS.speakerVolume),
    ringVolume: asRingVolume(obj['ringVolume'], DEFAULT_PHONE_PREFS.ringVolume),
    autoAnswer: asBool(obj['autoAnswer'], DEFAULT_PHONE_PREFS.autoAnswer),
    dnd: asBool(obj['dnd'], DEFAULT_PHONE_PREFS.dnd),
    notifications: asBool(obj['notifications'], DEFAULT_PHONE_PREFS.notifications),
    notifyAsked: asBool(obj['notifyAsked'], DEFAULT_PHONE_PREFS.notifyAsked),
    panelOpen: asBool(obj['panelOpen'], DEFAULT_PHONE_PREFS.panelOpen),
  };
}

/** Reads phone preferences from `localStorage`, returning defaults in private mode or on invalid JSON. */
export function readPhonePrefs(): PhonePrefs {
  try {
    const raw = localStorage.getItem(PHONE_PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PHONE_PREFS };
    return sanitizePhonePrefs(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT_PHONE_PREFS };
  }
}

/** Persists only whitelisted non-secret preference fields to `localStorage`. */
export function writePhonePrefs(prefs: PhonePrefs): void {
  try {
    const safe = sanitizePhonePrefs(prefs);
    localStorage.setItem(PHONE_PREFS_STORAGE_KEY, JSON.stringify(safe));
  } catch {
    // Private browsing or disabled storage is non-fatal.
  }
}
