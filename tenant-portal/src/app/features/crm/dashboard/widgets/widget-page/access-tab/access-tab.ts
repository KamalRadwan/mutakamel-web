import { Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerShare, tablerUser, tablerUsers } from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../../core/i18n/language';
import { Notify } from '../../../../../../core/notify/notify';
import { Badge } from '../../../../../../shared/ui/badge/badge';
import { Button } from '../../../../../../shared/ui/button/button';
import { DASH, formatDate } from '../../../../../../shared/ui/chart/chart-format';
import { DataCell, DataColumn, DataTable } from '../../../../../../shared/ui/data-table/data-table';
import { FullState } from '../../../../../../shared/ui/full-state/full-state';
import { listShareTargets } from '../../../../../../shared/widgets/dashboard/analytics.api';
import type { ShareListItem } from '../../../../../../shared/widgets/dashboard/analytics.model';
import { can } from '../../../../../../shared/widgets/dashboard/analytics-permissions';
import { ShareModal, type ShareApi } from '../../../shared/share-modal/share-modal';
import {
  addWidgetShare,
  listWidgetShares,
  previewWidgetShare,
  revokeWidgetShare,
  updateWidgetShare,
} from '../../widgets.api';
import type { WidgetDetail } from '../../widgets.model';
import { widgetErrorMessage, widgetReadFailure, widgetWriteReadOnly, type WidgetReadFailure } from '../../builder/builder-errors';

@Component({
  selector: 'app-access-tab',
  imports: [TranslocoPipe, NgIcon, Badge, Button, DataTable, DataCell, FullState, ShareModal],
  providers: [provideIcons({ tablerShare, tablerUser, tablerUsers })],
  templateUrl: './access-tab.html',
  host: { class: 'block min-w-0' },
})
export class AccessTab {
  private readonly notify = inject(Notify);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly language = inject(LanguageState).current;

  private readonly shareModal = viewChild.required(ShareModal);
  private readonly shareHost = viewChild<ElementRef<HTMLElement>>('shareHost');

  readonly widget = input.required<WidgetDetail>();
  readonly refreshToken = input(0);
  readonly countChange = output<number>();
  readonly becameReadOnly = output<void>();
  readonly forceReadOnly = input(false);
  readonly requestAccess = output<void>();

  protected readonly dash = DASH;
  protected readonly shares = signal<ShareListItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly readFailure = signal<WidgetReadFailure | null>(null);
  private readonly writesReadOnly = signal(false);

