import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, ElementRef, computed, inject, signal } from '@angular/core';
import { translationEvents } from '../../../core/i18n/translation-events';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerPhone, tablerX } from '@ng-icons/tabler-icons';
import { PhoneState } from '../../../core/phone/phone';

type CallLeg = ReturnType<PhoneState['legs']>[number];
type CallSource = NonNullable<CallLeg['source']>;
type EndedInfo = NonNullable<ReturnType<PhoneState['ended']>>;

let nextStatusTooltipId = 0;

export function sourceRoute(source: CallSource): string[] {
  switch (source.type) {
    case 'LEAD':
      return ['/crm/leads', source.id];
    case 'CUSTOMER_PROFILE':
      return ['/crm/customers', source.id];
    case 'OPPORTUNITY':
      return ['/crm/opportunities', source.id];
    case 'PARTY':
      return ['/workspace/operations/party-directory'];
  }
}

const SELF_NAMED_END_REASONS = new Set<EndedInfo['reason']>([
  'ended',
  'conferenceEnded',
  'failed',
  'dropped',
  'tabClosed',
]);

@Component({
  selector: 'app-status-line',
  imports: [RouterLink, TranslocoPipe, NgIcon],
  providers: [provideIcons({ tablerPhone, tablerX })],
  templateUrl: './status-line.html',
  host: {
    class: 'block shrink-0',
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class StatusLine {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly phone = inject(PhoneState);

  protected readonly tooltipId = `phone-status-tooltip-${++nextStatusTooltipId}`;
  protected readonly tooltipOpen = signal(false);
  protected readonly tooltipDismissed = signal(false);
  private readonly tooltipHovered = signal(false);
  private readonly tooltipFocused = signal(false);
  protected readonly tooltipVisible = computed(
    () => !this.tooltipDismissed() && (this.tooltipOpen() || this.tooltipHovered() || this.tooltipFocused()),
  );
  protected readonly sourceRoute = sourceRoute;

  constructor() {
    const onDocKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.onTooltipEscape(event);
      }
    };
    this.doc.addEventListener('keydown', onDocKeydown, true);
    this.destroyRef.onDestroy(() => this.doc.removeEventListener('keydown', onDocKeydown, true));
  }

  protected readonly endedInfo = computed(() =>
    !this.phone.busy() && !this.phone.ringing() ? this.phone.ended() : null,
  );

  protected readonly redialDisabled = computed(() => {
    const notice = this.phone.mediaNotice();
    return (
      this.phone.micPermission() === 'denied' ||
      notice === 'permissionDenied' ||
      notice === 'noMicrophone'
    );
  });

  protected readonly activePeer = computed(() => {
    if (!this.phone.busy() || this.phone.ringing() || this.phone.mode() === 'conference') return null;
    const leg = this.phone.focusedLeg() ?? this.phone.legs()[0];
    if (!leg?.displayName) return null;
    return { name: leg.displayName, source: leg.source };
  });

  protected readonly callStatePrefix = computed(() => {
    this.i18n();
    const state = this.phone.callState();
    if (state === 'calling') return this.transloco.translate('webPhone.inCall.calling');
    if (state === 'ringing') return this.transloco.translate('webPhone.inCall.ringing');
    const leg = this.phone.focusedLeg() ?? this.phone.legs()[0];
    if (leg?.held) return this.transloco.translate('webPhone.inCall.onHold');
    return this.transloco.translate('webPhone.status.inCall');
  });

  protected readonly dotClass = computed(() => {
    if (this.phone.ringing()) return 'bg-icon-violet';

    if (this.phone.busy()) {
      const leg = this.phone.focusedLeg() ?? this.phone.legs()[0];
      const allHeld =
        this.phone.mode() === 'conference' &&
        this.phone.legs().length > 0 &&
        this.phone.legs().every((l) => l.held);
      if (leg?.held || allHeld) return 'bg-warning';
      if (
        this.phone.callState() === 'active' ||
        this.phone.mode() === 'conference' ||
        this.phone.mode() === 'consult'
      ) {
        const level = this.phone.quality()?.level ?? 'measuring';
        if (level === 'good') return 'bg-success';
        if (level === 'fair') return 'bg-warning';
        if (level === 'poor') return 'bg-danger';
        return 'bg-status-none';
      }
      return 'bg-warning';
    }

    const conn = this.phone.connection();
    if (conn === 'registered') return 'bg-success';
    if (
      conn === 'connecting' ||
      conn === 'loading' ||
      conn === 'ready' ||
      this.phone.status().code === 'failingOver'
    ) {
      return 'bg-warning';
    }
    if (conn === 'error' || conn === 'offline') return 'bg-danger';
    return 'bg-status-none';
  });

  protected readonly showTimer = computed(() => {
    if (!this.phone.busy()) return false;
    return (
      this.phone.callState() === 'active' ||
      this.phone.mode() === 'consult' ||
      this.phone.mode() === 'conference'
    );
  });

  protected readonly formattedTimer = computed(() => this.formatDuration(this.phone.timer()));

  protected readonly stateText = computed(() => {
    this.i18n();
    const ringing = this.phone.ringing();
    if (ringing) {
      const incoming = this.transloco.translate('webPhone.status.incomingCall');
      return `${incoming} · ${ringing.displayName || ringing.number}`;
    }

    if (this.phone.busy()) {
      if (this.phone.mode() === 'conference') {
        return this.transloco.translate('webPhone.conference.header', { n: this.phone.legs().length + 1 });
      }
      const peer = this.activePeer();
      if (peer) {
        return `${this.callStatePrefix()} · ${peer.name}`;
      }
      const state = this.phone.callState();
      if (state === 'calling') return this.transloco.translate('webPhone.inCall.calling');
      if (state === 'ringing') return this.transloco.translate('webPhone.inCall.ringing');
      const inCall = this.transloco.translate('webPhone.status.inCall');
      const leg = this.phone.focusedLeg() ?? this.phone.legs()[0];
      if (leg?.held) {
        return `${inCall} · ${this.transloco.translate('webPhone.inCall.onHold')}`;
      }
      return inCall;
    }

    const ended = this.endedInfo();
    if (ended) {
      return `${this.endedPrefix(ended)} · ${this.formatDuration(ended.durationSeconds)}`;
    }

    const code = this.phone.status().code;
    const conn = this.phone.connection();
    const srv = this.phone.server();
    if (code === 'failingOver' || (conn === 'connecting' && srv.index > 1)) {
      return this.transloco.translate('webPhone.statusLine.server', srv);
    }
    if (conn === 'connecting' || conn === 'loading' || conn === 'ready') {
      return this.transloco.translate('webPhone.statusLine.connecting');
    }
    return this.transloco.translate(`webPhone.status.${code}`);
  });

  protected endedPrefix(ended: EndedInfo): string {
    this.i18n();
    const reason =
      ended.reason === 'transferred' && ended.transferredTo
        ? this.transloco.translate('webPhone.ended.reasons.transferredTo', { name: ended.transferredTo })
        : this.transloco.translate(`webPhone.ended.reasons.${ended.reason}`);
    if (SELF_NAMED_END_REASONS.has(ended.reason)) {
      return reason;
    }
    const callEnded = this.transloco.translate('webPhone.ended.reasons.ended');
    return `${callEnded} · ${reason}`;
  }

  protected endedTooltip(ended: EndedInfo): string {
    this.i18n();
    const peer = ended.name || ended.number;
    const base = `${peer} · ${this.endedPrefix(ended)} · ${this.formatDuration(ended.durationSeconds)}`;
    if (ended.logged && ended.source) {
      const typeLabel = this.transloco.translate(`webPhone.source.${ended.source.type}`);
      const logged = this.transloco.translate('webPhone.ended.loggedTo', {
        type: typeLabel,
        name: ended.source.label,
      });
      return `${base} · ${logged}`;
    }
    return base;
  }

  protected formatDuration(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds));
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const mm = String(mins).padStart(2, '0');
    const ss = String(secs).padStart(2, '0');
    return hrs > 0 ? `${hrs}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  protected redial(ended: EndedInfo): void {
    void this.phone.call(ended.number, ended.source);
  }

  protected toggleTooltip(event: Event): void {
    event.stopPropagation();
    if (this.tooltipDismissed()) {
      this.tooltipDismissed.set(false);
      this.tooltipOpen.set(true);
      return;
    }
    this.tooltipOpen.update((open) => !open);
  }

  protected onTooltipMouseEnter(): void {
    this.tooltipHovered.set(true);
  }

  protected onTooltipMouseLeave(): void {
    this.tooltipHovered.set(false);
    this.tooltipOpen.set(false);
    if (!this.tooltipFocused()) {
      this.tooltipDismissed.set(false);
    }
  }

  protected onTooltipFocusIn(): void {
    this.tooltipFocused.set(true);
  }

  protected onTooltipFocusOut(): void {
    this.tooltipFocused.set(false);
    this.tooltipOpen.set(false);
    if (!this.tooltipHovered()) {
      this.tooltipDismissed.set(false);
    }
  }

  protected onTooltipEscape(event: Event): void {
    if (!this.tooltipVisible()) return;
    event.stopPropagation();
    this.tooltipOpen.set(false);
    this.tooltipDismissed.set(true);
  }

  protected onDocumentClick(event: Event): void {
    if (!this.tooltipOpen()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.tooltipOpen.set(false);
    }
  }
}
