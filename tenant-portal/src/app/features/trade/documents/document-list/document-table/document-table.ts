import { Component, ElementRef, computed, effect, inject, input, output, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArrowDown,
  tablerArrowsSort,
  tablerArrowUp,
  tablerExternalLink,
  tablerMinus,
  tablerPencil,
  tablerPrinter,
  tablerTransform,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Checkbox } from '../../../../../shared/ui/checkbox/checkbox';
import { formatDate, formatMoney } from '../../../shared/trade-format';
import { KIND_CONFIG } from '../../shared/document-kinds';
import { DocumentSelection } from '../../shared/document-selection';
import { STATUS_TONE_CLASSES, StatusBadge, statusBadge } from '../../shared/document-status';
import { documentGrandTotal } from '../../shared/document.model';
import type {
  AnyDocument,
  DocumentKind,
  PurchaseOrder,
  PurchaseQuotation,
  Quotation,
  SalesOrder,
  SortOrder,
} from '../../shared/document.model';
import {
  DEFAULT_DOCUMENT_ROW_PERMS,
  DocumentRowActionId,
  DocumentRowMenuPerms,
  rowMenu,
} from '../document-row-menu';
import { translationEvents } from '../../../../../core/i18n/translation-events';

export type DocumentSortField = 'documentNumber' | 'businessDate' | 'grandTotal' | 'updatedAt';

type TableColumnKey =
  | 'number'
  | 'party'
  | 'status'
  | 'approval'
  | 'dispatch'
  | 'validUntil'
  | 'businessDate'
  | 'grandTotal'
  | 'lastUpdate';

interface TableColumnSpec {
  readonly key: TableColumnKey;
  readonly labelKey: string;
  readonly sort?: DocumentSortField;
  readonly alignEnd?: boolean;
}

const COLUMNS_BY_KIND: Readonly<Record<DocumentKind, readonly TableColumnSpec[]>> = {
  quotation: [
    { key: 'number', labelKey: 'tdl.columns.number', sort: 'documentNumber' },
    { key: 'party', labelKey: 'tdl.columns.customer' },
    { key: 'status', labelKey: 'tdl.columns.status' },
    { key: 'validUntil', labelKey: 'tdl.columns.validUntil' },
    { key: 'businessDate', labelKey: 'tdl.columns.businessDate', sort: 'businessDate' },
    { key: 'grandTotal', labelKey: 'tdl.columns.grandTotal', sort: 'grandTotal', alignEnd: true },
    { key: 'lastUpdate', labelKey: 'tdl.columns.lastUpdate', sort: 'updatedAt' },
  ],
  'sales-order': [
    { key: 'number', labelKey: 'tdl.columns.number', sort: 'documentNumber' },
    { key: 'party', labelKey: 'tdl.columns.customer' },
    { key: 'status', labelKey: 'tdl.columns.status' },
    { key: 'businessDate', labelKey: 'tdl.columns.businessDate', sort: 'businessDate' },
    { key: 'grandTotal', labelKey: 'tdl.columns.grandTotal', sort: 'grandTotal', alignEnd: true },
    { key: 'lastUpdate', labelKey: 'tdl.columns.lastUpdate', sort: 'updatedAt' },
  ],
  'purchase-order': [
    { key: 'number', labelKey: 'tdl.columns.number', sort: 'documentNumber' },
    { key: 'party', labelKey: 'tdl.columns.supplier' },
    { key: 'status', labelKey: 'tdl.columns.status' },
    { key: 'approval', labelKey: 'tdl.columns.approval' },
    { key: 'dispatch', labelKey: 'tdl.columns.dispatch' },
    { key: 'grandTotal', labelKey: 'tdl.columns.grandTotal', sort: 'grandTotal', alignEnd: true },
    { key: 'businessDate', labelKey: 'tdl.columns.businessDate', sort: 'businessDate' },
  ],
  'purchase-quotation': [
    { key: 'number', labelKey: 'tdl.columns.number', sort: 'documentNumber' },
    { key: 'party', labelKey: 'tdl.columns.supplier' },
    { key: 'status', labelKey: 'tdl.columns.status' },
    { key: 'validUntil', labelKey: 'tdl.columns.validUntil' },
    { key: 'grandTotal', labelKey: 'tdl.columns.grandTotal', sort: 'grandTotal', alignEnd: true },
    { key: 'businessDate', labelKey: 'tdl.columns.businessDate', sort: 'businessDate' },
  ],
};

