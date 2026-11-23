import { DOCUMENT, DestroyRef, Service, Signal, WritableSignal, computed, effect, inject, signal, untracked } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { LanguageState } from '../i18n/language';
import { Notify } from '../notify/notify';
import { lookupCaller } from './call-lookup';
import { createCallLog, getMe } from './phone.api';
import {
  CallLeg,
  CallMode,
  CallSource,
  CallState,
  ConnectionState,
  CreateCallLogInput,
  EndReason,
  EndedInfo,
  MediaNotice,
  PhoneBlock,
  PhoneCommand,
  PhoneDevicesInfo,
  PhoneIdentity,
  PhoneLostPayload,
  PhoneMe,
  PhoneMeBlock,
  PhoneMicPermission,
  PhoneNotifyPermission,
  PhoneServer,
  PhoneServerInfo,
  PhoneStatus,
  PhoneStatusCode,
  PhoneSyncedState,
  PhoneTab,
  Quality,
  clampCallDuration,
  classifyMeError,
  formatCallCause,
  meErrorBlock,
  resolveCallLogType,
} from './phone.model';
import { ConferenceMixLeg, PhoneMedia } from './phone-media';
import { toDialable, toSipTarget } from './phone-number';
import { PhoneNotify } from './phone-notify';
import { PhonePrefs, readPhonePrefs, writePhonePrefs } from './phone-preferences';
import { QualityEstimator, pickWorstQuality } from './phone-quality';
import { PhoneSync } from './phone-sync';
import { PhoneTones } from './phone-tones';
import { SIP_ENGINE_FACTORY as CORE_SIP_ENGINE_FACTORY, SipCauseEvent, SipEngine, SipLeg } from './sip-engine';
import { SIP_ENGINE_FACTORY } from './sip-engine.provider';

export type {
  CallLeg,
  CallLog,
  CallLogType,
  CallMode,
  CallSource,
  CallSourceType,
  CallState,
  ConnectionState,
  EndReason,
  EndedInfo,
  LegRole,
  MediaNotice,
  PhoneBlock,
  PhoneDevicesInfo,
  PhoneIdentity,
  PhoneMe,
  PhoneMeBlock,
  PhoneMicPermission,
  PhoneNotifyPermission,
  PhoneServer,
  PhoneServerInfo,
  PhoneStatus,
  PhoneStatusCode,
  PhoneTab,
  Quality,
} from './phone.model';
export type { PhonePrefs, PhoneRingVolumeLevel, PhoneVolumeLevel } from './phone-preferences';

const CALL_WAIT_TIMEOUT_MS = 8_000;
const REGISTER_LAP_PAUSE_MS = 5_000;
const REGISTER_RETRY_DELAY_MS = 1_000;
const QUALITY_GRACE_MS = 3_000;
const QUALITY_INTERVAL_MS = 3_000;
const MEDIA_DISCONNECTED_DROP_MS = 12_000;
const AUTO_ANSWER_DELAY_MS = 250;
const ENDED_RETURN_TO_DIALER_MS = 1_400;
const TURN_REFRESH_BEFORE_EXPIRY_MS = 60_000;

const FULL_PANEL_BLOCKS = new Set<PhoneBlock>([
  'loading',
  'notConfigured',
  'registrationFailed',
  'offline',
  'requiresHttps',
  'unsupported',
  'paused',
  'suspended',
  'scopeMismatch',
]);

/**
 * An account change that arrived while a call was live and waits for the last call to end.
 * `hide` clears the phone, `suspended` / `scopeMismatch` show that blocked state, `reload` fetches `/me` again.
 */
type PendingAccountChange = 'hide' | PhoneMeBlock | 'reload';

interface InternalLegRecord {
  leg: CallLeg;
  raw: SipLeg;
  remoteStream: MediaStream | null;
  qualityEstimator: QualityEstimator;
  unsubs: (() => void)[];
  peerCleanup: (() => void) | null;
  disconnectDropTimer: ReturnType<typeof setTimeout> | null;
  finalized: boolean;
  logSubmitted: boolean;
  localHangup: boolean;
  localDecline: boolean;
  mediaDropped: boolean;
  requestedTransfer: { kind: 'BLIND' | 'ATTENDED'; transferredTo: string } | null;
  pendingTransfer: { kind: 'BLIND' | 'ATTENDED'; transferredTo: string } | null;
}

const FOLLOWER_COMMANDS = new Set([
  'answer',
  'decline',
  'silenceRing',
  'hangup',
  'toggleMute',
  'toggleHold',
  'pressKey',
  'blindTransfer',
  'startConsult',
  'swapLegs',
  'completeTransfer',
  'cancelConsult',
  'mergeConference',
  'addParty',
  'removeParty',
  'endConference',
  'holdAll',
  'resumeAll',
  'setToneTarget',
  'toggleSpeaker',
  'retry',
]);

function createDialValueSignal(initial = ''): WritableSignal<string> {
  const sig = signal(toDialable(initial));
  const rawSet = sig.set.bind(sig);
  const rawUpdate = sig.update.bind(sig);
  sig.set = (value: string) => rawSet(toDialable(value));
  sig.update = (fn: (current: string) => string) => rawUpdate((current) => toDialable(fn(current)));
  return sig;
}

