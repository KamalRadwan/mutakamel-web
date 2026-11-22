import { Component, DestroyRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { translationEvents } from '../../../core/i18n/translation-events';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { PluralKeyPipe, pluralKey } from '../../../core/i18n/plural';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArchive,
  tablerArrowsExchange,
  tablerCalendarPlus,
  tablerCheck,
  tablerCircleX,
  tablerDownload,
  tablerEdit,
  tablerLoader2,
  tablerSend,
  tablerStack2,
  tablerTag,
  tablerTrash,
  tablerUpload,
  tablerUserShare,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../core/i18n/language';
import { Notify } from '../../../core/notify/notify';
import { ApiError, errorCodeOf } from '../../../features/crm/settings/shared/settings-api';
import { Button } from '../../ui/button/button';
import { DateField } from '../../ui/date-time/date-field';
import { TimeField } from '../../ui/date-time/time-field';
import { Field } from '../../ui/field/field';
import { Modal } from '../../ui/modal/modal';
import { Segmented, SegmentedOption } from '../../ui/segmented/segmented';
import { BulkJobActionDescriptor } from '../bulk-job-modules';
import { getBulkJob, listBulkJobItems } from '../bulk-jobs.api';
import { BulkJob, BulkJobItem, BulkJobItemStatus, BulkJobStatus, isBulkJobActive } from '../bulk-jobs.model';
import { BulkJobsTracker, ReportTarget } from '../bulk-jobs-tracker';

type IssueStatus = 'FAILED' | 'SKIPPED' | 'CANCELLED';

const ISSUES_PAGE_SIZE = 50;
// TODO(bulk-backend): GET /:jobId/items accepts a single status; filter one result status at a time.
const ISSUE_STATUSES: readonly IssueStatus[] = ['FAILED', 'SKIPPED', 'CANCELLED'];

function countForIssueStatus(job: BulkJob | null, status: IssueStatus): number {
  if (!job) return 0;
  switch (status) {
    case 'FAILED':
      return job.counts.failed;
    case 'SKIPPED':
      return job.counts.skipped;
    case 'CANCELLED':
      return job.counts.cancelled;
  }
}

function defaultIssueStatus(job: BulkJob | null): IssueStatus | null {
  for (const status of ISSUE_STATUSES) {
    if (countForIssueStatus(job, status) > 0) return status;
  }
  return null;
}

const TONE_CLASSES: Record<BulkJobActionDescriptor['tone'], string> = {
  blue: 'bg-icon-blue',
  green: 'bg-icon-green',
  teal: 'bg-icon-teal',
  red: 'bg-icon-red',
  violet: 'bg-icon-violet',
  amber: 'bg-icon-orange',
};

const JOB_STATUS_CLASSES: Record<BulkJobStatus, string> = {
  QUEUED: 'bg-brand-soft text-on-brand-soft',
  RUNNING: 'bg-brand-soft text-on-brand-soft',
  CANCELLING: 'bg-warning text-on-warning',
  COMPLETED: 'bg-success-soft text-on-success-soft',
  COMPLETED_WITH_ERRORS: 'bg-warning text-on-warning',
  CANCELLED: 'bg-neutral-soft text-on-neutral-soft',
  FAILED: 'bg-danger-soft text-on-danger-soft',
};

const ITEM_STATUS_CLASSES: Record<BulkJobItemStatus, string> = {
  PENDING: 'bg-neutral-soft text-on-neutral-soft',
  DISPATCHED: 'bg-brand-soft text-on-brand-soft',
  SUCCEEDED: 'bg-success-soft text-on-success-soft',
  UNCHANGED: 'bg-neutral-soft text-on-neutral-soft',
  SKIPPED: 'bg-neutral-soft text-on-neutral-soft',
  FAILED: 'bg-danger-soft text-on-danger-soft',
  CANCELLED: 'bg-warning text-on-warning',
};

interface IssueRowView {
  item: BulkJobItem;
  statusClass: string;
  reason: string;
  link: { commands: unknown[]; queryParams?: Record<string, string> } | null;
}

function roundUp15Min(now = new Date()): Date {
  const stepMs = 15 * 60_000;
  return new Date(Math.ceil((now.getTime() + 1) / stepMs) * stepMs);
}

function toLocalDateTime(date: Date): { date: string; time: string } {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
}

function fromLocalDateTime(dateStr: string, timeStr: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeStr.trim());
  if (!dateMatch || !timeMatch) return null;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  const parsed = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return parsed;
}

