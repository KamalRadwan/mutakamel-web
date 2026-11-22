import { Component, ElementRef, computed, inject, input, model, signal, viewChildren } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerStar } from '@ng-icons/tabler-icons';
import { tablerStarFill } from '@ng-icons/tabler-icons/fill';
import { TranslocoPipe } from '@jsverse/transloco';
import { QueryField, Value } from '../../../../query-builder/query.model';

const RATINGS = [0, 1, 2, 3] as const;
const STARS = [1, 2, 3] as const;

@Component({
  selector: 'ui-query-rating-input',
  imports: [NgIcon, TranslocoPipe],
  providers: [provideIcons({ tablerStar, tablerStarFill })],
  templateUrl: './rating-input.html',
  host: { class: 'block w-full min-w-0' },
})
export class QueryRatingInput {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly singleButtons = viewChildren<ElementRef<HTMLButtonElement>>('singleBtn');
  private readonly fromButtons = viewChildren<ElementRef<HTMLButtonElement>>('fromBtn');
  private readonly toButtons = viewChildren<ElementRef<HTMLButtonElement>>('toBtn');

  readonly field = input.required<QueryField>();
  readonly mode = input.required<'single' | 'range' | 'list'>();
  readonly invalid = input(false);
  readonly disabled = input(false);
  readonly describedBy = input<string | null>(null);
  readonly value = model<Value | undefined>(undefined);

  protected readonly ratings = RATINGS;
  protected readonly stars = STARS;

  protected readonly hoverSingle = signal<number | null>(null);
  protected readonly hoverFrom = signal<number | null>(null);
  protected readonly hoverTo = signal<number | null>(null);

  protected readonly singleValue = computed<number | null>(() => {
    const val = this.value();
    return typeof val === 'number' && Number.isFinite(val) ? val : null;
  });

  protected readonly rangeFrom = computed<number | null>(() => {
    const val = this.value();
    if (!Array.isArray(val) || val.length !== 2) return null;
    const first = val[0];
    return typeof first === 'number' && Number.isFinite(first) ? first : null;
  });

  protected readonly rangeTo = computed<number | null>(() => {
    const val = this.value();
    if (!Array.isArray(val) || val.length !== 2) return null;
    const second = val[1];
    return typeof second === 'number' && Number.isFinite(second) ? second : null;
  });

  protected readonly listValues = computed<number[]>(() => {
    const val = this.value();
    if (!Array.isArray(val)) return [];
    return val.filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
  });

  protected readonly groupBoxClasses = computed(() => {
    const base = 'inline-flex min-h-field items-center gap-2 rounded-8 border px-4 text-12 transition-colors duration-fast';
    if (this.disabled()) return `${base} cursor-not-allowed border-transparent bg-neutral-soft text-text-placeholder`;
    if (this.invalid()) return `${base} border-danger-border bg-surface-field ring-2 ring-danger-halo`;
    return `${base} border-border-field bg-surface-field`;
  });

  protected singleDisplay(current: number | null, hovered: number | null): number | null {
    return hovered !== null ? hovered : current;
  }

  protected isStarActive(star: number, current: number | null, hovered: number | null): boolean {
    const active = this.singleDisplay(current, hovered);
    return active !== null && active > 0 && star <= active;
  }

  protected selectSingle(rating: number): void {
    if (this.disabled()) return;
    this.hoverSingle.set(null);
    this.value.set(rating);
  }

  protected selectRangePart(part: 'from' | 'to', rating: number): void {
    if (this.disabled()) return;
    if (part === 'from') {
      this.hoverFrom.set(null);
      const nextTo = this.rangeTo();
      this.value.set([rating, nextTo ?? Number.NaN]);
    } else {
      this.hoverTo.set(null);
      const nextFrom = this.rangeFrom();
      this.value.set([nextFrom ?? Number.NaN, rating]);
    }
  }

  protected toggleList(rating: number): void {
    if (this.disabled()) return;
    const current = this.listValues();
    const exists = current.includes(rating);
    const next = exists ? current.filter((item) => item !== rating) : [...current, rating].sort((a, b) => a - b);
    this.value.set(next);
  }

  protected onRadioKeydown(event: KeyboardEvent, index: number, target: 'single' | 'from' | 'to'): void {
    if (this.disabled()) return;
    const rtl = this.isRtl();
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    let nextIndex = -1;
    if (event.key === nextKey || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % RATINGS.length;
    } else if (event.key === prevKey || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + RATINGS.length) % RATINGS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = RATINGS.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextValue = RATINGS[nextIndex];
    if (target === 'single') {
      this.selectSingle(nextValue);
      this.singleButtons()[nextIndex]?.nativeElement.focus();
    } else if (target === 'from') {
      this.selectRangePart('from', nextValue);
      this.fromButtons()[nextIndex]?.nativeElement.focus();
    } else {
      this.selectRangePart('to', nextValue);
      this.toButtons()[nextIndex]?.nativeElement.focus();
    }
  }

  protected tabIndexFor(current: number | null, rating: number): number {
    if (current === null) return rating === 0 ? 0 : -1;
    return current === rating ? 0 : -1;
  }

  private isRtl(): boolean {
    return getComputedStyle(this.host.nativeElement).direction === 'rtl';
  }
}
