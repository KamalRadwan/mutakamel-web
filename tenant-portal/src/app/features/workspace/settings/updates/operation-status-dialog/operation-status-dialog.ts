import { Component, computed, inject, input, output, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerArrowRight,
  tablerLoader2,
  tablerPackage,
  tablerShieldCheck,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { Button } from '../../../../../shared/ui/button/button';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { SettingsNotice } from '../../../../../shared/ui/settings-notice/settings-notice';
import {
  badgeClassForTone,
  formatDateTime,
  guidanceKeyForStatus,
  statusLabelKey,
  statusTone,
} from '../updates.logic';
import { SnapshotItem, TenantOperationDetail } from '../updates.model';

@Component({
  selector: 'app-operation-status-dialog',
  imports: [NgIcon, TranslocoPipe, Button, Modal, SettingsNotice],
  providers: [
    provideIcons({
      tablerAlertTriangle,
      tablerArrowRight,
      tablerLoader2,
      tablerPackage,
      tablerShieldCheck,
    }),
  ],
  templateUrl: './operation-status-dialog.html',
})
export class OperationStatusDialog {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required(Modal);

  readonly operation = input<TenantOperationDetail | null>(null);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly autoRefreshStopped = input(false);
  readonly snapshotItems = input<readonly SnapshotItem[] | null>(null);

  readonly refresh = output<void>();
  readonly closed = output<void>();

  protected readonly isActiveStatus = computed(() => {
    const status = this.operation()?.status;
    return status === 'REQUESTED' || status === 'PLANNING' || status === 'QUEUED' || status === 'RUNNING';
  });

  protected readonly headerIcon = computed(() => {
    const op = this.operation();
    if (!op) {
      return this.error() ? 'tablerAlertTriangle' : 'tablerLoader2';
    }
    switch (op.status) {
      case 'REQUESTED':
      case 'PLANNING':
      case 'QUEUED':
      case 'RUNNING':
        return 'tablerLoader2';
      case 'WAITING_RETRY':
      case 'CANCEL_REQUESTED':
      case 'MANUAL_RECOVERY_REQUIRED':
      case 'FAILED_RETRYABLE':
        return 'tablerAlertTriangle';
      case 'SUCCEEDED':
        return 'tablerShieldCheck';
      case 'CANCELLED':
      default:
        return 'tablerPackage';
    }
  });

  protected readonly headerTile = computed(() => {
    const op = this.operation();
    if (!op) {
      return this.error() ? 'bg-icon-orange' : 'bg-icon-blue';
    }
    switch (op.status) {
      case 'REQUESTED':
      case 'PLANNING':
      case 'QUEUED':
      case 'RUNNING':
      case 'CANCELLED':
        return 'bg-icon-blue';
      case 'WAITING_RETRY':
      case 'CANCEL_REQUESTED':
      case 'MANUAL_RECOVERY_REQUIRED':
        return 'bg-icon-orange';
      case 'SUCCEEDED':
        return 'bg-icon-green';
      case 'FAILED_RETRYABLE':
        return 'bg-icon-red';
      default:
        return 'bg-icon-blue';
    }
  });

  protected readonly statusBadgeClass = computed(() => {
    const status = this.operation()?.status ?? '';
    return badgeClassForTone(statusTone(status));
  });

  protected readonly statusKey = computed(() =>
    statusLabelKey(this.operation()?.status ?? ''),
  );

  protected readonly guidanceKey = computed(() =>
    guidanceKeyForStatus(this.operation()?.status ?? ''),
  );

  protected readonly mappedSafeError = computed(() => {
    this.i18n();
    const code = this.operation()?.safeError?.code;
    if (!code) return null;
    const key = `wsUpdates.errors.${code}`;
    const translated = this.transloco.translate(key);
    return translated && translated !== key ? translated : null;
  });

  protected readonly formattedUpdated = computed(() => {
    const op = this.operation();
    return op ? formatDateTime(op.updatedAt, this.language()) : '';
  });

  protected readonly clampedPercent = computed(() => {
    const percent = this.operation()?.progress.percent ?? 0;
    return Math.min(100, Math.max(0, percent));
  });

  protected readonly progressFillClass = computed(() => {
    const status = this.operation()?.status;
    if (status === 'SUCCEEDED') return 'bg-success';
    if (status === 'FAILED_RETRYABLE') return 'bg-danger';
    if (status === 'WAITING_RETRY' || status === 'MANUAL_RECOVERY_REQUIRED') return 'bg-warning';
    return 'bg-brand';
  });

  private readonly snapshotKeySet = computed<ReadonlySet<string> | null>(() => {
    const items = this.snapshotItems();
    if (!items || items.length === 0) return null;
    return new Set(items.map((i) => i.selection.componentKey));
  });

  open(): void {
    this.modal().open();
  }

  close(): void {
    this.modal().close();
  }

  protected isAutoAddedStep(componentKey: string): boolean {
    const keys = this.snapshotKeySet();
    if (!keys) return false;
    return !keys.has(componentKey);
  }
}
