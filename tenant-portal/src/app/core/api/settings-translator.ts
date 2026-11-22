/** A translate function or a service exposing translate(); accepted by errorMessage(). */
export type SettingsTranslator =
  | ((key: string, params?: Record<string, unknown>) => string)
  | { translate(key: string, params?: Record<string, unknown>): string };
