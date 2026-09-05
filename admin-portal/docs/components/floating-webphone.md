# Floating Admin WebPhone

Status: **[Implemented against the WebPhone module; drift resolved]**

Reverified on **2026-09-03**. The widget is the shared `@mutakamel/webphone`
package, bound to the admin portal by `AdminWebPhone.tsx` and served by the
WebPhone Gateway app at `/api/admin/webphone/v1` — a namespace of its own, so
its absence from the generated Admin **Core** inventory is expected, not drift.

The admin portal is the only portal that mounts the widget. The tenant portal
depends on the package for nothing today — it has the WebPhone settings screen
and no dock, so `/api/tenant/webphone/v1/me` has no browser caller there yet.

The component is mounted once in the authenticated root layout.

## Runtime data flow

| Purpose | Browser API | Permission | Response use |
|:---|:---|:---|:---|
| Current SIP profile and server chain | `GET /api/admin/webphone/v1/me` | Authenticated — holding an extension is the authorization | Decides whether the widget renders, and supplies the in-memory SIP secret, the ordered `servers[]`, and minted TURN credentials in one payload |
| Latest call logs | `GET /api/admin/webphone/v1/me/call-logs` | Authenticated | Hydrates the Log tab with up to 50 newest calls |
| Create call log | `POST /api/admin/webphone/v1/me/call-logs` | Authenticated | Persists one ended, failed, declined, answered, or unanswered call |

There is no separate settings read: `/me` already carries the caller's whole
failover chain, with disabled servers, servers outside the chain, and disabled
ICE servers filtered out **server-side** so a client bug cannot dial a
decommissioned server or somebody else's. The 22 `asterisk.*` system-settings
keys the widget once read are gone.

`/me` returns `servers[]`, not a single `config`. Each entry is a complete
registration target — its own domain, WebSocket URL, realm, registrar, proxy,
contact URI, ICE policy, ICE servers, and its already-resolved `timeoutSeconds`
and `maxRetries`. There is no `transport` field; the `ws://` / `wss://` scheme of
each `websocketUrl` is the protocol.

## Render and registration gates

These are two different conditions, and confusing them is why a phone can be
"enabled" yet invisible:

- **Renders** when `/me` returns `enabled: true` — that is the caller's own
  extension row existing and being enabled. Nothing else.
- **Registers** only when there is somewhere to register: a SIP username, a
  stored password, and at least one **usable** server in `servers[]`. A server
  missing its `sipDomain` or `websocketUrl` is filtered out before the chain is
  counted — it is not a fallback, it is an unusable row, and leaving it in would
  spend a whole failover slot building a UA that cannot connect. Readiness and
  the failover loop share that filter so they can never disagree about how many
  servers exist. Otherwise the dock shows `notConfigured` and stays offline.

`/me` is read once when the widget mounts, and the widget lives in the root
layout, so client-side navigation never refetches it on its own. Screens that
change a phone therefore announce it: any successful WebPhone write calls
`notifyWebphoneChanged()` from the package, the widget re-reads `/me`, and a
phone that was absent appears without a page reload.

The re-read is skipped while a UA or a SIP session is live. Behind a registered
phone it would drop the badge back to `loading`, and mid-call it could unmount
the dock under a conversation — so the signal only acts on a phone that is
currently down, which is the case it exists for. Editing a server, reordering the
fleet, or changing a user's chain behind an already-registered phone still needs
a reload.

The signal is same-document: a change made in another tab is not observed.

## SIP and WebRTC implementation

- Library: `jssip` `^3.13.8`, loaded dynamically in the browser.
- Registration URI: `sip:<sipUsername>@<sipDomain>` — the domain of the **active
  server**, which changes when the phone fails over.
- Transport: that server's `ws://` or `wss://` WebSocket URL. There is no
  separate protocol value to reconcile with it.
- Optional UA configuration: realm, registrar URI, contact URI, registration
  expiry, session timers, and outbound proxy route header — all read from the
  active server, never from a shared scope.
- Media: microphone-only `getUserMedia`, remote audio element, modern `track`
  handling plus the legacy `addstream` fallback.
- NAT traversal: the active server's own `iceServers[]`, normalized to
  `RTCIceServer[]`, with minted TURN credentials appended after them.
- Calls: outgoing/incoming, answer, decline, hang up, mute/unmute, hold/resume,
  DTMF, auto-answer, and DND busy rejection.
- Transfer: blind only, via SIP `REFER` (`RTCSession.refer`). The keypad is
  re-pointed at the transfer target while one is being dialled — sending DTMF
  there would type the new number into whatever the caller is connected to —
  and the session is left to end on its own `ended` event, so a REFER the far
  end rejects leaves the original call up instead of dropping the caller.

## Failover across the server chain