function formatDuration(ms: number, lang: 'ar' | 'en'): string {
  const totalSeconds = Math.max(1, Math.round(ms / 1000));
  if (totalSeconds < 60) {
    return lang === 'ar' ? `${totalSeconds} ث` : `${totalSeconds}s`;
  }
  const totalMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (totalMinutes < 60) {
    if (seconds === 0) return lang === 'ar' ? `${totalMinutes} د` : `${totalMinutes}m`;
    return lang === 'ar' ? `${totalMinutes} د ${seconds} ث` : `${totalMinutes}m ${seconds}s`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return lang === 'ar' ? `${hours} س` : `${hours}h`;
  return lang === 'ar' ? `${hours} س ${minutes} د` : `${hours}h ${minutes}m`;
}

@Component({
  selector: 'app-bulk-job-report',
  imports: [NgIcon, RouterLink, TranslocoPipe, PluralKeyPipe, Button, DateField, TimeField, Field, Modal, Segmented],
  providers: [
    provideTranslocoScope({ scope: 'bulk-jobs', alias: 'bulkJobs' }),
    provideIcons({
      tablerStack2,
      tablerUserShare,
      tablerArrowsExchange,
      tablerCalendarPlus,
      tablerTrash,
      tablerEdit,
      tablerCheck,
      tablerSend,
      tablerArchive,
      tablerTag,
      tablerDownload,
      tablerUpload,
      tablerLoader2,
      tablerCircleX,
    }),
  ],
  templateUrl: './job-report.html',
})
export class BulkJobReport {
  private static nextId = 0;
  protected readonly uid = `bulk-job-report-${++BulkJobReport.nextId}`;

  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState).current;
  private readonly i18n = translationEvents(this.transloco);
  protected readonly tracker = inject(BulkJobsTracker);

  private readonly modal = viewChild.required(Modal);

  protected readonly job = signal<BulkJob | null>(null);
  protected readonly items = signal<BulkJobItem[]>([]);
  protected readonly totalItems = signal(0);
  protected readonly page = signal(1);
  protected readonly selectedIssueStatus = signal<IssueStatus | null>(null);
  protected readonly loadingJob = signal(false);
  protected readonly loadingItems = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly retrying = signal(false);
  protected readonly nowMs = signal(Date.now());
  protected readonly retryDate = signal('');
  protected readonly retryTime = signal('');

  private isOpen = false;
  private loadSeq = 0;
  private itemsLoadSeq = 0;
  private userPickedIssueStatus = false;
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  protected readonly isActive = computed(() => {
    const current = this.job();
    return current ? isBulkJobActive(current.status) : false;
  });

  protected readonly descriptor = computed(() => {
    const current = this.job();
    return current ? this.tracker.descriptorFor(current.module) : undefined;
  });

  protected readonly actionDescriptor = computed(() => {
    const current = this.job();
    return current ? this.tracker.actionDescriptorFor(current) : undefined;
  });

  protected readonly modalIcon = computed(() => this.actionDescriptor()?.icon ?? 'tablerStack2');
  protected readonly modalTile = computed(() => {
    const tone = this.actionDescriptor()?.tone;
    return tone ? TONE_CLASSES[tone] : 'bg-icon-blue';
  });

  protected readonly modalTitle = computed(() => {
    this.i18n();
    this.tracker.scopesVersion();
    const current = this.job();
    return current ? this.tracker.jobTitle(current) : this.transloco.translate('bulkJobs.genericTitle');
  });

  protected readonly modalSubtitle = computed(() => {
    this.i18n();
    const current = this.job();
    if (!current) return '';
    const lang = this.language();
    const startDate = new Date(current.startedAt ?? current.createdAt);
    const endMs = current.finishedAt ? new Date(current.finishedAt).getTime() : this.nowMs();
    const time = new Intl.DateTimeFormat(`${lang}-u-nu-latn`, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(startDate);
    const duration = formatDuration(Math.max(0, endMs - startDate.getTime()), lang);
    return this.transloco.translate('bulkJobs.report.started', { time, duration });
  });

  protected readonly statusBadgeClass = computed(() => {
    const current = this.job();
    return current ? JOB_STATUS_CLASSES[current.status] : 'bg-neutral-soft text-on-neutral-soft';
  });

  protected readonly progressPercent = computed(() => {
    const current = this.job();
    if (!current || current.total <= 0) return 0;
    return Math.min(100, Math.round((current.processed / current.total) * 100));
  });

  protected readonly succeededText = computed(() => {
    this.i18n();
    this.tracker.scopesVersion();
    const current = this.job();
    if (!current) return '';
    const n = current.counts.succeeded;
    const key = this.actionDescriptor()?.succeededKey;
    if (key) {
      const translated = this.transloco.translate(key, { n, count: n });
      if (translated && translated !== key) return translated;
    }
    return this.transloco.translate(pluralKey('bulkJobs.count.succeededPlural', n, this.language()), { n });
  });

  protected readonly summaryLines = computed(() => {
    this.i18n();
    this.tracker.scopesVersion();
    const current = this.job();
    const desc = this.descriptor();
    if (!current || !desc?.summaryLines) return [];
    return desc.summaryLines(current).map((line) => this.transloco.translate(line.key, line.params));
  });

  protected readonly failureReason = computed(() => {
    this.i18n();
    this.tracker.scopesVersion();
    const current = this.job();
    if (!current?.failureCode) return null;
    return this.tracker.reasonText(current.failureCode, current);
  });

  protected readonly issueRows = computed<IssueRowView[]>(() => {
    this.i18n();
    this.tracker.scopesVersion();
    const current = this.job();
    const desc = this.descriptor();
    return this.items().map((item) => ({
      item,
      statusClass: ITEM_STATUS_CLASSES[item.status] ?? 'bg-neutral-soft text-on-neutral-soft',
      reason: item.code
        ? this.tracker.reasonText(item.code, current, {
            ...(item.data ?? {}),
            ...(item.field ? { field: item.field } : {}),
          })
        : '',
      link: current && desc?.itemLink ? desc.itemLink(item, current) : null,
    }));
  });

  protected readonly issueFilterOptions = computed<SegmentedOption[]>(() => {
    this.i18n();
    const current = this.job();
    return ISSUE_STATUSES.map((status) => {
      const n = countForIssueStatus(current, status);
      return {
        value: status,
        label: this.transloco.translate(`bulkJobs.report.filter.${status}`, { n }),
        disabled: n === 0,
      };
    });
  });

  protected readonly hasMore = computed(() => this.page() * ISSUES_PAGE_SIZE < this.totalItems());

  protected readonly canRetry = computed(() => {
    const current = this.job();
    return !!current && !isBulkJobActive(current.status) && current.counts.failed > 0;
  });

  protected readonly showRetryStart = computed(() => {
    const current = this.job();
    const desc = this.descriptor();
    if (!current || isBulkJobActive(current.status) || current.counts.failed === 0) return false;
    return desc?.retryOverrides?.(current) === 'START_AT';
  });

  protected readonly todayIso = computed(() => {
    this.nowMs();
    return toLocalDateTime(new Date()).date;
  });

  protected readonly retryStartDateTime = computed(() => fromLocalDateTime(this.retryDate(), this.retryTime()));

  protected readonly retryStartError = computed<string | null>(() => {
    this.i18n();
    if (!this.showRetryStart()) return null;
    const dt = this.retryStartDateTime();
    if (!dt || dt.getTime() <= this.nowMs()) {
      return this.transloco.translate('bulkJobs.report.retryStartPast');
    }
    return null;
  });

  protected readonly selectFailedRouteValue = computed(() => {
    const current = this.job();
    const desc = this.descriptor();
    if (!current || isBulkJobActive(current.status) || current.counts.failed === 0) return null;
    return desc?.selectFailedRoute?.(current) ?? null;
  });

  constructor() {
    effect(() => {
      const target = this.tracker.reportTarget();
      if (!target) return;
      untracked(() => {
        void this.openTarget(target);
      });
    });

    effect(() => {
      const jobs = this.tracker.jobs();
      untracked(() => {
        if (!this.isOpen) return;
        const current = this.job();
        if (!current) return;
        const live = jobs.find((entry) => entry.app === current.app && entry.id === current.id);
        if (!live) return;
        if (live.revision !== current.revision || live.status !== current.status || live.processed !== current.processed) {
          const wasActive = isBulkJobActive(current.status);
          const nowTerminal = !isBulkJobActive(live.status);
          this.job.set(live);
          if (wasActive && nowTerminal) {
            this.resetRetryStart();
            const currentStatus = this.selectedIssueStatus();
            const nextStatus =
              this.userPickedIssueStatus && currentStatus && countForIssueStatus(live, currentStatus) > 0
                ? currentStatus
                : defaultIssueStatus(live);
            this.selectedIssueStatus.set(nextStatus);
            if (nextStatus) {
              void this.loadIssues(live, nextStatus, 1, false, ++this.itemsLoadSeq);
            } else {
              this.itemsLoadSeq++;
              this.items.set([]);
              this.totalItems.set(0);
              this.page.set(1);
              this.loadingItems.set(false);
              this.loadingMore.set(false);
            }
          }
        }
      });
    });

    effect(() => {
      const active = this.isActive() && this.isOpen;
      untracked(() => {
        if (active) this.startTick();
        else this.stopTick();
      });
    });

    this.destroyRef.onDestroy(() => this.stopTick());
  }

  protected close(): void {
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.isOpen = false;
    this.loadSeq++;
    this.itemsLoadSeq++;
    this.stopTick();
    this.tracker.clearReportTarget();
  }

  protected onIssueStatusChange(value: string | null): void {
    if (value !== 'FAILED' && value !== 'SKIPPED' && value !== 'CANCELLED') return;
    const current = this.job();
    if (!current || value === this.selectedIssueStatus() || countForIssueStatus(current, value) === 0) return;
    this.userPickedIssueStatus = true;
    this.selectedIssueStatus.set(value);
    this.items.set([]);
    this.totalItems.set(0);
    this.page.set(1);
    void this.loadIssues(current, value, 1, false, ++this.itemsLoadSeq);
  }

  protected onRetryDateChange(value: string | null): void {
    if (!value) return;
    this.nowMs.set(Date.now());
    this.retryDate.set(value);
  }

  protected onRetryTimeChange(value: string | null): void {
    if (!value) return;
    this.nowMs.set(Date.now());
    this.retryTime.set(value);
  }

  protected async loadMore(): Promise<void> {
    const current = this.job();
    const status = this.selectedIssueStatus();
    if (!current || !status || this.loadingMore() || !this.hasMore()) return;
    const nextPage = this.page() + 1;
    await this.loadIssues(current, status, nextPage, true, this.itemsLoadSeq);
  }

  protected async onRetry(): Promise<void> {
    const current = this.job();
    if (!current || !this.canRetry() || this.retrying()) return;

    let overrides: unknown | null = null;
    if (this.showRetryStart()) {
      this.nowMs.set(Date.now());
      const startDt = this.retryStartDateTime();
      if (!startDt || startDt.getTime() <= this.nowMs()) return;
      overrides = { startAt: startDt.toISOString() };
    }

    this.retrying.set(true);
    try {
      const newJobId = await this.tracker.retry(current, overrides);
      this.tracker.openReport(current.app, newJobId);
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'BULK_JOB_ACTIVE') return;
      const details = error instanceof ApiError ? error.details : undefined;
      this.notify.error(this.tracker.reasonText(code ?? undefined, current, details));
    } finally {
      this.retrying.set(false);
    }
  }

  protected onSelectFailed(): void {
    const route = this.selectFailedRouteValue();
    if (!route) return;
    this.close();
    void this.router.navigate(route.commands, { queryParams: route.queryParams });
  }

  private async openTarget(target: ReportTarget): Promise<void> {
    const seq = ++this.loadSeq;
    this.itemsLoadSeq++;
    this.userPickedIssueStatus = false;
    this.selectedIssueStatus.set(null);
    this.nowMs.set(Date.now());
    this.items.set([]);
    this.totalItems.set(0);
    this.page.set(1);
    this.loadingMore.set(false);
    this.retrying.set(false);

    const existing = this.tracker.jobs().find((entry) => entry.app === target.app && entry.id === target.jobId) ?? null;
    this.job.set(existing);
    this.loadingJob.set(!existing);
    this.loadingItems.set(true);

    if (existing) {
      void this.tracker.ensureScopesForModule(existing.module);
    }

    this.isOpen = true;
    this.modal().open();

    try {
      const fresh = await getBulkJob(target.app, target.jobId);
      if (seq !== this.loadSeq) return;
      await this.tracker.ensureScopesForModule(fresh.module);
      if (seq !== this.loadSeq) return;
      this.tracker.syncExternalJob(fresh);
      this.job.set(fresh);
      this.loadingJob.set(false);
      this.resetRetryStart();
      const initialStatus = defaultIssueStatus(fresh);
      this.selectedIssueStatus.set(initialStatus);
      if (initialStatus) {
        await this.loadIssues(fresh, initialStatus, 1, false, ++this.itemsLoadSeq);
      } else {
        this.items.set([]);
        this.totalItems.set(0);
        this.page.set(1);
        this.loadingItems.set(false);
      }
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.loadingJob.set(false);
      this.loadingItems.set(false);
      const details = error instanceof ApiError ? error.details : undefined;
      this.notify.error(this.tracker.reasonText(errorCodeOf(error) ?? undefined, existing, details));
      this.close();
    }
  }

  private async loadIssues(
    targetJob: BulkJob,
    status: IssueStatus,
    targetPage: number,
    append: boolean,
    seq: number,
  ): Promise<void> {
    if (append) {
      this.loadingMore.set(true);
    } else {
      this.loadingItems.set(true);
      this.loadingMore.set(false);
    }

    try {
      const res = await listBulkJobItems(targetJob.app, targetJob.id, {
        status,
        page: targetPage,
        limit: ISSUES_PAGE_SIZE,
      });
      if (seq !== this.itemsLoadSeq || !this.isOpen) return;
      this.page.set(res.page);
      this.totalItems.set(res.total);
      this.items.update((prev) => (append ? [...prev, ...res.items] : res.items));
    } catch (error) {
      if (seq !== this.itemsLoadSeq || !this.isOpen) return;
      if (!append) {
        this.items.set([]);
        this.totalItems.set(0);
      }
      const details = error instanceof ApiError ? error.details : undefined;
      this.notify.error(this.tracker.reasonText(errorCodeOf(error) ?? undefined, targetJob, details));
    } finally {
      if (seq === this.itemsLoadSeq) {
        this.loadingItems.set(false);
        this.loadingMore.set(false);
      }
    }
  }

  private resetRetryStart(): void {
    const slot = toLocalDateTime(roundUp15Min(new Date()));
    this.retryDate.set(slot.date);
    this.retryTime.set(slot.time);
  }

  private startTick(): void {
    if (this.tickTimer !== null) return;
    this.tickTimer = setInterval(() => this.nowMs.set(Date.now()), 1000);
  }

  private stopTick(): void {
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }
}
