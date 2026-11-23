import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerChevronDown,
  tablerFileExport,
  tablerFileSpreadsheet,
  tablerFileTypeCsv,
  tablerFileTypePdf,
  tablerRefresh,
  tablerExclamationCircle,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../ui/button/button';
import { FullState } from '../../../../ui/full-state/full-state';
import { ApiError, correlationIdOf, isRetryableWriteError } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { rectInPage, viewport } from '../../../../ui/overlay/zoom';
import { can } from '../../analytics-permissions';
import { errorText } from '../../panel-state';
import { createExport, exportCapabilities, listExports, pdfAvailable, toExportPeriod } from '../exports.api';
import type { CreateExportRequest, ExportFormat, ExportPeriod } from '../exports.model';

interface FormatOption {
  format: ExportFormat;
  labelKey: string;
  icon: string;
  tile: string;
}

interface MenuPlace {
  top: number;
  end: number;
}

const FORMAT_OPTIONS: readonly FormatOption[] = [
  {
    format: 'CSV',
    labelKey: 'exportMenu.csv',
    icon: 'tablerFileTypeCsv',
    tile: 'bg-icon-teal',
  },
  {
    format: 'XLSX',
    labelKey: 'exportMenu.xlsx',
    icon: 'tablerFileSpreadsheet',
    tile: 'bg-icon-green',
  },
  {
    format: 'PDF',
    labelKey: 'exportMenu.pdf',
    icon: 'tablerFileTypePdf',
    tile: 'bg-icon-red',
  },
];

@Component({
  selector: 'app-export-menu',
  imports: [NgIcon, TranslocoPipe, Button, FullState],
  viewProviders: [
    provideTranslocoScope(
      { scope: 'export-menu', alias: 'exportMenu' },
      { scope: 'analytics', alias: 'analytics' },
    ),
  ],
  providers: [
    provideIcons({
      tablerFileExport,
      tablerChevronDown,
      tablerFileTypeCsv,
      tablerFileSpreadsheet,
      tablerFileTypePdf,
      tablerRefresh,
      tablerExclamationCircle,
    }),
  ],
  templateUrl: './export-menu.html',
  host: {
    class: 'relative inline-flex',
    '(document:click)': 'closeIfOutside($event)',
    '(window:resize)': 'close()',
    '(keydown)': 'onKeydown($event)',
  },
})
export class ExportMenu {
  private static nextId = 0;
  protected readonly hintId = `export-menu-${++ExportMenu.nextId}`;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly notify = inject(Notify);
  private readonly language = inject(LanguageState).current;
  private readonly trigger = viewChild<Button, ElementRef<HTMLButtonElement>>('trigger', { read: ElementRef });
  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly rows = viewChildren<Button, ElementRef<HTMLButtonElement>>('rowBtn', { read: ElementRef });

  readonly target = input.required<{ dashboardId: string } | { reportKey: string }>();
  readonly period = input.required<ExportPeriod>();
  readonly filters = input<object | null>(null);
  readonly panelKeys = input<string[] | null>(null);
  readonly primary = input(false);
  readonly small = input(false);

  protected readonly canExport = can('crm.exports.create');
  protected readonly options = FORMAT_OPTIONS;
  protected readonly open = signal(false);
  protected readonly placed = signal(false);
  protected readonly submitting = signal(false);
  protected readonly pdfEnabled = signal(pdfAvailable());
  protected readonly pdfReason = signal('exportMenu.pdfNotAvailable');
  protected readonly loading = signal(false);
  protected readonly loadError = signal<unknown>(null);
  protected readonly correlationId = computed(() => correlationIdOf(this.loadError()));
  protected readonly forbidden = computed(() => {
    const error = this.loadError();
    return error instanceof ApiError && error.status === 403;
  });
  protected readonly readOnly = signal(false);
  protected readonly place = signal<MenuPlace>({ top: 0, end: 0 });
  protected readonly iconSize = computed(() => (this.small() ? '14' : '15'));

  private panelSeq = 0;
  private refreshSeq = 0;
  private pending: { bodyJson: string; key: string } | null = null;
  private mismatch = false;

  constructor() {
    const close = () => this.close();
    document.addEventListener('scroll', close, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => {
      this.refreshSeq++;
      document.removeEventListener('scroll', close, { capture: true });
    });
  }

  protected isFormatDisabled(format: ExportFormat): boolean {
    if (!this.canExport || this.submitting() || this.loading() || this.loadError() || this.readOnly() || this.mismatch) return true;
    return format === 'PDF' && !this.pdfEnabled();
  }

  protected toggle(): void {
    if (!this.canExport || this.submitting()) return;
    if (this.open()) {
      this.close();
      return;
    }
    const seq = ++this.panelSeq;
    this.placed.set(false);
    this.place.set(this.initialPlace());
    this.open.set(true);
    queueMicrotask(() => this.placePanel(seq));
    afterNextRender(() => this.placePanel(seq), { injector: this.injector });
    void this.refresh();
  }

  protected async refresh(): Promise<void> {
    if (this.loading() || !this.canExport) return;
    const seq = ++this.refreshSeq;
    this.loading.set(true);
    this.loadError.set(null);
    try {
      await listExports();
      if (seq !== this.refreshSeq) return;
      this.pdfEnabled.set(pdfAvailable());
      const reason = exportCapabilities().formats.find((format) => format.format === 'PDF')?.reason;
      this.pdfReason.set(reason === 'PDF_RENDERER_UNAVAILABLE' ? 'exportMenu.pdfRendererUnavailable' : 'exportMenu.pdfNotAvailable');
      this.mismatch = false;
    } catch (error) {
      if (seq === this.refreshSeq) this.loadError.set(error);
    } finally {
      if (seq === this.refreshSeq) {
        this.loading.set(false);
        this.placed.set(false);
        afterNextRender(() => this.placePanel(this.panelSeq), { injector: this.injector });
      }
    }
  }

