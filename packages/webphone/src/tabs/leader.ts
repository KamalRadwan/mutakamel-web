/**
 * One SIP registration per browser, no matter how many tabs are open.
 *
 * ## The problem
 *
 * Every tab that mounts the phone used to build its own `JsSIP.UA` and REGISTER
 * with it. Asterisk then holds several contacts for one extension and forks
 * calls across all of them, so a call rings in a tab nobody is looking at, and
 * whichever tab answers first wins by accident.
 *
 * ## Why the Web Locks API rather than a timestamp in storage
 *
 * The hard part of electing a leader is not picking one — it is noticing when
 * the leader dies. A `localStorage` heartbeat has to guess: too short a timeout
 * and a busy tab gets deposed mid-call, too long and the phone is deaf for
 * that whole window. Worse, two tabs can both decide the throne is empty and
 * register at once, which is the original bug wearing a hat.
 *
 * An exclusive Web Lock held by a promise that never resolves moves that
 * problem into the browser. The lock is released when the tab closes, crashes,
 * or the process is killed — no heartbeat, no timeout, no window where two tabs
 * both believe they lead. Waiters queue, and the next one is granted the moment
 * the holder disappears.
 *
 * ## What this deliberately does not do
 *
 * Failover covers the *registration*, not a call in progress. A call lives in
 * an `RTCPeerConnection` and a SIP dialog inside one tab; when that tab dies
 * both die with it, and no election can inherit them. A new leader re-registers
 * within a second, and the dropped call stays dropped. Promising otherwise
 * would be a lie told in an API shape.
 */

export const WEBPHONE_LEADER_LOCK = 'mutakamel.webphone.leader';
export const WEBPHONE_TAB_CHANNEL = 'mutakamel.webphone.tabs';

export type WebphoneTabRole = 'electing' | 'leader' | 'follower';

/**
 * What a follower is told about the call the leader is holding.
 *
 * Deliberately small: it is what a follower needs to render an honest summary
 * and nothing more. It is not a mirror of the leader's hook state — a follower
 * that could reconstruct the whole phone would invite someone to try driving it
 * from there, and the audio would still be in the other tab.
 */
export type WebphoneSharedSnapshot = {
  registered: boolean;
  extension: string;
  callBusy: boolean;
  callActive: boolean;
  incomingCallWaiting: boolean;
  callPeerNumber: string;
  callPeerName: string;
  connectionState: string;
  statusCode: string;
  statusDetail?: string;
  timerLabel?: string;
  muted: boolean;
  held: boolean;
  simulatedIncoming: boolean;
  /** Why the phone could not place or hold a call, if anything. */
  mediaNotice?: string;
};

/**
 * What a follower asks the leader to do.
 *
 * A follower owns no SIP stack and no microphone, so every one of these is a
 * request rather than an action: it is posted, the leader performs it, and the
 * follower learns the result the same way every other tab does — from the next
 * snapshot. Nothing here returns a value, because a command that appeared to
 * succeed locally while failing in the tab that actually holds the call would
 * be worse than one that plainly does nothing.
 */
export type WebphoneCommand =
  | { kind: 'call'; target: string }
  | { kind: 'answer' }
  | { kind: 'decline' }
  | { kind: 'hangup' }
  | { kind: 'toggle-mute' }
  | { kind: 'toggle-hold' }
  | { kind: 'dtmf'; digit: string }
  | { kind: 'transfer'; target: string }
  | { kind: 'test-incoming' };

type TabMessage =
  | { kind: 'hello' }
  | { kind: 'alive' }
  | { kind: 'snapshot'; snapshot: WebphoneSharedSnapshot }
  | { kind: 'focus-request' }
  | { kind: 'command'; command: WebphoneCommand };

/**
 * How long a follower waits for a leader to answer `hello` before deciding the
 * lock is held by a context that no longer exists.
 *
 * A live leader answers on the same task queue, so this is orders of magnitude
 * more than a healthy reply needs. It is sized for the failure it detects, not
 * the success it usually sees: a phone that stays deaf for a few seconds after
 * a crash is a nuisance, one that stays deaf forever is a broken product.
 */
const GHOST_LEADER_TIMEOUT_MS = 4_000;