const GRID_TEMPLATE_BY_KIND: Readonly<Record<DocumentKind, string>> = {
  quotation:
    'grid-cols-trade-doc-quotation-row',
  'sales-order':
    'grid-cols-trade-doc-sales-order-row',
  'purchase-order':
    'grid-cols-trade-doc-purchase-order-row',
  'purchase-quotation':
    'grid-cols-trade-doc-purchase-quotation-row',
};

const BADGE_BASE =
  'inline-flex h-badge shrink-0 items-center rounded-8 px-8 text-12 font-medium whitespace-nowrap';

@Component({
  selector: 'app-document-table',
  imports: [NgIcon, TranslocoPipe, ActionsMenu, Checkbox],
  providers: [
    provideIcons({
      tablerMinus,
      tablerArrowsSort,
      tablerArrowUp,
      tablerArrowDown,
      tablerExternalLink,
      tablerPencil,
      tablerPrinter,
      tablerTransform,
    }),
  ],
  templateUrl: './document-table.html',
  host: { class: 'flex flex-1 shrink-0 flex-col' },
})
export class DocumentTable {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly headerCheckboxEl = viewChild('pageCb', { read: ElementRef<HTMLElement> });
  protected readonly selection = inject(DocumentSelection, { optional: true });
  protected readonly language = inject(LanguageState).current;

  readonly kind = input.required<DocumentKind>();
  readonly items = input.required<readonly AnyDocument[]>();
  readonly loading = input(false);
  readonly sort = input<DocumentSortField | null>(null);
  readonly order = input<SortOrder>('desc');
  readonly perms = input<DocumentRowMenuPerms>(DEFAULT_DOCUMENT_ROW_PERMS);

  readonly open = output<AnyDocument>();
  readonly action = output<{ row: AnyDocument; action: DocumentRowActionId }>();
  readonly sortChange = output<DocumentSortField>();

  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  private lastClickedId: string | null = null;
  private lastShiftKey = false;

  protected readonly columns = computed(() => COLUMNS_BY_KIND[this.kind()]);
  protected readonly gridCols = computed(() => GRID_TEMPLATE_BY_KIND[this.kind()]);
  protected readonly tableAriaLabel = computed(() => {
    this.i18n();
    return this.transloco.translate(KIND_CONFIG[this.kind()].titleKey);
  });

  protected readonly pageIds = computed<string[]>(() => this.items().map((row) => row.id));
  protected readonly pageState = computed<'none' | 'some' | 'all'>(() =>
    this.selection && this.pageIds().length > 0 ? this.selection.pageState(this.pageIds()) : 'none',
  );

  constructor() {
    effect(() => {
      const state = this.pageState();
      const inputEl = this.headerCheckboxEl()?.nativeElement.querySelector(
        'input[type="checkbox"]',
      ) as HTMLInputElement | null;
      if (inputEl) {
        inputEl.indeterminate = state === 'some';
      }
    });
  }

  protected ariaSortFor(field: DocumentSortField | undefined): 'ascending' | 'descending' | 'none' | null {
    if (!field) return null;
    if (this.sort() !== field) return 'none';
    return this.order() === 'asc' ? 'ascending' : 'descending';
  }

  protected sortIconFor(field: DocumentSortField): string {
    if (this.sort() !== field) return 'tablerArrowsSort';
    return this.order() === 'asc' ? 'tablerArrowUp' : 'tablerArrowDown';
  }

  protected isSortActive(field: DocumentSortField): boolean {
    return this.sort() === field;
  }

  protected onSortClick(field: DocumentSortField): void {
    this.sortChange.emit(field);
  }

  protected sortAriaLabel(labelKey: string): string {
    this.i18n();
    const column = this.transloco.translate(labelKey);
    return this.transloco.translate('tdl.table.sortBy', { column });
  }

  protected isSelected(id: string): boolean {
    return this.selection?.isSelected(id) ?? false;
  }

  protected rowLabel(row: AnyDocument): string {
    this.i18n();
    return row.documentNumber ?? row.draftReference ?? this.transloco.translate('td.status.DRAFT');
  }

  protected togglePage(cb?: Checkbox): void {
    if (!this.selection || this.pageIds().length === 0) {
      cb?.checked.set(false);
      return;
    }
    this.selection.togglePage(this.pageIds());
    cb?.checked.set(this.pageState() === 'all');
  }

  protected onRowCheckboxClick(event: MouseEvent): void {
    this.lastShiftKey = event.shiftKey;
    event.stopPropagation();
  }

