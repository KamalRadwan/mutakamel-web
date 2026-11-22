import { Component, inject, input, output } from '@angular/core';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerBuilding, tablerLockOpen, tablerUser } from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../../../core/i18n/language';
import { type ActionItem, type ActionSelection, ActionsMenu } from '../../../../../shared/ui/actions-menu/actions-menu';
import { formatMoney } from '../../../shared/trade-format';
import {
  ACCOUNT_ROLE_KEY,
  ACCOUNT_STATUS_KEY,
  BADGE_CLASS,
} from '../../../shared/trade-labels';
import { type AccountWithParty, partyDisplayName } from '../commercial-accounts.model';

@Component({
  selector: 'app-account-cards',
  imports: [NgIcon, TranslocoPipe, ActionsMenu],
  providers: [provideIcons({ tablerBuilding, tablerUser, tablerLockOpen })],
  templateUrl: './account-cards.html',
  host: { class: 'flex flex-col' },
})
export class AccountCards {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  readonly accounts = input.required<readonly AccountWithParty[]>();
  readonly loading = input(false);
  readonly canManage = input(true);
  readonly priceBookNames = input<Readonly<Record<string, string>>>({});
  readonly blockReasonNames = input<Readonly<Record<string, string>>>({});

  readonly open = output<AccountWithParty>();
  readonly block = output<AccountWithParty>();
  readonly unblock = output<AccountWithParty>();

  protected readonly skeletonCards = [1, 2, 3, 4, 5, 6] as const;
  protected readonly roleKey = ACCOUNT_ROLE_KEY;
  protected readonly statusKey = ACCOUNT_STATUS_KEY;
  protected readonly badgeClass = BADGE_CLASS;
  protected readonly formatMoney = formatMoney;

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

  protected onCardEnter(event: Event, account: AccountWithParty): void {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    this.open.emit(account);
  }
}
