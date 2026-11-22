import {
  Component,
  DestroyRef,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerArrowRight,
  tablerBarcode,
  tablerCopy,
  tablerExternalLink,
  tablerHistory,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { Button } from '../../../../shared/ui/button/button';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { SectionBar } from '../../../../shared/ui/section-bar/section-bar';
import { ApiError } from '../../shared/trade-api';
import { getSerial } from '../inventory.api';
import type { SerialDetail, SerialEventType } from '../inventory.model';
import { errorKey, formatDateTime, itemName, shortId } from '../inventory.service';
import { InventoryBadge } from '../inventory-shared/inventory-badge/inventory-badge';

const LIFECYCLE_PAGE_LIMIT = 500;
const SKELETON_FIELDS = [0, 1, 2, 3] as const;
const SKELETON_EVENTS = [0, 1, 2] as const;

function timelineDotClass(eventType: SerialEventType): string {
  switch (eventType) {
    case 'OPENING':
    case 'RECEIPT':
      return 'bg-icon-green';
    case 'RESERVATION':
      return 'bg-warning';
    case 'DELIVERY':
      return 'bg-icon-blue';
    case 'RECEIPT_REVERSAL':
    case 'DELIVERY_REVERSAL':
      return 'bg-danger';
    case 'RELEASE':
    case 'EXPIRY':
      return 'bg-icon-gray';
  }
}

@Component({
  selector: 'app-serial-modal',
  imports: [TranslocoPipe, NgIcon, Button, Field, Modal, SectionBar, InventoryBadge],
  providers: [
    provideTranslocoScope('settings', { scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-inventory', alias: 'tradeInventory' }, { scope: 'trade-inventory-evidence', alias: 'invEvidence' }),
    provideIcons({
      tablerBarcode,
      tablerCopy,
      tablerHistory,
      tablerArrowRight,
      tablerExternalLink,
      tablerAlertTriangle,
    }),
  ],
  templateUrl: './serial-modal.html',
})
export class SerialModal {
  private static nextId = 0;
  protected readonly uid = `serial-modal-${++SerialModal.nextId}`;

  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required(Modal);

  readonly closed = output<void>();

  protected readonly skeletonFields = SKELETON_FIELDS;
  protected readonly skeletonEvents = SKELETON_EVENTS;
  protected readonly lifecycleLimit = LIFECYCLE_PAGE_LIMIT;

  protected readonly currentId = signal<string | null>(null);
  protected readonly serial = signal<SerialDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly errorMessageKey = signal('tradeInventory.errors.generic');

  private loadSeq = 0;
  private suppressClosed = false;
  private destroyed = false;

  protected readonly subtitleLtr = computed(() => {
    const key = this.serial()?.serialKey?.trim();
    return key ? `\u2066${key}\u2069` : '';
  });

  protected readonly itemLabel = computed(() => {
    const unit = this.serial();
    if (!unit) return '';
    const name = itemName(unit.itemNames, this.language());
    return name ? `${unit.itemCode} — ${name}` : unit.itemCode;
  });

  protected readonly currentNodeLabel = computed(() => {
    this.i18n();
    const unit = this.serial();
    if (!unit) return '';
    return unit.currentNodeName?.trim() || this.transloco.translate('tradeInventory.common.none');
  });

  protected readonly reservationDisplay = computed(() => {
    this.i18n();
    const resId = this.serial()?.currentReservationId;
    return resId ? shortId(resId) : this.transloco.translate('tradeInventory.common.none');
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.loadSeq += 1;
    });
  }

  open(id: string): void {
    this.currentId.set(id);
    this.serial.set(null);
    this.loadFailed.set(false);
    this.loading.set(true);
    this.modal().open();
    void this.loadSerial(id);
  }

  close(): void {
    this.modal().close();
  }

  closeSilently(): void {
    this.loadSeq += 1;
    this.suppressClosed = true;
    try {
      this.modal().close();
    } finally {
      this.suppressClosed = false;
    }
  }

  protected retry(): void {
    const id = this.currentId();
    if (!id) return;
    this.loadFailed.set(false);
    this.loading.set(true);
    void this.loadSerial(id);
  }

  protected onModalClosed(): void {
    this.loadSeq += 1;
    if (!this.suppressClosed) {
      this.closed.emit();
    }
  }

  protected dotClass(eventType: SerialEventType): string {
    return timelineDotClass(eventType);
  }

  protected formatDateTime(iso: string): string {
    return formatDateTime(iso);
  }

  protected openMovement(ledgerEntryId: string): void {
    this.closeSilently();
    void this.router.navigate(['/trade/inventory/movements', ledgerEntryId]);
  }

  protected async copyText(value: string | null | undefined): Promise<void> {
    const clean = value?.trim();
    if (!clean) return;
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(clean);
      this.notify.success(this.transloco.translate('tradeInventory.common.copied'));
    } catch {
      this.notify.error(this.transloco.translate('tradeInventory.errors.generic'));
    }
  }

  private async loadSerial(id: string): Promise<void> {
    const seq = ++this.loadSeq;
    try {
      const detail = await getSerial(id);
      if (this.destroyed || seq !== this.loadSeq) return;
      this.serial.set(detail);
      this.loading.set(false);
    } catch (error) {
      if (this.destroyed || seq !== this.loadSeq) return;
      this.loading.set(false);
      if (error instanceof ApiError && error.status === 404) {
        this.notify.error(this.transloco.translate(errorKey(error)));
        this.modal().close();
        return;
      }
      this.errorMessageKey.set(errorKey(error));
      this.loadFailed.set(true);
    }
  }
}
