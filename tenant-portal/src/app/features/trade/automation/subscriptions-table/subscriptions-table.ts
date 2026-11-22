import { Component, computed, inject, input, output } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerLoader2,
  tablerRefresh,
  tablerSearch,
  tablerWebhook,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { ActionsMenu, type ActionItem, type ActionSelection } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { formatDate } from '../../shared/trade-format';
import { AutomationBadge } from '../automation-shared/automation-badge/automation-badge';
import { type WebhookSubscription, endpointText } from '../webhooks.model';

@Component({
  selector: 'app-subscriptions-table',
  imports: [NgIcon, TranslocoPipe, ActionsMenu, Button, AutomationBadge],
  providers: [provideIcons({ tablerWebhook, tablerLoader2, tablerRefresh, tablerSearch })],
  templateUrl: './subscriptions-table.html',
})
export class SubscriptionsTable {
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;

  readonly rows = input.required<readonly WebhookSubscription[]>();
  readonly loading = input(false);
  readonly loadFailed = input(false);
  readonly hasSearch = input(false);
  readonly canManage = input(true);
  readonly busyId = input<string | null>(null);
  /** Rows whose secret operation is still with the worker (known from their detail, not the list). */
  readonly pendingIds = input<readonly string[]>([]);

  readonly open = output<WebhookSubscription>();
  readonly sendTest = output<WebhookSubscription>();
  readonly toggleStatus = output<WebhookSubscription>();
  readonly rotateSecret = output<WebhookSubscription>();
  readonly create = output<void>();
  readonly retry = output<void>();
  readonly clearSearch = output<void>();

  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  protected readonly columns = computed(() => {
    this.i18n();
    return ['code', 'endpoint', 'scope', 'status', 'secret', 'version', 'updated'] as const;
  });

  protected endpoint(row: WebhookSubscription): string {
    return endpointText(row.endpoint);
  }

  protected isSecretPending(row: WebhookSubscription): boolean {
    return this.pendingIds().includes(row.id) || row.secret?.status === 'PENDING';
  }

  protected formatDateTime(iso: string | null | undefined): string {
    if (!iso) return this.transloco.translate('webhooks.common.none');
    const lang = this.language();
    const datePart = formatDate(iso, lang);
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return datePart;
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${datePart} ${hh}:${mm}`;
  }

  protected menuItems(row: WebhookSubscription): ActionItem[] {
    this.i18n();
    const manage = this.canManage();
    const busy = this.busyId() === row.id;
    const active = row.status === 'ACTIVE';
    const pending = this.isSecretPending(row);

    const items: ActionItem[] = [
      {
        id: 'open',
        title: this.transloco.translate('webhooks.subscriptions.menu.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
    ];

    if (manage) {
      items.push({
        id: 'edit',
        title: this.transloco.translate('webhooks.subscriptions.menu.edit'),
        icon: 'tablerEdit',
        tile: 'bg-icon-orange',
      });
    }

    if (manage && active) {
      items.push({
        id: 'sendTest',
        title: this.transloco.translate('webhooks.subscriptions.menu.sendTest'),
        icon: 'tablerSend',
        tile: 'bg-icon-teal',
        disabled: busy,
      });
    }

    // Enabling needs the current secret to be ACTIVE (PATCH status-only rule).
    const secretActive = row.secret?.status === 'ACTIVE';
    if (manage && (active || secretActive)) {
      items.push({
        id: 'toggleStatus',
        title: this.transloco.translate(
          active ? 'webhooks.subscriptions.menu.disable' : 'webhooks.subscriptions.menu.enable',
        ),
        icon: active ? 'tablerCircleOff' : 'tablerCheck',
        tile: active ? 'bg-icon-gray' : 'bg-icon-green',
        disabled: busy || pending,
      });
    }

    if (manage && active && secretActive && !pending) {
      items.push({
        id: 'rotateSecret',
        title: this.transloco.translate('webhooks.subscriptions.menu.rotateSecret'),
        icon: 'tablerRefresh',
        tile: 'bg-icon-navy',
        disabled: busy,
      });
    }

    return items;
  }

  protected onRowKeydown(event: KeyboardEvent, row: WebhookSubscription): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.open.emit(row);
    }
  }

  protected onMenuSelected(row: WebhookSubscription, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
      case 'edit':
        this.open.emit(row);
        break;
      case 'sendTest':
        this.sendTest.emit(row);
        break;
      case 'toggleStatus':
        this.toggleStatus.emit(row);
        break;
      case 'rotateSecret':
        this.rotateSecret.emit(row);
        break;
    }
  }
}
