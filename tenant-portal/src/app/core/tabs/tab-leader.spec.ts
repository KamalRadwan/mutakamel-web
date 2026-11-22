import { DOCUMENT, Injector } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TabBus } from './tab-bus';
import { TabLeader } from './tab-leader';
import { DEFAULT_TAB_LEADER_CONFIG, TAB_LEADER_CONFIG } from './tab-leader.config';
import { TabLeaderConfig } from './tab-leader.model';

interface HeldEntry {
  broken: boolean;
}

interface PendingLockRequest {
  name: string;
  callback: (lock: Lock | null) => unknown;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  cleanupAbort?: () => void;
  settled: boolean;
}

class FakeLockManager {
  private readonly held = new Map<string, HeldEntry>();
  private readonly queues = new Map<string, PendingLockRequest[]>();

  request<T = unknown>(
    name: string,
    optionsOrCallback: LockOptions | ((lock: Lock | null) => Promise<T> | T),
    maybeCallback?: (lock: Lock | null) => Promise<T> | T,
  ): Promise<T> {
    const options: LockOptions = typeof optionsOrCallback === 'function' ? {} : optionsOrCallback;
    const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
    if (!callback) {
      return Promise.reject(new TypeError('Lock callback is required'));
    }

    if (options.signal?.aborted) {
      return Promise.reject(options.signal.reason ?? new DOMException('Aborted', 'AbortError'));
    }

    if (options.ifAvailable) {
      const queue = this.queues.get(name);
      if (this.held.has(name) || (queue && queue.length > 0)) {
        return new Promise<T>((resolve, reject) => {
          queueMicrotask(() => {
            Promise.resolve(callback(null)).then(resolve, reject);
          });
        });
      }
      return this.enqueue(name, {}, callback);
    }

    if (options.steal) {
      const current = this.held.get(name);
      if (current) {
        current.broken = true;
        this.held.delete(name);
      }

      const pending = this.queues.get(name) ?? [];
      this.queues.set(name, []);
      for (const req of pending) {
        if (!req.settled) {
          req.settled = true;
          req.cleanupAbort?.();
          req.reject(new DOMException('Stolen', 'AbortError'));
        }
      }
    }

    return this.enqueue(name, options, callback);
  }

  private enqueue<T>(
    name: string,
    options: LockOptions,
    callback: (lock: Lock | null) => Promise<T> | T,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const req: PendingLockRequest = {
        name,
        callback,
        resolve: resolve as (value: unknown) => void,
        reject,
        settled: false,
      };

      const signal = options.signal;
      if (signal) {
        const onAbort = () => {
          if (req.settled) return;
          req.settled = true;
          const queue = this.queues.get(name);
          if (queue) {
            const idx = queue.indexOf(req);
            if (idx >= 0) queue.splice(idx, 1);
          }
          reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
        };
        signal.addEventListener('abort', onAbort, { once: true });
        req.cleanupAbort = () => signal.removeEventListener('abort', onAbort);
      }

      let queue = this.queues.get(name);
      if (!queue) {
        queue = [];
        this.queues.set(name, queue);
      }
      queue.push(req);
      this.pump(name);
    });
  }

  private pump(name: string): void {
    if (this.held.has(name)) return;
    const queue = this.queues.get(name);
    if (!queue || queue.length === 0) return;

    while (queue.length > 0) {
      const req = queue.shift();
      if (!req || req.settled) continue;

      req.settled = true;
      req.cleanupAbort?.();

      const entry: HeldEntry = { broken: false };
      this.held.set(name, entry);

      queueMicrotask(async () => {
        try {
          const fakeLock = { name, mode: 'exclusive' } as Lock;
          const value = await req.callback(fakeLock);
          req.resolve(value);
        } catch (err) {
          req.reject(err);
        } finally {
          if (!entry.broken && this.held.get(name) === entry) {
            this.held.delete(name);
            this.pump(name);
          }
        }
      });
      break;
    }
  }
}

class FakeBroadcastChannel {
  private static readonly channels = new Map<string, Set<FakeBroadcastChannel>>();

