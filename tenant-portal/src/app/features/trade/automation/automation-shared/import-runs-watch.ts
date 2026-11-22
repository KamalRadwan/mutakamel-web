import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { Notify } from '../../../../core/notify/notify';
import { getRun } from '../imports.api';
import type { ImportRun } from '../imports.model';
import { isRunActive } from '../imports.registry';
import { type PollHandle, pollWhile } from './poll';

export interface WatchedRunOutcome {
  run: ImportRun;
  route: string[];
}

@Injectable({ providedIn: 'root' })
export class ImportRunsWatch {
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);

  private readonly activeHandles = new Map<string, PollHandle<ImportRun>>();
  private readonly activeIdsSignal = signal<readonly string[]>([]);
  private readonly lastCompletedSignal = signal<WatchedRunOutcome | null>(null);

  readonly activeRunIds = this.activeIdsSignal.asReadonly();
  readonly lastCompletedRun = this.lastCompletedSignal.asReadonly();

  constructor() {
    this.destroyRef.onDestroy(() => {
      for (const handle of this.activeHandles.values()) {
        handle.stop();
      }
      this.activeHandles.clear();
    });
  }

  watch(runId: string): void {
    const id = runId.trim();
    if (!id || this.activeHandles.has(id)) return;

    this.activeIdsSignal.update((ids) => (ids.includes(id) ? ids : [...ids, id]));

    const handle = pollWhile(
      () => getRun(id),
      (run) => isRunActive(run.status),
      3000,
      this.destroyRef,
      (run) => {
        if (!isRunActive(run.status)) {
          this.finishWatch(id, run);
        }
      },
      () => {
        // Keep polling on transient errors unless 404 terminates pollWhile.
      },
    );

    this.activeHandles.set(id, handle);
    void handle.done.then((finalRun) => {
      if (this.activeHandles.get(id) === handle) {
        this.removeWatchState(id);
        if (finalRun && !isRunActive(finalRun.status)) {
          this.notifyOutcome(finalRun);
        }
      }
    });
  }

  unwatch(runId: string): void {
    const handle = this.activeHandles.get(runId);
    if (handle) {
      this.activeHandles.delete(runId);
      handle.stop();
    }
    this.removeWatchState(runId);
  }

  openReport(runId: string): Promise<boolean> {
    return this.router.navigate(['/trade/automation/import-runs', runId]);
  }

  private finishWatch(runId: string, run: ImportRun): void {
    this.activeHandles.delete(runId);
    this.removeWatchState(runId);
    this.notifyOutcome(run);
  }

  private removeWatchState(runId: string): void {
    this.activeIdsSignal.update((ids) => ids.filter((item) => item !== runId));
  }

  private notifyOutcome(run: ImportRun): void {
    const route = ['/trade/automation/import-runs', run.id];
    this.lastCompletedSignal.set({ run, route });

    const name = run.fileName || run.id;
    const openLabel = this.translateOrFallback('automation.watch.openReport', 'Open report');

    switch (run.status) {
      case 'PREVIEWED': {
        const invalid = Number(run.invalidCount);
        const valid = Number(run.validCount);
        if (invalid > 0) {
          this.notify.warning(
            this.translateOrFallback('automation.watch.previewErrorsTitle', 'Check finished with errors'),
            this.translateOrFallback(
              'automation.watch.previewErrorsText',
              `${name}: ${valid} valid, ${invalid} invalid. ${openLabel}.`,
              { name, valid, invalid, action: openLabel },
            ),
          );
        } else {
          this.notify.success(
            this.translateOrFallback('automation.watch.previewReadyTitle', 'File check finished'),
            this.translateOrFallback(
              'automation.watch.previewReadyText',
              `${name}: ${valid} rows ready to import. ${openLabel}.`,
              { name, valid, action: openLabel },
            ),
          );
        }
        return;
      }
      case 'COMPLETED': {
        const count = Number(run.succeededCount);
        this.notify.success(
          this.translateOrFallback('automation.watch.finishedTitle', 'Import finished'),
          this.translateOrFallback(
            'automation.watch.finishedText',
            `${name}: ${count} rows imported. ${openLabel}.`,
            { name, count, action: openLabel },
          ),
        );
        return;
      }
      case 'COMPLETED_WITH_ERRORS': {
        const succeeded = Number(run.succeededCount);
        const failed = Number(run.failedCount);
        this.notify.warning(
          this.translateOrFallback(
            'automation.watch.finishedWithErrorsTitle',
            'Import finished with errors',
          ),
          this.translateOrFallback(
            'automation.watch.finishedWithErrorsText',
            `${name}: ${succeeded} imported, ${failed} failed. ${openLabel}.`,
            { name, succeeded, failed, action: openLabel },
          ),
        );
        return;
      }
      case 'FAILED': {
        this.notify.error(
          this.translateOrFallback('automation.watch.failedTitle', 'Import failed'),
          this.translateOrFallback(
            'automation.watch.failedText',
            `${name} could not be processed. ${openLabel}.`,
            { name, action: openLabel },
          ),
        );
        return;
      }
      case 'CANCELLED': {
        this.notify.info(
          this.translateOrFallback('automation.watch.cancelledTitle', 'Import cancelled'),
          this.translateOrFallback(
            'automation.watch.cancelledText',
            `${name} was cancelled. ${openLabel}.`,
            { name, action: openLabel },
          ),
        );
        return;
      }
      default:
        return;
    }
  }

  private translateOrFallback(
    key: string,
    fallback: string,
    params?: Record<string, unknown>,
  ): string {
    const translated = this.transloco.translate(key, params);
    return translated && translated !== key ? translated : fallback;
  }
}
