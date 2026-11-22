import { Component, DestroyRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerPlus,
  tablerSearch,
  tablerShare,
  tablerUser,
  tablerUsers,
  tablerUsersGroup,
  tablerX,
} from '@ng-icons/tabler-icons';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { Badge } from '../../../../shared/ui/badge/badge';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { DateField } from '../../../../shared/ui/date-time/date-field';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import { SectionBar } from '../../../../shared/ui/section-bar/section-bar';
import { Segmented, type SegmentedOption } from '../../../../shared/ui/segmented/segmented';
import { UnsavedDialog } from '../../../../shared/ui/unsaved-dialog/unsaved-dialog';
import { type TradeContext, errorCodeOf, errorKey, newIdempotencyKey } from '../../shared/trade-api';
import { formatDate } from '../../shared/trade-format';
import { getDashboard, listShareTargets, listShares, revokeShare, upsertShares } from '../trade-dashboard.api';
import { shareTargetName, type DashboardDetail, type Share, type ShareTarget } from '../trade-dashboard.model';

interface PendingShareRow {
  key: string;
  subjectType: 'USER' | 'TEAM';
  subjectId: string;
  name: string;
  accessLevel: 'VIEW' | 'EDIT';
  expiresOn: string | null;
  expiryError: string | null;
}

const SEARCH_DEBOUNCE_MS = 300;
const TARGET_LIMIT = 20;

let nextShareModalSeq = 0;

function localTomorrowIso(): string {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const year = String(tomorrow.getFullYear()).padStart(4, '0');
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function endOfLocalDayIso(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date, 23, 59, 59, 0).toISOString();
}

function targetKey(subjectType: 'USER' | 'TEAM', subjectId: string): string {
  return `${subjectType}-${subjectId}`;
}

@Component({
  selector: 'app-trade-dashboard-share-modal',
  imports: [
    NgIcon,
    TranslocoPipe,
    Badge,
    Button,
    ConfirmDialog,
    DateField,
    Field,
    Modal,
    SectionBar,
    Segmented,
    UnsavedDialog,
  ],
  // Takes inputs, so the component-level scope lives in viewProviders (tenant-portal Transloco rule).
  viewProviders: [
    provideTranslocoScope(
      { scope: 'trade-shared', alias: 'tradeShared' },
      { scope: 'trade-dashboard', alias: 'tradeDashboard' },
      { scope: 'trade-dashboard-modals', alias: 'tradeDashboardModals' },
    ),
  ],
  providers: [
    provideIcons({
      tablerShare,
      tablerUser,
      tablerUsersGroup,
      tablerSearch,
      tablerX,
      tablerPlus,
      tablerUsers,
    }),
  ],
  templateUrl: './dashboard-share-modal.html',
  host: { class: 'contents' },
})
export class DashboardShareModal {
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly modalScope = toSignal(this.transloco.selectTranslation('trade-dashboard-modals'));
  protected readonly language = inject(LanguageState).current;

  private readonly modal = viewChild.required(Modal);
  private readonly revokeConfirm = viewChild.required(ConfirmDialog);
  private readonly unsavedDialog = viewChild.required(UnsavedDialog);

  readonly ctx = input.required<TradeContext>();
  readonly revisionChange = output<number>();

  protected readonly uid = `trade-dash-share-${++nextShareModalSeq}`;
  protected readonly dashboardName = signal('');
  protected readonly searchText = signal('');
  protected readonly targets = signal<ShareTarget[]>([]);
  protected readonly loadingTargets = signal(false);
  protected readonly pendingRows = signal<PendingShareRow[]>([]);
  protected readonly shares = signal<Share[]>([]);
  protected readonly loadingShares = signal(false);
  protected readonly sharesLoadFailed = signal(false);
  protected readonly submitting = signal(false);
  protected readonly revokingId = signal<string | null>(null);
  protected readonly revokingTarget = signal<Share | null>(null);

  private dashboardId = '';
  private revision = 0;
  private openSeq = 0;
  private targetSeq = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private confirmingUnsaved = false;

