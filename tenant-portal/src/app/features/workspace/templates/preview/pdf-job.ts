import { signal } from '@angular/core';
import {
  TemplatePdfJobArtifact,
  TemplatePdfJobDto,
  TemplatePdfJobFailure,
  TemplatePdfPreviewAcceptedDto,
  getPreviewJob,
  getPreviewJobArtifact,
} from '../templates.api';
import { errorDetailsOf } from '../template-page/template-page.service';

export const PDF_POLL_FAST_MS = 1000;
export const PDF_POLL_FAST_UNTIL_MS = 10_000;
export const PDF_POLL_MEDIUM_MS = 2000;
export const PDF_POLL_MEDIUM_UNTIL_MS = 60_000;
export const PDF_POLL_SLOW_MS = 5000;
export const PDF_POLL_WINDOW_MS = 180_000;

export type PdfPollerStatus =
  | 'IDLE'
  | 'RESOLVING_SOURCE'
  | 'PENDING'
  | 'RETRYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'SLOW'
  | 'EXPIRED';

export interface PdfJobCallbacks {
  onCompleted: (job: TemplatePdfJobDto, blob: Blob) => void;
  onFailed?: (job: TemplatePdfJobDto) => void;
  onExpired?: () => void;
  onError?: (error: unknown) => void;
}

/** Returns the backoff interval in ms: 1s for 0-10s, 2s for 10-60s, then 5s. */
export function pollDelayForElapsedMs(elapsedMs: number): number {
  if (elapsedMs < PDF_POLL_FAST_UNTIL_MS) return PDF_POLL_FAST_MS;
  if (elapsedMs < PDF_POLL_MEDIUM_UNTIL_MS) return PDF_POLL_MEDIUM_MS;
  return PDF_POLL_SLOW_MS;
}

/** Polls a single PDF render job with exponential-step backoff and a 3-minute monitoring window. */
export class PdfJobPoller {
  private readonly _jobId = signal<string | null>(null);
  private readonly _status = signal<PdfPollerStatus>('IDLE');
  private readonly _attemptCount = signal(0);
  private readonly _artifact = signal<TemplatePdfJobArtifact | null>(null);
  private readonly _failure = signal<TemplatePdfJobFailure | null>(null);
  private readonly _createdAt = signal<string | null>(null);
  private readonly _expiresAt = signal<string | null>(null);

  readonly jobId = this._jobId.asReadonly();
  readonly status = this._status.asReadonly();
  readonly attemptCount = this._attemptCount.asReadonly();
  readonly artifact = this._artifact.asReadonly();
  readonly failure = this._failure.asReadonly();
  readonly createdAt = this._createdAt.asReadonly();
  readonly expiresAt = this._expiresAt.asReadonly();

  private timer: ReturnType<typeof setTimeout> | null = null;
  private runSeq = 0;
  private windowStartedAt = 0;
  private callbacks: PdfJobCallbacks | null = null;

  start(accepted: TemplatePdfPreviewAcceptedDto, callbacks: PdfJobCallbacks): void {
    this.stop();
    const seq = this.runSeq;
    this.callbacks = callbacks;
    this._jobId.set(accepted.renderJobId);
    this._status.set(accepted.status);
    this._attemptCount.set(1);
    this._artifact.set(null);
    this._failure.set(null);
    this._createdAt.set(accepted.createdAt);
    this._expiresAt.set(accepted.expiresAt);
    this.windowStartedAt = Date.now();

    this.timer = setTimeout(() => {
      void this.pollOnce(seq, accepted.renderJobId);
    }, PDF_POLL_FAST_MS);
  }

  /** Resumes polling the exact same job after the 3-minute window timed out ("Check again"). */
  resume(): void {
    const id = this._jobId();
    if (!id || !this.callbacks) return;
    this.stop();
    const seq = this.runSeq;
    this.windowStartedAt = Date.now();
    this._status.set('PENDING');
    void this.pollOnce(seq, id);
  }

  markExpired(): void {
    this.stop();
    this._status.set('EXPIRED');
  }

  stop(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.runSeq += 1;
  }

