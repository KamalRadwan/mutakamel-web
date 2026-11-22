import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerCalendarStats } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { DateField } from '../../../../shared/ui/date-time/date-field';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { ApiError, newIdempotencyKey } from '../../shared/trade-api';
import { createPeriod } from '../inventory.api';
import { CODE_PATTERN, INVENTORY_LIMITS, type InventoryPeriod } from '../inventory.model';
import { errorKey, errorReason, formatDateTime as formatDateTimeDisplay } from '../inventory.service';
import { InventoryBadge } from '../inventory-shared/inventory-badge/inventory-badge';

type PeriodField = 'code' | 'startsOn' | 'endsOn' | 'maxBackdateDays';

const ISO_DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function formatUtcDay(date: Date): string {
  const y = String(date.getUTCFullYear()).padStart(4, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseUtcDay(raw: string): Date | null {
  const match = ISO_DAY_RE.exec(raw.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return dt;
}

function computeCreatePrefill(latest: InventoryPeriod | null): {
  startsOn: string;
  endsOn: string;
  maxBackdateDays: string;
} {
  const endDt = latest ? parseUtcDay(latest.endsOn) : null;
  if (endDt && latest) {
    const nextStart = new Date(
      Date.UTC(endDt.getUTCFullYear(), endDt.getUTCMonth(), endDt.getUTCDate() + 1),
    );
    const monthEnd = new Date(
      Date.UTC(nextStart.getUTCFullYear(), nextStart.getUTCMonth() + 1, 0),
    );
    return {
      startsOn: formatUtcDay(nextStart),
      endsOn: formatUtcDay(monthEnd),
      maxBackdateDays: String(latest.maxBackdateDays),
    };
  }
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return {
    startsOn: formatUtcDay(monthStart),
    endsOn: formatUtcDay(monthEnd),
    maxBackdateDays: '0',
  };
}

function formatDayDisplay(isoDay: string): string {
  const match = ISO_DAY_RE.exec(isoDay.trim());
  if (!match) return isoDay || '—';
  return `${match[3]}/${match[2]}/${match[1]}`;
}

@Component({
  selector: 'app-period-modal',
  imports: [TranslocoPipe, Button, ConfirmDialog, DateField, Field, Modal, InventoryBadge],
  providers: [provideIcons({ tablerCalendarStats })],
  templateUrl: './period-modal.html',
})
export class PeriodModal {
  private static nextId = 0;
  protected readonly uid = `period-modal-${++PeriodModal.nextId}`;

  private readonly notify = inject(Notify);
  private readonly language = inject(LanguageState).current;
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required<Modal>('periodModal');
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');

  readonly canGovern = input(true);
  readonly reasonLabel = input<(code: string | null) => string>((code) => code ?? '—');
  readonly userLabel = input<(id: string | null) => string>((id) => id ?? '—');

  readonly created = output<InventoryPeriod>();
  readonly closeRequested = output<InventoryPeriod>();
  readonly reopenRequested = output<InventoryPeriod>();
  readonly closed = output<void>();

  protected readonly limits = INVENTORY_LIMITS;
  protected readonly mode = signal<'create' | 'view'>('create');
  protected readonly saving = signal(false);
  protected readonly period = signal<InventoryPeriod | null>(null);

  protected readonly code = signal('');
  protected readonly startsOn = signal('');
  protected readonly endsOn = signal('');
  protected readonly maxBackdateDays = signal('0');

  protected readonly touched = signal<Partial<Record<PeriodField, boolean>>>({});
  protected readonly submitted = signal(false);
  protected readonly serverErrors = signal<Partial<Record<PeriodField, string>>>({});

  private initialPrefill = { startsOn: '', endsOn: '', maxBackdateDays: '0' };
  private allowClose = false;
  private confirmingDiscard = false;
  private formIdempotencyKey = newIdempotencyKey();

  protected readonly dirty = computed(() => {
    if (this.mode() !== 'create' || !this.canGovern()) return false;
    return (
      this.code().trim().length > 0 ||
      this.startsOn() !== this.initialPrefill.startsOn ||
      this.endsOn() !== this.initialPrefill.endsOn ||
      this.maxBackdateDays().trim() !== this.initialPrefill.maxBackdateDays
    );
  });

  protected readonly validationErrors = computed<Partial<Record<PeriodField, string>>>(() => {
    this.i18n();
    if (this.mode() !== 'create') return {};

    const errs: Partial<Record<PeriodField, string>> = {};
    // The backend stores the code exactly as sent and its pattern requires upper case: no silent upper-casing.
    const code = this.code().trim();
    if (!code) {
      errs.code = this.transloco.translate('invSetup.common.required');
    } else if (code.length > INVENTORY_LIMITS.periodCode || !CODE_PATTERN.test(code)) {
      errs.code = this.transloco.translate('invSetup.periodModal.errors.codePattern');
    }

    const start = this.startsOn().trim();
    const end = this.endsOn().trim();
    if (!start) {
      errs.startsOn = this.transloco.translate('invSetup.common.required');
    }
    if (!end) {
      errs.endsOn = this.transloco.translate('invSetup.common.required');
    } else if (start && end < start) {
      errs.endsOn = this.transloco.translate('invSetup.periodModal.errors.invalidRange');
    }

    const rawDays = this.maxBackdateDays().trim();
    if (!rawDays) {
      errs.maxBackdateDays = this.transloco.translate('invSetup.common.required');
    } else if (!/^\d+$/.test(rawDays)) {
      errs.maxBackdateDays = this.transloco.translate('invSetup.periodModal.errors.backdateRange');
    } else {
      const days = Number(rawDays);
      if (!Number.isSafeInteger(days) || days < 0 || days > INVENTORY_LIMITS.maxBackdateDays) {
        errs.maxBackdateDays = this.transloco.translate('invSetup.periodModal.errors.backdateRange');
      }
    }

    return errs;
  });

  protected readonly isValid = computed(() => Object.keys(this.validationErrors()).length === 0);

  protected readonly codeError = computed(() => this.resolveFieldError('code'));
  protected readonly startsOnError = computed(() => this.resolveFieldError('startsOn'));
  protected readonly endsOnError = computed(() => this.resolveFieldError('endsOn'));
  protected readonly maxBackdateError = computed(() => this.resolveFieldError('maxBackdateDays'));

  protected readonly viewStartsOn = computed(() => {
    const p = this.period();
    return p ? formatDayDisplay(p.startsOn) : '—';
  });

  protected readonly viewEndsOn = computed(() => {
    const p = this.period();
    return p ? formatDayDisplay(p.endsOn) : '—';
  });

  protected readonly viewStatusLabel = computed(() => {
    this.i18n();
    const p = this.period();
    return p ? this.transloco.translate(`tradeInventory.badge.period.${p.status}`) : '—';
  });

  protected readonly viewBackdateLabel = computed(() => {
    this.i18n();
    const p = this.period();
    if (!p) return '—';
    const n = p.maxBackdateDays;
    const form = new Intl.PluralRules(this.language()).select(n);
    return this.transloco.translate(`invSetup.periods.backdateDays.${form}`, { n });
  });

  protected readonly viewClosedAt = computed(() => {
    const p = this.period();
    return p ? formatDateTimeDisplay(p.closedAt) : '—';
  });

  protected readonly viewClosedBy = computed(() => {
    this.i18n();
    const p = this.period();
    if (!p || !p.closedBy) return this.transloco.translate('tradeInventory.common.none');
    return this.userLabel()(p.closedBy);
  });

  protected readonly viewCloseReason = computed(() => {
    this.i18n();
    const p = this.period();
    if (!p || !p.closeReason) return this.transloco.translate('tradeInventory.common.none');
    return this.reasonLabel()(p.closeReason);
  });

  openCreate(latestPeriod: InventoryPeriod | null): void {
    this.mode.set('create');
    this.period.set(null);
    this.saving.set(false);

    const prefill = computeCreatePrefill(latestPeriod);
    this.initialPrefill = prefill;
    this.code.set('');
    this.startsOn.set(prefill.startsOn);
    this.endsOn.set(prefill.endsOn);
    this.maxBackdateDays.set(prefill.maxBackdateDays);

    this.resetValidation();
    this.formIdempotencyKey = newIdempotencyKey();
    this.allowClose = false;
    this.modal().open();
  }

  openView(period: InventoryPeriod): void {
    this.mode.set('view');
    this.saving.set(false);
    this.period.set(period);
    this.resetValidation();
    this.allowClose = false;
    this.modal().open();
  }

  updateViewedPeriod(period: InventoryPeriod): void {
    if (this.mode() !== 'view') return;
    if (this.period()?.id === period.id) {
      this.period.set(period);
    }
  }

  close(): void {
    this.allowClose = true;
    this.modal().close();
  }

  protected onCodeInput(event: Event): void {
    if (this.mode() !== 'create' || this.saving()) return;
    this.code.set((event.target as HTMLInputElement).value);
    this.clearServerError('code');
  }

  protected onCodeBlur(): void {
    this.markTouched('code');
    if (this.mode() !== 'create') return;
    const trimmed = this.code().trim();
    if (trimmed !== this.code()) {
      this.code.set(trimmed);
    }
  }

  protected onStartsOnChange(next: string | null): void {
    if (this.mode() !== 'create' || this.saving()) return;
    this.startsOn.set(next ?? '');
    this.markTouched('startsOn');
    this.clearServerError('startsOn');
    this.clearServerError('endsOn');
  }

  protected onEndsOnChange(next: string | null): void {
    if (this.mode() !== 'create' || this.saving()) return;
    this.endsOn.set(next ?? '');
    this.markTouched('endsOn');
    this.clearServerError('endsOn');
    this.clearServerError('startsOn');
  }

  protected onBackdateInput(event: Event): void {
    if (this.mode() !== 'create' || this.saving()) return;
    this.maxBackdateDays.set((event.target as HTMLInputElement).value);
    this.clearServerError('maxBackdateDays');
  }

  protected markTouched(field: PeriodField): void {
    this.touched.update((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

  protected requestClose(): void {
    if (this.saving()) return;
    if (this.dirty()) {
      void this.confirmDiscardAndClose();
      return;
    }
    this.close();
  }

  protected onModalClosed(): void {
    if (this.saving()) {
      this.modal().open();
      return;
    }
    if (!this.allowClose && this.dirty()) {
      this.modal().open();
      void this.confirmDiscardAndClose();
      return;
    }
    this.allowClose = false;
    this.closed.emit();
  }

  protected async submitCreate(event?: Event): Promise<void> {
    event?.preventDefault();
    if (this.mode() !== 'create' || !this.canGovern() || this.saving()) return;

    this.submitted.set(true);
    this.serverErrors.set({});
    if (!this.isValid()) return;

    const normalizedCode = this.code().trim();
    this.code.set(normalizedCode);

    this.saving.set(true);
    try {
      const created = await createPeriod(
        {
          code: normalizedCode,
          startsOn: this.startsOn().trim(),
          endsOn: this.endsOn().trim(),
          maxBackdateDays: Number(this.maxBackdateDays().trim()),
        },
        this.formIdempotencyKey,
      );
      this.notify.success(this.transloco.translate('invSetup.periods.toast.created'));
      this.created.emit(created);
      this.close();
    } catch (error) {
      this.handleCreateError(error);
    } finally {
      this.saving.set(false);
    }
  }

  protected requestClosePeriod(): void {
    const p = this.period();
    if (!p || !this.canGovern() || p.status !== 'OPEN') return;
    this.closeRequested.emit(p);
  }

  protected requestReopenPeriod(): void {
    const p = this.period();
    if (!p || !this.canGovern() || p.status !== 'CLOSED') return;
    this.reopenRequested.emit(p);
  }

  private handleCreateError(error: unknown): void {
    if (error instanceof ApiError) {
      if (error.code === 'TRADE.INVENTORY.PERIOD_CODE_TAKEN') {
        this.serverErrors.update((prev) => ({
          ...prev,
          code: this.transloco.translate('invSetup.periodModal.errors.codeConflict'),
        }));
        return;
      }
      if (error.code === 'TRADE.INVENTORY.PERIOD_CLOSED') {
        const reason = errorReason(error);
        if (reason === 'invalid_range') {
          this.serverErrors.update((prev) => ({
            ...prev,
            endsOn: this.transloco.translate('invSetup.periodModal.errors.invalidRange'),
          }));
          return;
        }
        if (reason === 'overlapping_period') {
          this.serverErrors.update((prev) => ({
            ...prev,
            startsOn: this.transloco.translate('invSetup.periodModal.errors.overlappingPeriod'),
          }));
          return;
        }
      }
    }
    this.notify.error(this.transloco.translate(errorKey(error)));
  }

  private resolveFieldError(field: PeriodField): string | null {
    this.i18n();
    const server = this.serverErrors()[field];
    if (server) return server;
    const show = this.submitted() || Boolean(this.touched()[field]);
    if (!show) return null;
    return this.validationErrors()[field] ?? null;
  }

  private clearServerError(field: PeriodField): void {
    if (!this.serverErrors()[field]) return;
    this.serverErrors.update((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  private resetValidation(): void {
    this.touched.set({});
    this.submitted.set(false);
    this.serverErrors.set({});
  }

  private async confirmDiscardAndClose(): Promise<void> {
    if (this.confirmingDiscard) return;
    this.confirmingDiscard = true;
    try {
      if (await this.discardDialog().open()) {
        this.close();
      }
    } finally {
      this.confirmingDiscard = false;
    }
  }
}
