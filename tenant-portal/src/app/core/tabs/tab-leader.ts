import { DOCUMENT, Service, Signal, computed, inject, isDevMode, signal } from '@angular/core';
import { TabBus } from './tab-bus';
import { TAB_LEADER_CONFIG } from './tab-leader.config';
import { HandoverGuard, StandDownHook, TabChannelMessage, TabRole } from './tab-leader.model';

const MIN_FOCUS_LEADERSHIP_MS = 5000;

interface GuardEntry {
  owner: string;
  guard: HandoverGuard;
}

interface StandDownEntry {
  owner: string;
  hook: StandDownHook;
}

@Service()
export class TabLeader {
  private readonly config = inject(TAB_LEADER_CONFIG);
  private readonly bus = inject(TabBus);
  private readonly doc = inject(DOCUMENT);
  private readonly win = this.doc.defaultView;

  readonly tabId: string = createTabId();
  readonly supported: boolean =
    typeof BroadcastChannel !== 'undefined' && typeof navigator !== 'undefined' && !!navigator.locks;

  private readonly _role = signal<TabRole>(this.supported ? 'electing' : 'leader');
  private readonly _leaderTabId = signal<string | null>(this.supported ? null : this.tabId);

  readonly role: Signal<TabRole> = this._role.asReadonly();
  readonly isLeader: Signal<boolean> = computed(() => this._role() === 'leader');
  readonly leaderTabId: Signal<string | null> = this._leaderTabId.asReadonly();

  private readonly guards = new Set<GuardEntry>();
  private readonly standDownHooks = new Set<StandDownEntry>();

  private started = false;
  private unsupportedLogged = false;
  private handoverInProgress = false;
  private handoverRequestInFlight = false;
  private handoverDeferredByGuard = false;
  private becameLeaderAt = 0;
  private lockRequestGen = 0;
  private lockAbortController: AbortController | null = null;
  private releaseLock: (() => void) | null = null;

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private ghostTimer: ReturnType<typeof setTimeout> | null = null;
  private focusSettleTimer: ReturnType<typeof setTimeout> | null = null;
  private requeueTimer: ReturnType<typeof setTimeout> | null = null;
  private handoverRequestTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly onVisibilityChange = () => {
    if (!this.isFocusedAndVisible()) {
      this.handoverDeferredByGuard = false;
    }
    this.evaluateFocusHandover();
  };

  private readonly onFocus = () => {
    this.evaluateFocusHandover();
  };

  private readonly onBlur = () => {
    this.handoverDeferredByGuard = false;
    this.clearFocusSettleTimer();
  };

  private readonly onPageHide = () => {
    this.clearFocusSettleTimer();
    this.clearHandoverRequestState();
    if (!this.started || this._role() !== 'leader') return;

    this.lockRequestGen++;
    this.stopHeartbeat();
    this.bus.postControl({ v: 1, kind: 'tabs.leader-closing', from: this.tabId });
    this._role.set('follower');
    this._leaderTabId.set(null);

    const release = this.releaseLock;
    this.releaseLock = null;
    release?.();
  };

  private readonly onPageShow = (event: PageTransitionEvent) => {
    if (!event.persisted || !this.started || !this.supported) return;
    if (this._role() !== 'leader') {
      this.queueLockRequest(false);
      this.scheduleGhostCheck();
      this.bus.postControl({ v: 1, kind: 'tabs.hello', from: this.tabId });
    }
  };

  constructor() {
    this.bus.bindLeader(this.tabId, () => this.isLeader(), (msg) => this.handleControlMessage(msg));
  }

