# Floating Admin WebPhone

Status: **[Frontend source/unit behavior implemented; transport contract drift unresolved]**

The current Admin Portal source was reverified on **2026-08-29**. The generated
Admin Core inventory currently contains 246 routes and contains no WebPhone or
WebPhone call-log route. Therefore the frontend paths below are implementation
references, not verified present-day backend contracts. Backend availability,
permissions, and response shapes require explicit Core/contract confirmation
before authenticated runtime conformance can be claimed.

The component is mounted once in the authenticated root layout and is hidden
when the current admin has no enabled WebPhone configuration.

## Runtime data flow

| Purpose | Frontend-referenced browser API | Current contract evidence | Response use |
|:---|:---|:---|:---|
| Current SIP profile | `GET /api/admin/core/v1/users/me/webphone` | Referenced by frontend; absent from the current generated inventory | Enables the widget and supplies the current user's in-memory SIP registration secret when the contract exists |
| Asterisk runtime settings | `GET /api/admin/core/v1/system-settings?prefix=asterisk.` | `GET /system-settings` is inventory-confirmed with `admin.settings.read` | Supplies WebSocket, domain, registrar, timers, STUN, TURN, and ICE settings |
| Latest call logs | `GET /api/admin/core/v1/users/me/webphone/call-logs` | Referenced by frontend; absent from the current generated inventory | Hydrates the Log tab with up to 50 newest calls when the contract exists |
| Create call log | `POST /api/admin/core/v1/users/me/webphone/call-logs` | Referenced by frontend; absent from the current generated inventory | Persists one ended, failed, declined, answered, or unanswered call when the contract exists |

The frontend uses the shared authenticated client and expects Core success
envelopes and refresh cookies. That implementation expectation does not make an
inventory-missing path canonical. See `src/components/layout/webphone/api.ts`
and `src/components/layout/hooks/useWebRTCPhone.ts` for the unresolved frontend
references.

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
- Arabic and English visible copy and dark/light theme support.
- No simulated incoming calls, fake connection toggles, fake transfers, or
  fabricated SIP identity values remain.

### Approved interaction target

- Every coarse-pointer control has at least a 44×44px interaction area.
- The dial field has a persistent localized label; placeholder-only naming is
  not sufficient.
- Phone/Log tabs implement complete tablist, tab, and tabpanel relationships
  plus directional arrow-key behavior.
- Incoming calls use an alert dialog with localized name, initial focus, focus
  containment, and focus return.
- The expanded dock and incoming-call surface cannot obscure the page's focused
  control, pagination, or primary action.
- Bottom/end placement respects viewport and safe-area insets in both
  directions. Physical transforms are runtime-tested because the RTL utility
  guard cannot validate their geometry.
- Call direction and connection state use text/icon reinforcement, not color
  alone.
- Loading, ready, registering, reconnecting, offline, microphone-denied,
  forbidden, and degraded-log states are distinct.
- Motion and audio-meter animation honor reduced motion where animation is not
  required to communicate a live call.

Current source and focused unit tests implement the incoming-call AlertDialog
focus lifecycle, focus return, labelled Radix tabs with directional keyboard
behavior, a persistent localized dial label, safe-area-aware logical placement,
and dock collapse before page focus can be obscured. Remaining evidence is
runtime-dependent: confirm authenticated SIP/call behavior against a verified
backend contract, coarse-pointer target geometry, real mobile collision/safe-area
behavior, both themes and languages, reduced motion, and the complete
loading/degraded/forbidden state matrix.

See
[Accessibility, responsive behavior, and localization](../design-system/accessibility-responsive-and-localization.md)
and [Operational UX](../design-system/operational-ux.md).

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
