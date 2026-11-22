import { Component, computed, inject, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerBook } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { Segmented, type SegmentedOption } from '../../../../shared/ui/segmented/segmented';
import { errorCodeOf, newIdempotencyKey } from '../../shared/trade-api';
import { resolvePricingError } from '../new-version-modal/new-version-modal';
import { createPriceBook, getReferenceData } from '../pricing.api';
import type { CreatedPriceBook, CreatePriceBookInput, PricePurpose, ReferenceCurrency } from '../pricing.model';

const MAX_CODE = 80;
const MAX_NAME = 160;
const MAX_DESCRIPTION = 500;

@Component({
  selector: 'app-price-book-modal',
  imports: [TranslocoPipe, Button, ConfirmDialog, Dropdown, Field, Modal, Segmented],
  providers: [provideIcons({ tablerBook })],
  templateUrl: './price-book-modal.html',
})
export class PriceBookModal {
  private static nextId = 0;
  protected readonly uid = `gov-pb-modal-${++PriceBookModal.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly lang = inject(LanguageState).current;
  private readonly notify = inject(Notify);
  private readonly modal = viewChild.required(Modal);
  private readonly discardDialog = viewChild.required(ConfirmDialog);

  readonly created = output<CreatedPriceBook>();

  protected readonly maxCode = MAX_CODE;
  protected readonly maxName = MAX_NAME;
  protected readonly maxDescription = MAX_DESCRIPTION;

  protected readonly currencies = signal<ReferenceCurrency[]>([]);
  protected readonly defaultCurrency = signal('EGP');

  protected readonly code = signal('');
  protected readonly purpose = signal<PricePurpose>('SALES');
  protected readonly currencyCode = signal('EGP');
  protected readonly nameEn = signal('');
  protected readonly nameAr = signal('');
  protected readonly description = signal('');

  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly codeServerError = signal<string | null>(null);
  private readonly discardPromptOpen = signal(false);

  private idempotencyKey: string | null = null;
  private lastFingerprint: string | null = null;
  private allowClose = false;

  protected readonly dirty = computed(
    () =>
      this.code().trim() !== '' ||
      this.purpose() !== 'SALES' ||
      this.currencyCode() !== this.defaultCurrency() ||
      this.nameEn().trim() !== '' ||
      this.nameAr().trim() !== '' ||
      this.description().trim() !== '',
  );

  protected readonly purposeOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    return [
      { value: 'SALES', label: this.transloco.translate('priceBooks.purpose.SALES') },
      { value: 'PURCHASE', label: this.transloco.translate('priceBooks.purpose.PURCHASE') },
    ];
  });

  protected readonly currencyOptions = computed<DropdownOption<string>[]>(() => {
    const language = this.lang();
    return this.currencies().map((c) => ({
      value: c.code,
      label: `${c.code} — ${language === 'ar' ? c.nameAr : c.nameEn}`,
    }));
  });

  protected readonly codeError = computed<string | null>(() => {
    this.i18n();
    const srv = this.codeServerError();
    if (srv) return srv;
    if (!this.submitted()) return null;
    const trimmed = this.code().trim();
    if (!trimmed) {
      return this.transloco.translate('priceBooks.create.errors.codeRequired');
    }
    if (trimmed.length > MAX_CODE) {
      return this.transloco.translate('priceBooks.create.errors.codeMax');
    }
    return null;
  });

  protected readonly currencyError = computed<string | null>(() => {
    this.i18n();
    if (!this.submitted()) return null;
    if (!this.currencyCode().trim()) {
      return this.transloco.translate('priceBooks.create.errors.currencyRequired');
    }
    return null;
  });

  protected readonly nameEnError = computed<string | null>(() => {
    this.i18n();
    if (!this.submitted()) return null;
    if (this.nameEn().trim().length > MAX_NAME) {
      return this.transloco.translate('priceBooks.create.errors.nameMax');
    }
    return null;
  });

  protected readonly nameArError = computed<string | null>(() => {
    this.i18n();
    if (!this.submitted()) return null;
    if (this.nameAr().trim().length > MAX_NAME) {
      return this.transloco.translate('priceBooks.create.errors.nameMax');
    }
    return null;
  });

  protected readonly descriptionError = computed<string | null>(() => {
    this.i18n();
    if (!this.submitted()) return null;
    if (this.description().trim().length > MAX_DESCRIPTION) {
      return this.transloco.translate('priceBooks.create.errors.descriptionMax');
    }
    return null;
  });

  async open(): Promise<void> {
    this.allowClose = false;
    this.resetForm();
    this.modal().open();

    try {
      const ref = await getReferenceData();
      this.currencies.set(ref.currencies);
      const first = ref.currencies[0]?.code ?? 'EGP';
      this.defaultCurrency.set(first);
      if (!this.dirty()) {
        this.currencyCode.set(first);
      }
    } catch (error) {
      this.notify.error(resolvePricingError(this.transloco, error));
    }
  }

  protected onCodeInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value.slice(0, MAX_CODE);
    this.code.set(value);
    if (this.codeServerError()) {
      this.codeServerError.set(null);
    }
  }

  protected onCodeBlur(): void {
    const normalized = this.code().trim().toUpperCase();
    if (normalized !== this.code()) {
      this.code.set(normalized);
    }
  }

  protected onPurposeChange(value: string | null): void {
    if (value === 'SALES' || value === 'PURCHASE') {
      this.purpose.set(value);
    }
  }

  protected onCurrencyChange(code: string): void {
    this.currencyCode.set(code);
  }

  protected onNameEnInput(event: Event): void {
    this.nameEn.set((event.target as HTMLInputElement).value.slice(0, MAX_NAME));
  }

  protected onNameArInput(event: Event): void {
    this.nameAr.set((event.target as HTMLInputElement).value.slice(0, MAX_NAME));
  }

  protected onDescriptionInput(event: Event): void {
    this.description.set((event.target as HTMLTextAreaElement).value.slice(0, MAX_DESCRIPTION));
  }

  protected async submit(): Promise<void> {
    if (this.saving()) return;
    this.onCodeBlur();
    this.submitted.set(true);
    this.codeServerError.set(null);

    if (
      this.codeError() ||
      this.currencyError() ||
      this.nameEnError() ||
      this.nameArError() ||
      this.descriptionError()
    ) {
      return;
    }

    const cleanEn = this.nameEn().trim();
    const cleanAr = this.nameAr().trim();
    const cleanDesc = this.description().trim();
    const localizedNames: Record<string, string> = {};
    if (cleanEn) localizedNames['en'] = cleanEn;
    if (cleanAr) localizedNames['ar'] = cleanAr;

    const body: CreatePriceBookInput = {
      code: this.code().trim().toUpperCase(),
      purpose: this.purpose(),
      currencyCode: this.currencyCode(),
      ...(cleanEn ? { name: cleanEn } : {}),
      ...(Object.keys(localizedNames).length > 0 ? { localizedNames } : {}),
      ...(cleanDesc ? { description: cleanDesc } : {}),
    };

    const fingerprint = JSON.stringify(body);
    if (!this.idempotencyKey || this.lastFingerprint !== fingerprint) {
      this.idempotencyKey = newIdempotencyKey();
      this.lastFingerprint = fingerprint;
    }

    this.saving.set(true);
    try {
      const book = await createPriceBook(body, this.idempotencyKey);
      this.notify.success(this.transloco.translate('priceBooks.create.success'));
      this.allowClose = true;
      this.modal().close();
      this.created.emit(book);
    } catch (error) {
      if (errorCodeOf(error) === 'TRADE.PRICE.BOOK_ALREADY_EXISTS') {
        this.codeServerError.set(resolvePricingError(this.transloco, error));
        return;
      }
      this.notify.error(resolvePricingError(this.transloco, error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async requestClose(): Promise<void> {
    if (this.saving()) return;
    if (!this.dirty()) {
      this.allowClose = true;
      this.modal().close();
      return;
    }
    await this.confirmDiscardAndClose();
  }

  protected onModalClosed(): void {
    if (this.allowClose) {
      this.allowClose = false;
      return;
    }
    if (this.dirty() && !this.discardPromptOpen()) {
      this.modal().open();
      void this.confirmDiscardAndClose();
    }
  }

  private async confirmDiscardAndClose(): Promise<void> {
    if (this.discardPromptOpen()) return;
    this.discardPromptOpen.set(true);
    try {
      const confirmed = await this.discardDialog().open();
      if (confirmed) {
        this.allowClose = true;
        this.modal().close();
      }
    } finally {
      this.discardPromptOpen.set(false);
    }
  }

  private resetForm(): void {
    const defCur = this.defaultCurrency() || 'EGP';
    this.code.set('');
    this.purpose.set('SALES');
    this.currencyCode.set(defCur);
    this.nameEn.set('');
    this.nameAr.set('');
    this.description.set('');
    this.submitted.set(false);
    this.codeServerError.set(null);
    this.idempotencyKey = null;
    this.lastFingerprint = null;
  }
}
