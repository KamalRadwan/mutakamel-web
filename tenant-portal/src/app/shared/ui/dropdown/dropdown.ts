import { Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, inject, input, model, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCheck, tablerChevronDown } from '@ng-icons/tabler-icons';
import { rectInPage, viewport } from '../overlay/zoom';

export type DropdownTone = 'surface' | 'nav';
export type DropdownSize = 'button' | 'field';

export interface DropdownOption<T> {
  value: T;
  label: string;
  disabled?: boolean;
  /** Optional description: shown as a tooltip on hover/focus and exposed to screen readers via aria-describedby. */
  title?: string;
}

let nextDropdownId = 0;
const TIP_GAP = 6;
const TIP_EDGE = 8;

interface ListPlace {
  top: number;
  start: number;
  width: number;
  maxHeight: number | null;
}

@Component({
  selector: 'ui-dropdown',
  imports: [NgIcon],
  providers: [provideIcons({ tablerCheck, tablerChevronDown })],
  templateUrl: './dropdown.html',
  host: {
    class: 'relative inline-flex',
    '(document:click)': 'closeIfOutside($event)',
    '(window:resize)': 'close()',
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class Dropdown<T> {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly listRef = viewChild<ElementRef<HTMLElement>>('list');
  private listSeq = 0;

  readonly options = input.required<DropdownOption<T>[]>();
  readonly value = model.required<T>();
  readonly label = input.required<string>();
  readonly icon = input('');
  readonly tone = input<DropdownTone>('surface');
  readonly size = input<DropdownSize>('button');
  readonly id = input<string | null>(null);
  readonly describedBy = input<string | null>(null);
  readonly disabled = input(false);

  private readonly uid = `ui-dropdown-${++nextDropdownId}`;
  protected readonly tip = signal<{ text: string; top: number; start: number } | null>(null);
  protected readonly open = signal(false);
  protected readonly placed = signal(false);
  protected readonly place = signal<ListPlace>({ top: 0, start: 0, width: 0, maxHeight: null });
  protected readonly selected = computed(() => this.options().find((option) => option.value === this.value()));

  constructor() {
    const onScroll = (event: Event) => {
      if (!this.open()) return;
      const target = event.target;
      if (target instanceof Node && this.host.nativeElement.contains(target)) return;
      this.close();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', onScroll, { capture: true }));
  }

  protected toggle() {
    if (this.disabled()) return;
    if (this.open()) {
      this.close();
      return;
    }
    const seq = ++this.listSeq;
    this.placed.set(false);
    this.place.set(this.initialPlace());
    this.open.set(true);
    queueMicrotask(() => this.placeList(seq));
    afterNextRender(() => this.placeList(seq), { injector: this.injector });
  }

  protected descId(index: number): string {
    return `${this.uid}-opt-${index}-desc`;
  }

  protected showTip(option: DropdownOption<T>, target: EventTarget | null) {
    if (!option.title || !(target instanceof HTMLElement)) {
      this.tip.set(null);
      return;
    }
    const rect = rectInPage(target);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    const optionStart = rtl ? width - rect.right : rect.left;
    const optionEnd = rtl ? width - rect.left : rect.right;
    // Worst-case width: the tooltip is capped by max-w-modal-alert (the --modal-alert token).
    const cap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--modal-alert')) || 280;
    const estimate = Math.min(cap, width - TIP_EDGE * 2);
    let start = optionEnd + TIP_GAP;
    if (start + estimate > width - TIP_EDGE) {
      const alt = optionStart - TIP_GAP - estimate;
      start = alt >= TIP_EDGE ? alt : Math.max(TIP_EDGE, width - TIP_EDGE - estimate);
    }
    this.tip.set({ text: option.title, top: rect.top, start });
  }

  protected hideTip() {
    this.tip.set(null);
  }

  protected close() {
    this.tip.set(null);
    this.listSeq++;
    this.open.set(false);
    this.placed.set(false);
  }

  protected onEscape(event: Event) {
    if (!this.open()) return;
    event.preventDefault();
    event.stopPropagation();
    this.close();
    this.trigger().nativeElement.focus();
  }

  protected choose(option: DropdownOption<T>) {
    if (option.disabled) return;
    this.value.set(option.value);
    this.close();
    this.trigger().nativeElement.focus();
  }

  protected closeIfOutside(event: Event) {
    if (!this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  private initialPlace(): ListPlace {
    const rect = rectInPage(this.trigger().nativeElement);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
      width: rect.width,
      maxHeight: null,
    };
  }

  private placeList(seq: number) {
    if (seq !== this.listSeq || !this.open() || this.placed()) return;
    const listEl = this.listRef()?.nativeElement;
    if (!listEl) return;

    const rect = rectInPage(this.trigger().nativeElement);
    const listRect = rectInPage(listEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const spaceBelow = Math.max(8, height - 8 - belowTop);
    const spaceAbove = Math.max(8, rect.top - 12);
    const flipUp = listRect.height > spaceBelow && spaceAbove > spaceBelow;
    const avail = flipUp ? spaceAbove : spaceBelow;
    const maxHeight = listRect.height > avail ? avail : null;
    const finalHeight = maxHeight ?? listRect.height;
    const top = flipUp ? Math.max(8, rect.top - 4 - finalHeight) : belowTop;

    const triggerStart = rtl ? width - rect.right : rect.left;
    const triggerEnd = rtl ? width - rect.left : rect.right;
    const alignEnd = (this.size() === 'button' && triggerStart > width / 2) || triggerStart + listRect.width > width - 8;
    const rawStart = alignEnd ? triggerEnd - listRect.width : triggerStart;
    const start = Math.min(Math.max(8, rawStart), Math.max(8, width - 8 - listRect.width));

    this.place.set({ top, start, width: rect.width, maxHeight });
    this.placed.set(true);

    listEl.style.top = `${top}px`;
    listEl.style.insetInlineStart = `${start}px`;
    listEl.style.minWidth = `${rect.width}px`;
    listEl.style.maxHeight = maxHeight !== null ? `${maxHeight}px` : '';
    listEl.classList.remove('invisible');
  }
}
