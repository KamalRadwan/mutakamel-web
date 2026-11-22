import { DestroyRef, Injectable, inject } from '@angular/core';
import { CommercialOperation, getOperation } from '../billing.api';

export type OperationPollResult =
  | { kind: 'ready'; operation: CommercialOperation }
  | { kind: 'terminal'; operation: CommercialOperation }
  | { kind: 'committed'; operation: CommercialOperation }
  | { kind: 'timeout'; operation: CommercialOperation | null }
  | { kind: 'cancelled' }
  | { kind: 'error'; error: unknown };

export interface OperationPollOptions {
  initialDelayMs?: number;
  maxAttempts?: number;
  onTick?: (op: CommercialOperation) => void;
}

const DEFAULT_DELAY_MS = 2000;
const DEFAULT_MAX_ATTEMPTS = 60;

@Injectable()
export class OperationPoller {
  private runId = 0;
  private destroyed = false;
  private activeTimer: ReturnType<typeof setTimeout> | null = null;
  private activeWake: (() => void) | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.stop();
    });
  }

  async poll(operationId: string, opts?: OperationPollOptions): Promise<OperationPollResult> {
    this.stop();
    if (this.destroyed) return { kind: 'cancelled' };
    const myRun = this.runId;
    const maxAttempts = Math.max(1, opts?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
    let lastOp: CommercialOperation | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const delayMs =
        attempt === 1
          ? (opts?.initialDelayMs ?? DEFAULT_DELAY_MS)
          : lastOp?.retryAfterSeconds && lastOp.retryAfterSeconds > 0
            ? lastOp.retryAfterSeconds * 1000
            : DEFAULT_DELAY_MS;

      if (delayMs > 0) {
        await this.sleep(delayMs);
        if (myRun !== this.runId) {
          return { kind: 'cancelled' };
        }
      }

      let op: CommercialOperation;
      try {
        op = await getOperation(operationId);
      } catch (error) {
        if (myRun !== this.runId) {
          return { kind: 'cancelled' };
        }
        return { kind: 'error', error };
      }

      if (myRun !== this.runId) {
        return { kind: 'cancelled' };
      }

      lastOp = op;
      opts?.onTick?.(op);

      if (op.state === 'READY') {
        return { kind: 'ready', operation: op };
      }
      if (op.state === 'COMMITTED') {
        return { kind: 'committed', operation: op };
      }
      if (op.state === 'BLOCKED' || op.state === 'ABORTED' || op.state === 'NEEDS_REVIEW') {
        return { kind: 'terminal', operation: op };
      }
    }

    return { kind: 'timeout', operation: lastOp };
  }

  stop(): void {
    this.runId += 1;
    if (this.activeTimer !== null) {
      clearTimeout(this.activeTimer);
      this.activeTimer = null;
    }
    const wake = this.activeWake;
    this.activeWake = null;
    wake?.();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.activeWake = resolve;
      this.activeTimer = setTimeout(() => {
        this.activeTimer = null;
        this.activeWake = null;
        resolve();
      }, ms);
    });
  }
}
