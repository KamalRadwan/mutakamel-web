export const ACTION_TOKEN_MIN = 16;
export const ACTION_TOKEN_MAX = 512;

/**
 * Reads `token` from a URL fragment like "token=raw+token" (URLSearchParams decoding: '+' is a space).
 * Returns null when missing or outside [ACTION_TOKEN_MIN, ACTION_TOKEN_MAX].
 */
export function readActionToken(fragment: string | null): string | null {
  if (!fragment) return null;
  const normalized = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  const token = new URLSearchParams(normalized).get('token');
  if (!token || token.length < ACTION_TOKEN_MIN || token.length > ACTION_TOKEN_MAX) {
    return null;
  }
  return token;
}
