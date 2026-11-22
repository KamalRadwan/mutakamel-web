import { Component, DestroyRef, computed, inject, output, signal, viewChild } from '@angular/core';
import { translationEvents } from '../../../../core/i18n/translation-events';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerAlertTriangle,
  tablerCircleCheck,
  tablerFileSpreadsheet,
  tablerLoader2,
  tablerUpload,
  tablerX,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../core/i18n/language';
import { Notify } from '../../../../core/notify/notify';
import { BulkJobsTracker } from '../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { Button } from '../../../../shared/ui/button/button';
import { Dropdown, type DropdownOption } from '../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../shared/ui/field/field';
import { FileDrop } from '../../../../shared/ui/file-drop/file-drop';
import { Modal } from '../../../../shared/ui/modal/modal';
import { Pagination } from '../../../../shared/ui/pagination/pagination';
import { Stepper, type StepItem, type StepState, type StepStateLabels } from '../../../../shared/ui/stepper/stepper';
import { ActionKeys } from '../automation-shared/action-keys';
import { ImportRunsWatch } from '../automation-shared/import-runs-watch';
import { pollWhile } from '../automation-shared/poll';
import {
  execute,
  getMapping,
  getRun,
  listMappings,
  listResults,
  listRuns,
  preview,
  uploadSource,
} from '../imports.api';
import type {
  ImportMapping,
  ImportMappingDetail,
  ImportRun,
  ImportSource,
  MappingField,
  PreviewImportInput,
  RowResult,
} from '../imports.model';
import { FILE_LIMITS, RUN_ACTIVE } from '../imports.registry';
import {
  fieldLabel,
  formatBytes,
  formatDateTime,
  formatInt,
  normalizePage,
  targetLabel,
  translateImportError,
  translateRowError,
  translateWorkerError,
} from '../mapping-rows/mapping-rows';

type WizardStepId = 'file' | 'mapping' | 'check' | 'import';

export interface WizardPreset {
  mappingId?: string | null;
  predecessorRunId?: string | null;
}

const TERMINAL_RUN_STATUSES = new Set([
  'COMPLETED',
  'COMPLETED_WITH_ERRORS',
  'FAILED',
  'CANCELLED',
]);
let nextWizardSeq = 0;

function activePollStatuses(): readonly string[] {
  return Array.isArray(RUN_ACTIVE) && RUN_ACTIVE.length > 0
    ? RUN_ACTIVE
    : ['PENDING', 'PREVIEWING', 'EXECUTING'];
}

@Component({
  selector: 'app-import-wizard',
  imports: [NgIcon, TranslocoPipe, Button, Dropdown, Field, FileDrop, Modal, Pagination, Stepper],
  providers: [
    provideIcons({
      tablerAlertTriangle,
      tablerCircleCheck,
      tablerFileSpreadsheet,
      tablerLoader2,
      tablerUpload,
      tablerX,
    }),
  ],
  templateUrl: './import-wizard.html',
})
export class ImportWizard {
  private readonly modal = viewChild.required(Modal);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = inject(LanguageState).current;
  private readonly runsWatch = inject(ImportRunsWatch);
  private readonly bulkJobs = inject(BulkJobsTracker);
  private readonly keys = new ActionKeys();
  private readonly i18n = translationEvents(this.transloco);

  protected readonly uid = `import-wizard-${++nextWizardSeq}`;
  protected readonly csvLimitBytes = FILE_LIMITS.csvBytes;
  protected readonly invalidPageSizes = [5, 10, 25];

  readonly closed = output<void>();
  readonly started = output<string>();

  protected readonly step = signal<WizardStepId>('file');
  protected readonly fileError = signal<string | null>(null);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly uploading = signal(false);
  protected readonly uploadProgress = signal(0);
  protected readonly uploadedSource = signal<ImportSource | null>(null);

  protected readonly mappingsLoading = signal(false);
  protected readonly activeMappings = signal<ImportMapping[]>([]);
  protected readonly selectedMappingId = signal('');
  protected readonly selectedMappingDetail = signal<ImportMappingDetail | null>(null);
  protected readonly predecessorRuns = signal<ImportRun[]>([]);
  protected readonly selectedPredecessorId = signal('');

