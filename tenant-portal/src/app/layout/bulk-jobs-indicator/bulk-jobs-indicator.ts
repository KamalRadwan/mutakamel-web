import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { translationEvents } from '../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerArchive,
  tablerArrowsExchange,
  tablerCalendarPlus,
  tablerCheck,
  tablerDownload,
  tablerEdit,
  tablerSend,
  tablerStack2,
  tablerTag,
  tablerTrash,
  tablerUpload,
  tablerUserShare,
} from '@ng-icons/tabler-icons';
import { Notify } from '../../core/notify/notify';
import { errorCodeOf } from '../../features/crm/settings/shared/settings-api';
import { BulkJobActionDescriptor } from '../../shared/bulk-jobs/bulk-job-modules';
import { BulkJob, BulkJobStatus, isBulkJobActive } from '../../shared/bulk-jobs/bulk-jobs.model';
import { BulkJobsTracker } from '../../shared/bulk-jobs/bulk-jobs-tracker';
import { BulkJobReport } from '../../shared/bulk-jobs/job-report/job-report';
import { Button } from '../../shared/ui/button/button';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog/confirm-dialog';

const TONE_CLASSES: Record<BulkJobActionDescriptor['tone'], string> = {
  blue: 'bg-icon-blue',
  green: 'bg-icon-green',
  teal: 'bg-icon-teal',
  red: 'bg-icon-red',
  violet: 'bg-icon-violet',
  amber: 'bg-icon-orange',
};

const STATUS_CLASSES: Record<BulkJobStatus, string> = {
  QUEUED: 'bg-brand-soft text-on-brand-soft',
  RUNNING: 'bg-brand-soft text-on-brand-soft',
  CANCELLING: 'bg-warning text-on-warning',
  COMPLETED: 'bg-success-soft text-on-success-soft',
  COMPLETED_WITH_ERRORS: 'bg-warning text-on-warning',
  CANCELLED: 'bg-neutral-soft text-on-neutral-soft',
  FAILED: 'bg-danger-soft text-on-danger-soft',
};

const RING_RADIUS = 12;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

interface IndicatorRow {
  job: BulkJob;
  ready: boolean;
  icon: string;
  tileClass: string;
  title: string;
  percent: number;
  statusClass: string;
  isStoppable: boolean;
  isCancelling: boolean;
  isStopping: boolean;
}

@Component({
  selector: 'app-bulk-jobs-indicator',
  imports: [NgIcon, TranslocoPipe, Button, ConfirmDialog, BulkJobReport],
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
    }),
  ],
  templateUrl: './bulk-jobs-indicator.html',
  host: {
    class: 'relative inline-flex shrink-0',
    '(document:click)': 'closeIfOutside($event)',
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class BulkJobsIndicator {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);
  protected readonly tracker = inject(BulkJobsTracker);

  private readonly stopConfirm = viewChild<ConfirmDialog>('stopConfirm');

  protected readonly ringCircumference = RING_CIRCUMFERENCE;
  protected readonly open = signal(false);
  protected readonly loadingRecent = signal(false);
  private readonly readyModules = signal<Set<string>>(new Set());
  private readonly stoppingKeys = signal<Set<string>>(new Set());
  private confirmingStop = false;

  protected readonly ringDashOffset = computed(() => {
    const active = this.tracker.jobs().filter((job) => isBulkJobActive(job.status));
    if (active.length === 0) return RING_CIRCUMFERENCE;
    let total = 0;
    let processed = 0;
    for (const job of active) {
      total += job.total;
      processed += job.processed;
    }
    const ratio = total > 0 ? Math.min(1, Math.max(0, processed / total)) : 0;
    return RING_CIRCUMFERENCE * (1 - ratio);
  });

  protected readonly rows = computed<IndicatorRow[]>(() => {
    this.i18n();
    this.tracker.scopesVersion();
    const ready = this.readyModules();
    const stopping = this.stoppingKeys();
    return this.tracker.jobs().map((job) => {
      const actionDesc = this.tracker.actionDescriptorFor(job);
      const hasDescriptor = !!this.tracker.descriptorFor(job.module);
      const isReady = !hasDescriptor || ready.has(job.module);
      const percent = job.total > 0 ? Math.min(100, Math.round((job.processed / job.total) * 100)) : isBulkJobActive(job.status) ? 0 : 100;
      const key = `${job.app}:${job.id}`;
      return {
        job,
        ready: isReady,
        icon: actionDesc?.icon ?? 'tablerStack2',
        tileClass: actionDesc?.tone ? TONE_CLASSES[actionDesc.tone] : 'bg-icon-blue',
        title: isReady ? this.tracker.jobTitle(job) : '',
        percent,
        statusClass: STATUS_CLASSES[job.status],
        isStoppable: job.status === 'QUEUED' || job.status === 'RUNNING',
        isCancelling: job.status === 'CANCELLING',
        isStopping: stopping.has(key),
      };
    });
  });

  constructor() {
    effect(() => {
      const jobs = this.tracker.jobs();
      this.transloco.activeLang();
      untracked(() => {
        if (jobs.length === 0 && this.open()) {
          this.setOpen(false);
        }
        const uniqueModules = Array.from(new Set(jobs.map((job) => job.module)));
        for (const moduleName of uniqueModules) {
          if (!this.tracker.descriptorFor(moduleName)) continue;
          void this.tracker.ensureScopesForModule(moduleName).then(() => {
            this.readyModules.update((set) => {
              if (set.has(moduleName)) return set;
              const next = new Set(set);
              next.add(moduleName);
              return next;
            });
          });
        }
      });
    });
  }

  protected toggle(): void {
    this.setOpen(!this.open());
  }

  protected closeIfOutside(event: Event): void {
    if (!this.open() || this.confirmingStop) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.setOpen(false);
    }
  }

  protected onEscape(): void {
    if (!this.open() || this.confirmingStop) return;
    this.setOpen(false);
  }

  protected openReport(job: BulkJob): void {
    this.setOpen(false);
    this.tracker.openReport(job.app, job.id);
  }

  protected async requestStop(job: BulkJob, event: Event): Promise<void> {
    event.stopPropagation();
    const dialog = this.stopConfirm();
    if (!dialog || this.confirmingStop) return;

    this.confirmingStop = true;
    let confirmed = false;
    try {
      confirmed = await dialog.open();
    } finally {
      this.confirmingStop = false;
    }
    if (!confirmed) return;

    const key = `${job.app}:${job.id}`;
    this.stoppingKeys.update((set) => {
      const next = new Set(set);
      next.add(key);
      return next;
    });
    try {
      await this.tracker.cancel(job);
    } catch (error) {
      this.notify.error(this.tracker.reasonText(errorCodeOf(error) ?? undefined, job));
    } finally {
      this.stoppingKeys.update((set) => {
        if (!set.has(key)) return set;
        const next = new Set(set);
        next.delete(key);
        return next;
      });
    }
  }

  protected async loadRecent(): Promise<void> {
    if (this.loadingRecent()) return;
    this.loadingRecent.set(true);
    try {
      await this.tracker.loadRecent();
    } finally {
      this.loadingRecent.set(false);
    }
  }

  private setOpen(next: boolean): void {
    this.open.set(next);
    this.tracker.setPopoverOpen(next);
  }
}