  start(): void {
    if (this.started) return;
    this.started = true;

    if (!this.supported) {
      this._role.set('leader');
      this._leaderTabId.set(this.tabId);
      if (isDevMode() && !this.unsupportedLogged) {
        this.unsupportedLogged = true;
        console.info('[tabs] election unsupported; this tab leads');
      }
      return;
    }

    this.bus.openChannel(this.config.channelName);
    this._role.set('electing');
    this._leaderTabId.set(null);
    this.attachDomListeners();

    this.queueLockRequest(false);

    void navigator.locks
      .request(this.config.lockName, { ifAvailable: true }, async (lock) => {
        if (!this.started) return;
        if (lock === null && this._role() === 'electing') {
          this._role.set('follower');
          this.scheduleGhostCheck();
          this.bus.postControl({ v: 1, kind: 'tabs.hello', from: this.tabId });
          this.evaluateFocusHandover();
        }
      })
      .catch(() => {
        // Ignore probe failures if lock subsystem aborts during stop
      });
  }

  async stop(): Promise<void> {
    if (!this.started && !this.releaseLock && !this.lockAbortController) {
      return;
    }

    this.clearAllTimers();
    this.detachDomListeners();

    this.lockRequestGen++;
    this.lockAbortController?.abort();
    this.lockAbortController = null;

    const wasLeader = this.started && this._role() === 'leader';
    const release = this.releaseLock;
    this.releaseLock = null;

    this.started = false;
    this.handoverInProgress = false;
    this.becameLeaderAt = 0;
    this.clearHandoverRequestState();

    if (wasLeader) {
      await this.runStandDownHooks(true);
    }

    release?.();
    this.bus.closeChannel();
    this._role.set('electing');
    this._leaderTabId.set(null);
    this.bus.clearStoredTopics();
  }

  registerGuard(owner: string, guard: HandoverGuard): () => void {
    const entry: GuardEntry = { owner, guard };
    this.guards.add(entry);
    this.deferPageHideAfterConsumers();

    return () => {
      this.guards.delete(entry);
    };
  }

  registerStandDown(owner: string, hook: StandDownHook): () => void {
    const entry: StandDownEntry = { owner, hook };
    this.standDownHooks.add(entry);
    this.deferPageHideAfterConsumers();

    return () => {
      this.standDownHooks.delete(entry);
    };
  }

  guardsChanged(): void {
    if (!this.started || !this.supported || this._role() !== 'leader' || this.handoverInProgress) {
      return;
    }
    if (this.areAllGuardsClear()) {
      this.bus.postControl({ v: 1, kind: 'tabs.guards-clear', from: this.tabId });
    }
  }

  requestLeadership(): void {
    this.sendHandoverRequest('explicit');
  }

  private sendHandoverRequest(source: 'explicit' | 'focus'): void {
    if (!this.started || !this.supported || this._role() === 'leader' || this.handoverRequestInFlight) {
      return;
    }
    this.handoverRequestInFlight = true;
    this.handoverDeferredByGuard = false;
    this.clearHandoverRequestTimer();
    this.handoverRequestTimer = setTimeout(() => {
      this.handoverRequestTimer = null;
      this.handoverRequestInFlight = false;
    }, this.config.handoverTimeoutMs + 500);
    this.bus.postControl({
      v: 1,
      kind: 'tabs.handover-request',
      from: this.tabId,
      reason: source,
      payload: { tabId: this.tabId, source },
    });
  }

  private queueLockRequest(steal: boolean): void {
    if (!this.started || !this.supported) return;

    this.clearRequeueTimer();
    const gen = ++this.lockRequestGen;

    this.lockAbortController?.abort();
    const controller = steal ? null : new AbortController();
    this.lockAbortController = controller;

    let wasGranted = false;
    const options: LockOptions = controller ? { signal: controller.signal } : { steal: true };

    void navigator.locks
      .request(this.config.lockName, options, () => {
        if (!this.started || gen !== this.lockRequestGen) {
          return Promise.resolve();
        }

        wasGranted = true;
        this.lockAbortController = null;
        this.becameLeaderAt = Date.now();
        this.clearHandoverRequestState();
        this.stopGhostCheck();
        this.clearRequeueTimer();
        this.clearFocusSettleTimer();

        this._role.set('leader');
        this._leaderTabId.set(this.tabId);
        this.bus.postControl({
          v: 1,
          kind: 'tabs.leader',
          from: this.tabId,
          payload: { tabId: this.tabId },
        });
        this.startHeartbeat();
        this.bus.republishAll();

        return new Promise<void>((resolve) => {
          this.releaseLock = resolve;
        });
      })
      .then(
        () => {
          if (!this.started || gen !== this.lockRequestGen) return;
          if (wasGranted) {
            this.handleUnexpectedLockLoss(null);
          }
        },
        () => {
          if (!this.started || gen !== this.lockRequestGen) return;
          if (wasGranted) {
            this.handleUnexpectedLockLoss(null);
          } else {
            // Pending request was rejected (e.g. a steal elsewhere); stay follower and re-queue.
            this._role.set('follower');
            this.scheduleGhostCheck();
            this.scheduleRequeue(250);
          }
        },
      );
  }

