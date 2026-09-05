// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { WEBPHONE_FAILOVER_CYCLE_DELAY_MS } from "../config";
import { WebphoneProvider } from "../context/WebphoneContext";
import { webphoneCopy } from "../copy";
import type { WebphoneHttpClient } from "../http";
import type { WebphoneMe, WebphoneServer } from "../types";

class MockWebSocketInterface {
  url: string;
  constructor(url: string) {
    this.url = url;
  }
}

type Handler = (...args: unknown[]) => void;

class MockUA {
  static instances: MockUA[] = [];
  config: Record<string, unknown>;
  stopped = false;
  private handlers: Record<string, Handler[]> = {};

  constructor(config: Record<string, unknown>) {
    this.config = config;
    MockUA.instances.push(this);
  }

  on(event: string, handler: Handler) {
    (this.handlers[event] ??= []).push(handler);
    return this;
  }

  emit(event: string, payload?: unknown) {
    (this.handlers[event] ?? []).forEach((handler) => handler(payload));
  }

  start() {}
  stop() {
    this.stopped = true;
  }
  register() {}
  isRegistered() {
    return false;
  }
}

/** Enough of a JsSIP session for `bindSession` to latch onto and later end. */
class MockSession {
  remote_identity = { uri: { user: "2000" }, display_name: "Caller" };
  private ended = false;
  private handlers: Record<string, Handler[]> = {};

  on(event: string, handler: Handler) {
    (this.handlers[event] ??= []).push(handler);
    return this;
  }

  emit(event: string, payload?: unknown) {
    if (event === "ended" || event === "failed") this.ended = true;
    (this.handlers[event] ?? []).forEach((handler) => handler(payload));
  }

  isEnded() {
    return this.ended;
  }

  terminate() {
    this.ended = true;
  }
}

vi.mock("jssip", () => ({
  UA: MockUA,
  WebSocketInterface: MockWebSocketInterface,
}));

import { useWebRTCPhone } from "./useWebRTCPhone";

const BASE_PATH = "/api/admin/webphone/v1";

const PRIMARY_WS = "wss://primary.example.com:8089/ws";
const SECONDARY_WS = "wss://secondary.example.com:8089/ws";
const TERTIARY_WS = "wss://tertiary.example.com:8089/ws";

const getMock = vi.fn();
const httpClient = {
  get: getMock,
  post: vi.fn().mockResolvedValue({ data: { data: null } }),
} as unknown as WebphoneHttpClient;

function webphoneServer(overrides: Partial<WebphoneServer> = {}): WebphoneServer {
  return {
    id: "server-1",
    name: "Primary",
    priority: 1,
    sipDomain: "primary.example.com",
    websocketUrl: PRIMARY_WS,
    realm: "primary-realm",
    outboundProxy: null,
    fromDomain: null,
    registrarServer: null,
    contactUri: null,
    registerExpires: 600,
    defaultCallerId: null,
    iceTransportPolicy: "all",
    traceSip: false,
    sessionTimers: false,
    allowInvalidTlsCertificate: false,
    // Long enough that a test only sees the retry budget unless it says otherwise.
    timeoutSeconds: 60,
    maxRetries: 2,
    iceServers: [],
    ...overrides,
  };
}

const webphoneMe: WebphoneMe = {
  enabled: true,
  extension: "100",
  sipUsername: "100",
  sipPassword: "secret",
  displayName: "Operator",
  outboundCallerId: null,
  passwordConfigured: true,
  servers: [webphoneServer()],
  turnCredentials: { enabled: false, iceServers: [], expiresAt: null },
};

function meWithServers(...servers: WebphoneServer[]): WebphoneMe {
  return { ...webphoneMe, servers };
}

const secondaryServer = webphoneServer({
  id: "server-2",
  name: "Secondary",
  priority: 2,
  sipDomain: "secondary.example.com",
  websocketUrl: SECONDARY_WS,
  realm: "secondary-realm",
});

const tertiaryServer = webphoneServer({
  id: "server-3",
  name: "Tertiary",
  priority: 3,
  sipDomain: "tertiary.example.com",
  websocketUrl: TERTIARY_WS,
  realm: "tertiary-realm",
});

