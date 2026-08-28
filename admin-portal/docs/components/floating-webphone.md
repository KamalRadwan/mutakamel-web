# Floating Admin WebPhone

Status: **[Verified]**
The Admin Portal source was verified against the rebuilt WebPhone module
contract on **2026-08-28**
(`backend/docs/LLD/00-shared/12_webphone/en/10_Frontend_Integration.md`). The
implementation now lives in the shared `@mutakamel/webphone` package and is
consumed by both portals; the legacy `asterisk.*` system settings and the
`users/me/webphone` routes it depended on are gone.

The component is mounted once in the authenticated root layout and is hidden
when the current admin has no enabled WebPhone extension.

## Runtime data flow

| Purpose | Canonical browser API | Core permission | Response use |
|:---|:---|:---|:---|
| Extension and resolved runtime config | `GET /api/admin/webphone/v1/me` | Any authenticated admin | Enables the widget, supplies the in-memory SIP registration secret, the SIP endpoints, ICE servers, and minted TURN credentials |
| Latest call logs | `GET /api/admin/webphone/v1/me/call-logs` | Any authenticated admin | Hydrates the Log tab with up to 50 newest calls |
| Create call log | `POST /api/admin/webphone/v1/me/call-logs` | Any authenticated admin | Persists one ended, failed, declined, answered, or unanswered call |

There is no separate settings call: `/me` returns the resolved
`WebphoneRuntimeConfig` scoped to the caller. All calls use the portal's shared
authenticated client, Core success envelopes, refresh cookies, and the
canonical Gateway paths above. The call-log write is declared non-idempotent
and non-replayable.

## SIP and WebRTC implementation

- Library: `jssip` `^3.13.8`, loaded dynamically in the browser.
- Registration URI: `sip:<sipUsername>@<config.sipDomain>`.
- Transport: one JsSIP socket per enabled endpoint in `config.endpoints`.
  Endpoints arrive ordered by `priority` ascending; JsSIP prefers the highest
  weight, so the package inverts the two scales and lets JsSIP's own
  multi-socket transport handle failover. There is no custom reconnect loop.
- Optional UA configuration: realm, registrar URI, contact URI, registration
  expiry, session timers, and outbound proxy route header.
- Media: microphone-only `getUserMedia`, remote audio element, modern `track`
  handling plus the legacy `addstream` fallback.
- NAT traversal: `config.iceServers`, normalized to `RTCIceServer[]`, with
  minted TURN REST credentials appended — never substituted. Minted
  credentials are re-fetched roughly 60 seconds before `expiresAt`, and the
  refresh is skipped entirely when TURN REST is disabled.
  `config.iceTransportPolicy` is asserted only for `relay`; `all` leaves the
  browser default in place.
- Calls: outgoing/incoming, answer, decline, hang up, mute/unmute, hold/resume,
  DTMF, auto-answer, and DND busy rejection.
- Diagnostics: secure-context and microphone-permission states, SIP
  registration status, optional redacted trace events, and live audio meters.
- Recovery: a registration failure shows the error state and a manual retry
  control. It never auto-retries — a reconnect loop against bad credentials is
  exactly what infrastructure-level blocking rules are written to catch.
- Preferences: only expanded/collapsed state and volume UI preferences are
  stored in `localStorage`.

The SIP password is held only in React/browser memory for the active component
lifetime. It is never copied to `localStorage`, `sessionStorage`, call logs,
console traces, toast messages, or the user-management form after save.

## Portal seams

The shared package hardcodes no portal. `WebphoneProvider` injects the four
portal-specific values, and `AdminWebPhone` supplies the admin ones:

| Seam | Admin value |
|:---|:---|
| `basePath` | `/api/admin/webphone/v1` |
| `http` | The admin `axiosClient` (cookie auth, coordinated refresh) |
| `active` | Authenticated and not on `/login` |
| `copy` | The shared Arabic/English dictionary with an admin phone name |

## Call log mapping

| Runtime outcome | Wire value |
|:---|:---|
| Outgoing call | `OUT` |
| Incoming answered call | `IN_ANS` |
| Incoming unanswered/declined call | `IN_NOANS` |

The payload includes `phoneNumber`, optional display name and timestamps,
duration capped at 86,400 seconds, and a bounded cause carrying the status
code, so history stays queryable regardless of the operator's locale. A local
optimistic row appears immediately; persistence failure never blocks or tears
down the call.

## UI behavior

- Persistent bottom-end dock, mirrored automatically in RTL/LTR.
- Compact collapsed state with a live registration indicator that exposes its
  localized state to screen readers rather than relying on colour alone.
- Phone and Call Log tabs.
- Incoming-call portal remains visible even while the phone is collapsed, and
  announces itself with `aria-live="assertive"`.
- Arabic and English copy, logical directional utilities, dark and light
  themes, and 40–44px primary controls.
- No simulated incoming calls, fake connection toggles, fake transfers, or
  fabricated SIP identity values remain.

## Operational requirements

1. The page must run in a secure context (`HTTPS`, or localhost for local
   development) for microphone access.
2. `config.enabled` must be true and `config.sipDomain` plus at least one
   enabled SIP endpoint must be present.
3. The current admin WebPhone must be enabled and include an extension, SIP
   username, and either a session SIP password or `passwordConfigured`.
4. A `wss://` certificate must be valid for browser WebSocket/WebRTC use;
   browser trust cannot be relaxed from configuration.

## Source map

- `src/components/layout/AdminWebPhone.tsx` — admin mount and injected seams
- `packages/webphone/src/components/WebRTCPhoneWidget.tsx`
- `packages/webphone/src/components/IncomingCallPopup.tsx`
- `packages/webphone/src/context/WebphoneContext.tsx`
- `packages/webphone/src/hooks/useWebRTCPhone.ts`
- `packages/webphone/src/api.ts`
- `packages/webphone/src/config.ts`
- `packages/webphone/src/copy.ts`
- `packages/webphone/src/types.ts`
- `packages/webphone/src/utils/dtmfAudio.ts`