  private handleUnexpectedLockLoss(newLeaderId: string | null): void {
    this.lockRequestGen++;
    this.stopHeartbeat();
    this.clearHandoverRequestState();

    const release = this.releaseLock;
    this.releaseLock = null;
    release?.();

    this._role.set('follower');
    if (newLeaderId !== null) {
      this._leaderTabId.set(newLeaderId);
    }

    void this.runStandDownHooks(false);
    this.scheduleGhostCheck();
    this.scheduleRequeue(250);
  }

  private handleControlMessage(msg: TabChannelMessage): void {
    if (!this.started) return;

    switch (msg.kind) {
      case 'tabs.hello':
        if (this._role() === 'leader') {
          this.bus.postControl({
            v: 1,
            kind: 'tabs.alive',
            from: this.tabId,
            payload: { leaderTabId: this.tabId },
          });
          this.bus.republishAll();
        }
        break;

      case 'tabs.leader': {
        const leaderId = (msg.payload as { tabId?: string } | undefined)?.tabId ?? msg.from;
        if (leaderId === this.tabId) break;
        if (this._role() === 'leader') {
          this.handleUnexpectedLockLoss(leaderId);
          break;
        }
        this.noteLeaderAlive(leaderId);
        break;
      }

      case 'tabs.alive': {
        const leaderId = (msg.payload as { leaderTabId?: string } | undefined)?.leaderTabId ?? msg.from;
        if (leaderId === this.tabId || this._role() === 'leader') break;
        this.noteLeaderAlive(leaderId);
        break;
      }

      case 'tabs.heartbeat':
        if (msg.from === this.tabId || this._role() === 'leader') break;
        this.noteLeaderAlive(msg.from);
        break;

      case 'tabs.leader-closing':
        this.clearHandoverRequestState();
        if (this._leaderTabId() === msg.from) {
          this._leaderTabId.set(null);
        }
        if (this._role() === 'follower' && this.requeueTimer !== null) {
          this.queueLockRequest(false);
        }
        break;

      case 'tabs.handover-request':
        void this.handleHandoverRequest(msg);
        break;

      case 'tabs.handover-ok': {
        const to = msg.to ?? (msg.payload as { to?: string } | undefined)?.to;
        if (to !== this.tabId || this._role() === 'leader') break;
        this.queueLockRequest(true);
        break;
      }

      case 'tabs.handover-denied': {
        const to = msg.to ?? (msg.payload as { to?: string } | undefined)?.to;
        if (to && to !== this.tabId) break;
        const reason = msg.reason ?? (msg.payload as { reason?: string } | undefined)?.reason;
        this.clearHandoverRequestInFlight();
        if (reason === 'guard' && this.isFocusedAndVisible()) {
          this.handoverDeferredByGuard = true;
        }
        break;
      }

      case 'tabs.guards-clear':
        if (
          this.config.focusHandover &&
          this._role() === 'follower' &&
          this.handoverDeferredByGuard &&
          this.isFocusedAndVisible()
        ) {
          this.sendHandoverRequest('focus');
        }
        break;
    }
  }

  private noteLeaderAlive(leaderId: string): void {
    this._leaderTabId.set(leaderId);
    if (this._role() === 'electing') {
      this._role.set('follower');
    }
    if (this._role() === 'follower') {
      this.scheduleGhostCheck();
    }
  }

