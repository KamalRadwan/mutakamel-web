import { DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../core/i18n/translation-events';
import { TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { PhoneState } from '../../../core/phone/phone';
import { IncomingCall } from '../incoming-call/incoming-call';
import { PhoneBar } from '../phone-bar/phone-bar';
import { PhonePanel } from '../phone-panel/phone-panel';

/** Delay before the open panel folds to the bar after the last call ends (the ended summary stays in the bar). */
export const ENDED_AUTO_COLLAPSE_MS = 3_000;

@Component({
  selector: 'app-phone-host',
  imports: [PhoneBar, PhonePanel, IncomingCall],
  providers: [provideTranslocoScope({ scope: 'web-phone', alias: 'webPhone' })],
  templateUrl: './phone-host.html',
  styleUrl: './phone-host.css',
})
export class PhoneHost {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly doc = inject(DOCUMENT);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly remoteAudio = viewChild<ElementRef<HTMLAudioElement>>('remoteAudio');
  private readonly bar = viewChild<PhoneBar>('bar');
  private readonly incomingPopover = viewChild.required<ElementRef<HTMLElement>>('incomingPopover');
  private readonly dockPopover = viewChild.required<ElementRef<HTMLElement>>('dockPopover');
  protected readonly phone = inject(PhoneState);

  protected readonly modalOpen = signal(false);
  protected readonly transferOpen = signal(false);
  private readonly dismissedRingingId = signal<string | null>(null);
  private readonly modalOpenSeq = signal(0);
  private readonly externalModalOpenSeq = signal(0);

  private knownOpenDialogs = new Set<Element>();
  private attachedAudioEl: HTMLAudioElement | null = null;
  private wasPanelOpen = false;
  private lastExternalModalSeq = 0;
  private lastIncomingModalSeq = 0;
  private lastRingingId: string | null = null;
  private endedCollapseTimer: ReturnType<typeof setTimeout> | null = null;
  private collapsedForEnded: string | null = null;
  private skipBarFocus = false;

  protected readonly showIncomingCard = computed(() => {
    const ringing = this.phone.ringing();
    if (!ringing || this.phone.panelOpen() || this.phone.ringSilenced()) return false;
    return this.dismissedRingingId() !== ringing.id;
  });

  protected readonly incomingAnnouncement = computed(() => {
    this.i18n();
    const ringing = this.phone.ringing();
    if (!ringing) return '';
    const base = this.transloco.translate('webPhone.launcher.incomingFrom', {
      name: ringing.displayName || ringing.number,
    });
    const hint = this.transloco.translate('webPhone.launcher.answerShortcutHint');
    return `${base}. ${hint}`;
  });

  /** Stable identity of the ended summary (follower tabs receive a fresh object on every sync). */
  private readonly endedKey = computed(() => {
    const ended = this.phone.ended();
    return ended ? [ended.number, ended.name, ended.reason, ended.durationSeconds].join('|') : null;
  });

  protected readonly showBar = computed(() => !this.modalOpen() || this.phone.busy());

  constructor() {
    const destroyRef = inject(DestroyRef);
    const syncModalOpen = () => {
      const allOpen = Array.from(this.doc.querySelectorAll('dialog[open]'));
      const externalOpen = allOpen.filter((dialog) => !this.host.nativeElement.contains(dialog));
      this.modalOpen.set(externalOpen.length > 0);

      const current = new Set(allOpen);
      let hasNewDialog = false;
      let hasNewExternalDialog = false;
      for (const dialog of allOpen) {
        if (!this.knownOpenDialogs.has(dialog)) {
          hasNewDialog = true;
          if (!this.host.nativeElement.contains(dialog)) {
            hasNewExternalDialog = true;
          }
        }
      }
      this.knownOpenDialogs = current;
      if (hasNewDialog) {
        this.modalOpenSeq.update((n) => n + 1);
      }
      if (hasNewExternalDialog) {
        this.externalModalOpenSeq.update((n) => n + 1);
      }
    };

    syncModalOpen();
    const observer = new MutationObserver(syncModalOpen);
    if (this.doc.body) {
      observer.observe(this.doc.body, {
        attributes: true,
        attributeFilter: ['open'],
        childList: true,
        subtree: true,
      });
    }
    destroyRef.onDestroy(() => observer.disconnect());

    const onKeydown = (event: KeyboardEvent) => this.onDocumentKeydown(event);
    this.doc.addEventListener('keydown', onKeydown);
    destroyRef.onDestroy(() => this.doc.removeEventListener('keydown', onKeydown));

    effect(() => {
      const el = this.remoteAudio()?.nativeElement ?? null;
      if (el && el !== this.attachedAudioEl) {
        this.attachedAudioEl = el;
        this.phone.attachAudio(el);
      }
    });

    effect(() => {
      const ringingId = this.phone.ringing()?.id ?? null;
      if (!ringingId || (this.dismissedRingingId() && this.dismissedRingingId() !== ringingId)) {
        this.dismissedRingingId.set(null);
      }
    });

    effect(() => {
      const open = this.phone.panelOpen();
      const bar = this.bar();
      if (this.wasPanelOpen && !open && bar) {
        this.wasPanelOpen = false;
        const skip = this.skipBarFocus;
        this.skipBarFocus = false;
        if (!skip) queueMicrotask(() => bar.focus());
        return;
      }
      if (open) {
        this.wasPanelOpen = true;
      }
    });

    effect(() => {
      const ended = this.endedKey();
      const idle = !this.phone.busy() && !this.phone.ringing();
      this.clearEndedCollapseTimer();
      if (!ended || !idle) {
        this.collapsedForEnded = null;
        return;
      }
      if (ended === this.collapsedForEnded) return;
      if (!untracked(() => this.phone.panelOpen())) return;
      this.endedCollapseTimer = setTimeout(() => {
        this.endedCollapseTimer = null;
        this.autoCollapseAfterEnded(ended);
      }, ENDED_AUTO_COLLAPSE_MS);
    });
    destroyRef.onDestroy(() => this.clearEndedCollapseTimer());

    effect(() => {
      const visible = this.phone.visible();
      const showIncoming = visible && this.showIncomingCard();
      const ringingId = this.phone.ringing()?.id ?? null;
      const extSeq = this.externalModalOpenSeq();
      const anySeq = this.modalOpenSeq();

      const dockEl = this.dockPopover().nativeElement;
      const incomingEl = this.incomingPopover().nativeElement;

      let dockMovedToTop = false;
      if (typeof dockEl.showPopover === 'function') {
        try {
          const isOpen = dockEl.matches(':popover-open');
          if (!visible) {
            if (isOpen) dockEl.hidePopover();
          } else if (!isOpen) {
            dockEl.showPopover();
            dockMovedToTop = true;
          } else if (extSeq !== this.lastExternalModalSeq && !dockEl.querySelector('dialog[open]')) {
            dockEl.hidePopover();
            dockEl.showPopover();
            dockMovedToTop = true;
          }
        } catch {
          // Ignore transient popover state errors during teardown or non-top-layer environments.
        }
      }

      if (typeof incomingEl.showPopover === 'function') {
        try {
          const isOpen = incomingEl.matches(':popover-open');
          if (!showIncoming) {
            if (isOpen) incomingEl.hidePopover();
          } else if (
            !isOpen ||
            dockMovedToTop ||
            anySeq !== this.lastIncomingModalSeq ||
            ringingId !== this.lastRingingId
          ) {
            if (isOpen) incomingEl.hidePopover();
            incomingEl.showPopover();
          }
        } catch {
          // Ignore transient popover state errors during teardown or non-top-layer environments.
        }
      }

      this.lastExternalModalSeq = extSeq;
      this.lastIncomingModalSeq = anySeq;
      this.lastRingingId = ringingId;
    });
  }

  private clearEndedCollapseTimer(): void {
    if (this.endedCollapseTimer !== null) {
      clearTimeout(this.endedCollapseTimer);
      this.endedCollapseTimer = null;
    }
  }

  /** Folds the panel once per ended call, unless a call came back or the user moved on in the panel. */
  private autoCollapseAfterEnded(ended: string): void {
    const phone = this.phone;
    if (this.endedKey() !== ended || phone.busy() || phone.ringing() || !phone.panelOpen()) return;
    this.collapsedForEnded = ended;
    if (phone.tab() !== 'phone' || phone.dialValue() !== '' || this.transferOpen()) return;
    const active = this.doc.activeElement;
    this.skipBarFocus = !(active && this.dockPopover().nativeElement.contains(active));
    phone.close();
  }

  private onDocumentKeydown(event: KeyboardEvent): void {
    if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) return;
    if (event.code !== 'KeyA' && event.key.toLowerCase() !== 'a') return;
    if (!this.phone.visible() || !this.phone.ringing()) return;

    const container = this.showIncomingCard()
      ? this.incomingPopover().nativeElement
      : this.dockPopover().nativeElement;
    const answerBtn = container.querySelector<HTMLElement>('[data-phone-answer]:not([disabled])');
    if (!answerBtn) return;

    event.preventDefault();
    answerBtn.focus();
  }

  protected onFloatingAnswerAndTransfer(): void {
    this.transferOpen.set(true);
    this.phone.open('phone');
  }

  protected onDismissFloating(): void {
    const ringing = this.phone.ringing();
    if (ringing) {
      this.dismissedRingingId.set(ringing.id);
    }
  }
}
