import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, ElementRef, computed, inject, input, output, signal, viewChildren } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerLoader2,
  tablerTarget,
  tablerUser,
  tablerUserPlus,
  tablerUsers,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../core/i18n/language';
import { PhoneState } from '../../../core/phone/phone';

type CallLeg = ReturnType<PhoneState['legs']>[number];
type CallSource = NonNullable<CallLeg['source']>;

const SOURCE_LOOK: Record<CallSource['type'], { icon: string; tile: string }> = {
  LEAD: { icon: 'tablerUserPlus', tile: 'bg-icon-green' },
  CUSTOMER_PROFILE: { icon: 'tablerUsers', tile: 'bg-icon-blue' },
  OPPORTUNITY: { icon: 'tablerTarget', tile: 'bg-icon-red' },
  PARTY: { icon: 'tablerUser', tile: 'bg-icon-blue' },
};

@Component({
  selector: 'app-call-rows',
  imports: [TranslocoPipe, NgIcon],
  providers: [
    provideIcons({
      tablerLoader2,
      tablerTarget,
      tablerUser,
      tablerUserPlus,
      tablerUsers,
      tablerX,
    }),
  ],
  templateUrl: './call-rows.html',
})
export class CallRows {
  private readonly doc = inject(DOCUMENT);
  private readonly language = inject(LanguageState, { optional: true });
  private readonly radioButtons = viewChildren<ElementRef<HTMLButtonElement>>('radioBtn');

  readonly legs = input.required<readonly CallLeg[]>();
  readonly focusedId = input<string | null>(null);
  readonly removable = input(false);
  readonly focusable = input(true);

  readonly focus = output<string>();
  readonly remove = output<string>();

  protected readonly activeIndex = computed(() => {
    const list = this.legs();
    if (list.length === 0) return -1;
    const id = this.focusedId();
    const idx = id ? list.findIndex((l) => l.id === id) : -1;
    return idx >= 0 ? idx : 0;
  });

  private readonly now = signal(Date.now());

  constructor() {
    const id = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  protected lookOf(leg: CallLeg): { icon: string; tile: string } {
    return leg.source ? SOURCE_LOOK[leg.source.type] : { icon: 'tablerUser', tile: 'bg-icon-blue' };
  }

  protected badgeKind(leg: CallLeg): 'left' | 'onHold' | 'ringing' | 'talking' {
    if (leg.state === 'ended' || leg.state === 'failed') return 'left';
    if (leg.held) return 'onHold';
    if (leg.state === 'calling' || leg.state === 'ringing' || leg.state === 'incoming') return 'ringing';
    return 'talking';
  }

  protected isRinging(leg: CallLeg): boolean {
    return leg.state === 'calling' || leg.state === 'ringing' || leg.state === 'incoming';
  }

  protected legDuration(leg: CallLeg): string {
    if (!leg.answeredAt) return '';
    const started = Date.parse(leg.answeredAt);
    if (Number.isNaN(started)) return '';
    const total = Math.max(0, Math.floor((this.now() - started) / 1000));
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const mm = String(mins).padStart(2, '0');
    const ss = String(secs).padStart(2, '0');
    return hrs > 0 ? `${hrs}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  protected onFocusRow(legId: string): void {
    if (this.focusable()) this.focus.emit(legId);
  }

  protected onRadioKeydown(event: KeyboardEvent, index: number): void {
    if (!this.focusable()) return;
    const list = this.legs();
    if (list.length === 0) return;

    const dir = this.doc.documentElement.dir;
    const rtl = dir ? dir === 'rtl' : this.language?.current() === 'ar';
    const nextArrow = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevArrow = rtl ? 'ArrowRight' : 'ArrowLeft';

    let nextIndex = -1;
    if (event.key === 'ArrowDown' || event.key === nextArrow) {
      nextIndex = (index + 1) % list.length;
    } else if (event.key === 'ArrowUp' || event.key === prevArrow) {
      nextIndex = (index - 1 + list.length) % list.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = list.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    this.onFocusRow(list[nextIndex].id);
    this.radioButtons()[nextIndex]?.nativeElement.focus();
  }

  protected onRemove(event: Event, legId: string): void {
    event.stopPropagation();
    this.remove.emit(legId);
  }
}
