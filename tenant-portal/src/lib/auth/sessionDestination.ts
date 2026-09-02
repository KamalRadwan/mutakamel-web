import { isSessionEndingAuthCode } from "./sessionErrors";

/**
 * The one place a session-ending code chooses a screen.
 *
 * It lives beside `SESSION_ENDING_AUTH_CODES` rather than in the guard because
 * the two sets have to stay in step: a code the transport can produce and no
 * destination knows about is how `SESSION_IDENTITY_INACTIVE` — a suspended or
 * deactivated account, which signing in again cannot fix — spent its life
 * being announced as an expired session on `/session-expired`, with the
 * generic "we do not know why" copy, while `/account-suspended` sat unused.
 *
 * The code is validated against the transport's own set before it is written
 * into a URL, so a hand-edited value can never select a message: an
 * unrecognised code falls through to the reasonless `/session-expired`, which
 * is honest about knowing nothing.
 */
const TERMINAL_DESTINATIONS = new Map<string, string>([
  ["SESSION_IDENTITY_INACTIVE", "/account-suspended"],
]);

export function tenantSessionEndedHref(endedReason: string | null): string {
  if (endedReason === null || !isSessionEndingAuthCode(endedReason)) {
    return "/session-expired";
  }
  return (
    TERMINAL_DESTINATIONS.get(endedReason) ??
    `/session-expired?reason=${encodeURIComponent(endedReason)}`
  );
}
