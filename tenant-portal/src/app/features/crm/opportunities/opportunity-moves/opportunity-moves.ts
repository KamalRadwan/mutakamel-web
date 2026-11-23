import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { LanguageState } from '../../../../core/i18n/language';
import { ApiError, isRetryableWriteError } from '../../../../core/api/api-errors';
import { Notify } from '../../../../core/notify/notify';
import { errorCodeOf, newIdempotencyKey } from '../../settings/shared/settings-api';
import {
  OPPORTUNITY_ERROR_KEYS,
  moveOpportunityStage,
  opportunitySharedErrorKey,
  transferOpportunityPipeline,
} from '../opportunities.api';
import {
  MoveStageBody,
  OpportunityRow,
  PipelineStageView,
  PipelineView,
  TransferPipelineBody,
  isClosed,
  nameIn,
  stageLabel,
} from '../opportunities.model';
import { opportunityRecordError } from '../opportunity-form/opportunity-form-errors';
import { isTerminalFlag } from '../opportunity-stage-tone';

export type MoveOutcome =
  | { kind: 'moved'; row: OpportunityRow }
  | { kind: 'cancelled' }
  | { kind: 'failed'; code: string | null };

export interface CloseDialogRequest {
  kind: 'WON' | 'LOST';
  title: string;
  stage: PipelineStageView;
}

export interface CloseDialogResult {
  winReasonId?: string;
  lostReasonId?: string;
  lostReason?: string;
  reason?: string;
}

export interface CloseDialogError {
  field: 'reason' | 'note';
  message: string;
}

export interface TransferDialogRequest {
  row: OpportunityRow;
  pipelines: PipelineView[];
}

export interface TransferDialogResult {
  pipelineId: string;
  stageId: string;
  reason?: string;
  lostReason?: string;
  lostReasonId?: string;
  winReasonId?: string;
}

export interface TransferDialogError {
  field: 'pipeline' | 'stage' | 'reason' | 'note';
  message: string;
}

export interface ReopenRequest {
  title: string;
  stageName: string;
}

interface PendingClose {
  seq: number;
  row: OpportunityRow;
  target: PipelineStageView;
  kind: 'WON' | 'LOST';
  resolve: (outcome: MoveOutcome) => void;
}

interface PendingTransfer {
  seq: number;
  row: OpportunityRow;
  pipelines: PipelineView[];
  resolve: (outcome: MoveOutcome) => void;
  /**
   * x-idempotency-key for PUT /opportunities/:id/pipeline (gateway route crm.opportunities.by.id.pipeline.put is
   * idempotent): one key per transfer, reused when the same body is sent again after a failure. A different body
   * gets a new key, since the gateway answers a reused key with another body as 422 GW.IDEM.MISMATCH.
   */
  idempotency?: { key: string; body: string };
}

interface PendingReopen {
  seq: number;
  row: OpportunityRow;
  target: PipelineStageView;
  resolve: (outcome: MoveOutcome) => void;
}

/**
 * Coordinates opportunity stage moves, win/loss closing, reopening, and pipeline transfers.
 * Provided by each host component (not root) alongside the close, transfer, and reopen confirm dialogs:
 * `<app-opportunity-close-dialog [request]="moves.closeRequest()" (done)="moves.resolveClose($event)" />`,
 * `<app-opportunity-pipeline-move-dialog [request]="moves.transferRequest()" (done)="moves.resolveTransfer($event)" />`,
 * and `<ui-confirm-dialog>` wired to `reopenRequest()` -> `resolveReopen(ok)`.
 *
 * Optimistic UI belongs to the caller: the board shows a plain stage move at once (a close or reopen only
 * once saved) and reverts on `cancelled` / `failed`; the stage field rolls back.
 */