  private loadSeq = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);

    effect((onCleanup) => {
      const hostEl = this.shareHost()?.nativeElement;
      if (!hostEl) return;
      const onClose = () => {
        void this.loadShares(this.widget().id, true);
      };
      hostEl.addEventListener('close', onClose, { capture: true });
      onCleanup(() => hostEl.removeEventListener('close', onClose, { capture: true }));
    });

    effect(() => {
      const id = this.widget().id;
      this.refreshToken();
      void this.loadShares(id);
    });

    destroyRef.onDestroy(() => {
      this.loadSeq++;
    });
  }

  protected readonly canManage = computed(() => {
    const w = this.widget();
    return !this.writesReadOnly() && !this.forceReadOnly()
      && can('crm.widgets.share') && (w.accessLevel === 'OWNER' || w.accessLevel === 'EDIT');
  });

  protected readonly columns = computed<DataColumn[]>(() => {
    this.i18n();
    this.language();
    return [
      { key: 'name', label: this.transloco.translate('widgetPage.access.name'), width: 2.5 },
      { key: 'type', label: this.transloco.translate('widgetPage.access.type'), width: 1 },
      { key: 'access', label: this.transloco.translate('widgetPage.access.access'), width: 1.2 },
      { key: 'expires', label: this.transloco.translate('widgetPage.access.expires'), width: 1.2 },
      { key: 'sharedBy', label: this.transloco.translate('widgetPage.access.sharedBy'), width: 1.5 },
    ];
  });

  protected readonly rowKey = (row: ShareListItem): string => row.id;

  protected formatExpiry(iso: string | null): string {
    return iso ? formatDate(iso, this.language()) : DASH;
  }

  protected sharedByName(userId: string): string {
    if (!userId) return DASH;
    const current = this.widget();
    return current.ownerUserId === userId ? current.ownerName ?? userId : userId;
  }

  protected retry(): void {
    void this.loadShares(this.widget().id);
  }

  protected readonly failureText = computed(() => {
    this.i18n();
    const failure = this.readFailure();
    return [failure?.message, failure?.correlationId
      ? this.transloco.translate('widgetPage.requests.correlation', { id: failure.correlationId }) : ''].filter(Boolean).join(' ');
  });

  protected readonly failureAction = computed(() => {
    const failure = this.readFailure();
    return failure?.kind === 'provisioning'
      ? can('crm.analytics.readiness.view') ? 'widgetPage.requests.readiness' : null
      : failure?.requestAccess ? 'widgetPage.requests.requestAccess'
      : failure?.kind === 'load-failure' ? 'analytics.common.retry' : null;
  });

  protected onFailureAction(): void {
    if (this.readFailure()?.kind === 'provisioning' && can('crm.analytics.readiness.view'))
      void this.router.navigateByUrl('/crm/settings/data-readiness');
    else if (this.readFailure()?.requestAccess) this.requestAccess.emit();
    else this.retry();
  }

  protected openShareModal(): void {
    const current = this.widget();
    if (!this.canManage()) return;
    const canAdmin = current.accessLevel !== 'OWNER' && can('crm.widgets.share');
    this.shareModal().open(this.createShareApi(current.id), current.name, canAdmin, 'widget');
  }

  private createShareApi(widgetId: string): ShareApi {
    return {
      list: () => listWidgetShares(widgetId),
      add: async (body, key) => {
        const created = await this.writeShare(addWidgetShare(widgetId, body, key));
        void this.loadShares(widgetId, true);
        return created;
      },
      update: async (shareId, body) => {
        const updated = await this.writeShare(updateWidgetShare(widgetId, shareId, body));
        void this.loadShares(widgetId, true);
        return updated;
      },
      revoke: async (shareId, reason) => {
        await this.writeShare(revokeWidgetShare(widgetId, shareId, reason));
        void this.loadShares(widgetId, true);
      },
      targets: async (search) => (await listShareTargets('widgets', search)).items,
      preview: (subjectType, subjectId) => previewWidgetShare(widgetId, subjectType, subjectId),
    };
  }

  private async writeShare<T>(action: Promise<T>): Promise<T> {
    try {
      return await action;
    } catch (error) {
      if (widgetWriteReadOnly(error)) {
        this.writesReadOnly.set(true);
        this.becameReadOnly.emit();
      }
      throw error;
    }
  }

  private async loadShares(widgetId: string, silent = false): Promise<void> {
    const seq = ++this.loadSeq;
    if (!silent) {
      this.loading.set(true);
      this.loadFailed.set(false);
      this.readFailure.set(null);
    }
    try {
      const items = await listWidgetShares(widgetId);
      if (seq !== this.loadSeq || this.widget().id !== widgetId) return;
      this.shares.set(items);
      this.loadFailed.set(false);
      this.countChange.emit(items.length);
    } catch (error) {
      if (seq !== this.loadSeq || this.widget().id !== widgetId) return;
      if (silent) {
        this.notify.error(
          this.transloco.translate('widgetPage.access.loadError'),
          widgetErrorMessage(error, this.transloco, 'widgetPage'),
        );
      } else {
        this.readFailure.set(widgetReadFailure(error, this.transloco, 'widgetPage'));
        this.loadFailed.set(true);
      }
    } finally {
      if (seq === this.loadSeq && !silent) {
        this.loading.set(false);
      }
    }
  }
}