export type WebphoneTabsHandle = {
  /** Frees the channel and steps out of the election queue. */
  dispose: () => void;
  /** Leader only: tells every follower what the phone is doing. */
  publish: (snapshot: WebphoneSharedSnapshot) => void;
  /** Follower only: asks the leader tab to bring itself to the front. */
  requestFocus: () => void;
  /** Follower only: asks the leader to act on the call. */
  send: (command: WebphoneCommand) => void;
  /**
   * Takes the phone from whoever holds it.
   *
   * A browser refuses a hidden tab the microphone — `getUserMedia` rejects with
   * `NotAllowedError` in milliseconds, so a call asked for from another tab
   * cannot be placed by a leader nobody is looking at. Focusing that tab is not
   * an option either: `window.focus()` needs a user gesture the message did not
   * carry. The only thing that actually works is for the tab the person *is*
   * using to become the phone.
   *
   * Steals, then releases immediately, so the browser's own queue — which this
   * tab is already sitting in — grants it properly rather than this holding a
   * stolen lock.
   */
  claimLeadership: () => void;
};

export type WebphoneTabsCallbacks = {
  onRole: (role: WebphoneTabRole) => void;
  onSnapshot: (snapshot: WebphoneSharedSnapshot) => void;
  /** Leader only: a follower just joined and needs the current picture. */
  onSnapshotRequested: () => void;
  /** Leader only: a follower asked us to take the screen. */
  onFocusRequested: () => void;
  /** Leader only: a follower wants the phone to do something. */
  onCommand: (command: WebphoneCommand) => void;
};

/**
 * True when this browser can elect a leader at all.
 *
 * Both APIs are baseline in every browser this app supports, but the check is
 * real rather than decorative: `navigator.locks` is undefined outside a secure
 * context, and a phone that refuses to register because a lock API is missing
 * would be a worse bug than the duplicate registrations it set out to fix.
 */
export function supportsTabElection(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof BroadcastChannel !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    navigator.locks !== undefined
  );
}