function serveMe(me: WebphoneMe) {
  getMock.mockImplementation((url: string) =>
    url.endsWith("/call-logs")
      ? Promise.resolve({ data: { data: [] } })
      : Promise.resolve({ data: { data: me } }),
  );
}

function socketUrls(instance: MockUA) {
  return (instance.config.sockets as MockWebSocketInterface[]).map((socket) => socket.url);
}

function failRegistration(instance: MockUA, cause = "Forbidden") {
  act(() => {
    instance.emit("registrationFailed", { cause });
  });
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <WebphoneProvider basePath={BASE_PATH} http={httpClient} active copy={webphoneCopy.en}>
      {children}
    </WebphoneProvider>
  );
}

function renderPhone() {
  return renderHook(() => useWebRTCPhone(), { wrapper });
}

describe("useWebRTCPhone connection lifecycle", () => {
  beforeEach(() => {
    MockUA.instances = [];
    getMock.mockReset();
    serveMe(webphoneMe);
  });

  it("builds the UA from one server — the first — rather than from the whole list", async () => {
    // Realm, registrar, proxy and contact all travel with the server, and
    // JsSIP resolves them once per UA: a second socket in the same UA would
    // register the first server's identity over the second server's wire.
    serveMe(meWithServers(webphoneServer(), secondaryServer));
    renderPhone();

    await waitFor(() => expect(MockUA.instances).toHaveLength(1));
    expect(socketUrls(MockUA.instances[0])).toEqual([PRIMARY_WS]);
    expect(MockUA.instances[0].config.uri).toBe("sip:100@primary.example.com");
    expect(MockUA.instances[0].config.realm).toBe("primary-realm");
  });

  it("reports which server of how many is in hand", async () => {
    serveMe(meWithServers(webphoneServer(), secondaryServer, tertiaryServer));
    const { result } = renderPhone();

    await waitFor(() => expect(MockUA.instances).toHaveLength(1));
    expect(result.current[0].activeServerName).toBe("Primary");
    expect(result.current[0].activeServerIndex).toBe(0);
    expect(result.current[0].serverCount).toBe(3);
    expect(result.current[0].registrationAttempt).toBe(1);
  });

  it("moves to the registered state with a matching status code once JsSIP registers", async () => {
    const { result } = renderPhone();

    await waitFor(() => expect(MockUA.instances).toHaveLength(1));
    act(() => {
      MockUA.instances[0].emit("registered");
    });

    await waitFor(() => {
      expect(result.current[0].connectionState).toBe("registered");
      expect(result.current[0].status).toEqual({ code: "registered" });
    });
  });

  it("drops the attempt counter once a server accepts the registration", async () => {
    // Otherwise the periodic re-REGISTER would inherit the count of the trip
    // that got here, and a phone that has been up for hours would look as if
    // it were still fighting its way onto the server.
    serveMe(meWithServers(webphoneServer({ maxRetries: 3 })));
    const { result } = renderPhone();

    await waitFor(() => expect(MockUA.instances).toHaveLength(1));
    failRegistration(MockUA.instances[0]);
    expect(result.current[0].registrationAttempt).toBe(2);

    act(() => {
      MockUA.instances[0].emit("registered");
    });
    expect(result.current[0].registrationAttempt).toBe(0);
  });

  it("surfaces registrationFailed as an error status carrying the SIP cause as detail", async () => {
    const { result } = renderPhone();

    await waitFor(() => expect(MockUA.instances).toHaveLength(1));
    failRegistration(MockUA.instances[0], "Wrong password");

    await waitFor(() => {
      expect(result.current[0].connectionState).toBe("error");
      expect(result.current[0].status).toEqual({ code: "registrationFailed", detail: "Wrong password" });
    });
  });

  it("keeps the SIP cause on screen while it retries the same server", async () => {
    // The cause is the only part of a failed registration that explains it;
    // replacing it with the retry's own status hides the answer behind the
    // question.
    serveMe(meWithServers(webphoneServer({ maxRetries: 3 })));
    const { result } = renderPhone();

    await waitFor(() => expect(MockUA.instances).toHaveLength(1));
    failRegistration(MockUA.instances[0], "Wrong password");
    failRegistration(MockUA.instances[0], "Wrong password");

    expect(result.current[0].status).toEqual({ code: "registrationFailed", detail: "Wrong password" });
    expect(result.current[0].registrationAttempt).toBe(3);
  });

  it("retries the same server while its budget lasts, without rebuilding the UA", async () => {
    serveMe(meWithServers(webphoneServer({ maxRetries: 3 }), secondaryServer));
    const { result } = renderPhone();

    await waitFor(() => expect(MockUA.instances).toHaveLength(1));
    failRegistration(MockUA.instances[0]);
    failRegistration(MockUA.instances[0]);

    // A UA that still holds a socket to this server only needs another
    // REGISTER over it, so no second UA has been built.
    expect(MockUA.instances).toHaveLength(1);
    expect(result.current[0].activeServerIndex).toBe(0);
    expect(result.current[0].registrationAttempt).toBe(3);
  });

  it("advances to the next server once the current one has spent its retry budget", async () => {
    serveMe(meWithServers(webphoneServer({ maxRetries: 2 }), secondaryServer));
    const { result } = renderPhone();

    await waitFor(() => expect(MockUA.instances).toHaveLength(1));
    failRegistration(MockUA.instances[0]);
    expect(MockUA.instances).toHaveLength(1);

    failRegistration(MockUA.instances[0]);

    await waitFor(() => expect(MockUA.instances).toHaveLength(2));
    expect(MockUA.instances[0].stopped).toBe(true);
    expect(socketUrls(MockUA.instances[1])).toEqual([SECONDARY_WS]);
    expect(MockUA.instances[1].config.realm).toBe("secondary-realm");
    expect(result.current[0].activeServerIndex).toBe(1);
    expect(result.current[0].activeServerName).toBe("Secondary");
    expect(result.current[0].registrationAttempt).toBe(1);
  });

  it("advances when a server runs out of time, even with retries to spare", async () => {
    // The budget is the server's, not the attempt's: a server that answers
    // slowly and refuses three times has still left the phone unable to ring.
    serveMe(
      meWithServers(
        webphoneServer({ timeoutSeconds: 0.05, maxRetries: 99 }),
        secondaryServer,
      ),
    );
    const { result } = renderPhone();

    await waitFor(() => expect(MockUA.instances).toHaveLength(1));
    await waitFor(() => expect(MockUA.instances).toHaveLength(2));

    expect(socketUrls(MockUA.instances[1])).toEqual([SECONDARY_WS]);
    expect(result.current[0].activeServerIndex).toBe(1);
  });

  it("ignores a stale UA's events once the phone has moved on", async () => {
    serveMe(meWithServers(webphoneServer({ maxRetries: 1 }), secondaryServer));
    const { result } = renderPhone();

    await waitFor(() => expect(MockUA.instances).toHaveLength(1));
    failRegistration(MockUA.instances[0]);
    await waitFor(() => expect(MockUA.instances).toHaveLength(2));

    // A stopped JsSIP UA still emits on its way out; the abandoned server must
    // not be able to drag the phone back or spend the successor's budget.
    act(() => {
      MockUA.instances[0].emit("disconnected");
      MockUA.instances[0].emit("registrationFailed", { cause: "Forbidden" });
    });

    expect(MockUA.instances).toHaveLength(2);
    expect(result.current[0].activeServerIndex).toBe(1);
  });

  it("does not reconnect manually-retried servers from the middle of the list", async () => {
    serveMe(meWithServers(webphoneServer({ maxRetries: 1 }), secondaryServer, tertiaryServer));
    const { result } = renderPhone();

    await waitFor(() => expect(MockUA.instances).toHaveLength(1));
    failRegistration(MockUA.instances[0]);
    await waitFor(() => expect(result.current[0].activeServerIndex).toBe(1));

    act(() => {
      result.current[0].retryConnection();
    });

    await waitFor(() => expect(MockUA.instances).toHaveLength(3));
    expect(socketUrls(MockUA.instances[2])).toEqual([PRIMARY_WS]);
    expect(result.current[0].activeServerIndex).toBe(0);
  });
});

