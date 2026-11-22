export type WorkspaceLanguage = 'en' | 'ar';
export const WORKSPACE_LANGUAGES: readonly WorkspaceLanguage[] = ['en', 'ar'];
export const TIMEZONE_MAX_LENGTH = 48;
export const CURRENCY_CODE_LENGTH = 3;

export interface WorkspaceSettings {
  id: string;
  defaultLanguage: WorkspaceLanguage;
  defaultCurrencyCode: string | null;
  timezone: string;
  allowSupport: boolean;
  createdAt: string;
  updatedAt: string;
}

/** PUT body: every field optional, PUT acts as a patch. null is NOT allowed for any field. */
export interface UpdateWorkspaceSettingsRequest {
  defaultLanguage?: WorkspaceLanguage;
  defaultCurrencyCode?: string;
  timezone?: string;
  allowSupport?: boolean;
}

export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
}

export interface TimezoneOption {
  value: string;
  label: string;
  offset: string;
}

export function formatTimezoneOffset(timeZone: string, now = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    }).formatToParts(now);
    const offsetPart = parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
    if (offsetPart === 'GMT' || offsetPart === 'UTC') return '+00:00';
    const match = /([+-])(\d{1,2})(?::(\d{2}))?/.exec(offsetPart);
    if (match && match[1] && match[2]) {
      return `${match[1]}${match[2].padStart(2, '0')}:${match[3] ?? '00'}`;
    }
  } catch {
    return '+00:00';
  }
  return '+00:00';
}
