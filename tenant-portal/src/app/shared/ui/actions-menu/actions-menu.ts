import { Component, DestroyRef, ElementRef, Injector, afterNextRender, inject, input, output, signal, viewChild, viewChildren } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAdjustmentsHorizontal,
  tablerArchive,
  tablerArrowBackUp,
  tablerArrowRight,
  tablerArrowsExchange,
  tablerArrowsRightLeft,
  tablerCheck,
  tablerChevronLeft,
  tablerChevronRight,
  tablerCircleOff,
  tablerCopy,
  tablerDeviceFloppy,
  tablerDots,
  tablerDownload,
  tablerEdit,
  tablerEye,
  tablerEyeOff,
  tablerFileExport,
  tablerFileImport,
  tablerLink,
  tablerLock,
  tablerPalette,
  tablerPaperclip,
  tablerPlus,
  tablerPrinter,
  tablerRefresh,
  tablerSend,
  tablerShare,
  tablerStar,
  tablerTrash,
  tablerUpload,
  tablerX,
} from '@ng-icons/tabler-icons';
import { rectInPage, viewport } from '../overlay/zoom';

export interface ActionItem {
  id: string;
  title: string;
  icon: string;
  tile: string;
  danger?: boolean;
  disabled?: boolean;
  reason?: string;
  choices?: ActionChoice[];
  swatches?: ActionSwatch[];
}

export interface ActionChoice {
  id: string;
  label: string;
  selected?: boolean;
}

export interface ActionSwatch {
  id: string | null;
  label: string;
  color: string | null;
  selected?: boolean;
}

export interface ActionSelection {
  id: string;
  value?: string | null;
}

interface Place {
  top: number;
  end: number;
}

/** Fixed-position actions menu with inline-start submenus so scrolling containers never clip it. */
let nextActionsMenuId = 0;

@Component({
  selector: 'ui-actions-menu',
  imports: [NgIcon],
  providers: [
    provideIcons({
      tablerAdjustmentsHorizontal,
      tablerDots,
      tablerChevronLeft,
      tablerChevronRight,
      tablerCheck,
      tablerCircleOff,
      tablerEye,
      tablerPlus,
      tablerEdit,
      tablerTrash,
      tablerDeviceFloppy,
      tablerCopy,
      tablerPrinter,
      tablerDownload,
      tablerUpload,
      tablerFileExport,
      tablerFileImport,
      tablerShare,
      tablerSend,
      tablerStar,
      tablerArchive,
      tablerRefresh,
      tablerArrowBackUp,
      tablerX,
      tablerPaperclip,
      tablerLink,
      tablerLock,
      tablerEyeOff,
      tablerPalette,
      tablerArrowsExchange,
      tablerArrowsRightLeft,
      tablerArrowRight,
    }),
  ],
  templateUrl: './actions-menu.html',
  host: {
    class: 'relative inline-flex',
    '(document:click)': 'closeIfOutside($event)',
    '(window:resize)': 'close()',
    '(keydown)': 'onKeydown($event)',
  },
})
export class ActionsMenu {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly mainRows = viewChildren<ElementRef<HTMLButtonElement>>('mainRow');
  private readonly submenuRef = viewChild<ElementRef<HTMLElement>>('submenu');
  private fromKeyboard = false;
  private panelSeq = 0;
  private submenuSeq = 0;

  readonly items = input.required<ActionItem[]>();
  readonly label = input.required<string>();
  readonly noColorLabel = input('');
  readonly selected = output<ActionSelection>();

