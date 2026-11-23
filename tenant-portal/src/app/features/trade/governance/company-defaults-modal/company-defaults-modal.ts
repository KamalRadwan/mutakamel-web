import { Component, computed, inject, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerInbox, tablerRefresh, tablerStar, tablerTrash } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ScopeState } from '../../../../core/scope/scope';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Modal } from '../../../../shared/ui/modal/modal';
import { errorCodeOf, newIdempotencyKey, tradeContext } from '../../shared/trade-api';
import { ConflictDialog } from '../governance-shared/conflict-dialog/conflict-dialog';
import { isForbiddenError } from '../pricing.service';
import { resolvePricingError } from '../new-version-modal/new-version-modal';
import {
  deleteCompanyDefault,
  listCompanyDefaults,
  listPriceBooks,
  upsertCompanyDefault,
} from '../pricing.api';
import type { CompanyDefault, PriceBookListItem, PricePurpose } from '../pricing.model';

interface DefaultRow {
  key: string;
  purpose: PricePurpose;
  currencyCode: string;
  mapping: CompanyDefault | null;
  books: PriceBookListItem[];
  savedBookId: string;
  draftBookId: string;
}

@Component({
  selector: 'app-company-defaults-modal',
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, ConflictDialog, Dropdown, Modal],
  providers: [provideIcons({ tablerStar, tablerTrash, tablerInbox, tablerAlertTriangle, tablerRefresh })],
  templateUrl: './company-defaults-modal.html',
})
export class CompanyDefaultsModal {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly lang = inject(LanguageState).current;
  private readonly scope = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly modal = viewChild.required(Modal);
  private readonly removeDialog = viewChild.required<ConfirmDialog>('removeDialog');
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');
  private readonly conflictDialog = viewChild.required(ConflictDialog);

  readonly changed = output<void>();
  readonly forbidden = output<void>();

  protected readonly skeletonRows = [0, 1, 2];
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly busyKey = signal<string | null>(null);
  protected readonly rows = signal<DefaultRow[]>([]);
  protected readonly removingRow = signal<DefaultRow | null>(null);
  private readonly discardPromptOpen = signal(false);

  private pendingConflictAction: { type: 'save' | 'remove'; row: DefaultRow } | null = null;
  private allowClose = false;
  private loadSeq = 0;

  protected readonly hasUnsavedRows = computed(() =>
    this.rows().some((row) => row.draftBookId !== row.savedBookId),
  );

  protected readonly removeTargetPurpose = computed(() => {
    this.i18n();
    const row = this.removingRow();
    return row ? this.transloco.translate(`priceBooks.purpose.${row.purpose}`) : '';
  });

  async open(): Promise<void> {
    this.allowClose = false;
    this.pendingConflictAction = null;
    this.modal().open();
    await this.loadData();
  }

  protected bookOptionsFor(row: DefaultRow): DropdownOption<string>[] {
    this.i18n();
    const language = this.lang();
    const items: DropdownOption<string>[] = [];
    if (!row.draftBookId) {
      items.push({
        value: '',
        label: this.transloco.translate('priceBooks.defaults.selectBook'),
      });
    }
    for (const book of row.books) {
      const name =
        book.localizedNames[language] ||
        book.localizedNames['en'] ||
        book.localizedNames['ar'] ||
        book.name ||
        book.code;
      items.push({
        value: book.id,
        label: `${name} (${book.code})`,
      });
    }
    return items;
  }

  protected onBookSelected(rowKey: string, priceBookId: string): void {
    this.rows.update((list) =>
      list.map((row) => (row.key === rowKey ? { ...row, draftBookId: priceBookId } : row)),
    );
  }

  protected isRowDirty(row: DefaultRow): boolean {
    return row.draftBookId !== '' && row.draftBookId !== row.savedBookId;
  }