  reset(): void {
    this.stop();
    this._jobId.set(null);
    this._status.set('IDLE');
    this._attemptCount.set(0);
    this._artifact.set(null);
    this._failure.set(null);
    this._createdAt.set(null);
    this._expiresAt.set(null);
  }

  destroy(): void {
    this.stop();
    this.callbacks = null;
  }

  private scheduleNextIfWithinWindow(seq: number, jobId: string): void {
    if (seq !== this.runSeq) return;
    const elapsed = Date.now() - this.windowStartedAt;
    if (elapsed >= PDF_POLL_WINDOW_MS) {
      this._status.set('SLOW');
      return;
    }
    const delay = Math.max(250, Math.min(pollDelayForElapsedMs(elapsed), PDF_POLL_WINDOW_MS - elapsed));
    this.timer = setTimeout(() => {
      void this.pollOnce(seq, jobId);
    }, delay);
  }

  private async pollOnce(seq: number, jobId: string): Promise<void> {
    this.timer = null;
    if (seq !== this.runSeq) return;

    try {
      const job = await getPreviewJob(jobId);
      if (seq !== this.runSeq) return;

      this._attemptCount.set(job.attemptCount);
      this._createdAt.set(job.createdAt);
      this._expiresAt.set(job.expiresAt);

      if (job.status === 'PENDING' || job.status === 'RESOLVING_SOURCE' || job.status === 'RETRYING') {
        this._status.set(job.status);
        this.scheduleNextIfWithinWindow(seq, jobId);
        return;
      }

      if (job.status === 'FAILED') {
        this._failure.set(job.failure);
        this._status.set('FAILED');
        this.callbacks?.onFailed?.(job);
        return;
      }

      if (!job.artifact) {
        this._status.set('FAILED');
        this.callbacks?.onError?.(new Error('PDF artifact missing'));
        return;
      }

      try {
        const blob = await getPreviewJobArtifact(jobId);
        if (seq !== this.runSeq) return;
        this._artifact.set(job.artifact);
        this._expiresAt.set(job.artifact.downloadUrlExpiresAt || job.expiresAt);
        this._status.set('COMPLETED');
        this.callbacks?.onCompleted(job, blob);
      } catch (artifactError) {
        if (seq !== this.runSeq) return;
        this.handlePollError(seq, jobId, artifactError);
      }
    } catch (jobError) {
      if (seq !== this.runSeq) return;
      this.handlePollError(seq, jobId, jobError);
    }
  }

  private handlePollError(seq: number, jobId: string, error: unknown): void {
    const { status, code } = errorDetailsOf(error);
    const normalizedCode = code?.replace(/^CORE\.TEMPLATE\./, '') ?? '';

    if (status === 409 && (normalizedCode === 'PREVIEW.ARTIFACT_NOT_READY' || normalizedCode === 'ARTIFACT_NOT_READY')) {
      this.scheduleNextIfWithinWindow(seq, jobId);
      return;
    }

    if (
      status === 410 ||
      normalizedCode === 'PREVIEW.ARTIFACT_EXPIRED' ||
      normalizedCode === 'ARTIFACT_EXPIRED' ||
      normalizedCode === 'PREVIEW.EXPIRED'
    ) {
      this._status.set('EXPIRED');
      this.callbacks?.onExpired?.();
      return;
    }

    if (
      status === 503 ||
      normalizedCode === 'PDF.ARTIFACT_INTEGRITY_FAILED' ||
      normalizedCode === 'DEPENDENCY.UNAVAILABLE' ||
      normalizedCode === 'PREVIEW.BUNDLE_UNAVAILABLE' ||
      normalizedCode === 'PREVIEW.BUNDLE_INTEGRITY_FAILED' ||
      normalizedCode === 'PREVIEW.AUTHORITY_UNAVAILABLE'
    ) {
      this.callbacks?.onError?.(error);
      return;
    }

    if (status === null || status === 0 || status >= 500) {
      this.scheduleNextIfWithinWindow(seq, jobId);
      return;
    }

    this._status.set('FAILED');
    this.callbacks?.onError?.(error);
  }
}