  protected readonly startingPreview = signal(false);
  protected readonly currentRun = signal<ImportRun | null>(null);
  protected readonly invalidRows = signal<RowResult[]>([]);
  protected readonly invalidTotal = signal(0);
  protected readonly invalidPage = signal(1);
  protected readonly invalidPageSize = signal(10);
  protected readonly invalidLoading = signal(false);
  protected readonly executing = signal(false);

  private previewStarted = false;
  private completedCleanly = false;
  private modalOpen = false;
  private pollingDisposed = false;
  private stopPollFn: (() => void) | null = null;
  private invalidSeq = 0;

  constructor() {
    this.destroyRef.onDestroy(() => this.stopPolling());
  }

  protected readonly stepItems = computed<StepItem[]>(() => {
    this.i18n();
    const order: WizardStepId[] = ['file', 'mapping', 'check', 'import'];
    const currentIndex = order.indexOf(this.step());
    const run = this.currentRun();
    const checkFailed = run?.status === 'FAILED';

    return order.map((id, idx): StepItem => {
      let state: StepState = 'todo';
      if (idx < currentIndex) {
        state = 'done';
      } else if (idx === currentIndex) {
        state = id === 'check' && checkFailed ? 'error' : 'current';
      }
      return {
        id,
        label: this.transloco.translate(`imports.wizard.steps.${id}`),
        state,
      };
    });
  });

  protected readonly stepStateLabels = computed<StepStateLabels>(() => {
    this.i18n();
    return {
      done: this.transloco.translate('imports.wizard.stepperState.done'),
      error: this.transloco.translate('imports.wizard.stepperState.error'),
      current: this.transloco.translate('imports.wizard.stepperState.current'),
    };
  });

  protected readonly selectedMapping = computed<ImportMapping | null>(() => {
    const id = this.selectedMappingId();
    if (!id) return null;
    const detail = this.selectedMappingDetail();
    if (detail && detail.id === id) return detail;
    return this.activeMappings().find((m) => m.id === id) ?? null;
  });

  protected readonly expectedFields = computed<MappingField[]>(() => {
    const mapping = this.selectedMappingDetail();
    if (!mapping || mapping.id !== this.selectedMappingId() || !mapping.versions.length) return [];
    const live =
      mapping.versions.find((v) => v.id === mapping.currentPublishedVersionId) ??
      mapping.versions.find((v) => v.status === 'PUBLISHED') ??
      mapping.versions[0];
    return [...(live?.fields ?? [])].sort((a, b) => a.sourceOrdinal - b.sourceOrdinal);
  });

