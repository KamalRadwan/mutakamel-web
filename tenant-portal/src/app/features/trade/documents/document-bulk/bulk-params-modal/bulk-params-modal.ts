import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerBan,
  tablerPlayerPause,
  tablerPlayerPlay,
  tablerPrinter,
  tablerRefresh,
  tablerRubberStamp,
  tablerSend,
} from '@ng-icons/tabler-icons';
import { LanguageState } from '../../../../../core/i18n/language';
import { translationEvents } from '../../../../../core/i18n/translation-events';
import { Notify } from '../../../../../core/notify/notify';
import { ScopeState } from '../../../../../core/scope/scope';
import { getBulkJob, listBulkJobs, submitBulkJob } from '../../../../../shared/bulk-jobs/bulk-jobs.api';
import { type BulkJob, type BulkJobSubmit, isBulkJobActive } from '../../../../../shared/bulk-jobs/bulk-jobs.model';
import { BulkJobsTracker } from '../../../../../shared/bulk-jobs/bulk-jobs-tracker';
import { Button } from '../../../../../shared/ui/button/button';
import { Dropdown, type DropdownOption } from '../../../../../shared/ui/dropdown/dropdown';
import { Field } from '../../../../../shared/ui/field/field';
import { Modal } from '../../../../../shared/ui/modal/modal';
import {
  type ReasonPickerValue,
  TradeReasonPicker,
} from '../../../shared/pickers/reason-picker/reason-picker';
import { ApiError, errorCodeOf } from '../../../shared/trade-api';
import { listReasons } from '../../../shared/trade-foundation.api';
import type { ReasonCode, ReasonKind } from '../../../shared/trade-foundation.model';
import { KIND_CONFIG } from '../../shared/document-kinds';
import type { DocumentKind, ListQuery, PrintLocale, PrintTemplateOption } from '../../shared/document.model';
import { DocumentRequestKeys } from '../../shared/document-request-keys';
import type { DocumentSelection } from '../../shared/document-selection';
import { invalidateDocumentQueries, listPrintTemplates } from '../../shared/documents.api';
import {
  DOCUMENT_BULK_ACTIONS,
  type DocumentBulkAction,
  type DocumentBulkActionSpec,
  type DocumentBulkReasonKind,
  KIND_I18N_KEY,
} from '../documents-bulk.descriptor';

const DEFAULT_TEMPLATE_VALUE = '__default__';

function extractErrorCode(error: unknown): string | null {
  const tradeCode = errorCodeOf(error);
  if (tradeCode) return tradeCode;
  if (error && typeof error === 'object' && 'code' in error) {
    const raw = (error as { code?: unknown }).code;
    if (typeof raw === 'string' && raw.length > 0) return raw;
  }
  return null;
}

@Component({
  selector: 'app-bulk-params-modal',
  imports: [NgIcon, TranslocoPipe, Button, Dropdown, Field, Modal, TradeReasonPicker],
  providers: [
    provideTranslocoScope(
      { scope: 'trade-shared', alias: 'tradeShared' },
      { scope: 'trade-documents', alias: 'td' },
      { scope: 'trade-documents-bulk', alias: 'tdb' },
      { scope: 'bulk-jobs', alias: 'bulkJobs' },
    ),
    provideIcons({
      tablerSend,
      tablerPrinter,
      tablerBan,
      tablerPlayerPause,
      tablerPlayerPlay,
      tablerRubberStamp,
      tablerRefresh,
    }),
  ],
  templateUrl: './bulk-params-modal.html',
})
export class BulkParamsModal {
  private static nextId = 0;
  protected readonly uid = `trade-doc-bulk-params-${++BulkParamsModal.nextId}`;

  private readonly lang = inject(LanguageState).current;
  private readonly scope = inject(ScopeState);
  private readonly notify = inject(Notify);
  private readonly transloco = inject(TranslocoService);
  private readonly tracker = inject(BulkJobsTracker);
  private readonly i18n = translationEvents(this.transloco);

  private readonly modal = viewChild.required(Modal);
  private readonly reasonPicker = viewChild(TradeReasonPicker);

  readonly kind = input.required<DocumentKind>();
  readonly selection = input.required<DocumentSelection>();
  readonly query = input.required<ListQuery>();
  readonly total = input(0);