  protected onRowCheckedChange(row: AnyDocument, cb?: Checkbox): void {
    const shift = this.lastShiftKey;
    this.lastShiftKey = false;
    this.applyRowSelection(row, shift);
    cb?.checked.set(this.isSelected(row.id));
  }

  protected onSelectCellClick(event: MouseEvent, row: AnyDocument, cb?: Checkbox): void {
    event.stopPropagation();
    if (!this.selection) return;
    if (event.target instanceof Element && event.target.closest('ui-checkbox')) return;
    this.applyRowSelection(row, event.shiftKey);
    cb?.checked.set(this.isSelected(row.id));
  }

  protected onRowKeydown(event: KeyboardEvent, row: AnyDocument): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === ' ' || event.code === 'Space') {
      if (!this.selection) return;
      event.preventDefault();
      this.applyRowSelection(row, event.shiftKey);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.open.emit(row);
    }
  }

  protected lifecycleBadge(row: AnyDocument): StatusBadge {
    return statusBadge(this.kind(), 'lifecycle', row.lifecycleStatus);
  }

  protected isSalesOrderHeld(row: AnyDocument): boolean {
    return this.kind() === 'sales-order' && (row as SalesOrder).holdStatus === 'HELD';
  }

  protected holdBadge(): StatusBadge {
    return statusBadge('sales-order', 'hold', 'HELD');
  }

  protected approvalBadge(row: AnyDocument): StatusBadge | null {
    if (this.kind() !== 'purchase-order') return null;
    const status = (row as PurchaseOrder).approvalStatus;
    return status === 'NOT_REQUIRED' ? null : statusBadge('purchase-order', 'approval', status);
  }

  protected dispatchBadge(row: AnyDocument): StatusBadge | null {
    if (this.kind() !== 'purchase-order') return null;
    const status = (row as PurchaseOrder).dispatchStatus;
    return status === 'NOT_REQUESTED' ? null : statusBadge('purchase-order', 'dispatch', status);
  }

  protected badgeClass(badge: StatusBadge): string {
    return `${BADGE_BASE} ${STATUS_TONE_CLASSES[badge.tone]}`;
  }

  protected badgeLabel(labelKey: string): string {
    this.i18n();
    const translated = this.transloco.translate(labelKey);
    return translated && translated !== labelKey
      ? translated
      : this.transloco.translate('td.common.unknownStatus');
  }

  protected validUntilText(row: AnyDocument): string {
    const kind = this.kind();
    const iso =
      kind === 'quotation'
        ? ((row as Quotation).currentRevision?.validUntil ?? '')
        : kind === 'purchase-quotation'
          ? ((row as PurchaseQuotation).validUntil ?? '')
          : '';
    return iso ? formatDate(iso, this.language()) : '—';
  }

  protected isPriceLockExpired(row: AnyDocument): boolean {
    if (this.kind() !== 'quotation' || row.lifecycleStatus !== 'SENT') return false;
    const expiresAt = (row as Quotation).currentRevision?.priceLockExpiresAt;
    if (!expiresAt) return false;
    const expiresMs = Date.parse(expiresAt);
    return !Number.isNaN(expiresMs) && expiresMs < Date.now();
  }

  protected moneyText(row: AnyDocument): string {
    return formatMoney(row.currencyCode, documentGrandTotal(row));
  }

  protected dateText(iso: string): string {
    return formatDate(iso, this.language());
  }

  protected menuItems(row: AnyDocument): ActionItem[] {
    this.i18n();
    return rowMenu(this.kind(), row, this.perms(), (key) => this.transloco.translate(key));
  }

  protected onAction(row: AnyDocument, selection: ActionSelection): void {
    this.action.emit({ row, action: selection.id as DocumentRowActionId });
  }

  private applyRowSelection(row: AnyDocument, shiftKey: boolean): void {
    if (!this.selection) return;
    const rows = this.items();
    if (shiftKey && this.lastClickedId) {
      const startIndex = rows.findIndex((item) => item.id === this.lastClickedId);
      const endIndex = rows.findIndex((item) => item.id === row.id);
      if (startIndex !== -1 && endIndex !== -1) {
        const from = Math.min(startIndex, endIndex);
        const to = Math.max(startIndex, endIndex);
        for (const item of rows.slice(from, to + 1)) {
          if (!this.selection.isSelected(item.id)) {
            this.selection.toggle(item.id);
          }
        }
        this.lastClickedId = row.id;
        return;
      }
    }
    this.selection.toggle(row.id);
    this.lastClickedId = row.id;
  }
}
