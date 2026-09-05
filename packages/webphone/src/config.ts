import type { WebphoneMe, WebphoneServer } from "./types";

/**
 * How long the phone waits after the last server in the list has refused it
 * before starting the list again.
 *
 * Without the pause, an outage that takes every server down at once — a lost
 * uplink, an expired certificate on a shared proxy — would leave the widget
 * opening and tearing down a WebSocket per server as fast as the failures come
 * back, for as long as the tab stays open.
 */
export const WEBPHONE_FAILOVER_CYCLE_DELAY_MS = 5000;

/**
 * The servers this phone can actually register against.
 *
 * A server missing its domain or socket URL is not a fallback, it is an
 * unusable row: leaving it in the list would spend a whole failover slot
 * building a UA that cannot connect. Readiness and the failover loop share
 * this filter so they can never disagree about how many servers exist.
 */
export function usableWebphoneServers(
  me?: WebphoneMe | null,
): WebphoneServer[] {
  return (me?.servers ?? []).filter(
    (server) => Boolean(server?.sipDomain) && Boolean(server?.websocketUrl),
  );
}

export function isWebphoneReady(me?: WebphoneMe | null) {
  return Boolean(
    me?.enabled &&
      me.sipUsername &&
      (me.sipPassword || me.passwordConfigured) &&
      usableWebphoneServers(me).length > 0,
  );
}

export function normalizeCallTarget(target: string, sipDomain: string) {
  const value = target.trim();
  if (/^sip:/i.test(value)) return value;
  if (value.includes("@")) return `sip:${value}`;
  return `sip:${value}@${sipDomain}`;
}

export function sipUri(user: string, domain: string) {
  return `sip:${user}@${domain}`;
}

export function iceServersFromSettings(
  server?: WebphoneServer | null,
): RTCIceServer[] {
  return (server?.iceServers ?? [])
    .map(toIceServer)
    .filter((iceServer): iceServer is RTCIceServer => Boolean(iceServer));
}

/**
 * Builds the RTCPeerConnection config for a call from the server the phone is
 * currently registered to — media policy belongs to that server, since a
 * relay-only fallback and a direct-media primary are routinely the same list.
 * `ephemeralIceServers` (from minted TURN REST credentials, see
 * `WebphoneMe.turnCredentials`) are appended after the static ones. Only sets
 * `iceTransportPolicy` when it's 'relay' — omitting it otherwise matches
 * the browser default ('all') rather than asserting it explicitly.
 */
export function pcConfigFromSettings(
  server?: WebphoneServer | null,
  ephemeralIceServers?: RTCIceServer[],
): RTCConfiguration {
  const iceServers = [
    ...iceServersFromSettings(server),
    ...(ephemeralIceServers ?? []),
  ];
  return server?.iceTransportPolicy === "relay"
    ? { iceServers, iceTransportPolicy: "relay" }
    : { iceServers };
}

function toIceServer(server: { urls: unknown; username?: unknown; credential?: unknown }): RTCIceServer | null {
  const urls = server.urls;
  if (typeof urls !== "string" && !Array.isArray(urls)) return null;

  const normalizedUrls = Array.isArray(urls)
    ? urls.filter((url): url is string => typeof url === "string")
    : urls;
  if (Array.isArray(normalizedUrls) && normalizedUrls.length === 0) {
    return null;
  }

  return {
    urls: normalizedUrls,
    username:
      typeof server.username === "string" ? server.username : undefined,
    credential:
      typeof server.credential === "string" ? server.credential : undefined,
  };
}