  readonly submitted = output<string>();

  protected readonly action = signal<DocumentBulkAction | null>(null);
  protected readonly submitting = signal(false);

  protected readonly reasonValue = signal<ReasonPickerValue>({ reasonCodeId: null, note: '' });
  protected readonly showReasonErrors = signal(false);
  private readonly reasons = signal<ReasonCode[]>([]);

  protected readonly templates = signal<PrintTemplateOption[]>([]);
  protected readonly templatesLoading = signal(false);
  protected readonly templatesError = signal(false);
  protected readonly selectedTemplate = signal<string | null>(null);
  protected readonly selectedLocale = signal<PrintLocale>('en-US');

  private openSeq = 0;
  /** One x-idempotency-key per submit; a retry of the same body reuses it, a changed body gets a new one. */
  private readonly requestKeys = new DocumentRequestKeys();

  protected readonly actionSpec = computed<DocumentBulkActionSpec | null>(() => {
    const act = this.action();
    if (!act) return null;
    return DOCUMENT_BULK_ACTIONS[this.kind()].find((spec) => spec.id === act) ?? null;
  });

  protected readonly modalSize = computed(() => (this.action() === 'PRINT' ? 'form' : 'confirm'));
  protected readonly isDanger = computed(() => this.action() === 'CANCEL');
  protected readonly modalIcon = computed(() => this.actionSpec()?.icon ?? 'tablerSend');
  protected readonly modalTile = computed(() => this.actionSpec()?.tile ?? 'bg-icon-blue');
  protected readonly reasonKind = computed<DocumentBulkReasonKind | null>(
    () => this.actionSpec()?.reasonKind ?? null,
  );

  protected readonly selectedCount = computed(() => this.selection().count(this.total()));

  protected readonly usesDefaultTemplate = computed(
    () => this.action() === 'PRINT' && this.selectedTemplate() === DEFAULT_TEMPLATE_VALUE,
  );

  protected readonly selectedTemplateOption = computed<PrintTemplateOption | null>(() => {
    const val = this.selectedTemplate();
    if (!val || val === DEFAULT_TEMPLATE_VALUE) return null;
    return this.templates().find((tpl) => tpl.versionId === val) ?? null;
  });

  protected readonly effectiveLocale = computed<PrintLocale>(
    () => this.selectedTemplateOption()?.locale ?? this.selectedLocale(),
  );

  protected readonly modalTitle = computed(() => {
    this.i18n();
    const act = this.action();
    if (!act) return '';
    return this.transloco.translate(`tdb.modal.title.${KIND_I18N_KEY[this.kind()]}.${act}`);
  });

  protected readonly confirmLine = computed(() => {
    this.i18n();
    const act = this.action();
    if (!act || act === 'PRINT') return '';
    return this.transloco.translate(`tdb.modal.confirm.${KIND_I18N_KEY[this.kind()]}.${act}`, {
      n: this.selectedCount(),
    });
  });

  protected readonly confirmButtonLabel = computed(() => {
    this.i18n();
    const act = this.action();
    if (!act) return '';
    return this.transloco.translate(`tdb.modal.go.${act}`);
  });

  protected readonly templateOptions = computed<DropdownOption<string | null>[]>(() => {
    this.i18n();
    if (this.templatesLoading()) {
      return [{ value: null, label: this.transloco.translate('tdb.print.loadingTemplates'), disabled: true }];
    }
    // Default first: without templateVersionId the worker prints each document with its default assignment.
    const opts: DropdownOption<string | null>[] = [
      { value: DEFAULT_TEMPLATE_VALUE, label: this.transloco.translate('tdb.print.defaultTemplate') },
    ];
    for (const tpl of this.templates()) {
      opts.push({
        value: tpl.versionId,
        label: this.transloco.translate('tdb.print.templateOption', {
          name: tpl.name,
          version: tpl.versionNumber,
        }),
      });
    }
    return opts;
  });

  protected readonly localeOptions = computed<DropdownOption<PrintLocale>[]>(() => {
    this.i18n();
    return [
      { value: 'en-US', label: this.transloco.translate('tdb.print.lang.en-US') },
      { value: 'ar-EG', label: this.transloco.translate('tdb.print.lang.ar-EG') },
    ];
  });

