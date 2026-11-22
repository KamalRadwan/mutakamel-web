import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerEye,
  tablerLink,
  tablerRefresh,
  tablerTarget,
  tablerUserPlus,
  tablerUsers,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { ActionItem, ActionSelection, ActionsMenu } from '../../../../shared/ui/actions-menu/actions-menu';
import { Button } from '../../../../shared/ui/button/button';
import { DateField } from '../../../../shared/ui/date-time/date-field';
import { Dropdown, DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { getCrmSettings } from '../general/general.api';
import { errorCodeOf } from '../shared/settings-api';
import { SettingsFrame } from '../../../../shared/ui/settings-frame/settings-frame';
import { SettingsNotice } from '../../../../shared/ui/settings-notice/settings-notice';
import { ComposeModal } from './compose-modal/compose-modal';
import { EmailDetailModal } from './email-detail-modal/email-detail-modal';
import { getEmail, listEmails, listSourceRecords, senderStatus } from './outbound-emails.api';
import {
  CrmSourceRecord,
  EMAIL_SOURCE_TYPES,
  EMAIL_STATUSES,
  EmailDetail,
  EmailListFilter,
  EmailRow,
  EmailSourceType,
  EmailStatus,
  MAX_RANGE_DAYS,
  RETENTION_DAYS,
  SOURCE_LOOK,
  STATUS_BADGE,
  SenderStatusConfig,
  canRetryEmail,
  formatEmailDateTime,
  mayOfferRetry,
  resolveEmailErrorMessage,
  shortEmailRef,
} from './outbound-emails.model';
import { RetryModal } from './retry-modal/retry-modal';
import { SenderStatus } from './sender-status/sender-status';

const CAN_MANAGE = true; // later from the session permissions

const SKELETON_ROWS = [0, 1, 2, 3, 4] as const;

type StatusFilter = 'ALL' | EmailStatus;
type SourceTypeFilter = 'ALL' | EmailSourceType;

@Component({
  selector: 'app-outbound-emails-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    NgIcon,
    ActionsMenu,
    Button,
    DateField,
    Dropdown,
    Field,
    SettingsFrame,
    SettingsNotice,
    SenderStatus,
    EmailDetailModal,
    RetryModal,
    ComposeModal,
  ],
  providers: [
    provideTranslocoScope('settings', { scope: 'settings-outbound-emails', alias: 'outboundEmails' }),
    provideIcons({ tablerEye, tablerRefresh, tablerLink, tablerUserPlus, tablerUsers, tablerTarget }),
  ],
  templateUrl: './outbound-emails-page.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class OutboundEmailsPage {
  private static nextId = 0;
  protected readonly uid = `outbound-emails-page-${++OutboundEmailsPage.nextId}`;

  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  private readonly language = inject(LanguageState).current;
  private readonly notify = inject(Notify);

  private readonly detailModal = viewChild.required(EmailDetailModal);
  private readonly retryModal = viewChild.required(RetryModal);
  private readonly composeModal = viewChild.required(ComposeModal);

  protected readonly canManage = CAN_MANAGE;
  protected readonly retentionDays = signal(RETENTION_DAYS);
  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly statusBadge = STATUS_BADGE;
  protected readonly sourceLook = SOURCE_LOOK;

  protected readonly sender = signal<SenderStatusConfig | null>(null);
  protected readonly senderLoading = signal(false);

  protected readonly searchQuery = signal('');
  protected readonly statusFilter = signal<StatusFilter>('ALL');
  protected readonly sourceTypeFilter = signal<SourceTypeFilter>('ALL');
  protected readonly sourceIdFilter = signal<string>('ALL');
  protected readonly fromDate = signal<string | null>(null);
  protected readonly toDate = signal<string | null>(null);

  protected readonly sourceRecords = signal<CrmSourceRecord[]>([]);
  protected readonly rows = signal<EmailRow[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly hasNext = signal(false);
  protected readonly loading = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly failed = signal(false);
  protected readonly featureDisabled = signal(false);
  protected readonly errorText = signal<string | null>(null);

  protected readonly canSendCrm = computed(() => {
    const current = this.sender();
    return current === null || current.canSendCrm;
  });

  protected readonly gridColumnsClass = computed(() =>
    this.canManage ? 'grid-cols-crm-outbound-email-row-actions' : 'grid-cols-crm-outbound-email-row',
  );

  protected readonly rangeError = computed<string | null>(() => {
    this.i18n();
    const from = this.fromDate();
    const to = this.toDate();
    if (!from || !to) return null;
    if (from > to) return this.transloco.translate('outboundEmails.filters.invalidRange');
    const diffDays = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
    if (diffDays > MAX_RANGE_DAYS) return this.transloco.translate('outboundEmails.filters.rangeTooLong');
    return null;
  });

  protected readonly hasActiveFilters = computed(
    () =>
      this.statusFilter() !== 'ALL' ||
      this.sourceTypeFilter() !== 'ALL' ||
      this.sourceIdFilter() !== 'ALL' ||
      Boolean(this.fromDate()) ||
      Boolean(this.toDate()) ||
      Boolean(this.searchQuery().trim()),
  );

  protected readonly statusOptions = computed<DropdownOption<StatusFilter>[]>(() => {
    this.i18n();
    return [
      { value: 'ALL', label: this.transloco.translate('outboundEmails.filters.allStatuses') },
      ...EMAIL_STATUSES.map((status) => ({
        value: status,
        label: this.transloco.translate(`outboundEmails.statuses.${status}`),
      })),
    ];
  });

  protected readonly sourceTypeOptions = computed<DropdownOption<SourceTypeFilter>[]>(() => {
    this.i18n();
    return [
      { value: 'ALL', label: this.transloco.translate('outboundEmails.filters.allTypes') },
      ...EMAIL_SOURCE_TYPES.map((type) => ({
        value: type,
        label: this.transloco.translate(`outboundEmails.sourceTypes.${type}`),
      })),
    ];
  });

  protected readonly recordOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const type = this.sourceTypeFilter();
    const filtered = type === 'ALL' ? [] : this.sourceRecords().filter((item) => item.type === type);
    return [
      { value: 'ALL', label: this.transloco.translate('outboundEmails.filters.allRecords') },
      ...filtered.map((record) => ({ value: record.id, label: record.name })),
    ];
  });

  protected readonly visibleRows = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const items = this.rows();
    if (!query) return items;
    return items.filter(
      (item) =>
        (item.subjectPreview ?? '').toLowerCase().includes(query) ||
        item.recipient.displayName.toLowerCase().includes(query) ||
        item.recipient.maskedAddress.toLowerCase().includes(query),
    );
  });

  private listSeq = 0;
  private senderSeq = 0;

  constructor() {
    void this.loadRetention();
    void this.loadSender();
    void this.loadSourceRecords();
    void this.loadList(true);
  }

  protected reloadAll(): void {
    void this.loadRetention();
    void this.loadSender();
    void this.loadList(true);
  }

  protected onStatusFilterChange(value: StatusFilter): void {
    this.statusFilter.set(value);
    void this.loadList(true);
  }

  protected onSourceTypeFilterChange(value: SourceTypeFilter): void {
    this.sourceTypeFilter.set(value);
    this.sourceIdFilter.set('ALL');
    void this.loadList(true);
  }

  protected onSourceIdFilterChange(value: string): void {
    this.sourceIdFilter.set(value);
    void this.loadList(true);
  }

  protected onFromDateChange(value: string | null): void {
    this.fromDate.set(value);
    if (this.rangeError()) {
      this.clearRowsForInvalidRange();
      return;
    }
    void this.loadList(true);
  }

  protected onToDateChange(value: string | null): void {
    this.toDate.set(value);
    if (this.rangeError()) {
      this.clearRowsForInvalidRange();
      return;
    }
    void this.loadList(true);
  }

  protected clearFilters(): void {
    this.searchQuery.set('');
    this.statusFilter.set('ALL');
    this.sourceTypeFilter.set('ALL');
    this.sourceIdFilter.set('ALL');
    this.fromDate.set(null);
    this.toDate.set(null);
    void this.loadList(true);
  }

  protected loadMore(): void {
    if (this.loadingMore() || !this.hasNext() || this.rangeError()) return;
    void this.loadList(false);
  }

  protected openCompose(): void {
    if (!this.canManage || this.featureDisabled() || !this.canSendCrm()) return;
    this.composeModal().open();
  }

  protected openDetail(emailId: string): void {
    void this.detailModal().open(emailId);
  }

  protected openRetry(email: EmailDetail): void {
    if (!this.canManage || !canRetryEmail(email)) return;
    this.retryModal().open(email);
  }

  /**
   * List items carry only `status` (no content state or retry link),
   * so fetch the email detail before opening the retry modal from a row action.
   */
  private async openRetryFromRow(row: EmailRow): Promise<void> {
    if (!this.canManage) return;
    try {
      const detail = await getEmail(row.outboundEmailId);
      if (!canRetryEmail(detail)) {
        this.notify.warning(this.transloco.translate('outboundEmails.errors.CRM.EMAIL.RETRY_NOT_ALLOWED'));
        return;
      }
      this.retryModal().open(detail);
    } catch (error) {
      this.notify.error(resolveEmailErrorMessage(this.transloco, error));
    }
  }

  protected onEmailQueued(): void {
    void this.loadList(true);
  }

  protected rowActions(row: EmailRow): ActionItem[] {
    this.i18n();
    const items: ActionItem[] = [
      {
        id: 'open',
        title: this.transloco.translate('outboundEmails.actions.open'),
        icon: 'tablerEye',
        tile: 'bg-icon-blue',
      },
    ];

    if (mayOfferRetry(row)) {
      items.push({
        id: 'retry',
        title: this.transloco.translate('outboundEmails.actions.retry'),
        icon: 'tablerRefresh',
        tile: 'bg-icon-teal',
      });
    }

    items.push({
      id: 'openRecord',
      title: this.transloco.translate('outboundEmails.actions.openRecord'),
      icon: 'tablerLink',
      tile: 'bg-icon-gray',
      disabled: true,
      reason: this.transloco.translate('outboundEmails.actions.openRecordDisabled'),
    });

    return items;
  }

  protected onRowAction(row: EmailRow, selection: ActionSelection): void {
    switch (selection.id) {
      case 'open':
        this.openDetail(row.outboundEmailId);
        break;
      case 'retry':
        void this.openRetryFromRow(row);
        break;
    }
  }

  /** The list sends no record name: show the record type and a short id. */
  protected recordLabel(row: EmailRow): string {
    this.i18n();
    const type = this.transloco.translate(`outboundEmails.sourceTypes.${row.sourceType}`);
    return this.transloco.translate('outboundEmails.table.recordRef', { type, ref: shortEmailRef(row.sourceId) });
  }

  protected formatDateTime(iso: string): string {
    return formatEmailDateTime(iso, this.language());
  }

  private clearRowsForInvalidRange(): void {
    this.listSeq++;
    this.loading.set(false);
    this.loadingMore.set(false);
    this.rows.set([]);
    this.hasNext.set(false);
    this.nextCursor.set(null);
  }

  private buildFilter(): EmailListFilter {
    const filter: EmailListFilter = {};
    const status = this.statusFilter();
    const sourceType = this.sourceTypeFilter();
    const sourceId = this.sourceIdFilter();
    const from = this.fromDate();
    const to = this.toDate();

    if (status !== 'ALL') filter.status = status;
    if (sourceType !== 'ALL') filter.sourceType = sourceType;
    if (sourceType !== 'ALL' && sourceId !== 'ALL') filter.sourceId = sourceId;
    if (from) {
      const [y, m, d] = from.split('-').map(Number);
      filter.requestedFrom = new Date(y, m - 1, d).toISOString();
    }
    if (to) {
      const [y, m, d] = to.split('-').map(Number);
      filter.requestedTo = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
    }
    return filter;
  }

  private async loadRetention(): Promise<void> {
    try {
      const settings = await getCrmSettings();
      this.retentionDays.set(settings.outboundEmailContentRetentionDays);
    } catch {
      // Keep default retention days if settings cannot be read
    }
  }

  private async loadSender(): Promise<void> {
    const seq = ++this.senderSeq;
    this.senderLoading.set(true);
    try {
      const config = await senderStatus();
      if (seq !== this.senderSeq) return;
      this.sender.set(config);
    } catch (error) {
      if (seq === this.senderSeq) {
        this.sender.set(null);
        this.notify.error(resolveEmailErrorMessage(this.transloco, error));
      }
    } finally {
      if (seq === this.senderSeq) {
        this.senderLoading.set(false);
      }
    }
  }

  private async loadSourceRecords(): Promise<void> {
    try {
      const records = await listSourceRecords();
      this.sourceRecords.set(records);
    } catch {
      // Non-blocking lookup for record dropdown
    }
  }

  private async loadList(reset: boolean): Promise<void> {
    if (this.rangeError()) return;
    const seq = ++this.listSeq;
    const cursor = reset ? null : this.nextCursor();

    if (reset) {
      this.loading.set(true);
      this.failed.set(false);
      this.featureDisabled.set(false);
      this.errorText.set(null);
    } else {
      this.loadingMore.set(true);
    }

    try {
      const page = await listEmails(this.buildFilter(), cursor);
      if (seq !== this.listSeq) return;
      this.rows.update((current) => (reset ? page.items : [...current, ...page.items]));
      this.nextCursor.set(page.nextCursor);
      this.hasNext.set(page.hasNext);
    } catch (error) {
      if (seq !== this.listSeq) return;
      const message = resolveEmailErrorMessage(this.transloco, error);
      if (errorCodeOf(error) === 'CRM_FEATURE_DISABLED') {
        this.featureDisabled.set(true);
        this.failed.set(false);
        this.errorText.set(message);
        this.rows.set([]);
        this.hasNext.set(false);
        this.nextCursor.set(null);
      } else if (reset) {
        this.failed.set(true);
        this.errorText.set(message);
        this.rows.set([]);
        this.hasNext.set(false);
        this.nextCursor.set(null);
      } else {
        this.notify.error(message);
      }
    } finally {
      if (seq === this.listSeq) {
        this.loading.set(false);
        this.loadingMore.set(false);
      }
    }
  }
}
