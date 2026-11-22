import {
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { tablerCheck } from '@ng-icons/tabler-icons';
import { Notify } from '../../../../core/notify/notify';
import { BulkJobsTracker } from '../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { getBulkJob } from '../../../../shared/bulk-jobs/bulk-jobs.api';
import { BULK_JOB_LIMITS, isBulkJobActive } from '../../../../shared/bulk-jobs/bulk-jobs.model';
import { Button } from '../../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../../shared/ui/confirm-dialog/confirm-dialog';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { Modal } from '../../../../shared/ui/modal/modal';
import {
  TradeReasonPicker,
  type ReasonPickerValue,
} from '../../shared/pickers/reason-picker/reason-picker';
import { type TradeContext, newIdempotencyKey } from '../../shared/trade-api';
import { listReasons } from '../../shared/trade-foundation.api';
import type { ReasonCode } from '../../shared/trade-foundation.model';
import { EvidenceEditor } from '../evidence-editor/evidence-editor';
import { translateTowerError } from '../tower.util';
import { bulkResolve } from '../tower.api';
import type {
  BulkResolveSelection,
  TowerResolutionCode,
  TowerSelectionQuery,
} from '../tower.model';

const RESOLVE_REASON_KIND = 'CONTROL_TOWER_RESOLVE';

@Component({
  selector: 'app-tower-bulk-bar',
  imports: [
    TranslocoPipe,
    Button,
    ConfirmDialog,
    Dropdown,
    Field,
    Modal,
    TradeReasonPicker,
    EvidenceEditor,
  ],
  providers: [provideIcons({ tablerCheck })],
  templateUrl: './tower-bulk-bar.html',
  host: { class: 'block shrink-0' },
})
export class TowerBulkBar {
  private static nextSeq = 0;

  private readonly destroyRef = inject(DestroyRef);
  private readonly notify = inject(Notify);
  private readonly tracker = inject(BulkJobsTracker);
  private readonly transloco = inject(TranslocoService);
  private readonly i18n = translationEvents(this.transloco);

  private readonly bulkModal = viewChild.required<Modal>('bulkModal');
  private readonly discardDialog = viewChild.required<ConfirmDialog>('discardDialog');
  private readonly reasonPicker = viewChild(TradeReasonPicker);
  private readonly evidenceEditor = viewChild(EvidenceEditor);

  protected readonly uid = `tower-bulk-${++TowerBulkBar.nextSeq}`;

  readonly mode = input.required<'ids' | 'query'>();
  readonly selectedIds = input<readonly string[]>([]);
  readonly excludedIds = input<readonly string[]>([]);
  readonly count = input.required<number>();
  readonly hiddenCount = input(0);
  readonly total = input(0);
  readonly canOfferSelectAll = input(false);
  readonly needsCategory = input(false);
  /** List filters incl. status list, includeBranches and branchId (QUERY selection). */
  readonly filterQuery = input<TowerSelectionQuery>({});
  readonly allowedCodes = input<readonly TowerResolutionCode[]>([]);
  /** Scope context; the bulk job scope comes from it, never from the selection. */
  readonly context = input<TradeContext>({});

  readonly selectAllMatching = output<void>();
  readonly selectOnlyPage = output<void>();
  readonly clear = output<void>();
  readonly submitted = output<{ immediateRefresh: boolean }>();

  protected readonly maxSelectionLimit = BULK_JOB_LIMITS.maxItems;
  protected readonly modalOpen = signal(false);
  protected readonly submitting = signal(false);
  protected readonly submittedForm = signal(false);
  protected readonly reasons = signal<ReasonCode[]>([]);
  protected readonly reasonsLoaded = signal(false);

  protected readonly resolutionCode = linkedSignal<
    readonly TowerResolutionCode[],
    TowerResolutionCode | null
  >({
    source: () => this.allowedCodes(),
    computation: (codes, previous) => {
      const prev = previous?.value ?? null;
      if (prev && codes.includes(prev)) return prev;
      return codes[0] ?? null;
    },
  });

  protected readonly reasonValue = signal<ReasonPickerValue>({ reasonCodeId: null, note: '' });
  protected readonly evidence = signal<Record<string, string>>({});

  private destroyed = false;
  private pendingIdemKey: string | null = null;
  private lastPayloadSignature = '';

  protected readonly bulkBusy = computed(() =>
    this.tracker.hasActive('trading', 'trading.control-tower-exceptions'),
  );

  protected readonly tooMany = computed(() => this.total() > BULK_JOB_LIMITS.maxItems);

  protected readonly resolveDisabledReason = computed<string | null>(() => {
    this.i18n();
    if (this.bulkBusy()) return this.transloco.translate('tower.bulk.busy');
    if (this.allowedCodes().length === 0) {
      return this.transloco.translate('tower.bulk.noCommonResolution');
    }
    return null;
  });

  protected readonly resolutionOptions = computed<DropdownOption<TowerResolutionCode | null>[]>(() => {
    this.i18n();
    return this.allowedCodes().map((code) => ({
      value: code,
      label: this.transloco.translate(`tower.resolutions.${code}`),
    }));
  });

  protected readonly resolutionError = computed<string | null>(() => {
    this.i18n();
    if (!this.submittedForm()) return null;
    return this.resolutionCode() ? null : this.transloco.translate('tradeShared.common.required');
  });

  protected readonly hasEmptyReasons = computed(
    () => this.reasonsLoaded() && this.reasons().length === 0,
  );

  protected readonly hasUnsavedChanges = computed(() => {
    if (!this.modalOpen()) return false;
    const defaultCode = this.allowedCodes()[0] ?? null;
    const reason = this.reasonValue();
    return (
      this.resolutionCode() !== defaultCode ||
      reason.reasonCodeId !== null ||
      reason.note.trim().length > 0 ||
      Object.keys(this.evidence()).length > 0
    );
  });

  protected readonly submitDisabled = computed(
    () => this.submitting() || this.hasEmptyReasons() || this.allowedCodes().length === 0,
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
    });
  }

  protected openModal(): void {
    if (this.bulkBusy() || this.allowedCodes().length === 0 || this.count() <= 0) return;
    this.resetForm();
    this.modalOpen.set(true);
    this.bulkModal().open();
    if (!this.reasonsLoaded()) {
      void this.loadReasons();
    }
  }

  protected onResolutionChange(next: TowerResolutionCode | null): void {
    this.resolutionCode.set(next);
  }

  protected async requestCloseModal(): Promise<void> {
    if (this.submitting()) return;
    if (this.hasUnsavedChanges()) {
      const confirmed = await this.discardDialog().open();
      if (!confirmed || this.destroyed) return;
      this.resetForm();
    }
    this.bulkModal().close();
  }

  protected onModalClosed(): void {
    this.modalOpen.set(false);
    this.resetForm();
  }

  protected async submit(): Promise<void> {
    if (this.submitting() || this.count() <= 0 || this.allowedCodes().length === 0) return;
    this.submittedForm.set(true);

    const resCode = this.resolutionCode();
    if (!resCode || this.hasEmptyReasons()) return;

    const rPicker = this.reasonPicker();
    if (rPicker && !rPicker.valid()) return;

    const eEditor = this.evidenceEditor();
    if (eEditor && !eEditor.valid()) return;

    const pickedReasonId = this.reasonValue().reasonCodeId;
    if (!pickedReasonId) return;

    // The backend accepts only a reason code here (never the id).
    const reasonCode = this.reasons().find((r) => r.id === pickedReasonId)?.code;
    if (!reasonCode) return;
    const note = this.reasonValue().note.trim() || null;
    const evidencePayload = { ...this.evidence() };

    const selection: BulkResolveSelection =
      this.mode() === 'query'
        ? {
            kind: 'QUERY',
            query: { ...this.filterQuery() },
            ...(this.excludedIds().length > 0 ? { excludedIds: [...this.excludedIds()] } : {}),
          }
        : {
            kind: 'IDS',
            ids: [...this.selectedIds()],
          };

    const signature = JSON.stringify({
      selection,
      resCode,
      reasonCode,
      note,
      evidencePayload,
      context: this.context(),
    });
    if (!this.pendingIdemKey || signature !== this.lastPayloadSignature) {
      this.pendingIdemKey = newIdempotencyKey();
      this.lastPayloadSignature = signature;
    }

    this.submitting.set(true);
    try {
      const res = await bulkResolve(
        this.context(),
        {
          selection,
          resolutionCode: resCode,
          reasonCode,
          note,
          evidence: evidencePayload,
        },
        this.pendingIdemKey,
      );
      if (this.destroyed) return;

      this.pendingIdemKey = null;
      this.lastPayloadSignature = '';

      try {
        const job = await getBulkJob('trading', res.jobId);
        if (!this.destroyed) {
          this.tracker.syncExternalJob(job);
        }
      } catch {
        void this.tracker.loadRecent();
      }

      const targetCount = res.total > 0 ? res.total : this.count();
      this.notify.info(
        this.transloco.translate('tower.toast.bulkResolving', { n: targetCount }),
      );

      this.resetForm();
      this.bulkModal().close();
      this.submitted.emit({ immediateRefresh: !isBulkJobActive(res.status) });
    } catch (error) {
      if (!this.destroyed) {
        this.notify.error(translateTowerError(this.transloco, error));
      }
    } finally {
      this.submitting.set(false);
    }
  }

  private async loadReasons(): Promise<void> {
    try {
      const list = await listReasons(RESOLVE_REASON_KIND);
      if (!this.destroyed) {
        this.reasons.set(list);
        this.reasonsLoaded.set(true);
      }
    } catch {
      if (!this.destroyed) {
        this.reasons.set([]);
        this.reasonsLoaded.set(true);
      }
    }
  }

  private resetForm(): void {
    this.resolutionCode.set(this.allowedCodes()[0] ?? null);
    this.reasonValue.set({ reasonCodeId: null, note: '' });
    this.evidence.set({});
    this.submittedForm.set(false);
    this.pendingIdemKey = null;
    this.lastPayloadSignature = '';
  }
}
