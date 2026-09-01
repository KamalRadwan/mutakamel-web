/**
 * Browsers request `/favicon.ico` on their own for every document, whether or
 * not the page declares an icon. With nothing to serve it, Next fell through to
 * the catch-all 404 page — a full server render for a byte stream, which is
 * what turned the request into the ~8s stall the browser console reported.
 *
 * Redirecting instead of shipping a second binary keeps one source of truth:
 * `src/app/icon.svg` is the icon, and Next's app-dir file convention already
 * emits the `<link rel="icon">` for it, so `metadata.icons` in the root layout
 * would only restate what the convention derives. The admin portal solves it
 * the same way — see `../../admin-portal/src/app/favicon.ico/route.ts`.
 *
 * 308 rather than 302 so the method is preserved and the browser is allowed to
 * remember the target; the day-long `Cache-Control` is what stops the redirect
 * itself from becoming a per-navigation round trip.
 *
 * `src/proxy.ts` excludes `favicon.ico` from its matcher, so this handler
 * answers directly and carries no CSP — correct, since a redirect with an empty
 * body has nothing for a policy to protect.
 */
export function GET(): Response {
  return new Response(null, {
    status: 308,
    headers: {
      Location: '/icon.svg',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
