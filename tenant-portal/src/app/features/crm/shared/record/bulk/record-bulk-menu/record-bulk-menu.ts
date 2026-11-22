import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArchive,
  tablerArrowsExchange,
  tablerBuilding,
  tablerCalendarPlus,
  tablerCheck,
  tablerChevronDown,
  tablerCircleOff,
  tablerEdit,
  tablerFileExport,
  tablerLock,
  tablerMail,
  tablerSend,
  tablerStar,
  tablerTrash,
  tablerUserShare,
  tablerUsers,
  tablerX,
} from '@ng-icons/tabler-icons';
import { Button } from '../../../../../../shared/ui/button/button';
import { rectInPage, viewport } from '../../../../../../shared/ui/overlay/zoom';
import { RecordBulkAction, bulkTileClass, isDangerBulkTone } from '../record-bulk.model';

interface BulkMenuRow {
  id: string;
  title: string;
  icon: string;
  tile: string;
  danger: boolean;
  disabled: boolean;
  reason?: string;
}

interface Place {
  top: number;
  start: number;
}

@Component({
  selector: 'app-record-bulk-menu',
  imports: [NgIcon, TranslocoPipe, Button],
  providers: [
    provideTranslocoScope({ scope: 'record-bulk', alias: 'recordBulk' }),
    provideIcons({
      tablerChevronDown,
      tablerUserShare,
      tablerArrowsExchange,
      tablerCalendarPlus,
      tablerTrash,
      tablerArchive,
      tablerEdit,
      tablerCheck,
      tablerX,
      tablerLock,
      tablerFileExport,
      tablerSend,
      tablerStar,
      tablerCircleOff,
      tablerMail,
      tablerUsers,
      tablerBuilding,
    }),
  ],
  templateUrl: './record-bulk-menu.html',
  host: {
    class: 'relative inline-flex shrink-0',
    '(document:click)': 'closeIfOutside($event)',
    '(window:resize)': 'close()',
    '(keydown)': 'onKeydown($event)',
  },
})
export class RecordBulkMenu {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly trigger = viewChild.required<Button, ElementRef<HTMLButtonElement>>('trigger', {
    read: ElementRef,
  });
  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly menuRows = viewChildren<ElementRef<HTMLButtonElement>>('menuRow');
  private panelSeq = 0;

  readonly count = input(0);
  readonly actions = input.required<readonly RecordBulkAction[]>();
  readonly busyReasonKey = input<string | null>(null);
  readonly busyReason = input<string | null>(null);
  readonly disabled = input(false);

  readonly run = output<string>();

  protected readonly open = signal(false);
  protected readonly panelPlaced = signal(false);
  protected readonly place = signal<Place>({ top: 0, start: 0 });

  protected readonly isDisabled = computed(
    () => this.disabled() || !!this.busyReasonKey() || !!this.busyReason(),
  );

  protected readonly disabledTitle = computed(() => {
    this.i18n();
    const key = this.busyReasonKey();
    if (key) return this.transloco.translate(key);
    return this.busyReason();
  });

  protected readonly items = computed<BulkMenuRow[]>(() => {
    this.i18n();
    return this.actions().map((action) => ({
      id: action.id,
      title: this.transloco.translate(action.labelKey),
      icon: action.icon,
      tile: bulkTileClass(action.tone),
      danger: action.danger ?? isDangerBulkTone(action.tone),
      disabled: !action.allowed,
      ...(action.allowed || !action.reasonKey
        ? {}
        : { reason: this.transloco.translate(action.reasonKey) }),
    }));
  });

  constructor() {
    const close = () => this.close();
    document.addEventListener('scroll', close, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', close, { capture: true }));
  }

  protected toggle(): void {
    if (this.isDisabled()) return;
    if (this.open()) {
      this.close();
      return;
    }
    const seq = ++this.panelSeq;
    this.panelPlaced.set(false);
    this.place.set(this.initialPlace());
    this.open.set(true);
    this.afterRender(() => this.placePanel(seq));
  }

  protected close(): void {
    this.panelSeq++;
    this.open.set(false);
    this.panelPlaced.set(false);
  }

  protected closeIfOutside(event: Event): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  protected onRowClick(item: BulkMenuRow, viaKeyboard = false): void {
    if (item.disabled) return;
    this.close();
    if (viaKeyboard) {
      this.trigger().nativeElement.focus();
    }
    this.run.emit(item.id);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.open()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      this.trigger().nativeElement.focus();
      return;
    }

    const target = event.target as HTMLElement | null;
    if (!target) return;
    const rows = this.menuRows();
    const index = rows.findIndex((row) => row.nativeElement === target);
    if (index < 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      rows[(index + 1) % rows.length]?.nativeElement.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      rows[(index - 1 + rows.length) % rows.length]?.nativeElement.focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const item = this.items()[index];
      if (item) this.onRowClick(item, true);
    }
  }

  private afterRender(fn: () => void): void {
    queueMicrotask(fn);
    afterNextRender(fn, { injector: this.injector });
  }

  private initialPlace(): Place {
    const rect = rectInPage(this.trigger().nativeElement);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      start: rtl ? width - rect.right : rect.left,
    };
  }

  private placePanel(seq: number): void {
    if (seq !== this.panelSeq || !this.open() || this.panelPlaced()) return;
    const panelEl = this.panelRef()?.nativeElement;
    if (!panelEl) return;

    const rect = rectInPage(this.trigger().nativeElement);
    const panelRect = rectInPage(panelEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const top = belowTop + panelRect.height > height - 8 ? Math.max(8, rect.top - 4 - panelRect.height) : belowTop;
    const rawStart = rtl ? width - rect.right : rect.left;
    const maxStart = Math.max(8, width - 8 - panelRect.width);
    const start = Math.min(Math.max(8, rawStart), maxStart);

    this.place.set({ top, start });
    this.panelPlaced.set(true);

    panelEl.style.top = `${top}px`;
    panelEl.style.insetInlineStart = `${start}px`;
    panelEl.classList.remove('invisible');

    const rows = this.menuRows();
    const firstEnabledIndex = this.items().findIndex((item) => !item.disabled);
    (firstEnabledIndex >= 0 ? rows[firstEnabledIndex] : rows[0])?.nativeElement.focus();
  }
}