  protected close(): void {
    this.panelSeq++;
    this.open.set(false);
    this.placed.set(false);
  }

  protected closeIfOutside(event: Event): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  protected async choose(format: ExportFormat): Promise<void> {
    if (this.isFormatDisabled(format)) return;
    this.close();
    this.submitting.set(true);
    const filters = this.filters();
    const panelKeys = this.panelKeys();
    const body: CreateExportRequest = {
      ...this.target(), format, locale: this.language(), period: toExportPeriod(this.period()),
      ...(filters ? { filters: { ...filters } } : {}),
      ...(panelKeys?.length ? { panelKeys: [...panelKeys] } : {}),
    };
    const bodyJson = JSON.stringify(body);
    if (this.pending?.bodyJson !== bodyJson) this.pending = { bodyJson, key: newIdempotencyKey() };
    try {
      await createExport(body, this.pending.key);
      this.pending = null;
      this.notify.success(
        this.transloco.translate('exportMenu.queued'),
        this.transloco.translate('exportMenu.findIt'),
      );
    } catch (error) {
      const code = error instanceof ApiError ? error.code : '';
      if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) this.pending = null;
      if (code === 'GW.IDEM.MISMATCH' || code.endsWith('_IDEMPOTENCY_MISMATCH') || code === 'CRM_IDEMPOTENCY_KEY_REUSED') this.mismatch = true;
      if (error instanceof ApiError && error.status === 403 &&
        (code.endsWith('_DISABLED') || ['CRM_SUBSCRIPTION_READ_ONLY', 'SEAT_OVER_CAPACITY_READ_ONLY'].includes(code))) this.readOnly.set(true);
      const text = errorText(error);
      const key = error instanceof ApiError && error.status === 401 ? 'exportMenu.notSaved'
        : code === 'CRM_EXPORT_QUEUE_LIMIT' ? 'exportMenu.queueLimit'
        : code.endsWith('_DISABLED') ? 'exportMenu.moduleDisabled' : text.key;
      this.notify.error(this.transloco.translate(key, text.params));
    } finally {
      this.submitting.set(false);
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.open()) return;
    const triggerEl = this.trigger()?.nativeElement;

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      triggerEl?.focus();
      return;
    }

    if (event.key === 'Tab') {
      this.close();
      return;
    }

    const rowEls = this.rows().map((r) => r.nativeElement);
    const enabledIndices = rowEls.reduce<number[]>((acc, row, idx) => {
      if (row.getAttribute('aria-disabled') !== 'true' && !row.disabled) acc.push(idx);
      return acc;
    }, []);
    if (enabledIndices.length === 0) return;

    const target = event.target as HTMLElement | null;
    const currentIndex = rowEls.findIndex((el) => el === target);
    const currentEnabledPos = enabledIndices.indexOf(currentIndex);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextPos = currentEnabledPos === -1 ? 0 : (currentEnabledPos + 1) % enabledIndices.length;
      rowEls[enabledIndices[nextPos]]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prevPos =
        currentEnabledPos === -1
          ? enabledIndices.length - 1
          : (currentEnabledPos - 1 + enabledIndices.length) % enabledIndices.length;
      rowEls[enabledIndices[prevPos]]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      rowEls[enabledIndices[0]]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      rowEls[enabledIndices[enabledIndices.length - 1]]?.focus();
    } else if ((event.key === 'Enter' || event.key === ' ') && currentIndex >= 0) {
      event.preventDefault();
      rowEls[currentIndex]?.click();
      if (currentIndex < this.options.length) triggerEl?.focus();
    }
  }

  private initialPlace(): MenuPlace {
    const triggerEl = this.trigger()?.nativeElement;
    if (!triggerEl) return { top: 0, end: 8 };
    const rect = rectInPage(triggerEl);
    const { width } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    return {
      top: rect.bottom + 4,
      end: rtl ? rect.left : width - rect.right,
    };
  }

  private placePanel(seq: number): void {
    if (seq !== this.panelSeq || !this.open() || this.placed()) return;
    const triggerEl = this.trigger()?.nativeElement;
    const panelEl = this.panelRef()?.nativeElement;
    if (!triggerEl || !panelEl) return;

    const rect = rectInPage(triggerEl);
    const panelRect = rectInPage(panelEl);
    const { width, height } = viewport();
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';

    const belowTop = rect.bottom + 4;
    const top =
      belowTop + panelRect.height > height - 8
        ? Math.max(8, rect.top - 4 - panelRect.height)
        : belowTop;
    const rawEnd = rtl ? rect.left : width - rect.right;
    const maxEnd = Math.max(8, width - 8 - panelRect.width);
    const end = Math.min(Math.max(8, rawEnd), maxEnd);

    this.place.set({ top, end });
    this.placed.set(true);

    panelEl.style.top = `${top}px`;
    panelEl.style.insetInlineEnd = `${end}px`;
    panelEl.classList.remove('invisible');

    this.rows().find((row) => !row.nativeElement.disabled && row.nativeElement.getAttribute('aria-disabled') !== 'true')?.nativeElement.focus();
  }
}