  static reset(): void {
    for (const set of FakeBroadcastChannel.channels.values()) {
      for (const ch of set) {
        ch.closed = true;
        ch.onmessage = null;
      }
    }
    FakeBroadcastChannel.channels.clear();
  }

  onmessage: ((ev: MessageEvent<unknown>) => void) | null = null;
  muted = false;
  private closed = false;

  constructor(readonly name: string) {
    let set = FakeBroadcastChannel.channels.get(name);
    if (!set) {
      set = new Set<FakeBroadcastChannel>();
      FakeBroadcastChannel.channels.set(name, set);
    }
    set.add(this);
  }

  postMessage(data: unknown): void {
    if (this.closed) {
      throw new DOMException('Channel is closed', 'InvalidStateError');
    }
    if (this.muted) return;

    const cloned = structuredClone(data);
    const peers = [...(FakeBroadcastChannel.channels.get(this.name) ?? [])];
    for (const peer of peers) {
      if (peer === this || peer.closed) continue;
      queueMicrotask(() => {
        if (peer.closed) return;
        peer.onmessage?.(new MessageEvent('message', { data: structuredClone(cloned) }));
      });
    }
  }

  close(): void {
    this.closed = true;
    this.onmessage = null;
    FakeBroadcastChannel.channels.get(this.name)?.delete(this);
  }
}

class FakeWindow extends EventTarget {}

class FakeDocument extends EventTarget {
  visibilityState: DocumentVisibilityState = 'hidden';
  readonly defaultView = new FakeWindow();
  private focused = false;

  hasFocus(): boolean {
    return this.focused;
  }

  setActive(visible: boolean, focused: boolean): void {
    const prevVisible = this.visibilityState;
    const prevFocused = this.focused;
    this.visibilityState = visible ? 'visible' : 'hidden';
    this.focused = focused;

    if (prevVisible !== this.visibilityState) {
      this.dispatchEvent(new Event('visibilitychange'));
    }
    if (!prevFocused && focused) {
      this.defaultView.dispatchEvent(new Event('focus'));
    } else if (prevFocused && !focused) {
      this.defaultView.dispatchEvent(new Event('blur'));
    }
  }

  triggerPageHide(): void {
    this.defaultView.dispatchEvent(new Event('pagehide'));
  }

  triggerPageShow(persisted: boolean): void {
    this.defaultView.dispatchEvent(Object.assign(new Event('pageshow'), { persisted }));
  }
}

interface FakeTab {
  leader: TabLeader;
  bus: TabBus;
  doc: FakeDocument;
}

async function flushMicrotasks(rounds = 8): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await Promise.resolve();
  }
}

