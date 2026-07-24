# Component Specification: `FloatingWebPhone` (Floating WebRTC Phone)

A persistent, floating WebRTC phone drawer dockable at the bottom-end corner of the Admin Portal shell. Hydrated via `GET /admin/users/me/webphone`.

---

## ⚙️ Component API

```typescript
export interface FloatingWebPhoneProps {
  initialConfig?: WebphoneConfig;
  isOpen: boolean;
  onToggle: () => void;
}
```

---

## 🎨 Features & Navigation

1. **Floating Dock Button**: Fixed at `bottom-4 end-4` with unread call log badge and SIP status indicator.
2. **Keypad & Dialer**: Phone number input with DTMF keypad (0-9, *, #), call button, mute toggle, hold toggle.
3. **Call Logs Tab**: Displays latest 50 call logs fetched from `GET /admin/users/me/webphone/call-logs`.
4. **SIP Session Hydration**: Connects to WebRTC gateway via SIP WebSocket (`ws` / `wss`) without caching SIP passwords beyond the browser session.
