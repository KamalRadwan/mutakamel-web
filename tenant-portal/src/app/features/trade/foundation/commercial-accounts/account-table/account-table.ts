import { Component, ElementRef, computed, effect, inject, input, output, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerBuilding, tablerLockOpen, tablerMinus, tablerUser } from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { type ActionItem, type ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { Checkbox } from '../../../../../shared/ui/checkbox/checkbox';
import { formatDate, formatMoney } from '../../../shared/trade-format';
import {
  ACCOUNT_ROLE_KEY,
  ACCOUNT_STATUS_KEY,
  BADGE_CLASS,
} from '../../../shared/trade-labels';
import { AccountSelection, toSelectedAccountRow } from '../account-bulk/account-selection';
import { type AccountWithParty, partyDisplayName } from '../commercial-accounts.model';

@Component({
  selector: 'app-account-table',
  imports: [NgIcon, TranslocoPipe, ActionsMenu, Checkbox],
  providers: [provideIcons({ tablerBuilding, tablerUser, tablerLockOpen, tablerMinus })],
  templateUrl: './account-table.html',
  host: { class: 'flex flex-col' },
})
export class AccountTable {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly headerCheckboxEl = viewChild('pageCb', { read: ElementRef<HTMLElement> });
  protected readonly selection = inject(AccountSelection, { optional: true });
  protected readonly language = inject(LanguageState).current;

  readonly accounts = input.required<readonly AccountWithParty[]>();
  readonly loading = input(false);
  readonly canManage = input(true);
  readonly priceBookNames = input<Readonly<Record<string, string>>>({});
  readonly blockReasonNames = input<Readonly<Record<string, string>>>({});

  readonly open = output<AccountWithParty>();
  readonly block = output<AccountWithParty>();
  readonly unblock = output<AccountWithParty>();

  protected readonly skeletonRows = [1, 2, 3, 4, 5, 6] as const;
  protected readonly roleKey = ACCOUNT_ROLE_KEY;
  protected readonly statusKey = ACCOUNT_STATUS_KEY;
  protected readonly badgeClass = BADGE_CLASS;
  protected readonly formatMoney = formatMoney;
  protected readonly formatDate = formatDate;

  private lastClickedId: string | null = null;
  private lastShiftKey = false;

  protected readonly showSelection = computed(() => Boolean(this.selection) && this.canManage());

  protected readonly currentPageIds = computed(() => this.accounts().map((account) => account.id));

  protected readonly pageRows = computed(() => {
    const lang = this.language();
    return this.accounts().map((account) => toSelectedAccountRow(account, lang));
  });

  protected readonly pageState = computed<'none' | 'some' | 'all'>(() =>
    this.showSelection() && this.selection && this.currentPageIds().length > 0
      ? this.selection.pageState(this.currentPageIds())
      : 'none',
  );

  protected readonly gridClass = computed(() => {
    if (this.showSelection() && this.canManage()) {
      return 'grid grid-cols-account-row-select-actions';
    }
    if (this.showSelection()) {
      return 'grid grid-cols-account-row-select';
    }
    if (this.canManage()) {
      return 'grid grid-cols-account-row-actions';
    }
    return 'grid grid-cols-account-row';
  });

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

  protected partyName(account: AccountWithParty): string {
    return partyDisplayName(account.party, this.language()) || account.partyId;
  }

  protected partyTypeLabel(account: AccountWithParty): string {
    this.i18n();
    const type = account.party?.partyType ?? 'ORGANIZATION';
    return this.transloco.translate(`tradeAccounts.partyType.${type}`);
  }

  protected priceBookLabel(account: AccountWithParty): string {
    if (!account.priceBookId) return '—';
    return this.priceBookNames()[account.priceBookId] ?? '—';
  }

  protected blockReasonTitle(account: AccountWithParty): string | null {
    if (account.status !== 'BLOCKED' || !account.blockReasonCode) return null;
    return this.blockReasonNames()[account.blockReasonCode] ?? account.blockReasonCode;
  }

  protected isSelected(id: string): boolean {
    return this.showSelection() && (this.selection?.isSelected(id) ?? false);
  }

  protected togglePage(cb?: Checkbox): void {
    if (!this.showSelection() || !this.selection || !this.pageRows().length) {
      cb?.checked.set(false);
      return;
    }
    const next = this.pageState() !== 'all';
    this.selection.setRows(this.pageRows(), next);
    cb?.checked.set(this.pageState() === 'all');
  }

  protected onRowCheckboxClick(event: MouseEvent): void {
    this.lastShiftKey = event.shiftKey;
    event.stopPropagation();
  }

  protected onRowCheckedChange(account: AccountWithParty, cb?: Checkbox): void {
    const shift = this.lastShiftKey;
    this.lastShiftKey = false;
    this.applyRowSelection(account, shift);
    cb?.checked.set(this.isSelected(account.id));
  }

  protected onSelectCellClick(event: MouseEvent, account: AccountWithParty, cb?: Checkbox): void {
    event.stopPropagation();
    if (!this.showSelection() || !this.selection) return;
    this.applyRowSelection(account, event.shiftKey);
    cb?.checked.set(this.isSelected(account.id));
  }

  protected onRowKeydown(event: KeyboardEvent, account: AccountWithParty): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === ' ' || event.code === 'Space') {
      event.preventDefault();
      if (this.showSelection() && this.selection) {
        this.applyRowSelection(account, event.shiftKey);
      } else {
        this.open.emit(account);
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.open.emit(account);
    }
  }

  protected actionsFor(account: AccountWithParty): ActionItem[] {
    this.i18n();
    const items: ActionItem[] = [
      {
        id: 'open',
        title: this.transloco.translate('tradeShared.common.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
      {
        id: 'edit',
        title: this.transloco.translate('tradeShared.common.edit'),
        icon: 'tablerEdit',
        tile: 'bg-icon-orange',
      },
    ];

    if (account.status === 'ACTIVE') {
      items.push({
        id: 'block',
        title: this.transloco.translate('tradeAccounts.actions.block'),
        icon: 'tablerLock',
        tile: 'bg-icon-red',
        danger: true,
      });
    } else {
      items.push({
        id: 'unblock',
        title: this.transloco.translate('tradeAccounts.actions.unblock'),
        icon: 'tablerLockOpen',
        tile: 'bg-icon-green',
      });
    }

    return items;
  }

  protected onAction(account: AccountWithParty, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
      case 'edit':
        this.open.emit(account);
        break;
      case 'block':
        this.block.emit(account);
        break;
      case 'unblock':
        this.unblock.emit(account);
        break;
    }
  }

  private applyRowSelection(account: AccountWithParty, shiftKey: boolean): void {
    if (!this.selection) return;
    const rows = this.accounts();
    const lang = this.language();
    if (shiftKey && this.lastClickedId) {
      const startIndex = rows.findIndex((row) => row.id === this.lastClickedId);
      const endIndex = rows.findIndex((row) => row.id === account.id);
      if (startIndex !== -1 && endIndex !== -1) {
        const from = Math.min(startIndex, endIndex);
        const to = Math.max(startIndex, endIndex);
        const range = rows.slice(from, to + 1).map((row) => toSelectedAccountRow(row, lang));
        this.selection.setRows(range, true);
        this.lastClickedId = account.id;
        return;
      }
    }
    this.selection.toggle(toSelectedAccountRow(account, lang));
    this.lastClickedId = account.id;
  }
}
