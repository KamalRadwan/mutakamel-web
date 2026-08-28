import type { WebphoneMe, WebphoneRuntimeConfig } from "./types";

/**
 * `endpoints` arrive ordered by `priority` ascending (lowest first), while
 * JsSIP prefers the socket with the **highest** weight, so the two scales are
 * inverted against each other.
 */
export const MAX_ENDPOINT_PRIORITY = 100;

export function endpointSocketWeight(priority: number) {
  return Math.max(0, MAX_ENDPOINT_PRIORITY - priority);
}

export function isWebphoneReady(me?: WebphoneMe | null) {
  return Boolean(
    me?.enabled &&
      me.config?.enabled &&
      me.config.sipDomain &&
      me.config.endpoints?.length &&
      me.sipUsername &&
      (me.sipPassword || me.passwordConfigured),
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
  config?: WebphoneRuntimeConfig | null,
): RTCIceServer[] {
  return (config?.iceServers ?? [])
    .map(toIceServer)
    .filter((server): server is RTCIceServer => Boolean(server));
}

/**
 * Builds the RTCPeerConnection config for a call. `ephemeralIceServers`
 * (from minted TURN REST credentials, see `WebphoneMe.turnCredentials`)
 * are appended after the static config-derived ones. Only sets
 * `iceTransportPolicy` when it's 'relay' — omitting it otherwise matches
 * the browser default ('all') rather than asserting it explicitly.
 */
export function pcConfigFromSettings(
  config?: WebphoneRuntimeConfig | null,
  ephemeralIceServers?: RTCIceServer[],
): RTCConfiguration {
  const iceServers = [
    ...iceServersFromSettings(config),
    ...(ephemeralIceServers ?? []),
  ];
  return config?.iceTransportPolicy === "relay"
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
