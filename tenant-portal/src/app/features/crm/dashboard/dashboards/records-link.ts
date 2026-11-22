import type { RuntimeFilters } from '../../../../shared/widgets/dashboard/analytics.model';

export function encodeRuntimeFilters(filters: RuntimeFilters): string {
  const bytes = new TextEncoder().encode(JSON.stringify(filters));
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeRuntimeFilters(raw: string | null | undefined): RuntimeFilters {
  if (!raw || !/^[A-Za-z0-9_-]+$/.test(raw)) return {};
  try {
    const base64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as RuntimeFilters;
  } catch {
    return {};
  }
}

export function recordsLink(
  dashboardId: string,
  widgetId: string,
  title: string,
  filters: RuntimeFilters,
  point?: { pointKey: string; seriesKey?: string },
): { commands: unknown[]; queryParams: Record<string, string> } {
  const queryParams: Record<string, string> = {
    widget: widgetId,
    title,
    f: encodeRuntimeFilters(filters),
  };
  if (point?.pointKey) {
    queryParams['point'] = point.pointKey;
  }
  if (point?.seriesKey) {
    queryParams['series'] = point.seriesKey;
  }
  return {
    commands: ['/crm/dashboard/dashboards', dashboardId, 'records'],
    queryParams,
  };
}
