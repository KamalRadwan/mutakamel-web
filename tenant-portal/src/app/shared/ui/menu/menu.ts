import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, ElementRef, Injector, afterNextRender, inject, input, output, signal, viewChild, viewChildren } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCheck, tablerChevronDown, tablerChevronLeft, tablerChevronRight } from '@ng-icons/tabler-icons';
import { rectInPage, viewport } from '../overlay/zoom';

export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  tile?: string;
  selected?: boolean;
  danger?: boolean;
  divider?: boolean;
  children?: MenuItem[];
}

interface Place {
  top: number;
  start: number | null;
  end: number | null;
  minWidth: number;
}

interface SubmenuPlace {
  top: number;
  start: number;
}

/** The list is fixed to the viewport so scrolling containers (board columns, tables) never clip it. */
@Component({
  selector: 'ui-menu',
  imports: [NgIcon, NgTemplateOutlet],
  providers: [provideIcons({ tablerCheck, tablerChevronDown, tablerChevronLeft, tablerChevronRight })],
  templateUrl: './menu.html',
  host: {
    class: 'relative inline-flex',
    '(document:click)': 'closeIfOutside($event)',
    '(window:resize)': 'close()',
    '(keydown)': 'onKeydown($event)',
  },
})
export class Menu {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly mainRows = viewChildren<ElementRef<HTMLButtonElement>>('mainRow');
  private readonly submenuRef = viewChild<ElementRef<HTMLElement>>('submenu');
  private submenuSeq = 0;

  readonly items = input.required<MenuItem[]>();
  readonly label = input.required<string>();
  readonly glass = input(false);
  readonly align = input<'start' | 'end'>('start');
  readonly variant = input<'nav' | 'icon'>('nav');
  readonly selected = output<string>();

  protected readonly open = signal(false);
  protected readonly place = signal<Place>({ top: 0, start: 0, end: null, minWidth: 0 });
  protected readonly activeSubmenuId = signal<string | null>(null);
  protected readonly submenuPlaced = signal(false);
  protected readonly submenuPlace = signal<SubmenuPlace>({ top: 0, start: 0 });
  protected readonly submenuSides = signal<Record<string, 'start' | 'end'>>({});