  protected readonly accessOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    this.modalScope();
    return [
      { value: 'VIEW', label: this.transloco.translate('tradeDashboardModals.access.VIEW') },
      { value: 'EDIT', label: this.transloco.translate('tradeDashboardModals.access.EDIT') },
    ];
  });

  protected readonly pendingKeys = computed(() => new Set(this.pendingRows().map((row) => row.key)));

  protected readonly tomorrowIso = signal(localTomorrowIso());

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.openSeq++;
      this.targetSeq++;
      this.clearSearchTimer();
    });
  }

  open(detail: DashboardDetail): void {
    const seq = ++this.openSeq;
    this.clearSearchTimer();
    this.tomorrowIso.set(localTomorrowIso());
    this.dashboardId = detail.id;
    this.revision = detail.revision;
    this.dashboardName.set(detail.name);
    this.searchText.set('');
    this.targets.set([]);
    this.pendingRows.set([]);
    this.shares.set([]);
    this.sharesLoadFailed.set(false);
    this.submitting.set(false);
    this.revokingId.set(null);
    this.revokingTarget.set(null);

    this.modal().open();
    void this.loadShares(seq);
    void this.loadTargets('', seq);
  }

  protected onSearchInput(value: string): void {
    this.searchText.set(value);
    this.clearSearchTimer();
    const seq = this.openSeq;
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      void this.loadTargets(value, seq);
    }, SEARCH_DEBOUNCE_MS);
  }

  protected clearSearch(): void {
    this.searchText.set('');
    this.clearSearchTimer();
    void this.loadTargets('', this.openSeq);
  }

  protected isPending(target: ShareTarget): boolean {
    return this.pendingKeys().has(targetKey(target.subjectType, target.subjectId));
  }

  protected addTarget(target: ShareTarget): void {
    const key = targetKey(target.subjectType, target.subjectId);
    if (this.pendingKeys().has(key)) return;
    const existing = this.shares().find(
      (s) => s.subjectType === target.subjectType && s.subjectId === target.subjectId,
    );
    this.pendingRows.update((rows) => [
      ...rows,
      {
        key,
        subjectType: target.subjectType,
        subjectId: target.subjectId,
        name: this.targetName(target),
        accessLevel: existing?.accessLevel ?? 'VIEW',
        expiresOn: null,
        expiryError: null,
      },
    ]);
  }

  protected removePending(key: string): void {
    this.pendingRows.update((rows) => rows.filter((row) => row.key !== key));
  }

  protected onRowAccessChange(key: string, next: string | null): void {
    if (next !== 'VIEW' && next !== 'EDIT') return;
    this.pendingRows.update((rows) =>
      rows.map((row) => (row.key === key ? { ...row, accessLevel: next } : row)),
    );
  }

  protected onRowExpiryChange(key: string, value: string | null): void {
    const expiryError =
      value && value < this.tomorrowIso()
        ? this.transloco.translate('tradeDashboardModals.share.expiryPast')
        : null;
    this.pendingRows.update((rows) =>
      rows.map((row) => (row.key === key ? { ...row, expiresOn: value, expiryError } : row)),
    );
  }

  protected clearRowExpiry(key: string): void {
    this.onRowExpiryChange(key, null);
  }

  protected accessFieldId(row: PendingShareRow): string {
    return `${this.uid}-access-${row.key}`;
  }

  protected expiresFieldId(row: PendingShareRow): string {
    return `${this.uid}-expires-${row.key}`;
  }

  protected expiresDescribedBy(row: PendingShareRow): string {
    const hintId = `${this.expiresFieldId(row)}-hint`;
    return row.expiryError ? `${hintId} ${this.expiresFieldId(row)}-error` : hintId;
  }

  protected formatExpiry(iso: string): string {
    return formatDate(iso, this.language());
  }

  protected retryShares(): void {
    void this.loadShares(this.openSeq);
  }

  protected requestClose(): void {
    if (this.submitting() || this.revokingId()) return;
    if (this.pendingRows().length === 0) {
      this.modal().close();
      return;
    }
    void this.onAttemptDismiss();
  }

  protected async onAttemptDismiss(): Promise<void> {
    if (this.submitting() || this.revokingId() || this.confirmingUnsaved) return;
    if (this.pendingRows().length === 0) {
      this.modal().close();
      return;
    }
    this.confirmingUnsaved = true;
    try {
      const choice = await this.unsavedDialog().open();
      if (choice === 'save') {
        const saved = await this.submitShares();
        if (saved) this.modal().close();
      } else if (choice === 'discard') {
        this.pendingRows.set([]);
        this.modal().close();
      }
    } finally {
      this.confirmingUnsaved = false;
    }
  }

  protected onModalClosed(): void {
    this.openSeq++;
    this.targetSeq++;
    this.clearSearchTimer();
    this.submitting.set(false);
    this.revokingId.set(null);
    this.revokingTarget.set(null);
  }

  protected async submitShares(): Promise<boolean> {
    const rows = this.pendingRows();
    if (rows.length === 0 || this.submitting()) return false;

    const minDay = this.tomorrowIso();
    let hasInvalidExpiry = false;
    const validated = rows.map((row) => {
      if (row.expiresOn && row.expiresOn < minDay) {
        hasInvalidExpiry = true;
        return {
          ...row,
          expiryError: this.transloco.translate('tradeDashboardModals.share.expiryPast'),
        };
      }
      return { ...row, expiryError: null };
    });
    this.pendingRows.set(validated);
    if (hasInvalidExpiry) return false;

    const seq = this.openSeq;
    const dashboardId = this.dashboardId;
    this.submitting.set(true);
    try {
      const res = await upsertShares(
        this.ctx(),
        dashboardId,
        {
          resourceRevision: this.revision,
          changes: validated.map((row) => ({
            subjectType: row.subjectType,
            subjectId: row.subjectId,
            accessLevel: row.accessLevel,
            ...(row.expiresOn ? { expiresAt: endOfLocalDayIso(row.expiresOn) } : {}),
          })),
        },
        newIdempotencyKey(),
      );
      if (seq !== this.openSeq || dashboardId !== this.dashboardId) return false;

      this.revision = res.resourceRevision;
      this.revisionChange.emit(this.revision);
      this.pendingRows.set([]);
      this.notify.success(this.transloco.translate('tradeDashboardModals.toast.shared'));
      await this.loadShares(seq);
      return true;
    } catch (error) {
      if (seq !== this.openSeq || dashboardId !== this.dashboardId) return false;
      const code = errorCodeOf(error);
      if (code === 'TRADE.DASHBOARD.REVISION_CONFLICT') {
        this.notify.warning(this.transloco.translate('tradeDashboardModals.toast.changed'));
        await this.refreshAfterConflict(seq);
        return false;
      }
      if (code === 'TRADE.DASHBOARD.SHARE_ACCESS_INVALID') {
        const msg = this.transloco.translate('tradeDashboardModals.share.expiryPast');
        const hasAnyExpiry = this.pendingRows().some((row) => Boolean(row.expiresOn));
        this.pendingRows.update((current) =>
          current.map((row) => (hasAnyExpiry ? (row.expiresOn ? { ...row, expiryError: msg } : row) : { ...row, expiryError: msg })),
        );
        return false;
      }
      this.notify.error(this.transloco.translate(errorKey(error)));
      return false;
    } finally {
      if (seq === this.openSeq) {
        this.submitting.set(false);
      }
    }
  }

  protected async revokeRow(item: Share): Promise<void> {
    if (this.revokingId() || this.submitting()) return;
    const seq = this.openSeq;
    const dashboardId = this.dashboardId;

    this.revokingTarget.set(item);
    const confirmed = await this.revokeConfirm().open();
    if (!confirmed || seq !== this.openSeq || dashboardId !== this.dashboardId) {
      this.revokingTarget.set(null);
      return;
    }

    this.revokingId.set(item.id);
    try {
      const res = await revokeShare(this.ctx(), dashboardId, item.id, this.revision);
      if (seq !== this.openSeq || dashboardId !== this.dashboardId) return;

      this.revision = res.revision;
      this.revisionChange.emit(this.revision);
      this.shares.update((rows) => rows.filter((row) => row.id !== item.id));
      this.notify.success(this.transloco.translate('tradeDashboardModals.toast.revoked'));
      await this.loadShares(seq, true);
    } catch (error) {
      if (seq !== this.openSeq || dashboardId !== this.dashboardId) return;
      if (errorCodeOf(error) === 'TRADE.DASHBOARD.REVISION_CONFLICT') {
        this.notify.warning(this.transloco.translate('tradeDashboardModals.toast.changed'));
        await this.refreshAfterConflict(seq);
      } else {
        this.notify.error(this.transloco.translate(errorKey(error)));
      }
    } finally {
      if (seq === this.openSeq) {
        this.revokingId.set(null);
        this.revokingTarget.set(null);
      }
    }
  }

  protected targetName(target: ShareTarget): string {
    return shareTargetName(target, this.language());
  }

  private async loadShares(seq: number, silent = false): Promise<void> {
    if (!silent) {
      this.loadingShares.set(true);
      this.sharesLoadFailed.set(false);
    }
    try {
      const list = await listShares(this.ctx(), this.dashboardId);
      if (seq !== this.openSeq) return;
      this.shares.set(list.items);
      this.sharesLoadFailed.set(false);
    } catch (error) {
      if (seq !== this.openSeq) return;
      if (!silent) {
        this.sharesLoadFailed.set(true);
        this.notify.error(this.transloco.translate(errorKey(error)));
      }
    } finally {
      if (seq === this.openSeq && !silent) {
        this.loadingShares.set(false);
      }
    }
  }

  private async refreshAfterConflict(seq: number): Promise<void> {
    try {
      const [freshShares, freshDetail] = await Promise.all([
        listShares(this.ctx(), this.dashboardId),
        getDashboard(this.ctx(), this.dashboardId),
      ]);
      if (seq !== this.openSeq) return;
      this.shares.set(freshShares.items);
      this.revision = freshDetail.revision;
      this.revisionChange.emit(this.revision);
    } catch (error) {
      if (seq !== this.openSeq) return;
      this.notify.error(this.transloco.translate(errorKey(error)));
    }
  }

  private async loadTargets(term: string, openSeq: number): Promise<void> {
    const seq = ++this.targetSeq;
    this.loadingTargets.set(true);
    try {
      const results = await listShareTargets(this.ctx(), { search: term.trim(), limit: TARGET_LIMIT });
      if (seq !== this.targetSeq || openSeq !== this.openSeq) return;
      this.targets.set(results.items);
    } catch (error) {
      if (seq !== this.targetSeq || openSeq !== this.openSeq) return;
      this.targets.set([]);
      this.notify.error(this.transloco.translate(errorKey(error)));
    } finally {
      if (seq === this.targetSeq && openSeq === this.openSeq) {
        this.loadingTargets.set(false);
      }
    }
  }

  private clearSearchTimer(): void {
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }
}