  protected readonly templateError = computed<string | null>(() => {
    this.i18n();
    if (this.templatesError()) {
      return this.transloco.translate('tdb.print.templatesLoadFailed');
    }
    return null;
  });

  protected readonly templateDescribedBy = computed(() => {
    const id = `${this.uid}-template`;
    return this.templateError() ? `${id}-hint ${id}-error` : `${id}-hint`;
  });

  protected readonly canSubmit = computed(() => {
    const act = this.action();
    if (!act || this.submitting() || this.selectedCount() <= 0) return false;
    if (this.reasonKind()) {
      return this.reasonPicker()?.valid() ?? false;
    }
    if (act === 'PRINT') {
      if (this.templatesLoading() || this.templatesError()) return false;
      return this.selectedTemplate() !== null;
    }
    return true;
  });

  open(action: DocumentBulkAction): void {
    const seq = ++this.openSeq;
    this.requestKeys.reset();
    this.action.set(action);
    this.submitting.set(false);
    this.reasonValue.set({ reasonCodeId: null, note: '' });
    this.showReasonErrors.set(false);
    this.reasons.set([]);
    this.templates.set([]);
    this.templatesError.set(false);
    this.templatesLoading.set(false);
    this.selectedTemplate.set(DEFAULT_TEMPLATE_VALUE);
    this.selectedLocale.set(this.lang() === 'ar' ? 'ar-EG' : 'en-US');

    this.modal().open();

    const spec = DOCUMENT_BULK_ACTIONS[this.kind()].find((item) => item.id === action);
    if (spec?.reasonKind) {
      void this.loadReasons(spec.reasonKind, seq);
    } else if (action === 'PRINT') {
      void this.loadTemplates(this.kind(), seq);
    }
  }

  protected close(): void {
    this.modal().close();
  }

  protected onModalClosed(): void {
    this.openSeq++;
    this.action.set(null);
    this.submitting.set(false);
    this.showReasonErrors.set(false);
  }

  protected onTemplateChange(value: string | null): void {
    this.selectedTemplate.set(value);
  }

  protected onLocaleChange(value: PrintLocale): void {
    this.selectedLocale.set(value);
  }

  protected retryTemplates(): void {
    if (this.action() !== 'PRINT' || this.templatesLoading()) return;
    void this.loadTemplates(this.kind(), this.openSeq);
  }

  protected async submit(): Promise<void> {
    const act = this.action();
    if (!act || !this.canSubmit()) return;

    const kind = this.kind();
    const rk = this.reasonKind();
    let params: Record<string, unknown> = {};

    if (rk) {
      const val = this.reasonValue();
      if (!val.reasonCodeId) {
        this.showReasonErrors.set(true);
        return;
      }
      let list = this.reasons();
      if (list.length === 0) {
        try {
          list = await listReasons(rk);
          this.reasons.set(list);
        } catch {
          this.notify.error(this.translateError(null));
          return;
        }
      }
      const matched = list.find((item) => item.id === val.reasonCodeId);
      if (!matched) {
        this.showReasonErrors.set(true);
        return;
      }
      // The reason params schema rejects reasonNote: null; an empty note is left out.
      const trimmedNote = val.note.trim();
      params = { reasonCode: matched.code, ...(trimmedNote ? { reasonNote: trimmedNote } : {}) };
    } else if (act === 'PRINT') {
      if (this.usesDefaultTemplate()) {
        params = { locale: this.selectedLocale() };
      } else {
        const tpl = this.selectedTemplateOption();
        if (!tpl) return;
        params = { templateVersionId: tpl.versionId };
      }
    }

    const companyId = this.scope.company()?.id;
    const branchId = this.scope.branch()?.id;
    const scope: { companyId?: string; branchId?: string } = {
      ...(companyId ? { companyId } : {}),
      ...(branchId ? { branchId } : {}),
    };
    const moduleName = `trading.${KIND_CONFIG[kind].segment}`;
    const body: BulkJobSubmit = {
      module: moduleName,
      action: act,
      scope,
      selection: this.selection().toSelection(this.query()),
      params,
    };

    this.submitting.set(true);
    try {
      await this.tracker.ensureScopesForModule(moduleName).catch(() => undefined);
      const res = await submitBulkJob('trading', body, this.requestKeys.for('submit', body));
      this.requestKeys.reset();
      const jobToSync = await this.resolveSubmittedJob(moduleName, act, scope, res);

      this.tracker.syncExternalJob(jobToSync);
      if (isBulkJobActive(jobToSync.status)) {
        this.notify.info(this.transloco.translate('tdb.toast.started'));
      } else {
        invalidateDocumentQueries(kind);
      }

      this.selection().clear();
      this.submitted.emit(res.jobId);
      this.close();
    } catch (error) {
      const code = extractErrorCode(error);
      this.notify.error(this.translateError(code));
      if (code === 'BULK_JOB_ACTIVE') {
        void this.syncActiveTradingJob();
      }
    } finally {
      this.submitting.set(false);
    }
  }