describe('TabLeader & TabBus', () => {
  let fakeLocks: FakeLockManager;
  let originalLocksDescriptor: PropertyDescriptor | undefined;
  let originalBroadcastChannel: typeof BroadcastChannel | undefined;
  let activeTabs: FakeTab[];

  function createFakeTab(overrides: Partial<TabLeaderConfig> = {}): FakeTab {
    const doc = new FakeDocument();
    const config: TabLeaderConfig = { ...DEFAULT_TAB_LEADER_CONFIG, ...overrides };
    const injector = Injector.create({
      providers: [
        { provide: DOCUMENT, useValue: doc },
        { provide: TAB_LEADER_CONFIG, useValue: config },
        TabBus,
        TabLeader,
      ],
    });
    const tab: FakeTab = {
      leader: injector.get(TabLeader),
      bus: injector.get(TabBus),
      doc,
    };
    activeTabs.push(tab);
    return tab;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    activeTabs = [];
    fakeLocks = new FakeLockManager();

    originalLocksDescriptor = Object.getOwnPropertyDescriptor(navigator, 'locks');
    Object.defineProperty(navigator, 'locks', {
      value: fakeLocks,
      configurable: true,
      writable: true,
    });

    originalBroadcastChannel = globalThis.BroadcastChannel;
    globalThis.BroadcastChannel = FakeBroadcastChannel as unknown as typeof BroadcastChannel;
  });

  afterEach(async () => {
    for (const tab of activeTabs) {
      await tab.leader.stop();
    }
    FakeBroadcastChannel.reset();

    if (originalLocksDescriptor) {
      Object.defineProperty(navigator, 'locks', originalLocksDescriptor);
    } else {
      Reflect.deleteProperty(navigator, 'locks');
    }

    if (originalBroadcastChannel) {
      globalThis.BroadcastChannel = originalBroadcastChannel;
    } else {
      Reflect.deleteProperty(globalThis, 'BroadcastChannel');
    }

    vi.useRealTimers();
  });

  it('elects first tab as leader and delivers previously published state to late-joining follower', async () => {
    const tab1 = createFakeTab();
    tab1.leader.start();
    await flushMicrotasks();

    expect(tab1.leader.role()).toBe('leader');
    expect(tab1.leader.isLeader()).toBe(true);
    expect(tab1.leader.leaderTabId()).toBe(tab1.leader.tabId);

    tab1.bus.publish('phone.state', { call: 'active', muted: false });

    const tab2 = createFakeTab();
    const tab2State = tab2.bus.state<{ call: string; muted: boolean }>('phone.state');
    expect(tab2State()).toBeNull();

    tab2.leader.start();
    await flushMicrotasks();

    expect(tab2.leader.role()).toBe('follower');
    expect(tab2.leader.isLeader()).toBe(false);
    expect(tab2.leader.leaderTabId()).toBe(tab1.leader.tabId);
    expect(tab2State()).toEqual({ call: 'active', muted: false });

    // Sends from follower reach only the leader
    const leaderReceived: Array<{ cmd: string; from: string }> = [];
    const followerReceived: string[] = [];
    tab1.bus.on<string>('phone.command', (cmd, from) => leaderReceived.push({ cmd, from }));
    tab2.bus.on<string>('phone.command', (cmd) => followerReceived.push(cmd));

    tab2.bus.send('phone.command', 'mute');
    tab1.bus.send('phone.command', 'hold');
    await flushMicrotasks();

    // The leader's own send is delivered synchronously; the follower's send crosses the channel afterwards.
    expect(leaderReceived).toEqual([
      { cmd: 'hold', from: tab1.leader.tabId },
      { cmd: 'mute', from: tab2.leader.tabId },
    ]);
    expect(followerReceived).toEqual([]);
  });

  it('moves leadership on focus handover, respects guards, and retries after guardsChanged()', async () => {
    const tab1 = createFakeTab();
    tab1.doc.setActive(true, true);
    tab1.leader.start();
    await flushMicrotasks();

    const tab2 = createFakeTab();
    tab2.leader.start();
    await flushMicrotasks();
    expect(tab2.leader.role()).toBe('follower');

    let tab1StoodDown = false;
    tab1.leader.registerStandDown('phone', async () => {
      tab1StoodDown = true;
    });

    // Focus tab 2 for focusSettleMs -> handover succeeds
    tab1.doc.setActive(false, false);
    tab2.doc.setActive(true, true);
    await vi.advanceTimersByTimeAsync(DEFAULT_TAB_LEADER_CONFIG.focusSettleMs);
    await flushMicrotasks();

    expect(tab1StoodDown).toBe(true);
    expect(tab2.leader.role()).toBe('leader');
    expect(tab1.leader.role()).toBe('follower');

    // Guard on tab 2 blocks handover back to tab 1
    let allowHandover = false;
    tab2.leader.registerGuard('phone', () => allowHandover);

    tab2.doc.setActive(false, false);
    tab1.doc.setActive(true, true);
    await vi.advanceTimersByTimeAsync(DEFAULT_TAB_LEADER_CONFIG.focusSettleMs);
    await flushMicrotasks();

    expect(tab2.leader.role()).toBe('leader');
    expect(tab1.leader.role()).toBe('follower');

    // Clear guard -> focused follower repeats handover request and takes over
    allowHandover = true;
    tab2.leader.guardsChanged();
    await flushMicrotasks();

    expect(tab1.leader.role()).toBe('leader');
    expect(tab2.leader.role()).toBe('follower');
  });

  it('promotes follower when leader handles pagehide and allows consumer pagehide broadcast first', async () => {
    const tab1 = createFakeTab();
    tab1.leader.start();
    await flushMicrotasks();
    expect(tab1.leader.role()).toBe('leader');

    const tab2 = createFakeTab();
    tab2.leader.start();
    await flushMicrotasks();
    expect(tab2.leader.role()).toBe('follower');

    // Consumer registers guard/stand-down and its own pagehide handler
    tab1.leader.registerGuard('phone', () => true);
    tab1.doc.defaultView.addEventListener('pagehide', () => {
      if (tab1.leader.isLeader()) {
        tab1.bus.broadcast('phone.lost', { reason: 'tabClosed' });
      }
    });
    await flushMicrotasks();

    const lostEvents: unknown[] = [];
    tab2.bus.on('phone.lost', (payload) => lostEvents.push(payload));

    tab1.doc.triggerPageHide();
    await flushMicrotasks();

    expect(lostEvents).toEqual([{ reason: 'tabClosed' }]);
    expect(tab1.leader.role()).toBe('follower');
    expect(tab2.leader.role()).toBe('leader');
    expect(tab2.leader.leaderTabId()).toBe(tab2.leader.tabId);
  });

  it('takes over when leader becomes a ghost with no heartbeat for takeoverAfterMs', async () => {
    // Simulate a crashed/frozen tab holding the lock without sending heartbeats
    void fakeLocks.request(DEFAULT_TAB_LEADER_CONFIG.lockName, () => new Promise<void>(() => undefined));

    const tab2 = createFakeTab();
    tab2.leader.start();
    await flushMicrotasks();

    expect(tab2.leader.role()).toBe('follower');

    await vi.advanceTimersByTimeAsync(DEFAULT_TAB_LEADER_CONFIG.takeoverAfterMs - 100);
    await flushMicrotasks();
    expect(tab2.leader.role()).toBe('follower');

    // Ghost timer fires at takeoverAfterMs, steals & releases, then re-queues after 250ms
    await vi.advanceTimersByTimeAsync(100);
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(250);
    await flushMicrotasks();

    expect(tab2.leader.role()).toBe('leader');
    expect(tab2.leader.leaderTabId()).toBe(tab2.leader.tabId);
  });

  it('converges to exactly one leader when two followers steal simultaneously', async () => {
    void fakeLocks.request(DEFAULT_TAB_LEADER_CONFIG.lockName, () => new Promise<void>(() => undefined));

    const tab2 = createFakeTab();
    const tab3 = createFakeTab();
    tab2.leader.start();
    tab3.leader.start();
    await flushMicrotasks();

    expect(tab2.leader.role()).toBe('follower');
    expect(tab3.leader.role()).toBe('follower');

    // Both ghost timers expire together, then both re-queue after 250ms
    await vi.advanceTimersByTimeAsync(DEFAULT_TAB_LEADER_CONFIG.takeoverAfterMs + 300);
    await flushMicrotasks();

    const roles = [tab2.leader.role(), tab3.leader.role()];
    expect(roles.filter((r) => r === 'leader').length).toBe(1);
    expect(roles.filter((r) => r === 'follower').length).toBe(1);

    const winner = tab2.leader.isLeader() ? tab2 : tab3;
    const follower = tab2.leader.isLeader() ? tab3 : tab2;
    expect(follower.leader.leaderTabId()).toBe(winner.leader.tabId);
  });

  it('leads immediately and supports local bus in an unsupported environment', async () => {
    Object.defineProperty(navigator, 'locks', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const tab = createFakeTab();
    expect(tab.leader.supported).toBe(false);
    expect(tab.leader.role()).toBe('leader');
    expect(tab.leader.isLeader()).toBe(true);

    tab.leader.start();

    const received: Array<{ topic: string; payload: unknown; from: string }> = [];
    tab.bus.on('phone.state', (payload, from) => received.push({ topic: 'phone.state', payload, from }));
    tab.bus.on('phone.command', (payload, from) => received.push({ topic: 'phone.command', payload, from }));

    tab.bus.publish('phone.state', { ok: true });
    tab.bus.send('phone.command', 'answer');

    expect(tab.bus.state<{ ok: boolean }>('phone.state')()).toEqual({ ok: true });
    expect(received).toEqual([
      { topic: 'phone.state', payload: { ok: true }, from: tab.leader.tabId },
      { topic: 'phone.command', payload: 'answer', from: tab.leader.tabId },
    ]);
  });

  it('stops cleanly, runs stand-down hooks, clears state, and can start() again', async () => {
    const tab1 = createFakeTab();
    tab1.leader.start();
    await flushMicrotasks();

    const tab2 = createFakeTab();
    tab2.leader.start();
    await flushMicrotasks();

    let stoodDown = 0;
    tab1.leader.registerStandDown('phone', async () => {
      stoodDown++;
    });

    tab1.bus.publish('phone.state', { ready: true });
    await flushMicrotasks();
    expect(tab1.bus.state<{ ready: boolean }>('phone.state')()).toEqual({ ready: true });

    await tab1.leader.stop();
    await flushMicrotasks();

    expect(stoodDown).toBe(1);
    expect(tab1.leader.role()).toBe('electing');
    expect(tab1.leader.leaderTabId()).toBeNull();
    expect(tab1.bus.state<{ ready: boolean }>('phone.state')()).toBeNull();

    // Tab 2 acquires leadership once tab 1 releases on stop()
    expect(tab2.leader.role()).toBe('leader');

    // Tab 1 re-joins via start() as follower and gets current leader state
    tab2.bus.publish('phone.state', { ready: false });
    tab1.leader.start();
    await flushMicrotasks();

    expect(tab1.leader.role()).toBe('follower');
    expect(tab1.leader.leaderTabId()).toBe(tab2.leader.tabId);
    expect(tab1.bus.state<{ ready: boolean }>('phone.state')()).toEqual({ ready: false });
  });

  it('stabilizes on one leader across heartbeats when two tabs both report hasFocus()', async () => {
    const tab1 = createFakeTab();
    tab1.doc.setActive(true, true);
    tab1.leader.start();
    await flushMicrotasks();

    const tab2 = createFakeTab();
    tab2.doc.setActive(true, true);
    tab2.leader.start();
    await flushMicrotasks();

    expect(tab1.leader.role()).toBe('leader');
    expect(tab2.leader.role()).toBe('follower');

    for (let i = 0; i < 6; i++) {
      await vi.advanceTimersByTimeAsync(DEFAULT_TAB_LEADER_CONFIG.heartbeatMs);
      await flushMicrotasks();
      expect(tab1.leader.role()).toBe('leader');
      expect(tab2.leader.role()).toBe('follower');
    }
  });

  it('ignores repeated focus events while a handover request is in flight', async () => {
    const tab1 = createFakeTab();
    tab1.doc.setActive(true, true);
    tab1.leader.start();
    await flushMicrotasks();

    const tab2 = createFakeTab();
    tab2.leader.start();
    await flushMicrotasks();

    let handoverRequests = 0;
    const origPost = tab2.bus.postControl.bind(tab2.bus);
    vi.spyOn(tab2.bus, 'postControl').mockImplementation((msg) => {
      if (msg.kind === 'tabs.handover-request') {
        handoverRequests++;
      }
      origPost(msg);
    });

    // Advance past cooldown and keep tab1 blurred so first focus handover is accepted,
    // while stalling stand-down so the first request stays in flight.
    let resolveStandDown!: () => void;
    tab1.leader.registerStandDown(
      'phone',
      () =>
        new Promise<void>((resolve) => {
          resolveStandDown = resolve;
        }),
    );

    tab1.doc.setActive(false, false);
    tab2.doc.setActive(true, true);
    await vi.advanceTimersByTimeAsync(DEFAULT_TAB_LEADER_CONFIG.focusSettleMs);
    await flushMicrotasks();

    expect(handoverRequests).toBe(1);

    // Fire repeated focus events while the first handover is still in flight.
    tab2.doc.defaultView.dispatchEvent(new Event('focus'));
    tab2.doc.defaultView.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(DEFAULT_TAB_LEADER_CONFIG.focusSettleMs);
    await flushMicrotasks();

    expect(handoverRequests).toBe(1);

    resolveStandDown();
    await flushMicrotasks();
    expect(tab2.leader.role()).toBe('leader');
  });

  it('re-queues and re-elects leader on persisted pageshow after pagehide', async () => {
    const tab1 = createFakeTab();
    tab1.leader.start();
    await flushMicrotasks();
    expect(tab1.leader.role()).toBe('leader');

    tab1.doc.triggerPageHide();
    await flushMicrotasks();
    expect(tab1.leader.role()).toBe('follower');

    tab1.doc.triggerPageShow(false);
    await flushMicrotasks();
    expect(tab1.leader.role()).toBe('follower');

    tab1.doc.triggerPageShow(true);
    await flushMicrotasks();
    expect(tab1.leader.role()).toBe('leader');
    expect(tab1.leader.leaderTabId()).toBe(tab1.leader.tabId);
  });

  describe('extended coverage', () => {
    const controlTaps = new WeakMap<TabBus, Array<(msg: { kind: string; reason?: string }) => void>>();

    function countControl(tab: FakeTab, kind: string, reason?: string): { count: () => number } {
      let count = 0;
      let taps = controlTaps.get(tab.bus);
      if (!taps) {
        const tapList: Array<(msg: { kind: string; reason?: string }) => void> = [];
        taps = tapList;
        controlTaps.set(tab.bus, tapList);
        const orig = tab.bus.postControl.bind(tab.bus);
        vi.spyOn(tab.bus, 'postControl').mockImplementation((msg) => {
          for (const tap of tapList) tap(msg);
          orig(msg);
        });
      }
      taps.push((msg) => {
        if (msg.kind === kind && (reason === undefined || msg.reason === reason)) count++;
      });
      return { count: () => count };
    }

    async function startLeaderAndFollower(leaderFocused = false): Promise<[FakeTab, FakeTab]> {
      const tab1 = createFakeTab();
      if (leaderFocused) tab1.doc.setActive(true, true);
      tab1.leader.start();
      await flushMicrotasks();
      const tab2 = createFakeTab();
      tab2.leader.start();
      await flushMicrotasks();
      return [tab1, tab2];
    }

    it('elects exactly one leader among three tabs and all agree on its id', async () => {
      const tabs = [createFakeTab(), createFakeTab(), createFakeTab()];
      for (const t of tabs) t.leader.start();
      await flushMicrotasks();
      await vi.advanceTimersByTimeAsync(DEFAULT_TAB_LEADER_CONFIG.heartbeatMs);
      await flushMicrotasks();

      const leaders = tabs.filter((t) => t.leader.isLeader());
      expect(leaders.length).toBe(1);
      for (const t of tabs) {
        expect(t.leader.leaderTabId()).toBe(leaders[0].leader.tabId);
      }
    });

    it('waits the full 400 ms focus settle before requesting leadership', async () => {
      const [tab1, tab2] = await startLeaderAndFollower();
      const requests = countControl(tab2, 'tabs.handover-request', 'focus');

      tab2.doc.setActive(true, true);
      await vi.advanceTimersByTimeAsync(DEFAULT_TAB_LEADER_CONFIG.focusSettleMs - 1);
      await flushMicrotasks();
      expect(requests.count()).toBe(0);
      expect(tab1.leader.isLeader()).toBe(true);

      await vi.advanceTimersByTimeAsync(1);
      await flushMicrotasks();
      expect(requests.count()).toBe(1);
      expect(tab2.leader.isLeader()).toBe(true);
      expect(tab1.leader.role()).toBe('follower');
      expect(tab1.leader.leaderTabId()).toBe(tab2.leader.tabId);
    });

    it('cancels the settle timer when focus is lost before 400 ms', async () => {
      const [tab1, tab2] = await startLeaderAndFollower();
      const requests = countControl(tab2, 'tabs.handover-request');

      tab2.doc.setActive(true, true);
      await vi.advanceTimersByTimeAsync(200);
      tab2.doc.setActive(false, false);
      await vi.advanceTimersByTimeAsync(DEFAULT_TAB_LEADER_CONFIG.focusSettleMs * 3);
      await flushMicrotasks();

      expect(requests.count()).toBe(0);
      expect(tab1.leader.isLeader()).toBe(true);
    });

    it('keeps a focused leader for at least 5 s against focus requests, then yields', async () => {
      const tab1 = createFakeTab();
      tab1.doc.setActive(true, true);
      tab1.leader.start();
      await flushMicrotasks();
      const cooldownDenials = countControl(tab1, 'tabs.handover-denied', 'cooldown');

      const tab2 = createFakeTab();
      tab2.leader.start();
      await flushMicrotasks();

      // Both tabs report focus (e.g. two windows side by side) within the first 5 s.
      tab2.doc.setActive(true, true);
      await vi.advanceTimersByTimeAsync(DEFAULT_TAB_LEADER_CONFIG.focusSettleMs);
      await flushMicrotasks();
      expect(cooldownDenials.count()).toBe(1);
      expect(tab1.leader.isLeader()).toBe(true);
      expect(tab2.leader.role()).toBe('follower');

      // Still inside the 5 s window: a new focus is denied again.
      await vi.advanceTimersByTimeAsync(3000);
      tab2.doc.defaultView.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(DEFAULT_TAB_LEADER_CONFIG.focusSettleMs);
      await flushMicrotasks();
      expect(cooldownDenials.count()).toBe(2);
      expect(tab1.leader.isLeader()).toBe(true);

      // After 5 s of leadership the next focus request is accepted.
      await vi.advanceTimersByTimeAsync(2000);
      tab2.doc.defaultView.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(DEFAULT_TAB_LEADER_CONFIG.focusSettleMs);
      await flushMicrotasks();
      expect(cooldownDenials.count()).toBe(2);
      expect(tab2.leader.isLeader()).toBe(true);
      expect(tab1.leader.role()).toBe('follower');
    });

    it('does not apply the 5 s minimum to an explicit requestLeadership()', async () => {
      const [tab1, tab2] = await startLeaderAndFollower(true);

      tab2.leader.requestLeadership();
      await flushMicrotasks();

      expect(tab2.leader.isLeader()).toBe(true);
      expect(tab1.leader.role()).toBe('follower');
    });

    it('sends no new handover request while one is in flight, and frees the slot after the timeout', async () => {
      const [tab1, tab2] = await startLeaderAndFollower();
      let requests = 0;
      // Swallow the request so the leader never answers: the request stays in flight.
      vi.spyOn(tab2.bus, 'postControl').mockImplementation((msg) => {
        if (msg.kind === 'tabs.handover-request') requests++;
      });

      tab2.leader.requestLeadership();
      tab2.leader.requestLeadership();
      tab2.doc.setActive(true, true);
      await vi.advanceTimersByTimeAsync(DEFAULT_TAB_LEADER_CONFIG.focusSettleMs);
      tab2.leader.requestLeadership();
      expect(requests).toBe(1);

      const timeout = DEFAULT_TAB_LEADER_CONFIG.handoverTimeoutMs + 500;
      await vi.advanceTimersByTimeAsync(timeout - DEFAULT_TAB_LEADER_CONFIG.focusSettleMs - 1);
      tab2.leader.requestLeadership();
      expect(requests).toBe(1);

      await vi.advanceTimersByTimeAsync(1);
      tab2.leader.requestLeadership();
      expect(requests).toBe(2);
      expect(tab1.leader.isLeader()).toBe(true);
    });

    it('keeps leadership on the leader while the phone guard reports an active call', async () => {
      const [tab1, tab2] = await startLeaderAndFollower();
      let callActive = true;
      tab1.leader.registerGuard('phone', () => !callActive);
      let stoodDown = 0;
      tab1.leader.registerStandDown('phone', async () => {
        stoodDown++;
      });
      const guardDenials = countControl(tab1, 'tabs.handover-denied', 'guard');

      tab2.doc.setActive(true, true);
      await vi.advanceTimersByTimeAsync(DEFAULT_TAB_LEADER_CONFIG.focusSettleMs);
      await flushMicrotasks();
      tab2.leader.requestLeadership();
      await flushMicrotasks();

      // Many heartbeats later the call is still running on tab 1.
      await vi.advanceTimersByTimeAsync(DEFAULT_TAB_LEADER_CONFIG.heartbeatMs * 10);
      await flushMicrotasks();

      expect(guardDenials.count()).toBe(2);
      expect(stoodDown).toBe(0);
      expect(tab1.leader.isLeader()).toBe(true);
      expect(tab2.leader.role()).toBe('follower');
      expect(tab2.leader.leaderTabId()).toBe(tab1.leader.tabId);

      // guardsChanged() while still busy announces nothing.
      const clears = countControl(tab1, 'tabs.guards-clear');
      tab1.leader.guardsChanged();
      expect(clears.count()).toBe(0);

      // Call ends: the focused follower takes over.
      callActive = false;
      tab1.leader.guardsChanged();
      await flushMicrotasks(30);
      expect(clears.count()).toBe(1);
      expect(stoodDown).toBe(1);
      expect(tab2.leader.isLeader()).toBe(true);
      expect(tab1.leader.role()).toBe('follower');
    });

    it('treats a throwing guard as busy and stops blocking once unregistered', async () => {
      const [tab1, tab2] = await startLeaderAndFollower();
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const unregister = tab1.leader.registerGuard('phone', () => {
        throw new Error('boom');
      });

      tab2.leader.requestLeadership();
      await flushMicrotasks();
      expect(tab1.leader.isLeader()).toBe(true);

      unregister();
      tab2.leader.requestLeadership();
      await flushMicrotasks();
      expect(tab2.leader.isLeader()).toBe(true);
      errSpy.mockRestore();
    });

    it('does not retry on guards-clear when the follower lost focus meanwhile', async () => {
      const [tab1, tab2] = await startLeaderAndFollower();
      let busy = true;
      tab1.leader.registerGuard('phone', () => !busy);

      tab2.doc.setActive(true, true);
      await vi.advanceTimersByTimeAsync(DEFAULT_TAB_LEADER_CONFIG.focusSettleMs);
      await flushMicrotasks();
      tab2.doc.setActive(false, false);

      busy = false;
      tab1.leader.guardsChanged();
      await flushMicrotasks();
      expect(tab1.leader.isLeader()).toBe(true);
      expect(tab2.leader.role()).toBe('follower');
    });

    it('ignores pagehide on a follower', async () => {
      const [tab1, tab2] = await startLeaderAndFollower();
      const closing = countControl(tab2, 'tabs.leader-closing');

      tab2.doc.triggerPageHide();
      await flushMicrotasks();

      expect(closing.count()).toBe(0);
      expect(tab2.leader.role()).toBe('follower');
      expect(tab1.leader.isLeader()).toBe(true);
    });

    it('returns from bfcache as a follower when another tab took over meanwhile', async () => {
      const [tab1, tab2] = await startLeaderAndFollower();

      tab1.doc.triggerPageHide();
      await flushMicrotasks();
      expect(tab2.leader.isLeader()).toBe(true);
      expect(tab1.leader.role()).toBe('follower');

      tab1.doc.triggerPageShow(true);
      await flushMicrotasks();

      expect(tab1.leader.role()).toBe('follower');
      expect(tab1.leader.leaderTabId()).toBe(tab2.leader.tabId);
      expect(tab2.leader.isLeader()).toBe(true);

      // Once tab 2 goes away, the restored tab is next in line.
      tab2.doc.triggerPageHide();
      await flushMicrotasks();
      expect(tab1.leader.isLeader()).toBe(true);
    });
  });
});
