# Floating Admin WebPhone

Status: **[Verified]**
Core, `mutakamel-web-app`, and Admin Portal source on **2026-07-25**.

The component is mounted once in the authenticated root layout and is hidden
when the current admin has no enabled WebPhone configuration.

## Runtime data flow

| Purpose | Canonical browser API | Core permission | Response use |
|:---|:---|:---|:---|
| Current SIP profile | `GET /api/admin/core/v1/users/me/webphone` | Any authenticated admin | Enables the widget and supplies the current user's in-memory SIP registration secret |
| Asterisk runtime settings | `GET /api/admin/core/v1/system-settings?prefix=asterisk.` | `admin.settings.read` | Supplies WebSocket, domain, registrar, timers, STUN, TURN, and ICE settings |
| Latest call logs | `GET /api/admin/core/v1/users/me/webphone/call-logs` | Any authenticated admin | Hydrates the Log tab with up to 50 newest calls |
| Create call log | `POST /api/admin/core/v1/users/me/webphone/call-logs` | Any authenticated admin | Persists one ended, failed, declined, answered, or unanswered call |

All calls use the shared authenticated client, Core success envelopes,
refresh cookies, and the canonical Gateway paths above.

## SIP and WebRTC implementation

- Library: `jssip` `^3.13.8`, loaded dynamically in the browser.
- Registration URI: `sip:<sipUsername>@<sipDomain>`.
- Transport: Asterisk `ws://` or `wss://` WebSocket URL.
- Optional UA configuration: realm, registrar URI, contact URI, registration
  expiry, session timers, and outbound proxy route header.
- Media: microphone-only `getUserMedia`, remote audio element, modern `track`
  handling plus the legacy `addstream` fallback.
- NAT traversal: explicit ICE JSON, comma-separated STUN servers, then TURN
  JSON, normalized to `RTCIceServer[]`.
- Calls: outgoing/incoming, answer, decline, hang up, mute/unmute, hold/resume,
  DTMF, auto-answer, and DND busy rejection.
- Diagnostics: secure-context and microphone-permission states, SIP
  registration status, optional redacted trace events, and live audio meters.
- Preferences: only expanded/collapsed state and volume UI preferences are
  stored in `localStorage`.

The SIP password is held only in React/browser memory for the active component
lifetime. It is never copied to `localStorage`, `sessionStorage`, call logs,
console traces, toast messages, or the user-management form after save.

## Call log mapping

| Runtime outcome | Wire value |
|:---|:---|
| Outgoing call | `OUT` |
| Incoming answered call | `IN_ANS` |
| Incoming unanswered/declined call | `IN_NOANS` |

The payload includes `phoneNumber`, optional display name and timestamps,
duration capped at 86,400 seconds, and a bounded cause. A local optimistic row
appears immediately; persistence failure never blocks or tears down the call.

## UI behavior

- Persistent bottom-end dock, mirrored automatically in RTL/LTR.
- Compact collapsed state with live registration indicator.
- Phone and Call Log tabs.
- Incoming-call portal remains visible even while the phone is collapsed.
- Arabic and English copy, logical directional utilities, dark and light
  themes, and 40–44px primary controls.
- No simulated incoming calls, fake connection toggles, fake transfers, or
  fabricated SIP identity values remain.

## Operational requirements

1. The page must run in a secure context (`HTTPS`, or localhost for local
   development) for microphone access.
2. Asterisk WebSocket and SIP domain settings must both be present and
   `asterisk.enabled` must be true.
3. The current admin WebPhone must be enabled and include extension, SIP
   username, and SIP password.
4. The admin needs `admin.settings.read` so the browser can obtain the shared
   Asterisk settings.
5. Browser trust cannot be relaxed with
   `asterisk.allow_invalid_tls_certificate`; a `wss://` certificate must still
   be valid for browser WebSocket/WebRTC use.

## Source map

- `src/components/layout/WebRTCPhoneWidget.tsx`
- `src/components/layout/IncomingCallPopup.tsx`
- `src/components/layout/hooks/useWebRTCPhone.ts`
- `src/components/layout/webphone/api.ts`
- `src/components/layout/webphone/config.ts`
- `src/components/layout/webphone/types.ts`
- `src/components/layout/utils/dtmfAudio.ts`