  protected readonly mappingOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    return this.activeMappings().map((mapping) => {
      const target = targetLabel(this.transloco, mapping.targetCode);
      return {
        value: mapping.id,
        label: this.transloco.translate('imports.wizard.mapping.optionFormat', {
          code: mapping.code,
          target,
        }),
      };
    });
  });

  protected readonly predecessorOptions = computed<DropdownOption<string>[]>(() => {
    this.i18n();
    const language = this.lang();
    return [
      { value: '', label: this.transloco.translate('imports.wizard.mapping.predecessorNone') },
      ...this.predecessorRuns().map((run) => ({
        value: run.id,
        label: this.transloco.translate('imports.wizard.mapping.predecessorOption', {
          file: run.fileName || run.id,
          date: formatDateTime(run.createdAt, language),
        }),
      })),
    ];
  });

  protected readonly isChecking = computed(() => {
    const status = this.currentRun()?.status;
    return status === 'PENDING' || status === 'PREVIEWING';
  });

  protected readonly isPreviewed = computed(() => this.currentRun()?.status === 'PREVIEWED');
  protected readonly isCheckFailed = computed(() => this.currentRun()?.status === 'FAILED');

  protected readonly invalidCountNum = computed(() => Number(this.currentRun()?.invalidCount ?? '0'));
  protected readonly validCountNum = computed(() => Number(this.currentRun()?.validCount ?? '0'));
  protected readonly totalCountNum = computed(() => Number(this.currentRun()?.totalCount ?? '0'));

  protected readonly canAdvance = computed(() => {
    switch (this.step()) {
      case 'file':
        return !this.uploading() && !!this.uploadedSource();
      case 'mapping':
        return !this.startingPreview() && !!this.selectedMappingId() && !!this.uploadedSource();
      case 'check':
        return this.isPreviewed() && this.invalidCountNum() === 0 && this.validCountNum() > 0;
      case 'import':
        return false;
    }
  });

  protected readonly fileDisplayName = computed(
    () => this.uploadedSource()?.fileName || this.selectedFile()?.name || this.currentRun()?.fileName || '',
  );

  protected readonly fileDisplaySize = computed(() => {
    const src = this.uploadedSource();
    if (src) return formatBytes(src.storedSize);
    const file = this.selectedFile();
    if (file) return formatBytes(file.size);
    const run = this.currentRun();
    return run ? formatBytes(run.fileSizeBytes) : '—';
  });

  protected readonly fileMetaBadge = computed(() => {
    this.i18n();
    const name = this.fileDisplayName().toLowerCase();
    return name.endsWith('.xlsx')
      ? this.transloco.translate('imports.wizard.file.xlsxType')
      : this.transloco.translate('imports.wizard.file.csvType');
  });

  open(preset: WizardPreset = {}): void {
    this.stopPolling();
    this.step.set('file');
    this.fileError.set(null);
    this.selectedFile.set(null);
    this.uploading.set(false);
    this.uploadProgress.set(0);
    this.uploadedSource.set(null);
    this.selectedMappingId.set(preset.mappingId ?? '');
    this.selectedMappingDetail.set(null);
    this.selectedPredecessorId.set(preset.predecessorRunId ?? '');
    this.predecessorRuns.set([]);
    this.startingPreview.set(false);
    this.currentRun.set(null);
    this.invalidRows.set([]);
    this.invalidTotal.set(0);
    this.invalidPage.set(1);
    this.executing.set(false);
    this.previewStarted = false;
    this.completedCleanly = false;
    this.modalOpen = true;

    this.modal().open();
    void this.loadActiveMappings(preset.mappingId ?? null, preset.predecessorRunId ?? null);
  }

  close(): void {
    this.modal().close();
  }

  protected onModalClosed(): void {
    const wasOpen = this.modalOpen;
    this.modalOpen = false;
    this.stopPolling();
    if (!wasOpen) return;

    const run = this.currentRun();
    if (!this.completedCleanly && this.previewStarted && run && activePollStatuses().includes(run.status)) {
      this.runsWatch.watch(run.id);
      this.notify.info(
        this.transloco.translate('imports.wizard.backgroundToastTitle'),
        this.transloco.translate('imports.wizard.backgroundToastText'),
      );
    } else if (!this.completedCleanly && this.previewStarted && run && run.status === 'PREVIEWED') {
      this.notify.info(
        this.transloco.translate('imports.wizard.keptToastTitle'),
        this.transloco.translate('imports.wizard.backgroundToastText'),
      );
    }
    this.closed.emit();
  }

  protected onFileRejected(reason: 'type' | 'size'): void {
    this.fileError.set(
      this.transloco.translate(reason === 'type' ? 'imports.wizard.file.typeError' : 'imports.wizard.file.sizeError'),
    );
  }

  protected async onFilePicked(file: File): Promise<void> {
    this.fileError.set(null);
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.csv') && !lower.endsWith('.xlsx')) {
      this.onFileRejected('type');
      return;
    }
    if (lower.endsWith('.xlsx') && file.size > FILE_LIMITS.xlsxBytes) {
      this.fileError.set(this.transloco.translate('imports.wizard.file.xlsxTooLarge'));
      return;
    }
    if (file.size > FILE_LIMITS.csvBytes) {
      this.onFileRejected('size');
      return;
    }

    this.selectedFile.set(file);
    this.uploadedSource.set(null);
    this.uploadProgress.set(0);
    this.uploading.set(true);

    try {
      const fileRequest = { name: file.name, size: file.size, lastModified: file.lastModified };
      const source = await uploadSource(file, this.keys.for('upload', fileRequest), (pct) =>
        this.uploadProgress.set(Math.min(100, Math.max(0, pct))),
      );
      this.keys.done('upload');
      this.uploadedSource.set(source);
      this.uploadProgress.set(100);
    } catch (error) {
      this.notify.error(translateImportError(this.transloco, error));
      this.selectedFile.set(null);
      this.uploadedSource.set(null);
      this.uploadProgress.set(0);
    } finally {
      this.uploading.set(false);
    }
  }

  protected removeUploadedFile(): void {
    if (this.uploading()) return;
    this.selectedFile.set(null);
    this.uploadedSource.set(null);
    this.uploadProgress.set(0);
    this.fileError.set(null);
  }

  protected onMappingChange(mappingId: string): void {
    this.selectedMappingId.set(mappingId);
    this.selectedPredecessorId.set('');
    void this.loadMappingDetailsAndPredecessors(mappingId, null);
  }

  protected goPrevious(): void {
    const current = this.step();
    if (current === 'mapping') {
      this.step.set('file');
    } else if (current === 'check') {
      this.stopPolling();
      this.step.set('mapping');
    } else if (current === 'import') {
      this.step.set('check');
    }
  }

  protected uploadFixedFile(): void {
    this.stopPolling();
    this.selectedFile.set(null);
    this.uploadedSource.set(null);
    this.uploadProgress.set(0);
    this.fileError.set(null);
    this.currentRun.set(null);
    this.invalidRows.set([]);
    this.invalidTotal.set(0);
    this.previewStarted = false;
    this.step.set('file');
  }

  protected async goNext(): Promise<void> {
    const current = this.step();
    if (current === 'file') {
      if (!this.uploadedSource()) return;
      this.step.set('mapping');
      return;
    }
    if (current === 'mapping') {
      await this.startPreview();
      return;
    }
    if (current === 'check') {
      if (this.isPreviewed() && this.invalidCountNum() === 0 && this.validCountNum() > 0) {
        this.step.set('import');
      }
    }
  }

  protected onInvalidPageChange(page: number): void {
    this.invalidPage.set(page);
    const run = this.currentRun();
    if (run) {
      void this.loadInvalidRows(run.id, page, this.invalidPageSize());
    }
  }

  protected onInvalidPageSizeChange(size: number): void {
    this.invalidPageSize.set(Math.min(100, size));
    this.invalidPage.set(1);
    const run = this.currentRun();
    if (run) {
      void this.loadInvalidRows(run.id, 1, Math.min(100, size));
    }
  }

  protected async startImport(): Promise<void> {
    const run = this.currentRun();
    if (!run || this.executing()) return;
    this.executing.set(true);
    try {
      const action = `execute:${run.id}`;
      const res: unknown = await execute(run.id, run.version, this.keys.for(action, { ifMatch: run.version }));
      this.keys.done(action);
      if (res && typeof res === 'object' && 'jobId' in res) {
        void this.bulkJobs.loadRecent();
      }
      this.completedCleanly = true;
      this.stopPolling();
      this.notify.success(this.transloco.translate('imports.wizard.import.startedToast'));
      this.modal().close();
      this.started.emit(run.id);
      void this.router.navigate(['/trade/automation/import-runs', run.id]);
    } catch (error) {
      this.notify.error(translateImportError(this.transloco, error));
    } finally {
      this.executing.set(false);
    }
  }

  protected formatCount(value: string | number | null | undefined): string {
    return formatInt(value);
  }

  protected fieldName(code: string | null | undefined): string {
    return fieldLabel(this.transloco, code);
  }

  protected problemText(code: string | null | undefined): string {
    return translateRowError(this.transloco, code);
  }

  protected workerFailureMessage(): string {
    return translateWorkerError(this.transloco, this.currentRun()?.failure?.code);
  }

  protected selectedPredecessorLabel(): string | null {
    const id = this.selectedPredecessorId();
    if (!id) return null;
    return this.predecessorOptions().find((opt) => opt.value === id)?.label ?? id;
  }

  private async loadActiveMappings(presetMappingId: string | null, presetPredecessorId: string | null): Promise<void> {
    this.mappingsLoading.set(true);
    try {
      const res = await listMappings({ status: 'ACTIVE', limit: 100 });
      const items = normalizePage<ImportMapping>(res, 1, 100).items.filter((m) => m.status === 'ACTIVE');
      this.activeMappings.set(items);

      const chosenId =
        presetMappingId && items.some((m) => m.id === presetMappingId)
          ? presetMappingId
          : (items[0]?.id ?? '');
      this.selectedMappingId.set(chosenId);
      if (chosenId) {
        await this.loadMappingDetailsAndPredecessors(chosenId, presetPredecessorId);
      }
    } catch (error) {
      this.notify.error(translateImportError(this.transloco, error));
    } finally {
      this.mappingsLoading.set(false);
    }
  }

  private async loadMappingDetailsAndPredecessors(
    mappingId: string,
    presetPredecessorId: string | null,
  ): Promise<void> {
    try {
      const [detail, runsRes] = await Promise.all([
        getMapping(mappingId),
        listRuns({ mappingId, limit: 50 }),
      ]);
      if (this.selectedMappingId() !== mappingId) return;
      this.selectedMappingDetail.set(detail);
      const terminalRuns = normalizePage<ImportRun>(runsRes, 1, 50).items.filter(
        (run) => run.mappingId === mappingId && TERMINAL_RUN_STATUSES.has(run.status),
      );
      this.predecessorRuns.set(terminalRuns);
      if (presetPredecessorId && terminalRuns.some((r) => r.id === presetPredecessorId)) {
        this.selectedPredecessorId.set(presetPredecessorId);
      }
    } catch {
      // Keep list fallback if detail or predecessors fail transiently.
    }
  }

  private async startPreview(): Promise<void> {
    const source = this.uploadedSource();
    const mappingId = this.selectedMappingId();
    if (!source || !mappingId || this.startingPreview()) return;

    this.startingPreview.set(true);
    this.invalidRows.set([]);
    this.invalidTotal.set(0);
    this.invalidPage.set(1);

    try {
      const predecessorId = this.selectedPredecessorId().trim();
      const input: PreviewImportInput = {
        mappingId,
        sourceId: source.fileId,
        ...(predecessorId ? { predecessorRunId: predecessorId } : {}),
      };
      const accepted = await preview(input, this.keys.for('preview', input));
      this.keys.done('preview');
      this.previewStarted = true;
      // The preview answer (202) only names the queued run; the run itself is read next.
      const run = await getRun(accepted.runId);
      this.currentRun.set(run);
      this.step.set('check');
      if (activePollStatuses().includes(run.status)) {
        this.beginPolling(run.id);
      } else if (run.status === 'PREVIEWED' && Number(run.invalidCount) > 0) {
        void this.loadInvalidRows(run.id, 1, this.invalidPageSize());
      }
    } catch (error) {
      this.notify.error(translateImportError(this.transloco, error));
    } finally {
      this.startingPreview.set(false);
    }
  }

  private beginPolling(runId: string): void {
    this.stopPolling();
    this.pollingDisposed = false;
    const handle: unknown = pollWhile(
      async () => {
        const fresh = await getRun(runId);
        if (this.pollingDisposed || !this.modalOpen || this.currentRun()?.id !== runId) {
          return fresh;
        }
        this.currentRun.set(fresh);
        if (fresh.status === 'PREVIEWED' && Number(fresh.invalidCount) > 0 && this.invalidTotal() === 0) {
          void this.loadInvalidRows(fresh.id, 1, this.invalidPageSize());
        }
        return fresh;
      },
      (run) => !this.pollingDisposed && this.modalOpen && (run.status === 'PENDING' || run.status === 'PREVIEWING'),
      3000,
      this.destroyRef,
    );
    if (typeof handle === 'function') {
      this.stopPollFn = handle as () => void;
    }
  }

  private stopPolling(): void {
    this.pollingDisposed = true;
    this.stopPollFn?.();
    this.stopPollFn = null;
  }

  private async loadInvalidRows(runId: string, page: number, limit: number): Promise<void> {
    const seq = ++this.invalidSeq;
    this.invalidLoading.set(true);
    try {
      const res = await listResults(runId, { status: 'INVALID', page, limit });
      if (seq !== this.invalidSeq) return;
      const normalized = normalizePage<RowResult>(res, page, limit);
      this.invalidRows.set(normalized.items);
      this.invalidTotal.set(normalized.total);
    } catch {
      if (seq === this.invalidSeq) {
        this.invalidRows.set([]);
      }
    } finally {
      if (seq === this.invalidSeq) {
        this.invalidLoading.set(false);
      }
    }
  }
}
