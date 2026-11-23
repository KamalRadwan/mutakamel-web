import { DOCUMENT, DestroyRef, Service, Signal, effect, inject, untracked } from '@angular/core';
import { TabBus } from '../tabs/tab-bus';
import { TabLeader } from '../tabs/tab-leader';
import { createCallLog } from './phone.api';
import { CreateCallLogInput, PhoneCommand, PhoneLostPayload, PhoneSyncedState } from './phone.model';
import { PHONE_PREFS_STORAGE_KEY, PhonePrefs, readPhonePrefs } from './phone-preferences';

const TOPIC_PHONE_STATE = 'phone.state';
const TOPIC_PHONE_COMMAND = 'phone.command';
const TOPIC_PHONE_LOST = 'phone.lost';

export interface PhoneSyncHooks {
  isBusy: () => boolean;
  onStandDown: () => Promise<void>;
  onLeadershipStop: () => void;
  onBecomeLeader: (crashedBusySnapshot: PhoneSyncedState | null) => void;
  onBecomeFollower: () => void;
  onCommand: (cmd: PhoneCommand) => void;
  onLostCall: (payload: PhoneLostPayload) => void;
  onPrefsStorageChange: (prefs: PhonePrefs) => void;
  onBeforeUnloadCheck: () => boolean;
  onPageHideCapture: () => { lostPayload: PhoneLostPayload; callLog: CreateCallLogInput } | null;
}

/** Coordinates TabLeader, TabBus, storage sync, and pagehide/crash lost-call handling for `PhoneState`. */
@Service()
export class PhoneSync {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tabLeader = inject(TabLeader);
  private readonly tabBus = inject(TabBus);

  readonly isLeader: Signal<boolean> = this.tabLeader.isLeader;
  readonly syncedState: Signal<PhoneSyncedState | null> = this.tabBus.state<PhoneSyncedState>(TOPIC_PHONE_STATE);

  private hooks: PhoneSyncHooks | null = null;
  private cleanups: (() => void)[] = [];
  private handledLossForBusy = false;
  private lastBusySnapshot: PhoneSyncedState | null = null;
  private wasLeader = false;
  private hasJoinedRole = false;
  private readonly persistedLossIds = new Set<string>();

  private readonly onStorage = (event: StorageEvent) => {
    if (event.key !== PHONE_PREFS_STORAGE_KEY) return;
    this.hooks?.onPrefsStorageChange(readPhonePrefs());
  };

  private readonly onBeforeUnload = (event: BeforeUnloadEvent) => {
    if (this.hooks?.onBeforeUnloadCheck()) {
      event.preventDefault();
      event.returnValue = '';
    }
  };

  // Use capture phase so `phone.lost` broadcasts before `TabLeader`'s bubbling `pagehide` closes the channel.
  private readonly onPageHide = () => {
    if (!this.tabLeader.isLeader()) return;
    const info = this.hooks?.onPageHideCapture();
    if (!info || this.persistedLossIds.has(info.lostPayload.lossId)) return;
    this.persistedLossIds.add(info.lostPayload.lossId);
    this.handledLossForBusy = true;
    this.tabBus.broadcast<PhoneLostPayload>(TOPIC_PHONE_LOST, info.lostPayload);
    // Best effort through the existing authenticated transport; never queue or replay this append.
    void createCallLog(info.callLog).catch(() => {});
  };

  constructor() {
    effect(() => {
      const role = this.tabLeader.role();
      const leader = this.tabLeader.isLeader();
      const synced = this.syncedState();

      untracked(() => {
        if (synced?.busy) {
          this.lastBusySnapshot = synced;
        } else if (synced && !synced.busy) {
          this.lastBusySnapshot = null;
          this.handledLossForBusy = false;
        }

        if (!this.hooks) return;

        if (role !== 'electing') {
          this.hasJoinedRole = true;
        }

        if (role === 'electing' && this.hasJoinedRole) {
          this.hasJoinedRole = false;
          this.wasLeader = false;
          this.lastBusySnapshot = null;
          this.handledLossForBusy = false;
          this.hooks.onLeadershipStop();
          return;
        }

        if (leader && !this.wasLeader) {
          this.wasLeader = true;
          const crashedSnapshot = !this.handledLossForBusy && this.lastBusySnapshot?.busy ? this.lastBusySnapshot : null;
          if (crashedSnapshot) {
            this.handledLossForBusy = true;
          }
          this.lastBusySnapshot = null;
          this.hooks.onBecomeLeader(crashedSnapshot);
        } else if (!leader && this.wasLeader) {
          this.wasLeader = false;
          this.hooks.onBecomeFollower();
        }
      });
    });

    this.destroyRef.onDestroy(() => this.dispose());
  }

  init(hooks: PhoneSyncHooks): void {
    this.dispose();
    this.hooks = hooks;
    this.wasLeader = this.tabLeader.isLeader();
    this.hasJoinedRole = this.tabLeader.role() !== 'electing';

    this.cleanups.push(
      this.tabLeader.registerGuard('phone', () => !hooks.isBusy()),
      this.tabLeader.registerStandDown('phone', () => hooks.onStandDown()),
      this.tabBus.on<PhoneCommand>(TOPIC_PHONE_COMMAND, (cmd) => {
        if (this.tabLeader.isLeader()) {
          hooks.onCommand(cmd);
        }
      }),
      this.tabBus.on<PhoneLostPayload>(TOPIC_PHONE_LOST, (payload) => {
        this.handledLossForBusy = true;
        this.lastBusySnapshot = null;
        hooks.onLostCall(payload);
      }),
    );

    const win = this.document.defaultView;
    if (win) {
      win.addEventListener('storage', this.onStorage);
      win.addEventListener('beforeunload', this.onBeforeUnload);
      win.addEventListener('pagehide', this.onPageHide, { capture: true });
      this.cleanups.push(() => {
        win.removeEventListener('storage', this.onStorage);
        win.removeEventListener('beforeunload', this.onBeforeUnload);
        win.removeEventListener('pagehide', this.onPageHide, { capture: true });
      });
    }
  }

  publishState(snapshot: PhoneSyncedState): void {
    if (!this.tabLeader.isLeader()) return;
    this.tabBus.publish<PhoneSyncedState>(TOPIC_PHONE_STATE, snapshot);
  }

  sendCommand(name: string, ...args: unknown[]): void {
    this.tabBus.send<PhoneCommand>(TOPIC_PHONE_COMMAND, { name, args });
  }

  guardsChanged(): void {
    this.tabLeader.guardsChanged();
  }

  requestLeadership(): void {
    this.tabLeader.requestLeadership();
  }

  dispose(): void {
    for (const stop of this.cleanups) {
      stop();
    }
    this.cleanups = [];
    this.hooks = null;
  }
}