  private async loadReasons(reasonKind: ReasonKind, seq: number): Promise<void> {
    try {
      const rows = await listReasons(reasonKind);
      if (seq !== this.openSeq) return;
      this.reasons.set(rows);
    } catch {
      if (seq !== this.openSeq) return;
      this.reasons.set([]);
    }
  }

  private async loadTemplates(kind: DocumentKind, seq: number): Promise<void> {
    this.templatesLoading.set(true);
    this.templatesError.set(false);
    try {
      const rows = await listPrintTemplates(kind, this.scope);
      if (seq !== this.openSeq) return;
      this.templates.set(rows);
      this.selectedTemplate.set(DEFAULT_TEMPLATE_VALUE);
    } catch (error: unknown) {
      if (seq !== this.openSeq) return;
      this.templates.set([]);
      if (error instanceof ApiError && error.status === 403) {
        this.selectedTemplate.set(DEFAULT_TEMPLATE_VALUE);
        this.templatesError.set(false);
      } else {
        this.templatesError.set(true);
      }
    } finally {
      if (seq === this.openSeq) {
        this.templatesLoading.set(false);
      }
    }
  }

  private async resolveSubmittedJob(
    module: string,
    action: DocumentBulkAction,
    scope: { companyId?: string; branchId?: string },
    res: {
      jobId: string;
      status: BulkJob['status'];
      total: number;
      skippedAtSubmit: number;
      failedAtSubmit: number;
      chunkCount: number;
      summary?: Record<string, string | number>;
    },
  ): Promise<BulkJob> {
    try {
      return await getBulkJob('trading', res.jobId);
    } catch {
      const now = new Date().toISOString();
      const active = isBulkJobActive(res.status);
      return {
        id: res.jobId,
        app: 'trading',
        module,
        action,
        scope: { ...scope },
        status: res.status,
        total: res.total,
        processed: res.skippedAtSubmit + res.failedAtSubmit,
        counts: {
          succeeded: 0,
          unchanged: 0,
          skipped: res.skippedAtSubmit,
          failed: res.failedAtSubmit,
          cancelled: 0,
        },
        chunkCount: res.chunkCount,
        chunksDone: 0,
        paramsSummary: {},
        ...(res.summary ? { summary: { ...res.summary } } : {}),
        createdAt: now,
        ...(active ? {} : { startedAt: now, finishedAt: now }),
        revision: 0,
      };
    }
  }

  private async syncActiveTradingJob(): Promise<void> {
    try {
      const page = await listBulkJobs('trading', { scope: 'active', page: 1, limit: 10 });
      const active = page.items[0];
      if (active) {
        this.tracker.syncExternalJob(active);
      }
    } catch {
      // Error toast was already displayed.
    }
  }

  private translateError(code: string | null): string {
    if (code) {
      for (const prefix of ['td.errors', 'tdb.errors']) {
        const key = `${prefix}.${code}`;
        const msg = this.transloco.translate(key);
        if (msg && msg !== key) return msg;
      }

      const bulkKey = `bulkJobs.codes.${code}`;
      const bulkMsg = this.transloco.translate(bulkKey, { max: '10,000' });
      if (bulkMsg && bulkMsg !== bulkKey) return bulkMsg;
    }
    return this.transloco.translate('td.errors.generic');
  }
}
