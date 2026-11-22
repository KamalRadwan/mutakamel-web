import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerPlus, tablerX } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../../core/notify/notify';
import { Button } from '../../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { DateField } from '../../../../../shared/ui/date-time/date-field';
import { TimeField } from '../../../../../shared/ui/date-time/time-field';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { ApiError, type TradeContext, errorCodeOf, errorKey, newIdempotencyKey } from '../../../shared/trade-api';
import { createVersion } from '../configuration.api';
import type { ConfigDefinition, CreatedConfigVersion, ScopeTarget } from '../configuration.model';
import { ValueEditor } from '../value-editor/value-editor';
import {
  type ValueValidationError,
  defaultValueForSchema,
  describeSchemaLimits,
  stableJson,
  validateValue,
} from '../value-schema';

export interface VersionModalScopeOverride {
  scopeTarget: ScopeTarget;
  ctx: TradeContext;
  scopeLabel: string;
}

type VersionModalDefinition = Pick<ConfigDefinition, 'id' | 'key' | 'valueSchema' | 'version'>;

function normalizeServerPath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '$') return '$';
  if (trimmed.startsWith('$')) return trimmed;
  if (trimmed.startsWith('[')) return `$${trimmed}`;
  return `$.${trimmed}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function localNowParts(): { date: string; time: string } {
  const now = new Date();
  const date = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  return { date, time };
}

function localPartsToUtcIso(dateStr: string | null, timeStr: string | null): string | null {
  if (!dateStr || !timeStr) return null;
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeStr.trim());
  if (!dateMatch || !timeMatch) return null;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const dt = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day ||
    dt.getHours() !== hours ||
    dt.getMinutes() !== minutes
  ) {
    return null;
  }
  return dt.toISOString();
}

@Component({
  selector: 'app-config-version-modal',
  imports: [NgIcon, TranslocoPipe, Modal, Field, DateField, TimeField, Button, ConfirmDialog, ValueEditor],
  providers: [provideIcons({ tablerPlus, tablerX })],
  templateUrl: './version-modal.html',
})
export class VersionModal {
  private static nextId = 0;
  protected readonly uid = `cfg-version-${++VersionModal.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly notify = inject(Notify);

  private readonly modal = viewChild.required(Modal);
  private readonly valueEditor = viewChild(ValueEditor);
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');
  private readonly conflictDialog = viewChild.required<ConfirmDialog>('conflictDialog');

  readonly ctx = input.required<TradeContext>();
  readonly scopeTarget = input.required<ScopeTarget>();
  readonly scopeLabel = input.required<string>();

  readonly created = output<CreatedConfigVersion>();
  readonly reloadRequested = output<void>();

  protected readonly definition = signal<VersionModalDefinition | null>(null);
  private readonly scopeOverride = signal<VersionModalScopeOverride | null>(null);
  protected readonly value = signal<unknown>(null);
  protected readonly fromDate = signal<string | null>(null);
  protected readonly fromTime = signal<string | null>(null);
  protected readonly toDate = signal<string | null>(null);
  protected readonly toTime = signal<string | null>(null);

  protected readonly saving = signal(false);
  protected readonly attemptedSubmit = signal(false);
  protected readonly serverValueErrors = signal<ValueValidationError[]>([]);

  private readonly activeScopeTarget = computed(() => this.scopeOverride()?.scopeTarget ?? this.scopeTarget());
  private readonly activeCtx = computed(() => this.scopeOverride()?.ctx ?? this.ctx());
  private readonly activeScopeLabel = computed(() => this.scopeOverride()?.scopeLabel ?? this.scopeLabel());

  private initialFingerprint = '';
  private allowClose = false;
  private confirmingLeave = false;
  private lastSubmitFingerprint = '';
  private lastIdempotencyKey = '';

  protected readonly subtitle = computed(() => {
    this.i18n();
    const def = this.definition();
    if (!def) return '';
    return this.transloco.translate('tradeConfig.versionModal.subtitle', {
      key: def.key,
      scope: this.activeScopeLabel(),
    });
  });

  protected readonly valueHint = computed(() => {
    this.i18n();
    const def = this.definition();
    if (!def) return '';
    return describeSchemaLimits(def.valueSchema, (k, p) => this.transloco.translate(k, p)).valueHint;
  });

  protected readonly valueErrors = computed<ValueValidationError[]>(() => {
    const def = this.definition();
    if (!def || !this.attemptedSubmit()) return [];
    const clientErrors = validateValue(def.valueSchema, this.value());
    if (clientErrors.length > 0) return clientErrors;
    return this.serverValueErrors();
  });

  protected readonly fromError = computed<string | null>(() => {
    this.i18n();
    if (!this.attemptedSubmit()) return null;
    if (!this.fromDate() || !this.fromTime()) {
      return this.transloco.translate('tradeConfig.versionModal.dateRequired');
    }
    if (!localPartsToUtcIso(this.fromDate(), this.fromTime())) {
      return this.transloco.translate('tradeConfig.versionModal.invalidDate');
    }
    return null;
  });

  protected readonly toError = computed<string | null>(() => {
    this.i18n();
    if (!this.attemptedSubmit()) return null;
    const td = this.toDate();
    const tt = this.toTime();
    if (!td && !tt) return null;
    const toIso = localPartsToUtcIso(td, tt);
    if (!toIso) {
      return this.transloco.translate('tradeConfig.versionModal.invalidDate');
    }
    const fromIso = localPartsToUtcIso(this.fromDate(), this.fromTime());
    if (fromIso && Date.parse(toIso) <= Date.parse(fromIso)) {
      return this.transloco.translate('tradeConfig.versionModal.endAfterStart');
    }
    return null;
  });

  protected readonly fromDescribedBy = computed(() => {
    const base = `${this.uid}-from-hint`;
    return this.fromError() ? `${base} ${this.uid}-from-error` : base;
  });

  protected readonly toDescribedBy = computed(() => {
    const base = `${this.uid}-to-hint`;
    return this.toError() ? `${base} ${this.uid}-to-error` : base;
  });

  protected readonly hasEnd = computed(() => Boolean(this.toDate() || this.toTime()));

  protected readonly dirty = computed(() => {
    if (!this.definition()) return false;
    return this.snapshotFingerprint() !== this.initialFingerprint;
  });

  open(def: VersionModalDefinition, override?: VersionModalScopeOverride): void {
    const now = localNowParts();
    const defaultVal = defaultValueForSchema(def.valueSchema);

    this.definition.set(def);
    this.scopeOverride.set(override ?? null);
    this.value.set(defaultVal);
    this.fromDate.set(now.date);
    this.fromTime.set(now.time);
    this.toDate.set(null);
    this.toTime.set(null);
    this.attemptedSubmit.set(false);
    this.serverValueErrors.set([]);
    this.saving.set(false);
    this.allowClose = false;
    this.lastSubmitFingerprint = '';
    this.lastIdempotencyKey = '';
    this.initialFingerprint = this.snapshotFingerprint();

    this.modal().open();
  }

  protected onValueChange(next: unknown): void {
    this.serverValueErrors.set([]);
    this.value.set(next);
  }

  protected onToDateChange(nextDate: string | null): void {
    this.toDate.set(nextDate);
    if (nextDate && !this.toTime()) {
      this.toTime.set('23:59');
    } else if (!nextDate) {
      this.toTime.set(null);
    }
  }

  protected onToTimeChange(nextTime: string | null): void {
    this.toTime.set(nextTime);
    if (nextTime && !this.toDate()) {
      this.toDate.set(this.fromDate() ?? localNowParts().date);
    } else if (!nextTime) {
      this.toDate.set(null);
    }
  }

  protected clearEnd(): void {
    this.toDate.set(null);
    this.toTime.set(null);
  }

  protected async requestClose(): Promise<void> {
    if (this.saving()) return;
    if (!(await this.confirmLeave())) return;
    this.allowClose = true;
    this.modal().close();
  }

  protected onModalClosed(): void {
    if (!this.allowClose && this.dirty()) {
      this.modal().open();
      void this.confirmModalClose();
      return;
    }
    this.allowClose = false;
    this.definition.set(null);
    this.scopeOverride.set(null);
    this.attemptedSubmit.set(false);
    this.serverValueErrors.set([]);
    this.saving.set(false);
  }

  protected async submit(): Promise<void> {
    const def = this.definition();
    if (!def || this.saving()) return;

    const committed = this.valueEditor()?.commit() ?? true;
    this.attemptedSubmit.set(true);
    this.serverValueErrors.set([]);
    if (!committed) return;

    const clientErrors = validateValue(def.valueSchema, this.value());
    if (clientErrors.length > 0) return;

    const fromIso = localPartsToUtcIso(this.fromDate(), this.fromTime());
    if (!fromIso) return;

    let toIso: string | null = null;
    if (this.hasEnd()) {
      toIso = localPartsToUtcIso(this.toDate(), this.toTime());
      if (!toIso || Date.parse(toIso) <= Date.parse(fromIso)) return;
    }

    const body = {
      scopeTarget: this.activeScopeTarget(),
      value: this.value(),
      effectiveFrom: fromIso,
      effectiveTo: toIso,
    };
    const fingerprint = `${def.id}:${def.version}:${stableJson(body)}`;
    if (fingerprint !== this.lastSubmitFingerprint || !this.lastIdempotencyKey) {
      this.lastSubmitFingerprint = fingerprint;
      this.lastIdempotencyKey = newIdempotencyKey();
    }

    this.saving.set(true);
    try {
      const created = await createVersion(
        this.activeCtx(),
        def.id,
        def.version,
        body,
        this.lastIdempotencyKey,
      );
      this.lastSubmitFingerprint = '';
      this.lastIdempotencyKey = '';
      this.notify.success(this.transloco.translate('tradeConfig.toasts.versionCreated', { n: created.versionNumber }));
      this.allowClose = true;
      this.modal().close();
      this.created.emit(created);
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'TRADE.CONFIGURATION.VALUE_INVALID') {
        const rawPaths =
          error instanceof ApiError && Array.isArray(error.details?.['path'])
            ? error.details['path'].filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
            : [];
        const paths = rawPaths.length > 0 ? rawPaths.map(normalizeServerPath) : ['$'];
        this.serverValueErrors.set(
          paths.map((path) => ({
            path,
            rule: 'type',
            messageKey: 'tradeShared.errors.TRADE_CONFIGURATION_VALUE_INVALID',
          })),
        );
      } else if (code === 'TRADE.CONCURRENCY.STALE_VERSION') {
        const reload = await this.conflictDialog().open();
        if (reload) {
          this.allowClose = true;
          this.modal().close();
          this.reloadRequested.emit();
        }
      } else {
        this.notify.error(this.transloco.translate(errorKey(error)));
      }
    } finally {
      this.saving.set(false);
    }
  }

  private snapshotFingerprint(): string {
    return stableJson({
      value: this.value(),
      fromDate: this.fromDate(),
      fromTime: this.fromTime(),
      toDate: this.toDate(),
      toTime: this.toTime(),
    });
  }

  private async confirmModalClose(): Promise<void> {
    if (await this.confirmLeave()) {
      this.allowClose = true;
      this.modal().close();
    }
  }

  private async confirmLeave(): Promise<boolean> {
    if (!this.dirty()) return true;
    if (this.confirmingLeave) return false;
    this.confirmingLeave = true;
    try {
      return await this.discardDialog().open();
    } finally {
      this.confirmingLeave = false;
    }
  }
}