  private readonly uid = `ui-actions-menu-${++nextActionsMenuId}`;
  protected readonly reasonTip = signal<{ text: string; top: number; start: number } | null>(null);
  protected readonly open = signal(false);
  protected readonly panelPlaced = signal(false);
  protected readonly activeSubmenuId = signal<string | null>(null);
  protected readonly submenuPlaced = signal(false);
  protected readonly submenuTop = signal(0);
  protected readonly defaultSubmenuSide = signal<'start' | 'end'>('start');
  protected readonly submenuSides = signal<Record<string, 'start' | 'end'>>({});
  protected readonly place = signal<Place>({ top: 0, end: 0 });

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
    const seq = ++this.panelSeq;
    this.panelPlaced.set(false);
    this.clearSubmenu();
    this.defaultSubmenuSide.set('start');
    this.submenuSides.set({});
    this.place.set(this.initialPlace());
    this.open.set(true);
    this.afterRender(() => this.placePanel(seq));
  }

  protected reasonId(item: ActionItem): string {
    return `${this.uid}-${item.id}-reason`;
  }

  /** Disabled rows stay focusable (aria-disabled) so their reason shows on hover and on keyboard focus. */
  protected showReason(item: ActionItem, target: EventTarget | null) {
    if (!item.reason || !(target instanceof HTMLElement)) {
      this.reasonTip.set(null);
      return;
    }
    const rect = rectInPage(target);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    const rowStart = rtl ? width - rect.right : rect.left;
    const rowEnd = rtl ? width - rect.left : rect.right;
    const cap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--modal-alert')) || 280;
    const estimate = Math.min(cap, width - 16);
    // The panel opens toward the inline end, so the reason prefers the inline-start side.
    let start = rowStart - 6 - estimate;
    if (start < 8) {
      const alt = rowEnd + 6;
      start = alt + estimate <= width - 8 ? alt : Math.max(8, width - 8 - estimate);
    }
    this.reasonTip.set({ text: item.reason, top: rect.top, start });
  }

  protected hideReason() {
    this.reasonTip.set(null);
  }

  protected close() {
    this.reasonTip.set(null);
    this.panelSeq++;
    this.open.set(false);
    this.panelPlaced.set(false);
    this.clearSubmenu();
  }

  protected closeIfOutside(event: Event) {
    if (!this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  protected hasSubmenu(item: ActionItem): boolean {
    return !item.disabled && !!(item.choices?.length || item.swatches?.length);
  }

  protected sideFor(id: string): 'start' | 'end' {
    return this.submenuSides()[id] ?? this.defaultSubmenuSide();
  }

  protected colorSwatches(swatches: ActionSwatch[]): ActionSwatch[] {
    return swatches.filter((swatch) => swatch.id !== null && swatch.color !== null);
  }

  protected noColorText(item: ActionItem): string {
    return this.noColorSwatch(item.swatches ?? [])?.label || this.noColorLabel();
  }

  protected isNoColorSelected(item: ActionItem): boolean {
    return this.noColorSwatch(item.swatches ?? [])?.selected ?? false;
  }

  protected onRowEnter(item: ActionItem) {
    if (item.disabled || !this.hasSubmenu(item)) {
      this.clearSubmenu();
      return;
    }
    if (this.activeSubmenuId() === item.id) return;
    this.openSubmenu(item.id, false);
  }

  protected onRowClick(item: ActionItem, viaKeyboard = false) {
    if (item.disabled) return;
    if (this.hasSubmenu(item)) {
      if (this.activeSubmenuId() === item.id && this.submenuPlaced()) {
        this.focusFirstSubmenuItem();
        return;
      }
      this.openSubmenu(item.id, true);
      return;
    }
    this.close();
    if (viaKeyboard) this.trigger().nativeElement.focus();
    this.selected.emit({ id: item.id });
  }

  protected chooseSubmenu(id: string, value: string | null) {
    const restoreFocus = this.fromKeyboard;
    this.close();
    if (restoreFocus) this.trigger().nativeElement.focus();
    this.selected.emit({ id, value });
  }

  protected onKeydown(event: KeyboardEvent) {
    if (!this.open()) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      const submenuId = this.activeSubmenuId();
      if (submenuId !== null) {
        this.clearSubmenu();
        const index = this.items().findIndex((item) => item.id === submenuId);
        if (index >= 0) this.mainRows()[index]?.nativeElement.focus();
        return;
      }
      this.close();
      this.trigger().nativeElement.focus();
      return;
    }

    const submenuEl = this.submenuRef()?.nativeElement;
    if (submenuEl?.contains(target)) {
      this.handleSubmenuKeydown(event, submenuEl, target);
      return;
    }

    const rows = this.mainRows();
    const index = rows.findIndex((row) => row.nativeElement === target);
    if (index < 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.clearSubmenu();
      rows[(index + 1) % rows.length]?.nativeElement.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.clearSubmenu();
      rows[(index - 1 + rows.length) % rows.length]?.nativeElement.focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const item = this.items()[index];
      if (item) this.onRowClick(item, true);
    }
  }

  private handleSubmenuKeydown(event: KeyboardEvent, submenuEl: HTMLElement, target: HTMLElement) {
    const buttons = Array.from(submenuEl.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    if (!buttons.length) return;
    const index = buttons.indexOf(target as HTMLButtonElement);

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      buttons[(index + 1) % buttons.length]?.focus();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
    } else if ((event.key === 'Enter' || event.key === ' ') && target instanceof HTMLButtonElement && !target.disabled) {
      event.preventDefault();
      try {
        this.fromKeyboard = true;
        target.click();
      } finally {
        this.fromKeyboard = false;
      }
    }
  }

  private focusFirstSubmenuItem() {
    const submenuEl = this.submenuRef()?.nativeElement;
    submenuEl?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }

  private noColorSwatch(swatches: ActionSwatch[]): ActionSwatch | undefined {
    return swatches.find((swatch) => swatch.id === null);
  }

  private openSubmenu(id: string, focusFirst: boolean) {
    const seq = ++this.submenuSeq;
    this.submenuPlaced.set(false);
    this.submenuTop.set(0);
    this.activeSubmenuId.set(id);
    this.afterRender(() => this.placeSubmenu(id, focusFirst, seq));
  }

  private clearSubmenu() {
    this.submenuSeq++;
    this.activeSubmenuId.set(null);
    this.submenuPlaced.set(false);
    this.submenuTop.set(0);
  }

  private afterRender(fn: () => void) {
    queueMicrotask(fn);
    afterNextRender(fn, { injector: this.injector });
  }

  private initialPlace(): Place {
    const rect = rectInPage(this.trigger().nativeElement);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      end: rtl ? rect.left : width - rect.right,
    };
  }

  private placePanel(seq: number) {
    if (seq !== this.panelSeq || !this.open() || this.panelPlaced()) return;
    const panelEl = this.panelRef()?.nativeElement;
    if (!panelEl) return;

    const rect = rectInPage(this.trigger().nativeElement);
    const panelRect = rectInPage(panelEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const top = belowTop + panelRect.height > height - 8 ? Math.max(0, rect.top - 4 - panelRect.height) : belowTop;
    const rawEnd = rtl ? rect.left : width - rect.right;
    const maxEnd = Math.max(8, width - 8 - panelRect.width);
    const end = Math.min(Math.max(8, rawEnd), maxEnd);

    this.defaultSubmenuSide.set(width - end - panelRect.width < 175 ? 'end' : 'start');
    this.place.set({ top, end });
    this.panelPlaced.set(true);

    panelEl.style.top = `${top}px`;
    panelEl.style.insetInlineEnd = `${end}px`;
    panelEl.classList.remove('invisible');
    const rows = this.mainRows();
    const firstEnabledIndex = this.items().findIndex((item) => !item.disabled);
    (firstEnabledIndex >= 0 ? rows[firstEnabledIndex] : rows[0])?.nativeElement.focus();
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

    const overflowsStart = rtl
      ? rowRect.right + 4 + subRect.width > width - 8
      : rowRect.left - 4 - subRect.width < 8;
    const side: 'start' | 'end' = overflowsStart ? 'end' : 'start';
    const top = Math.max(-rowRect.top, Math.min(0, height - 8 - (rowRect.top + subRect.height)));

    this.submenuSides.update((sides) => ({ ...sides, [id]: side }));
    this.submenuTop.set(top);
    this.submenuPlaced.set(true);

    submenuEl.classList.toggle('end-full', side === 'start');
    submenuEl.classList.toggle('me-4', side === 'start');
    submenuEl.classList.toggle('start-full', side === 'end');
    submenuEl.classList.toggle('ms-4', side === 'end');
    submenuEl.style.top = `${top}px`;
    submenuEl.classList.remove('invisible');

    if (focusFirst) this.focusFirstSubmenuItem();
  }
}