describe("useWebRTCPhone failover cycle", () => {
  beforeEach(() => {
    MockUA.instances = [];
    getMock.mockReset();
    // `shouldAdvanceTime` keeps real time flowing under the fake clock, so the
    // /me fetch and `waitFor` still settle while the 5s pause can be skipped.
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("wraps back to the first server, but only after the outage pause", async () => {
    serveMe(
      meWithServers(
        webphoneServer({ maxRetries: 1 }),
        { ...secondaryServer, maxRetries: 1 },
      ),
    );
    const { result } = renderPhone();

    await waitFor(() => expect(MockUA.instances).toHaveLength(1));
    failRegistration(MockUA.instances[0]);
    await waitFor(() => expect(MockUA.instances).toHaveLength(2));

    failRegistration(MockUA.instances[1]);
    await waitFor(() => expect(result.current[0].activeServerIndex).toBe(0));

    // Every server has refused: the cursor is back at the top of the list, but
    // nothing has been dialled, which is the difference between a failover and
    // a socket-per-millisecond loop against servers that are all still down.
    expect(MockUA.instances).toHaveLength(2);
    expect(result.current[0].status).toEqual({ code: "failingOver" });

    await act(async () => {
      vi.advanceTimersByTime(WEBPHONE_FAILOVER_CYCLE_DELAY_MS);
    });

    await waitFor(() => expect(MockUA.instances).toHaveLength(3));
    expect(socketUrls(MockUA.instances[2])).toEqual([PRIMARY_WS]);
  });

  it("clears the pending cycle when the phone is torn down", async () => {
    serveMe(meWithServers(webphoneServer({ maxRetries: 1 })));
    const { unmount } = renderPhone();

    await waitFor(() => expect(MockUA.instances).toHaveLength(1));
    failRegistration(MockUA.instances[0]);
    await waitFor(() => expect(MockUA.instances[0].stopped).toBe(true));

    unmount();
    await act(async () => {
      vi.advanceTimersByTime(WEBPHONE_FAILOVER_CYCLE_DELAY_MS * 3);
    });

    // A timer that outlives the widget would open a socket for a phone that is
    // no longer on screen, and keep doing it for as long as the tab is open.
    expect(MockUA.instances).toHaveLength(1);
  });
});

describe("useWebRTCPhone failover during a call", () => {
  beforeEach(() => {
    MockUA.instances = [];
    getMock.mockReset();
    serveMe(meWithServers(webphoneServer({ maxRetries: 1 }), secondaryServer));
  });

  it("never drops a live call to change servers, and takes the move once it ends", async () => {
    const { result } = renderPhone();
    await waitFor(() => expect(MockUA.instances).toHaveLength(1));

    const session = new MockSession();
    act(() => {
      MockUA.instances[0].emit("newRTCSession", { session, originator: "remote" });
    });
    await waitFor(() => expect(result.current[0].callBusy).toBe(true));

    failRegistration(MockUA.instances[0], "Timeout");
    act(() => {
      MockUA.instances[0].emit("disconnected");
    });

    // Tearing the UA down here would take the conversation with it — `stop()`
    // ends every session it owns — and a lost registration is a future problem
    // where a dropped caller is a present one.
    expect(MockUA.instances).toHaveLength(1);
    expect(MockUA.instances[0].stopped).toBe(false);
    expect(result.current[0].activeServerIndex).toBe(0);

    act(() => {
      session.emit("ended");
    });

    await waitFor(() => expect(MockUA.instances).toHaveLength(2));
    expect(socketUrls(MockUA.instances[1])).toEqual([SECONDARY_WS]);
    expect(result.current[0].activeServerIndex).toBe(1);
  });

  it("forgets an owed failover when the server registers after all", async () => {
    // A socket that blinks mid-call and comes back has not cost the phone
    // anything; collecting the deferred move once the caller hangs up would
    // abandon a server that is demonstrably working.
    const { result } = renderPhone();
    await waitFor(() => expect(MockUA.instances).toHaveLength(1));

    const session = new MockSession();
    act(() => {
      MockUA.instances[0].emit("newRTCSession", { session, originator: "remote" });
    });
    await waitFor(() => expect(result.current[0].callBusy).toBe(true));

    act(() => {
      MockUA.instances[0].emit("disconnected");
      MockUA.instances[0].emit("registered");
    });
    act(() => {
      session.emit("ended");
    });

    await waitFor(() => expect(result.current[0].connectionState).toBe("registered"));
    expect(MockUA.instances).toHaveLength(1);
    expect(result.current[0].activeServerIndex).toBe(0);
  });
});

describe("TURN REST credential refresh", () => {
  beforeEach(() => {
    MockUA.instances = [];
    getMock.mockReset();
    serveMe(webphoneMe);
  });

  it("schedules a refetch ahead of a minted TURN credential's expiry", async () => {
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    serveMe({
      ...webphoneMe,
      turnCredentials: { enabled: true, iceServers: [], expiresAt },
    });
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");

    renderPhone();

    await waitFor(() => {
      const scheduledNearExpiry = setTimeoutSpy.mock.calls.some(
        ([, delay]) => typeof delay === "number" && delay > 3.5 * 60_000 && delay < 4.5 * 60_000,
      );
      expect(scheduledNearExpiry).toBe(true);
    });

    setTimeoutSpy.mockRestore();
  });

  it("does not schedule a refetch when TURN REST credentials are disabled", async () => {
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");

    renderPhone();

    await waitFor(() => expect(MockUA.instances).toHaveLength(1));
    const scheduledNearExpiry = setTimeoutSpy.mock.calls.some(
      ([, delay]) => typeof delay === "number" && delay > 3 * 60_000,
    );
    expect(scheduledNearExpiry).toBe(false);

    setTimeoutSpy.mockRestore();
  });
});

describe("useWebRTCPhone change signal", () => {
  beforeEach(() => {
    MockUA.instances = [];
    getMock.mockReset();
  });

  it("renders a phone that was disabled when the shell mounted, without a reload", async () => {
    // The dock reads /me once, in the root layout. An admin who gives
    // themselves an extension mid-session would otherwise see nothing until a
    // full page reload — which reads as a broken feature, not a stale page.
    serveMe({ ...webphoneMe, enabled: false });
    const { result } = renderPhone();
    await waitFor(() => expect(result.current[0].shouldRender).toBe(false));

    serveMe(webphoneMe);
    const { notifyWebphoneChanged } = await import("../changed-signal");
    act(() => notifyWebphoneChanged());

    await waitFor(() => expect(result.current[0].shouldRender).toBe(true));
  });

  it("leaves a phone that is already up alone", async () => {
    // Re-reading behind a live UA would drop a registered badge back to
    // `loading`, and mid-call it could unmount the dock under a conversation.
    serveMe(webphoneMe);
    const { result } = renderPhone();
    await waitFor(() => expect(MockUA.instances).toHaveLength(1));

    const readsBefore = getMock.mock.calls.length;
    const { notifyWebphoneChanged } = await import("../changed-signal");
    act(() => notifyWebphoneChanged());

    expect(getMock.mock.calls.length).toBe(readsBefore);
    expect(result.current[0].shouldRender).toBe(true);
  });
});

describe("formatWebphoneDuration / formatWebphoneLogTime", () => {
  it("formats seconds as zero-padded HH:MM:SS", async () => {
    const { formatWebphoneDuration } = await import("./useWebRTCPhone");
    expect(formatWebphoneDuration(0)).toBe("00:00:00");
    expect(formatWebphoneDuration(65)).toBe("00:01:05");
    expect(formatWebphoneDuration(3661)).toBe("01:01:01");
  });

  it("clamps negative durations to zero", async () => {
    const { formatWebphoneDuration } = await import("./useWebRTCPhone");
    expect(formatWebphoneDuration(-5)).toBe("00:00:00");
  });

  it("returns an empty string for missing or invalid log timestamps", async () => {
    const { formatWebphoneLogTime } = await import("./useWebRTCPhone");
    expect(formatWebphoneLogTime(undefined)).toBe("");
    expect(formatWebphoneLogTime(null)).toBe("");
    expect(formatWebphoneLogTime("not-a-date")).toBe("");
  });
});