  constructor() {
    const close = () => this.close();
    document.addEventListener('scroll', close, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', close, { capture: true }));
  }

  protected toggle() {
    if (this.open()) {
      this.close();
      return;
    }
    this.clearSubmenu();
    this.submenuSides.set({});
    this.place.set(this.measure());
    this.open.set(true);
    this.afterRender(() => this.focusFirstRow());
  }

  protected close() {
    this.open.set(false);
    this.clearSubmenu();
  }

  protected hasChildren(item: MenuItem): boolean {
    return !!item.children?.length;
  }

  protected sideFor(id: string): 'start' | 'end' {
    return this.submenuSides()[id] ?? 'start';
  }

  protected rowClass(item: MenuItem, active = false): string {
    if (item.selected) return 'bg-brand-soft text-on-brand-soft';
    if (item.danger) return 'text-danger-text hover:bg-row-hover';
    return active ? 'bg-row-hover text-text' : 'text-text hover:bg-row-hover';
  }

  protected onRowEnter(item: MenuItem) {
    if (!this.hasChildren(item)) {
      this.clearSubmenu();
      return;
    }
    if (this.activeSubmenuId() === item.id) return;
    this.openSubmenu(item.id, false);
  }

  protected onRowClick(item: MenuItem) {
    if (this.hasChildren(item)) {
      if (this.activeSubmenuId() === item.id && this.submenuPlaced()) {
        this.focusFirstSubmenuItem();
        return;
      }
      this.openSubmenu(item.id, true);
      return;
    }
    this.choose(item.id);
  }

  protected choose(id: string) {
    this.close();
    this.selected.emit(id);
  }

  protected closeIfOutside(event: Event) {
    if (!this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  protected onKeydown(event: KeyboardEvent) {
    if (!this.open()) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;

    if (event.key === 'Tab') {
      this.trigger()?.nativeElement.focus();
      this.close();
      return;
    }

    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    const openKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const closeKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      const submenuId = this.activeSubmenuId();
      if (submenuId !== null) {
        this.closeSubmenuAndFocusRow(submenuId);
        return;
      }
      this.close();
      this.trigger()?.nativeElement.focus();
      return;
    }

    const submenuEl = this.submenuRef()?.nativeElement;
    if (submenuEl?.contains(target)) {
      if (event.key === closeKey) {
        event.preventDefault();
        event.stopPropagation();
        const submenuId = this.activeSubmenuId();
        if (submenuId !== null) this.closeSubmenuAndFocusRow(submenuId);
        return;
      }
      this.handleSubmenuKeydown(event, submenuEl, target);
      return;
    }

    const rows = this.mainRows();
    const index = rows.findIndex((row) => row.nativeElement === target);
    if (index < 0) {
      if (target === this.trigger()?.nativeElement) {
        if (event.key === 'ArrowDown' || event.key === 'Home') {
          event.preventDefault();
          rows[0]?.nativeElement.focus();
        } else if (event.key === 'ArrowUp' || event.key === 'End') {
          event.preventDefault();
          rows[rows.length - 1]?.nativeElement.focus();
        }
      }
      return;
    }

    const item = this.items()[index];
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.clearSubmenu();
      rows[(index + 1) % rows.length]?.nativeElement.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.clearSubmenu();
      rows[(index - 1 + rows.length) % rows.length]?.nativeElement.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.clearSubmenu();
      rows[0]?.nativeElement.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      this.clearSubmenu();
      rows[rows.length - 1]?.nativeElement.focus();
    } else if (event.key === openKey) {
      if (!item || !this.hasChildren(item)) return;
      event.preventDefault();
      if (this.activeSubmenuId() === item.id && this.submenuPlaced()) {
        this.focusFirstSubmenuItem();
      } else {
        this.openSubmenu(item.id, true);
      }
    } else if (event.key === closeKey) {
      const submenuId = this.activeSubmenuId();
      if (submenuId !== null) {
        event.preventDefault();
        this.closeSubmenuAndFocusRow(submenuId);
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (item) this.onRowClick(item);
    }
  }

  private handleSubmenuKeydown(event: KeyboardEvent, submenuEl: HTMLElement, target: HTMLElement) {
    const buttons = Array.from(submenuEl.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    if (!buttons.length) return;
    const index = buttons.indexOf(target as HTMLButtonElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      buttons[(index + 1) % buttons.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      buttons[index <= 0 ? buttons.length - 1 : index - 1]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      buttons[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      buttons[buttons.length - 1]?.focus();
    } else if ((event.key === 'Enter' || event.key === ' ') && target instanceof HTMLButtonElement && !target.disabled) {
      event.preventDefault();
      target.click();
    }
  }

  private closeSubmenuAndFocusRow(id: string) {
    this.clearSubmenu();
    const index = this.items().findIndex((item) => item.id === id);
    if (index >= 0) this.mainRows()[index]?.nativeElement.focus();
  }

  private focusFirstRow() {
    if (!this.open()) return;
    const rows = this.mainRows();
    if (!rows.length || rows.some((row) => row.nativeElement === document.activeElement)) return;
    rows[0]?.nativeElement.focus();
  }

  private focusFirstSubmenuItem() {
    const submenuEl = this.submenuRef()?.nativeElement;
    submenuEl?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }

  private openSubmenu(id: string, focusFirst: boolean) {
    const seq = ++this.submenuSeq;
    this.submenuPlaced.set(false);
    this.submenuPlace.set({ top: 0, start: 0 });
    this.activeSubmenuId.set(id);
    this.afterRender(() => this.placeSubmenu(id, focusFirst, seq));
  }

  private clearSubmenu() {
    this.submenuSeq++;
    this.activeSubmenuId.set(null);
    this.submenuPlaced.set(false);
    this.submenuPlace.set({ top: 0, start: 0 });
  }

  private afterRender(fn: () => void) {
    queueMicrotask(fn);
    afterNextRender(fn, { injector: this.injector });
  }

  private measure(): Place {
    const element = this.host.nativeElement;
    const rect = rectInPage(element);
    const { width } = viewport();
    const rtl = getComputedStyle(element).direction === 'rtl';
    const fromStart = rtl ? width - rect.right : rect.left;
    const fromEnd = rtl ? rect.left : width - rect.right;
    const atEnd = this.align() === 'end';
    return { top: rect.bottom + 4, start: atEnd ? null : fromStart, end: atEnd ? fromEnd : null, minWidth: rect.width };
  }

  private placeSubmenu(id: string, focusFirst: boolean, seq: number) {
    if (seq !== this.submenuSeq || !this.open() || this.activeSubmenuId() !== id || this.submenuPlaced()) return;
    const index = this.items().findIndex((item) => item.id === id);
    const rowEl = index >= 0 ? this.mainRows()[index]?.nativeElement : undefined;
    const submenuEl = this.submenuRef()?.nativeElement;
    if (!rowEl || !submenuEl || submenuEl.parentElement !== rowEl.parentElement) return;

    const rowRect = rectInPage(rowEl);
    const subRect = rectInPage(submenuEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const rowStart = rtl ? width - rowRect.right : rowRect.left;
    const rowEnd = rowStart + rowRect.width;
    const overflowsStart = rowStart - 4 - subRect.width < 8;
    const side: 'start' | 'end' = overflowsStart ? 'end' : 'start';
    const rawStart = side === 'start' ? rowStart - 4 - subRect.width : rowEnd + 4;
    const maxStart = Math.max(8, width - 8 - subRect.width);
    const start = Math.min(Math.max(8, rawStart), maxStart);
    const maxTop = Math.max(8, height - 8 - subRect.height);
    const top = Math.min(Math.max(8, rowRect.top), maxTop);

    this.submenuSides.update((sides) => ({ ...sides, [id]: side }));
    this.submenuPlace.set({ top, start });
    this.submenuPlaced.set(true);

    submenuEl.style.top = `${top}px`;
    submenuEl.style.insetInlineStart = `${start}px`;
    submenuEl.classList.remove('invisible');

    if (focusFirst) this.focusFirstSubmenuItem();
  }
}
