import { Component, computed, inject, input, output } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerClipboardCheck,
  tablerExternalLink,
  tablerFileDescription,
  tablerFileSearch,
  tablerPencil,
  tablerPrinter,
  tablerShoppingCart,
  tablerTransform,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Checkbox } from '../../../../../shared/ui/checkbox/checkbox';
import { formatDate, formatMoney } from '../../../shared/trade-format';
import { KIND_CONFIG, KindConfig } from '../../shared/document-kinds';
import { DocumentSelection } from '../../shared/document-selection';
import { STATUS_TONE_CLASSES, StatusBadge, statusBadge } from '../../shared/document-status';
import { documentGrandTotal } from '../../shared/document.model';
import type { AnyDocument, DocumentKind, Quotation, SalesOrder } from '../../shared/document.model';
import {
  DEFAULT_DOCUMENT_ROW_PERMS,
  DocumentRowActionId,
  DocumentRowMenuPerms,
  rowMenu,
} from '../document-row-menu';
import { translationEvents } from '../../../../../core/i18n/translation-events';

const BADGE_BASE =
  'inline-flex h-badge shrink-0 items-center rounded-8 px-8 text-12 font-medium whitespace-nowrap';

@Component({
  selector: 'app-document-cards',
  imports: [NgIcon, TranslocoPipe, ActionsMenu, Checkbox],
  providers: [
    provideIcons({
      tablerFileDescription,
      tablerClipboardCheck,
      tablerShoppingCart,
      tablerFileSearch,
      tablerExternalLink,
      tablerPencil,
      tablerPrinter,
      tablerTransform,
    }),
  ],
  templateUrl: './document-cards.html',
  host: { class: 'flex flex-1 shrink-0 flex-col' },
})
export class DocumentCards {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly selection = inject(DocumentSelection, { optional: true });
  protected readonly language = inject(LanguageState).current;

  readonly kind = input.required<DocumentKind>();
  readonly items = input.required<readonly AnyDocument[]>();
  readonly loading = input(false);
  readonly perms = input<DocumentRowMenuPerms>(DEFAULT_DOCUMENT_ROW_PERMS);

  readonly open = output<AnyDocument>();
  readonly action = output<{ row: AnyDocument; action: DocumentRowActionId }>();

  protected readonly skeletonCards = [1, 2, 3, 4, 5, 6];
  protected readonly kindConfig = computed<KindConfig>(() => KIND_CONFIG[this.kind()]);

  protected isSelected(id: string): boolean {
    return this.selection?.isSelected(id) ?? false;
  }

  protected rowLabel(row: AnyDocument): string {
    this.i18n();
    return row.documentNumber ?? row.draftReference ?? this.transloco.translate('td.status.DRAFT');
  }

  protected toggleSelect(row: AnyDocument, cb?: Checkbox): void {
    if (!this.selection) return;
    this.selection.toggle(row.id);
    cb?.checked.set(this.isSelected(row.id));
  }

  protected onCardKeydown(event: KeyboardEvent, row: AnyDocument): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      this.open.emit(row);
    } else if (event.key === ' ' || event.code === 'Space') {
      if (!this.selection) return;
      event.preventDefault();
      this.selection.toggle(row.id);
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
}
