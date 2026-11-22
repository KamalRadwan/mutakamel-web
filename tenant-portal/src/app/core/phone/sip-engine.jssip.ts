import type { RTCSession } from 'jssip/lib/RTCSession';
import type { RTCSessionEvent, UA, UAConfiguration } from 'jssip/lib/UA';
import type { WebSocketInterface } from 'jssip/lib/WebSocketInterface';
import type { PhoneMe, PhoneServer } from './phone.model';
import type { SipCallOptions, SipCauseEvent, SipEngine, SipEngineEvent, SipLeg } from './sip-engine';
import { JsSipLeg, createIceGate } from './sip-leg.jssip';

interface JsSipModuleShape {
  UA?: typeof UA;
  WebSocketInterface?: typeof WebSocketInterface;
  default?: {
    UA?: typeof UA;
    WebSocketInterface?: typeof WebSocketInterface;
  };
}

/** Real JsSIP 3.13.8 implementation of `SipEngine` for one server attempt (`PhoneState` owns failover). */
export class JsSipEngine implements SipEngine {
  private readonly listeners = new Map<SipEngineEvent, Set<(arg?: unknown) => void>>();
  private readonly liveSessions = new Set<RTCSession>();

  private ua: UA | null = null;
  private stopped = false;
  private traceSip = false;
  private pcConfig: RTCConfiguration = { iceServers: [] };

  readonly events = {
    on: (event: SipEngineEvent, handler: (arg?: unknown) => void): (() => void) => {
      let set = this.listeners.get(event);
      if (!set) {
        set = new Set();
        this.listeners.set(event, set);
      }
      set.add(handler);
      return () => {
        set.delete(handler);
      };
    },
  };

  async connect(server: PhoneServer, me: PhoneMe, ice: RTCIceServer[]): Promise<void> {
    this.stopped = false;
    this.traceSip = Boolean(server.traceSip);
    this.pcConfig =
      server.iceTransportPolicy === 'relay'
        ? { iceServers: ice, iceTransportPolicy: 'relay' }
        : { iceServers: ice };

    const JsSIP = await loadJsSip();
    if (this.stopped) return;

    const sipUsername = me.sipUsername ?? me.extension ?? '';
    const fromDomain = server.fromDomain?.trim() || null;
    const registrarServer = server.registrarServer?.trim() || null;
    const realm = server.realm?.trim() || null;
    const contactUri = server.contactUri?.trim() || null;
    const outboundProxy = server.outboundProxy?.trim() || null;
    const displayName = me.displayName || me.extension || undefined;

    const config: UAConfiguration = {
      sockets: [new JsSIP.WebSocketInterface(server.websocketUrl)],
      uri: `sip:${sipUsername}@${fromDomain || server.sipDomain}`,
      registrar_server: registrarServer ?? (fromDomain ? `sip:${server.sipDomain}` : undefined),
      authorization_user: sipUsername,
      password: me.sipPassword ?? undefined,
      realm: realm ?? undefined,
      display_name: displayName,
      register: false,
      register_expires: server.registerExpires,
      contact_uri: contactUri ?? undefined,
      session_timers: server.sessionTimers,
      extra_headers: outboundProxy ? [`Route: <${outboundProxy}>`] : undefined,
      user_agent: 'Mutakamel WebPhone',
    };

    const ua = new JsSIP.UA(config);
    this.ua = ua;

    return new Promise<void>((resolve, reject) => {
      let connectSettled = false;
      let stoppingOnDisconnect = false;

      ua.on('connected', () => {
        if (this.stopped) return;
        if (this.traceSip) {
          console.info('[phone] connected', { server: server.name, url: server.websocketUrl });
        }
        if (!connectSettled) {
          connectSettled = true;
          resolve();
        }
        this.emit('connected');
      });

      ua.on('registered', () => {
        if (this.stopped) return;
        if (this.traceSip) {
          console.info('[phone] registered', { server: server.name });
        }
        this.emit('registered');
      });

      ua.on('registrationFailed', (event) => {
        if (this.stopped) return;
        const cause = event?.cause;
        if (this.traceSip) {
          console.info('[phone] registrationFailed', { server: server.name, cause: cause ?? null });
        }
        this.emit('registrationFailed', { cause } satisfies SipCauseEvent);
      });

      ua.on('disconnected', (event) => {
        if (this.stopped || stoppingOnDisconnect) return;
        const cause = event?.reason;
        if (this.traceSip) {
          console.info('[phone] disconnected', { server: server.name, cause: cause ?? null });
        }

        // Disable JsSIP's auto-reconnect when idle so PhoneState's server failover decides.
        if (!this.hasLiveSessions()) {
          stoppingOnDisconnect = true;
          try {
            ua.stop();
          } catch {
            // Ignore stop errors after disconnect
          } finally {
            stoppingOnDisconnect = false;
          }
        }

        const payload = cause ? ({ cause } satisfies SipCauseEvent) : undefined;
        if (!connectSettled) {
          connectSettled = true;
          this.emit('disconnected', payload);
          reject(new Error(cause || 'WebSocket disconnected'));
          return;
        }
        this.emit('disconnected', payload);
      });

      ua.on('newRTCSession', (event: RTCSessionEvent) => {
        if (this.stopped) return;
        if ((event.originator as string) !== 'remote') return;
        const leg = this.trackLeg(new JsSipLeg(event.session, this.pcConfig, this.traceSip));
        this.emit('incoming', leg);
      });

      if (this.traceSip) {
        console.info('[phone] connect', { server: server.name, url: server.websocketUrl });
      }
      try {
        ua.start();
      } catch (error) {
        connectSettled = true;
        reject(error);
      }
    });
  }

