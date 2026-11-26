import { DOCUMENT, DestroyRef, Service, inject, signal } from '@angular/core';

@Service()
export class NotificationPresentation {
  private readonly document = inject(DOCUMENT);
  private context: AudioContext | null = null;
  readonly permission = signal<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );

  constructor() {
    const activate = (): void => {
      if (typeof AudioContext === 'undefined') return;
      try {
        this.context ??= new AudioContext();
        void this.context.resume().catch(() => undefined);
      } catch {
        // Browser audio is optional; retain the toast and desktop channels.
      }
    };
    this.document.addEventListener('pointerdown', activate, { once: true });
    inject(DestroyRef).onDestroy(() => {
      this.document.removeEventListener('pointerdown', activate);
      void this.context?.close().catch(() => undefined);
    });
  }

  async enableDesktop(): Promise<void> {
    if (typeof Notification === 'undefined') return;
    try {
      this.permission.set(await Notification.requestPermission());
    } catch {
      this.permission.set(Notification.permission);
    }
  }

  showDesktop(title: string, tag: string): void {
    if (!this.document.hidden || typeof Notification === 'undefined' ||
        Notification.permission !== 'granted') return;
    try {
      const notice = new Notification(title, { tag });
      notice.onclick = () => {
        this.document.defaultView?.focus();
        notice.close();
      };
    } catch {
      // Some browsers require a service worker for system notifications.
    }
  }

  playSound(): void {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    const start = context.currentTime;
    const tone = context.createOscillator();
    const volume = context.createGain();
    tone.frequency.setValueAtTime(660, start);
    tone.frequency.setValueAtTime(880, start + 0.08);
    volume.gain.setValueAtTime(0, start);
    volume.gain.linearRampToValueAtTime(0.09, start + 0.02);
    volume.gain.linearRampToValueAtTime(0, start + 0.18);
    tone.connect(volume).connect(context.destination);
    tone.start(start);
    tone.stop(start + 0.18);
  }
}