@Injectable()
export class OpportunityMoves {
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageState).current;
  private readonly destroyRef = inject(DestroyRef);

  readonly closeRequest = signal<CloseDialogRequest | null>(null);
  readonly closeError = signal<CloseDialogError | null>(null);
  readonly closeSubmitting = signal(false);

  readonly transferRequest = signal<TransferDialogRequest | null>(null);
  readonly transferError = signal<TransferDialogError | null>(null);
  readonly transferSubmitting = signal(false);

  readonly reopenRequest = signal<ReopenRequest | null>(null);

  private seq = 0;
  private pendingClose: PendingClose | null = null;
  private pendingTransfer: PendingTransfer | null = null;
  private pendingReopen: PendingReopen | null = null;
  /** A transfer of a closed opportunity to an open stage, waiting for the reopen confirmation. */
  private pendingTransferReopen: { seq: number; result: TransferDialogResult } | null = null;

  constructor() {
    // Host pipes register the oppMoves alias before loading this scope.
    // Error texts come from OPPORTUNITY_ERROR_KEYS (`opportunities.errors.*`): load that scope here too.
    this.transloco
      .selectTranslate('errors.CRM_REASON_REQUIRED', undefined, { scope: 'opportunities', alias: 'opportunities' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
    this.destroyRef.onDestroy(() => this.cancelPending());
  }

  /**
   * Moves an opportunity within its current pipeline, opening the close dialog for WON/LOST targets
   * or the reopen confirmation when moving a closed opportunity back to a non-terminal stage.
   *
   * Optimistic UI belongs to the caller: the board shows a plain stage move at once (a close or reopen only
   * once saved) and reverts on `cancelled` / `failed`; the stage field rolls back.
   */
  move(row: OpportunityRow, target: PipelineStageView): Promise<MoveOutcome> {
    if (row.stageId === target.id) {
      return Promise.resolve({ kind: 'cancelled' });
    }

    if (target.flag === 'WON' || target.flag === 'LOST') {
      const kind = target.flag;
      this.cancelPending();
      const seq = ++this.seq;
      this.closeError.set(null);
      this.closeSubmitting.set(false);
      this.closeRequest.set({ kind, title: row.title, stage: target });
      return new Promise<MoveOutcome>((resolve) => {
        this.pendingClose = { seq, row, target, kind, resolve };
      });
    }

    if (isClosed(row) && !isTerminalFlag(target.flag)) {
      this.cancelPending();
      const seq = ++this.seq;
      this.reopenRequest.set({
        title: row.title,
        stageName: stageLabel(target, this.language()),
      });
      return new Promise<MoveOutcome>((resolve) => {
        this.pendingReopen = { seq, row, target, resolve };
      });
    }

    return this.executeStageMove(row, target, 'moved');
  }

  /**
   * Marks an opportunity as WON or LOST by picking the pipeline's first active matching stage by rank.
   * Returns `{ kind: 'failed', code: 'NO_TERMINAL_STAGE' }` when none exists.
   *
   * Optimistic UI belongs to the caller: revert optimistic state on `cancelled` / `failed`.
   */
  close(row: OpportunityRow, pipeline: PipelineView, kind: 'WON' | 'LOST'): Promise<MoveOutcome> {
    const target = pipeline.stages
      .filter((stage) => stage.isActive && stage.flag === kind)
      .slice()
      .sort((a, b) => a.rank - b.rank)[0];

    if (!target) {
      this.notify.error(this.translate('oppMoves.toasts.noTerminalStage'));
      return Promise.resolve({ kind: 'failed', code: 'NO_TERMINAL_STAGE' });
    }

    return this.move(row, target);
  }

  /**
   * Opens the pipeline transfer dialog to move an opportunity to another active pipeline.
   *
   * Optimistic UI belongs to the caller: revert optimistic state on `cancelled` / `failed`.
   */
  transfer(row: OpportunityRow, pipelines: PipelineView[]): Promise<MoveOutcome> {
    this.cancelPending();
    const seq = ++this.seq;
    this.transferError.set(null);
    this.transferSubmitting.set(false);
    this.transferRequest.set({ row, pipelines });
    return new Promise<MoveOutcome>((resolve) => {
      this.pendingTransfer = { seq, row, pipelines, resolve };
    });
  }

  /** Resolves or submits the active close dialog request. */
  resolveClose(result: CloseDialogResult | null): void {
    const pending = this.pendingClose;
    if (!pending) return;

    if (result === null) {
      this.seq += 1;
      this.pendingClose = null;
      this.closeSubmitting.set(false);
      this.closeError.set(null);
      this.closeRequest.set(null);
      pending.resolve({ kind: 'cancelled' });
      return;
    }

    if (this.closeSubmitting()) return;
    void this.submitClose(pending, result);
  }

  /** Resolves or submits the active pipeline-transfer dialog request. */
  resolveTransfer(result: TransferDialogResult | null): void {
    const pending = this.pendingTransfer;
    if (!pending) return;

    if (result === null) {
      this.seq += 1;
      this.clearTransferReopen();
      this.pendingTransfer = null;
      this.transferSubmitting.set(false);
      this.transferError.set(null);
      this.transferRequest.set(null);
      pending.resolve({ kind: 'cancelled' });
      return;
    }

    if (this.transferSubmitting() || this.pendingTransferReopen) return;

    const target = pending.pipelines
      .find((pipeline) => pipeline.id === result.pipelineId)
      ?.stages.find((stage) => stage.id === result.stageId);
    if (target && isClosed(pending.row) && !isTerminalFlag(target.flag)) {
      this.pendingTransferReopen = { seq: pending.seq, result };
      this.reopenRequest.set({
        title: pending.row.title,
        stageName: stageLabel(target, this.language()),
      });
      return;
    }

    void this.submitTransfer(pending, result);
  }

  /** Resolves the active reopen confirmation dialog. */
  resolveReopen(ok: boolean): void {
    const transferReopen = this.pendingTransferReopen;
    if (transferReopen) {
      this.clearTransferReopen();
      const transfer = this.pendingTransfer;
      // Declining keeps the transfer dialog open so the user can pick another stage or cancel.
      if (ok && transfer?.seq === transferReopen.seq) {
        void this.submitTransfer(transfer, transferReopen.result);
      }
      return;
    }

    const pending = this.pendingReopen;
    if (!pending) return;
    this.pendingReopen = null;
    this.reopenRequest.set(null);

    if (!ok) {
      pending.resolve({ kind: 'cancelled' });
      return;
    }

    void this.executeStageMove(pending.row, pending.target, 'reopened').then(pending.resolve);
  }

  private async submitClose(pending: PendingClose, result: CloseDialogResult): Promise<void> {
    if (pending.kind === 'LOST' && !result.lostReason?.trim()) {
      this.closeError.set({ field: 'note', message: this.translate('oppMoves.close.noteRequired') });
      return;
    }
    this.closeSubmitting.set(true);
    this.closeError.set(null);

    const body: MoveStageBody = {
      stageId: pending.target.id,
      expectedUpdatedAt: pending.row.updatedAt,
      ...(result.lostReason ? { lostReason: result.lostReason } : {}),
      ...(result.reason ? { reason: result.reason } : {}),
    };

    try {
      const saved = await moveOpportunityStage(pending.row.id, body);
      if (this.pendingClose?.seq !== pending.seq) return;
      this.pendingClose = null;
      this.closeSubmitting.set(false);
      this.closeError.set(null);
      this.closeRequest.set(null);
      this.notify.success(
        this.translate(pending.kind === 'WON' ? 'oppMoves.toasts.won' : 'oppMoves.toasts.lost'),
      );
      pending.resolve({ kind: 'moved', row: saved });
    } catch (error) {
      if (this.pendingClose?.seq !== pending.seq) return;
      this.closeSubmitting.set(false);
      const code = errorCodeOf(error);
      if (code === 'CRM_REASON_REQUIRED' || code === 'OPPORTUNITY_LOST_REASON_REQUIRED') {
        this.closeError.set({
          field: 'reason',
          message: this.errorText(code, pending.kind),
        });
        return;
      }
      if (isRetryableWriteError(error) || (error instanceof ApiError && error.status === 401)) {
        this.notify.error(opportunityRecordError(this.transloco, error, 'oppMoves').message);
        return;
      }
      this.pendingClose = null;
      this.closeError.set(null);
      this.closeRequest.set(null);
      if (code !== 'CRM.OPPORTUNITY.STALE_MOVE') this.notify.error(opportunityRecordError(this.transloco, error, 'oppMoves').message);
      pending.resolve({ kind: 'failed', code });
    }
  }

  private async submitTransfer(pending: PendingTransfer, result: TransferDialogResult): Promise<void> {
    this.transferSubmitting.set(true);
    this.transferError.set(null);

    const targetPipeline = pending.pipelines.find((p) => p.id === result.pipelineId) ?? null;
    const targetStage = targetPipeline?.stages.find((s) => s.id === result.stageId) ?? null;
    const targetKind =
      targetStage?.flag === 'WON' || targetStage?.flag === 'LOST' ? targetStage.flag : undefined;

    const body: TransferPipelineBody = {
      pipelineId: result.pipelineId,
      stageId: result.stageId,
      expectedUpdatedAt: pending.row.updatedAt,
      ...(result.lostReason ? { lostReason: result.lostReason } : {}),
      ...(result.reason ? { reason: result.reason } : {}),
    };

    const bodyKey = JSON.stringify(body);
    if (pending.idempotency?.body !== bodyKey) {
      pending.idempotency = { key: newIdempotencyKey(), body: bodyKey };
    }

    try {
      const saved = await transferOpportunityPipeline(pending.row.id, body, pending.idempotency.key);
      if (this.pendingTransfer?.seq !== pending.seq) return;
      const pipelineName = targetPipeline ? nameIn(targetPipeline, this.language()) : '';
      this.pendingTransfer = null;
      this.transferSubmitting.set(false);
      this.transferError.set(null);
      this.transferRequest.set(null);
      this.notify.success(this.translate('oppMoves.toasts.transferred', { pipeline: pipelineName }));
      pending.resolve({ kind: 'moved', row: saved });
    } catch (error) {
      if (this.pendingTransfer?.seq !== pending.seq) return;
      this.transferSubmitting.set(false);
      if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)) pending.idempotency = undefined;
      const code = errorCodeOf(error);
      if (code === 'OPPORTUNITY_OWNER_INELIGIBLE') {
        this.transferError.set({
          field: 'pipeline',
          message: this.translate('oppMoves.transfer.ownerIneligible'),
        });
        return;
      }
      if (code === 'OPPORTUNITY_PIPELINE_UNCHANGED') {
        this.transferError.set({ field: 'pipeline', message: this.translate('oppMoves.transfer.unchanged') });
        return;
      }
      if (isRetryableWriteError(error) || (error instanceof ApiError && error.status === 401)) {
        this.notify.error(opportunityRecordError(this.transloco, error, 'oppMoves').message);
        return;
      }
      if (code === 'CRM_REASON_REQUIRED' || code === 'OPPORTUNITY_LOST_REASON_REQUIRED') {
        this.transferError.set({
          field: 'reason',
          message: this.errorText(code, targetKind),
        });
        return;
      }
      this.pendingTransfer = null;
      this.transferError.set(null);
      this.transferRequest.set(null);
      if (code !== 'CRM.OPPORTUNITY.STALE_MOVE') this.notify.error(opportunityRecordError(this.transloco, error, 'oppMoves').message);
      pending.resolve({ kind: 'failed', code });
    }
  }

  private async executeStageMove(
    row: OpportunityRow,
    target: PipelineStageView,
    toastKind: 'moved' | 'reopened',
  ): Promise<MoveOutcome> {
    const body: MoveStageBody = {
      stageId: target.id,
      expectedUpdatedAt: row.updatedAt,
    };
    try {
      const saved = await moveOpportunityStage(row.id, body);
      const stage = stageLabel(target, this.language());
      this.notify.success(this.translate(`oppMoves.toasts.${toastKind}`, { stage }));
      return { kind: 'moved', row: saved };
    } catch (error) {
      const code = errorCodeOf(error);
      if (code !== 'CRM.OPPORTUNITY.STALE_MOVE') this.notify.error(opportunityRecordError(this.transloco, error, 'oppMoves').message);
      return { kind: 'failed', code };
    }
  }

  private clearTransferReopen(): void {
    if (!this.pendingTransferReopen) return;
    this.pendingTransferReopen = null;
    this.reopenRequest.set(null);
  }

  private cancelPending(): void {
    this.seq += 1;
    this.pendingTransferReopen = null;

    const close = this.pendingClose;
    this.pendingClose = null;
    this.closeSubmitting.set(false);
    this.closeError.set(null);
    this.closeRequest.set(null);
    close?.resolve({ kind: 'cancelled' });

    const transfer = this.pendingTransfer;
    this.pendingTransfer = null;
    this.transferSubmitting.set(false);
    this.transferError.set(null);
    this.transferRequest.set(null);
    transfer?.resolve({ kind: 'cancelled' });

    const reopen = this.pendingReopen;
    this.pendingReopen = null;
    this.reopenRequest.set(null);
    reopen?.resolve({ kind: 'cancelled' });
  }

  private errorText(code: string | null, kind?: 'WON' | 'LOST'): string {
    if (code) {
      const key = OPPORTUNITY_ERROR_KEYS[code];
      if (key) {
        const translated = this.transloco.translate(key);
        if (translated && translated !== key) {
          return translated;
        }
      }
      if (code === 'OPPORTUNITY_LOST_REASON_REQUIRED') {
        return this.translate('oppMoves.close.reasonOrNoteRequired');
      }
      if (code === 'CRM_REASON_REQUIRED') {
        return this.translate(
          kind === 'LOST' ? 'oppMoves.close.reasonOrNoteRequired' : 'oppMoves.close.winReasonRequired',
        );
      }
      const shared = opportunitySharedErrorKey(code);
      if (shared) return this.translate(shared);
    }
    return this.translate('oppMoves.toasts.failed');
  }

  private translate(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(key, params);
  }
}
