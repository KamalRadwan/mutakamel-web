const AUTH_ROUTE_PREFIXES = ['/login', '/verify', '/reset-password', '/tenant/reset-password', '/tenant/accept-invite'] as const;

export const DEFAULT_SIGNED_IN_URL = '/workspace/home';

/** Validates that a returnUrl is a relative same-app path outside auth routes. */
export function safeReturnUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) return null;
  if (/[\\\u0000-\u001f\u007f]/u.test(raw)) return null;

  let path: string;
  try {
    path = decodeURIComponent(raw.split(/[?#]/u)[0]);
  } catch {
    return null;
  }
  if (path.startsWith('//') || /[\\\u0000-\u001f\u007f]/u.test(path)) return null;

  const segments = path.split('/').map((segment) => segment.split(';')[0]);
  if (segments.some((segment) => segment === '.' || segment === '..')) return null;
  const normalized = segments.join('/').replace(/\/+$/u, '');
  if (AUTH_ROUTE_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))) {
    return null;
  }

  return raw;
}
