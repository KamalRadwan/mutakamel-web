import { DOCUMENT, DestroyRef, Service, inject, signal } from '@angular/core';
import { PhoneNotifyPermission } from './phone.model';

/** Manages desktop notification permissions and incoming-call system notifications for the leader tab. */
@Service()
export class PhoneNotify {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  readonly permission = signal<PhoneNotifyPermission>(readNotificationPermission());

  private activeNotification: Notification | null = null;
  private clickArmed = false;
  private shouldPromptFn: (() => boolean) | null = null;
  private onPromptFn: (() => void) | null = null;

  private readonly onFirstClick = () => {
    this.disarmFirstClickPrompt();
    if (this.shouldPromptFn?.()) {
      this.onPromptFn?.();
    }
  };

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.disarmFirstClickPrompt();
      this.closeRingNotification();
    });
  }

  syncPermission(): PhoneNotifyPermission {
    const perm = readNotificationPermission();
    this.permission.set(perm);
    return perm;
  }

  armFirstClickPrompt(shouldPrompt: () => boolean, onTriggered: () => void): void {
    this.shouldPromptFn = shouldPrompt;
    this.onPromptFn = onTriggered;
    if (this.clickArmed || !shouldPrompt()) return;
    this.clickArmed = true;
    this.document.addEventListener('click', this.onFirstClick, { capture: true, once: true });
  }

  disarmFirstClickPrompt(): void {
    if (!this.clickArmed) return;
    this.clickArmed = false;
    this.document.removeEventListener('click', this.onFirstClick, { capture: true });
  }

  async requestPermission(): Promise<PhoneNotifyPermission> {
    if (typeof Notification === 'undefined') {
      this.permission.set('unsupported');
      return 'unsupported';
    }
    try {
      const result = await Notification.requestPermission();
      const mapped = mapNotifyPermission(result);
      this.permission.set(mapped);
      return mapped;
    } catch {
      const current = readNotificationPermission();
      this.permission.set(current);
      return current;
    }
  }

  showRingNotification(title: string, body: string, onClick: () => void): void {
    if (typeof Notification === 'undefined') return;
    if (this.syncPermission() !== 'granted') return;
    if (!this.document.hidden) return;

    this.closeRingNotification();
    try {
      const notice = new Notification(title, {
        body,
        tag: 'phone-ring',
        requireInteraction: true,
      });
      notice.onclick = () => {
        try {
          this.document.defaultView?.focus();
        } catch {
          // Ignore focus failures
        }
        onClick();
        this.closeRingNotification();
      };
      notice.onclose = () => {
        if (this.activeNotification === notice) {
          this.activeNotification = null;
        }
      };
      this.activeNotification = notice;
    } catch {
      // Ignore browsers where Notification constructor requires a ServiceWorker.
    }
  }

  closeRingNotification(): void {
    if (!this.activeNotification) return;
    try {
      this.activeNotification.close();
    } catch {
      // Ignore close errors
    }
    this.activeNotification = null;
  }
}

function readNotificationPermission(): PhoneNotifyPermission {
  if (typeof Notification === 'undefined') return 'unsupported';
  return mapNotifyPermission(Notification.permission);
}

function mapNotifyPermission(value: NotificationPermission): PhoneNotifyPermission {
  if (value === 'granted' || value === 'denied' || value === 'default') return value;
  return 'unsupported';
}