The widget registers against one server at a time and owns the loop itself. It
does not hand JsSIP a weighted socket list any more: every server carries its own
realm, registrar, proxy, contact URI and ICE set, so **one UA cannot represent
two servers** — moving between them means tearing the UA down and building the
next one.

```
for each server in me.servers (priority ascending, unusable ones dropped):
    build a UA from THIS server; REGISTER
    on refusal or a lost socket:
        retry the SAME server while attempts < maxRetries
        otherwise advance
    advance early if timeoutSeconds elapses first
after the last server:
    state = error; wait 5s (WEBPHONE_FAILOVER_CYCLE_DELAY_MS), start the list again
```

Four behaviours are deliberate and easy to break:

- `timeoutSeconds` is the deadline for the **server**, not for one attempt. A
  server that answers slowly and refuses three times over has still cost the
  caller a phone that does not ring, so the clock runs across the whole retry
  budget and whichever limit lands first ends that server's turn.
- A refused REGISTER and a socket that went away are the same event to the loop.
  One handler is what keeps the budget honest: a server that fails by
  disappearing cannot buy itself extra attempts.
- **Never during a call.** A failover due while a session is up is deferred, not
  cancelled, and paid back when the call ends. Dropping a conversation to improve
  a registration is never the right trade.
- The status is left alone while retrying the same server. The SIP cause of the
  last refusal is the only thing on screen that explains an outage, and
  overwriting it with `registering` on every attempt would hide it behind the
  retry — the attempt counter is what says a retry is in flight.

While the phone is moving between servers the status is `failingOver` and the
dock names the server it is switching to: "which server am I on" is the first
question a support call asks.

The 5-second pause before the list restarts is not politeness. Every server
refusing at once is an outage rather than a server being down, and restarting
immediately would spend it opening and tearing down a WebSocket per server as
fast as the failures come back, for as long as the tab stays open.

## Styling depends on a Tailwind `@source`

The widget is a workspace package, so it reaches the portal through
`node_modules`, which Tailwind v4's automatic source detection excludes.
`globals.css` therefore declares `@source "../../../packages/webphone/src"`.

**Without it the dock still renders**, which is why its absence went unnoticed
for so long — it just loses every utility no other screen happens to use.
Standard classes like `grid` and `fixed` survive; `grid-cols-[…]`,
`h-[24.5rem]`, `w-[min(17.5rem,…)]` and `z-[70]` do not. The visible result is
a phone that lays itself out from its content: the volume rows stack instead of
sitting in a row, and the panel changes height when you switch tabs. Any portal
that mounts the widget needs the same line.

## Control states

| Control | State | Appearance |
|:---|:---|:---|
| Call | no number typed | Grey, disabled |
| Call | number typed | Green (disabled while the line is not registered) |
| In call | — | Split: red hang-up + violet transfer, hold below |

Colour follows the typed number rather than `canCall`, so a phone that is
merely still registering does not look empty-handed.

The collapsed tab is a fixed 30px tall and the same width as the open panel;
the tab body is a fixed 24.5rem with `shrink-0 min-h-0`, so neither the open
panel nor the collapsed tab changes size with its content.
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
- Loading, ready, registering, failing over, reconnecting, offline,
  microphone-denied, forbidden, and degraded-log states are distinct. The
  `failingOver` state names the server being switched to, in both languages.
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
2. The module at Settings → WebPhone must be enabled, and the scope must hold at
   least one enabled SIP server. Enabling with no server is refused
   `422 WEBPHONE_CONFIG_NO_SERVER`, so this is one setup in a fixed order rather
   than two independent switches.
3. The current admin must own an enabled extension with a SIP username, a stored
   SIP password, **and a server chain**. An extension with an empty chain still
   consumes a seat and still cannot register.
4. No settings permission is needed — `/me` requires none.
5. Browser trust cannot be relaxed with a server's `allowInvalidTlsCertificate`;
   a `wss://` certificate must still be valid for browser WebSocket/WebRTC use.
   The flag documents a backend-proxy capability, per server, and nothing else.

## Source map

- `src/components/layout/AdminWebPhone.tsx` — binds base path, HTTP client,
  session gate, and copy
- `packages/webphone/src/components/WebRTCPhoneWidget.tsx`
- `packages/webphone/src/components/IncomingCallPopup.tsx`
- `packages/webphone/src/hooks/useWebRTCPhone.ts`
- `packages/webphone/src/api.ts`
- `packages/webphone/src/config.ts` — `usableWebphoneServers`, `isWebphoneReady`
  (the registration gate), `pcConfigFromSettings`, and
  `WEBPHONE_FAILOVER_CYCLE_DELAY_MS`
- `packages/webphone/src/changed-signal.ts` — `notifyWebphoneChanged`, the
  cross-tree signal that re-reads `/me`
- `packages/webphone/src/types.ts`
- `../backend/mutakamel-apps/core-app/src/webphone/domain/webphone-self-service.service.ts`
  — builds the `/me` payload