  protected async saveRow(row: DefaultRow): Promise<void> {
    if (!this.isRowDirty(row) || this.busyKey() !== null) return;
    this.busyKey.set(row.key);
    try {
      await upsertCompanyDefault(
        row.purpose,
        row.currencyCode,
        row.draftBookId,
        row.mapping?.version ?? 0,
        newIdempotencyKey(),
        tradeContext(this.scope, 'COMPANY'),
      );
      this.notify.success(this.transloco.translate('priceBooks.defaults.saved'));
      await this.loadData();
      this.changed.emit();
    } catch (error) {
      if (isForbiddenError(error)) {
        this.allowClose = true;
        this.modal().close();
        this.forbidden.emit();
        return;
      }
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.pendingConflictAction = { type: 'save', row };
        this.conflictDialog().open();
        return;
      }
      this.notify.error(resolvePricingError(this.transloco, error));
    } finally {
      this.busyKey.set(null);
    }
  }

  protected async confirmRemoveRow(row: DefaultRow): Promise<void> {
    if (!row.mapping || this.busyKey() !== null) return;
    this.removingRow.set(row);
    const confirmed = await this.removeDialog().open();
    if (!confirmed) return;

    this.busyKey.set(row.key);
    try {
      await deleteCompanyDefault(
        row.purpose,
        row.currencyCode,
        row.mapping.version,
        newIdempotencyKey(),
        tradeContext(this.scope, 'COMPANY'),
      );
      this.notify.success(this.transloco.translate('priceBooks.defaults.removed'));
      await this.loadData();
      this.changed.emit();
    } catch (error) {
      if (isForbiddenError(error)) {
        this.allowClose = true;
        this.modal().close();
        this.forbidden.emit();
        return;
      }
      if (errorCodeOf(error) === 'TRADE.CONCURRENCY.STALE_VERSION') {
        this.pendingConflictAction = { type: 'remove', row };
        this.conflictDialog().open();
        return;
      }
      this.notify.error(resolvePricingError(this.transloco, error));
    } finally {
      this.busyKey.set(null);
    }
  }

  protected async onConflictReload(): Promise<void> {
    this.pendingConflictAction = null;
    await this.loadData();
    this.changed.emit();
  }

  protected async onConflictKeep(): Promise<void> {
    const pending = this.pendingConflictAction;
    this.pendingConflictAction = null;
    const savedDrafts = new Map(this.rows().map((r) => [r.key, r.draftBookId]));
    await this.loadData();
    if (pending) {
      this.rows.update((list) =>
        list.map((r) => {
          const kept = savedDrafts.get(r.key);
          return kept !== undefined ? { ...r, draftBookId: kept } : r;
        }),
      );
    }
  }

  protected retryLoad(): void {
    void this.loadData();
  }

  protected async requestClose(): Promise<void> {
    if (this.busyKey() !== null) return;
    if (!this.hasUnsavedRows()) {
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
    if (this.hasUnsavedRows() && !this.discardPromptOpen()) {
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

  private async loadData(): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      const ctx = tradeContext(this.scope, 'COMPANY');
      const [defaults, activePage] = await Promise.all([
        listCompanyDefaults(ctx),
        listPriceBooks({ status: 'ACTIVE', limit: 100 }, ctx),
      ]);
      if (seq !== this.loadSeq) return;

      const rowMap = new Map<string, { purpose: PricePurpose; currencyCode: string; mapping: CompanyDefault | null; books: PriceBookListItem[] }>();
      const keyOf = (purpose: PricePurpose, currency: string) => `${purpose}::${currency}`;

      for (const def of defaults.items) {
        const key = keyOf(def.purpose, def.currencyCode);
        rowMap.set(key, {
          purpose: def.purpose,
          currencyCode: def.currencyCode,
          mapping: def,
          books: [],
        });
      }

      for (const book of activePage.items) {
        const key = keyOf(book.purpose, book.currencyCode);
        const existing = rowMap.get(key);
        if (existing) {
          existing.books.push(book);
        } else {
          rowMap.set(key, {
            purpose: book.purpose,
            currencyCode: book.currencyCode,
            mapping: null,
            books: [book],
          });
        }
      }

      const nextRows: DefaultRow[] = Array.from(rowMap.entries())
        .map(([key, entry]) => ({
          key,
          purpose: entry.purpose,
          currencyCode: entry.currencyCode,
          mapping: entry.mapping,
          books: entry.books.sort((a, b) => a.code.localeCompare(b.code)),
          savedBookId: entry.mapping?.priceBookId ?? '',
          draftBookId: entry.mapping?.priceBookId ?? '',
        }))
        .sort((a, b) => {
          if (a.purpose !== b.purpose) return a.purpose === 'SALES' ? -1 : 1;
          return a.currencyCode.localeCompare(b.currencyCode);
        });

      this.rows.set(nextRows);
    } catch (error) {
      if (isForbiddenError(error)) {
        this.allowClose = true;
        this.modal().close();
        this.forbidden.emit();
        return;
      }
      if (seq === this.loadSeq) {
        this.loadFailed.set(true);
        this.notify.error(resolvePricingError(this.transloco, error));
      }
    } finally {
      if (seq === this.loadSeq) {
        this.loading.set(false);
      }
    }
  }
}
