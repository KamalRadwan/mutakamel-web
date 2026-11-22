import { Component, ElementRef, computed, inject, input, model, signal, viewChild, viewChildren } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerExclamationCircle } from '@ng-icons/tabler-icons';
import { rectInPage, viewport } from '../overlay/zoom';

let nextStepFilterId = 0;

export interface StepOption {
  id: string;
  label: string;
  count?: number | null;
  /** Colour family of the step; brand when absent. */
  tone?: StepTone;
}

export type StepTone = 'brand' | 'danger' | 'success';

const TONES: Record<StepTone, { on: string; off: string; count: string }> = {
  brand: { on: 'bg-brand text-on-brand', off: 'bg-brand-soft text-on-brand-soft hover:bg-brand hover:text-on-brand', count: 'bg-on-brand text-brand' },
  danger: { on: 'bg-danger text-on-danger', off: 'bg-danger-soft text-on-danger-soft hover:bg-danger hover:text-on-danger', count: 'bg-on-danger text-danger' },
  success: { on: 'bg-success text-on-success', off: 'bg-success-soft text-on-success-soft hover:bg-success hover:text-on-success', count: 'bg-on-success text-success' },
};

@Component({
  selector: 'ui-step-filter',
  imports: [NgIcon],
  providers: [provideIcons({ tablerExclamationCircle })],
  templateUrl: './step-filter.html',
  host: {
    role: 'radiogroup',
    '[attr.aria-label]': 'label() || null',
    class: 'no-scrollbar block max-w-full shrink-0 overflow-x-auto',
  },
})
export class StepFilter {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('stepBtn');

  readonly steps = input.required<readonly StepOption[]>();
  readonly label = input('');
  /** Optional "!" hint text, shown on hover/focus of the hint button and linked to every step via aria-describedby. */
  readonly hint = input('');
  readonly value = model<string>('');

  private readonly tooltipRef = viewChild<ElementRef<HTMLElement>>('tooltip');
  protected readonly hintId = `ui-step-filter-${++nextStepFilterId}-hint`;
  protected readonly tooltipPlace = signal({ top: 0, start: 0 });
  protected readonly tipPlaced = signal(false);
  private hintHovered = false;
  private hintFocused = false;

  protected onHintHover(triggerEl: HTMLElement, on: boolean) {
    this.hintHovered = on;
    this.syncHint(triggerEl);
  }

  protected onHintFocus(triggerEl: HTMLElement, on: boolean) {
    this.hintFocused = on;
    this.syncHint(triggerEl);
  }

  // WCAG 1.4.13: dismissible without moving pointer or focus. Only swallow Escape while the hint is open.
  protected onHintEscape(event: Event) {
    if (!this.tipPlaced()) return;
    event.stopPropagation();
    this.tipPlaced.set(false);
  }

  private syncHint(triggerEl: HTMLElement) {
    if (!this.hintHovered && !this.hintFocused) {
      this.tipPlaced.set(false);
      return;
    }
    const rect = rectInPage(triggerEl);
    const tipEl = this.tooltipRef()?.nativeElement;
    const tip = tipEl ? rectInPage(tipEl) : { width: 280, height: 20 };
    const { width } = viewport();
    const rtl = this.isRtl();
    let start = (rtl ? width - rect.left : rect.right) + 6;
    if (start + tip.width > width - 8) {
      const altStart = (rtl ? width - rect.right : rect.left) - 6 - tip.width;
      start = altStart >= 8 ? altStart : Math.max(8, width - 8 - tip.width);
    }
    const top = Math.max(8, rect.top + rect.height / 2 - tip.height / 2);
    this.tooltipPlace.set({ top, start });
    this.tipPlaced.set(true);
  }

  protected tone(step: StepOption) {
    return TONES[step.tone ?? 'brand'];
  }

  protected readonly activeIndex = computed(() => {
    const index = this.steps().findIndex((step) => step.id === this.value());
    return index >= 0 ? index : 0;
  });

  protected onKeydown(event: KeyboardEvent, index: number) {
    const items = this.steps();
    if (!items.length) return;

    const rtl = this.isRtl();
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    let target = -1;

    if (event.key === nextKey || event.key === 'ArrowDown') {
      target = (index + 1) % items.length;
    } else if (event.key === prevKey || event.key === 'ArrowUp') {
      target = (index - 1 + items.length) % items.length;
    } else if (event.key === 'Home') {
      target = 0;
    } else if (event.key === 'End') {
      target = items.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    this.value.set(items[target].id);
    this.buttons()[target]?.nativeElement.focus();
  }

  private isRtl(): boolean {
    const element = this.host.nativeElement;
    const dir = element.closest('[dir]')?.getAttribute('dir')?.toLowerCase();
    if (dir === 'rtl' || dir === 'ltr') return dir === 'rtl';
    return getComputedStyle(element).direction === 'rtl';
  }
}