  register(): void {
    if (this.stopped || !this.ua) return;
    this.ua.register();
  }

  unregister(): void {
    if (this.stopped || !this.ua) return;
    try {
      this.ua.unregister({ all: false });
    } catch {
      // Ignore unregister errors when the WebSocket is already closed
    }
  }

  stop(): void {
    this.stopped = true;
    this.liveSessions.clear();
    this.listeners.clear();
    const ua = this.ua;
    this.ua = null;
    if (ua) {
      try {
        ua.stop();
      } catch {
        // Ignore stop errors on teardown
      }
    }
  }

  call(target: string, opts: SipCallOptions): SipLeg {
    if (!this.ua || this.stopped) {
      throw new Error('SIP engine is not connected');
    }
    if (this.traceSip) {
      console.info('[phone] call', { target });
    }
    const session = this.ua.call(target, {
      mediaStream: opts.stream,
      mediaConstraints: { audio: true, video: false },
      pcConfig: this.pcConfig,
      rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
      fromUserName: opts.fromUserName ?? undefined,
      fromDisplayName: opts.fromDisplayName ?? undefined,
      eventHandlers: {
        icecandidate: createIceGate(this.traceSip),
      },
    });
    return this.trackLeg(new JsSipLeg(session, this.pcConfig, this.traceSip));
  }

  private trackLeg(leg: JsSipLeg): JsSipLeg {
    const session = leg.session;
    const ended = typeof session.isEnded === 'function' ? session.isEnded() : false;
    if (!ended) {
      this.liveSessions.add(session);
    }
    const remove = () => {
      this.liveSessions.delete(session);
    };
    leg.on('ended', remove);
    leg.on('failed', remove);
    return leg;
  }

  private hasLiveSessions(): boolean {
    for (const session of this.liveSessions) {
      try {
        if (typeof session.isEnded !== 'function' || !session.isEnded()) {
          return true;
        }
      } catch {
        // Ignore inspection errors on stale sessions
      }
    }
    return false;
  }

  private emit(event: SipEngineEvent, arg?: unknown): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      handler(arg);
    }
  }
}

async function loadJsSip(): Promise<{ UA: typeof UA; WebSocketInterface: typeof WebSocketInterface }> {
  const rawMod = (await import('jssip')) as unknown as JsSipModuleShape;
  const UAImpl = rawMod.UA ?? rawMod.default?.UA;
  const WebSocketInterfaceImpl = rawMod.WebSocketInterface ?? rawMod.default?.WebSocketInterface;
  if (!UAImpl || !WebSocketInterfaceImpl) {
    throw new Error('Failed to load JsSIP module');
  }
  return {
    UA: UAImpl,
    WebSocketInterface: WebSocketInterfaceImpl,
  };
}