  private async handleHandoverRequest(msg: TabChannelMessage): Promise<void> {
    if (this._role() !== 'leader') return;

    const requesterId = (msg.payload as { tabId?: string } | undefined)?.tabId ?? msg.from;
    if (requesterId === this.tabId) return;

    if (this.handoverInProgress) {
      this.bus.postControl({
        v: 1,
        kind: 'tabs.handover-denied',
        from: this.tabId,
        to: requesterId,
        reason: 'busy',
        payload: { to: requesterId, reason: 'busy' },
      });
      return;
    }

    if (!this.areAllGuardsClear()) {
      this.bus.postControl({
        v: 1,
        kind: 'tabs.handover-denied',
        from: this.tabId,
        to: requesterId,
        reason: 'guard',
        payload: { to: requesterId, reason: 'guard' },
      });
      return;
    }

    const source = msg.reason ?? (msg.payload as { source?: string } | undefined)?.source;
    if (
      source === 'focus' &&
      this.isFocusedAndVisible() &&
      Date.now() - this.becameLeaderAt < MIN_FOCUS_LEADERSHIP_MS
    ) {
      this.bus.postControl({
        v: 1,
        kind: 'tabs.handover-denied',
        from: this.tabId,
        to: requesterId,
        reason: 'cooldown',
        payload: { to: requesterId, reason: 'cooldown' },
      });
      return;
    }

    this.handoverInProgress = true;
    try {
      await this.runStandDownHooks(true);
      if (!this.started || this._role() !== 'leader') {
        return;
      }

      this.lockRequestGen++;
      this.stopHeartbeat();
      this._role.set('follower');
      this._leaderTabId.set(requesterId);

      const release = this.releaseLock;
      this.releaseLock = null;

      this.bus.postControl({
        v: 1,
        kind: 'tabs.handover-ok',
        from: this.tabId,
        to: requesterId,
        payload: { to: requesterId },
      });

      release?.();
      this.scheduleGhostCheck();
      this.scheduleRequeue(250);
    } finally {
      this.handoverInProgress = false;
    }
  }

  private areAllGuardsClear(): boolean {
    for (const entry of this.guards) {
      try {
        if (!entry.guard()) return false;
      } catch (err) {
        if (isDevMode()) {
          console.error(`[tabs] handover guard "${entry.owner}" threw`, err);
        }
        return false;
      }
    }
    return true;
  }

