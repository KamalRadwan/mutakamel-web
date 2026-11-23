const REASON_CODES = new Set([
  'CAPTURE_NOT_DEPLOYED',
  'NO_ACTIVE_POLICY',
  'CALENDAR_HOURS_MISSING',
  'CONFIG_NOT_DESIGNED',
  'MODULE_NOT_RELEASED',
  'READ_MODEL_NOT_DEPLOYED',
  'EVENT_NOT_INGESTED',
  'VIEW_NOT_RELEASED',
  'TRIGGER_NOT_RELEASED',
  'PROVIDER_WEBHOOK_MISSING',
  'NO_SPEND_SOURCE',
  'NO_TOUCH_SOURCE',
]);

export function readinessReasonKey(code: string): string {
  return `readiness.reasons.${REASON_CODES.has(code) ? code : 'UNKNOWN'}`;
}