export function joinWebphoneTabs(
  callbacks: WebphoneTabsCallbacks,
): WebphoneTabsHandle {
  // Without the APIs every tab leads, which is exactly today's behaviour. That
  // is the right degradation: one phone that works and may register twice beats
  // no phone at all.
  if (!supportsTabElection()) {
    callbacks.onRole('leader');
    return {
      dispose: () => undefined,
      publish: () => undefined,
      requestFocus: () => undefined,
      send: () => undefined,
      claimLeadership: () => undefined,
    };
  }

  const channel = new BroadcastChannel(WEBPHONE_TAB_CHANNEL);
  let role: WebphoneTabRole = 'electing';
  let disposed = false;
  // Resolving this hands the lock back, which is how `dispose` leaves the
  // election without waiting for the tab to close.
  let releaseLock: (() => void) | undefined;
  // A *pending* request cannot be resolved out of — `releaseLock` does not
  // exist until the lock is granted — and there is no other way to leave the
  // queue. Without this, every unmount that happened before the grant (React
  // StrictMode does one on every mount in development) left a request queued
  // behind the live leader. Each would later be granted to a disposed handle
  // that no longer holds a resolver, and the lock would be held forever by
  // nobody: the next real tab would wait behind a ghost and never register.
  const abortElection = new AbortController();
  let leaderAnswered = false;
  let ghostTimer: ReturnType<typeof setTimeout> | undefined;

  const setRole = (next: WebphoneTabRole) => {
    if (disposed || role === next) return;
    role = next;
    callbacks.onRole(next);
  };

  const post = (message: TabMessage) => {
    if (disposed) return;
    try {
      channel.postMessage(message);
    } catch {
      // A closed channel must never take the phone down with it.
    }
  };

  channel.onmessage = (event: MessageEvent<TabMessage>) => {
    if (disposed) return;
    const message = event.data;
    if (!message || typeof message.kind !== 'string') return;

    if (message.kind === 'snapshot') {
      // A leader ignores snapshots: it is the one producing them, and applying
      // its own echo would let a stale follower overwrite live state.
      if (role !== 'leader') callbacks.onSnapshot(message.snapshot);
      return;
    }
    if (message.kind === 'hello' && role === 'leader') {
      // Two answers to one question. The snapshot is what the follower renders;
      // `alive` is the proof that a real context holds the lock, and it is sent
      // first because it is the one that must not depend on any hook state
      // being ready.
      post({ kind: 'alive' });
      callbacks.onSnapshotRequested();
      return;
    }
    if (message.kind === 'alive') {
      // Someone real is holding it. Stand down.
      leaderAnswered = true;
      if (ghostTimer !== undefined) {
        clearTimeout(ghostTimer);
        ghostTimer = undefined;
      }
      return;
    }
    if (message.kind === 'focus-request' && role === 'leader') {
      callbacks.onFocusRequested();
      return;
    }
    if (message.kind === 'command' && role === 'leader') {
      callbacks.onCommand(message.command);
    }
  };

  callbacks.onRole('electing');

  /**
   * Takes a place in the queue, and keeps taking one.
   *
   * The promise never settles, so once granted the lock is held for the life of
   * the tab. The retry is the part that matters: a `steal` — which is how a
   * ghost holder is evicted — rejects every *pending* request as well as
   * displacing the holder. Treating that rejection as "this tab is a follower
   * now" left it in no queue at all, so a single eviction anywhere knocked
   * every other tab permanently out of the election and the lock ended up held
   * by nobody. A rejection means the attempt ended, not that the tab stopped
   * wanting the phone.
   */
  function enterElection() {
    if (disposed) return;
    void navigator.locks
      .request(
        WEBPHONE_LEADER_LOCK,
        { mode: 'exclusive', signal: abortElection.signal },
        () => {
          if (disposed) return Promise.resolve();
          setRole('leader');
          return new Promise<void>((resolve) => {
            releaseLock = resolve;
          });
        },
      )
      .catch(() => {
        if (disposed) return;
        // Never fall through to registering: a tab that does not hold the lock
        // must not build a UA, or it recreates the duplicate contact this
        // module exists to prevent. Step back to follower, then queue again.
        setRole('follower');
        // A short delay rather than an immediate retry, so a burst of steals
        // cannot spin. The lock is granted the moment it is free either way.
        setTimeout(enterElection, 250);
      });
  }

  enterElection();

  // The request above only calls back once granted, so a tab that is queued
  // behind a live leader would otherwise sit in `electing` forever with nothing
  // on screen explaining why. Asking whether the lock is taken settles that,
  // and starts the check for whether the holder is actually alive.
  void navigator.locks
    .request(WEBPHONE_LEADER_LOCK, { ifAvailable: true }, (lock) => {
      if (lock !== null) return Promise.resolve();
      if (role === 'electing') setRole('follower');
      armGhostCheck();
      return Promise.resolve();
    })
    .catch(() => undefined);

  // Whoever holds the phone right now: tell us what it is doing.
  post({ kind: 'hello' });

  /**
   * Evicts a lock held by a context that is gone.
   *
   * The browser is supposed to release a lock when its context dies, and
   * usually does. It is not reliable enough to be the only mechanism: a
   * context can outlive its tab — observed directly, with the lock still held
   * by a client id matching no open tab while the one real tab sat queued
   * behind it forever, registering nothing. A phone that needs the browser to
   * be tidy before it will ring is not a phone.
   *
   * `hello` was already sent above. A live leader answers `alive` immediately;
   * nothing answers for a ghost. Stealing then releasing straight away is what
   * makes this safe against two followers reaching the same conclusion at the
   * same moment: neither keeps the stolen lock, and the browser's own queue —
   * which both are already sitting in — grants it to exactly one of them.
   */
  function armGhostCheck() {
    if (ghostTimer !== undefined || disposed) return;
    ghostTimer = setTimeout(() => {
      ghostTimer = undefined;
      if (disposed || leaderAnswered || role === 'leader') return;
      void navigator.locks
        .request(WEBPHONE_LEADER_LOCK, { steal: true }, () => undefined)
        .catch(() => undefined);
    }, GHOST_LEADER_TIMEOUT_MS);
  }

  return {
    dispose: () => {
      if (disposed) return;
      disposed = true;
      // Granted: resolve out of it. Still queued: abort out of it. One of the
      // two always applies, and skipping either leaks the lock.
      releaseLock?.();
      abortElection.abort();
      if (ghostTimer !== undefined) clearTimeout(ghostTimer);
      try {
        channel.close();
      } catch {
        // Already closed.
      }
    },
    publish: (snapshot) => {
      if (role === 'leader') post({ kind: 'snapshot', snapshot });
    },
    requestFocus: () => post({ kind: 'focus-request' }),
    send: (command) => {
      if (role !== 'leader') post({ kind: 'command', command });
    },
    claimLeadership: () => {
      if (disposed || role === 'leader') return;
      void navigator.locks
        .request(WEBPHONE_LEADER_LOCK, { steal: true }, () => undefined)
        .catch(() => undefined);
    },
  };
}