  private async runStandDownHooks(withTimeout: boolean): Promise<void> {
    const entries = [...this.standDownHooks];
    if (entries.length === 0) return;

    const runEntry = async (entry: StandDownEntry): Promise<void> => {
      let hookPromise: Promise<void>;
      try {
        hookPromise = Promise.resolve(entry.hook());
      } catch (err) {
        if (isDevMode()) {
          console.error(`[tabs] stand-down hook "${entry.owner}" failed`, err);
        }
        return;
      }

      const safeHook = hookPromise.catch((err) => {
        if (isDevMode()) {
          console.error(`[tabs] stand-down hook "${entry.owner}" failed`, err);
        }
      });

      if (!withTimeout) {
        await safeHook;
        return;
      }

      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          if (isDevMode()) {
            console.warn(`[tabs] stand-down hook "${entry.owner}" timed out`);
          }
          resolve();
        }, this.config.handoverTimeoutMs);
      });

      try {
        await Promise.race([safeHook, timeoutPromise]);
      } finally {
        clearTimeout(timer);
      }
    };

    await Promise.all(entries.map(runEntry));
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.started || this._role() !== 'leader') return;
      this.bus.postControl({ v: 1, kind: 'tabs.heartbeat', from: this.tabId });
    }, this.config.heartbeatMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer === null) return;
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private scheduleGhostCheck(): void {
    this.stopGhostCheck();
    if (!this.started || !this.supported || this._role() !== 'follower') return;

    this.ghostTimer = setTimeout(() => {
      this.ghostTimer = null;
      if (!this.started || this._role() !== 'follower') return;

      this.scheduleGhostCheck();
      // Steal and immediately release so the normal FIFO queue elects exactly one leader.
      void navigator.locks.request(this.config.lockName, { steal: true }, async () => undefined).catch(() => undefined);
    }, this.config.takeoverAfterMs);
  }

  private stopGhostCheck(): void {
    if (this.ghostTimer === null) return;
    clearTimeout(this.ghostTimer);
    this.ghostTimer = null;
  }

  private scheduleRequeue(delayMs: number): void {
    this.clearRequeueTimer();
    if (!this.started || !this.supported) return;

    this.requeueTimer = setTimeout(() => {
      this.requeueTimer = null;
      this.queueLockRequest(false);
    }, delayMs);
  }

  private clearRequeueTimer(): void {
    if (this.requeueTimer === null) return;
    clearTimeout(this.requeueTimer);
    this.requeueTimer = null;
  }

  private isFocusedAndVisible(): boolean {
    return this.doc.visibilityState === 'visible' && this.doc.hasFocus();
  }

  private evaluateFocusHandover(): void {
    if (!this.started || !this.supported || !this.config.focusHandover || this.handoverRequestInFlight) {
      this.clearFocusSettleTimer();
      return;
    }

    if (this._role() === 'follower' && this.isFocusedAndVisible()) {
      if (this.focusSettleTimer === null) {
        this.focusSettleTimer = setTimeout(() => {
          this.focusSettleTimer = null;
          if (
            this.started &&
            this.config.focusHandover &&
            this._role() === 'follower' &&
            !this.handoverRequestInFlight &&
            this.isFocusedAndVisible()
          ) {
            this.sendHandoverRequest('focus');
          }
        }, this.config.focusSettleMs);
      }
    } else {
      this.clearFocusSettleTimer();
    }
  }

  private clearFocusSettleTimer(): void {
    if (this.focusSettleTimer === null) return;
    clearTimeout(this.focusSettleTimer);
    this.focusSettleTimer = null;
  }

  private clearHandoverRequestTimer(): void {
    if (this.handoverRequestTimer === null) return;
    clearTimeout(this.handoverRequestTimer);
    this.handoverRequestTimer = null;
  }

  private clearHandoverRequestInFlight(): void {
    this.handoverRequestInFlight = false;
    this.clearHandoverRequestTimer();
  }

  private clearHandoverRequestState(): void {
    this.clearHandoverRequestInFlight();
    this.handoverDeferredByGuard = false;
  }

  private clearAllTimers(): void {
    this.stopHeartbeat();
    this.stopGhostCheck();
    this.clearFocusSettleTimer();
    this.clearRequeueTimer();
    this.clearHandoverRequestInFlight();
  }

  private attachDomListeners(): void {
    this.doc.addEventListener('visibilitychange', this.onVisibilityChange);
    this.win?.addEventListener('focus', this.onFocus);
    this.win?.addEventListener('blur', this.onBlur);
    this.win?.addEventListener('pagehide', this.onPageHide);
    this.win?.addEventListener('pageshow', this.onPageShow as EventListener);
  }

  private detachDomListeners(): void {
    this.doc.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.win?.removeEventListener('focus', this.onFocus);
    this.win?.removeEventListener('blur', this.onBlur);
    this.win?.removeEventListener('pagehide', this.onPageHide);
    this.win?.removeEventListener('pageshow', this.onPageShow as EventListener);
  }

  /**
   * Re-registers `pagehide` after consumer services register guards/hooks so their own
   * `pagehide` handlers can broadcast details (e.g. lost calls) before `tabs.leader-closing`.
   */
  private deferPageHideAfterConsumers(): void {
    queueMicrotask(() => {
      if (!this.started || !this.supported || !this.win) return;
      this.win.removeEventListener('pagehide', this.onPageHide);
      this.win.addEventListener('pagehide', this.onPageHide);
    });
  }
}

function createTabId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tab-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}