/** Root web-phone state machine coordinating registration, media, calls, transfer, conference, and multi-tab sync. */
@Service()
export class PhoneState {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState);
  private readonly media = inject(PhoneMedia);
  private readonly tones = inject(PhoneTones);
  private readonly notifySvc = inject(PhoneNotify);
  private readonly sync = inject(PhoneSync);
  private readonly engineFactory =
    inject(CORE_SIP_ENGINE_FACTORY, { optional: true }) ?? inject(SIP_ENGINE_FACTORY);

  // Secrets stay in this private field only; never exposed in signals, storage, bus, logs, or toasts.
  #me: PhoneMe | null = null;
  private engine: SipEngine | null = null;
  private engineUnsubs: (() => void)[] = [];
  private regGeneration = 0;
  private activeServerIndex = 0;
  private activeAttempt = 1;
  private serverDeadlineAt = 0;
  private lastSipCause: string | undefined = undefined;
  private regRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private regLapTimer: ReturnType<typeof setTimeout> | null = null;
  private serverDeadlineTimer: ReturnType<typeof setTimeout> | null = null;
  private turnRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private failoverOwed = false;
  private stoodDown = false;
  private disposed = false;

  private readonly records = new Map<string, InternalLegRecord>();
  private conferenceId: string | null = null;
  private conferenceEndingAll = false;
  private toneTargetLegId: string | null = null;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private leaderSyncInterval: ReturnType<typeof setInterval> | null = null;
  private qualityGraceTimer: ReturnType<typeof setTimeout> | null = null;
  private qualityPollTimer: ReturnType<typeof setInterval> | null = null;
  private autoAnswerTimer: ReturnType<typeof setTimeout> | null = null;
  private endedDialerTimer: ReturnType<typeof setTimeout> | null = null;
  private handoverPending = signal(false);
  private loadSeq = 0;
  private pendingAccountChange: PendingAccountChange | null = null;
  private seenLostIds = new Set<string>();

  // Local leader state backing read signals
  private readonly _visible = signal(false);
  private readonly _paused = signal(false);
  private readonly _configured = signal(false);
  private readonly _connection = signal<ConnectionState>('idle');
  private readonly _status = signal<PhoneStatus>({ code: 'idle' });
  private readonly _server = signal<PhoneServerInfo>({ index: 0, count: 0, name: '', attempt: 0 });
  private readonly _block = signal<PhoneBlock>('loading');
  private readonly _identity = signal<PhoneIdentity>({ displayName: '', extension: '' });
  private readonly _legs = signal<CallLeg[]>([]);
  private readonly _mode = signal<CallMode>('single');
  private readonly _focusedLegId = signal<string | null>(null);
  private readonly _timer = signal(0);
  private readonly _muted = signal(false);
  private readonly _speakerMuted = signal(false);
  private readonly _quality = signal<Quality | null>(null);
  private readonly _ringSilenced = signal(false);
  private readonly _ended = signal<EndedInfo | null>(null);
  private readonly _sentTones = signal('');
  private readonly _canAnswerHere = signal(true);
  private readonly _missedCount = signal(0);

  private readonly _prefs = signal<PhonePrefs>(readPhonePrefs());
  private readonly _panelOpen = signal<boolean>(this._prefs().panelOpen);
  private readonly _tab = signal<PhoneTab>('phone');

  // Public signals (synced across tabs on followers via TabBus)
  readonly isLeader: Signal<boolean> = this.sync.isLeader;

  readonly visible: Signal<boolean> = computed(() =>
    this.isLeader() ? this._visible() : (this.sync.syncedState()?.visible ?? this._visible()),
  );
  readonly paused: Signal<boolean> = computed(() =>
    this.isLeader() ? this._paused() : (this.sync.syncedState()?.paused ?? this._paused()),
  );
  readonly configured: Signal<boolean> = computed(() =>
    this.isLeader() ? this._configured() : (this.sync.syncedState()?.configured ?? this._configured()),
  );
  readonly connection: Signal<ConnectionState> = computed(() =>
    this.isLeader() ? this._connection() : (this.sync.syncedState()?.connection ?? this._connection()),
  );
  readonly status: Signal<{ code: PhoneStatusCode; detail?: string }> = computed(() =>
    this.isLeader() ? this._status() : (this.sync.syncedState()?.status ?? this._status()),
  );
  readonly server: Signal<{ index: number; count: number; name: string; attempt: number }> = computed(() =>
    this.isLeader() ? this._server() : (this.sync.syncedState()?.server ?? this._server()),
  );
  readonly block: Signal<PhoneBlock> = computed(() => {
    const base = this.isLeader() ? this._block() : (this.sync.syncedState()?.block ?? this._block());
    return base && FULL_PANEL_BLOCKS.has(base) ? base : null;
  });
  readonly identity: Signal<{ displayName: string; extension: string }> = computed(() =>
    this.isLeader() ? this._identity() : (this.sync.syncedState()?.identity ?? this._identity()),
  );

  readonly legs: Signal<CallLeg[]> = computed(() =>
    this.isLeader() ? this._legs() : (this.sync.syncedState()?.legs ?? this._legs()),
  );
  readonly mode: Signal<'single' | 'consult' | 'conference'> = computed(() =>
    this.isLeader() ? this._mode() : (this.sync.syncedState()?.mode ?? this._mode()),
  );
  readonly focusedLegId: Signal<string | null> = computed(() =>
    this.isLeader() ? this._focusedLegId() : (this.sync.syncedState()?.focusedLegId ?? this._focusedLegId()),
  );
  readonly focusedLeg: Signal<CallLeg | null> = computed(() => {
    const id = this.focusedLegId();
    const list = this.legs();
    return (id ? list.find((l) => l.id === id) : null) ?? list[0] ?? null;
  });
  readonly callState: Signal<CallState> = computed(() => this.focusedLeg()?.state ?? 'idle');
  readonly timer: Signal<number> = computed(() =>
    this.isLeader() ? this._timer() : (this.sync.syncedState()?.timer ?? this._timer()),
  );
  readonly muted: Signal<boolean> = computed(() =>
    this.isLeader() ? this._muted() : (this.sync.syncedState()?.muted ?? this._muted()),
  );
  readonly speakerMuted: Signal<boolean> = computed(() =>
    this.isLeader() ? this._speakerMuted() : (this.sync.syncedState()?.speakerMuted ?? this._speakerMuted()),
  );
  readonly quality: Signal<Quality | null> = computed(() =>
    this.isLeader() ? this._quality() : (this.sync.syncedState()?.quality ?? this._quality()),
  );
  readonly ringing: Signal<CallLeg | null> = computed(
    () => this.legs().find((leg) => leg.state === 'incoming') ?? null,
  );
  readonly ringSilenced: Signal<boolean> = computed(() =>
    this.isLeader() ? this._ringSilenced() : (this.sync.syncedState()?.ringSilenced ?? this._ringSilenced()),
  );
  readonly ended: Signal<EndedInfo | null> = computed(() =>
    this.isLeader() ? this._ended() : (this.sync.syncedState()?.ended ?? this._ended()),
  );
  readonly sentTones: Signal<string> = computed(() =>
    this.isLeader() ? this._sentTones() : (this.sync.syncedState()?.sentTones ?? this._sentTones()),
  );
  readonly busy: Signal<boolean> = computed(() =>
    this.legs().some((leg) => leg.state !== 'idle' && leg.state !== 'ended' && leg.state !== 'failed'),
  );
  readonly canPlaceCalls: Signal<boolean> = computed(
    () =>
      this.visible() &&
      this.configured() &&
      !this.busy() &&
      (this.connection() === 'registered' || this.handoverPending()),
  );
  readonly canAnswerHere: Signal<boolean> = computed(() =>
    this.isLeader() ? true : (this.sync.syncedState()?.canAnswerHere ?? this._canAnswerHere()),
  );
  readonly maxParties = 3 as const;

  // Inputs and local UI signals
  readonly dialValue: WritableSignal<string> = createDialValueSignal('');
  readonly dialSource: WritableSignal<CallSource | null> = signal<CallSource | null>(null);
  readonly transferValue: WritableSignal<string> = signal('');
  readonly panelOpen: Signal<boolean> = this._panelOpen.asReadonly();
  readonly tab: Signal<'phone' | 'calls' | 'settings'> = this._tab.asReadonly();
  readonly missedCount: Signal<number> = computed(() =>
    this.isLeader() ? this._missedCount() : (this.sync.syncedState()?.missedCount ?? this._missedCount()),
  );
  readonly mediaNotice: Signal<MediaNotice | null> = computed(() => {
    const notice = this.isLeader()
      ? this.media.mediaNotice()
      : (this.sync.syncedState()?.mediaNotice ?? this.media.mediaNotice());
    if (notice) return notice;
    if (this.micPermission() === 'denied') return 'permissionDenied';
    return null;
  });

  // Devices and preferences
  readonly micPermission: Signal<PhoneMicPermission> = this.media.micPermission;
  readonly notifyPermission: Signal<PhoneNotifyPermission> = this.notifySvc.permission;
  readonly devices: Signal<PhoneDevicesInfo> = this.media.devices;
  readonly prefs: Signal<PhonePrefs> = this._prefs.asReadonly();
  readonly micLevel: Signal<number> = this.media.micLevel;
  readonly speakerLevel: Signal<number> = this.media.speakerLevel;

  private readonly onOnline = () => {
    if (!this.disposed && this.isLeader() && this.configured() && this._connection() === 'offline') {
      this.retry();
    }
  };

  private readonly onOffline = () => {
    if (this.disposed || !this.isLeader() || !this.configured()) return;
    if (this.busy()) {
      this.failoverOwed = true;
      return;
    }
    this.stopEngine();
    this.clearRegistrationTimers();
    this._connection.set('offline');
    this._status.set({ code: 'disconnected' });
    this._block.set('offline');
  };

  constructor() {
    this.media.init(
      (missing) => this.handleMissingDevices(missing),
      () => this._prefs(),
    );

    this.sync.init({
      isBusy: () => this.busy(),
      onStandDown: () => this.handleStandDown(),
      onLeadershipStop: () => this.handleLeadershipStop(),
      onBecomeLeader: (crashedSnapshot) => this.handleBecomeLeader(crashedSnapshot),
      onBecomeFollower: () => this.handleBecomeFollower(),
      onCommand: (cmd) => this.executeRemoteCommand(cmd),
      onLostCall: (payload) => this.showLostCallToast(payload, true),
      onPrefsStorageChange: (nextPrefs) => this.applyExternalPrefsChange(nextPrefs),
      onBeforeUnloadCheck: () => this.isLeader() && this.busy(),
      onPageHideCapture: () => this.buildPageHideLossInfo(),
    });

    const win = this.document.defaultView;
    win?.addEventListener('online', this.onOnline);
    win?.addEventListener('offline', this.onOffline);

    // Preload web-phone translations for current language.
    effect(() => {
      const lang = this.language.current();
      untracked(() => {
        void this.ensureTranslationsLoaded(lang);
      });
    });

    // Keep mic meter active only while Settings tab is open or a call is running.
    effect(() => {
      const active = (this._panelOpen() && this._tab() === 'settings') || this.busy();
      untracked(() => {
        this.media.setMeterActive(active, this._prefs());
      });
    });

    // Publish synced state whenever leader read signals change.
    effect(() => {
      const leader = this.isLeader();
      const snapshot = this.buildSyncedStateSnapshot();
      untracked(() => {
        if (leader) {
          this.sync.publishState(snapshot);
        }
      });
    });

    // Periodically publish state once a second while a call runs (leader only).
    effect(() => {
      const leader = this.isLeader();
      const running = this.busy();
      untracked(() => {
        this.stopLeaderSyncTicker();
        if (leader && running) {
          this.leaderSyncInterval = setInterval(() => {
            if (this.isLeader() && this.busy()) {
              this.sync.publishState(this.buildSyncedStateSnapshot());
            }
          }, 1_000);
        }
      });
    });

    // Arm first-click desktop notification prompt once the phone is visible and not yet asked.
    effect(() => {
      const isVisible = this.visible();
      const prefs = this._prefs();
      const perm = this.notifyPermission();
      untracked(() => {
        if (isVisible && !prefs.notifyAsked && perm === 'default') {
          this.notifySvc.armFirstClickPrompt(
            () => this.visible() && !this._prefs().notifyAsked && this.notifySvc.syncPermission() === 'default',
            () => this.promptNotificationPermission(),
          );
        }
      });
    });

    this.destroyRef.onDestroy(() => {
      this.disposed = true;
      win?.removeEventListener('online', this.onOnline);
      win?.removeEventListener('offline', this.onOffline);
      this.cleanupAllResources(true);
    });

    void this.reload();
  }

  open(tab?: PhoneTab): void {
    if (tab) {
      this._tab.set(tab);
      if (tab === 'calls') this.clearMissed();
    }
    this._panelOpen.set(true);
    this.persistLocalPanelOpen(true);
  }

  close(): void {
    this._panelOpen.set(false);
    this.persistLocalPanelOpen(false);
  }

  toggle(): void {
    if (this._panelOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  setTab(tab: PhoneTab): void {
    this._tab.set(tab);
    if (tab === 'calls') {
      this.clearMissed();
    }
  }

  async call(number?: string, source?: CallSource | null): Promise<void> {
    const raw = number !== undefined ? number : this.dialValue();
    const cleaned = toDialable(raw);
    if (!cleaned) return;

    this.dialValue.set(cleaned);
    if (source !== undefined) {
      this.dialSource.set(source);
    }
    const effectiveSource = source !== undefined ? source : this.dialSource();

    this.open('phone');
    this.dismissEnded();

    if (!this.visible() || !this.configured() || this.busy()) return;

    if (!this.isLeader() || this.connection() !== 'registered') {
      this.handoverPending.set(true);
      if (!this.isLeader()) {
        this.sync.requestLeadership();
      }
      const ready = await this.waitForLeaderRegistration(CALL_WAIT_TIMEOUT_MS);
      this.handoverPending.set(false);
      if (!ready) {
        this._status.set({ code: 'callFailed' });
        await this.ensureTranslationsLoaded();
        this.notify.error(this.t('toast.notConnected'));
        return;
      }
    }

    const me = this.#me;
    const server = this.currentServer(me);
    const engine = this.engine;
    if (!me || !server || !engine) {
      this._status.set({ code: 'callFailed' });
      await this.ensureTranslationsLoaded();
      this.notify.error(this.t('toast.notConnected'));
      return;
    }

    let micStream: MediaStream;
    try {
      micStream = await this.media.acquireCallMic(this._prefs(), this._muted());
    } catch {
      if (!this.isMicProblem()) {
        this._status.set({ code: 'callFailed' });
        await this.ensureTranslationsLoaded();
        this.notify.error(this.t('toast.callFailed'));
      }
      return;
    }

    const targetUri = toSipTarget(cleaned, server.sipDomain);
    const fromUserName = me.outboundCallerId ?? server.defaultCallerId ?? me.extension;
    const fromDisplayName = me.displayName ?? me.extension;
    const rawLeg = engine.call(targetUri, { fromUserName, fromDisplayName, stream: micStream });

    const leg: CallLeg = {
      id: rawLeg.id,
      role: 'primary',
      direction: 'outgoing',
      number: cleaned,
      displayName: effectiveSource?.label ?? null,
      source: effectiveSource,
      state: 'calling',
      held: false,
      startedAt: new Date().toISOString(),
      answeredAt: null,
    };

    this._mode.set('single');
    this._focusedLegId.set(leg.id);
    this._status.set({ code: 'calling' });
    this._sentTones.set('');
    this.attachLegRecord(leg, rawLeg);
    this.sync.guardsChanged();
  }

  answer(): void {
    if (!this.isLeader()) {
      this.open('phone');
      this.sync.sendCommand('answer');
      return;
    }
    const incoming = this.findRingingRecord();
    if (!incoming) return;

    this.clearAutoAnswerTimer();
    this.tones.stopRing();
    this.notifySvc.closeRingNotification();
    this._ringSilenced.set(false);

    void this.answerIncomingRecord(incoming);
    this.open('phone');
  }

  decline(): void {
    if (!this.isLeader()) {
      this.sync.sendCommand('decline');
      return;
    }
    const incoming = this.findRingingRecord();
    if (!incoming) return;

    this.clearAutoAnswerTimer();
    this.tones.stopRing();
    this.notifySvc.closeRingNotification();
    incoming.localDecline = true;
    incoming.raw.terminate(603);
  }

  silenceRing(): void {
    this._ringSilenced.set(true);
    this.tones.stopRing();
    if (!this.isLeader()) {
      this.sync.sendCommand('silenceRing');
    }
  }

  hangup(legId?: string): void {
    if (!this.isLeader()) {
      this.sync.sendCommand('hangup', legId);
      return;
    }
    const targetId = legId ?? this._focusedLegId() ?? this._legs()[0]?.id ?? null;
    if (!targetId) return;
    const record = this.records.get(targetId);
    if (!record || record.finalized) return;

    this.clearAutoAnswerTimer();
    if (record.leg.state === 'incoming') {
      this.tones.stopRing();
      this.notifySvc.closeRingNotification();
      record.localDecline = true;
      record.raw.terminate(603);
      return;
    }
    record.localHangup = true;
    record.raw.terminate();
  }

  dismissEnded(): void {
    this._ended.set(null);
  }

  toggleMute(): void {
    if (!this.isLeader()) {
      this.sync.sendCommand('toggleMute');
      return;
    }
    const nextMuted = !this._muted();
    this._muted.set(nextMuted);
    this.media.applyMicPrefs(this._prefs(), nextMuted);
    for (const record of this.records.values()) {
      if (record.leg.state === 'active') {
        if (nextMuted) record.raw.mute();
        else record.raw.unmute();
      }
    }
  }

  toggleHold(legId?: string): void {
    if (!this.isLeader()) {
      this.sync.sendCommand('toggleHold', legId);
      return;
    }
    const targetId = legId ?? this._focusedLegId() ?? this._legs()[0]?.id ?? null;
    if (!targetId) return;
    const record = this.records.get(targetId);
    if (!record || record.leg.state !== 'active') return;

    const ok = record.leg.held ? record.raw.unhold() : record.raw.hold();
    if (!ok) return;

    this.updateLeg(targetId, (leg) => ({ ...leg, held: !leg.held }));
  }

  toggleSpeaker(): void {
    if (!this.isLeader()) {
      this.sync.sendCommand('toggleSpeaker');
      return;
    }
    const nextMuted = !this._speakerMuted();
    this._speakerMuted.set(nextMuted);
    this.media.applySpeakerPrefs(this._prefs(), nextMuted);
  }

  pressKey(key: string): void {
    const cleanKey = key.trim();
    if (!cleanKey) return;

    if (!this.busy()) {
      if (!/^[0-9*#+]$/.test(cleanKey)) return;
      this.dialValue.update((curr) => `${curr}${cleanKey}`);
      this.tones.playDtmf(cleanKey, this._prefs().speakerVolume);
      return;
    }

    if (!this.isLeader()) {
      this.sync.sendCommand('pressKey', cleanKey);
      return;
    }

    if (!/^[0-9*#A-Da-d]$/.test(cleanKey)) return;
    const dtmfTone = cleanKey.toUpperCase();
    const targetId = this.toneTargetLegId ?? this._focusedLegId() ?? this._legs()[0]?.id ?? null;
    const record = targetId ? this.records.get(targetId) : null;
    if (!record || record.leg.state !== 'active') return;

    record.raw.dtmf(dtmfTone);
    this._sentTones.update((curr) => `${curr}${dtmfTone}`);
    this.tones.playDtmf(dtmfTone, this._prefs().speakerVolume);
  }

  deleteKey(): void {
    this.dialValue.update((curr) => (curr.length > 0 ? curr.slice(0, -1) : ''));
  }

  async copyNumber(): Promise<void> {
    const value = this.dialValue() || this.focusedLeg()?.number || '';
    if (!value) return;
    try {
      await navigator.clipboard?.writeText(value);
      await this.ensureTranslationsLoaded();
      this.notify.info(this.t('toast.copied'));
    } catch {
      // Clipboard may be unavailable in restricted contexts or tests.
    }
  }

  blindTransfer(target: string): void {
    if (!this.isLeader()) {
      this.sync.sendCommand('blindTransfer', target);
      return;
    }
    const cleaned = toDialable(target) || target.trim();
    const server = this.currentServer(this.#me);
    const focused = this.focusedLeg();
    const record = focused ? this.records.get(focused.id) : null;
    if (!cleaned || !server || !record || record.leg.state !== 'active') return;

    this._status.set({ code: 'transferring' });
    record.requestedTransfer = { kind: 'BLIND', transferredTo: cleaned };
    record.raw.refer(toSipTarget(cleaned, server.sipDomain));
  }

  async startConsult(target: string): Promise<void> {
    if (!this.isLeader()) {
      this.sync.sendCommand('startConsult', target);
      return;
    }
    const cleaned = toDialable(target) || target.trim();
    const me = this.#me;
    const server = this.currentServer(me);
    const engine = this.engine;
    const primary = this.findLegByRole('primary') ?? Array.from(this.records.values())[0] ?? null;
    if (!cleaned || !me || !server || !engine || !primary || primary.leg.state !== 'active') return;

    if (!primary.leg.held) {
      if (primary.raw.hold()) {
        this.updateLeg(primary.leg.id, (leg) => ({ ...leg, held: true }));
      }
    }

    let micStream: MediaStream;
    try {
      micStream = this.media.getCallMicStream() ?? (await this.media.acquireCallMic(this._prefs(), this._muted()));
    } catch {
      if (primary.leg.held && primary.raw.unhold()) {
        this.updateLeg(primary.leg.id, (leg) => ({ ...leg, held: false }));
      }
      await this.ensureTranslationsLoaded();
      this.notify.error(this.t('toast.consultFailed', { name: cleaned }));
      return;
    }

    const rawConsult = engine.call(toSipTarget(cleaned, server.sipDomain), {
      fromUserName: me.outboundCallerId ?? server.defaultCallerId ?? me.extension,
      fromDisplayName: me.displayName ?? me.extension,
      stream: micStream,
    });

    const consultLeg: CallLeg = {
      id: rawConsult.id,
      role: 'consult',
      direction: 'outgoing',
      number: cleaned,
      displayName: null,
      source: null,
      state: 'calling',
      held: false,
      startedAt: new Date().toISOString(),
      answeredAt: null,
    };

    this._mode.set('consult');
    this._focusedLegId.set(consultLeg.id);
    this.attachLegRecord(consultLeg, rawConsult);
  }

  swapLegs(): void {
    if (!this.isLeader()) {
      this.sync.sendCommand('swapLegs');
      return;
    }
    if (this._mode() !== 'consult') return;
    const all = Array.from(this.records.values()).filter((r) => !r.finalized);
    if (all.length < 2) return;

    const talking = all.find((r) => !r.leg.held) ?? all[0];
    const other = all.find((r) => r.leg.id !== talking.leg.id);
    if (!other) return;

    if (!talking.leg.held && talking.raw.hold()) {
      this.updateLeg(talking.leg.id, (l) => ({ ...l, held: true }));
    }
    if (other.leg.held && other.raw.unhold()) {
      this.updateLeg(other.leg.id, (l) => ({ ...l, held: false }));
    }

    this._focusedLegId.set(other.leg.id);
    this.toneTargetLegId = other.leg.id;
    void this.media.playRemoteStream(other.remoteStream, this._prefs(), this._speakerMuted());
  }

  completeTransfer(): void {
    if (!this.isLeader()) {
      this.sync.sendCommand('completeTransfer');
      return;
    }
    if (this._mode() !== 'consult') return;
    const server = this.currentServer(this.#me);
    const primary = this.findLegByRole('primary');
    const consult = this.findLegByRole('consult');
    if (!server || !primary || !consult || consult.leg.state !== 'active') return;

    const targetLabel = consult.leg.displayName ?? consult.leg.number;
    this._status.set({ code: 'transferring' });
    primary.requestedTransfer = { kind: 'ATTENDED', transferredTo: targetLabel };
    consult.requestedTransfer = { kind: 'ATTENDED', transferredTo: targetLabel };
    primary.raw.refer(toSipTarget(consult.leg.number, server.sipDomain), consult.raw);
  }

  cancelConsult(): void {
    if (!this.isLeader()) {
      this.sync.sendCommand('cancelConsult');
      return;
    }
    if (this._mode() !== 'consult') return;
    const primary = this.findLegByRole('primary');
    const consult = this.findLegByRole('consult');
    if (consult && !consult.finalized) {
      consult.localHangup = true;
      consult.raw.terminate();
    }
    if (primary && !primary.finalized) {
      if (primary.leg.held && primary.raw.unhold()) {
        this.updateLeg(primary.leg.id, (l) => ({ ...l, held: false }));
      }
      this._mode.set('single');
      this._focusedLegId.set(primary.leg.id);
      this.toneTargetLegId = primary.leg.id;
      void this.media.playRemoteStream(primary.remoteStream, this._prefs(), this._speakerMuted());
    }
  }

  mergeConference(): void {
    if (!this.isLeader()) {
      this.sync.sendCommand('mergeConference');
      return;
    }
    const live = this.liveRecords();
    if (live.length < 2) return;

    const prevHoldStates = live.map((r) => ({ id: r.leg.id, held: r.leg.held }));
    for (const r of live) {
      if (r.leg.held && r.raw.unhold()) {
        this.updateLeg(r.leg.id, (l) => ({ ...l, held: false }));
      }
    }

    this.conferenceId = this.conferenceId ?? createUuid();
    void this.startOrRollbackConferenceMix(live, prevHoldStates);
  }

  async addParty(target: string): Promise<void> {
    if (!this.isLeader()) {
      this.sync.sendCommand('addParty', target);
      return;
    }
    const cleaned = toDialable(target) || target.trim();
    const me = this.#me;
    const server = this.currentServer(me);
    const engine = this.engine;
    const live = this.liveRecords();
    if (!cleaned || !me || !server || !engine) return;
    if (live.length >= this.maxParties) return;

    let micStream: MediaStream;
    try {
      micStream = this.media.getCallMicStream() ?? (await this.media.acquireCallMic(this._prefs(), this._muted()));
    } catch {
      await this.ensureTranslationsLoaded();
      this.notify.error(this.t('toast.partyFailed', { name: cleaned }));
      return;
    }

    this.conferenceId = this.conferenceId ?? createUuid();
    const rawParty = engine.call(toSipTarget(cleaned, server.sipDomain), {
      fromUserName: me.outboundCallerId ?? server.defaultCallerId ?? me.extension,
      fromDisplayName: me.displayName ?? me.extension,
      stream: micStream,
    });

    const partyLeg: CallLeg = {
      id: rawParty.id,
      role: 'party',
      direction: 'outgoing',
      number: cleaned,
      displayName: null,
      source: null,
      state: 'calling',
      held: false,
      startedAt: new Date().toISOString(),
      answeredAt: null,
    };

    this._mode.set('conference');
    this.attachLegRecord(partyLeg, rawParty);
  }

  removeParty(legId: string): void {
    if (!this.isLeader()) {
      this.sync.sendCommand('removeParty', legId);
      return;
    }
    const record = this.records.get(legId);
    if (!record || record.finalized) return;
    record.localHangup = true;
    record.raw.terminate();
  }

  endConference(): void {
    if (!this.isLeader()) {
      this.sync.sendCommand('endConference');
      return;
    }
    const live = this.liveRecords();
    if (live.length === 0) return;

    this.conferenceEndingAll = true;
    this.media.stopConferenceMix();
    for (const record of live) {
      record.localHangup = true;
      record.raw.terminate();
    }
  }

  holdAll(): void {
    if (!this.isLeader()) {
      this.sync.sendCommand('holdAll');
      return;
    }
    for (const record of this.liveRecords()) {
      if (record.leg.state === 'active' && !record.leg.held && record.raw.hold()) {
        this.updateLeg(record.leg.id, (l) => ({ ...l, held: true }));
      }
    }
  }

  resumeAll(): void {
    if (!this.isLeader()) {
      this.sync.sendCommand('resumeAll');
      return;
    }
    for (const record of this.liveRecords()) {
      if (record.leg.state === 'active' && record.leg.held && record.raw.unhold()) {
        this.updateLeg(record.leg.id, (l) => ({ ...l, held: false }));
      }
    }
  }

  setToneTarget(legId: string): void {
    if (!this.isLeader()) {
      this.sync.sendCommand('setToneTarget', legId);
      return;
    }
    if (!this.records.has(legId)) return;
    this.toneTargetLegId = legId;
    this._focusedLegId.set(legId);
  }

  retry(): void {
    if (!this.isLeader()) {
      this.sync.sendCommand('retry');
      return;
    }
    if (!this.#me) {
      void this.reload();
      return;
    }
    if (!this.configured() || this.busy()) return;
    this.clearRegistrationTimers();
    this.stopEngine();
    this.activeServerIndex = 0;
    this.activeAttempt = 1;
    this.lastSipCause = undefined;
    this.failoverOwed = false;
    this.startRegistration();
  }

  async reload(): Promise<void> {
    const seq = ++this.loadSeq;
    const wasVisible = this._visible();

    if (!wasVisible) {
      this._connection.set('loading');
      this._status.set({ code: 'loadingPhone' });
      this._block.set('loading');
    }

    try {
      const me = await getMe();
      if (this.disposed || seq !== this.loadSeq) return;
      this.applyLoadedMe(me);
    } catch (error) {
      if (this.disposed || seq !== this.loadSeq) return;
      const action = classifyMeError(error);
      const blocked = action === 'block' ? meErrorBlock(error) : null;
      if (this.hasLiveCalls()) {
        // Never stop the engine or hide the phone under a live call: keep the account, engine and ICE servers.
        this.deferAccountChange(action === 'hide' ? 'hide' : (blocked ?? 'reload'), error);
        return;
      }
      if (action === 'hide') {
        this.clearPhoneAccount();
        return;
      }
      if (blocked) {
        this.blockPhoneAccount(blocked);
        return;
      }
      if (wasVisible) {
        this._connection.set('error');
        this._status.set({ code: 'unavailable' });
        this._block.set('registrationFailed');
      } else {
        this.clearPhoneAccount();
      }
    }
  }

  setPref<K extends keyof PhonePrefs>(key: K, value: PhonePrefs[K]): void {
    const next: PhonePrefs = { ...this._prefs(), [key]: value };
    this._prefs.set(next);
    writePhonePrefs(next);
    if (key === 'panelOpen') {
      this._panelOpen.set(Boolean(value));
    }
    this.applyPrefsEffects(next);
  }

  async requestMicPermission(): Promise<void> {
    await this.media.requestMicPermission();
  }

  async requestNotifyPermission(): Promise<void> {
    await this.notifySvc.requestPermission();
    this.setPref('notifyAsked', true);
  }

  testSpeaker(): void {
    const p = this._prefs();
    this.tones.playSpeakerTest(p.speakerVolume, p.speakerId);
  }

  clearMissed(): void {
    this._missedCount.set(0);
  }

  attachAudio(el: HTMLAudioElement): void {
    this.media.attachAudio(el);
    this.media.applySpeakerPrefs(this._prefs(), this._speakerMuted());
  }

  private applyLoadedMe(me: PhoneMe): void {
    const sortedServers = [...me.servers]
      .filter((s) => Boolean(s.sipDomain && s.websocketUrl))
      .sort((a, b) => a.priority - b.priority);
    const hasAuth = Boolean(me.sipUsername && (me.sipPassword || me.passwordConfigured));
    const usable = me.enabled && hasAuth && sortedServers.length > 0;

    if (!usable && this.hasLiveCalls()) {
      // Disabled or no longer configured mid-call: finish the call on the current account, then fetch again.
      this.deferAccountChange('reload', me.enabled ? 'notConfigured' : (me.reason ?? 'disabled'));
      return;
    }

    this.clearTurnRefreshTimer();
    this.pendingAccountChange = null;

    if (!me.enabled) {
      this.#me = null;
      this.stopEngine();
      this.clearRegistrationTimers();
      this._configured.set(false);
      this._identity.set({
        displayName: me.displayName ?? '',
        extension: me.extension ?? '',
      });
      if (me.reason === 'OVER_CAPACITY') {
        this._visible.set(true);
        this._paused.set(true);
        this._connection.set('idle');
        this._status.set({ code: 'disabled' });
        this._block.set('paused');
      } else {
        this._visible.set(false);
        this._paused.set(false);
        this._connection.set('idle');
        this._status.set({ code: 'disabled' });
        this._block.set(null);
      }
      return;
    }

    this.#me = { ...me, servers: sortedServers };
    this._visible.set(true);
    this._paused.set(false);
    this._identity.set({
      displayName: me.displayName ?? me.extension ?? '',
      extension: me.extension ?? '',
    });

    if (!hasAuth || sortedServers.length === 0) {
      this.stopEngine();
      this.clearRegistrationTimers();
      this._configured.set(false);
      this._connection.set('error');
      this._status.set({ code: 'notConfigured' });
      this._block.set('notConfigured');
      this._server.set({ index: 0, count: sortedServers.length, name: '', attempt: 0 });
      return;
    }

    this._configured.set(true);
    this.scheduleTurnRefresh(me.turnCredentials.expiresAt);

    if (!this.media.isSecureContext()) {
      this._connection.set('error');
      this._status.set({ code: 'unavailable' });
      this._block.set('requiresHttps');
      return;
    }

    if (!this.media.isBrowserSupported()) {
      this._connection.set('error');
      this._status.set({ code: 'unavailable' });
      this._block.set('unsupported');
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this._connection.set('offline');
      this._status.set({ code: 'disconnected' });
      this._block.set('offline');
      return;
    }

    if (this.isLeader() && !this.busy() && !this.stoodDown) {
      this.activeServerIndex = 0;
      this.activeAttempt = 1;
      this.lastSipCause = undefined;
      this.startRegistration();
    } else if (!this.isLeader()) {
      this._connection.set('ready');
      this._status.set({ code: 'ready' });
      this._block.set(null);
    }
  }

  private clearPhoneAccount(): void {
    this.pendingAccountChange = null;
    this.#me = null;
    this.clearTurnRefreshTimer();
    this.clearRegistrationTimers();
    this.stopEngine();
    this._visible.set(false);
    this._paused.set(false);
    this._configured.set(false);
    this._connection.set('idle');
    this._status.set({ code: 'disabled' });
    this._block.set(null);
    this._identity.set({ displayName: '', extension: '' });
  }

  /** `/me` refused this request but the phone exists: stop it and show `block` (its Retry re-fetches `/me`). */
  private blockPhoneAccount(block: PhoneMeBlock): void {
    this.pendingAccountChange = null;
    this.#me = null;
    this.clearTurnRefreshTimer();
    this.clearRegistrationTimers();
    this.stopEngine();
    this._visible.set(true);
    this._paused.set(false);
    this._configured.set(false);
    this._connection.set('error');
    this._status.set({ code: 'unavailable' });
    this._block.set(block);
  }

  /** Leader-local: true while this tab owns a ringing, active, held, consult or conference leg. */
  private hasLiveCalls(): boolean {
    return this.liveRecords().length > 0;
  }

  /**
   * Holds an account change until the last call ends. `hide` and the blocked states win over `reload`, so a later
   * transient failure never downgrades a decided hide. The failure is logged without secrets.
   */
  private deferAccountChange(change: PendingAccountChange, cause: unknown): void {
    const current = this.pendingAccountChange;
    if (current === null || current === 'reload' || change !== 'reload') {
      this.pendingAccountChange = change;
    }
    const detail = cause instanceof Error ? cause.message : String(cause);
    console.warn(`[phone] /me refresh during a live call (${detail}); keeping the call, will ${change} after it ends`);
  }

  /** Runs once the last call has ended. Returns true when it stopped the account (so no failover is owed). */
  private applyPendingAccountChange(): boolean {
    const pending = this.pendingAccountChange;
    this.pendingAccountChange = null;
    if (pending === 'hide') {
      this.clearPhoneAccount();
      return true;
    }
    if (pending === 'suspended' || pending === 'scopeMismatch') {
      this.blockPhoneAccount(pending);
      return true;
    }
    if (pending === 'reload') {
      void this.reload();
    }
    return false;
  }

  private scheduleTurnRefresh(expiresAt: string | null): void {
    this.clearTurnRefreshTimer();
    if (!expiresAt) return;
    const expiryMs = Date.parse(expiresAt);
    if (Number.isNaN(expiryMs)) return;
    const delayMs = Math.max(1_000, expiryMs - TURN_REFRESH_BEFORE_EXPIRY_MS - Date.now());
    this.turnRefreshTimer = setTimeout(() => {
      this.turnRefreshTimer = null;
      if (!this.disposed) {
        void this.reload();
      }
    }, delayMs);
  }

  private startRegistration(): void {
    const me = this.#me;
    if (this.disposed || this.stoodDown || !this.isLeader() || !me || !this._configured()) return;
    const servers = me.servers;
    if (servers.length === 0) return;

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this._connection.set('offline');
      this._status.set({ code: 'disconnected' });
      this._block.set('offline');
      return;
    }

    if (this.activeServerIndex >= servers.length) {
      this.activeServerIndex = 0;
      this.activeAttempt = 1;
    }

    const server = servers[this.activeServerIndex];
    if (this.activeAttempt === 1) {
      const budgetMs = Math.max(1, server.timeoutSeconds) * 1_000;
      this.serverDeadlineAt = Date.now() + budgetMs;
      this.clearServerDeadlineTimer();
      const timeoutGen = this.regGeneration + 1;
      this.serverDeadlineTimer = setTimeout(() => {
        this.serverDeadlineTimer = null;
        if (timeoutGen !== this.regGeneration || this.disposed || this.stoodDown || !this.isLeader()) return;
        if (this._connection() === 'registered') return;
        this.activeAttempt = Math.max(1, server.maxRetries);
        this.handleEngineFailure('Server timeout');
      }, budgetMs);
    }

    this._server.set({
      index: this.activeServerIndex + 1,
      count: servers.length,
      name: server.name,
      attempt: this.activeAttempt,
    });
    this._connection.set('connecting');
    this._status.set(
      this.lastSipCause ? { code: 'connecting', detail: this.lastSipCause } : { code: 'connecting' },
    );
    this._block.set('connecting');

    this.stopEngine();
    const gen = ++this.regGeneration;
    const engine = this.engineFactory();
    this.engine = engine;
    this.media.setSyntheticMicFallback(false);

    this.engineUnsubs = [
      engine.events.on('connected', () => {
        if (gen !== this.regGeneration || this.stoodDown) return;
        this._status.set({ code: 'socketConnected', detail: this.lastSipCause });
        this._status.set({ code: 'registering', detail: this.lastSipCause });
        engine.register();
      }),
      engine.events.on('registered', () => {
        if (gen !== this.regGeneration || this.stoodDown) return;
        this.clearServerDeadlineTimer();
        this.lastSipCause = undefined;
        this.failoverOwed = false;
        this._connection.set('registered');
        this._status.set({ code: 'registered' });
        this._block.set(null);
      }),
      engine.events.on('registrationFailed', (arg) => {
        if (gen !== this.regGeneration || this.stoodDown) return;
        const cause = extractCauseString(arg) ?? 'Registration failed';
        this.handleEngineFailure(cause);
      }),
      engine.events.on('disconnected', (arg) => {
        if (gen !== this.regGeneration || this.stoodDown) return;
        const cause = extractCauseString(arg) ?? 'Disconnected';
        this.handleEngineFailure(cause);
      }),
      engine.events.on('incoming', (arg) => {
        if (!arg) return;
        const rawLeg = arg as SipLeg;
        if (gen !== this.regGeneration || !this.isLeader() || this.stoodDown) {
          rawLeg.terminate(480);
          return;
        }
        this.handleIncomingSipLeg(rawLeg);
      }),
    ];

    const iceServers = buildIceServers(server, me);
    void engine.connect(server, me, iceServers).catch((error) => {
      if (gen !== this.regGeneration || this.stoodDown) return;
      const msg = error instanceof Error ? error.message : 'Connection failed';
      this.handleEngineFailure(msg);
    });
  }

  private handleEngineFailure(cause: string): void {
    this.lastSipCause = cause;
    if (this.busy()) {
      this.failoverOwed = true;
      return;
    }

    this.stopEngine();
    this.clearRegistrationTimers(false);

    const servers = this.#me?.servers ?? [];
    const current = servers[this.activeServerIndex];
    if (!current) {
      this.clearServerDeadlineTimer();
      this._connection.set('error');
      this._status.set({ code: 'registrationFailed', detail: cause });
      this._block.set('registrationFailed');
      return;
    }

    const maxRetries = Math.max(1, current.maxRetries);
    const hasRetryLeft = this.activeAttempt < maxRetries && Date.now() < this.serverDeadlineAt;

    if (hasRetryLeft) {
      this.activeAttempt += 1;
      this._server.update((info) => ({ ...info, attempt: this.activeAttempt }));
      this._connection.set('connecting');
      this._status.set({ code: 'registrationFailed', detail: cause });
      this._block.set('connecting');
      this.regRetryTimer = setTimeout(() => {
        this.regRetryTimer = null;
        this.startRegistration();
      }, REGISTER_RETRY_DELAY_MS);
      return;
    }

    this.clearServerDeadlineTimer();

    if (this.activeServerIndex + 1 < servers.length) {
      this.activeServerIndex += 1;
      this.activeAttempt = 1;
      this._connection.set('connecting');
      this._status.set({ code: 'failingOver', detail: cause });
      this._block.set('connecting');
      this.startRegistration();
      return;
    }

    // All servers exhausted: pause 5 000 ms then start a fresh lap from server 1.
    this._connection.set('error');
    this._status.set({ code: 'registrationFailed', detail: cause });
    this._block.set('registrationFailed');
    this.activeServerIndex = 0;
    this.activeAttempt = 1;
    this.regLapTimer = setTimeout(() => {
      this.regLapTimer = null;
      this.startRegistration();
    }, REGISTER_LAP_PAUSE_MS);
  }

  private handleIncomingSipLeg(rawLeg: SipLeg): void {
    const callerNumber = toDialable(rawLeg.remoteNumber) || rawLeg.remoteNumber;
    const nowIso = new Date().toISOString();

    if (this.busy() || this._prefs().dnd) {
      rawLeg.terminate(486);
      void createCallLog({
        type: 'IN_BUSY',
        displayName: rawLeg.remoteName,
        phoneNumber: callerNumber,
        startedAt: nowIso,
        answeredAt: null,
        endedAt: nowIso,
        durationSeconds: null,
        cause: '486: Busy Here',
        sourceType: null,
        sourceId: null,
        sourceLabel: null,
      }).catch(() => {});
      return;
    }

    const leg: CallLeg = {
      id: rawLeg.id,
      role: 'primary',
      direction: 'incoming',
      number: callerNumber,
      displayName: rawLeg.remoteName,
      source: null,
      state: 'incoming',
      held: false,
      startedAt: nowIso,
      answeredAt: null,
    };

    this.dismissEnded();
    this._mode.set('single');
    this._focusedLegId.set(leg.id);
    this._ringSilenced.set(false);
    this._sentTones.set('');
    this._status.set({ code: 'incomingCall' });
    this.attachLegRecord(leg, rawLeg);
    this.sync.guardsChanged();

    const p = this._prefs();
    this.tones.startRing(p.ringVolume, p.ringId);

    // Pre-acquire microphone so followers can answer too; if hidden and prompt/denied, mark canAnswerHere false.
    void this.preAcquireIncomingMic();

    // Non-blocking caller lookup (<= 1 s) and desktop notification.
    void this.resolveIncomingCallerAndNotify(leg.id, callerNumber, rawLeg.remoteName);

    if (p.autoAnswer) {
      this.clearAutoAnswerTimer();
      this.autoAnswerTimer = setTimeout(() => {
        this.autoAnswerTimer = null;
        if (this.records.get(leg.id)?.leg.state === 'incoming') {
          this.answer();
        }
      }, AUTO_ANSWER_DELAY_MS);
    }
  }

  private async preAcquireIncomingMic(): Promise<void> {
    try {
      await this.media.acquireCallMic(this._prefs(), this._muted());
      this._canAnswerHere.set(true);
    } catch {
      if (this.document.hidden) {
        this._canAnswerHere.set(false);
      }
    }
  }

  private async resolveIncomingCallerAndNotify(
    legId: string,
    callerNumber: string,
    remoteName: string | null,
  ): Promise<void> {
    await this.ensureTranslationsLoaded();
    const match = await lookupCaller(callerNumber, 1_000);
    const record = this.records.get(legId);
    if (!record || record.finalized) return;

    let displayName = remoteName;
    if (match) {
      displayName = match.label;
      this.updateLeg(legId, (leg) => ({
        ...leg,
        displayName: match.label,
        source: match,
      }));
    }

    const active = this.records.get(legId);
    if (!active || active.leg.state !== 'incoming') return;
    if (this._prefs().notifications) {
      const title = this.t('notify.title');
      const body = this.t('notify.body', {
        name: displayName || callerNumber,
        number: callerNumber,
      });
      this.notifySvc.showRingNotification(title, body, () => {
        this.open('phone');
      });
    }
  }

  private async answerIncomingRecord(record: InternalLegRecord): Promise<void> {
    let micStream: MediaStream;
    try {
      micStream = this.media.getCallMicStream() ?? (await this.media.acquireCallMic(this._prefs(), this._muted()));
    } catch {
      if (this.isMicProblem()) {
        return;
      }
      this._status.set({ code: 'callFailed' });
      record.localHangup = true;
      record.raw.terminate(480);
      await this.ensureTranslationsLoaded();
      this.notify.error(this.t('toast.callFailed'));
      return;
    }

    if (record.finalized) return;
    record.raw.answer(micStream);
    this.markLegAccepted(record);
  }

  private attachLegRecord(leg: CallLeg, raw: SipLeg): void {
    const record: InternalLegRecord = {
      leg,
      raw,
      remoteStream: null,
      qualityEstimator: new QualityEstimator(),
      unsubs: [],
      peerCleanup: null,
      disconnectDropTimer: null,
      finalized: false,
      logSubmitted: false,
      localHangup: false,
      localDecline: false,
      mediaDropped: false,
      requestedTransfer: null,
      pendingTransfer: null,
    };

    record.unsubs.push(
      raw.on('progress', () => {
        if (record.finalized || record.leg.state !== 'calling') return;
        this.updateLeg(leg.id, (l) => ({ ...l, state: 'ringing' }));
        if (this._focusedLegId() === leg.id) {
          this._status.set({ code: 'ringing' });
        }
      }),
      raw.on('accepted', () => {
        if (record.finalized) return;
        this.markLegAccepted(record);
      }),
      raw.on('remoteStream', (arg) => {
        if (record.finalized || !arg) return;
        record.remoteStream = arg as MediaStream;
        if (this._mode() === 'conference') {
          void this.refreshConferenceMix();
        } else if (this._focusedLegId() === leg.id || this.records.size === 1) {
          void this.media.playRemoteStream(record.remoteStream, this._prefs(), this._speakerMuted());
        }
      }),
      raw.on('referAccepted', () => {
        if (record.finalized) return;
        const transfer = record.requestedTransfer ?? record.pendingTransfer ?? { kind: 'BLIND', transferredTo: '' };
        record.requestedTransfer = null;
        record.pendingTransfer = transfer;
        // In attended transfer, end consult first then primary so ended shows primary + transferredTo.
        if (transfer.kind === 'ATTENDED') {
          const consult = this.findLegByRole('consult');
          if (consult && consult !== record && !consult.finalized) {
            consult.requestedTransfer = null;
            consult.pendingTransfer = transfer;
            this.finalizeLeg(consult, 'ended', { cause: 'Transferred', statusCode: 200 });
          }
          this.finalizeLeg(record, 'ended', { cause: 'Transferred', statusCode: 200 });
        }
      }),
      raw.on('referFailed', (arg) => {
        if (record.finalized) return;
        record.requestedTransfer = null;
        record.pendingTransfer = null;
        if (this._mode() === 'consult') {
          const consult = this.findLegByRole('consult');
          if (consult) {
            consult.requestedTransfer = null;
            consult.pendingTransfer = null;
          }
        }
        const cause = extractCauseString(arg);
        this._status.set(cause ? { code: 'transferFailed', detail: cause } : { code: 'transferFailed' });
        void this.ensureTranslationsLoaded().then(() => {
          this.notify.error(this.t('toast.transferFailed'));
        });
      }),
      raw.on('ended', (arg) => {
        this.finalizeLeg(record, 'ended', arg);
      }),
      raw.on('failed', (arg) => {
        this.finalizeLeg(record, 'failed', arg);
      }),
    );

    if (raw.peer) {
      const onConnChange = () => {
        const peerState = raw.peer?.connectionState;
        if (peerState === 'failed') {
          this.clearDisconnectDropTimer(record);
          record.mediaDropped = true;
          raw.terminate();
          this.finalizeLeg(record, 'failed', { cause: 'Media dropped' });
        } else if (peerState === 'disconnected') {
          if (record.disconnectDropTimer === null) {
            record.disconnectDropTimer = setTimeout(() => {
              record.disconnectDropTimer = null;
              if (!record.finalized && raw.peer?.connectionState === 'disconnected') {
                record.mediaDropped = true;
                raw.terminate();
                this.finalizeLeg(record, 'failed', { cause: 'Media disconnected' });
              }
            }, MEDIA_DISCONNECTED_DROP_MS);
          }
        } else if (peerState === 'connected') {
          this.clearDisconnectDropTimer(record);
        }
      };
      raw.peer.addEventListener('connectionstatechange', onConnChange);
      record.peerCleanup = () => raw.peer?.removeEventListener('connectionstatechange', onConnChange);
    }

    this.records.set(leg.id, record);
    this._legs.update((list) => [...list, leg]);
  }

  private markLegAccepted(record: InternalLegRecord): void {
    const answeredAt = record.leg.answeredAt ?? new Date().toISOString();
    this.updateLeg(record.leg.id, (l) => ({
      ...l,
      state: 'active',
      answeredAt,
    }));
    this._status.set({ code: 'inCall' });
    this.startCallTimer();
    this.startQualityMonitor();

    if (this._mode() === 'conference') {
      void this.refreshConferenceMix();
    } else if (record.remoteStream && (this._focusedLegId() === record.leg.id || this.records.size === 1)) {
      void this.media.playRemoteStream(record.remoteStream, this._prefs(), this._speakerMuted());
    }
  }

  private finalizeLeg(record: InternalLegRecord, eventType: 'ended' | 'failed', arg?: unknown): void {
    if (record.finalized) return;
    record.finalized = true;
    this.clearDisconnectDropTimer(record);
    record.peerCleanup?.();
    record.peerCleanup = null;
    for (const unsub of record.unsubs) unsub();
    record.unsubs = [];

    if (record.leg.state === 'incoming') {
      this.clearAutoAnswerTimer();
      this.tones.stopRing();
      this.notifySvc.closeRingNotification();
    }

    const cause = extractCauseString(arg);
    const answered = record.leg.answeredAt !== null;
    const endReason = resolveEndReason(record, eventType, cause, this.conferenceEndingAll);
    const nowIso = new Date().toISOString();
    const durationSeconds = clampCallDuration(record.leg.answeredAt);

    const logBody: CreateCallLogInput = {
      type: resolveCallLogType(record.leg.direction, answered, cause),
      displayName: record.leg.displayName,
      phoneNumber: record.leg.number,
      startedAt: record.leg.startedAt,
      answeredAt: record.leg.answeredAt,
      endedAt: nowIso,
      durationSeconds,
      cause: cause ?? null,
      sourceType: record.leg.source?.type ?? null,
      sourceId: record.leg.source?.id ?? null,
      sourceLabel: record.leg.source?.label ?? null,
      ...(record.pendingTransfer ? { transferKind: record.pendingTransfer.kind } : {}),
      ...(this.conferenceId ? { conferenceId: this.conferenceId } : {}),
    };
    const isLastLeg = this.liveRecords().length === 0;
    if (!record.logSubmitted) {
      record.logSubmitted = true;
      void this.recordEndedCallLog(record.leg, logBody, isLastLeg);
    }

    if (
      record.leg.direction === 'incoming' &&
      !answered &&
      endReason === 'noAnswer' &&
      !(this._panelOpen() && this._tab() === 'calls')
    ) {
      this._missedCount.update((c) => c + 1);
    }

    this.records.delete(record.leg.id);
    this._legs.update((list) => list.filter((l) => l.id !== record.leg.id));

    const currentMode = this._mode();
    const remaining = this.liveRecords();

    // Consult transitions
    if (currentMode === 'consult' && remaining.length === 1) {
      const survivor = remaining[0];
      if (record.pendingTransfer?.kind === 'ATTENDED') {
        // Complete attended transfer: also finalize the other leg with 'transferred'.
        const transferredTo = record.pendingTransfer.transferredTo;
        if (!survivor.finalized) {
          survivor.pendingTransfer = { kind: 'ATTENDED', transferredTo };
          this.finalizeLeg(survivor, 'ended', { cause: 'Transferred', statusCode: 200 });
          return;
        }
      } else if (record.leg.role === 'consult') {
        if (eventType === 'failed' && !record.localHangup) {
          const failedName = record.leg.displayName ?? record.leg.number;
          void this.ensureTranslationsLoaded().then(() => {
            this.notify.error(this.t('toast.consultFailed', { name: failedName }));
          });
        }
        if (survivor.leg.held && survivor.raw.unhold()) {
          this.updateLeg(survivor.leg.id, (l) => ({ ...l, held: false }));
        }
        this._mode.set('single');
        this._focusedLegId.set(survivor.leg.id);
        this.toneTargetLegId = survivor.leg.id;
        void this.media.playRemoteStream(survivor.remoteStream, this._prefs(), this._speakerMuted());
        return;
      } else if (record.leg.role === 'primary') {
        // Held primary hung up: consult becomes primary seamlessly.
        this.updateLeg(survivor.leg.id, (l) => ({ ...l, role: 'primary' }));
        if (survivor.leg.held && survivor.raw.unhold()) {
          this.updateLeg(survivor.leg.id, (l) => ({ ...l, held: false }));
        }
        this._mode.set('single');
        this._focusedLegId.set(survivor.leg.id);
        this.toneTargetLegId = survivor.leg.id;
        void this.media.playRemoteStream(survivor.remoteStream, this._prefs(), this._speakerMuted());
        return;
      }
    }

    // Conference transitions
    if (currentMode === 'conference') {
      if (eventType === 'failed' && !record.localHangup && !answered && !this.conferenceEndingAll) {
        const failedName = record.leg.displayName ?? record.leg.number;
        void this.ensureTranslationsLoaded().then(() => {
          this.notify.error(this.t('toast.partyFailed', { name: failedName }));
        });
      }

      if (!this.conferenceEndingAll && remaining.length >= 2) {
        if (this._focusedLegId() === record.leg.id) {
          this._focusedLegId.set(remaining[0].leg.id);
        }
        void this.refreshConferenceMix();
        return;
      }

      if (!this.conferenceEndingAll && remaining.length === 1) {
        const survivor = remaining[0];
        this.conferenceId = null;
        this._mode.set('single');
        this.updateLeg(survivor.leg.id, (l) => ({ ...l, role: 'primary' }));
        if (survivor.leg.held && survivor.raw.unhold()) {
          this.updateLeg(survivor.leg.id, (l) => ({ ...l, held: false }));
        }
        this._focusedLegId.set(survivor.leg.id);
        this.toneTargetLegId = survivor.leg.id;
        void this.media.restoreSingleCallMix(
          { id: survivor.leg.id, peer: survivor.raw.peer, remoteStream: survivor.remoteStream },
          this._prefs(),
          this._speakerMuted(),
        );
        return;
      }

      if (remaining.length > 0) {
        // Still waiting on other legs while ending conference.
        return;
      }
    }

    // Last leg ended: full call cleanup
    if (remaining.length === 0) {
      this.conferenceId = null;
      const wasEndingConference = this.conferenceEndingAll;
      this.conferenceEndingAll = false;
      this._mode.set('single');
      this._focusedLegId.set(null);
      this.toneTargetLegId = null;
      this._muted.set(false);
      this._speakerMuted.set(false);
      this._ringSilenced.set(false);
      this._sentTones.set('');
      this._canAnswerHere.set(true);
      this._timer.set(0);
      this._quality.set(null);

      this.stopCallTimer();
      this.stopQualityMonitor();
      this.media.stopConferenceMix();
      this.media.releaseCallMic();
      this.media.clearRemoteStream();

      const finalReason: EndReason = wasEndingConference ? 'conferenceEnded' : endReason;
      this._ended.set({
        name: record.leg.displayName,
        number: record.leg.number,
        reason: finalReason,
        durationSeconds: durationSeconds ?? 0,
        source: record.leg.source,
        logged: Boolean(record.leg.source),
        transferredTo: record.pendingTransfer?.transferredTo || null,
      });

      this._status.set({
        code:
          finalReason === 'declined'
            ? 'declined'
            : finalReason === 'failed' || finalReason === 'dropped'
              ? 'callFailed'
              : 'callEnded',
      });

      this.scheduleEndedDialerReset();
      this.sync.guardsChanged();

      if (this.applyPendingAccountChange()) {
        this.failoverOwed = false;
      } else if (this.failoverOwed) {
        this.failoverOwed = false;
        this.handleEngineFailure(this.lastSipCause ?? 'Disconnected');
      }
    }
  }

  private async startOrRollbackConferenceMix(
    live: InternalLegRecord[],
    prevHoldStates: { id: string; held: boolean }[],
  ): Promise<void> {
    try {
      const mixLegs: ConferenceMixLeg[] = live.map((r) => ({
        id: r.leg.id,
        peer: r.raw.peer,
        remoteStream: r.remoteStream,
      }));
      await this.media.startConferenceMix(mixLegs, this._prefs(), this._speakerMuted());
      this._mode.set('conference');
    } catch {
      this.conferenceId = null;
      for (const prev of prevHoldStates) {
        const rec = this.records.get(prev.id);
        if (rec && prev.held && !rec.leg.held && rec.raw.hold()) {
          this.updateLeg(prev.id, (l) => ({ ...l, held: true }));
        }
      }
      await this.ensureTranslationsLoaded();
      this.notify.error(this.t('toast.conferenceFailed'));
    }
  }

  private async refreshConferenceMix(): Promise<void> {
    const active = this.liveRecords().filter((r) => r.leg.state === 'active');
    if (active.length < 2) return;
    try {
      await this.media.startConferenceMix(
        active.map((r) => ({ id: r.leg.id, peer: r.raw.peer, remoteStream: r.remoteStream })),
        this._prefs(),
        this._speakerMuted(),
      );
    } catch {
      await this.ensureTranslationsLoaded();
      this.notify.error(this.t('toast.conferenceFailed'));
    }
  }

  private startCallTimer(): void {
    if (this.timerInterval !== null) return;
    this.updateTimerValue();
    this.timerInterval = setInterval(() => this.updateTimerValue(), 1_000);
  }

  private stopCallTimer(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private updateTimerValue(): void {
    const list = this._legs();
    const target =
      this._mode() === 'conference'
        ? list.find((l) => l.answeredAt !== null) ?? null
        : this.focusedLeg();
    if (!target?.answeredAt) {
      this._timer.set(0);
      return;
    }
    this._timer.set(clampCallDuration(target.answeredAt) ?? 0);
  }

  private startQualityMonitor(): void {
    if (this.qualityGraceTimer !== null || this.qualityPollTimer !== null) return;
    this._quality.set({ level: 'measuring', lossPct: 0, jitterMs: 0, rttMs: 0, mos: 4.5 });
    this.qualityGraceTimer = setTimeout(() => {
      this.qualityGraceTimer = null;
      void this.sampleQuality();
      this.qualityPollTimer = setInterval(() => {
        void this.sampleQuality();
      }, QUALITY_INTERVAL_MS);
    }, QUALITY_GRACE_MS);
  }

  private stopQualityMonitor(): void {
    if (this.qualityGraceTimer !== null) {
      clearTimeout(this.qualityGraceTimer);
      this.qualityGraceTimer = null;
    }
    if (this.qualityPollTimer !== null) {
      clearInterval(this.qualityPollTimer);
      this.qualityPollTimer = null;
    }
  }

  private async sampleQuality(): Promise<void> {
    if (this._mode() === 'conference') {
      const active = this.liveRecords().filter((r) => r.leg.state === 'active' && r.raw.peer);
      if (active.length === 0) return;
      const samples = await Promise.all(
        active.map(async (r) => {
          try {
            const stats = await r.raw.peer?.getStats();
            return r.qualityEstimator.sample(stats);
          } catch {
            return null;
          }
        }),
      );
      const worst = pickWorstQuality(samples);
      if (worst) this._quality.set(worst);
      return;
    }

    const focused = this.focusedLeg();
    const record = focused ? this.records.get(focused.id) : null;
    if (!record || record.leg.state !== 'active' || !record.raw.peer) return;
    try {
      const stats = await record.raw.peer.getStats();
      const sampled = record.qualityEstimator.sample(stats);
      if (sampled) this._quality.set(sampled);
    } catch {
      // Ignore transient getStats failures.
    }
  }

  private async handleStandDown(): Promise<void> {
    this.stoodDown = true;
    this.clearAutoAnswerTimer();
    this.clearRegistrationTimers();
    this.tones.stopRing();
    this.notifySvc.closeRingNotification();
    this.stopQualityMonitor();
    this.stopCallTimer();
    this.media.stopConferenceMix();
    this.media.releaseCallMic();
    this.media.clearRemoteStream();

    if (this.engine) {
      try {
        this.engine.unregister();
      } catch {
        // Ignore unregister failure during stand-down
      }
      this.stopEngine();
    }
  }

  private handleLeadershipStop(): void {
    void this.handleStandDown();
    this.cleanupAllResources(false);
    this.clearPhoneAccount();
  }

  private handleBecomeLeader(crashedSnapshot: PhoneSyncedState | null): void {
    this.stoodDown = false;
    if (crashedSnapshot) {
      const primary = crashedSnapshot.legs[0];
      if (primary) {
        this.showLostCallToast(
          {
            lossId: `crash-${primary.id}`,
            name: primary.displayName,
            number: primary.number,
            durationSeconds: null,
          },
          false,
        );
      }
      this._legs.set([]);
      this._focusedLegId.set(null);
      this._mode.set('single');
      this._timer.set(0);
      this._quality.set(null);
      this.sync.guardsChanged();
    }

    if (this.#me && this._configured() && !this.busy()) {
      this.activeServerIndex = 0;
      this.activeAttempt = 1;
      this.startRegistration();
    } else if (!this.#me) {
      void this.reload();
    }
  }

  private handleBecomeFollower(): void {
    this.stoodDown = false;
    this.clearRegistrationTimers();
    this.stopEngine();
    this.tones.stopRing();
    this.notifySvc.closeRingNotification();
  }

  private executeRemoteCommand(cmd: PhoneCommand): void {
    if (!FOLLOWER_COMMANDS.has(cmd.name)) return;
    const args = cmd.args ?? [];
    switch (cmd.name) {
      case 'answer':
        this.answer();
        break;
      case 'decline':
        this.decline();
        break;
      case 'silenceRing':
        this.silenceRing();
        break;
      case 'hangup':
        this.hangup(typeof args[0] === 'string' ? args[0] : undefined);
        break;
      case 'toggleMute':
        this.toggleMute();
        break;
      case 'toggleHold':
        this.toggleHold(typeof args[0] === 'string' ? args[0] : undefined);
        break;
      case 'toggleSpeaker':
        this.toggleSpeaker();
        break;
      case 'pressKey':
        if (typeof args[0] === 'string') this.pressKey(args[0]);
        break;
      case 'blindTransfer':
        if (typeof args[0] === 'string') this.blindTransfer(args[0]);
        break;
      case 'startConsult':
        if (typeof args[0] === 'string') void this.startConsult(args[0]);
        break;
      case 'swapLegs':
        this.swapLegs();
        break;
      case 'completeTransfer':
        this.completeTransfer();
        break;
      case 'cancelConsult':
        this.cancelConsult();
        break;
      case 'mergeConference':
        this.mergeConference();
        break;
      case 'addParty':
        if (typeof args[0] === 'string') void this.addParty(args[0]);
        break;
      case 'removeParty':
        if (typeof args[0] === 'string') this.removeParty(args[0]);
        break;
      case 'endConference':
        this.endConference();
        break;
      case 'holdAll':
        this.holdAll();
        break;
      case 'resumeAll':
        this.resumeAll();
        break;
      case 'setToneTarget':
        if (typeof args[0] === 'string') this.setToneTarget(args[0]);
        break;
      case 'retry':
        this.retry();
        break;
    }
  }

  private buildPageHideLossInfo(): { lostPayload: PhoneLostPayload; callLog: CreateCallLogInput } | null {
    if (!this.isLeader()) return null;
    if (this.engine && this._connection() === 'registered') {
      try {
        this.engine.unregister();
      } catch {
        // Ignore errors during page teardown
      }
    }
    if (!this.busy()) return null;

    const leg = this.focusedLeg() ?? this._legs()[0];
    if (!leg) return null;
    const record = this.records.get(leg.id);
    if (!record || record.logSubmitted) return null;
    record.logSubmitted = true;
    const nowIso = new Date().toISOString();
    const durationSeconds = clampCallDuration(leg.answeredAt);

    return {
      lostPayload: {
        lossId: leg.id,
        name: leg.displayName,
        number: leg.number,
        durationSeconds,
      },
      callLog: {
        type: resolveCallLogType(leg.direction, leg.answeredAt !== null, 'callFailed: tabClosed'),
        displayName: leg.displayName,
        phoneNumber: leg.number,
        startedAt: leg.startedAt,
        answeredAt: leg.answeredAt,
        endedAt: nowIso,
        durationSeconds,
        cause: 'callFailed: tabClosed',
        sourceType: leg.source?.type ?? null,
        sourceId: leg.source?.id ?? null,
        sourceLabel: leg.source?.label ?? null,
        ...(this.conferenceId ? { conferenceId: this.conferenceId } : {}),
      },
    };
  }

  private showLostCallToast(payload: PhoneLostPayload, includeDuration: boolean): void {
    if (this.seenLostIds.has(payload.lossId)) return;
    this.seenLostIds.add(payload.lossId);

    void this.ensureTranslationsLoaded().then(() => {
      const displayName = payload.name || payload.number;
      const title = this.t('toast.callLostTitle');
      const body =
        includeDuration && payload.durationSeconds !== null
          ? this.t('toast.callLost', {
              name: displayName,
              duration: formatDurationClock(payload.durationSeconds),
            })
          : this.t('toast.callLostNoTime', { name: displayName });
      this.notify.error(title, body);
    });
  }

  private applyExternalPrefsChange(next: PhonePrefs): void {
    // Keep panelOpen local to each tab; sync device/volume/autoAnswer/dnd/notifications prefs.
    const merged: PhonePrefs = { ...next, panelOpen: this._panelOpen() };
    this._prefs.set(merged);
    this.applyPrefsEffects(merged);
  }

  private applyPrefsEffects(next: PhonePrefs): void {
    if (!this.isLeader()) return;
    this.media.applyMicPrefs(next, this._muted());
    this.media.applySpeakerPrefs(next, this._speakerMuted());
    if (this.ringing() && !this._ringSilenced()) {
      this.tones.updateRing(next.ringVolume, next.ringId);
    }
  }

  private handleMissingDevices(missing: { mic?: boolean; speaker?: boolean; ring?: boolean }): void {
    const curr = this._prefs();
    const next: PhonePrefs = {
      ...curr,
      micId: missing.mic ? null : curr.micId,
      speakerId: missing.speaker ? null : curr.speakerId,
      ringId: missing.ring ? null : curr.ringId,
    };
    this._prefs.set(next);
    writePhonePrefs(next);
    this.applyPrefsEffects(next);
    void this.ensureTranslationsLoaded().then(() => {
      this.notify.info(this.t('toast.headsetGone'));
    });
  }

  private promptNotificationPermission(): void {
    void this.ensureTranslationsLoaded().then(() => {
      this.notify.info(this.t('toast.allowNotifications'));
    });
    this.setPref('notifyAsked', true);
    void this.notifySvc.requestPermission();
  }

  private async ensureTranslationsLoaded(lang = this.language.current()): Promise<void> {
    try {
      await firstValueFrom(this.transloco.load(`web-phone/${lang}`));
    } catch {
      // Ignore loader failures in unit tests or offline edge cases; fallback texts apply.
    }
  }

  private t(subKey: string, params?: Record<string, string | number>): string {
    const aliasedKey = `webPhone.${subKey}`;
    const scopedKey = `web-phone.${subKey}`;

    const aliased = this.tryTranslate(aliasedKey, params);
    if (aliased) return aliased;

    const scoped = this.tryTranslate(scopedKey, params);
    if (scoped) return scoped;

    return subKey;
  }

  private tryTranslate(key: string, params?: Record<string, unknown>): string | null {
    try {
      const value = this.transloco.translate(key, params);
      return value && value !== key ? value : null;
    } catch {
      return null;
    }
  }

  private async waitForLeaderRegistration(timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline && !this.disposed) {
      if (this.isLeader() && this.connection() === 'registered') {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    return this.isLeader() && this.connection() === 'registered';
  }

  private isMicProblem(): boolean {
    const notice = this.media.mediaNotice();
    return (
      this.media.micPermission() === 'denied' ||
      notice === 'permissionDenied' ||
      notice === 'noMicrophone'
    );
  }

  private async recordEndedCallLog(
    leg: CallLeg,
    logBody: CreateCallLogInput,
    isLastLeg: boolean,
  ): Promise<void> {
    let finalBody = logBody;
    if (leg.direction === 'outgoing' && !leg.source) {
      const match = await lookupCaller(leg.number, 1_000);
      if (match) {
        const displayName = leg.displayName ?? match.label;
        finalBody = {
          ...logBody,
          displayName,
          sourceType: match.type,
          sourceId: match.id,
          sourceLabel: match.label,
        };
        if (isLastLeg) {
          this._ended.update((curr) =>
            curr && curr.number === leg.number
              ? {
                  ...curr,
                  name: curr.name ?? match.label,
                  source: match,
                  logged: true,
                }
              : curr,
          );
        }
      }
    }
    try {
      await createCallLog(finalBody);
    } catch {
      // Fire and forget
    }
  }

  private buildSyncedStateSnapshot(): PhoneSyncedState {
    return {
      visible: this._visible(),
      paused: this._paused(),
      configured: this._configured(),
      connection: this._connection(),
      status: this._status(),
      server: this._server(),
      block: this._block(),
      identity: this._identity(),
      legs: this._legs(),
      mode: this._mode(),
      focusedLegId: this._focusedLegId(),
      call: this.callState(),
      timer: this._timer(),
      muted: this._muted(),
      speakerMuted: this._speakerMuted(),
      quality: this._quality(),
      ringing: this.ringing(),
      ringSilenced: this._ringSilenced(),
      ended: this._ended(),
      sentTones: this._sentTones(),
      busy: this.busy(),
      canAnswerHere: this._canAnswerHere(),
      missedCount: this._missedCount(),
      mediaNotice: this.media.mediaNotice(),
      micPermission: this.media.micPermission(),
      notifyPermission: this.notifySvc.permission(),
    };
  }

  private currentServer(me: PhoneMe | null): PhoneServer | null {
    if (!me || me.servers.length === 0) return null;
    return me.servers[this.activeServerIndex] ?? me.servers[0] ?? null;
  }

  private liveRecords(): InternalLegRecord[] {
    return Array.from(this.records.values()).filter((r) => !r.finalized);
  }

  private findLegByRole(role: CallLeg['role']): InternalLegRecord | null {
    for (const r of this.records.values()) {
      if (!r.finalized && r.leg.role === role) return r;
    }
    return null;
  }

  private findRingingRecord(): InternalLegRecord | null {
    for (const r of this.records.values()) {
      if (!r.finalized && r.leg.state === 'incoming') return r;
    }
    return null;
  }

  private updateLeg(legId: string, updater: (leg: CallLeg) => CallLeg): void {
    const rec = this.records.get(legId);
    if (!rec) return;
    const updated = updater(rec.leg);
    rec.leg = updated;
    this._legs.update((list) => list.map((item) => (item.id === legId ? updated : item)));
  }

  private persistLocalPanelOpen(open: boolean): void {
    const next: PhonePrefs = { ...this._prefs(), panelOpen: open };
    this._prefs.set(next);
    writePhonePrefs(next);
  }

  private stopEngine(): void {
    this.regGeneration += 1;
    for (const unsub of this.engineUnsubs) unsub();
    this.engineUnsubs = [];
    if (this.engine) {
      try {
        this.engine.stop();
      } catch {
        // Ignore stop errors
      }
      this.engine = null;
    }
  }

  private clearRegistrationTimers(clearDeadline = true): void {
    if (this.regRetryTimer !== null) {
      clearTimeout(this.regRetryTimer);
      this.regRetryTimer = null;
    }
    if (this.regLapTimer !== null) {
      clearTimeout(this.regLapTimer);
      this.regLapTimer = null;
    }
    if (clearDeadline) {
      this.clearServerDeadlineTimer();
    }
  }

  private clearServerDeadlineTimer(): void {
    if (this.serverDeadlineTimer !== null) {
      clearTimeout(this.serverDeadlineTimer);
      this.serverDeadlineTimer = null;
    }
  }

  private clearTurnRefreshTimer(): void {
    if (this.turnRefreshTimer !== null) {
      clearTimeout(this.turnRefreshTimer);
      this.turnRefreshTimer = null;
    }
  }

  private clearAutoAnswerTimer(): void {
    if (this.autoAnswerTimer !== null) {
      clearTimeout(this.autoAnswerTimer);
      this.autoAnswerTimer = null;
    }
  }

  private stopLeaderSyncTicker(): void {
    if (this.leaderSyncInterval !== null) {
      clearInterval(this.leaderSyncInterval);
      this.leaderSyncInterval = null;
    }
  }

  private clearDisconnectDropTimer(record: InternalLegRecord): void {
    if (record.disconnectDropTimer !== null) {
      clearTimeout(record.disconnectDropTimer);
      record.disconnectDropTimer = null;
    }
  }

  private scheduleEndedDialerReset(): void {
    if (this.endedDialerTimer !== null) {
      clearTimeout(this.endedDialerTimer);
    }
    this.endedDialerTimer = setTimeout(() => {
      this.endedDialerTimer = null;
      if (!this.busy()) {
        this.dialValue.set('');
        this.dialSource.set(null);
      }
    }, ENDED_RETURN_TO_DIALER_MS);
  }

  private cleanupAllResources(disposeSync: boolean): void {
    this.pendingAccountChange = null;
    this.clearRegistrationTimers();
    this.clearTurnRefreshTimer();
    this.clearAutoAnswerTimer();
    this.stopLeaderSyncTicker();
    this.stopCallTimer();
    this.stopQualityMonitor();
    if (this.endedDialerTimer !== null) {
      clearTimeout(this.endedDialerTimer);
      this.endedDialerTimer = null;
    }
    for (const rec of this.records.values()) {
      this.clearDisconnectDropTimer(rec);
      rec.peerCleanup?.();
      for (const unsub of rec.unsubs) unsub();
    }
    this.records.clear();
    this._legs.set([]);
    this.tones.stopRing();
    this.notifySvc.closeRingNotification();
    this.media.stopConferenceMix();
    this.media.releaseCallMic();
    this.media.clearRemoteStream();
    this.stopEngine();
    if (disposeSync) {
      this.sync.dispose();
    }
  }
}

function buildIceServers(server: PhoneServer, me: PhoneMe): RTCIceServer[] {
  const result: RTCIceServer[] = [];
  for (const item of server.iceServers) {
    result.push({
      urls: item.urls,
      ...(item.username ? { username: item.username } : {}),
      ...(item.credential ? { credential: item.credential } : {}),
    });
  }
  if (me.turnCredentials.enabled) {
    for (const item of me.turnCredentials.iceServers) {
      result.push({
        urls: item.urls,
        username: item.username,
        credential: item.credential,
      });
    }
  }
  return result;
}

function extractCauseString(arg: unknown): string | undefined {
  if (!arg || typeof arg !== 'object') return undefined;
  const ev = arg as SipCauseEvent;
  return formatCallCause(ev.statusCode, ev.cause ?? ev.detail) ?? undefined;
}

function resolveEndReason(
  record: InternalLegRecord,
  eventType: 'ended' | 'failed',
  cause: string | undefined,
  conferenceEndingAll: boolean,
): EndReason {
  if (conferenceEndingAll) return 'conferenceEnded';
  if (record.pendingTransfer) return 'transferred';
  if (record.localDecline) return 'declined';
  if (record.mediaDropped) return 'dropped';
  if (record.leg.answeredAt !== null) return 'ended';

  if (cause && /busy/i.test(cause)) return 'busy';
  if (cause && /decline|rejected/i.test(cause)) return 'declined';
  if (cause && /no answer|timeout|408/i.test(cause)) return 'noAnswer';

  if (record.leg.direction === 'incoming' && !record.localHangup) {
    return 'noAnswer';
  }
  if (record.localHangup) {
    return 'ended';
  }
  return eventType === 'ended' ? 'ended' : 'failed';
}

function formatDurationClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

function createUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `conf-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
